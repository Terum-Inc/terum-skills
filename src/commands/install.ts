import { invocation, type InvocationForm } from '../lib/invocation.js';
import type { WithForm } from '../lib/invocation.js';
import { readFile, stat, mkdir, copyFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { projectPath } from '../lib/projects.js';
import { adoptableEntry, canonicalParentPath, expandRefPath, librarySize, localSkillRoots, resolveLibrarySkill } from '../lib/local-skills.js';
import { checkoutRootOf } from '../lib/placer/agent-paths.js';
import { ConfigStore, createConfigStore, selectTeam } from '../lib/config.js';
import type { HookOptions } from '../lib/hook.js';
import type { WrapperOptions } from '../lib/wrapper.js';
import type { EditHookOptions } from '../lib/editHook.js';
import { inspect, keptCopyPath, lockTarget, moveDirectory, place, appendExclude, resolveTarget } from '../lib/placer.js';
import { Prompter } from '../lib/prompt.js';
import { refuseSecondTeam, teamByRemote } from '../lib/auth.js';
import { normalizeRemote } from '../lib/remote.js';
import { fromError, CancelledError, RefusedError, Result, success } from '../lib/result.js';
import { Runner, systemRunner } from '../lib/runner.js';
import { Config, Destination, Team, describeRaw, handleSchema, insideRoot, parseOrExplain, parseSkillFrontmatter, sameScope } from '../lib/schema.js';
import { canonicalDigest, findSkill, readPerson, readTeam, skillRecords, SkillRecord } from '../lib/skills.js';
import { openTeamRepo, SafeWriteOptions, lockWait } from '../lib/teamRepo.js';
import { addProfileEntry, recordProfileEntry, writePersonFile } from '../lib/profile-entry.js';
import { receiptFiles } from '../lib/evals/receipt-store.js';
import { receiptSchema, type Receipt } from '../lib/evals/receipt.js';
import { versionLabel } from '../lib/versions.js';
import { listVersions } from '../lib/teamRepo.js';
import { versionDigests } from '../lib/version-digests.js';
import { snapshotSkillDirectory } from '../lib/placer/vendor/skillhub/skill-fingerprint.js';

export interface InstallArgs extends WithForm {
  into?: string;
  ref?: string;
  adopt?: string;
  kind?: 'skill' | 'member' | 'project';
  member?: string;
  project?: string;
  team?: string;
  config?: ConfigStore;
  runner?: Runner;
  cwd?: string;
  home?: string;
  /** Where the §8 hook offer writes when a three-part ref bootstraps a fresh machine (test knob). */
  hook?: HookOptions;
  /** Where that bootstrap offers the bundled terum-skills skills (test knob). */
  wrapper?: WrapperOptions;
  editHook?: Partial<EditHookOptions>;
  /** Injectable retry clock for deterministic recovery tests; authorization remains command-owned. */
  safeWrite?: Pick<SafeWriteOptions, 'deadlineMs' | 'backoff' | 'now' | 'sleep'>;
  /** Test-only process-interruption seam; each stage follows a durable boundary. */
  afterAdoptStage?: (stage: AdoptStage) => void | Promise<void>;
}
export interface InstalledResult { id: string; team: string; path: string; version: string; profiled: boolean; }
export interface AdoptedResult extends InstalledResult { adopted: true }
export type AdoptStage = 'consent' | 'pending' | 'people' | 'ledger' | 'cleared';

export async function run(args: InstallArgs, io: Prompter): Promise<Result<InstalledResult[] | AdoptedResult>> {
  try {
    const store = args.config ?? createConfigStore();
    const runner = args.runner ?? systemRunner;
    const config = await store.read();
    const hasSelector = args.ref !== undefined || args.member !== undefined || args.project !== undefined || args.kind === 'member' || args.kind === 'project';
    if (args.adopt !== undefined && hasSelector) throw new Error('Give a skill to install or --adopt <path>, not both.');
    if (args.adopt === undefined && !hasSelector) throw new Error('Nothing to install: give a skill, or --adopt <path> for a folder you already have.');
    if (args.adopt !== undefined && args.into !== undefined) throw new Error('--adopt records a folder where it is; it takes no destination.');
    if (args.adopt !== undefined) {
      const [team] = selectTeam(config.teams, args.team, args.form);
      return success(await installOne({ team, adopt: args.adopt, store, runner, cwd: args.cwd, home: args.home, safeWrite: args.safeWrite, afterAdoptStage: args.afterAdoptStage }, io));
    }
    const operation = parseOperation(args);
    const destinationFor = async (team: string, project?: string) => resolveDestination(store, await readTeam(store.teamClone(team)), project, io, io.interactive, { into: args.into, cwd: args.cwd, runner, home: args.home ?? placementHome(store), form: args.form });
    if (operation.kind === 'member') {
      const [team] = selectTeam(config.teams, args.team, args.form);
      const person = await readPerson(store.teamClone(team), operation.member);
      // §8.5 (amended 2026-09-13): installing a person takes what they *stand behind* — `profile[]`,
      // the curated list the marketplace person page shows — not `installed[]`, which is an automatic
      // record of what happens to sit on their machines. The desktop page renders one list and one
      // count; this verb is what that count promises, so the two must read the same field.
      // `profile` is optional in the schema (people files written before it shipped have none), and an
      // empty curated list is refused by name rather than silently installing nothing.
      const profile = person.profile ?? [];
      if (!profile.length) throw new Error(`${operation.member} has nothing on their profile yet, so there is nothing to install. A teammate adds a skill to their profile when they publish or install it.`);
      const destination = await destinationFor(team);
      return success(await installMany(profile.map(item => ({ team, destination, id: item.id, store, runner, cwd: args.cwd, home: args.home, safeWrite: args.safeWrite })), io));
    }
    if (operation.kind === 'project') {
      const [team] = selectTeam(config.teams, args.team, args.form);
      const teamJson = await readTeam(store.teamClone(team));
      const project = Object.hasOwn(teamJson.projects, operation.project) ? teamJson.projects[operation.project] : undefined;
      if (!project) throw new Error(`Unknown project ${operation.project}.`);
      const destination = await destinationFor(team, operation.project);
      return success(await installMany(project.skills.map(id => ({ team, destination, id, project: operation.project, store, runner, cwd: args.cwd, home: args.home, safeWrite: args.safeWrite })), io));
    }
    const reference = parseRef(operation.ref);
    if (reference.version !== undefined) throw new Error('Installing a previous version is not supported yet; install installs the latest version.');
    const team = await teamForReference(config, reference.team ?? args.team, reference.remote, reference.name, args.form).catch(async (error: unknown) => {
      // §6: a three-part ref on a machine that has joined nothing performs the bootstrap first —
      // `setup <org>/<repo>` with its print-only steps suppressed — and then installs: one code
      // path, not two. The shared pre-flight refuses a configured machine before bootstrap.
      // The import is deferred because setup is
      // built on team, which is built on this module.
      if (!(error instanceof NotJoinedError) || Object.keys(config.teams).length > 0) throw error;
      const { run: setup } = await import('./setup.js');
      const bootstrapped = await setup({ form: args.form, target: error.remote.replace(/^github\.com\//, ''), quiet: true, config: store, runner, home: args.home, hook: args.hook, wrapper: args.wrapper, editHook: args.editHook }, io);
      if (!bootstrapped.ok) {
        if (bootstrapped.refused) throw new RefusedError(bootstrapped.error);
        if (bootstrapped.cancelled) throw new CancelledError(bootstrapped.error);
        throw new Error(bootstrapped.error);
      }
      return bootstrapped.value.team;
    });
    const destination = await destinationFor(team);
    return success([await installOne({ team, destination, reference: reference.name, store, runner, cwd: args.cwd, home: args.home, safeWrite: args.safeWrite }, io)]);
  } catch (error) { return fromError(error); }
}

interface InstallOneCommon {
  team: string;
  store: ConfigStore;
  runner: Runner;
  cwd?: string;
  home?: string;
  safeWrite?: Pick<SafeWriteOptions, 'deadlineMs' | 'backoff' | 'now' | 'sleep'>;
}
export interface PlacingInstallInput extends InstallOneCommon {
  destination: Destination;
  adopt?: never;
  reference?: string;
  id?: string;
  project?: string;
  scope?: { kind: 'global' } | { kind: 'project'; project: string };
}
export interface AdoptInstallInput extends InstallOneCommon {
  adopt: string;
  destination?: never;
  afterAdoptStage?: (stage: AdoptStage) => void | Promise<void>;
}

/** One explicit install/consent path; adoption branches before any placement operation. */
/**
 * A bulk install: one consent question, every skill placed locally, then ONE push for all of them.
 *
 * Installing a project used to run `installOne` per skill, and each of those paid for the network
 * twice — once recording the install, once adding the profile entry. Eleven skills meant
 * twenty-two fetch/push round trips. Here the two records are one commit per skill (the person
 * asked for one line of history per skill, not two), and the whole batch is one push.
 *
 * Failure isolation is the batch's, not the loop's: a skill whose record cannot be written is
 * reported and leaves its `pending` entry behind for the retry, while the rest still land.
 */
async function installMany(inputs: readonly PlacingInstallInput[], io: Prompter): Promise<InstalledResult[]> {
  if (!inputs.length) return [];
  const first = inputs[0]!;
  const config = await first.store.read();
  const binding = config.teams[first.team];
  if (!binding?.handle) throw new Error(`Team ${first.team} has no joined handle.`);
  const clone = first.store.teamClone(first.team);
  // Resolve every source before anything is placed: the grants have to be known together for the
  // question to be asked once, and a version that does not exist must fail before a byte moves.
  const sources: SkillRecord[] = [];
  for (const input of inputs) {
    const skill = await resolveSkill(clone, input.team, input.reference ?? input.id!);
    const latest = (await listVersions(clone, skill.name))[0]?.folder ?? null;
    if (!latest) throw new Error(`skills/${skill.name} holds no v<N> folder.`);
    sources.push(await skillAtSource(join(clone, 'skills', skill.name, latest), skill));
  }
  await ensureConsentAll(first.store, sources, io);
  const placed: PlacedInstall[] = [];
  for (const [index, input] of inputs.entries()) {
    io.progress?.({ step: `Placing ${sources[index]!.name}`, current: index + 1, total: inputs.length });
    placed.push(await placeInstall(input, io, true));
  }
  io.progress?.({ step: `Recording ${placed.length} installs`, current: inputs.length, total: inputs.length });
  const since = new Date().toISOString().slice(0, 10);
  const localSkills = await librarySize(first.home ?? placementHome(first.store), await first.store.read(), first.store.root);
  const handle = binding.handle;
  const outcome = await openTeamRepo(clone, binding.remote, first.runner).safeWriteBatch(placed.map(entry => ({
    message: `${handle}: install ${entry.skill.name}`,
    mutate: (tree) => writePersonFile(tree, handle, person => {
      person.installed = person.installed.filter(existing => !(existing.id === entry.skill.id && sameScope(existing.scope, entry.scope)));
      person.installed.push({ id: entry.skill.id, version: entry.latest, scope: entry.scope, since });
      addProfileEntry(person, { id: entry.skill.id, name: entry.skill.name, version: entry.latest, added: since, via: 'install' });
      if (localSkills !== null) person.local_skills = localSkills;
    }),
  })), { action: 'install', handle, ...first.safeWrite, ...lockWait(io) });
  // A no-op item is a success: the people file already said exactly this, which is what a
  // re-install of an unchanged version looks like. Only a refused mutation is a failure to record.
  const landed = new Set([...outcome.committed.map(entry => entry.index), ...outcome.skipped.filter(entry => entry.noop).map(entry => entry.index)]);
  for (const skipped of outcome.skipped.filter(entry => !entry.noop)) {
    io.print(`Installed ${placed[skipped.index]!.skill.name}, but could not record it: ${skipped.reason}`);
  }
  await first.store.update(fresh => {
    fresh.pending = fresh.pending.filter(entry => !placed.some((item, index) => landed.has(index) && samePending(entry, item.pending)));
  });
  return placed.map((entry, index) => ({ id: entry.skill.id, team: entry.pending.team, path: entry.placed.path, version: entry.latest, profiled: landed.has(index) }));
}

/** What the local half of an install produced, and everything its team-repo write needs. */
interface PlacedInstall {
  skill: SkillRecord;
  latest: string;
  scope: { kind: 'global' } | { kind: 'project'; project: string };
  placed: { path: string; snapshot: { fingerprint: string }; notices: string[] };
  clone: string;
  handle: string;
  remote: string;
  pending: { op: 'install'; id: string; team: string; scope: { kind: 'global' } | { kind: 'project'; project: string }; destination: Destination; version: string | null; started: string };
}

/**
 * Everything an install does on this machine: resolve the skill, take consent, place the folder,
 * claim it in the ledger and seed its receipts. It touches the network not at all, which is what
 * lets a bulk install pay for the push once instead of once per skill.
 *
 * `consented` is for a caller that already asked — `installMany` collects every skill's grants and
 * asks one question for the batch, so the per-skill question here must not ask it again.
 */
async function placeInstall(input: PlacingInstallInput, io: Prompter, consented = false): Promise<PlacedInstall> {
  const config = await input.store.read();
  const binding = config.teams[input.team];
  if (!binding?.handle) throw new Error(`Team ${input.team} has no joined handle.`);
  const clone = input.store.teamClone(input.team);
  io.progress?.({ step: 'Reading the team clone', current: 1, total: 4 });
  const skill = await resolveSkill(clone, input.team, input.reference ?? input.id!);
  const teamJson = await readTeam(clone);
  const packageProject = input.project && teamJson.projects[input.project]?.skills.includes(skill.id) ? input.project : undefined;
  const scope = input.scope ?? (packageProject ? { kind: 'project' as const, project: packageProject } : { kind: 'global' as const });
  if (input.destination.kind === 'checkout') await assertProjectFolder(input.destination.root);
  // §9.1 (B3's forced slice): an install source is `skills/<name>/v<max>/` — already an immutable
  // checkout inside the clone, so there is nothing to materialize. The `@version` refusal lives at
  // the ref site in `run`; nothing here ever read a caller-supplied version, which is why a pin was
  // accepted and then ignored.
  const latest = (await listVersions(clone, skill.name))[0]?.folder ?? null;
  const pending = { op: 'install' as const, id: skill.id, team: input.team, scope, destination: input.destination, version: latest, started: new Date().toISOString() };
  if (!latest) throw new Error(`skills/${skill.name} holds no v<N> folder.`);
  const source = join(clone, 'skills', skill.name, latest);
  const sourceSkill = await skillAtSource(source, skill);
  if (!consented) await ensureConsent(input.store, sourceSkill, io);
  await input.store.update(fresh => {
    fresh.pending = fresh.pending.filter(entry => !samePending(entry, pending));
    fresh.pending.push(pending);
  });
  const repoRoot = input.destination.kind === 'checkout' ? input.destination.root : undefined;
  const root = resolveTarget('claude-code', repoRoot ? { kind: 'project', project: packageProject ?? '' } : { kind: 'global' }, repoRoot, input.home ?? placementHome(input.store));
  const destination = join(root, skill.name);
  if (repoRoot) await assertProjectFolder(repoRoot);
  io.progress?.({ step: `Placing ${skill.name}`, current: 2, total: 4 });
  const release = await lockTarget(root, skill.name);
  let placed: { path: string; snapshot: { fingerprint: string }; notices: string[] };
  try {
    const canonical = await canonicalParentPath(destination);
    const ledger = (await input.store.read()).placements;
    const ownedKey = (await Promise.all(Object.keys(ledger).map(async key => ({ key, canonical: await canonicalParentPath(key) })))).find(item => item.key === destination || (canonical !== undefined && item.canonical === canonical))?.key;
    const collision = await inspect(destination);
    if (collision.kind === 'present') {
      // §9.1.1 left repeated-backup policy deferred and B5 read that as a refusal; rotating the
      // kept path keeps B5's no-loss guarantee without the dead end (placer.keptCopyPath).
      const kept = await keptCopyPath(root, skill.name);
      if (!(await io.confirm(`Replace it with ${versionLabel(skill.latestVersion)}?`, { detail: [
        `You already have a skill named ${skill.name}.`, `Your copy is kept at ${kept}.`,
      ] }))) throw new CancelledError('Replace was declined.');
      if (repoRoot) await appendExclude(repoRoot, '.claude/old-skills/', input.runner).catch((error: unknown) => {
        io.print(`Could not add .claude/old-skills/ to .git/info/exclude: ${error instanceof Error ? error.message : String(error)}`);
      });
      await mkdir(dirname(kept), { recursive: true });
      await moveDirectory(destination, kept);
      io.print(`Your copy is kept at ${kept}.`);
    }
    placed = await place(source, root, skill.name, { replace: false, projectRoot: repoRoot ? checkoutRootOf(destination) : undefined, runner: input.runner });
    await input.store.update((fresh) => {
      if (ownedKey && ownedKey !== placed.path) delete fresh.placements[ownedKey];
      fresh.placements[placed.path] = { id: skill.id, team: input.team, version: latest, scope, placed_at: new Date().toISOString().slice(0, 10), fingerprint: placed.snapshot.fingerprint };
    });
    for (const notice of placed.notices) io.print(notice);
  } finally { await release(); }
  // Seed before safeWrite refreshes the clone: these are receipts for the version just copied.
  const receipts = join(clone, 'evals', skill.id, latest);
  for (const file of await receiptFiles(receipts)) {
    const runId = file.slice(0, -5);
    let receipt: Receipt;
    // The skill is already placed and the ledger already claims it; a receipt this client cannot read
    // (a newer schema, or not JSON) is skipped like the pre-migration case below, never a mid-install abort.
    try {
      receipt = receiptSchema.parse(JSON.parse(await readFile(join(receipts, file), 'utf8')));
    } catch {
      io.print(`Skipped ${runId}: invalid receipt.`);
      continue;
    }
    if (!receipt.content_digest) { io.print(`Skipped ${runId}: no content digest (pre-migration receipt).`); continue; }
    const directory = join(input.store.root, 'evals', 'local', receipt.content_digest.slice('sha256:'.length), runId);
    await mkdir(directory, { recursive: true });
    await copyFile(join(receipts, file), join(directory, 'receipt.json'));
  }
  return { skill, latest, scope, placed: placed!, clone, handle: binding.handle, remote: binding.remote, pending };
}

export function installOne(input: AdoptInstallInput, io: Prompter): Promise<AdoptedResult>;
export function installOne(input: PlacingInstallInput, io: Prompter): Promise<InstalledResult>;
export async function installOne(input: AdoptInstallInput | PlacingInstallInput, io: Prompter): Promise<AdoptedResult | InstalledResult> {
  if (input.adopt !== undefined) return adoptOne(input, io);
  const { skill, latest, scope, placed, clone, handle, remote, pending } = await placeInstall(input, io);
  const binding = { handle, remote };
  io.progress?.({ step: 'Publishing to the team repository', current: 3, total: 4 });
  const repo = openTeamRepo(clone, binding.remote, input.runner);
  const since = new Date().toISOString().slice(0, 10);
  const localSkills = await librarySize(input.home ?? placementHome(input.store), await input.store.read(), input.store.root);
  await repo.safeWrite((tree) => writePersonFile(tree, binding.handle!, person => {
    person.installed = person.installed.filter(entry => !(entry.id === skill.id && sameScope(entry.scope, scope)));
    person.installed.push({ id: skill.id, version: latest, scope, since });
    if (localSkills !== null) person.local_skills = localSkills;
  }), { action: 'install', handle: binding.handle, message: `${binding.handle}: install ${skill.name}`, ...input.safeWrite, ...lockWait(io) });
  io.progress?.({ step: 'Recording your install', current: 4, total: 4 });
  await input.store.update((fresh) => { fresh.pending = fresh.pending.filter((entry) => !samePending(entry, pending)); });
  // D77 extended to install (2026-09-18): the profile entry is written with no question. It is a
  // SECOND safeWrite after the skill is placed and the install is recorded, so its failure is
  // reported on its own line and in `profiled: false` — never as a failed install, which would
  // contradict the copy already on disk and the record already pushed (mirrors publish).
  let profiled = false;
  try {
    await recordProfileEntry({ store: input.store, clone, team: input.team, handle: binding.handle, remote: binding.remote, runner: input.runner,
      id: skill.id, name: skill.name, version: latest, via: 'install', localSkills, safeWrite: input.safeWrite }, io);
    profiled = true;
  } catch (error) {
    io.print(`Installed ${skill.name}, but could not add it to your profile: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { id: skill.id, team: input.team, path: placed.path, version: latest, profiled };

}

/** Record an existing Library folder without copying a byte. Machine provenance is deliberately last. */
async function adoptOne(input: AdoptInstallInput, io: Prompter): Promise<AdoptedResult> {
  const home = input.home ?? placementHome(input.store);
  const config = await input.store.read();
  const binding = config.teams[input.team];
  if (!binding?.handle) throw new Error(`Team ${input.team} has no joined handle.`);
  // `--adopt` is a path grammar, not the name-or-path grammar used by publish/eval. Resolve it
  // before the shared Library lookup so a bare relative path cannot select a same-named folder in
  // some other root merely because the process happened to run elsewhere.
  const found = await resolveLibrarySkill(home, config, input.store.root, expandRefPath(input.adopt, home, input.cwd));
  if (!found || !adoptableEntry(found)) throw new Error(`${input.adopt} is not a folder in your Library.`);

  const roots = await localSkillRoots(home, config.projects ?? []);
  const libraryRoot = roots.roots.find((root) => root.root === found.libraryRoot);
  if (!libraryRoot || (libraryRoot.scope === 'project' && (!libraryRoot.registered || !libraryRoot.repoRoot))) throw new Error(`${input.adopt} is not a folder in your Library.`);
  // `installed[].scope` and the placements ledger name a TEAM project (`install project <name>`), never the Library
  // root a copy sits in — `install <ref> --into <checkout>` records `global` too (installOne above). Adopt follows the
  // code (spec §4.5, code-wins rule); the root it sits in is the destination on the pending note.
  const scope = { kind: 'global' as const };
  const destination: Destination = libraryRoot.scope === 'global'
    ? { kind: 'global' }
    : { kind: 'checkout', root: await projectPath(libraryRoot.repoRoot!) };

  const clone = input.store.teamClone(input.team);
  const records = await skillRecords(clone, input.team);
  const digests = await versionDigests(clone, records.map((record) => record.name));
  const digest = await canonicalDigest(found.path);
  const matches = [...digests.values()].filter((entry) => entry.digest === digest).sort((a, b) => b.n - a.n);
  if (matches.length === 0) throw new Error(`${found.path} does not match any published version of a team skill byte for byte; publish it instead.`);
  // Several versions can share these bytes only across skills (publish refuses an identical republish within one), so
  // the folder name picks the skill, exactly as `reconcile` classifies it; newest first covers a hand-built repo.
  const matched = matches.find((entry) => entry.name === basename(found.path)) ?? matches[0]!;
  if (basename(found.path) !== matched.name) throw new Error(`${found.path} holds the bytes of ${matched.name} ${versionLabel(matched.n)} under a different folder name; rename it to ${matched.name} first.`);
  const record = records.find((candidate) => candidate.name === matched.name);
  if (!record) throw new Error(`No skill ${matched.name} in team ${input.team}.`);

  const pending = { op: 'install' as const, id: record.id, team: input.team, scope, destination, version: matched.folder, started: new Date().toISOString() };
  const since = new Date().toISOString().slice(0, 10);
  const clearPending = () => input.store.update((fresh) => { fresh.pending = fresh.pending.filter((entry) => !samePending(entry, pending)); });
  // The team's record of this install: filter-then-push, so replaying it is a no-op (install.ts's own order above).
  const writeInstalledRow = async () => {
    const localSkills = await librarySize(home, await input.store.read(), input.store.root);
    const repo = openTeamRepo(clone, binding.remote, input.runner);
    await repo.safeWrite((tree) => writePersonFile(tree, binding.handle!, person => {
      person.installed = person.installed.filter((entry) => !(entry.id === record.id && sameScope(entry.scope, scope)));
      person.installed.push({ id: record.id, version: matched.folder, scope, since });
      if (localSkills !== null) person.local_skills = localSkills;
    }), { action: 'install', handle: binding.handle, message: `${binding.handle}: install ${record.name}`, ...input.safeWrite, ...lockWait(io) });
  };
  const placementKey = await recordedPlacementKey(config, found.path);
  if (placementKey !== undefined) {
    // Review walk D5: the ledger row is adopt's LAST write, so a recorded path is a finished job and is refused (§7).
    // The one thing a crash can leave behind is the pending note between that write and its clearing — adopt's own, or
    // a placing install's that died at its people-file write. Drain it here (the idempotent team write, then the
    // clear) and still refuse: a success result would be the "resumable adopt" the walk rejected.
    const placement = config.placements[placementKey]!;
    const stale = placement.id === record.id && placement.team === input.team && placement.version === matched.folder
      && config.pending.some((entry) => samePending(entry, pending) && pendingVersion(entry) === matched.folder);
    if (stale) {
      await writeInstalledRow();
      await clearPending();
      await input.afterAdoptStage?.('cleared');
    }
    throw new Error(`${found.path} is already recorded as installed.`);
  }

  const source = join(clone, 'skills', matched.name, matched.folder);
  const sourceSkill = await skillAtSource(source, record);
  await ensureConsent(input.store, sourceSkill, io);
  await input.afterAdoptStage?.('consent');
  await input.store.update((fresh) => {
    fresh.pending = fresh.pending.filter((entry) => !samePending(entry, pending));
    fresh.pending.push(pending);
  });
  await input.afterAdoptStage?.('pending');

  await writeInstalledRow();
  await input.afterAdoptStage?.('people');

  const snapshot = await snapshotSkillDirectory(found.path);
  await input.store.update((fresh) => {
    fresh.placements[found.path] = { id: record.id, team: input.team, version: matched.folder, scope, placed_at: since, fingerprint: snapshot.fingerprint };
  });
  await input.afterAdoptStage?.('ledger');
  await clearPending();
  await input.afterAdoptStage?.('cleared');
  return { id: record.id, team: input.team, path: found.path, version: matched.folder, profiled: false, adopted: true };
}

function pendingVersion(entry: Config['pending'][number]): string | undefined {
  const version = (entry as Config['pending'][number] & { version?: unknown }).version;
  return typeof version === 'string' ? version : undefined;
}

async function recordedPlacementKey(config: Config, path: string): Promise<string | undefined> {
  const wanted = await canonicalParentPath(path);
  for (const key of Object.keys(config.placements)) {
    if (resolve(key) === resolve(path)) return key;
    if (wanted !== undefined && await canonicalParentPath(key) === wanted) return key;
  }
  return undefined;
}

/**
 * One question for a whole batch. Installing a project of eleven skills asked eleven separate
 * approval questions, each naming one skill, and every one of them had to be answered before the
 * next skill was even resolved. The grants are known up front, so the person reads the whole set
 * once and answers once; a skill already approved at this exact grant hash is not in the question,
 * exactly as it is not in the single-skill one.
 */
async function ensureConsentAll(store: ConfigStore, skills: readonly SkillRecord[], io: Prompter): Promise<void> {
  const malformed = skills.flatMap(skill => skill.grants.ok ? [] : [{ name: skill.name, raw: skill.grants.raw }]);
  if (malformed.length) {
    const names = malformed.map(entry => entry.name).join(', ');
    if (!(await io.confirm(`Install ${malformed.length === 1 ? names : `${malformed.length} skills`} despite malformed allowed-tools?`, {
      detail: malformed.map(entry => `allowed-tools for ${entry.name} could not be parsed: ${describeRaw(entry.raw)}`),
    }))) throw new CancelledError(`Consent was declined for malformed allowed-tools on ${names}.`);
  }
  const config = await store.read();
  const asking = skills.flatMap(skill => {
    const grants = skill.grants;
    if (!grants.ok || grants.normalized === 'none') return [];
    if (config.approvals[skill.id]?.grants === grants.hash) return [];
    return [{ id: skill.id, name: skill.name, normalized: grants.normalized, hash: grants.hash }];
  });
  if (!asking.length) return;
  const detail = asking.flatMap(entry => [`${entry.name} requests allowed-tools:`, ...entry.normalized.split('\n')]);
  if (!(await io.confirm(`Approve these tools for ${asking.length === 1 ? asking[0]!.name : `${asking.length} skills`}?`, { detail }))) {
    throw new CancelledError(`Consent was declined for ${asking.map(entry => entry.name).join(', ')}.`);
  }
  const approved = new Date().toISOString().slice(0, 10);
  await store.update(fresh => { for (const entry of asking) fresh.approvals[entry.id] = { grants: entry.hash, approved_at: approved }; });
}

async function ensureConsent(store: ConfigStore, skill: SkillRecord, io: Prompter): Promise<void> {
  if (!skill.grants.ok) {
    if (!(await io.confirm(`Install ${skill.name} despite malformed allowed-tools?`, { detail: [`allowed-tools for ${skill.name} could not be parsed: ${describeRaw(skill.grants.raw)}`] }))) throw new CancelledError(`Consent was declined for malformed allowed-tools on ${skill.name}.`);
    return;
  }
  if (skill.grants.normalized === 'none') return;
  const config = await store.read();
  if (config.approvals[skill.id]?.grants === skill.grants.hash) return;
  if (!(await io.confirm(`Approve these tools for ${skill.name}?`, { detail: [`${skill.name} requests allowed-tools:`, ...skill.grants.normalized.split('\n')] }))) throw new CancelledError(`Consent was declined for ${skill.name}.`);
  await store.update((fresh) => { fresh.approvals[skill.id] = { grants: skill.grants.ok ? skill.grants.hash : '', approved_at: new Date().toISOString().slice(0, 10) }; });
}

export async function skillAtSource(source: string, expected: SkillRecord): Promise<SkillRecord> {
  const parsed = parseSkillFrontmatter(await readFile(join(source, 'SKILL.md'), 'utf8'));
  if (!parsed.ok) throw new Error(`Pinned skill at ${source} has invalid SKILL.md: ${parsed.error}`);
  if (parsed.data.name !== expected.name || parsed.data.metadata.id !== expected.id) throw new Error(`Pinned skill at ${source} does not match ${expected.name} (${expected.id}).`);
  return { ...expected, directory: source, frontmatter: parsed.data, body: parsed.body, grants: parsed.grants };
}

async function resolveSkill(clone: string, team: string, ref: string): Promise<SkillRecord> {
  const record = await findSkill(clone, team, ref);
  if (!record) throw new Error(`No skill ${ref} in team ${team}.`);
  return record;
}

type ParsedOperation = { kind: 'skill'; ref: string } | { kind: 'member'; member: string } | { kind: 'project'; project: string };
function parseOperation(args: InstallArgs): ParsedOperation {
  // A missing selector is a usage error here, for every caller of run() — never an empty handle
  // that reaches the filesystem as people/.json — and a present one is held to the handle rule
  // before it can become a path segment (ls and team remove do the same).
  if (args.kind === 'member' || args.member) {
    const member = args.member ?? args.ref;
    if (!member) throw new Error(`Provide a member handle: \`${invocation(args.form, 'install member <handle>')}\`.`);
    if (member.includes('@')) throw new Error('Installing a previous version is not supported yet; install installs the latest version.');
    return { kind: 'member', member: parseOrExplain(handleSchema, member, 'member handle') };
  }
  if (args.kind === 'project' || args.project) {
    const project = args.project ?? args.ref;
    if (!project) throw new Error(`Provide a project name: \`${invocation(args.form, 'install project <name>')}\`.`);
    if (project.includes('@')) throw new Error('Installing a previous version is not supported yet; install installs the latest version.');
    return { kind: 'project', project };
  }
  if (!args.ref) throw new Error('Provide a skill ref, `member <handle>`, or `project <name>`.');
  return { kind: 'skill', ref: args.ref };
}
export function parseRef(value: string): { team?: string; remote?: string; name: string; version?: string } {
  const at = value.lastIndexOf('@');
  const bare = at > 0 ? value.slice(0, at) : value;
  const version = at > 0 ? value.slice(at + 1) : undefined;
  const segments = bare.split('/');
  if (segments.length === 1) return { name: bare, version };
  if (segments.length === 2) return { team: segments[0], name: segments[1]!, version };
  if (segments.length === 3) return { remote: `github.com/${segments[0]}/${segments[1]}`, name: segments[2]!, version };
  throw new Error(`Invalid skill ref ${value}.`);
}
/** A three-part ref names a repository this machine has not joined: `install` answers it with the §6 bootstrap, every other verb with the message. */
export class NotJoinedError extends Error {
  constructor(readonly remote: string, message: string) { super(message); this.name = 'NotJoinedError'; }
}
export async function teamForReference(config: Config, explicit: string | undefined, remote: string | undefined, name?: string, form?: InvocationForm): Promise<string> {
  if (remote) {
    const found = teamByRemote(config, remote);
    if (!found) refuseSecondTeam(config, { remote }, invocation(form, 'setup', remote.replace(/^github\.com\//, '')), form);
    if (!found) throw new NotJoinedError(remote, `This machine has not joined ${remote}; run \`${invocation(form, 'team join', remote.replace(/^github\.com\//, ''))}\` first.`);
    return found[0];
  }
  // Only the genuinely ambiguous bare ref is answered here, because only a ref-taking verb can name
  // the qualified refs that would settle it; the zero-team, one-team and unknown `--team` answers
  // come from the one resolver every other verb uses, so they cannot drift again.
  const teams = Object.keys(config.teams);
  if (!explicit && teams.length > 1) {
    const qualified = name ? ` Matching refs: ${teams.map((team) => `${team}/${name}`).join(', ')}.` : '';
    throw new Error(`A bare skill ref is ambiguous across configured teams; use <team>/<skill> or --team.${qualified}`);
  }
  return selectTeam(config.teams, explicit, form)[0];
}
/** Validate before pending intent or a target lock can create directories. */
export async function assertProjectFolder(root: string): Promise<void> {
  if (!isAbsolute(root) || !(await stat(root).catch(() => undefined))?.isDirectory()) throw new Error(`Project folder ${root} is missing`);
}

export async function resolveDestination(store: ConfigStore, teamJson: Team, packageProject: string | undefined, io: Prompter, interactive: boolean, opts: { into?: string; cwd?: string; runner: Runner; home: string; form?: InvocationForm }): Promise<Destination> {
  if (opts.into === 'global') return { kind: 'global' };
  const projects = (await store.read()).projects ?? [];
  const roots = [...new Set(await Promise.all(projects.map((project) => projectPath(project.root))))];
  if (opts.into !== undefined) {
    await assertProjectFolder(opts.into);
    // §7.2: install never adds a project. An untracked --into refuses and names the verb that would.
    const path = await projectPath(opts.into);
    if (!roots.includes(path)) throw new Error(`${path} is not a project in your library. Add it with \`${invocation(opts.form, 'project add', path)}\`, or pass --into global.`);
    return { kind: 'checkout', root: path };
  }
  if (!interactive) {
    if (!roots.length) return { kind: 'global' };
    throw new Error('Pass --into global or --into <project root>');
  }
  const global = 'Global (~/.claude/skills)';
  const labels = new Map(await Promise.all(projects.map(async (project) => [await projectPath(project.root), project.label] as const)));
  const choices = [global, ...roots.map(root => `${labels.get(root) ?? basename(root)} · ${root}`)];
  const remotes = packageProject ? teamJson.projects[packageProject]?.remotes ?? [] : [];
  const matches: number[] = [];
  for (const [index, root] of roots.entries()) {
    if (!remotes.length) break;
    const origin = await opts.runner.run('git', ['remote', 'get-url', 'origin'], { cwd: root });
    if (origin.code === 0 && remotes.some(remote => normalizeRemote(remote) === normalizeRemote(origin.stdout.trim()))) matches.push(index + 1);
  }
  // A sub-project answers its parent's origin (git walks up to the same repository), so among nested
  // matches only the outermost one is the checkout the team project names; two unrelated matches still
  // offer no default.
  const outermost = matches.filter(match => !matches.some(other => other !== match && insideRoot(roots[match - 1]!, roots[other - 1]!)));
  const defaultChoice = outermost.length === 1 ? choices[outermost[0]!] : outermost.length > 1 ? undefined : global;
  const selected = await io.select('Install to', choices, defaultChoice);
  const index = choices.indexOf(selected);
  if (index < 0) throw new Error('Invalid install destination.');
  return index === 0 ? { kind: 'global' } : { kind: 'checkout', root: roots[index - 1]! };
}

export function samePending(a: { op: string; id: string; team: string; scope: unknown; destination?: Destination }, b: { op: string; id: string; team: string; scope: unknown; destination?: Destination }): boolean {
  return a.op === b.op && a.id === b.id && a.team === b.team && sameScope(a.scope, b.scope) && a.destination?.kind === b.destination?.kind && (a.destination?.kind !== 'checkout' || (b.destination?.kind === 'checkout' && a.destination.root === b.destination.root));
}
/**
 * HOME for a global placement: the default store root is `~/.terum/skills`, so HOME is two path
 * segments up — judged segment-wise, because win32 roots are backslash-separated and a hard-coded
 * `/.terum/skills` suffix silently placed skills inside the store where Claude Code never looks.
 * A custom or test root is its own placement home. Exported with an injectable path flavour so the
 * win32 shape is provable from any host.
 */
export function placementHome(store: Pick<ConfigStore, 'root'>, path: Pick<typeof import('node:path'), 'basename' | 'dirname'> = { basename, dirname }): string {
  return path.basename(store.root) === 'skills' && path.basename(path.dirname(store.root)) === '.terum' ? path.dirname(path.dirname(store.root)) : store.root;
}
