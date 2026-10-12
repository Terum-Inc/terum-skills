import { createHash } from 'node:crypto';
import { basename, dirname, relative, sep } from 'node:path';
import { inspect } from 'node:util';
import { z } from 'zod';
import YAML from 'yaml';
import { VERSION_FOLDER } from './versions.js';

/** §5.4: GitHub's own syntax — 1–39 chars, ASCII alphanumerics and single internal hyphens, stored lowercased. */
export const HANDLE_RULE = 'a handle is 1-39 characters: letters, digits, and single internal hyphens (stored lowercase)';
export const handleSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.string().min(1).max(39).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, HANDLE_RULE));

/** Team names double as directory names under ~/.terum/skills/teams and as GitHub repo names. */
export const TEAM_NAME_RULE = 'a team name is 1-100 characters: letters, digits, dot, underscore, or hyphen, and cannot start with a dot';
export const teamNameSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/, TEAM_NAME_RULE);

/**
 * A project name is display text, not a path: it appears on cards, in `people[].projects`, and after
 * `--project`. Spaces are admitted because these are human labels. Stored as typed; collisions are
 * checked case-insensitively by `project create`, because every reader matches exactly
 * (`Object.hasOwn(team.projects, name)`), so `Payments` and `payments` would be two cards nobody
 * could tell apart whose endorsements land in different lists.
 */
export const PROJECT_NAME_RULE = 'a project name is 1-64 characters: letters, digits, spaces, dot, underscore, or hyphen, and cannot start with a dot or a space';
export const projectNameSchema = z.string().trim().pipe(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/, PROJECT_NAME_RULE));

/** §5.3: a skill name is its folder name — 1–64 lowercase alphanumerics or single internal hyphens. The one rule `connect` enforces and the README trusts. */
export const SKILL_NAME_RULE = 'a skill name is 1–64 lowercase alphanumerics or single hyphens';
export function isSkillName(value: string): boolean { return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 64; }

export const skillIdSchema = z.uuid();
export const emailSchema = z.email();
/** GitHub login syntax, used wherever a value becomes part of a GitHub API path. */
export const githubLoginSchema = z.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/, 'a GitHub login is 1-39 letters, digits, or single internal hyphens, written without a leading @');

export const scopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('global') }).passthrough(),
  z.object({ kind: z.literal('project'), project: z.string().min(1) }).passthrough(),
]);
export function sameScope(a: unknown, b: unknown): boolean {
  const left = scopeSchema.safeParse(a); const right = scopeSchema.safeParse(b);
  if (!left.success || !right.success || left.data.kind !== right.data.kind) return false;
  return left.data.kind === 'global' || left.data.project === (right.data as { kind: 'project'; project: string }).project;
}

/**
 * §3.4 — a persisted version is the string `"v3"`, or `null`. One type in all five declarations.
 *
 * **The 40-hex arm is retained READ-ONLY.** Nothing new ever writes it; it is what keeps §6.1's "no
 * historical receipt becomes unparseable" true. Without it the retype would reject every receipt and
 * every placement ever written — and because `configSchema` is parsed on the first read of *every*
 * verb and `ConfigStore.read()` re-throws anything that is not ENOENT, that would brick every machine
 * that has ever installed a skill, `sync --hook` included. A reader renders it as "a version recorded
 * before versioning".
 *
 * A string over an integer because it round-trips unchanged through JSON, a git path segment, a CLI
 * ref and a URL with no formatting decision at any boundary.
 */
export const LEGACY_TREE_HASH = /^[0-9a-f]{40}$/;
export const persistedVersionSchema = z.union([z.string().regex(VERSION_FOLDER), z.string().regex(LEGACY_TREE_HASH), z.null()]);

/**
 * A refinement, deliberately NOT `z.literal(3)`: a bare literal produces an unreadable zod dump on the
 * very file that would otherwise tell the user what to do about it.
 */
const layoutVersionSchema = z.number().refine((value) => value === 3, {
  message: 'this team repository uses an older layout; an admin should run `team migrate` to upgrade it',
});

