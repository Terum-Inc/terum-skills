import { describe, expect, it } from 'vitest';
import { assessHygiene, exemptAuthorEmail, formatHygieneWarnings, HygieneRefused, hygieneFrontmatter, inspectContent, inspectHygiene, type HygieneInput } from '../hygiene.js';

const ID = '11111111-1111-4111-8111-111111111111';
const skill = (extra = '', body = '') => `---\nname: sample\ndescription: useful skill\nlicense: Apache-2.0\nmetadata:\n  id: ${ID}\n  author: Author <author@authors.test>\n  terum-category: docs\n${extra}---\n${body}`;
const inspect = (files: Record<string, string | Buffer>, executable: readonly string[] = [], policy = 'Apache-2.0') => {
  const mapped = new Map(Object.entries(files).map(([path, contents]) => [path, Buffer.isBuffer(contents) ? contents : Buffer.from(contents)]));
  return inspectHygiene({ name: 'sample', frontmatter: hygieneFrontmatter(mapped.get('SKILL.md')!), files: mapped, executable: new Set(executable), policy: { skill_license: policy } });
};
const codes = (findings: ReturnType<typeof inspect>) => findings.errors.map((finding) => finding.code);

describe('inspectHygiene (§9)', () => {
  it('uses the existing line-numbered malformed allowed-tools message', () => {
    const findings = inspect({ 'SKILL.md': skill('allowed-tools:\n  bash: true\n') });
    expect(findings.errors).toMatchObject([{ code: 'HYG1', path: 'SKILL.md', line: 9, message: expect.stringContaining('allowed-tools is malformed (SKILL.md line 9)') }]);
  });

  it('flags bidi, zero-width, and mixed-script tokens while allowing multilingual prose', () => {
    for (const body of ['safe\u202Etext', 'safe\u200Btext', 'paypаl']) expect(codes(inspect({ 'SKILL.md': skill('', body) }))).toContain('HYG2');
    expect(codes(inspect({ 'SKILL.md': skill('', 'café Ελληνικά العربية 日本語') }))).not.toContain('HYG2');
  });

  it('allows the author email and placeholders but refuses third-party email addresses', () => {
    expect(codes(inspect({ 'SKILL.md': skill('', 'Author <author@authors.test>; hello@example.com') }))).not.toContain('HYG3');
    expect(codes(inspect({ 'SKILL.md': skill('', 'contact: third.party@company.com') }))).toContain('HYG3');
  });

  it('exempts the fixture domains a test harness actually types', () => {
    // `git config user.email test@test.com` is the line our own eval-gen writes; `test.com` is a
    // real registered domain, so the RFC-2606 list alone refused it (Ryan, 2026-09-14).
    for (const address of ['test@test.com', 'dev@my.local', 'ci@build.localhost', 'a@b.example']) {
      expect(codes(inspect({ 'SKILL.md': skill('', `setup: git config user.email ${address}`) }))).not.toContain('HYG3');
    }
    // The widening is domain-exact: a real domain that merely starts the same way still fails.
    expect(codes(inspect({ 'SKILL.md': skill('', 'contact: a@testing.com') }))).toContain('HYG3');
    expect(codes(inspect({ 'SKILL.md': skill('', 'contact: a@nottest.com') }))).toContain('HYG3');
  });

  it('names the offending address, the exempt author, and the fix', () => {
    const [finding] = inspect({ 'SKILL.md': skill('', 'contact: third.party@company.com') }).errors;
    expect(finding).toMatchObject({ code: 'HYG3', message: expect.stringContaining('third.party@company.com') });
    // The old wording ("not the skill author") read as an authorship gate and sent a user hunting
    // for a permission problem that does not exist. It must say whose address IS exempt.
    expect(finding!.message).toContain('author@authors.test');
    expect(finding!.message).toContain('example.com');
  });

  it('reports a credential in preference to an email in the same file', () => {
    const findings = inspect({ 'SKILL.md': skill('', 'contact: third.party@company.com\ntoken: ghp_0123456789abcdefghijklmnopqrstuvwxyz') });
    expect(findings.errors.filter((finding) => finding.code === 'HYG3')).toHaveLength(1);
    expect(findings.errors.find((finding) => finding.code === 'HYG3')!.message).toContain('credential-shaped');
  });

  it('recognizes every HYG4 boundary: extension, shebang, binary scope, and executable mode', () => {
    expect(codes(inspect({ 'SKILL.md': skill(), 'notes.md': 'plain notes' }))).not.toContain('HYG4');
    expect(codes(inspect({ 'SKILL.md': skill(), 'payload.exe': 'not executable' }))).toContain('HYG4');
    expect(codes(inspect({ 'SKILL.md': skill(), 'tool.sh': '#!/bin/sh\necho ok' }))).toContain('HYG4');
    const binary = inspect({ 'SKILL.md': skill(), 'payload.exe': Buffer.from([0, 255, 7]) });
    expect(codes(binary)).toEqual(['HYG4']);
    const executable = inspect({ 'SKILL.md': skill(), 'script.js': 'export const x = 1;' }, ['script.js']);
    expect(codes(executable)).toEqual(['HYG4']);
  });

  it('compares normalized SPDX identifiers across frontmatter, policy, and bundled LICENSE files', () => {
    expect(codes(inspect({ 'SKILL.md': skill(), LICENSE: 'SPDX-License-Identifier: apache-2.0\n' }, [], ' apache-2.0 '))).not.toContain('HYG5');
    expect(codes(inspect({ 'SKILL.md': skill(), LICENSE: 'SPDX-License-Identifier: MIT\n' }))).toContain('HYG5');
    expect(codes(inspect({ 'SKILL.md': skill() }, [], 'MIT'))).toContain('HYG5');
  });

  it('enforces the SKILL.md character cap exactly and requires a non-blank description', () => {
    const prefix = skill('', ''); const atCap = `${prefix}${'x'.repeat(20_000 - prefix.length)}`;
    expect(codes(inspect({ 'SKILL.md': atCap }))).not.toContain('HYG6');
    expect(inspect({ 'SKILL.md': `${atCap}x` }).warnings.map((warning) => warning.code)).toContain('HYG6');
    expect(codes(inspect({ 'SKILL.md': skill().replace('description: useful skill', 'description: "   "') }))).toContain('HYG6');
  });
});

