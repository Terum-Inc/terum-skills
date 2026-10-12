/** Deterministic, in-memory skill hygiene checks (eval spec §9). */
import YAML from 'yaml';
import { CREDENTIAL_PATTERNS } from './receipt.js';
import { AGENT_SKILLS_FIELDS, allowedTools, CLAUDE_CODE_SKILL_FIELDS, describeRaw, evalSkillFrontmatterSchema, FRONTMATTER, HOOKS_REFUSAL, localSkillFrontmatterSchema, skillFrontmatterSchema } from '../schema.js';

export type HygieneCode = 'HYG1' | 'HYG2' | 'HYG3' | 'HYG4' | 'HYG5' | 'HYG6' | 'HYG7' | 'HYG8';
export interface HygieneFinding { code: HygieneCode; path: string; line?: number; message: string; }
/** §9 rev 16: errors gate (fail-closed); warnings are printed by every caller and gate nothing. */
export interface HygieneAssessment { readonly errors: readonly HygieneFinding[]; readonly warnings: readonly HygieneFinding[]; }
export interface HygieneInput {
  name: string;
  frontmatter: unknown;
  files: Map<string, Buffer>;
  executable: ReadonlySet<string>;
  /** Null when there is no team to conform to: a local eval on a folder belonging to no team (§6.3). */
  policy: { skill_license: string | null };
  /**
   * §6.3 local-eval mode. `eval` never injects managed fields, so the folder it reads legitimately
   * carries no `license` and no `metadata` at all before its first publish. Under this flag HYG1's
   * strict parse treats `license` and the three managed `metadata.*` fields as OPTIONAL — and
   * nothing else changes: no unknown top-level keys, folder name must equal `name`, `allowedTools()`
   * must grant, and every HYG2–HYG6 predicate stays fail-closed. Publish never uses it: publish
   * injects first (§5.1 step 4) and assesses the finished bytes.
   */
  managedFieldsAbsent?: boolean;
  /**
   * eval only, and it implies `managedFieldsAbsent`'s leniency: HYG1 parses with
   * `evalSkillFrontmatterSchema`, which also accepts Claude Code's own skill fields at the top level
   * (`CLAUDE_CODE_SKILL_FIELDS`). eval measures a skill as Claude Code runs it, and a field such as
   * `model` is part of that. `hooks` and every other unknown key stay refused. `skill fix`,
   * `validate` and publish never set it, so what they accept is unchanged.
   */
  claudeCodeFields?: boolean;
  /** Unknown or empty taxonomy means there is nothing to compare against. */
  categories?: readonly string[];
  /** Explicit `--allow-privileged` consent (or content whose repository copy already carries the
   *  consented form): waives HYG4's exec-bit and shebang findings only — the extension allowlist
   *  and every other check still apply (walk D5, Ryan 2026-09-07). */
  allowExecutable?: boolean;
  /** Resolved repository dependencies outside the skill folder, when the caller knows its root. */
  dependencyCount?: number;
}