export const installedSchema = z.object({
  id: skillIdSchema,
  version: persistedVersionSchema,
  scope: scopeSchema,
  since: z.string(),
}).passthrough();

export const teamSchema = z.object({
  layout_version: layoutVersionSchema,
  name: z.string().min(1),
  categories: z.array(z.string()),
  projects: z.record(z.string(), z.object({ remotes: z.array(z.string()), skills: z.array(skillIdSchema) }).passthrough()),
  archived: z.array(handleSchema),
  policy: z.object({ skill_license: z.string().min(1) }).passthrough(),
}).passthrough();
export type Team = z.infer<typeof teamSchema>;

/**
 * The lenient sibling, for the two callers that must read a **layout-2** `team.json`: `team migrate`
 * and §13.1's layout precondition. The strict schema above rejects its own input there — it would
 * refuse the very file the migration exists to rewrite.
 *
 * Exactly two callers. Anything else reads `teamSchema`.
 */
export const anyLayoutTeamSchema = teamSchema.extend({
  layout_version: z.union([z.literal(2), z.literal(3)]),
  global: z.array(skillIdSchema).optional(),
  policy: z.object({ publish: z.enum(['pr', 'push']).optional(), skill_license: z.string().min(1) }).passthrough(),
});
export type AnyLayoutTeam = z.infer<typeof anyLayoutTeamSchema>;

export const personSchema = z.object({
  handle: handleSchema,
  display_name: z.string().min(1),
  email: emailSchema,
  // Optional: a generic-git member may have no GitHub account, and an empty value is never identity
  // evidence (§5.4 reclaim). When present it is a real login, because `team remove` puts it in a REST path.
  github: z.union([z.literal(''), githubLoginSchema]),
  bio: z.string(),
  role: z.string().max(32).optional(),
  installed: z.array(installedSchema),
  /**
   * §3.5 — curated, and deliberately NOT `installed[]`. `installed[]` is automatic and means *a copy
   * is on a machine*; this means *I stand behind this*. Written only on an explicit yes at publish or
   * install, and by `profile --add/--remove`. One entry per id: a re-add updates in place.
   *
   * Optional so every people file written before it shipped still parses.
   */
  profile: z.array(z.object({ id: skillIdSchema, name: z.string().min(1), version: z.string().regex(VERSION_FOLDER), added: z.string(), via: z.enum(['publish', 'install']) }).passthrough()).optional(),
  /** Retained so existing files parse, but no longer written: its only job was suppressing the endorsement-driven auto-install §12 deletes. */
  declined: z.array(skillIdSchema).optional(),
  projects: z.array(z.string().min(1)).optional(),
  /**
   * How many skill folders this person's machine holds across the global root and its registered
   * project checkouts, as the last `sync` from that machine counted them (`librarySize`). It is a
   * self-report, not an audit: nothing in the repository can verify it, a person who has not synced
   * since it shipped has no value at all (absent, never 0), and a person who syncs two machines
   * against one team records whichever synced last. It carries no timestamp on purpose — the last
   * commit to this file already dates it, and a stamp rewritten on every sync would commit for no
   * reason. Optional forever: a reader must render "no answer", never a zero.
   */
  local_skills: z.number().int().nonnegative().optional(),
}).passthrough();
export type Person = z.infer<typeof personSchema>;

/**
 * §5.4 per-team entry (rev 9). `handle` is the binding identity: only `team create`/`team join`
 * write an entry, after proving the handle against the roster, so it is never null. There is no
 * token field (Decision 2).
 */
const teamConfigSchema = z.object({ remote: z.string().min(1), handle: handleSchema }).passthrough();
export type TeamConfig = z.infer<typeof teamConfigSchema>;
/**
 * Migration on read (rev 9). The previous build's `login --team --remote` wrote entries with
 * `handle: null` and possibly a `token`; neither can exist now, and a hard parse failure here
 * would brick every verb, including the `sync --hook` on session start and the `team join` that
 * would repair it. A handle-less entry has nothing worth keeping (only create/join may bind a
 * team), so it is dropped; a retired `token` key is dropped from every entry. The next
 * `update()` writes the file without them.
 */
