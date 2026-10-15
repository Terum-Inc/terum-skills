import { invocation } from '../lib/invocation.js';
import type { WithForm } from '../lib/invocation.js';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalLedger, localSkillRoots, localSkills, refIsPath, resolveLibrarySkill, unusableSkillFolder } from '../lib/local-skills.js';
import type { Config } from '../lib/schema.js';
import { ConfigStore, createConfigStore } from '../lib/config.js';
import { Prompter } from '../lib/prompt.js';
import { fromError, CancelledError, Result, success } from '../lib/result.js';
import { parseJson, parseSkillFrontmatter, teamSchema } from '../lib/schema.js';
import { Runner, systemRunner } from '../lib/runner.js';
import { declaredCategory, declaredSkillId, injectManagedFields, isEvalAsset, readTeam, skillContentDigest, skillRecords } from '../lib/skills.js';
import { MutableTree, openTeamRepo, refreshClone, SafeWriteOptions, treeText, lockWait } from '../lib/teamRepo.js';
import { teamForReference } from './install.js';
import { assertNotInsideStateRoot, assertSkillDirectory, sourceFiles } from '../lib/skill-source.js';
import { assessHygiene, HygieneRefused, reportHygieneWarnings } from '../lib/evals/hygiene.js';
import { dependencyPlan } from '../lib/evals/dependencies.js';
import { versionFolderName, versionLabel, versionsInTree } from '../lib/versions.js';
import { localReceiptsFor } from '../lib/evals/receipt-store.js';
import { addProfileEntry, recordProfileEntry, writePersonFile } from '../lib/profile-entry.js';
import { askCategory, resolveCategory, suggestCategory, teamCategory, type CategorySuggestion } from '../lib/categorize.js';
import type { AgentApi } from '../lib/evals/agent.js';

export interface PublishArgs extends WithForm {
  ref: string;
  /**
   * Optionally ALSO list the skill under this team project. Publishing itself targets the
   * marketplace — the version folder in the team repo — so omitting this is the ordinary case and
   * never asks a question.
   */
  project?: string;
  team?: string;
  category?: string;
  /** Model seam for category suggestions; production defaults to systemAgent. */
  agent?: AgentApi;
  /** Pre-answers §5.1 step 6a's regression question, for the desktop and for scripts. */
  allowRegression?: boolean;
  /** The home the local skills root is derived from (tests); defaults to homedir(). */
  home?: string;
  cwd?: string;
  config?: ConfigStore;
  runner?: Runner;
  safeWrite?: Pick<SafeWriteOptions, 'deadlineMs' | 'backoff' | 'now' | 'sleep'>;
}

export interface PublishResult {
  team: string; id: string; name: string;
  /** The project this publish also listed the skill under, or `null` — the marketplace alone. */
  project: string | null;
  /** `'v4'`, or null when the bytes were identical to an existing version. */
  version: string | null;
  created: boolean;
  /** `'v2'` when this publish was refused as identical. */
  identicalTo: string | null;
  attachedEvals: number;
  /** Eval asset files this publish wrote to `skills/<name>/evals/` (add or modify). */
  evalAssets: number;
  profileAdded: boolean;
  /** This publish appended the uuid to `projects[project].skills`; always false without `--project`. */
  projectAdded: boolean;
  /**
   * Why this skill alone was not published, when a batch refused it and published the rest. A shell
   * driving one process for a whole selection has no other way to say which row failed and why —
   * the reason is otherwise only a printed line, with nothing tying it to a row. Absent for a
   * single publish, where a refusal is the run's own failure.
   */
  refused?: string;
}

/**
 * The rungs `io.progress?.()` reports against. Publish is the longest verb in the product — two
 * network round trips, a model call and a full folder read — and it used to emit nothing at all
 * (`frames.ts`: "every other verb is silent"), so a frame-mode shell had a disabled button and no
 * way to say what was happening. A terminal ignores progress; a person there reads the printed lines.
 *
 * The category rung is skipped when the folder already declares one or `--category` was passed, so
 * `current` may step 1 → 3. That is what `current`/`total` mean: what is DONE, not how many rungs ran.
 */
const PUBLISH_STEPS = 5;

/** Everything `readLocalSource` proved about the folder being published. `skillMd` is its text, decoded once. */
interface LocalSource { found: NonNullable<Awaited<ReturnType<typeof resolveLibrarySkill>>>; files: Map<string, Buffer>; executable: Set<string>; skillMd: string }

