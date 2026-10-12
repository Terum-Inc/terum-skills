import { realpathSync } from 'node:fs';
import { lstat, readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import YAML from 'yaml';
import { AGENT_SKILLS_FIELDS, allowedTools, CLAUDE_CODE_SKILL_FIELDS, describeRaw, evalFieldRefusal, FRONTMATTER, isSkillName, skillIdSchema } from './schema.js';
import { ignoredByDigest } from './skills.js';
import { isManagedFrontmatter } from './wrapper.js';

export { FRONTMATTER } from './schema.js';
export type SourceProblem = 'symlink' | 'not-a-directory' | 'skill-md-missing' | 'skill-md-not-a-file' | 'no-frontmatter' | 'invalid-yaml' | 'illegal-name' | 'name-mismatch' | 'description-missing' | 'unsupported-field' | 'malformed-allowed-tools' | 'nested-symlink' | 'inside-state-root' | 'managed-wrapper';
type SourceInspection = { ok: true; description: string; category?: string; id: string | null } | { ok: false; reason: SourceProblem; detail: string; description?: string; category?: string };

/** Terminal rendering only: filesystem paths and ledger values retain their original bytes. */
export function printable(value: string): string { return value.replace(/\p{Cc}/gu, '?'); }

/** State is recovery data, never an authoring source (including through a root alias). */
export function assertNotInsideStateRoot(source: string, stateRoot: string): void {
  let canonicalSource = resolve(source); let canonicalState = resolve(stateRoot);
  try { canonicalSource = realpathSync(source); } catch { /* Retain lexical evidence. */ }
  try { canonicalState = realpathSync(stateRoot); } catch { /* Retain lexical evidence. */ }
  if (canonicalSource === canonicalState || canonicalSource.startsWith(canonicalState.endsWith(sep) ? canonicalState : `${canonicalState}${sep}`)) {
    throw new Error(`${source} is inside the terum-skills state directory ${stateRoot}; move the folder elsewhere and connect that path.`);
  }
}

/**
 * A tracked source may have been relocated; only initial imports enforce the folder's name.
 * `claudeCodeFields` is eval's reading alone: it also accepts `CLAUDE_CODE_SKILL_FIELDS` at the top
 * level. The Library scan, connect and `skill fix` never pass it.
 */
export function inspectSkillSource(raw: string, folderName?: string, options: { claudeCodeFields?: boolean } = {}): SourceInspection {
  const result = inspect(raw, folderName, options.claudeCodeFields === true);
  if (result.ok) return result;
  return { ok: false, reason: result.reason, detail: result.detail, ...(result.description === undefined ? {} : { description: result.description }), ...(result.category === undefined ? {} : { category: result.category }) };
}

/** Connect keeps its established refusal messages; discovery exposes the more precise reason. */
export function assertSkillSource(raw: string, folderName: string): string {
  const result = inspect(raw, folderName);
  if (!result.ok) throw new Error(result.reason === 'unsupported-field' ? printable(result.shareMessage) : result.shareMessage);
  return result.description;
}

function inspect(raw: string, folderName?: string, claudeCodeFields = false): { ok: true; description: string; category?: string; id: string | null } | { ok: false; reason: SourceProblem; detail: string; description?: string; category?: string; shareMessage: string } {
  // Refusing to connect a folder is not a failure to read it. Every rejection raised after the
  // frontmatter parses carries the description and category it found, so the Library can describe a folder it
  // will never offer; a rejection raised before the parse has nothing to carry and stays bare.
  let described: string | undefined; let category: string | undefined;
  const reject = (reason: SourceProblem, detail: string, shareMessage = detail) => ({ ok: false as const, reason, detail, ...(described === undefined ? {} : { description: described }), ...(category === undefined ? {} : { category }), shareMessage });
  if (folderName !== undefined && !isSkillName(folderName)) return reject('illegal-name', 'folder name is not a legal skill name (1–64 lowercase alphanumerics or single hyphens)', `Skill name ${folderName} must be 1–64 lowercase alphanumerics or single hyphens.`);
  const match = FRONTMATTER.exec(raw);
  if (!match) return reject('no-frontmatter', 'SKILL.md has no YAML frontmatter', 'SKILL.md has no YAML frontmatter.');
  let parsed: Record<string, unknown> | null;
  try { parsed = YAML.parse(match[1]!) as Record<string, unknown> | null; }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return reject('invalid-yaml', `SKILL.md frontmatter is not valid YAML: ${message}`, message);
  }
  if (typeof parsed?.description === 'string') described = parsed.description;
  const metadata = parsed?.metadata as Record<string, unknown> | null | undefined;
  if (typeof metadata?.['terum-category'] === 'string') category = metadata['terum-category'];
  // The terum-skills skills ship inside this package and are placed by setup; none is a team skill,
  // so discovery never offers one and connect refuses it under any folder name.
  if (isManagedFrontmatter(parsed)) return reject('managed-wrapper', 'a terum-skills skill that ships with terum-skills; not a team skill', 'This folder is a terum-skills skill that ships with terum-skills and is placed by setup; it cannot be connected to a team.');
  const legacyNameMessage = `SKILL.md name must equal folder ${folderName} and description is required.`;
  if (folderName !== undefined && parsed?.name !== folderName) return reject('name-mismatch', `SKILL.md name ${String(parsed?.name)} does not equal folder ${folderName}`, legacyNameMessage);
  if (!parsed || typeof parsed.description !== 'string') return reject('description-missing', 'description is missing', legacyNameMessage);
  const accepted: readonly string[] = claudeCodeFields ? [...AGENT_SKILLS_FIELDS, ...CLAUDE_CODE_SKILL_FIELDS] : AGENT_SKILLS_FIELDS;
  for (const key of Object.keys(parsed)) {
    if (!accepted.includes(key)) return reject('unsupported-field', claudeCodeFields ? evalFieldRefusal(key) : `unsupported top-level field ${key} (only ${AGENT_SKILLS_FIELDS.join(', ')})`);
  }
  // Discovery needs a candidate/omission reason. Connect itself deliberately does not call this
  // validator: its assembled post-injection candidate goes through the single HYG1 path instead.
  const grants = allowedTools(parsed['allowed-tools']);
  if (!grants.ok) {
    const line = raw.split(/\r?\n/).findIndex((text) => /^allowed-tools\s*:/.test(text)) + 1;
    return reject('malformed-allowed-tools', `allowed-tools is malformed (SKILL.md line ${line})`, `${folderName}: allowed-tools is malformed${line ? ` (SKILL.md line ${line})` : ''}: ${describeRaw(grants.raw)}. Use a YAML list of tool patterns, or one comma-separated string.`);
  }
  const id = skillIdSchema.safeParse(metadata?.id);
  return { ok: true, description: parsed.description, ...(category === undefined ? {} : { category }), id: id.success ? id.data : null };
}