const teamsSchema = z.preprocess((value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([name, entry]) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [[name, entry]];
    const kept: Record<string, unknown> = { ...(entry as Record<string, unknown>) };
    delete kept.token;
    return kept.handle === null || kept.handle === undefined ? [] : [[name, kept]];
  }));
}, z.record(z.string(), teamConfigSchema));
/** Machine-wide: whether this person opted into the desktop app (decision walk D4, 2026-09-08). Absent = never asked. */
export const appChoiceSchema = z.object({ choice: z.enum(['opted-in', 'declined']), at: z.string() }).passthrough();
export const destinationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('global') }),
  z.object({ kind: z.literal('checkout'), root: z.string().min(1) }),
]);
export type Destination = z.infer<typeof destinationSchema>;

/**
 * §3.6 L-PROJ: a project root the user explicitly added to their Library. A bare path cannot carry a
 * name the user reads, and the Library renders these as first-class named things, so a `label` rides
 * alongside the root.
 */
export const libraryProjectSchema = z.object({
  root: z.string().min(1),
  label: z.string().min(1),
  /** Absent on entries migrated from `checkouts`: that shape never recorded when a root was added, and inventing a date would put a false fact on the Library. */
  added_at: z.string().optional(),
  /**
   * Present when the person chose the label (`project rename`). A derived label is recomputed on every
   * add so the set stays readable; a chosen one is kept as typed, and the derived labels move out of
   * its way instead.
   */
  renamed_at: z.string().optional(),
}).passthrough();
export type LibraryProject = z.infer<typeof libraryProjectSchema>;

/** `project rename`: display text for one Library row. `Global` is the global root's own name in every list that also shows projects. */
export const LIBRARY_PROJECT_LABEL_RULE = 'a project name is 1-64 characters and is not Global';
export function isLibraryProjectLabel(value: string): boolean {
  return value.trim() === value && value.length >= 1 && value.length <= 64 && value.toLowerCase() !== 'global';
}

/** True when `path` sits strictly inside `root`: the boundary separator is required, so `/repo-two` is not inside `/repo`, and a root is never inside itself. */
export function insideRoot(path: string, root: string): boolean {
  return path !== root && path.startsWith(root.endsWith(sep) ? root : root + sep);
}

/**
 * Sub-projects: a Library project whose root sits inside another registered project's root is that
 * project's sub-project. The tree is read off the paths every time and never stored, so it cannot
 * disagree with the folder structure on disk. Positional — `projectParents(roots)[i]` is the root of
 * `roots[i]`'s nearest registered ancestor, or undefined for a top-level project.
 */
export function projectParents(roots: readonly string[]): (string | undefined)[] {
  return roots.map((root) => {
    let parent: string | undefined;
    for (const candidate of roots) if (insideRoot(root, candidate) && (parent === undefined || candidate.length > parent.length)) parent = candidate;
    return parent;
  });
}

/**
 * Depth-first over the project tree: each top-level item in the order given, followed by its
 * sub-projects, recursively. Every list that shows projects (`project list`, `ls --local`, the app's
 * sidebar) is drawn in this order, so a sub-project always sits under its parent.
 */
export function orderByProjectTree<T>(items: readonly T[], key: (item: T) => string, parent: (item: T) => string | undefined): { item: T; depth: number }[] {
  const ordered: { item: T; depth: number }[] = [];
  const visit = (of: string | undefined, depth: number): void => {
    for (const item of items) if (parent(item) === of) { ordered.push({ item, depth }); visit(key(item), depth + 1); }
  };
  visit(undefined, 0);
  // An item whose parent is not in the list (a caller passed a partial set) is still drawn, at the top level.
  for (const item of items) if (!ordered.some((entry) => entry.item === item)) ordered.push({ item, depth: 0 });
  return ordered;
}

/** What `libraryProjectLabels` reads: the root, and the label only when it was chosen (`renamed_at`). */
export interface LabelledProject { root: string; label?: string; renamed_at?: string }