/**
 * §5.1 steps 1–3 as one awaitable: resolve the ref to a Library folder, refuse the folders publish
 * cannot read, and load every byte of the one it can.
 *
 * Extracted from `run` for one reason: it touches only the local disk, so it can be STARTED before
 * the team clone's fetch is awaited and finish inside it. It keeps every refusal it always made —
 * `run` awaits the fetch first and this second, so a broken remote is still the first thing reported
 * and these refusals still arrive in their original order relative to each other.
 */
async function readLocalSource(args: PublishArgs, config: Config, store: ConfigStore): Promise<LocalSource> {
  // 1. Resolve the ref to a LOCAL folder. You publish what is on your machine, never what is in
  //    the clone — that is the whole direction of this refactor.
  const found = await resolveLibrarySkill(args.home ?? homedir(), config, store.root, args.ref);
  if (!found) throw new Error(await notFoundLocally(args, config, args.ref, store.root));
  // D72: the folder is there but the scan rejected it or could not read it. Refuse with the scan's
  // own detail against the path — the miss above is reserved for a name no Library root holds.
  const unusable = unusableSkillFolder(found);
  if (unusable !== undefined) throw new Error(unusable);

  // 2. Refuse a nested symlink or a non-directory before reading a byte.
  assertNotInsideStateRoot(found.path, store.root);
  await assertSkillDirectory(found.path);

  // 3. One map of every file, eval cases included (D9) — they are skill bytes like any other.
  const { files, executable } = await sourceFiles(found.path);
  const skillMd = files.get('SKILL.md');
  if (skillMd === undefined) throw new Error(`${found.path} has no SKILL.md.`);
  return { found, files, executable, skillMd: skillMd.toString('utf8') };
}

/**
 * §5: publish copies ONE local skill folder into the team repo as its next immutable version.
 *
 * It is the only bridge between the two mirrors and the only thing that can write a skill. Everything
 * before `safeWrite` reads and asks; the mutation itself is pure.
 */
/** What a prepared publish carries into the team-repo write: bytes, identity, and the decisions already taken. */
interface PreparedPublish {
  name: string;
  path: string;
  files: Map<string, Buffer>;
  executable: Set<string>;
  injected: Buffer;
  id: string;
  candidate: string;
  local: Awaited<ReturnType<typeof localReceiptsFor>>;
  project: string | null;
  assessment: ReturnType<typeof assessHygiene>;
}

export interface PublishOutcome { version: string | null; identicalTo: string | null; attached: number; projectAdded: boolean; assets: number }

/**
 * Steps 7-9a as a pure mutation over the post-image, so one skill's publish is the same code whether
 * it is the only item of a `safeWrite` or one item of a `safeWriteBatch`. It returns its outcome
 * rather than assigning one through a closure: a batch needs an outcome per item, and a retry
 * re-runs every mutation, which a shared closure variable would quietly accumulate into.
 */