const ALLOWED_EXTENSIONS = new Set(['.md', '.txt', '.json', '.yaml', '.yml', '.csv', '.toml', '.xml', '.html', '.css', '.js', '.ts', '.py', '.sh', '.sql', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf']);
/** HYG2's invisible set; exported so `skill fix` strips exactly what this check names. */
export const INVISIBLE = /[\u202A-\u202E\u2066-\u2069\u200B-\u200D\u2060\uFEFF]/u;
/** HYG7's sentence, said once: `team.json.categories` is advice, so `skill category` gives the same
 *  guidance for the same value rather than a second wording of the one rule that gates nothing. */
export function offListCategory(category: string, categories: readonly string[]): string {
  return `terum-category \`${category}\` is not one of your team's categories (${categories.join(', ')}). Browse will give it a bucket of its own; add it to team.json or change this line.`;
}
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const SCRIPTS = ['Latin', 'Cyrillic', 'Greek', 'Armenian', 'Hebrew', 'Arabic', 'Syriac', 'Thaana', 'Devanagari', 'Bengali', 'Gurmukhi', 'Gujarati', 'Oriya', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Sinhala', 'Thai', 'Lao', 'Tibetan', 'Myanmar', 'Georgian', 'Hangul', 'Ethiopic', 'Cherokee', 'Canadian_Aboriginal', 'Ogham', 'Runic', 'Khmer', 'Mongolian', 'Hiragana', 'Katakana', 'Bopomofo', 'Han', 'Yi', 'Old_Italic', 'Gothic', 'Deseret', 'Inherited', 'Common'] as const;
const SCRIPT_PATTERNS = SCRIPTS.map((script) => [script, new RegExp(`^\\p{Script=${script}}$`, 'u')] as const);

/** Parse the YAML portion without validating it, so HYG1 owns the strict-schema decision. */
export function hygieneFrontmatter(source: Buffer): unknown {
  const text = decodeText(source);
  if (text === undefined) return undefined;
  const match = FRONTMATTER.exec(text);
  if (!match) return undefined;
  try { return YAML.parse(match[1]!); } catch { return undefined; }
}

/** The §9 pure API: callers supply file bytes and observed executable bits. */
export function inspectHygiene(input: HygieneInput): HygieneAssessment {
  const errors: HygieneFinding[] = [];
  const warnings: HygieneFinding[] = [];
  const skill = input.files.get('SKILL.md');
  const parsed = (input.claudeCodeFields ? evalSkillFrontmatterSchema : input.managedFieldsAbsent ? localSkillFrontmatterSchema : skillFrontmatterSchema).safeParse(input.frontmatter);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue !== undefined && issue.path.length ? `field ${issue.path.join('.')}` : 'frontmatter';
    const accepted = input.claudeCodeFields ? [...AGENT_SKILLS_FIELDS, ...CLAUDE_CODE_SKILL_FIELDS] : AGENT_SKILLS_FIELDS;
    const hooks = input.claudeCodeFields && issue?.code === 'unrecognized_keys' && issue.keys.includes('hooks') ? ` The field hooks is refused: ${HOOKS_REFUSAL}.` : '';
    errors.push({ code: 'HYG1', path: 'SKILL.md', message: `SKILL.md ${where} is invalid${issue === undefined ? '' : `: ${issue.message}`} (allowed top-level fields: ${accepted.join(', ')}).${hooks}` });
  } else if (parsed.data.name !== input.name) {
    errors.push({ code: 'HYG1', path: 'SKILL.md', line: lineOf(skill, /^name\s*:/m), message: `SKILL.md name ${parsed.data.name} does not equal folder ${input.name}.` });
  } else {
    const grants = allowedTools(parsed.data['allowed-tools']);
    if (!grants.ok) {
      const line = lineOf(skill, /^allowed-tools\s*:/m);
      errors.push({ code: 'HYG1', path: 'SKILL.md', ...(line === undefined ? {} : { line }), message: `${input.name}: allowed-tools is malformed${line === undefined ? '' : ` (SKILL.md line ${line})`}: ${describeRaw(grants.raw)}. Use a YAML list of tool patterns, or one comma-separated string.` });
    }
  }

  const category = parsed.success ? parsed.data.metadata?.['terum-category'] : undefined;
  if (input.categories?.length && typeof category === 'string' && category.trim()
    && !input.categories.some(allowed => allowed.toLowerCase() === category.toLowerCase())) {
    const line = lineOf(skill, /^\s*terum-category\s*:/m);
    warnings.push({ code: 'HYG7', path: 'SKILL.md', ...(line === undefined ? {} : { line }), message: offListCategory(category, input.categories) });
  }

  const author = parsed.success ? authorEmail(parsed.data.metadata?.author) : undefined;
  for (const [path, contents] of input.files) {
    const text = decodeText(contents);
    if (text !== undefined) errors.push(...contentFindings(path, text, author));
    const dot = path.lastIndexOf('.');
    const extension = dot <= path.lastIndexOf('/') ? '' : path.slice(dot).toLowerCase();
    const shebang = text?.startsWith('#!') ?? false;
    const executableForm = !input.allowExecutable && (input.executable.has(path) || shebang);
    if (executableForm || !ALLOWED_EXTENSIONS.has(extension)) {
      errors.push({ code: 'HYG4', path, message: executableForm ? (input.executable.has(path) ? 'File has an executable mode.' : 'File begins with a shebang.') : `File extension ${extension || '(none)'} is not allowlisted.` });
    }
  }

  if (parsed.success) {
    // An absent declared license (§6.3 local mode) and an absent team policy are each "nothing to
    // conform to", never a mismatch; every license actually present must still agree.
    const licenses = [parsed.data.license, input.policy.skill_license].filter((value): value is string => typeof value === 'string').map(normalizeLicense);
    for (const [path, contents] of input.files) if (/^LICENSE[^/]*$/i.test(path)) {
      const text = decodeText(contents);
      const detected = text === undefined ? undefined : detectLicense(text);
      if (detected !== undefined) licenses.push(detected);
    }
    if (new Set(licenses).size > 1) errors.push({ code: 'HYG5', path: 'SKILL.md', line: lineOf(skill, /^license\s*:/m), message: 'Frontmatter, team policy, and bundled LICENSE files must declare the same license.' });
  }
  const skillText = skill === undefined ? undefined : decodeText(skill);
  // String.prototype.length counts UTF-16 code units, not code points or UTF-8 bytes.
  const length = skillText?.length ?? 0;
  if (length > 20_000) warnings.push({ code: 'HYG6', path: 'SKILL.md', message: `SKILL.md is ${thousands(length)} characters, ${thousands(length - 20_000)} over the 20,000-character guideline (~5k tokens). Size alone does not block this operation; loading this skill uses that much more context.` });
  const description = parsed.success ? parsed.data.description : recordValue(input.frontmatter, 'description');
  if (typeof description !== 'string' || !description.trim()) errors.push({ code: 'HYG6', path: 'SKILL.md', line: lineOf(skill, /^description\s*:/m), message: 'description must not be empty.' });
  if ((input.dependencyCount ?? 0) > 0) warnings.push({ code: 'HYG8', path: 'SKILL.md', message: `this skill references ${input.dependencyCount} repository paths outside its folder; it depends on files it does not carry` });
  return { errors, warnings };
}

/**
 * HYG2/HYG3 over one decoded text file. The only predicates that apply to arbitrary bytes rather
 * than to a whole skill folder, so they are also what `inspectContent` runs over material that is
 * not a skill yet (generated eval assets).
 */
function contentFindings(path: string, text: string, author: string | undefined): HygieneFinding[] {
  const findings: HygieneFinding[] = [];
  const invisible = INVISIBLE.exec(text);
  const mixed = invisible ? undefined : mixedScriptOffset(text);
  if (invisible || mixed !== undefined) {
    const offset = invisible?.index ?? mixed!;
    findings.push({ code: 'HYG2', path, line: lineAt(text, offset), message: invisible ? 'Contains a bidi control or zero-width character.' : 'Contains a whitespace-delimited token that mixes Unicode scripts.' });
  }
  const credential = credentialOffset(text);
  const foreignEmail = credential === undefined ? emailOffset(text, author) : undefined;
  if (credential !== undefined || foreignEmail !== undefined) {
    const offset = credential ?? foreignEmail!.index;
    findings.push({ code: 'HYG3', path, line: lineAt(text, offset), message: credential !== undefined ? 'Contains a credential-shaped value.' : foreignEmailMessage(foreignEmail!.email, author) });
  }
  return findings;
}

/**
 * The content-only gate for bytes that are NOT a skill folder — model-generated eval assets on
 * their way into the user's skill, which have no frontmatter of their own and so cannot be run
 * through `inspectHygiene` (HYG1/HYG5/HYG6 would all fire on the absent SKILL.md). Same HYG2/HYG3
 * predicates, same author exemption, so what the generator writes is judged by the rule the next
 * `validate`/`publish`/`eval` will judge it by. Without this the write-back plants a hygiene
 * failure that only surfaces on a LATER command, because the folder gate above already ran.
 */
/**
 * The address HYG3 exempts, read straight from the folder's own frontmatter rather than the strict
 * schema — a local, never-published folder legitimately carries no managed fields (§6.3), and the
 * exemption has to work there too. Undefined means nothing is exempt, which is what HYG3 already does.
 */
export function exemptAuthorEmail(skill: Buffer | undefined): string | undefined {
  if (skill === undefined) return undefined;
  const author = recordValue(recordValue(hygieneFrontmatter(skill), 'metadata'), 'author');
  return typeof author === 'string' ? authorEmail(author) : undefined;
}

export function inspectContent(files: Map<string, Buffer>, author: string | undefined): HygieneFinding[] {
  const findings: HygieneFinding[] = [];
  for (const [path, contents] of files) {
    const text = decodeText(contents);
    if (text !== undefined) findings.push(...contentFindings(path, text, author));
  }
  return findings;
}

export function formatHygieneFindings(findings: readonly HygieneFinding[]): string {
  return findings.map((finding) => `${finding.code} ${finding.path}${finding.line === undefined ? '' : `:${finding.line}`}: ${finding.message}`).join('\n');
}

export function formatHygieneWarnings(findings: readonly HygieneFinding[]): string {
  return findings.map((finding) => `warning ${formatHygieneFindings([finding])}`).join('\n');
}

/** A refusal retains warnings so callers can report them before the errors. */
export class HygieneRefused extends Error {
  readonly assessment: HygieneAssessment;
  constructor(assessment: HygieneAssessment) {
    super(formatHygieneFindings(assessment.errors));
    this.name = 'HygieneRefused';
    this.assessment = assessment;
  }
}

/** The single pure gate shared by every hygiene caller. `options.claudeCodeFields` is eval's alone (`HygieneInput.claudeCodeFields`). */
export function assessHygiene(name: string, input: { files: Map<string, Buffer>; executable: ReadonlySet<string> }, license: string | null, allowExecutable = false, managedFieldsAbsent = false, categories?: readonly string[], dependencyCount?: number, options: { claudeCodeFields?: boolean } = {}): HygieneAssessment {
  const skill = input.files.get('SKILL.md');
  const assessment = inspectHygiene({ name, frontmatter: skill === undefined ? undefined : hygieneFrontmatter(skill), files: input.files, executable: input.executable, policy: { skill_license: license }, allowExecutable, managedFieldsAbsent, categories, dependencyCount, claudeCodeFields: options.claudeCodeFields === true });
  if (assessment.errors.length) throw new HygieneRefused(assessment);
  return assessment;
}

/** Print each warning once through a caller-owned output channel. */
export function reportHygieneWarnings(print: (line: string) => void, assessment: HygieneAssessment): void {
  for (const warning of assessment.warnings) print(formatHygieneWarnings([warning]));
}

function thousands(value: number): string { return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

export function decodeText(contents: Buffer): string | undefined {
  if (contents.subarray(0, 8192).includes(0)) return undefined;
  // ignoreBOM keeps a leading U+FEFF in the decoded text so HYG2 can see it — the default
  // decoder strips it, which would exempt exactly one of the code points HYG2 names (review P2).
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(contents); } catch { return undefined; }
}
function lineOf(contents: Buffer | undefined, expression: RegExp): number | undefined {
  const text = contents === undefined ? undefined : decodeText(contents); const match = text === undefined ? undefined : expression.exec(text);
  return match === undefined || match === null ? undefined : lineAt(text!, match.index);
}
function lineAt(text: string, offset: number): number { return text.slice(0, offset).split('\n').length; }
function mixedScriptOffset(text: string): number | undefined {
  for (const match of text.matchAll(/\S+/gu)) {
    const scripts = new Set<string>();
    for (const char of match[0]) if (/^\p{L}$/u.test(char)) {
      const script = SCRIPT_PATTERNS.find(([, expression]) => expression.test(char))?.[0];
      // A letter matching none of the enumerated scripts still counts as one distinct script:
      // the spec exempts only Common/Inherited, and treating unlisted scripts (Adlam, Tifinagh, …)
      // as neutral would let a Latin+unlisted homoglyph token pass (review P2).
      if (script === undefined) scripts.add('Unknown');
      else if (script !== 'Common' && script !== 'Inherited') scripts.add(script);
    }
    if (scripts.size > 1) return match.index;
  }
  return undefined;
}
function credentialOffset(text: string): number | undefined {
  for (const pattern of CREDENTIAL_PATTERNS) { const match = new RegExp(pattern.source, pattern.flags).exec(text); if (match) return match.index; }
  return undefined;
}
/**
 * Domains an address can never route to a real person through: the RFC-2606/6761 reserved set the
 * spec names, plus the fixture domains test harnesses actually type. `test.com` and `*.local` are a
 * §9 exempt-list widening (Ryan, 2026-09-14) — the list is marked [default — veto cheap], and
 * `git config user.email test@test.com` is the idiomatic fixture line our own eval-gen emits.
 */
function reservedDomain(domain: string): boolean {
  if (domain === 'example.com' || domain === 'example.org' || domain === 'example.net') return true;
  if (domain === 'test.com' || domain === 'localhost') return true;
  return ['.invalid', '.test', '.example', '.local', '.localhost'].some((suffix) => domain.endsWith(suffix));
}

/** HYG3 is a leak check, not an authorship gate: name the address, the exempt author, and the fix. */
function foreignEmailMessage(email: string, author: string | undefined): string {
  const whose = author === undefined
    ? 'this skill declares no metadata.author, so no address is exempt'
    : `the skill author is ${author}`;
  return `Contains the email address ${email}, which is not the skill author's (${whose}). Hygiene refuses addresses that could reach a real person; use a reserved domain such as example.com in test fixtures.`;
}

/** §6.3: a local-eval folder legitimately declares no `metadata.author` at all — HYG3 then has no author to exempt. */
function authorEmail(author: string | undefined): string | undefined { return author === undefined ? undefined : /<([^<>]+)>/.exec(author)?.[1]; }
function recordValue(value: unknown, key: string): unknown { return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>)[key] : undefined; }
function emailOffset(text: string, author: string | undefined): { index: number; email: string } | undefined {
  for (const match of text.matchAll(EMAIL)) {
    const email = match[0]; const at = email.lastIndexOf('@'); const local = email.slice(0, at); const domain = email.slice(at + 1).toLowerCase();
    if (reservedDomain(domain)) continue;
    if (author !== undefined) { const authorAt = author.lastIndexOf('@'); if (authorAt > 0 && local === author.slice(0, authorAt) && domain === author.slice(authorAt + 1).toLowerCase()) continue; }
    return { index: match.index, email };
  }
  return undefined;
}
export function normalizeLicense(value: string): string { return value.trim().toLowerCase().replace(/^apache license(?:,)? version 2\.0$/i, 'apache-2.0').replace(/^mit license$/i, 'mit').replace(/^bsd 3-clause(?: license)?$/i, 'bsd-3-clause'); }
function detectLicense(text: string): string | undefined {
  const spdx = /SPDX-License-Identifier:\s*([A-Za-z0-9.+-]+)/i.exec(text)?.[1];
  if (spdx) return normalizeLicense(spdx);
  if (/apache license[\s\S]{0,100}version 2\.0/i.test(text)) return 'apache-2.0';
  if (/\bmit license\b/i.test(text)) return 'mit';
  if (/\bbsd 3-clause\b/i.test(text)) return 'bsd-3-clause';
  return undefined;
}