/**
 * §3.6's label rule, applied to the whole set rather than to one new entry, so it is the set that
 * stays readable: adding `/b/web` relabels an existing `/a/web` too, because two Library rows
 * reading `web` would defeat "you can always see exactly what's on each". Positional —
 * `libraryProjectLabels(projects)[i]` labels `projects[i]`.
 *
 * A top-level project is its folder's name; a sub-project is its path relative to the parent project
 * (`packages/api`), which is what "matching the file structure" means on a card. A collision
 * (compared without case, the way a person reads two rows) is qualified by the folder above a
 * top-level root and by the parent project's name for a sub-project, and by the whole root when
 * even that collides. A chosen label (`renamed_at`) is kept exactly as typed and reserved: a derived
 * label that would read the same is the one that moves.
 */
export function libraryProjectLabels(projects: readonly LabelledProject[]): string[] {
  const roots = projects.map((project) => project.root);
  const parents = projectParents(roots);
  const chosen = projects.map((project) => project.renamed_at !== undefined && project.label ? project.label : undefined);
  const fold = (name: string): string => name.toLowerCase();
  const tally = (names: readonly string[]): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const name of names) counts.set(fold(name), (counts.get(fold(name)) ?? 0) + 1);
    return counts;
  };
  const base = (index: number): string => {
    const parent = parents[index];
    return parent === undefined ? basename(roots[index]!) || roots[index]! : relative(parent, roots[index]!);
  };
  const bases = roots.map((_, index) => chosen[index] ?? base(index));
  const byBase = tally(bases);
  const qualified = roots.map((root, index) => {
    if (chosen[index] !== undefined || byBase.get(fold(bases[index]!)) === 1) return bases[index]!;
    const parent = parents[index];
    const by = parent === undefined ? basename(dirname(root)) || dirname(root) : base(roots.indexOf(parent));
    return `${bases[index]} (${by})`;
  });
  const byQualified = tally(qualified);
  return roots.map((root, index) => chosen[index] === undefined && byQualified.get(fold(qualified[index]!))! > 1 ? root : qualified[index]!);
}

/** The label rule over bare roots: what the `checkouts` migration below has, since that shape carried no labels to keep. */
export function projectLabels(roots: readonly string[]): string[] {
  return libraryProjectLabels(roots.map((root) => ({ root })));
}

export const configSchema = z.object({
  projects: z.array(libraryProjectSchema).optional(),
  app: appChoiceSchema.optional(),
  default_handle: handleSchema.optional(),
  email: emailSchema.optional(),
  display_name: z.string().min(1).optional(),
  github: z.string().optional(),
  teams: teamsSchema,
  approvals: z.record(z.string(), z.object({ grants: z.string(), approved_at: z.string() }).passthrough()),
  pending: z.array(z.object({ op: z.enum(['install', 'uninstall']), id: skillIdSchema, team: z.string(), scope: scopeSchema, destination: destinationSchema.optional(), started: z.string() }).passthrough()),
  placements: z.record(z.string(), z.object({ id: skillIdSchema, team: z.string(), version: persistedVersionSchema, scope: scopeSchema, placed_at: z.string(), fingerprint: z.string() }).passthrough()),
}).passthrough();
export type Config = z.infer<typeof configSchema>;

/**
 * The on-disk config, migrated on read. Scoped deliberately to this schema and nothing else: §3.4's
 * claim that `personSchema` shares it was wrong (OF-4) — `personSchema` is team state and is never
 * parsed through here.
 *
 * `checkouts: string[]` becomes `projects: LibraryProject[]` when `projects` is absent, and
 * `checkouts` is stripped either way. Stripping it before `read()` returns is what keeps `before`
 * from carrying it, so `patchConfig`'s delete-throw cannot fire; the stale bytes stay inert on disk
 * until the next write rewrites the file.
 */