function publishIntoTree(tree: MutableTree, prepared: PreparedPublish): PublishOutcome {
  const { name, files, executable, id, candidate, local, project } = prepared;
    const teamSource = tree.before('team.json');
    if (teamSource === undefined) throw new Error('This repository has no team.json; it is not a terum-skills team repo.');
    const fresh = parseJson(teamSchema, treeText(teamSource), 'team.json');
    if (project !== null && !Object.hasOwn(fresh.projects, project)) throw new Error(`Unknown project ${project}.`);

    // 7. Enumerate this name's versions from the TREE, not with listVersions: a pure mutation may
    //    only see the post-image. Walk descending and stop at the first digest equal to candidate.
    const existing = versionsInTree(tree, name);
    // 7a. This name already has a lineage: prove it is THIS skill's before appending to it.
    //     `origin/main` refused here and the refusal was lost in the layout-3 rewrite. Row a' cannot
    //     stand in for it — it proves the path is an add and says outright that ownership is not
    //     consulted. Without this, two members whose Library both hold a folder called `deploy`
    //     publish into one lineage: `skillRecords` resolves a name to its newest version, so the
    //     team's `deploy` silently becomes the second member's skill, the first member's uuid stays
    //     in team.json reachable through no name, their eval history drops out of `ls`, and every
    //     machine holding their install reads `gone-from-repo`.
    const incumbent = existing[0];
    if (incumbent !== undefined) {
      const head = tree.after(`skills/${name}/${incumbent.folder}/SKILL.md`);
      const parsed = head === undefined ? undefined : parseSkillFrontmatter(treeText(head));
      if (!parsed?.ok || parsed.data.metadata.id !== id) {
        throw new Error(`${name} is no longer in the repository as ${id.slice(0, 8)}; run sync and retry.`);
      }
    }
    let assetsWritten = 0; // the write may replay the mutation; this is a fresh count each attempt.
    let identical: string | null = null;
    for (const version of existing) {
      const prefix = `skills/${name}/${version.folder}/`;
      const committed = new Map<string, Buffer>();
      for (const path of tree.paths(prefix)) {
        const contents = tree.after(path);
        // The prefix MUST be stripped: tree.paths() returns full repo-relative paths while §3.3's
        // record stream is skill-folder-relative. Feed it unstripped and no version ever compares
        // equal, so every publish mints forever and step 8's refusal is unreachable.
        if (contents !== undefined) committed.set(path.slice(prefix.length), Buffer.isBuffer(contents) ? contents : Buffer.from(contents));
      }
      if (committed.size && skillContentDigest(committed) === candidate) { identical = version.folder; break; }
    }

    const target = identical ?? versionFolderName((existing[0]?.n ?? 0) + 1); // never count + 1
    // §4.5/D10: carry the mode across with the bytes. `sourceFiles` already detects it
    // (`skill-source.ts`'s `lstat(next).mode & 0o111`); before this the set was read for hygiene
    // and then dropped, so every published `scripts/*.sh` arrived 0644 and would not run.
    //
    // Eval assets are filtered out here (`isEvalAsset`): they are not version bytes, and a version
    // folder is immutable, so a case committed into `v3/` could never be corrected without minting
    // `v4`. They go to the mutable `skills/<name>/evals/` below instead.
    if (identical === null) for (const [key, contents] of files) {
      if (isEvalAsset(key)) continue;
      const path = `skills/${name}/${target}/${key}`;
      tree.set(path, contents);
      if (executable.has(key)) tree.setExecutable(path, true);
    }

    // 8a. The eval assets, written on EVERY publish — including one that minted nothing, which is
    //     exactly how an eval-only change reaches the team now. Add-or-modify, never remove
    //     (guard row a″), so a folder that happens to be missing a case cannot delete the team's.
    for (const [key, contents] of files) {
      if (!isEvalAsset(key)) continue;
      const path = `skills/${name}/${key}`;
      if (sameBytes(tree.before(path), contents)) continue;
      tree.set(path, contents);
      if (executable.has(key)) tree.setExecutable(path, true);
      assetsWritten += 1;
    }

    // 9. Attach every local receipt taken of these exact bytes, as a COPY stamped with the publish
    //    uuid and this version — never a plain file copy. The stamping is what makes §8.1's
    //    misfiled check meaningful. The local run itself is not rewritten: it is local state.
    let attached = 0;
    for (const entry of local) {
      const path = `evals/${id}/${target}/${entry.runId}.json`;
      if (tree.before(path) !== undefined) continue;
      tree.set(path, `${JSON.stringify({ ...entry.receipt, skill_id: id, version: target }, null, 2)}\n`);
      attached += 1;
    }

    // 9a. Project membership, whether or not a version was minted — and only when one was asked
    //     for. The version folder above IS the marketplace copy; a project list is a second,
    //     optional place the team also names the skill, so `team.json` is untouched without
    //     `--project` and a publish can now change nothing outside `skills/`.
    let projectAdded = false;
    if (project !== null) {
      const list = fresh.projects[project]!.skills;
      projectAdded = !list.includes(id);
      if (projectAdded) { list.push(id); tree.set('team.json', `${JSON.stringify(fresh, null, 2)}\n`); }
    }

  return { version: identical === null ? target : null, identicalTo: identical, attached, projectAdded, assets: assetsWritten };
}

/** Everything a publish decides before it writes: category, identity, hygiene, digest, receipts, project. */
interface PrepareContext {
  args: PublishArgs;
  store: ConfigStore;
  config: Config;
  binding: { handle?: string; remote: string };
  teamJson: Awaited<ReturnType<typeof readTeam>>;
  catalogue: Awaited<ReturnType<typeof skillRecords>>;
  categoryFlag: string | undefined;
  abort: AbortController;
  /** A category answer already in flight for this folder, or null when none was started. */
  earlyAsk: Promise<string | null> | null;
  source: LocalSource;
}

/**
 * The local half of a publish: it decides everything and writes nothing outside the caller's
 * `writeBack`. Splitting it out is what lets a batch ask its questions once, for every skill,
 * before any folder on disk is touched - OF-2 says a publish refused at any question leaves the
 * folder byte-identical, and that has to hold for the batch as a whole, not just per skill.
 */