/** File bytes and the mode facts hygiene needs; callers validate the directory/symlink invariant first. */
export async function sourceFiles(root: string): Promise<{ files: Map<string, Buffer>; executable: Set<string> }> {
  const files = new Map<string, Buffer>(); const executable = new Set<string>();
  async function walk(current: string, relative = ''): Promise<void> {
    // Sorted like `canonicalDigest`'s walker: readdir order is the filesystem's (NTFS alphabetical,
    // ext4 hashed), and hygiene findings are reported in walk order, so an unsorted walk would put
    // the same folder's findings in a different order on every platform.
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const next = join(current, entry.name); const key = relative ? `${relative}/${entry.name}` : entry.name;
      // The same D2 predicate `canonicalDigest`'s walker uses: two walkers over one folder must not
      // produce two digests, or publish could never recognise a byte-identical republish (§3.3).
      if (ignoredByDigest(key)) continue;
      if (entry.isDirectory()) await walk(next, key);
      else if (entry.isFile()) {
        files.set(key, await readFile(next));
        if ((await lstat(next)).mode & 0o111) executable.add(key);
      }
    }
  }
  await walk(root);
  return { files, executable };
}

/** One sequential walk, retaining the first nested link without ever following it. */
export async function scanSkillFolder(path: string): Promise<{ symlink?: string; privileged: boolean }> {
  let details;
  try { details = await stat(path); } catch { throw new Error(`${path} is not a skill folder.`); }
  if (!details.isDirectory()) throw new Error(`${path} is not a skill folder.`);
  const result: { symlink?: string; privileged: boolean } = { privileged: false };
  async function visit(current: string): Promise<void> {
    // Sorted for the same reason as `sourceFiles`: "the first nested link" must be the same link everywhere.
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const next = join(current, entry.name);
      if (entry.isSymbolicLink()) { result.symlink ??= resolve(next); continue; }
      if ((entry.isDirectory() || entry.isFile()) && (entry.name === '.claude-plugin' || /^hooks?$/i.test(entry.name))) result.privileged = true;
      if (entry.isDirectory()) await visit(next);
    }
  }
  await visit(path);
  return result;
}

/** Explicit paths preserve connect's stat-based top-level link policy and refusal text. */
export async function assertSkillDirectory(path: string): Promise<{ privileged: boolean }> {
  const scan = await scanSkillFolder(path);
  if (scan.symlink) throw new Error(`Skill folder contains symlink ${scan.symlink}.`);
  return scan;
}