// Rev 16: callers cannot accidentally gate on a combined array length.
it('exposes separate error and warning tiers at the exact UTF-16 boundary', () => {
  const atCap = skill().padEnd(20_000, 'x');
  expect(inspect({ 'SKILL.md': atCap })).toEqual({ errors: [], warnings: [] });
  const assessment = inspect({ 'SKILL.md': `${atCap}x` });
  expect(assessment.errors).toEqual([]);
  expect(assessment.warnings).toEqual([{ code: 'HYG6', path: 'SKILL.md', message: 'SKILL.md is 20,001 characters, 1 over the 20,000-character guideline (~5k tokens). Size alone does not block this operation; loading this skill uses that much more context.' }]);
  // @ts-expect-error HygieneAssessment is not an array; errors alone gate.
  void inspectHygiene({ name: 'sample', frontmatter: {}, files: new Map(), executable: new Set(), policy: { skill_license: 'Apache-2.0' } }).length;
});
it.each([false, true])('blank description stays an error (oversized: %s)', (oversized) => {
  const text = skill().replace('description: useful skill', 'description: "   "');
  const assessment = inspect({ 'SKILL.md': oversized ? text.padEnd(20_001, 'x') : text });
  expect(assessment.errors).toEqual([expect.objectContaining({ code: 'HYG6', message: 'description must not be empty.' })]);
  expect(assessment.warnings).toHaveLength(oversized ? 1 : 0);
});
it('counts supplementary characters as two UTF-16 units', () => {
  const assessment = inspect({ 'SKILL.md': skill('', '\u{1D54F}'.repeat(10_001)) });
  expect(assessment.errors).toEqual([]);
  expect(assessment.warnings).toEqual([expect.objectContaining({ code: 'HYG6' })]);
});