async function preparePublish(ctx: PrepareContext, io: Prompter): Promise<{ prepared: PreparedPublish; regression: { against: string } | null; writeBack: () => Promise<void> }> {
  const { args, store, config, binding, teamJson, catalogue, categoryFlag, abort, earlyAsk, source } = ctx;
  const { found, files, executable, skillMd } = source;
  // 4. Managed fields, resolved into the IN-MEMORY SKILL.md before anything is hygiene-checked or
  //    digested. Once written back, the category is ordinary content: subsequent publishes keep it.
  const declared = declaredCategory(skillMd);
  //    The flag takes the team's own spelling when it matches a team category case-insensitively —
  //    the rule the model's answer already goes through (categorize.ts teamCategory), so
  //    `--category Ops` lands in the one `ops` bucket. An off-list value stays as typed, trimmed:
  //    §5 says the flag need not be on the list, and HYG7 must warn about what the user wrote.
  let chosen: CategorySuggestion;
  if (declared !== undefined) chosen = { category: declared, suggested: false };
  else if (categoryFlag !== undefined) chosen = { category: teamCategory(categoryFlag, teamJson.categories) ?? categoryFlag, suggested: false };
  else {
    io.progress?.({ step: 'Choosing a category', current: 2, total: PUBLISH_STEPS });
    // `undefined` means no early ask ran; `null` means one ran and the model gave nothing usable —
    // the disclosed fallback, exactly as in-band, and never a second 20 s wait on an offline model.
    const raw = earlyAsk === null ? undefined : await earlyAsk;
    // An early answer counts only while it still names a category this team HAS. The fetch may have
    // brought a list the answer has fallen off; inventing that bucket is the one thing this must not
    // do, so the model is asked again — against the list that is now current.
    chosen = raw !== undefined && (raw === null || teamCategory(raw, teamJson.categories) !== undefined)
      ? resolveCategory(raw, teamJson.categories)
      : await suggestCategory(skillMd, teamJson.categories, args.agent, abort.signal);
  }
  const category = chosen.category;
  if (declared === undefined) {
    const disclosure = categoryFlag !== undefined ? 'from --category; edit SKILL.md any time'
      : chosen.suggested ? 'suggested from your SKILL.md; edit any time'
      : "couldn't reach the model; edit SKILL.md any time";
    io.print(`metadata.terum-category: ${category} (${disclosure})`);
  }
  // The REPOSITORY is the authority on which uuid a published name carries, not the local file.
  // Reading the id only from the folder was wrong in both directions: `existingId` parsed through
  // the `.strict()` `skillFrontmatterSchema`, so a published folder whose user deleted the injected
  // `license:` line minted a FRESH uuid and orphaned every receipt, install and profile entry keyed
  // to the old one; and a folder COPIED from another skill kept that skill's declared uuid, landing
  // this publish's receipts in that skill's eval history.
  const published = catalogue.find((record) => record.name === found.name);
  const declaredId = declaredSkillId(skillMd);
  const id = published?.id
    // A declared id already belonging to a DIFFERENT name means a copied folder: mint instead of
    // grafting onto that skill's identity. §5.1 step 4's "minted at v1" is exactly this case.
    ?? (declaredId !== undefined && !catalogue.some((record) => record.id === declaredId) ? declaredId : randomUUID());
  const author = `${config.display_name ?? binding.handle} <${config.email ?? ''}>`.trim();
  const injected = Buffer.from(injectManagedFields(skillMd, { license: teamJson.policy.skill_license, id, author, category }));
  files.set('SKILL.md', injected);

  io.progress?.({ step: `Checking ${found.name}`, current: 3, total: PUBLISH_STEPS });
  // 5. Hygiene on the INJECTED map, never before — `skillFrontmatterSchema` is strict and requires
  //    the managed fields, so a never-published folder would fail HYG1 on fields publish is about
  //    to write.
  const dependencies = await dependencyPlan(found.path);
  const assessment = assessHygiene(found.name, { files, executable }, teamJson.policy.skill_license, true, false, teamJson.categories, dependencies.staged.length + dependencies.skipped.length);
  reportHygieneWarnings((line) => io.print(line), assessment);

  // 6. The comparison digest, taken AFTER injection so it is post-normalization.
  const candidate = skillContentDigest(files);

  // 6a. The local regression gate (D19). Absence of a receipt never blocks; nothing moves here.
  //     The QUESTION is the caller's: a single publish asks it here, a batch asks once for every
  //     skill that fails, and either way it is asked before the write-back below (OF-2).
  const local = await localReceiptsFor(store.root, candidate, line => io.print(line));
  // D19 asks about the LATEST eval of these exact bytes. `localReceiptsFor` sorts run ids ascending
  // and run ids are UTC stamps, so `.find(FAIL)` returned the OLDEST failure: once a run failed, no
  // amount of passing re-runs of the same bytes could ever clear the gate again.
  const newest = local.at(-1);
  const failing = newest?.receipt.verdict === 'FAIL' ? newest : undefined;
  const regression = failing && !args.allowRegression
    ? { against: failing.receipt.version ? versionLabel(Number(failing.receipt.version.slice(1))) : 'the previous version' }
    : null;

  // 6b. `--project` is a REFUSAL, so it belongs ABOVE the write-back: a mistyped project name must
  //     not rewrite the user's SKILL.md on a publish that never ran. There is no question here and
  //     no default project: publish targets the MARKETPLACE, and a project is an extra list the
  //     caller asked for by name.
  const project = requestedProject(args, teamJson);

  const prepared: PreparedPublish = { name: found.name, path: found.path, files, executable, injected, id, candidate, local, project, assessment };
  // The write-back is the caller's to run, AFTER the last refusal (OF-2). A failure of the write
  // that follows leaves the injected SKILL.md on disk with nothing published - the safe side of the
  // boundary, and idempotent, because every injected field is re-derived identically next time.
  return { prepared, regression, writeBack: async () => { await writeFile(join(found.path, 'SKILL.md'), injected); } };
}

