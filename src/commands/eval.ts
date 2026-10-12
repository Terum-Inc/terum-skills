import { runEvalBatch, EVAL_PARALLEL_DEFAULT, EVAL_LOCK_WAIT_MS } from '../lib/evals/batch.js';
import { dequeueEvals, enqueueEvals, queueKey, readEvalQueue, updateEvalQueue, withEvalQueueLock, type EvalQueueItem } from '../lib/evals/queue.js';
import { packageRoot } from '../lib/package-root.js';
import { invocation, type InvocationForm, type WithForm } from '../lib/invocation.js';
/** Local-only orchestration for the eval engine. Receipt commits deliberately begin in IE3. */
import { mkdir, mkdtemp, readFile, readdir, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ConfigStore, createConfigStore, selectTeam } from '../lib/config.js';
import type { Config } from '../lib/schema.js';
import { localReceiptsFor, newestReceiptAt } from '../lib/evals/receipt-store.js';
import { type AgentApi, DEFAULT_MODEL, preflight as systemPreflight, systemAgent } from '../lib/evals/agent.js';
import { type Arm, type ArmSpec, type DroppedCase, type ArmSample, type ComparisonRow, loadCase, loadSuite, runCase, runSuite } from '../lib/evals/execution.js';
import { BRIEF_MAX, assetHeader, checkBriefNeutrality, deriveBrief, generate, type GeneratedAssets } from '../lib/evals/generate.js';
import { assessHygiene, exemptAuthorEmail, formatHygieneFindings, hygieneFrontmatter, HygieneRefused, inspectContent, reportHygieneWarnings } from '../lib/evals/hygiene.js';
import { makeRng } from '../lib/evals/judge.js';
import { receiptPath, buildReceipt, NO_TEAM_RUNNER_HANDLE } from '../lib/evals/receipt.js';
import { aggregate, renderReport, runIdFrom, writeRunTree, type Aggregate } from '../lib/evals/results.js';
import type { Verdict } from '../lib/evals/stats.js';
import { packageVersion } from '../lib/package.js';
import { parseTriggers, runTriggerEvals, type TriggerSummary } from '../lib/evals/triggers.js';
import { Prompter } from '../lib/prompt.js';
import { fromError, failure, failureWith, type Result, success } from '../lib/result.js';
import { type Runner, systemRunner } from '../lib/runner.js';
import { inspectSkillSource, sourceFiles } from '../lib/skill-source.js';
import { findSkill, readTeam, skillContentDigest, skillRecords } from '../lib/skills.js';
import { parseSkillFrontmatter } from '../lib/schema.js';
import { admitForEval, refIsPath, resolveLibrarySkill, unusableSkillFolder } from '../lib/local-skills.js';
import { resolveSkillRef } from '../lib/resolve-ref.js';
import { parseVersionFolder, versionLabel, type SkillVersion } from '../lib/versions.js';
import { openTeamRepo, refreshClone, lockWait, listVersions, skillVersions } from '../lib/teamRepo.js';
import { dependencyPlan, scanHeavySkill } from '../lib/evals/dependencies.js';

export interface EvalArgs extends WithForm {
  /** A name, a folder path, or absent: the skill folder above `cwd` (§6.1 rung 0). */
  ref?: string;
  /** Where a bare `eval` looks for the skill folder; defaults to process.cwd(). */
  cwd?: string;
  /** The home the Library roots derive from (tests); defaults to homedir(). */
  home?: string;
  /** Queue guard, re-keyed on the CONTENT HASH (§6.6): never bill bytes other than the queued ones. */
  expectedVersion?: string;
  /** Queue-only: reuse a receipt found after refresh, before any paid work. */
  skipReceipted?: boolean;
  k?: number;
  /** IE6 §1: the rival skill ref. Its presence is what enters head-to-head mode. */
  vs?: string;
  /** IE6 §3.1: a human-written shared brief, skipping derivation and the confirm gate. */
  brief?: string;
  /**
   * IE6 §3.1: derive the shared brief, write it, and STOP — no arms, no matrix. The confirm gate
   * needs a human, and a GUI caller cannot answer `io.confirm` in a spawned CLI. This splits the
   * gate into two invocations so the human still signs the brief: derive here, review it in the
   * app, then run with `--brief <path>`. A caller passing neither still gets the cheap refusal
   * rather than paying for a derivation it did not ask for.
   */
  deriveBrief?: boolean;
  triggersOnly?: boolean;
  executionOnly?: boolean;
  case?: string;
  model?: string;
  judgeModel?: string;
  noGen?: boolean;
  /** Force or decline the heavy one-session mode without a prompt. */
  heavy?: boolean;
  /**
   * `false` keeps a finished receipt on this machine. Absent publishes it to the team when — and only
   * when — these exact bytes are already a published version (`shareReceipt`).
   */
  commit?: boolean;
  team?: string;
  config?: ConfigStore;
  runner?: Runner;
  agent?: AgentApi;
  preflight?: (model?: string) => ReturnType<typeof systemPreflight>;
  now?: () => Date;
  /** Test knob: the clone lock's wait budget. Production takes it from the Prompter (teamRepo lockWait). */
  lockWaitMs?: number;
}

export interface EvalResult {
  alreadyEvaluated?: boolean;
  /** §6.3: null when the folder belongs to no team — the local-folder resolve has neither. */
  team: string | null;
  /** §6.1: the folder's declared `metadata.id` when it has one; null before its first publish. */
  id: string | null;
  /** The version this run's receipt was published to, when it was. */
  publishedTo?: string;
  /** §6.3: the caller's cue for "To share these results, publish the skill again." */
  shareHint?: true;
  name: string;
  runDir: string;
  ccVersion: string;
  executionStatus: 'complete' | 'partial' | 'failed';
  /** IE6 §3.1: set by `--derive-brief`. Nothing was evaluated; the other fields are placeholders. */
  derivedBriefOnly?: true;
  /** IE6 §3.1: where the derived brief landed, and its text, so a GUI can show it for review. */
  briefPath?: string;
  brief?: string;
  receiptPath?: string;
  /** D11: what `renderReport` printed, as data — the normal run only; an already-evaluated answer carries none. */
  report?: { aggregate: Aggregate; triggers: TriggerSummary | null };
}

export function heavyNotice(cases: string): string {
  return `This skill appears to call subagents, which can be expensive. Instead of
running it once per case, this evaluation runs one session with the skill
and one without, against a single fixture with many checks, to limit usage
and wall-clock time. The verdict therefore rests on one session and will
vary more between runs. To reduce variance, uncheck the box below; that
runs the skill ${cases} times in sequence. If the run is interrupted or your
usage runs out, it is marked unscored and must be run again.`;
}

/**
 * §6: fetch/read only from the team clone; --commit adds exactly one immutable receipt via
 * safeWrite. When the run generated its eval assets, --commit first shows them and pauses on one
 * y/N: a confirmed run commits them into the skill through the ordinary write path (any member —
 * Terum 6fafb8d3), re-runs at the committed tree, and lands the receipt there; a decline keeps
 * them in the run tree and lands no receipt.
 */
