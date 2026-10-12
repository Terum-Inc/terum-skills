import { mapWithConcurrency } from './concurrency.js';
import { lstat, readdir, readFile, realpath, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { FRONTMATTER, orderByProjectTree, projectParents, type Config, type LibraryProject } from './schema.js';
import { AGENT_PATHS } from './placer/agent-paths.js';
import { assertNotInsideStateRoot, inspectSkillSource, scanSkillFolder, type SourceProblem } from './skill-source.js';

/** Per-folder scans overlap: on a UNC/9P root the cost is latency, not CPU (W-02). */
const LOCAL_SCAN_CONCURRENCY = 8;

export interface PlacementRef { id: string; team: string; version: string | null; }
export type Inspection =
  | { kind: 'candidate'; description: string; privileged: boolean }
  | { kind: 'rejected'; reason: SourceProblem; detail: string; description?: string }
  | { kind: 'failed'; reason: string };
/** `updated` is the mtime of the folder's own SKILL.md as an ISO-8601 instant — the one stat the scan
 *  already does (W-02: no new per-row I/O, no recursive walk on a UNC root). Absent when the folder has
 *  no readable SKILL.md file, or when the filesystem reports an mtime outside the Date range: the field
 *  is a claim about a real file, never a default. */
export interface LocalEntry { body?: string | null; frontmatter: string | null; skillId: string | null; name: string; path: string; placement?: PlacementRef; placementFingerprint?: string; characters?: number; updated?: string; category: string | null; inspection: Inspection; }
export interface LocalInventory {
  root: string;
  scope: 'global' | 'project';
  rootState: 'scanned' | 'absent' | 'unreadable';
  entries: LocalEntry[];
  problems: { path: string; reason: string }[];
}
/**
 * §7.2: a project root is here because the user added it, so there is no `detected` any more — the
 * two things that produced it (the cwd-detected root and `ls`'s ledger-inferred `extraRoots`) were
 * the app adding a project by itself. `label` is the user-facing name carried on `config.projects`.
 */
export interface LocalRoot { root: string; scope: 'global' | 'project'; repoRoot?: string; registered: boolean; label?: string; /** Sub-projects: the repo root of the registered project this one sits inside; absent at the top level. */ parent?: string; }

/**
 * Discovery is filesystem-only: the nearest .git file or directory selects the project root.
 * install's currentRepoRoot and sync's matchingProjectRoot are git+remote-validated PLACEMENT
 * resolvers (§5.2); they deliberately remain separate from this read-only discovery operation.
 */
export async function nearestRepoRoot(cwd: string, problems: { path: string; reason: string }[] = []): Promise<string | undefined> {
  let dir = resolve(cwd);
  for (;;) {
    const marker = join(dir, '.git');
    try {
      const entry = await lstat(marker);
      if (entry.isFile() || entry.isDirectory()) return dir;
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) {
        problems.push({ path: marker, reason: error instanceof Error ? error.message : String(error) });
        return undefined;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export async function localSkillRoots(home: string, projects: readonly LibraryProject[] = []): Promise<{ roots: LocalRoot[]; problems: { path: string; reason: string }[] }> {
  const roots: LocalRoot[] = [{ root: AGENT_PATHS['claude-code'].global(home), scope: 'global', registered: false }];
  const problems: { path: string; reason: string }[] = [];
  const canonicalHome = await realpath(home).catch(() => resolve(home));
  const seenRepos = new Set([canonicalHome]);
  const seenSkills = new Set([await realpath(roots[0]!.root).catch(() => resolve(roots[0]!.root))]);
  // A root the user added stays visible even when it is unreadable: hiding it would make the Library
  // disagree with the list the user can see in Settings, which is the opposite of what it is for.
  const append = async (dir: string, label: string): Promise<void> => {
    const canonical = await realpath(dir).catch(() => resolve(dir));
    const project = AGENT_PATHS['claude-code'].project(dir);
    const projectPath = await realpath(project).catch(() => AGENT_PATHS['claude-code'].project(canonical));
    if (seenRepos.has(canonical) || seenSkills.has(projectPath)) return;
    seenRepos.add(canonical); seenSkills.add(projectPath);
    roots.push({ root: project, scope: 'project', repoRoot: dir, registered: true, label });
  };
  for (const project of projects) await append(project.root, project.label);
  // Sub-projects: a registered root inside another registered root is drawn under it, in tree order,
  // so `ls --local` and the app's sidebar agree with `project list` about which folder holds which.
  const projectRoots = roots.slice(1);
  const parents = projectParents(projectRoots.map((root) => root.repoRoot!));
  projectRoots.forEach((root, index) => { if (parents[index] !== undefined) root.parent = parents[index]; });
  const ordered = orderByProjectTree(projectRoots, (root) => root.repoRoot!, (root) => root.parent).map((entry) => entry.item);
  return { roots: [roots[0]!, ...ordered], problems };
}

/** §7.1: the label the user chose the project by. `basename` remains the fallback for a root with no stored label. */
/**
 * Cross-mirror overlays spec §5 M2.1 / §4.5 — the folders `reconcile` classifies and `install --adopt` accepts: every
 * candidate row, plus a folder rejected ONLY for a name mismatch, so a copy whose bytes are a team version under another
 * folder name can be reported (the `renamed` group) or refused with the exact rename line. Nothing else is admitted;
 * a name-mismatch folder never reaches the `differing` group, whose one action (publish) would refuse it.
 */
export function adoptableEntry(entry: Pick<LocalEntry, 'inspection'>): boolean {
  return entry.inspection.kind === 'candidate' || (entry.inspection.kind === 'rejected' && entry.inspection.reason === 'name-mismatch');
}

export function localRootLabel(root: LocalRoot): string { return root.repoRoot === undefined ? 'Global' : root.label ?? basename(root.repoRoot); }

export async function canonicalLedger(config: Pick<Config, 'placements'>) {
  const placementPaths = await Promise.all(Object.entries(config.placements).map(async ([target, ref]) => ({ target, ref, canonical: await canonicalParentPath(resolve(target)) })));
  return { placementPaths };
}

/** Canonicalize only the parent: a child symlink must remain a distinct, rejected entry. */
export async function canonicalParentPath(path: string): Promise<string | undefined> {
  try { return join(await realpath(dirname(path)), basename(path)); }
  catch { return undefined; }
}

function entryProvenance(path: string, canonical: string | undefined, { placementPaths }: Awaited<ReturnType<typeof canonicalLedger>>) {
  const placement = placementPaths.find(({ target, canonical: reference }) => resolve(target) === path || (canonical !== undefined && reference === canonical))?.ref;
  return { placement };
}

/** Direct entries only. Provenance is ledger evidence, independent of inspection success. */
export async function localSkills(root: string, config: Pick<Config, 'placements'>, options: { scope: LocalRoot['scope']; stateRoot: string; ledger?: Awaited<ReturnType<typeof canonicalLedger>> }): Promise<LocalInventory> {
  root = resolve(root);
  const inventory: LocalInventory = { root, scope: options.scope, rootState: 'scanned', entries: [], problems: [] };
  let names: string[];
  try { names = (await readdir(root)).sort(); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') inventory.rootState = 'absent';
    else { inventory.rootState = 'unreadable'; inventory.problems.push({ path: root, reason: error instanceof Error ? error.message : String(error) }); }
    names = [];
  }
  const { placementPaths } = options.ledger ?? await canonicalLedger(config);
  // One realpath per call: every name is one segment beneath the resolved root.
  // Keep undefined on failure so ledger comparisons retain their exact resolve() fallback.
  const realRoot = await realpath(root).then((value) => value, () => undefined);
  const canonicalRoot = realRoot ?? root;
  for (const { target, canonical } of placementPaths) {
    if (dirname(resolve(target)) !== root && (canonical === undefined || dirname(canonical) !== canonicalRoot)) continue;
    try { await lstat(target); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') inventory.problems.push({ path: target, reason: 'placement recorded in the ledger but the folder is missing' });
    }
  }
  const scanned = await mapWithConcurrency(names, LOCAL_SCAN_CONCURRENCY, async (name): Promise<LocalEntry | null> => {
    const path = join(root, name);
    const canonical = realRoot === undefined ? undefined : join(realRoot, name);
    const { placement } = entryProvenance(path, canonical, { placementPaths });
    const tracked = placement !== undefined;
    const entry: LocalEntry = { frontmatter: null, skillId: null, category: null, name, path, ...(placement ? { placement: { id: placement.id, team: placement.team, version: placement.version }, placementFingerprint: placement.fingerprint } : {}), inspection: { kind: 'failed', reason: '' } };
    const reject = (reason: SourceProblem, detail: string, description?: string): void => { entry.inspection = { kind: 'rejected', reason, detail, ...(description === undefined ? {} : { description }) }; };
    try {
      const details = await lstat(path);
      if (details.isSymbolicLink()) {
        reject('symlink', 'symbolic link');
        return entry;
      }
      try { assertNotInsideStateRoot(path, options.stateRoot); }
      catch {
        reject('inside-state-root', `inside the terum-skills state directory ${options.stateRoot}`);
        return entry;
      }
      if (!details.isDirectory()) {
        reject('not-a-directory', 'not a directory');
      } else {
        let skill;
        try { skill = await stat(join(path, 'SKILL.md')); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        if (!skill) {
            reject('skill-md-missing', 'SKILL.md missing');
        } else if (!skill.isFile()) reject('skill-md-not-a-file', 'SKILL.md is not a regular file');
        else {
          // The stat above is the only one this scan may spend; its mtime is the folder's last-changed
          // stamp. A filesystem that reports an mtime Date cannot hold (a 9P/UNC root can) yields an
          // Invalid Date, whose toISOString throws — so the field stays absent there rather than
          // carrying a fabricated date or failing the whole entry.
          if (Number.isFinite(skill.mtime.getTime())) entry.updated = skill.mtime.toISOString();
          const raw = await readFile(join(path, 'SKILL.md'), 'utf8');
          // String.prototype.length counts UTF-16 code units, the same basis HYG6's 20,000-character
          // guideline uses; the file is already in hand, so the count costs no extra read.
          entry.characters = raw.length;
          const fence = FRONTMATTER.exec(raw);
          entry.frontmatter = fence?.[0].replace(/\r?\n$/, '') ?? null;
          entry.body = fence ? raw.slice(fence[0].length) : raw;
          const inspection = inspectSkillSource(raw, tracked ? undefined : name);
          entry.category = inspection.category ?? null;
          if (!inspection.ok) reject(inspection.reason, inspection.detail, inspection.description);
          else {
            const scan = await scanSkillFolder(path);
            if (scan.symlink) reject('nested-symlink', `contains symlink ${scan.symlink}`);
            else { entry.skillId = inspection.id; entry.inspection = { kind: 'candidate', description: inspection.description, privileged: scan.privileged }; }
          }
        }
      }
    } catch (error) { entry.inspection = { kind: 'failed', reason: error instanceof Error ? error.message : String(error) }; }
    return entry;
  });
  for (const entry of scanned) if (entry !== null) inventory.entries.push(entry);
  return inventory;
}

/** The picker offers untracked candidates; privileged content needs explicit opt-in. */
export function candidatesOf(inventory: LocalInventory, allowPrivileged = false): LocalEntry[] {
  return inventory.entries.filter((entry) => !entry.placement && entry.inspection.kind === 'candidate' && (allowPrivileged || !entry.inspection.privileged));
}


/**
 * D16 draws a card for every direct child FOLDER and §7.4(b) counts "direct child directories". A plain
 * file (`.DS_Store`, `README.md`) is neither: it is still scanned, so `entries` mirrors `readdir` and a
 * ledger row pointing at it can be reported, but it is not a skill and must not draw a broken card or
 * inflate every printed and sidebar count (hybrid review r1, high — A20 #4). The scan rejects exactly
 * that entry as `not-a-directory`; a symlink is rejected as `symlink` first and stays a (refused)
 * card, because the agent that follows it sees a skill folder there, so it stays counted too.
 */
export function isSkillFolder(entry: Pick<LocalEntry, 'inspection'>): boolean {
  return !(entry.inspection.kind === 'rejected' && entry.inspection.reason === 'not-a-directory');
}

export function localSkillCounts(inventory: LocalInventory): { skillFolders: number; connectable: number } {
  const skillFolders = inventory.entries.filter(isSkillFolder).length;
  return { skillFolders, connectable: candidatesOf(inventory).length };
}

/** A run-local snapshot: discovery and each root walk happen at most once, on demand. */
export interface LibraryScan {
  roots(): Promise<LocalRoot[]>;
  inventory(root: LocalRoot, config: Pick<Config, 'placements'>): Promise<LocalInventory>;
}

export function createLibraryScan(home: string, projects: readonly LibraryProject[], stateRoot: string): LibraryScan {
  let roots: Promise<LocalRoot[]> | undefined;
  const ledgers = new WeakMap<Pick<Config, 'placements'>, ReturnType<typeof canonicalLedger>>();
  const inventories = new Map<string, Promise<LocalInventory>>();
  return {
    roots: () => roots ??= localSkillRoots(home, projects).then(discovery => discovery.roots),
    async inventory(root, config) {
      let ledger = ledgers.get(config);
      if (!ledger) { ledger = canonicalLedger(config); ledgers.set(config, ledger); }
      const previous = inventories.get(root.root);
      if (!previous) {
        const inventory = ledger.then(ledger => localSkills(root.root, config, { scope: root.scope, stateRoot, ledger }));
        inventories.set(root.root, inventory);
        return inventory;
      }
      const inventory = await previous;
      // Rebind placement provenance from the current ledger without another folder walk.
      const currentLedger = await ledger;
      const canonicalRoot = await realpath(inventory.root).then(value => value, () => undefined);
      const entries = inventory.entries.map(entry => {
        const canonical = canonicalRoot === undefined ? undefined : join(canonicalRoot, entry.name);
        const { placement } = entryProvenance(entry.path, canonical, currentLedger);
        const source = { ...entry };
        delete source.placement;
        delete source.placementFingerprint;
        return { ...source, ...(placement ? { placement: { id: placement.id, team: placement.team, version: placement.version }, placementFingerprint: placement.fingerprint } : {}) };
      });
      return { ...inventory, entries };
    },
  };
}

/**
 * How many skill folders this machine holds, for the roster's per-member total (`person.local_skills`).
 * The roots are the ones the product owns — the global root plus every registered project checkout —
 * and never a root merely discovered from the current directory, so the number does not change with
 * where a sync happened to run. The per-root formula is `localSkillCounts().skillFolders`, the same one
 * the Library prints, so a machine never reports two different totals: every displayed row plus a
 * folder rejected only over its frontmatter, because an unshareable folder is still a skill the person
 * has. An absent root contributes 0 — a machine with no global skills folder really has no skills
 * there — but an *unreadable* one makes the whole answer null: not being able to look is not the same
 * as looking and finding nothing, and the caller must leave the last known total alone rather than
 * publish a wrong zero. This is a best-effort self-report, not an audit.
 */
export async function librarySize(home: string, config: Pick<Config, 'placements' | 'projects'>, stateRoot: string, scan = createLibraryScan(home, config.projects ?? [], stateRoot)): Promise<number | null> {
  let total = 0;
  for (const root of await scan.roots()) {
    if (root.scope !== 'global' && !root.registered) continue;
    const inventory = await scan.inventory(root, config);
    if (inventory.rootState === 'unreadable') return null;
    total += localSkillCounts(inventory).skillFolders;
  }
  return total;
}

/** What `resolveLibrarySkill` found: the folder, the Library root it sits in, and the scan's verdict on it. */
export interface LibrarySkillMatch { name: string; path: string; libraryRoot: string; inspection: Inspection }

/**
 * Whether a ref names a FOLDER rather than a skill: `~`, `~/…`, an absolute path, or anything carrying a
 * path separator. A legal skill name (1–64 lowercase alphanumerics or single hyphens) can contain none
 * of these, so the two grammars never overlap and no name is ever mistaken for a path.
 */
export function refIsPath(ref: string): boolean {
  return ref === '~' || ref.startsWith('~/') || isAbsolute(ref) || ref.includes('/') || ref.includes(sep);
}

/** A path ref as an absolute path: `~` expands to `home` (the shell never sees a ref the desktop passes, so the CLI expands it), a relative one resolves against the process cwd. */
export function expandRefPath(ref: string, home: string, cwd = process.cwd()): string {
  return resolve(cwd, ref === '~' ? home : ref.startsWith('~/') ? join(home, ref.slice(2)) : ref);
}

/**
 * Resolve a skill name OR a folder path to a folder in the Library — the global root plus every `config.projects`
 * root, and nothing else. Shared by `publish` and `eval` (§5.1 step 1, §6.3) so there is exactly one
 * answer to "which folder does this ref mean"; two resolvers would let the verb that publishes bytes
 * and the verb that evaluates them disagree about which bytes they mean.
 *
 * D72: the match is by NAME, whatever the scan made of the folder. Matching only `candidate` entries
 * made a folder that plainly exists — rejected for an unknown frontmatter key, a name mismatch, a
 * missing description, an illegal name, or unreadable — come back as `undefined`, and both verbs then
 * printed §6.3's "No local skill folder named …" for it: a lie, and one that hid the scan's own
 * detail. The match now carries its `inspection` so the caller can refuse with that detail
 * (`unusableSkillFolder`). A usable folder in a LATER root still wins over an unusable one in an
 * earlier root, so no ref that resolved before turns into a refusal. `undefined` now means exactly
 * one thing: no Library root holds an entry by that name.
 *
 * A PATH ref (`refIsPath`) matches the entry whose folder it is — compared as typed after `~` expansion,
 * and again through the parent's realpath so a symlinked home or a `/var` → `/private/var` alias still
 * matches. The desktop passes the Library card's path for a skill the team has never seen, because a
 * name alone cannot tell two roots' same-named folders apart; the CLI must therefore accept the path
 * or every first publish and eval from the app fails. The Library roots stay the only place a ref can
 * land: a path that resolves outside them is `undefined` like any unknown name, so publish can never be
 * pointed at an arbitrary folder on disk.
 */
export async function resolveLibrarySkill(home: string, config: Pick<Config, 'placements' | 'projects'>, stateRoot: string, ref: string): Promise<LibrarySkillMatch | undefined> {
  const discovery = await localSkillRoots(home, config.projects ?? []);
  const ledger = await canonicalLedger(config);
  let unusable: LibrarySkillMatch | undefined;
  const wanted = refIsPath(ref) ? expandRefPath(ref, home) : undefined;
  const wantedCanonical = wanted === undefined ? undefined : await canonicalParentPath(wanted);
  const inventories = await Promise.all(discovery.roots.map(root => localSkills(root.root, config, { scope: root.scope, stateRoot, ledger })));
  for (const [index, root] of discovery.roots.entries()) {
    const inventory = inventories[index]!;
    const realRoot = wanted === undefined ? undefined : await realpath(root.root).then((value) => value, () => undefined);
    const isWanted = (candidate: LocalEntry) => wanted === undefined
      ? candidate.name === ref
      : resolve(candidate.path) === wanted || (wantedCanonical !== undefined && realRoot !== undefined && join(realRoot, candidate.name) === wantedCanonical);
    // Deliberately NOT `candidatesOf`: that filter answers "what may the picker offer to connect",
    // which excludes an already-placed folder and a privileged one. This answers "which folder does
    // this ref mean" — and an installed skill the user then edited is the commonest thing both
    // `publish` and `eval` are pointed at. Telling them no such folder exists when it is plainly
    // there is the opposite of "you can always see exactly what's on each"; the privilege and
    // hygiene gates still fire afterwards, with a message that says what is actually wrong.
    const entry = inventory.entries.find(isWanted);
    if (!entry) continue;
    const match = { name: entry.name, path: entry.path, libraryRoot: root.root, inspection: entry.inspection };
    if (entry.inspection.kind === 'candidate') return match;
    unusable ??= match;
  }
  return unusable;
}

/**
 * D72: the sentence `eval` and `publish` refuse with when the folder the ref resolved to is not usable
 * — its PATH and the scan's own detail, so the user is told what is wrong with the folder they named
 * rather than that it is missing. Undefined for a candidate; §6.3's miss message stays reserved for a
 * name no Library root holds at all.
 */
export function unusableSkillFolder(match: LibrarySkillMatch): string | undefined {
  if (match.inspection.kind === 'rejected') return `${match.path} is not a usable skill folder: ${match.inspection.detail}`;
  if (match.inspection.kind === 'failed') return `${match.path} could not be read as a skill folder: ${match.inspection.reason}`;
  return undefined;
}

/**
 * eval only: the scan's verdict on a resolved folder, with Claude Code's own skill fields accepted
 * (`CLAUDE_CODE_SKILL_FIELDS`). The scan stays strict because it answers "can this be shared" (§5.3),
 * and `ls`, the desktop and publish keep reading it as it is. eval measures a skill as Claude Code
 * runs it, so a folder the scan rejected ONLY for an unsupported top-level field is read again from
 * its SKILL.md with those fields accepted, and the checks the scan stopped before (the grant, nested
 * symlinks) run here. The result is what the scan would have said had it accepted them: a candidate,
 * or the next thing wrong, such as `hooks` or an unknown key, named by `evalFieldRefusal`. Every
 * other verdict comes back untouched, so `unusableSkillFolder` words every refusal as before.
 */
export async function admitForEval(match: LibrarySkillMatch): Promise<LibrarySkillMatch> {
  if (match.inspection.kind !== 'rejected' || match.inspection.reason !== 'unsupported-field') return match;
  let inspection: Inspection;
  try {
    // No folder name: the scan's rejection came after its name checks, so they already passed, and
    // HYG1 holds `name` to the folder again before anything is paid for.
    const source = inspectSkillSource(await readFile(join(match.path, 'SKILL.md'), 'utf8'), undefined, { claudeCodeFields: true });
    if (!source.ok) inspection = { kind: 'rejected', reason: source.reason, detail: source.detail, ...(source.description === undefined ? {} : { description: source.description }) };
    else {
      const scan = await scanSkillFolder(match.path);
      inspection = scan.symlink ? { kind: 'rejected', reason: 'nested-symlink', detail: `contains symlink ${scan.symlink}` } : { kind: 'candidate', description: source.description, privileged: scan.privileged };
    }
  } catch (error) { inspection = { kind: 'failed', reason: error instanceof Error ? error.message : String(error) }; }
  return { ...match, inspection };
}