export async function run(args: PublishArgs, io: Prompter): Promise<Result<PublishResult>> {
  // Kills the category model call on EVERY exit path, including the failing ones. Without it, a
  // `git fetch` that fails while `claude` is still answering would hold this process open on the
  // child's piped stdio until the 20 s timeout — turning an instant network error into a 20 s hang.
  const abort = new AbortController();
  try {
    // Hybrid review r1 (medium, publish.ts:98): this check trimmed the flag and then the RAW string was
    // stored, so `--category "ops "` (a trailing space from shell history) was injected as ` ops ` and,
    // because a declared category is never overwritten (skills.ts injectManagedFields), stayed for the
    // skill's whole lineage — while HYG7, comparing the same raw string, warned that ` ops ` was not on
    // a list that held `ops`. Trim once here and read the trimmed value everywhere the flag is used.
    const categoryFlag = args.category?.trim();
    if (args.category !== undefined && !categoryFlag) throw new Error('--category must be a non-empty name.');
    const store = args.config ?? createConfigStore();
    const runner = args.runner ?? systemRunner;
    const config = await store.read();
    const team = await teamForReference(config, args.team, undefined, args.ref, args.form);
    const binding = config.teams[team]!;
    if (!binding.handle) throw new Error(`Team ${team} has no joined handle.`);
    const clone = store.teamClone(team);
    io.progress?.({ step: 'Refreshing the team repository', current: 1, total: PUBLISH_STEPS });

    // The category list as of the LAST sync, read before the fetch so the model ask below can start
    // while `git fetch` is still in flight. Best effort by design: no clone yet, or an unreadable
    // team.json, simply means no early ask and the in-band call further down. It is never a refusal
    // — `refreshClone` and `readTeam` are the two allowed to fail on a broken clone, and both still
    // do, below, with their own messages.
    const lastKnown = await readTeam(clone).catch(() => null);

    // Three things that need nothing from one another now run together: the network fetch, the local
    // folder read, and — once that read has the SKILL.md — the category model call. The wall clock
    // becomes max(fetch, read + ask) instead of their sum; on a first publish that is the 1–3 s fetch
    // and the 2–6 s `claude` spawn overlapping instead of queueing.
    //
    // Refusal ORDER is deliberately unchanged. `await refresh` comes first below, so a bad remote is
    // still the first thing a user sees, and the local refusals follow in the order they always had.
    // Each `.catch` is the no-op the catalogue read already uses: it marks the promise handled so a
    // rejection landing while something else is in flight is not an unhandled rejection (which kills
    // the process without ever reaching this try/catch). The awaits below still throw it in here.
    const refresh = refreshClone(runner, clone, { label: team, ...lockWait(io) });
    refresh.catch(() => {});
    const source = readLocalSource(args, config, store);
    source.catch(() => {});
    // Started only when it can be USED: a folder that declares a category, or a `--category` flag,
    // never asks the model, and neither does a team whose last-known list was empty or unreadable —
    // those fall through to the in-band call, which is also the only path that can ask a team whose
    // categories this machine has never seen.
    const earlyAsk = categoryFlag === undefined && lastKnown !== null && lastKnown.categories.length > 0
      ? source
          .then((read) => declaredCategory(read.skillMd) === undefined ? askCategory(read.skillMd, lastKnown.categories, args.agent, abort.signal) : null)
          .catch(() => null)
      : null;

    await refresh;
    const teamJson = await readTeam(clone);
    // Hybrid review r1 (medium, publish.ts:99): start the local catalogue read NOW. It depends only on
    // `clone`/`team`, both in hand, and on nothing the category branch below produces — while that
    // branch's model call can hold a `claude` subprocess for up to 20s on a first publish. The two
    // used to run back to back; now the readdir/readFile overlaps the model round-trip.
    const catalogPromise = skillRecords(clone, team);
    catalogPromise.catch(() => {});

    // 1–3. The local folder, as read above while the fetch ran. Awaited HERE, after the fetch, so
    //      every refusal it holds is reported in the order it always was.
    const { prepared, regression, writeBack } = await preparePublish({ args, store, config, binding, teamJson, catalogue: await catalogPromise, categoryFlag, abort, earlyAsk, source: await source }, io);
    if (regression && !(await io.confirm(`Your latest eval of these exact bytes failed against ${regression.against}. Publish anyway?`))) {
      throw new CancelledError('Publish was cancelled.');
    }
    await writeBack();
    const found = { name: prepared.name, path: prepared.path };
    const { project, id, local } = prepared;

    io.progress?.({ step: `Publishing ${found.name}`, current: 4, total: PUBLISH_STEPS });
    const repo = openTeamRepo(clone, binding.remote, runner);
    let outcome: PublishOutcome = { version: null, identicalTo: null, attached: 0, projectAdded: false, assets: 0 };
    await repo.safeWrite((tree) => { outcome = publishIntoTree(tree, prepared); return outcome; }, {
      action: 'publish',
      handle: binding.handle,
      message: `${binding.handle}: publish ${found.name}`,
      ...args.safeWrite,
      ...lockWait(io),
    });


    const at = outcome.version ?? outcome.identicalTo!;
    const label = versionLabel(Number(at.slice(1)));
    // A publish that mints nothing is now a real, useful outcome rather than a no-op: it is how an
    // eval run and an edited case reach the team. "Nothing to publish" must therefore be reserved
    // for a run that genuinely moved nothing at all.
    const also = [
      outcome.attached > 0 ? `attached ${outcome.attached} eval run(s)` : null,
      outcome.assets > 0 ? `updated ${outcome.assets} eval asset file(s)` : null,
    ].filter((part): part is string => part !== null);
    // Where the skill now is, said once: the marketplace always, a project only when one was named.
    const where = project === null ? `the ${team} marketplace` : `the ${team} marketplace and ${project}`;
    if (outcome.version !== null) {
      io.print(`Published ${found.name} as ${label} to ${where}. Attached ${outcome.attached} eval run(s).`);
      if (outcome.assets > 0) io.print(`Updated ${outcome.assets} eval asset file(s) for ${found.name}.`);
    } else if (outcome.projectAdded) {
      io.print(`Added ${found.name} to ${project}. It is identical to ${label} of the skill already in the team repository.`);
      if (also.length) io.print(`Also ${also.join(' and ')}.`);
    } else if (also.length === 0) {
      io.print(`Nothing to publish: ${found.name} is identical to ${label} and already in ${where}.`);
    } else {
      io.print(`${found.name} is identical to ${label}, so no new version was minted; ${also.join(' and ')}.`);
    }
    const unmatched = local.length - outcome.attached;
    if (outcome.version !== null && unmatched > 0) io.print(`${unmatched} local eval run(s) were not attached — they evaluated this folder before its first publish.`);

    // 10. Publishing is not installing (D5). The only people-file write here is the profile entry,
    //     which D77 writes with no question: publishing is itself the endorsement, so nothing is
    //     asked and nothing is skipped when no human is on the other end. It is a SECOND,
    //     independent safeWrite that runs after the version is committed and pushed, so its failure
    //     must not be reported as a failed publish: the version is durable in the shared repo and
    //     the success lines are already on screen. Before this, a missing people file, a lock
    //     timeout or a network blip returned a failure Result carrying no PublishResult, for a
    //     publish that fully succeeded.
    let profileAdded = false;
    io.progress?.({ step: `Adding ${found.name} to your profile`, current: 5, total: PUBLISH_STEPS });
    try {
      await recordProfileEntry({ store, clone, team, handle: binding.handle, remote: binding.remote, runner, id, name: found.name, version: at, via: 'publish' }, io);
      profileAdded = true;
      io.print(`Your profile now lists ${found.name} at ${label}.`);
    } catch (error) {
      io.print(`Published ${found.name}, but could not add it to your profile: ${error instanceof Error ? error.message : String(error)}`);
    }

    return success({ team, id, name: found.name, project, version: outcome.version, created: outcome.version !== null, identicalTo: outcome.identicalTo, attachedEvals: outcome.attached, evalAssets: outcome.assets, profileAdded, projectAdded: outcome.projectAdded });
  } catch (error) {
    if (error instanceof HygieneRefused) reportHygieneWarnings((line) => io.print(line), error.assessment);
    return fromError(error);
  } finally {
    abort.abort();
  }
}