export const configFileSchema = z.preprocess((value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  let source = value as Record<string, unknown>;
  if ('checkouts' in source) {
    const { checkouts, ...rest } = source;
    source = rest;
    if (rest['projects'] === undefined && Array.isArray(checkouts)) {
      const roots = checkouts.filter((root): root is string => typeof root === 'string' && root.length > 0);
      const labels = projectLabels(roots);
      source = { ...rest, projects: roots.map((root, index) => ({ root, label: labels[index]! })) };
    }
  }
  return { ...source, placements: migratePlacements(source['placements']), pending: migratePending(source['pending']) };
}, configSchema);

/** A 40-hex tree hash is not a version under layout 3; it means "placed before versioning" (§3.4). */
function migrateVersion(entry: Record<string, unknown>): Record<string, unknown> {
  const version = entry['version'];
  return typeof version === 'string' && LEGACY_TREE_HASH.test(version) ? { ...entry, version: null } : entry;
}

/**
 * There is no reserved project name any more: a skill reaches the team by being published to the
 * marketplace, and `projects` is an optional membership list. A stored scope naming a project is
 * display text — nothing normalizes it, because nothing depends on its spelling.
 */
function migrateEntry(entry: unknown): unknown {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
  return migrateVersion(entry as Record<string, unknown>);
}

function migratePlacements(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([path, entry]) => [path, migrateEntry(entry)]));
}

function migratePending(value: unknown): unknown {
  return Array.isArray(value) ? value.map(migrateEntry) : value;
}

export const emptyConfig = (): Config => ({ teams: {}, approvals: {}, pending: [], placements: {} });

/** §5.3: only Agent-Skills-legal top-level keys; everything custom nests under `metadata`. */
export const skillFrontmatterSchema = z.object({
  name: z.string(),
  description: z.string(),
  license: z.string(),
  metadata: z.object({ id: skillIdSchema, author: z.string(), 'terum-category': z.string() }).passthrough(),
  'allowed-tools': z.unknown().optional(),
}).strict();
export type SkillFrontmatter = z.infer<typeof skillFrontmatterSchema>;

/**
 * §6.3 — the same schema with the four MANAGED fields optional. `license` and the three
 * `metadata.*` fields are written by publish's injection (§5.1 step 4); a folder that has never been
 * published carries none of them, and `eval` reads the folder exactly as it is on disk. Still
 * `.strict()`: an unknown top-level key is as wrong locally as it is in the repo.
 */
export const localSkillFrontmatterSchema = z.object({
  name: z.string(),
  description: z.string(),
  license: z.string().optional(),
  metadata: z.object({ id: skillIdSchema.optional(), author: z.string().optional(), 'terum-category': z.string().optional() }).passthrough().optional(),
  'allowed-tools': z.unknown().optional(),
}).strict();

/** §5.3: the only top-level keys a skill may carry outside `eval`, in the order every refusal lists them. */
export const AGENT_SKILLS_FIELDS = ['name', 'description', 'license', 'metadata', 'allowed-tools'] as const;

/**
 * Claude Code's documented skill frontmatter fields that execute nothing on the host (the Claude
 * Code skills docs, frontmatter reference). `eval` alone accepts them at the top level. It measures a
 * skill as Claude Code runs it, and a field such as `model: haiku` is part of what it measures:
 * moving it under `metadata` to pass §5.3 would change the run. Publishing stays strict, so a
 * published skill stays portable to every Agent Skills host.
 *
 * `hooks` is left out on purpose. Claude Code registers a skill's hooks as commands that run on the
 * host for the rest of the session, so eval keeps refusing it and says why (`HOOKS_REFUSAL`).
 */