/** The sentence for a ref no Library root holds; `run` and `runMany` refuse with the same words. */
export function missingSkillFolder(ref: string): string {
  return refIsPath(ref)
    ? `\`${ref}\` is not a skill folder in your library (~/.claude/skills or an added project's .claude/skills); add the project holding it with \`project add\`, or install it from the marketplace first.`
    : `No local skill folder named \`${ref}\` in your library; install it from the marketplace first, or pass the folder's path.`;
}
export async function run(args: EvalArgs, io: Prompter): Promise<Result<EvalResult>> {
  try {
    if (args.triggersOnly && args.executionOnly) return failure('--triggers-only and --execution-only cannot be used together.');
    // IE6 §1.2 — every head-to-head refusal is checked before any agent call. The spec's list was
    // written against the team-clone model; --working/--save/--gen no longer exist, and the flags
    // below are their equivalents on the local-folder model (§6.3).
    const headToHead = args.vs !== undefined;
    if (args.deriveBrief && !headToHead) return failure('--derive-brief only applies to a head-to-head: pass --vs <other-skill>.');
    if (headToHead) {
      if (args.commit) return failure('head-to-head runs are never committed: a receipt pins one skill id and one content digest.');
      if (args.case !== undefined) return failure('--vs cannot be combined with --case: a named case is an authored assertion belonging to one skill.');
      if (args.triggersOnly) return failure('--vs cannot be combined with --triggers-only: trigger evals are per-skill, and head-to-head is execution only.');
      // Cases come from the shared brief, so --no-gen would leave the run with zero cases — and a
      // zero-row expectation reports `complete` (engine §7.1), a clean report over no evidence.
      if (args.noGen) return failure('--vs cannot be combined with --no-gen: head-to-head cases are generated from the shared brief, so --no-gen would run zero cases.');
      // The queue exists to produce receipts; a head-to-head never lands one.
      if (args.expectedVersion !== undefined || args.skipReceipted) return failure('head-to-head runs are not queueable: the queue exists to land receipts, and this mode never commits one.');
      // --derive-brief is the GUI's half of the gate: it is allowed here precisely because it
      // does not run anything, and the human confirms in the app before the second invocation.
      if (args.brief !== undefined && args.deriveBrief) return failure('--derive-brief derives the shared brief; pass one or the other, not both.');
      if (args.brief === undefined && !args.deriveBrief && !io.interactive) {
        return failure('A head-to-head needs a shared task brief confirmed by a human. This channel cannot ask, so derive one with --derive-brief and re-run with --brief <path>, or write it yourself.');
      }
    }
    // Default k=1 (spec rev 18; Ajay, 2026-09-10) — overrides the 2026-09-07 "keep default k=3"
    // ruling (Terum 5aa9a4b2) on cost: k=3 -> k=1 takes a 3-case run from ~$4.40 to ~$1.50 measured.
    // A receipt you intend to gate on wants --k 3 or more; §16.6 carries the noise caveat.
    // IE6 §7: the comparison is the noisier quantity and reps are the cheapest mitigation, so
    // head-to-head keeps its own default rather than inheriting the k=1 cost default.
    const k = args.k ?? (headToHead ? 5 : 1);
    if (!Number.isInteger(k) || k < 1) return failure('--k must be a positive integer.');
    const store = args.config ?? createConfigStore();
    const runner = args.runner ?? systemRunner;
    const config = await store.read();
    // §6.3 / D42: eval targets a LOCAL folder, so the team is best-effort. It supplies exactly three
    // things — the incumbent arm (§6.5), the hygiene license policy, and the receipt's `skill_id`/
    // `team` — and a machine with no team configured evaluates single-arm rather than being turned
    // away, which is the whole reason §6.2 re-keyed the local store by content. `selectTeam` still
    // throws on an ambiguous --team-less multi-team machine: that is a machine the user can
    // disambiguate with one flag, not a skill that belongs to nobody.
    const selected = args.team !== undefined || Object.keys(config.teams).length > 0 ? selectTeam(config.teams, args.team, args.form) : null;
    const teamName = selected === null ? null : selected[0];
    const handle = selected === null ? null : selected[1].handle;
    const clone = teamName === null ? null : store.teamClone(teamName);
    if (clone !== null && teamName !== null) await refreshClone(runner, clone, { label: teamName, ...lockWait(io, args.lockWaitMs) });
    const team = clone === null ? null : await readTeam(clone);
    // §6.3: the bytes come from the Library, not the clone. The clone is still read for the incumbent
    // arm and the policy, but a folder that belongs to no team is evaluable.
    // §6.1: a name, a path, or nothing (the folder above cwd). eval runs rungs 0–2 only — it is paid, so a
    // prefix never picks the bill — and reads no team names: the bytes must be a Library folder.
    const resolved = await resolveSkillRef({
      ref: args.ref, cwd: args.cwd ?? process.cwd(), home: args.home ?? homedir(), config, stateRoot: store.root, rungs: 2, print: (line) => io.print(line),
      // The ref is a name or a folder path (refIsPath): there is no separate --path flag, so the miss must
      // not promise one. A path outside every Library root is refused like an unknown name — the roots are
      // the only place a ref may land — and the sentence says which roots would have held it.
      miss: (ref) => `No local skill folder named \`${ref}\` in your library; install it from the marketplace first, or pass the folder's path.`,
      pathMiss: (ref) => `\`${ref}\` is not a skill folder in your library (~/.claude/skills or an added project's .claude/skills); add the project holding it with \`project add\`, or install it from the marketplace first.`,
    });
    if (!resolved.ok) return failure(resolved.error);
    if (resolved.value.source !== 'library') return failure(`No local skill folder named \`${resolved.value.name}\` in your library; install it from the marketplace first, or pass the folder's path.`);
    // Claude Code's own skill fields (`model`, `argument-hint`, …) are part of what eval measures, so a
    // folder the scan refused only for those is evaluated as it is (`admitForEval`); `hooks` is not.
    const local = await admitForEval(resolved.value.match);
    // D72: the folder is there but the scan rejected it or could not read it. Say so, with the
    // scan's own detail against the path — the miss above is reserved for a name no root holds.
    const unusable = unusableSkillFolder(local);
    if (unusable !== undefined) return failure(unusable);
    // IE6 §1: the rival resolves the same way the candidate does. The spec said "the rival is
    // always a committed version" against the old team-clone model; on the local-folder model
    // (§6.3) neither side is a committed tree, so both are Library folders and the run records
    // each one's content digest instead.
    let rival: { name: string; dir: string; id: string | null; digest?: string } | undefined;
    if (args.vs !== undefined) {
      const rivalFound = await resolveLibrarySkill(args.home ?? homedir(), config, store.root, args.vs);
      if (rivalFound === undefined) return failure(missingSkillFolder(args.vs));
      const rivalMatch = await admitForEval(rivalFound);
      const rivalUnusable = unusableSkillFolder(rivalMatch);
      if (rivalUnusable !== undefined) return failure(rivalUnusable);
      if (resolve(rivalMatch.path) === resolve(local.path)) return failure(`--vs ${args.vs} resolves to the same folder as ${args.ref ?? local.name}; a head-to-head needs two different skills.`);
      rival = { name: rivalMatch.name, dir: rivalMatch.path, id: null };
    }
    // §1.2 / §3.1: a supplied brief is validated HERE — before hygiene, before preflight, and so
    // before any agent call. Rejecting a brief that names a skill must not cost a run. Rev 1
    // trusted supplied briefs because "a human wrote it", but --brief is mandatory without a
    // terminal, which is exactly where nobody is watching.
    let suppliedBrief: { text: string; path: string } | undefined;
    if (rival !== undefined && args.brief !== undefined) {
      const briefPath = resolve(args.brief);
      const supplied = await optionalText(briefPath);
      if (supplied === undefined) return failure(`No brief file at ${args.brief}.`);
      const text = supplied.replace(/^#.*$/gm, '').trim();
      if (!text) return failure(`The brief at ${args.brief} is empty.`);
      if (text.length > BRIEF_MAX) return failure(`The brief at ${args.brief} is ${text.length} characters; the cap is ${BRIEF_MAX} so a human actually reads it before confirming.`);
      const neutrality = checkBriefNeutrality(text, [local.name, rival.name]);
      if (neutrality.kind === 'refuse') return failure(`The brief at ${args.brief} names '${neutrality.name}'. A brief that names a tool is describing the tool, not the job; describe the work both skills are competing to do.`);
      if (neutrality.kind === 'warn') io.print(`Note: the brief contains the word '${neutrality.name}', which is also a skill name here. Continuing — it reads as an ordinary word.`);
      suppliedBrief = { text, path: briefPath };
    }
    // Best-effort, never a gate: a folder the team has never seen is still evaluable (§6.3).
    // By the FOLDER's name, not the ref: a path ref would never match a team skill, and the incumbent arm
    // would then silently treat a published skill as one the team has never seen.
    const record = clone === null || teamName === null ? undefined : await findSkill(clone, teamName, local.name);

    // Pin the evaluated version and materialize its immutable snapshot BEFORE anything reads
    // skill content: a concurrent sync can refresh the clone mid-run, and the receipt's tree
    // hash must pin the exact skill text AND cases evaluated (§4.1; review P1). A concurrent
    // update may make this an older (but still exact) historical receipt.
    // §6.3: eval targets a LOCAL folder. There is no version number at run time — the skill may never
    // have been published — so the candidate is identified by its content digest (§6.1) and publish
    // resolves that to a version when it attaches the run.
    const candidateDir = local.path;

    // This is intentionally before preflight, trigger selection, run-tree creation, or any agent call.
    const candidateFiles = await sourceFiles(candidateDir);
    const candidateDigest = skillContentDigest(candidateFiles.files);
    // §6.1: the id is the FOLDER's declared `metadata.id` when it has one — never the team record's,
    // which may not exist — and null before the folder's first publish. Read through the lenient
    // inspector, because an unpublished folder legitimately carries no managed fields at all (§6.3),
    // and with Claude Code's fields accepted, as `admitForEval` accepted them, so a folder that sets
    // `model` still reports its own id and description.
    const inspected = inspectSkillSource(candidateFiles.files.get('SKILL.md')?.toString('utf8') ?? '', undefined, { claudeCodeFields: true });
    const skillId = (inspected.ok ? inspected.id : null) ?? record?.id ?? null;
    const description = (inspected.ok ? inspected.description : inspected.description) ?? record?.frontmatter.description ?? '';
    const wantsCases = !args.triggersOnly;
    const wantsTriggers = !args.executionOnly;
    const authoredCasesDir = join(candidateDir, 'evals', 'cases');
    const authoredCaseFiles = (await optionalDirectory(authoredCasesDir)).filter((name) => /\.ya?ml$/i.test(name)).sort();
    // A suite is one authored execution asset even though it expands into multiple receipt rows.
    const authoredSuite = await optionalText(join(candidateDir, 'evals', 'suite.yaml'));
    const authoredTrigger = candidateFiles.files.has('evals/triggers.yaml');
    const assets = { name: local.name, wantsCases, wantsTriggers, authoredCaseFiles, authoredSuite: authoredSuite !== undefined, authoredTrigger };
    if (args.skipReceipted || args.expectedVersion !== undefined) {
      // Both queue guards are re-keyed on the content hash (§6.6): the bytes, not an ordinal, are what
      // a queued item was queued against.
      if (args.expectedVersion !== undefined && args.expectedVersion !== candidateDigest) {
        return failure(`The queued bytes of ${local.name} are no longer what is on disk; dequeue it and queue it again.`);
      }
      const already = await localReceiptsFor(store.root, candidateDigest, line => io.print(line));
      if (args.skipReceipted && already.length) {
        const newest = already[already.length - 1]!;
        io.print(`Already evaluated these exact bytes of ${local.name}.`);
        return success({ team: teamName, id: skillId, name: local.name, runDir: '', ccVersion: newest.receipt.provenance.cc_version, executionStatus: newest.receipt.execution_status, alreadyEvaluated: true });
      }
    }
    // §1: the rival passes the same hygiene gate as the candidate; a refusal names which of the
    // two folders failed, since "Hygiene failed for X" alone is ambiguous with two skills in play.
    if (rival !== undefined) {
      const rivalFiles = await sourceFiles(rival.dir);
      rival.digest = skillContentDigest(rivalFiles.files);
      try {
        reportHygieneWarnings((line) => io.print(line), assessHygiene(rival.name, rivalFiles, team?.policy.skill_license ?? null, false, true, undefined, 0, { claudeCodeFields: true }));
      } catch (error) {
        if (!(error instanceof HygieneRefused)) throw error;
        reportHygieneWarnings((line) => io.print(line), error.assessment);
        return failure(`Hygiene failed for the rival skill ${rival.name}:\n${error.message}`);
      }
    }
    const dependencies = await dependencyPlan(candidateDir);
    const heavyScan = await scanHeavySkill(candidateDir, dependencies.staged[0]);
    let heavy = args.heavy;
    try {
      // §6.3: the folder as it is on disk — eval never injects — so HYG1 treats `license` and the
      // three managed `metadata.*` fields as optional, and accepts Claude Code's own skill fields at the
      // top level (`claudeCodeFields`). Every other HYG1 clause and every HYG2–HYG6 predicate stay
      // unchanged and fail-closed. With no team there is no policy license to conform to, so HYG5
      // compares the frontmatter against the bundled LICENSE files alone.
      reportHygieneWarnings((line) => io.print(line), assessHygiene(local.name, candidateFiles, team?.policy.skill_license ?? null, false, true, undefined, dependencies.staged.length + dependencies.skipped.length, { claudeCodeFields: true }));
      for (const path of dependencies.staged) io.print(`Staging dependency ${path}`);
      for (const path of dependencies.missing) io.print(`SKILL.md references ${path}, which is not present here; the skill may not run`);
      for (const skipped of dependencies.skipped) io.print(`${skipped.path} is ${(skipped.bytes / (1024 * 1024)).toFixed(1)} MB; staging it would exceed the 20 MB cap; not staged`);
      if (heavy === undefined && heavyScan.heavy) {
        io.print(heavyScan.evidence);
        io.print(heavyNotice(authoredCaseFiles.length === 0 ? 'each' : String(authoredCaseFiles.length)));
        heavy = await io.confirm('Use the one-session heavy evaluation mode?', { default: true });
      }
      heavy ??= heavyScan.heavy;
    } catch (error) {
      if (!(error instanceof HygieneRefused)) throw error;
      reportHygieneWarnings((line) => io.print(line), error.assessment);
      return failure(`Hygiene failed for ${local.name}:\n${error.message}`);
    }

    const model = args.model ?? DEFAULT_MODEL;
    const preflight = await (args.preflight ?? systemPreflight)(model);
    if (!preflight.ok) return failure(preflight.error);

    const runAt = (args.now ?? (() => new Date()))();
    const runId = runIdFrom(runAt);

    const authoredSelected = args.case === undefined ? authoredCaseFiles : authoredCaseFiles.filter((file) => file.replace(/\.ya?ml$/i, '') === args.case);
    // A named case is an authored assertion; it intentionally never causes a model call.
    if (wantsCases && args.case !== undefined && authoredSelected.length === 0) return failure(`No eval case named ${args.case} for ${local.name}.`);
    const planned = plannedGeneration(args, assets);
    // §3.2: head-to-head cases always come from the brief — authored cases belong to one skill,
    // --case is refused, and --no-gen is refused above.
    const generateCases = rival === undefined ? planned.generateCases : true;
    const generateTriggers = rival === undefined && planned.generateTriggers;

    // §3: the brief is the whole neutrality guarantee — the only thing the case generator sees,
    // and a human signs its text.
    let brief: { text: string; source: 'derived' | 'supplied'; order: string[]; path: string } | undefined;
    if (rival !== undefined) {
      const names = [local.name, rival.name];
      if (suppliedBrief !== undefined) {
        brief = { text: suppliedBrief.text, source: 'supplied', order: [...names].sort(), path: suppliedBrief.path };
      } else {
        const derived = await deriveBrief({
          agent: args.agent ?? systemAgent, model,
          skills: [
            { name: local.name, skill: candidateFiles.files.get('SKILL.md')?.toString('utf8') ?? '', files: [...candidateFiles.files.keys()].sort() },
            { name: rival.name, skill: (await sourceFiles(rival.dir)).files.get('SKILL.md')?.toString('utf8') ?? '', files: [] },
          ],
        });
        if (!derived.ok) return failure(derived.error);
        // --commit is refused in this mode, so generation never rewrites the skill and
        // `regenerated` stays false: this is the same path the run tree gets below.
        const briefDir = join(store.root, 'evals', 'local', candidateDigest.replace(/^sha256:/, ''), runId);
        const briefPath = join(briefDir, 'brief.md');
        await mkdir(briefDir, { recursive: true, mode: 0o700 });
        await writeFile(briefPath, `${assetHeader(model, packageVersion() ?? 'unknown', runAt)}${derived.value.brief}\n`, 'utf8');
        io.print('');
        io.print(derived.value.brief);
        io.print('');
        io.print(`brief: ${briefPath}`);
        if (derived.value.warning !== undefined) io.print(`Note: the brief contains the word '${derived.value.warning}', which is also a skill name here. It reads as an ordinary word — check that it does.`);
        // §3.1: the GUI's half of the gate. Nothing has been evaluated and nothing will be —
        // the human reviews the text in the app and re-invokes with --brief.
        if (args.deriveBrief) {
          return success({
            team: teamName, id: skillId, name: local.name, runDir: briefDir,
            ccVersion: preflight.value.ccVersion, executionStatus: 'complete',
            derivedBriefOnly: true, briefPath, brief: derived.value.brief,
          });
        }
        if (!await io.confirm('Use this brief?')) {
          return failure(`Stopped without running. Edit ${briefPath} so it describes the job fairly to both skills, then re-run with --brief ${briefPath}.`);
        }
        brief = { text: derived.value.brief, source: 'derived', order: derived.value.order, path: briefPath };
      }
    }
    let generated: GeneratedAssets = {};
    if (generateCases || generateTriggers) {
      const catalog = await endorsedCatalog(local.libraryRoot, { name: local.name, description });
      const frontmatter = hygieneFrontmatter(candidateFiles.files.get('SKILL.md') ?? Buffer.alloc(0)) as { metadata?: { eval?: { shape?: unknown } } } | undefined;
      const built = await generate({
        agent: args.agent ?? systemAgent,
        skill: candidateFiles.files.get('SKILL.md')?.toString('utf8') ?? '',
        files: [...candidateFiles.files.keys()].sort(),
        catalog,
        model,
        engineVersion: packageVersion() ?? 'unknown',
        now: runAt,
        cases: generateCases,
        triggers: generateTriggers,
        shape: frontmatter?.metadata?.eval?.shape,
        ...(brief === undefined ? {} : { brief: brief.text }),
      });
      if (!built.ok) return failure(built.error);
      generated = built.value;
      // The folder gate at the top of this command ran BEFORE these bytes existed, so without this
      // the write-back below plants a HYG2/HYG3 failure that only surfaces on a later `validate`,
      // `publish`, or `eval` — a run that exited clean having made the folder dirty. Judge the
      // generated bytes by the same predicates and the same author exemption the next command will
      // use, and refuse to write rather than leave the user to find it.
      const generatedFindings = inspectContent(generatedFileMap(generated), exemptAuthorEmail(candidateFiles.files.get('SKILL.md')));
      if (generatedFindings.length) {
        return failure(`The generated eval assets for ${local.name} failed hygiene, so nothing was written:\n${formatHygieneFindings(generatedFindings)}\nThis is a defect in generation, not in your skill. Run eval again to regenerate.`);
      }
      // §6.3/D9: the write-back into the LOCAL skill folder — the only route by which a generated
      // eval asset ever reaches anywhere. It only ever runs for an asset that was MISSING, so it
      // cannot overwrite authored work. With `--gen` deleted the user never asked for it, so this
      // line naming the path and the consequence is the only signal they get. It is a PRINT, not a
      // prompt: nothing leaves the machine here, publish still asks before anything does, and
      // publish already writes into this same folder (§5.1 step 6b).
      const written = generatedAssetLabels(generated);
      const regenerationTarget = generated.suite === undefined ? 'evals/cases/' : 'evals/suite.yaml';
      io.print(`Writing generated ${written.join(' and ')} into ${candidateDir} — they were missing, so this run made them. That changes the skill's content: the next publish mints a new version and the current local eval score blanks. To regenerate, delete ${regenerationTarget} and run eval again.`);
      const saved = await saveGeneratedAssets(candidateDir, generated);
      if (!saved.ok) return failure(saved.error);
    }

    // §6.1/D9: the run has to be keyed on the bytes that were actually EVALUATED, and the write-back
    // above is part of them — `evals/` is inside `skillContentDigest` by D9, and the candidate arm below
    // runs `candidateDir` as it now stands on disk. Digesting before the write-back gave every
    // generating run a `content_digest` naming a folder state that no longer existed anywhere, so
    // publish could never resolve it to a version: NO generating run was ever attachable, paid
    // `--drain` runs included. Re-read rather than merge `generated` in by hand, so the digest has the
    // same oracle publish uses — the folder.
    //
    // The PRE-write digest above deliberately stays the key for the two queue guards at the top: what
    // was queued is what was on disk when it was queued, and re-checking `--skipReceipted` after
    // generation would mean paying for the model call before discovering the bytes were receipted.
    // The next run of an already-generated folder reads the written-back bytes and matches this one.
    const regenerated = generated.cases !== undefined || generated.suite !== undefined || generated.triggers !== undefined;
    const evaluatedDigest = regenerated ? skillContentDigest((await sourceFiles(candidateDir)).files) : candidateDigest;

    // §6.2: content-keyed, so a skill belonging to NO team can be evaluated at all.
    const runDir = join(store.root, 'evals', 'local', evaluatedDigest.replace(/^sha256:/, ''), runId);
    const transcriptDir = join(runDir, 'transcripts');
    const scratch = join(runDir, 'sandboxes');
    await mkdir(transcriptDir, { recursive: true, mode: 0o700 });
    await mkdir(scratch, { recursive: true, mode: 0o700 });
    const generatedRoot = join(runDir, 'generated');
    if (regenerated) await writeGeneratedAssets(generatedRoot, generated);

    const casesDir = generated.cases === undefined ? authoredCasesDir : join(generatedRoot, 'cases');
    const triggerPath = generated.triggers === undefined ? join(candidateDir, 'evals', 'triggers.yaml') : join(generatedRoot, 'triggers.yaml');
    let triggers: TriggerSummary | null = null;
    if (wantsTriggers) {
      const source = await optionalText(triggerPath);
      if (source !== undefined) {
        const parsed = parseTriggers(source);
        if (!parsed.ok) return failure(parsed.error);
        const catalog = await endorsedCatalog(local.libraryRoot, { name: local.name, description });
        triggers = await runTriggerEvals(args.agent ?? systemAgent, { skillName: local.name, catalog, spec: parsed.value, model });
      }
    }

    const rows: ComparisonRow[] = [];
    const arms: ArmSample[] = [];
    const environmentSkips: Record<string, string[]> = {};
    const droppedCases: Record<string, DroppedCase> = {};
    const caseNames: string[] = [];
    const rng = makeRng(0);
    let expectedRows = 0;
    let suiteRan = false;
    if (wantsCases) {
      const caseFiles = generated.cases === undefined ? authoredCaseFiles : (await optionalDirectory(casesDir)).filter((name) => /\.ya?ml$/i.test(name)).sort();
      const selected = args.case === undefined ? caseFiles : caseFiles.filter((file) => file.replace(/\.ya?ml$/i, '') === args.case);
      if (args.case !== undefined && selected.length === 0) return failure(`No eval case named ${args.case} for ${local.name}.`);
      const selectedNames = selected.map((file) => file.replace(/\.ya?ml$/i, ''));
      caseNames.push(...selectedNames);
      // `--case <stem>` addresses authored case FILES only, so it must not pay for the suite's session
      // (a suite session can run to `timeout_minutes: 120` per arm); a named-case run skips the suite
      // and says so. Addressing a single sub-case is an open fork (harden r1 on this branch).
      const suiteSource = generated.suite?.file ?? authoredSuite;
      const suite = suiteSource === undefined || args.case !== undefined ? undefined : loadSuite(suiteSource, 'suite');
      if (suiteSource !== undefined && args.case !== undefined) io.print(`Skipping evals/suite.yaml: --case ${args.case} names an authored case; the suite runs only in a full run.`);
      if (suite !== undefined && !suite.ok) return failure(suite.error);
      if (suite !== undefined) {
        const authoredNames = authoredCaseFiles.map((file) => file.replace(/\.ya?ml$/i, ''));
        const collision = suite.value.cases.find((subCase) => authoredNames.includes(subCase.name));
        if (collision !== undefined) return failure(`suite 'suite': sub-case name '${collision.name}' collides with authored case name`);
        caseNames.push(suite.value.name);
      }
      // §6.5: no clone, no team, no id, no receipted version — every one of them means NO incumbent
      // and a single-arm run, exactly as eval-engine §7.1 already names it.
      // IE6 §2.1: the incumbent arm is skipped entirely in head-to-head — not materialized, and
      // candidate-vs-incumbent is not produced. Opponents are baseline and rival.
      const incumbent = rival !== undefined || clone === null || skillId === null
        ? undefined
        : await incumbentDir(clone, local.name, await listVersions(clone, local.name), skillId, evaluatedDigest);
      const opponents = rival !== undefined || incumbent !== undefined ? 2 : 1;
      // IE6 §2: one arm table for both runners; identity travels with the tree.
      const armTable: Partial<Record<Arm, ArmSpec>> = {
        baseline: null,
        candidate: { name: local.name, dir: candidateDir },
        ...(incumbent === undefined ? {} : { incumbent: { name: local.name, dir: incumbent } }),
        ...(rival === undefined ? {} : { rival: { name: rival.name, dir: rival.dir } }),
      };
      // Includes every selected authored case before requirement probes or setup failures.
      expectedRows = (selected.length + (suite === undefined ? 0 : suite.value.cases.length)) * k * opponents;
      for (const file of selected) {
        const name = file.replace(/\.ya?ml$/i, '');
        const parsed = loadCase(await readFile(join(casesDir, file), 'utf8'), name);
        if (!parsed.ok) return failure(parsed.error);
        const output = await runCase(
          { agent: args.agent ?? systemAgent, rng, model, judgeModel: args.judgeModel ?? model, log: (line) => io.print(line) },
          parsed.value,
          { k, caseDir: casesDir, arms: armTable, scratch, transcriptDir, dependencies },
        );
        rows.push(...output.rows); arms.push(...output.arms);
        if (output.skipped) environmentSkips[name] = output.skipped;
        if (output.dropped) droppedCases[name] = output.dropped;
      }
      if (suite !== undefined) {
        const output = await runSuite(
          { agent: args.agent ?? systemAgent, rng, model, judgeModel: args.judgeModel ?? model, log: (line) => io.print(line) },
          suite.value,
          { k, caseDir: generated.suite === undefined ? join(candidateDir, 'evals') : generatedRoot, arms: armTable, scratch, transcriptDir, dependencies },
        );
        // A skipped or seed-aborted suite has no shared session, so it cannot invalidate the
        // independence of ordinary case rows. A dead agent still yields samples and did run.
        suiteRan ||= output.arms.length > 0;
        rows.push(...output.rows); arms.push(...output.arms);
        if (output.skipped) environmentSkips[suite.value.name] = output.skipped;
        if (output.dropped) droppedCases[suite.value.name] = output.dropped;
      }
    }
    const summary = aggregate(rows, arms, expectedRows, environmentSkips, droppedCases, suiteRan, rival === undefined ? 'standard' : 'head-to-head');
    await writeRunTree(runDir, {
      team: teamName, skill_id: skillId, skill_name: local.name, run_id: runId,
      cc_version: preflight.value.ccVersion, model, judge_model: args.judgeModel ?? model,
      expected_rows: expectedRows,
      heavy,
      heavy_evidence: heavyScan.evidence,
      staged_dependencies: dependencies.staged,
      missing_dependencies: dependencies.missing,
      spawns_agents: arms.some((arm) => arm.spawns_agents === true),
      arm_skill_lists: Object.fromEntries([...new Set(arms.map((arm) => arm.arm))].map((arm) => [arm, arms.find((sample) => sample.arm === arm)?.skill_list ?? null])),
      ...(generated.cases !== undefined || generated.suite !== undefined || generated.triggers !== undefined ? { generated_assets: { cases: generated.cases !== undefined, ...(generated.suite === undefined ? {} : { suite: true }), triggers: generated.triggers !== undefined } } : {}),
    }, [...rows, ...arms, ...(triggers === null ? [] : [triggers])]);
    const armSkillLists = Object.fromEntries([...new Set(arms.map((arm) => arm.arm))]
      .map((arm) => [arm, arms.find((sample) => sample.arm === arm)?.skill_list ?? null]));
    const report = renderReport(summary, triggers, rival === undefined || brief === undefined ? null : {
      candidate: local.name, rival: rival.name, cases: caseNames.length, k,
      briefPath: brief.path, briefSource: brief.source,
    });
    // IE6 §5.2: no receipt, ever — not even the local one. A receipt pins ONE skill id and one
    // content digest, and its candidate-vs-incumbent record gates publish; a head-to-head pins two
    // unrelated trees, so writing it under either id would inject "lost to an unrelated skill" into
    // that skill's gating record. `verdict` is also null here, which the frozen §5.3 schema rejects
    // by design — the refusal to widen it is what makes this branch mandatory rather than optional.
    if (rival !== undefined) {
      io.print(report);
      io.print(`No receipt was written: a receipt pins one skill, and this run compared two. The rows are in ${runDir}.`);
      return success({
        team: teamName, id: skillId, name: local.name, runDir,
        ccVersion: preflight.value.ccVersion, executionStatus: summary.execution_status,
      });
    }
    // Source checkouts record their running product commit. Published packages have no checkout;
    // in that case the explicit unknown is more honest than a team-repo commit.
    const engineCommit = await runningEngineCommit(runner);
    const receipt = buildReceipt({
      skill_id: skillId,
      skill_name: local.name,
      // §6.1: a local run has NO version — publish fills it in when it resolves the digest to a
      // version folder. Identity at run time is the content digest, computed by the same
      // `skillContentDigest` the publish comparison uses, over the folder exactly as it is on disk.
      version: null,
      content_digest: evaluatedDigest,
      run_id: runId,
      verdict: summary.verdict,
      attribution: summary.attribution,
      execution_status: summary.execution_status,
      expected_rows: summary.expected_rows,
      scored_rows: summary.scored_rows,
      comparisons: summary.comparisons,
      arm_scores: summary.arm_scores,
      environment_skips: summary.environment_skips,
      dropped_cases: summary.dropped_cases,
      per_case: summary.per_case,
      case_runs: summary.case_runs,
      triggers: triggers === null ? null : { recall: triggers.recall, precision: triggers.precision, tp: triggers.tp, fn: triggers.fn, fp: triggers.fp, tn: triggers.tn },
      efficiency: summary.efficiency,
      provenance: {
        engine_version: packageVersion() ?? 'unknown',
        engine_commit: engineCommit,
        cc_version: preflight.value.ccVersion,
        model,
        judge_model: args.judgeModel ?? model,
        k,
        cases: caseNames,
        arm_skill_lists: armSkillLists,
        timestamp: runAt.toISOString(),
        runner_handle: handle ?? NO_TEAM_RUNNER_HANDLE,
      },
    });
    if (!receipt.ok) return failure(receipt.error);
    const source = `${JSON.stringify(receipt.value, null, 2)}\n`;
    await writeFile(join(runDir, 'receipt.json'), source, 'utf8');
    if (generated.cases !== undefined || generated.suite !== undefined || generated.triggers !== undefined) announceGeneratedAssets(io, wantsCases, wantsTriggers, generated, join(runDir, 'generated'));
    io.print(report);

    // Running the eval is the sharing step (Ajay, 2026-09-13). When these exact bytes are ALREADY a
    // published version, the receipt has a version to name and nothing else has to move — so it goes
    // to the team now instead of waiting for a `publish` the runner would otherwise have to know to
    // type. This is the case the request was about: you install a teammate's skill, evaluate it, and
    // they see the result. Publish stays the only path that mints a version or moves skill bytes; a
    // folder you have edited is not a published version, so it falls through to the share hint.
    const shared = args.commit === false || clone === null || teamName === null || skillId === null || handle === null
      ? null
      : await shareReceipt({ clone, team: teamName, remote: selected![1].remote, handle, runner, name: local.name, skillId, digest: evaluatedDigest, runId, source, lockWaitMs: args.lockWaitMs }, io);
    if (shared?.ok === false) io.print(`The eval is complete and saved locally, but publishing its receipt failed: ${shared.error}`);
    if (shared?.ok === true) io.print(`Published this receipt to ${teamName} for ${versionLabel(Number(shared.version.slice(1)))} of ${local.name}.`);
    // §6.3's share hint, printed. `shareHint` has been on the result since the Library refactor and
    // nothing ever showed it, so the run that most needs a next step — a verdict on bytes only this
    // machine has seen — ended in silence. `shared === null` is exactly that state: shareReceipt
    // returns null when no published version matches these bytes. The guards drop the runs where
    // publishing is not available anyway (no team, not joined), was declined (`--no-commit`), or
    // produced nothing to share — a folder with no cases and no triggers has no results, and
    // "to share these results" over an empty report is the kind of line users learn to skim.
    const hasResults = summary.expected_rows > 0 || triggers !== null;
    // IE6 §5.2: a head-to-head never lands a receipt, so there is nothing to offer to share —
    // and its verdict is null, which is exactly what the hint has no way to render.
    if (rival === undefined && shared === null && hasResults && args.commit !== false && teamName !== null && handle !== null && summary.verdict !== null) io.print(shareHint(local.name, summary.verdict, args.form));

    return success({
      team: teamName, id: skillId, name: local.name, runDir, ccVersion: preflight.value.ccVersion,
      executionStatus: summary.execution_status,
      receiptPath: join(runDir, 'receipt.json'),
      report: { aggregate: summary, triggers },
      ...(shared?.ok === true ? { publishedTo: shared.version } : { shareHint: true }),
    });
  } catch (error) { return fromError(error); }
}

interface PlannedAssets { name: string; wantsCases: boolean; wantsTriggers: boolean; authoredCaseFiles: string[]; authoredSuite: boolean; authoredTrigger: boolean }

/** The one derivation of what this run would generate, shared by the run body and both pre-run builders. */
function plannedGeneration(args: EvalArgs, assets: PlannedAssets): { generateCases: boolean; generateTriggers: boolean } {
  // D29: use the assets that are there, generate only the ones that are missing — per asset. With
  // `--gen` deleted nothing can ever overwrite an authored file, which is what makes §6.3's
  // write-back into the user's own skill folder safe.
  const generateCases = assets.wantsCases && !args.noGen && assets.authoredCaseFiles.length === 0 && !assets.authoredSuite;
  const generateTriggers = assets.wantsTriggers && !args.noGen && !assets.authoredTrigger;
  return { generateCases, generateTriggers };
}


/** Product provenance is read-only and never falls back to the team clone's unrelated HEAD. */
async function runningEngineCommit(runner: Runner): Promise<string> {
  const root = packageRoot();
  if (root === null) return 'unknown';
  // An npm-installed package sits inside the CONSUMER's repository, and git walks upward — that
  // HEAD is not engine provenance (§5.3: "terum-skills commit of the running CLI"; review P2).
  const toplevel = await runner.run('git', ['rev-parse', '--show-toplevel'], { cwd: root });
  if (toplevel.code !== 0 || resolve(toplevel.stdout.trim()) !== resolve(root)) return 'unknown';
  const result = await runner.run('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: root });
  const commit = result.code === 0 ? result.stdout.trim() : '';
  return /^[0-9a-f]{12}$/i.test(commit) ? commit.toLowerCase() : 'unknown';
}

async function optionalText(path: string): Promise<string | undefined> {
  try { return await readFile(path, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}
async function optionalDirectory(path: string): Promise<string[]> {
  try { return await readdir(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}

function announceGeneratedAssets(io: Prompter, wantsCases: boolean, wantsTriggers: boolean, generated: GeneratedAssets, root: string): void {
  const sets = [
    wantsCases ? `cases: ${generated.suite !== undefined ? 'generated suite' : generated.cases === undefined ? 'authored' : `generated (${generated.cases.names.length})`}` : null,
    wantsTriggers ? `triggers: ${generated.triggers === undefined ? 'authored' : 'generated'}` : null,
  ].filter((line): line is string => line !== null);
  io.print(`eval assets: ${sets.join(' · ')}`);
  io.print(`Generated assets: ${root} — this run's copy, kept for the record; the skill folder now holds them too. Review before trusting them.`);
}


/**
 * One generated-asset layout under `root` — `triggers.yaml`, `suite.yaml`, `cases/<name>.yaml`. Two callers: the run
 * tree's own copy (§6.0's team/store write invariant), and the staging folder `saveGeneratedAssets`
 * renames from, so the folder the user gets is byte-for-byte the folder the run recorded.
 */
async function writeGeneratedAssets(root: string, generated: GeneratedAssets): Promise<void> {
  if (generated.triggers !== undefined) {
    await mkdir(root, { recursive: true, mode: 0o700 });
    await writeFile(join(root, 'triggers.yaml'), generated.triggers, 'utf8');
  }
  if (generated.cases !== undefined) {
    const cases = join(root, 'cases');
    await mkdir(cases, { recursive: true, mode: 0o700 });
    for (const [name, source] of Object.entries(generated.cases.files)) await writeFile(join(cases, name), source, 'utf8');
  }
  if (generated.suite !== undefined) {
    await mkdir(root, { recursive: true, mode: 0o700 });
    await writeFile(join(root, 'suite.yaml'), generated.suite.file, 'utf8');
  }
}

/** The folder-relative spellings of the assets a generation carries, in the order they are written back. */
function generatedAssetLabels(generated: GeneratedAssets): string[] {
  return [generated.cases === undefined ? null : 'evals/cases/', generated.suite === undefined ? null : 'evals/suite.yaml', generated.triggers === undefined ? null : 'evals/triggers.yaml'].filter((entry): entry is string => entry !== null);
}

/**
 * §6.3 — the one write-back into the user's own skill folder. `plannedGeneration` only ever asks for
 * an asset that is MISSING (D29 deleted `--gen`, the only thing that could force a regeneration), so
 * the two `--save refused:` guards this used to carry became unreachable and went with the flag.
 * Regenerating is deleting `evals/cases/` and re-running.
 */
/** The generated assets keyed by the path each would occupy, so findings name the real file. */
function generatedFileMap(generated: GeneratedAssets): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  if (generated.triggers !== undefined) files.set('evals/triggers.yaml', Buffer.from(generated.triggers, 'utf8'));
  if (generated.suite !== undefined) files.set('evals/suite.yaml', Buffer.from(generated.suite.file, 'utf8'));
  for (const [name, body] of Object.entries(generated.cases?.files ?? {})) files.set(`evals/cases/${name}`, Buffer.from(body, 'utf8'));
  return files;
}

export async function saveGeneratedAssets(source: string, generated: GeneratedAssets): Promise<Result> {
  const cases = join(source, 'evals', 'cases');
  const suite = join(source, 'evals', 'suite.yaml');
  const triggers = join(source, 'evals', 'triggers.yaml');
  // Restored from the pre-refactor verb, which had both refusals. The write-back's claim that it
  // "only ever runs for an asset that was MISSING" holds only for the EXACT spelling: `authoredTrigger`
  // is a case-SENSITIVE lookup in the `sourceFiles` map, while the write lands on a case-INSENSITIVE
  // volume. On macOS an authored `evals/Triggers.yaml` is invisible to that lookup, so generation
  // proceeds and the write replaces its contents — with the directory still listing the authored
  // name, which is what makes it silent. Verified on this repo's own APFS volume: after writing
  // `triggers.yaml` the listing still reads `['Triggers.yaml']` and its bytes are the model's.
  // The check asks the FILESYSTEM, so it is correct on both kinds of volume: on a case-sensitive one
  // the two names are different files and generation proceeds as it should.
  if (generated.cases !== undefined && await pathExists(cases)) return failure(`${cases} already exists, so the generated eval cases were not written — a generated asset never overwrites an authored one. Rename or delete it, then run eval again.`);
  if (generated.suite !== undefined && await pathExists(suite)) return failure(`${suite} already exists, so the generated eval suite was not written — a generated asset never overwrites an authored one. Rename or delete it, then run eval again.`);
  if (generated.triggers !== undefined && await pathExists(triggers)) return failure(`${triggers} already exists, so the generated triggers were not written — a generated asset never overwrites an authored one. Rename or delete it, then run eval again.`);
  // D72: stage, then rename — the same shape as `place()` in placer.ts. This is the user's own skill
  // folder, and the file-by-file write it replaced had no rollback: an interruption after the first
  // case file left a partial `evals/cases/` that the next run's `authoredCaseFiles` took for AUTHORED
  // (`plannedGeneration` never regenerates over it) and publish shipped as a version; a crash before
  // the first file left an empty `cases/` that the refusal above then reported as authored forever.
  // Each asset becomes visible in one `rename` only after all of it is written, so `evals/cases` is
  // absent or whole, never partial.
  //
  // The staging folder lives in the skill folder's PARENT (the Library root), never inside the skill
  // folder (confirmation-review HIGH 2 on refactor/b3-versions-keystone). It used to be a hidden
  // sibling under `evals/` — inside the tree `sourceFiles`/`skillContentDigest` walk, which skips
  // only D2's fixed ignore list (`ignoredByDigest`: `.git`/`.skillhub` at the root and two junk
  // basenames; spec-fixed, so the staging name cannot join it, and `evals/` is digested on purpose,
  // D9). The `catch` below never runs for a SIGKILL or a power loss between `mkdtemp` and the final
  // `rm`, and a `.generated.terum-*` left inside the folder was then CONTENT: the next publish
  // digested it and shipped it into the team repo as part of the version. Out in the parent it is
  // nobody's content — the Library scan (`localSkills`) drops an untracked entry with no `SKILL.md`,
  // so it is not a skill either — and the worst a crash leaves is a stray hidden folder beside the
  // skill. The parent is on the skill folder's volume by construction (the folder is a real directory
  // in it — `localSkills` rejects a symlinked skill folder — and only a mount point AT the skill
  // folder could differ, which the rename then reports as EXDEV rather than corrupts), so each
  // per-asset `rename` into `evals/` stays a rename. `evals/` is still made before the renames so
  // they have a destination.
  //
  // A failure removes the staging folder — and `evals/` itself when this call made it. The renames
  // are per asset, cases first, so a failure between them leaves cases whole and triggers absent;
  // `landed` records which, because the message has to say so (confirmed medium in the same review:
  // "Nothing was left in the skill folder" was false once cases had landed, and a user who believed
  // it would delete a good asset to start clean). The next run regenerates only the missing one.
  const evals = join(source, 'evals');
  const hadEvals = await pathExists(evals);
  const landed: string[] = [];
  let staging: string | undefined;
  try {
    await mkdir(evals, { recursive: true, mode: 0o700 });
    staging = await mkdtemp(join(dirname(source), '.generated.terum-'));
    await writeGeneratedAssets(staging, generated);
    if (generated.cases !== undefined) { await rename(join(staging, 'cases'), cases); landed.push('evals/cases/'); }
    if (generated.suite !== undefined) { await rename(join(staging, 'suite.yaml'), suite); landed.push('evals/suite.yaml'); }
    if (generated.triggers !== undefined) { await rename(join(staging, 'triggers.yaml'), triggers); landed.push('evals/triggers.yaml'); }
  } catch (error) {
    if (staging !== undefined) await rm(staging, { recursive: true, force: true }).catch(() => undefined);
    // `rmdir` refuses a non-empty directory, so this can only take away the `evals/` this call made.
    if (!hadEvals) await rmdir(evals).catch(() => undefined);
    const missing = generatedAssetLabels(generated).filter((asset) => !landed.includes(asset));
    const outcome = landed.length === 0
      ? 'Nothing was left in the skill folder; run eval again.'
      : `${landed.join(' and ')} landed whole; ${missing.join(' and ')} was not written and the folder holds no partial copy of it. Run eval again to generate what is missing.`;
    return failure(`Could not write the generated eval assets into ${evals}: ${error instanceof Error ? error.message : String(error)}. ${outcome}`);
  }
  // Emptied by the renames; a leftover hidden folder is cheaper than failing a landed write.
  await rm(staging, { recursive: true, force: true }).catch(() => undefined);
  return success(undefined);
}

/** Existence as the FILESYSTEM resolves it, which on a case-insensitive volume is the question that
 *  matters: `readFile` finds `Triggers.yaml` when asked for `triggers.yaml`, and so would the write. */
async function pathExists(path: string): Promise<boolean> {
  try { await readFile(path); return true; }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return false;
    if (code === 'EISDIR') return true;
    throw error;
  }
}

/**
 * §6.3 — the trigger catalog is a purely LOCAL set now: the direct child skill folders of the Library
 * root that holds the folder under eval. `team.json.global` and `endorsedCandidates` are both deleted,
 * and a teamless run has the same catalog rule as a team one — no team read, no clone. Eval-engine
 * §7.2's "endorsed set" is superseded by this.
 *
 * The skill under eval is always included, even when it lives outside every registered root.
 */
async function endorsedCatalog(libraryRoot: string, evaluated: { name: string; description: string }): Promise<string> {
  const rows = new Map<string, string>([[evaluated.name, evaluated.description]]);
  const names = await readdir(libraryRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of names) {
    if (!entry.isDirectory() || rows.has(entry.name)) continue;
    const source = await readFile(join(libraryRoot, entry.name, 'SKILL.md'), 'utf8').catch(() => undefined);
    if (source === undefined) continue;
    const parsed = parseSkillFrontmatter(source);
    // D16: a folder the Library marks rejected or failed is not offered as a trigger.
    if (parsed.ok) rows.set(entry.name, parsed.data.description);
  }
  return [...rows.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, description]) => `- ${name}: ${description}`).join('\n');
}

/**
 * §6.5 — the incumbent arm. The candidate has **no ordinal** at run time: it is a local folder
 * identified by its content digest (§6.1), so the incumbent is chosen by receipt recency, not by
 * ordinal, and read straight from `<clone>/skills/<name>/v<K>/`.
 *
 * A version folder is already an immutable checkout inside the clone, so there is nothing to
 * materialize — which is what made deleting `materializeVersion` safe. **The old `origin/main^`
 * fallback is deleted, not re-expressed:** with no clone, no team, no receipted version, or nothing
 * left after excluding the candidate's own bytes, there is simply NO incumbent and the run is
 * single-arm, exactly as eval-engine §7.1 already names it.
 */
async function incumbentDir(clone: string | null, name: string, versions: readonly SkillVersion[], id: string, candidateDigest: string): Promise<string | undefined> {
  if (clone === null) return undefined;
  const chosen = await latestReceiptedVersion(clone, id, versions, name, candidateDigest);
  return chosen === undefined ? undefined : join(clone, 'skills', name, chosen);
}

/**
 * The receipted version whose newest run-id is most recent, excluding any version whose bytes equal
 * the candidate's.
 *
 * **Ordinal order is deliberately NOT the tie-breaker.** A `v2` re-evaluated today is a more current
 * comparison than a `v4` evaluated last month; §14.1 pins that.
 */
async function latestReceiptedVersion(clone: string, skillId: string, versions: readonly SkillVersion[], name: string, candidateDigest: string): Promise<string | undefined> {
  const root = join(clone, 'evals', skillId);
  let present: string[];
  try { present = await readdir(root); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
  let latest: { folder: string; runId: string } | undefined;
  for (const folder of present) {
    if (parseVersionFolder(folder) === null) continue;
    if (!versions.some((version) => version.folder === folder)) continue;
    // Exclude the candidate's own bytes — the version-folder form of "excluding the candidate's hash".
    const committed = await sourceFiles(join(clone, 'skills', name, folder)).catch(() => undefined);
    if (committed && skillContentDigest(committed.files) === candidateDigest) continue;
    let files: string[];
    try { files = await readdir(join(root, folder)); } catch { continue; }
    for (const file of files) {
      const runId = /^([0-9]{8}T[0-9]{6}Z)\.json$/.exec(file)?.[1];
      if (runId !== undefined && (latest === undefined || runId > latest.runId)) latest = { folder, runId };
    }
  }
  return latest?.folder;
}

/**
 * Attach one finished receipt to the published version that has exactly these bytes.
 *
 * Deliberately narrow. It writes ONE path — `evals/<id>/<vN>/<runId>.json`, guard row g, append-only
 * — and only when a committed version already digests equal to the evaluated folder. It never mints
 * a version, never writes skill bytes, never asks a question, and when no version matches it does
 * nothing at all and the run falls back to the share hint. That keeps §6.3's "publish is the only
 * writer" true where it matters: publish remains the only thing that can change what a skill IS.
 *
 * Failure is reported, never fatal: the eval ran and its local receipt is already on disk, so a
 * lock timeout or an offline remote must not turn a completed run into a failed one.
 */
/**
 * §6.3's cue — *"To share these results, publish the skill again."* — with the command it names.
 * A FAIL does not hide the command: publish asks its own question about a failed verdict
 * (`publish.ts`) and the user may have a reason. It only stops this line from recommending a
 * publish in the same breath as the failure it just reported.
 */
function shareHint(name: string, verdict: Verdict, form: InvocationForm | undefined): string {
  const command = invocation(form, 'publish', name);
  const preamble = 'These bytes are not a published version, so nothing was shared.';
  return verdict === 'FAIL'
    ? `${preamble} This run's verdict is FAIL: evaluate a fix rather than publishing these bytes — ${command} asks before it publishes a failed verdict.`
    : `${preamble} To share these results, publish the skill again: ${command}`;
}

async function shareReceipt(
  input: { clone: string; team: string; remote: string; handle: string; runner: Runner; name: string; skillId: string; digest: string; runId: string; source: string; lockWaitMs?: number },
  io: Prompter,
): Promise<{ ok: true; version: string } | { ok: false; error: string } | null> {
  try {
    const versions = await listVersions(input.clone, input.name);
    let match: string | undefined;
    for (const version of versions) {
      const committed = await sourceFiles(join(input.clone, 'skills', input.name, version.folder)).catch(() => undefined);
      if (committed && skillContentDigest(committed.files) === input.digest) { match = version.folder; break; }
    }
    if (match === undefined) return null;
    const path = receiptPath(input.skillId, match, input.runId);
    // The receipt on disk is a LOCAL one: §6.1 leaves `version` null until something resolves it to a
    // version folder. Stamp the copy that goes to the team, exactly as publish's attach step does.
    const stamped = `${JSON.stringify({ ...JSON.parse(input.source), skill_id: input.skillId, version: match }, null, 2)}\n`;
    await openTeamRepo(input.clone, input.remote, input.runner).safeWrite(
      (tree) => { if (tree.before(path) === undefined) tree.set(path, stamped); },
      { action: 'publish', handle: input.handle, message: `${input.handle}: eval ${input.name}`, label: input.team, ...lockWait(io, input.lockWaitMs) },
    );
    return { ok: true, version: match };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export interface PendingEval { id: string; name: string; version: string }
/**
 * Why `pending` is empty matters to the caller: an empty batch because the team shares nothing, because the
 * version reader failed, and because every skill is already receipted are three different sentences to a person.
 */
export interface PendingEvalScan {
  pending: PendingEval[];
  /** Shared skills the team has at all. Zero means there is nothing to evaluate, not that everything is receipted. */
  shared: number;
  /** Of those, the ones whose current version resolved, so their receipts could actually be looked for. */
  considered: number;
  /** Set when the version reader itself failed, so not one skill could be checked. */
  versionProblem?: string;
}

/**
 * Read-only, offline selector for setup's batch: current shared skill versions with no receipt.
 * An unresolved version or invalid newest receipt is reported and excluded, never automatically rerun.
 */
export async function skillsWithoutReceipt(clone: string, team: string, report: (line: string) => void): Promise<PendingEvalScan> {
  const records = await skillRecords(clone, team, { onProblem: ({ name, message }) => report(`${name}: ${message}`) });
  // §6.5: the new `skillVersions` shape — a name with no version folder never reaches `skillRecords`,
  // so the old "could not resolve the current version" arm has nothing left to report.
  const versions = await skillVersions(clone, records.map((record) => record.name));
  const pending: PendingEval[] = [];
  let considered = 0;
  for (const record of records) {
    const highest = versions.get(record.name)?.[0];
    if (highest === undefined) continue;
    considered += 1;
    try {
      if (await newestReceiptAt(join(clone, 'evals', record.id, highest.folder)) === undefined) pending.push({ id: record.id, name: record.name, version: highest.folder });
    } catch (error) {
      report(`${record.name}: the newest receipt for the current version is invalid (${error instanceof Error ? error.message : String(error)}); evaluate it on its own when you have time.`);
    }
  }
  return { pending, shared: records.length, considered };
}


/**
 * §6.6 — the producer side of the queue. A queued eval names the BYTES it was queued against, so
 * queueing resolves each skill to a folder on this machine and digests it now.
 *
 * A team skill with no copy here cannot be evaluated at all after §6.3, so it is reported and left
 * OUT rather than queued as a paid run that would fail at 01:00 with nobody watching.
 */
export async function queueItemsFor(
  input: { home: string; config: Pick<Config, 'placements' | 'projects'>; stateRoot: string; team?: string; names: readonly string[]; requestedAt: string; window: 'overnight' | 'later' },
  report: (line: string) => void,
): Promise<EvalQueueItem[]> {
  const items: EvalQueueItem[] = [];
  for (const name of input.names) {
    const found = await resolveLibrarySkill(input.home, input.config, input.stateRoot, name);
    if (found === undefined) { report(`${name}: no copy of this skill on this machine, so it cannot be evaluated; install it first.`); continue; }
    // D72: same rule as the run itself — a folder the scan rejected is named with the scan's detail,
    // never reported as missing, and costs that folder alone. Claude Code's own fields pass, as in `run`.
    const local = await admitForEval(found);
    const unusable = unusableSkillFolder(local);
    if (unusable !== undefined) { report(`${name}: ${unusable}; it was not queued.`); continue; }
    // Symmetrical with the miss above: one folder that cannot be read costs that folder, not the
    // whole batch. Unguarded, a single unreadable directory threw out of the loop and every other
    // skill the user asked to queue was silently lost with it.
    let files;
    try { files = await sourceFiles(local.path); }
    catch (error) { report(`${name}: could not read ${local.path} (${error instanceof Error ? error.message : String(error)}), so it was not queued; the rest were.`); continue; }
    items.push({
      skill: local.name, path: local.path, contentHash: skillContentDigest(files.files),
      requestedAt: input.requestedAt, window: input.window,
      ...(input.team === undefined ? {} : { team: input.team }),
    });
  }
  return items;
}

export interface EvalQueueArgs extends Omit<EvalArgs, 'ref'> {
  ref?: string;
  parallel?: number;
  /** Batch-run flags; queue modes refuse them so a typo never silently drains. */
  batch?: number; pending?: boolean;
  queueList?: boolean;
  drain?: boolean;
  dequeue?: string;
  window?: string;
  max?: number;
  /** Test seam; production always reuses the ordinary eval engine. */
  evaluate?: typeof run;
}
export interface EvalQueueResult {
  items: EvalQueueItem[];
  attempted?: number;
  completed?: number;
  failures?: { item: EvalQueueItem; error: string }[];
  /** D11: one entry per attempted item in queue order, so a board can name the successes that have left `items`. */
  outcomes?: { skill: string; team?: string; ok: boolean; error?: string }[];
}
export async function runQueue(args: EvalQueueArgs, io: Prompter): Promise<Result<EvalQueueResult>> {
  try {
    const modes = Number(Boolean(args.queueList)) + Number(Boolean(args.drain)) + Number(args.dequeue !== undefined);
    if (modes > 1) return failure('Choose only one of --queue-list, --drain, or --dequeue.');
    if (!args.drain && (args.window !== undefined || args.max !== undefined || args.parallel !== undefined)) return failure('--window, --max and --parallel require --drain.');
    if (args.window !== undefined && args.window !== 'overnight') return failure('--window must be overnight.');
    if (args.max !== undefined && (!Number.isSafeInteger(args.max) || args.max < 1)) return failure('--max must be a positive integer.');
    if (args.parallel !== undefined && (!Number.isSafeInteger(args.parallel) || args.parallel < 1)) return failure('--parallel must be a positive integer.');
    if (modes === 0) return failure('Provide a skill (or several), --pending, --queue-list, --drain, or --dequeue.');
    if (args.ref !== undefined) return failure('Queue modes do not accept a skill argument.');
    if (args.batch !== undefined || args.pending) return failure('Queue modes do not accept --batch or --pending.');
    if (args.noGen || args.case !== undefined || args.triggersOnly || args.executionOnly || args.expectedVersion !== undefined || args.team !== undefined) return failure('Queue modes use the queued team and the full committed skill; per-skill selection flags are unavailable.');
    const store = args.config ?? createConfigStore();
    if (args.queueList || args.dequeue !== undefined) {
      const queue = args.dequeue === undefined ? await readEvalQueue(store.root, line => io.print(line)) : await dequeueEvals(store.root, args.dequeue, line => io.print(line));
      if (queue.items.length === 0) io.print('No queued evals.');
      // §6.6: a queued item is keyed on the BYTES it was queued against, and its team is optional.
      for (const item of queue.items) io.print(`${item.team === undefined ? '' : `${item.team}/`}${item.skill}@${item.contentHash} · ${item.window} · ${item.requestedAt}${item.lastError === undefined ? '' : ` · ${item.lastError}`}`);
      return success({ items: queue.items });
    }
    return await withEvalQueueLock(store.root, 'drain', async assertHeld => {
      const pending = (await readEvalQueue(store.root, line => io.print(line))).items.filter(item => args.window === undefined || item.window === args.window).slice(0, args.max);
      if (!pending.length) { io.print('No queued evals.'); return success({ items: (await readEvalQueue(store.root)).items, attempted: 0, completed: 0, failures: [], outcomes: [] }); }
      let attempted = 0, completed = 0;
      const failures: { item: EvalQueueItem; error: string }[] = [];
      let probe: ReturnType<typeof systemPreflight> | undefined;
      const preflight: EvalArgs['preflight'] = model => probe ??= (args.preflight ?? systemPreflight)(model);
      const byId = new Map(pending.map(item => [queueKey(item), item]));
      io.print(`Evaluating ${pending.length} skills, ${args.parallel ?? EVAL_PARALLEL_DEFAULT} at a time…`);
      const batch = await runEvalBatch({
        // `version` is only a label here; §6.6 re-keyed the queue on content, so the content hash is
        // what identifies the queued bytes.
        items: pending.map(item => ({ id: queueKey(item), name: item.skill, version: item.contentHash })),
        parallel: args.parallel ?? EVAL_PARALLEL_DEFAULT, io,
        run: async (candidate, captured) => {
          const item = byId.get(candidate.id)!;
          assertHeld();
          if (!(await readEvalQueue(store.root)).items.some(current => queueKey(current) === queueKey(item) && current.requestedAt === item.requestedAt)) return failure('Item was dequeued before it started.');
          attempted += 1;
          let outcome: Result<EvalResult>;
          try { outcome = await (args.evaluate ?? run)({ ...args, config: store, ref: item.skill, ...(item.team === undefined ? {} : { team: item.team }), expectedVersion: item.contentHash, skipReceipted: true, preflight, lockWaitMs: EVAL_LOCK_WAIT_MS }, captured); }
          catch (error) { outcome = fromError(error); }
          const error = !outcome.ok ? outcome.error : undefined;
          if (outcome.ok && outcome.value.executionStatus !== 'complete') captured.print(`Eval completed with ${outcome.value.executionStatus} results.`);
          assertHeld();
          await updateEvalQueue(store.root, items => items.flatMap(current => queueKey(current) !== queueKey(item) || current.requestedAt !== item.requestedAt ? [current] : error === undefined ? [] : [{ ...current, lastError: error }]));
          if (error === undefined) completed += 1;
          else { failures.push({ item, error }); return failure(error); }
          return outcome;
        },
      });
      io.print(`Evaluated ${batch.ok} of ${pending.length}; ${batch.failed} failed.`);
      for (const [index, outcome] of batch.outcomes.entries()) {
        const item = pending[index]!;
        if (!outcome.ok && !failures.some(failed => queueKey(failed.item) === queueKey(item))) {
          assertHeld();
          failures.push({ item, error: outcome.error });
          await updateEvalQueue(store.root, items => items.map(current => queueKey(current) === queueKey(item) && current.requestedAt === item.requestedAt ? { ...current, lastError: outcome.error } : current));
        }
      }
      const outcomes = pending.map((item, index) => {
        const outcome = batch.outcomes[index]!;
        return { skill: item.skill, ...(item.team === undefined ? {} : { team: item.team }), ok: outcome.ok, ...(outcome.ok ? {} : { error: outcome.error }) };
      });
      const value = { items: (await readEvalQueue(store.root)).items, attempted, completed, failures, outcomes };
      return failures.length ? failureWith(value, `${failures.length} queued evals failed; they remain queued.`) : success(value);
    });
  } catch (error) { return fromError(error); }
}

/**
 * `eval a b c` past setup: the wizard's Now / In batches / Overnight choices as flags, over any set of Library
 * skills (or `--pending`, the wizard's own candidate set). One agent probe for the whole run; `--batch` asks
 * before each further batch and queues the rest for later when declined, exactly as the wizard does.
 */
export interface EvalManyArgs extends Omit<EvalArgs, 'ref'> {
  /** Skills by name or path. */
  refs: readonly string[];
  /** Add every shared skill with no receipt for its current version (needs a team). */
  pending?: boolean;
  /** Queue for that window instead of running: `overnight` (the app drains it) or `later` (a manual drain). */
  window?: string;
  /** Run this many at a time and ask before each further batch. */
  batch?: number;
  /** Concurrency within a batch (default EVAL_PARALLEL_DEFAULT, never more than the batch). */
  parallel?: number;
  /** Test seam; production always reuses the ordinary eval engine. */
  evaluate?: typeof run;
}
export interface EvalManyResult {
  mode: 'ran' | 'queued';
  team: string | null;
  /** The resolved skills, each once, in the order they were asked for. */
  skills: string[];
  ok: number;
  failed: number;
  /** Items placed on the queue: every skill under --window, or the remainder after a declined batch. */
  queued: EvalQueueItem[];
  /** Set when a declined "Continue?" stopped the run: how many skills had been attempted by then. */
  stoppedAfter?: number;
}
export async function runMany(args: EvalManyArgs, io: Prompter): Promise<Result<EvalManyResult>> {
  try {
    if (args.window !== undefined && (args.batch !== undefined || args.parallel !== undefined)) return failure('--batch and --parallel run evals now; --window queues them instead.');
    if (args.window !== undefined && args.window !== 'overnight' && args.window !== 'later') return failure('--window must be overnight or later.');
    if (args.batch !== undefined && (!Number.isSafeInteger(args.batch) || args.batch < 1)) return failure('--batch must be a positive integer.');
    if (args.parallel !== undefined && (!Number.isSafeInteger(args.parallel) || args.parallel < 1)) return failure('--parallel must be a positive integer.');
    if (args.refs.length === 0 && !args.pending) return failure('Provide at least one skill, or --pending.');
    const store = args.config ?? createConfigStore(), runner = args.runner ?? systemRunner, home = args.home ?? homedir();
    const config = await store.read();
    // Same team rule as a single eval (§6.3 / D42): best-effort, and a teamless machine evaluates single-arm.
    const selected = args.team !== undefined || Object.keys(config.teams).length > 0 ? selectTeam(config.teams, args.team, args.form) : null;
    const teamName = selected === null ? null : selected[0];
    if (args.pending && teamName === null) return failure('--pending needs a team; this machine has none.');
    // Every explicit skill is resolved before any paid work: a name no root holds fails the request here, never a batch halfway through.
    const skills: { ref: string; name: string; path: string }[] = [];
    const add = (ref: string, local: { name: string; path: string }) => { if (!skills.some(skill => skill.path === local.path)) skills.push({ ref, name: local.name, path: local.path }); };
    for (const ref of args.refs) {
      const found = await resolveLibrarySkill(home, config, store.root, ref);
      if (!found) return failure(missingSkillFolder(ref));
      const local = await admitForEval(found);
      const unusable = unusableSkillFolder(local);
      if (unusable !== undefined) return failure(unusable);
      add(ref, local);
    }
    if (args.pending && teamName !== null) {
      const clone = store.teamClone(teamName);
      await refreshClone(runner, clone, { label: teamName, ...lockWait(io, args.lockWaitMs) });
      const scan = await skillsWithoutReceipt(clone, teamName, line => io.print(line));
      // The wizard's rule: a candidate with no copy on this machine is reported and left out, never run to fail.
      for (const candidate of scan.pending) {
        const found = await resolveLibrarySkill(home, config, store.root, candidate.name);
        if (!found) { io.print(`${candidate.name}: no copy of this skill on this machine, so it cannot be evaluated; install it first.`); continue; }
        const local = await admitForEval(found);
        const unusable = unusableSkillFolder(local);
        if (unusable !== undefined) { io.print(`${candidate.name}: ${unusable}`); continue; }
        add(candidate.name, local);
      }
      if (scan.pending.length === 0) io.print(scan.shared === 0 ? 'The team has no shared skills yet; nothing to evaluate.'
        : scan.versionProblem !== undefined ? 'Could not read the current skill versions, so no shared skill could be checked for a receipt.'
        : scan.considered === 0 ? 'No shared skill could be checked for a receipt; see the lines above.'
        : 'Every shared skill already has an eval receipt for its current version.');
    }
    const names = skills.map(skill => skill.name);
    const queue = async (refs: readonly string[], window: 'overnight' | 'later'): Promise<EvalQueueItem[]> => {
      const items = await queueItemsFor({ home, config, stateRoot: store.root, ...(teamName === null ? {} : { team: teamName }), names: refs, requestedAt: new Date().toISOString(), window }, line => io.print(line));
      if (items.length === 0) { io.print('None of those skills has a copy on this machine, so none could be queued.'); return items; }
      await enqueueEvals(store.root, items, line => io.print(line));
      const count = `${items.length} eval${items.length === 1 ? '' : 's'}`, drain = `\`${invocation(args.form, 'eval --drain')}\``;
      if (window === 'overnight') io.print(`Queued ${count} for overnight: the app runs them in parallel between 01:00 and 05:00 while it is open and idle. Run them now with ${drain}.`);
      else io.print(`Queued ${count} for later. Run ${items.length === 1 ? 'it' : 'them'} with ${drain}.`);
      return items;
    };
    if (args.window === 'overnight' || args.window === 'later') {
      const queued = await queue(skills.map(skill => skill.ref), args.window);
      return success({ mode: 'queued', team: teamName, skills: names, ok: 0, failed: 0, queued });
    }
    if (skills.length === 0) return success({ mode: 'ran', team: teamName, skills: [], ok: 0, failed: 0, queued: [] });
    // One paid probe for the whole run, reused by every eval (the wizard's rule).
    const probe = await (args.preflight ?? systemPreflight)(args.model);
    if (!probe.ok) return failure(probe.error);
    const reuse: EvalArgs['preflight'] = async () => probe;
    const width = args.batch ?? skills.length, parallel = Math.min(args.parallel ?? EVAL_PARALLEL_DEFAULT, width);
    const byPath = new Map(skills.map(skill => [skill.path, skill]));
    let ok = 0, failed = 0, queued: EvalQueueItem[] = [], stoppedAfter: number | undefined;
    io.print(`Evaluating ${skills.length} skill${skills.length === 1 ? '' : 's'}, ${parallel} at a time…`);
    for (let offset = 0; offset < skills.length; offset += width) {
      if (offset > 0 && io.interactive) {
        const remaining = skills.length - offset;
        if (!(await io.confirm(`Continue with the next ${Math.min(width, remaining)}? (${offset} of ${skills.length} done, ${remaining} left)`))) {
          queued = await queue(skills.slice(offset).map(skill => skill.ref), 'later');
          stoppedAfter = offset;
          break;
        }
      }
      const batch = await runEvalBatch({
        // `id` carries the folder path (unique after the dedupe above); `version` is only a label here.
        items: skills.slice(offset, offset + width).map(skill => ({ id: skill.path, name: skill.name, version: '' })),
        parallel,
        io: {
          interactive: io.interactive, ...(io.channel === undefined ? {} : { channel: io.channel }),
          print: line => io.print(line), confirm: io.confirm.bind(io), text: io.text.bind(io), select: io.select.bind(io),
          progress: update => io.progress?.({ ...update, current: offset + (update.current ?? 0), total: skills.length }),
        },
        run: (candidate, captured) => (args.evaluate ?? run)({
          form: args.form, ref: byPath.get(candidate.id)!.ref, home, config: store, runner, preflight: reuse, lockWaitMs: EVAL_LOCK_WAIT_MS,
          ...(teamName === null ? {} : { team: teamName }),
          ...(args.k === undefined ? {} : { k: args.k }), ...(args.model === undefined ? {} : { model: args.model }), ...(args.judgeModel === undefined ? {} : { judgeModel: args.judgeModel }),
          ...(args.noGen ? { noGen: true } : {}), ...(args.triggersOnly ? { triggersOnly: true } : {}), ...(args.executionOnly ? { executionOnly: true } : {}), ...(args.case === undefined ? {} : { case: args.case }),
          ...(args.heavy === undefined ? {} : { heavy: args.heavy }),
          ...(args.agent === undefined ? {} : { agent: args.agent }), ...(args.now === undefined ? {} : { now: args.now }),
        }, captured),
      });
      ok += batch.ok; failed += batch.failed;
    }
    io.print(`Evaluated ${ok} of ${skills.length}; ${failed} failed.`);
    const value: EvalManyResult = { mode: 'ran', team: teamName, skills: names, ok, failed, queued, ...(stoppedAfter === undefined ? {} : { stoppedAfter }) };
    return failed ? failureWith(value, `${failed} of ${skills.length} eval${skills.length === 1 ? '' : 's'} failed.`) : success(value);
  } catch (error) { return fromError(error); }
}