/**
 * The project this publish was asked to ALSO list the skill under, or `null` for the marketplace
 * alone. There is no prompt and no default: publishing is how a skill reaches the team, and a
 * project is an opt-in second list. A named project that the team does not have is refused here,
 * before anything is written — locally or in the clone.
 */

export interface PublishManyArgs extends Omit<PublishArgs, 'ref'> { refs: readonly string[] }

/**
 * Publish several skills in one run: one refresh, every question asked once, and ONE push.
 *
 * The desktop publishes a selection by invoking this verb once per skill - a whole process each,
 * with its own fetch and its own push, measured at ~2s of network apiece. Nothing about a version
 * folder needs that: the folders are independent, and the clone's writer lock is held once here
 * instead of contended N times.
 *
 * `run` is untouched and still the single-skill path: one skill does not need a batch, and D77's
 * separate profile write - whose failure must never be reported as a failed publish - is worth its
 * second round trip when there is only one of them.
 */
export async function runMany(args: PublishManyArgs, io: Prompter): Promise<Result<PublishResult[]>> {
  const abort = new AbortController();
  try {
    const categoryFlag = args.category?.trim();
    if (args.category !== undefined && !categoryFlag) throw new Error('--category must be a non-empty name.');
    if (!args.refs.length) throw new Error('Give at least one skill to publish.');
    const store = args.config ?? createConfigStore();
    const runner = args.runner ?? systemRunner;
    const config = await store.read();
    const team = await teamForReference(config, args.team, undefined, args.refs[0], args.form);
    const binding = config.teams[team]!;
    if (!binding.handle) throw new Error(`Team ${team} has no joined handle.`);
    const handle = binding.handle;
    const clone = store.teamClone(team);
    io.progress?.({ step: 'Refreshing the team repository', current: 1, total: 4 });
    await refreshClone(runner, clone, { label: team, ...lockWait(io) });
    const teamJson = await readTeam(clone);
    const catalogue = await skillRecords(clone, team);
    // Every folder is read and decided before any of them is written back: a selection refused at
    // one skill's question must leave every folder byte-identical, not just the ones after it (OF-2).
    const prepared: { prepared: PreparedPublish; regression: { against: string } | null; writeBack: () => Promise<void> }[] = [];
    for (const [index, ref] of args.refs.entries()) {
      io.progress?.({ step: `Checking ${ref}`, item: ref, current: index + 1, total: args.refs.length });
      const source = await readLocalSource({ ...args, ref }, config, store);
      prepared.push(await preparePublish({ args: { ...args, ref }, store, config, binding, teamJson, catalogue, categoryFlag, abort, earlyAsk: null, source }, io));
    }
    const failing = prepared.filter((entry): entry is typeof entry & { regression: { against: string } } => entry.regression !== null);
    if (failing.length) {
      const detail = failing.map(entry => `${entry.prepared.name}: latest eval of these exact bytes failed against ${entry.regression.against}`);
      if (!(await io.confirm(`Publish ${failing.length === 1 ? failing[0]!.prepared.name : `${failing.length} skills`} despite a failed eval?`, { detail }))) {
        throw new CancelledError('Publish was cancelled.');
      }
    }
    for (const entry of prepared) await entry.writeBack();
    io.progress?.({ step: `Publishing ${prepared.length} skills`, current: args.refs.length, total: args.refs.length });
    const added = new Date().toISOString().slice(0, 10);
    const outcome = await openTeamRepo(clone, binding.remote, runner).safeWriteBatch(prepared.map(entry => ({
      message: `${handle}: publish ${entry.prepared.name}`,
      // D77's profile entry rides in this skill's own commit rather than taking a second push of its
      // own. Row f already permits the actor's people file under `publish` (guard.ts PEOPLE_ACTIONS).
      mutate: (tree: MutableTree) => {
        const result = publishIntoTree(tree, entry.prepared);
        const at = result.version ?? result.identicalTo;
        if (at !== null) writePersonFile(tree, handle, person => addProfileEntry(person, { id: entry.prepared.id, name: entry.prepared.name, version: at, added, via: 'publish' }));
        return result;
      },
    })), { action: 'publish', handle, ...args.safeWrite, ...lockWait(io) });
    const byIndex = new Map(outcome.committed.map(item => [item.index, item.returned]));
    for (const skipped of outcome.skipped) {
      const name = prepared[skipped.index]!.prepared.name;
      if (skipped.noop) io.print(`Nothing to publish: ${name} is identical to what the team already has.`);
      else io.print(`Could not publish ${name}: ${skipped.reason}`);
    }
    const results: PublishResult[] = [];
    for (const [index, entry] of prepared.entries()) {
      const result = byIndex.get(index);
      const landed = result ?? { version: null, identicalTo: null, attached: 0, projectAdded: false, assets: 0 };
      if (result) {
        const at = result.version ?? result.identicalTo;
        const label = at === null ? null : versionLabel(Number(at.slice(1)));
        io.print(result.version !== null
          ? `Published ${entry.prepared.name} as ${label} to the ${team} marketplace. Attached ${result.attached} eval run(s).`
          : `${entry.prepared.name} is identical to ${label}, so no new version was minted.`);
      }
      const refused = outcome.skipped.find(entry2 => entry2.index === index && !entry2.noop);
      results.push({
        team, id: entry.prepared.id, name: entry.prepared.name, project: entry.prepared.project,
        version: landed.version, created: landed.version !== null, identicalTo: landed.identicalTo,
        attachedEvals: landed.attached, evalAssets: landed.assets,
        profileAdded: result !== undefined && (landed.version ?? landed.identicalTo) !== null,
        projectAdded: landed.projectAdded,
        ...(refused ? { refused: refused.reason } : {}),
      });
    }
    return success(results);
  } catch (error) {
    if (error instanceof HygieneRefused) reportHygieneWarnings((line) => io.print(line), error.assessment);
    return fromError(error);
  } finally {
    abort.abort();
  }
}