export const CLAUDE_CODE_SKILL_FIELDS = ['model', 'effort', 'context', 'agent', 'background', 'disallowed-tools', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable', 'when_to_use'] as const;

/** Why eval refuses `hooks`, said once for the folder refusal and for HYG1. */
export const HOOKS_REFUSAL = 'hooks register commands that run on this machine, so eval does not run a skill that declares them';

/** The folder refusal for a top-level key eval does not accept: `hooks` says why, any other key lists what eval accepts. */
export function evalFieldRefusal(key: string): string {
  return key === 'hooks'
    ? `unsupported top-level field hooks (${HOOKS_REFUSAL})`
    : `unsupported top-level field ${key} (eval accepts ${[...AGENT_SKILLS_FIELDS, ...CLAUDE_CODE_SKILL_FIELDS].join(', ')})`;
}

/**
 * eval only: `localSkillFrontmatterSchema` plus `CLAUDE_CODE_SKILL_FIELDS`, each optional. Their values
 * are not validated here: Claude Code owns them, and eval runs the folder as Claude Code would. Still
 * `.strict()`, so `hooks` and every other unknown key are refused.
 */
export const evalSkillFrontmatterSchema = localSkillFrontmatterSchema.extend(
  Object.fromEntries(CLAUDE_CODE_SKILL_FIELDS.map((field) => [field, z.unknown().optional()])) as Record<(typeof CLAUDE_CODE_SKILL_FIELDS)[number], z.ZodOptional<z.ZodUnknown>>,
).strict();

export type AllowedTools = { ok: true; normalized: string; hash: string } | { ok: false; raw: unknown };

/**
 * §5.4 grant normalization. Absent, or present and empty (`[]`, `""`, or a bare `allowed-tools:`
 * line, which YAML reads as null) ⇒ the literal `none`. A sequence of strings or one
 * comma-separated string normalizes (split, trim, drop empties, de-duplicate, sort, join with
 * `\n`). Anything else is malformed: it never normalizes and never hashes.
 */
export function allowedTools(value: unknown): AllowedTools {
  if (value === undefined || value === null) return hashed('none');
  let pieces: string[];
  if (typeof value === 'string') pieces = value.split(',');
  else if (Array.isArray(value) && value.every((part) => typeof part === 'string')) pieces = value as string[];
  else return { ok: false, raw: value };
  const normalized = [...new Set(pieces.map((part) => part.trim()).filter(Boolean))].sort().join('\n') || 'none';
  return hashed(normalized);
}

/**
 * Render a value that never validated (a malformed `allowed-tools`) without the message itself
 * throwing: JSON when it serializes, util.inspect for what does not (a YAML anchor that refers to
 * itself parses cleanly into a cycle). Every site that shows a rejected grant goes through here.
 */
export function describeRaw(value: unknown): string {
  try { return JSON.stringify(value) ?? String(value); } catch { return inspect(value, { depth: 2, breakLength: Infinity }); }
}

function hashed(normalized: string): AllowedTools & { ok: true } {
  return { ok: true, normalized, hash: `sha256:${createHash('sha256').update(normalized).digest('hex')}` };
}

export const FRONTMATTER = /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** Parse a whole SKILL.md: the YAML block between the first two `---` lines, then the schema. */
export function parseSkillFrontmatter(source: string): { ok: true; data: SkillFrontmatter; grants: AllowedTools; frontmatter: string; body: string } | { ok: false; error: string } {
  const match = FRONTMATTER.exec(source);
  if (!match) return { ok: false, error: 'SKILL.md has no YAML frontmatter' };
  const document = YAML.parseDocument(match[1]!);
  if (document.errors.length > 0) return { ok: false, error: document.errors.map((error) => error.message).join('; ') };
  const raw = document.toJS() as unknown;
  const parsed = skillFrontmatterSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  return { ok: true, data: parsed.data, grants: allowedTools(parsed.data['allowed-tools']), frontmatter: match[0].replace(/\r?\n$/, ''), body: source.slice(match[0].length) };
}

/** Human-readable zod issues: `field: message; field2: message`. */
export function describeIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.length ? issue.path.join('.') + ': ' : ''}${issue.message}`).join('; ');
}

export function parseJson<T>(schema: z.ZodType<T>, value: string, path: string): T {
  let raw: unknown;
  try { raw = JSON.parse(value); } catch (error) { throw new Error(`Invalid ${path}: ${error instanceof Error ? error.message : String(error)}`); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error(`Invalid ${path}: ${describeIssues(parsed.error)}`);
  return parsed.data;
}

/** `schema.parse` with the rule text instead of a JSON issue dump. */
export function parseOrExplain<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid ${what}: ${describeIssues(parsed.error)}`);
  return parsed.data;
}