describe('HYG7 — category taxonomy warning', () => {
  const categories = ['debugging', 'testing', 'docs', 'workflow', 'research', 'infra', 'review', 'misc'];
  const assess = (category: string, list?: readonly string[]) => assessHygiene('sample', {
    files: new Map([['SKILL.md', Buffer.from(skill().replace('terum-category: docs', `terum-category: ${category}`))]]), executable: new Set(),
  }, 'Apache-2.0', false, false, list);

  it('warns exactly once with the line number and never gates an off-list category', () => {
    const result = assess('ops', categories);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(formatHygieneWarnings(result.warnings)).toBe("warning HYG7 SKILL.md:8: terum-category `ops` is not one of your team's categories (debugging, testing, docs, workflow, research, infra, review, misc). Browse will give it a bucket of its own; add it to team.json or change this line.");
  });
  it.each(['docs', 'DOCS', 'review'])('is silent for on-list %s, case-insensitively', category => {
    expect(assess(category, categories)).toEqual({ errors: [], warnings: [] });
  });
  it.each([undefined, []])('is silent when the taxonomy is unknown or empty: %j', list => {
    expect(assess('ops', list)).toEqual({ errors: [], warnings: [] });
  });
  it('keeps managedFieldsAbsent as the fifth parameter', () => {
    expect(assessHygiene('sample', { files: new Map([['SKILL.md', Buffer.from('---\nname: sample\ndescription: useful skill\n---\n')]]), executable: new Set() }, null, false, true, categories)).toEqual({ errors: [], warnings: [] });
  });
  it('does not warn on unparseable frontmatter', () => {
    const files = new Map([['SKILL.md', Buffer.from('---\nmetadata: [\n---\n')]]);
    expect(inspectHygiene({ name: 'sample', files, frontmatter: hygieneFrontmatter(files.get('SKILL.md')!), executable: new Set(), policy: { skill_license: null }, categories }).warnings).toEqual([]);
  });
  it('omits an unavailable line number for inline metadata', () => {
    const raw = skill().replace(/metadata:[\s\S]*?---/, `metadata: {id: ${ID}, author: 'Author <author@authors.test>', terum-category: ops}\n---`);
    const result = assessHygiene('sample', { files: new Map([['SKILL.md', Buffer.from(raw)]]), executable: new Set() }, 'Apache-2.0', false, false, categories);
    expect(formatHygieneWarnings(result.warnings)).toContain('warning HYG7 SKILL.md: terum-category');
  });
});

describe('HYG1 — Claude Code skill fields (eval only)', () => {
  const FIELDS = ['model: haiku', 'effort: low', 'context: fork', 'agent: Explore', 'background: false', 'disallowed-tools: AskUserQuestion', 'argument-hint: "[path]"', 'arguments: [path]', 'disable-model-invocation: true', 'user-invocable: false', 'when_to_use: when exploring a codebase'];
  const local = (extra: string) => `---\nname: sample\ndescription: useful skill\n${extra}---\n`;
  const hyg1 = (source: string, options: Pick<HygieneInput, 'managedFieldsAbsent' | 'claudeCodeFields'>) => {
    const files = new Map([['SKILL.md', Buffer.from(source)]]);
    return inspectHygiene({ name: 'sample', frontmatter: hygieneFrontmatter(files.get('SKILL.md')!), files, executable: new Set(), policy: { skill_license: null }, ...options }).errors.filter((finding) => finding.code === 'HYG1');
  };
  const EVAL = { managedFieldsAbsent: true, claudeCodeFields: true };
  const ACCEPTED = 'name, description, license, metadata, allowed-tools, model, effort, context, agent, background, disallowed-tools, argument-hint, arguments, disable-model-invocation, user-invocable, when_to_use';

  it('accepts every listed field with the eval option, on a local folder and on a published one', () => {
    const all = FIELDS.map((line) => `${line}\n`).join('');
    expect(hyg1(local(all), EVAL)).toEqual([]);
    expect(hyg1(skill(all), EVAL)).toEqual([]);
    // Through the shared gate, as eval calls it.
    expect(assessHygiene('sample', { files: new Map([['SKILL.md', Buffer.from(local(all))]]), executable: new Set() }, null, false, true, undefined, 0, { claudeCodeFields: true })).toEqual({ errors: [], warnings: [] });
  });

  it('still refuses hooks with the eval option, saying why, and any key not on the list', () => {
    expect(hyg1(local('model: haiku\nhooks:\n  Stop: []\n'), EVAL)).toEqual([{ code: 'HYG1', path: 'SKILL.md', message: `SKILL.md frontmatter is invalid: Unrecognized key: "hooks" (allowed top-level fields: ${ACCEPTED}). The field hooks is refused: hooks register commands that run on this machine, so eval does not run a skill that declares them.` }]);
    expect(hyg1(local('model: haiku\nfoo: x\n'), EVAL)).toEqual([{ code: 'HYG1', path: 'SKILL.md', message: `SKILL.md frontmatter is invalid: Unrecognized key: "foo" (allowed top-level fields: ${ACCEPTED}).` }]);
  });

  it.each(FIELDS)('without it, the skill fix and validate schemas still refuse %s', (line) => {
    const key = line.slice(0, line.indexOf(':'));
    const refusal = { code: 'HYG1', path: 'SKILL.md', message: `SKILL.md frontmatter is invalid: Unrecognized key: "${key}" (allowed top-level fields: name, description, license, metadata, allowed-tools).` };
    // `skill fix`: the lenient local schema. `validate`: the strict one, on a folder that carries every managed field.
    expect(hyg1(local(`${line}\n`), { managedFieldsAbsent: true })).toEqual([refusal]);
    expect(hyg1(skill(`${line}\n`), {})).toEqual([refusal]);
    // And through the shared gate with the same positional arguments `skill fix` passes.
    expect(() => assessHygiene('sample', { files: new Map([['SKILL.md', Buffer.from(local(`${line}\n`))]]), executable: new Set() }, null, false, true)).toThrow(HygieneRefused);
  });
});