function requestedProject(args: PublishArgs, teamJson: Awaited<ReturnType<typeof readTeam>>): string | null {
  if (args.project === undefined) return null;
  if (!Object.hasOwn(teamJson.projects, args.project)) throw new Error(`Unknown project ${args.project}.`);
  return args.project;
}

/**
 * The miss supplies read-only local discovery guidance, never an import or tracking write. D72: it is
 * reached only when `resolveLibrarySkill` matched NO entry by name in any root — a folder that exists
 * but is unusable is refused above with the scan's detail — so the old "was found at … but could not
 * be published" branch, which re-scanned through `candidatesOf`, had nothing left to find and went.
 * The unreadable-folder note stays: a folder the scan could not open may be the one the user means.
 */
async function notFoundLocally(args: PublishArgs, config: Config, name: string, stateRoot: string): Promise<string> {
  const discovery = await localSkillRoots(args.home ?? homedir(), config.projects ?? []);
  const ledger = await canonicalLedger(config);
  const inventories = await Promise.all(discovery.roots.map((root) => localSkills(root.root, config, { scope: root.scope, stateRoot, ledger })));
  const unreadable = discovery.problems.length + inventories.reduce((count, inventory) => count + inventory.problems.length + inventory.entries.filter((entry) => entry.inspection.kind === 'failed').length, 0);
  const note = unreadable ? ` (${unreadable} local folder(s) under ${discovery.roots.map((root) => root.root).join(' or ')} could not be read.)` : '';
  // `name` is the ref as typed: a skill name, or a folder path (refIsPath) — the desktop passes the
  // Library card's path for a skill the team has never seen. Say which grammar missed.
  const missed = refIsPath(name) ? `No skill folder at ${name} in your library` : `No local skill folder named ${name} in your library`;
  return `${missed}. Inspect it with \`${invocation(args.form, 'ls --local')}\`, or add the project holding it with \`${invocation(args.form, 'project add')}\`.${note}`;
}

/**
 * Whether a tree slot already holds exactly these bytes, so an unchanged eval asset is not rewritten
 * on every publish — an unchanged file in the staged diff is noise the guard and the commit both see.
 */
function sameBytes(before: string | Buffer | undefined, contents: Buffer): boolean {
  if (before === undefined) return false;
  return (Buffer.isBuffer(before) ? before : Buffer.from(before)).equals(contents);
}