describe('HYG8 — external repository dependency warning', () => {
  it('warns without gating when the caller resolved dependencies', () => {
    const result = assessHygiene('sample', { files: new Map([['SKILL.md', Buffer.from(skill())]]), executable: new Set() }, 'Apache-2.0', false, false, undefined, 2);
    expect(result).toEqual({ errors: [], warnings: [{ code: 'HYG8', path: 'SKILL.md', message: 'this skill references 2 repository paths outside its folder; it depends on files it does not carry' }] });
  });
});

describe('inspectContent', () => {
  const bytes = (files: Record<string, string>) => new Map(Object.entries(files).map(([path, body]) => [path, Buffer.from(body)]));

  it('applies HYG2/HYG3 to material that is not a skill folder yet', () => {
    // Generated eval assets have no frontmatter of their own, so inspectHygiene cannot judge them:
    // HYG1/HYG5/HYG6 would all fire on the absent SKILL.md and drown the real finding.
    const findings = inspectContent(bytes({ 'evals/cases/a.yaml': 'setup: git config user.email real.person@company.com' }), 'author@authors.test');
    expect(findings.map((finding) => finding.code)).toEqual(['HYG3']);
    expect(findings[0]).toMatchObject({ path: 'evals/cases/a.yaml', line: 1 });
  });

  it('honours the same author and reserved-domain exemptions as the folder gate', () => {
    expect(inspectContent(bytes({ 'evals/cases/a.yaml': 'setup: git config user.email test@test.com' }), 'author@authors.test')).toEqual([]);
    expect(inspectContent(bytes({ 'evals/triggers.yaml': 'should_trigger:\n  - mail author@authors.test' }), 'author@authors.test')).toEqual([]);
  });

  it('exempts nothing when the folder declares no author', () => {
    expect(inspectContent(bytes({ 'evals/cases/a.yaml': 'note: someone@company.com' }), undefined).map((finding) => finding.code)).toEqual(['HYG3']);
  });
});

describe('exemptAuthorEmail', () => {
  it('reads the address out of the folder frontmatter, strict schema or not', () => {
    expect(exemptAuthorEmail(Buffer.from(skill()))).toBe('author@authors.test');
    // A local, never-published folder carries no managed fields (§6.3) and still gets its exemption.
    expect(exemptAuthorEmail(Buffer.from('---\nname: sample\ndescription: d\nmetadata:\n  author: A <a@b.com>\n---\nbody'))).toBe('a@b.com');
  });

  it('is undefined when there is no author to exempt', () => {
    expect(exemptAuthorEmail(undefined)).toBeUndefined();
    expect(exemptAuthorEmail(Buffer.from('---\nname: sample\ndescription: d\n---\nbody'))).toBeUndefined();
    // An author with no angle brackets exempts nothing (§9 HYG3).
    expect(exemptAuthorEmail(Buffer.from('---\nname: sample\nmetadata:\n  author: plain-handle\n---\nbody'))).toBeUndefined();
  });
});
