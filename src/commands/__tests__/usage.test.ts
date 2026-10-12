import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Prompter } from '../../lib/prompt.js';
import { createConfigStore } from '../../lib/config.js';
import { archivePath } from '../../lib/usage/archive.js';
import { normaliseSince, placedSkills, renderReport, run, type UsageResult } from '../usage.js';

const io = { print: () => undefined } as unknown as Prompter;
const NOW = Date.parse('2026-09-15T00:00:00.000Z');
const at = (iso: string): string => iso;

const firing = (skill: string, ts: string, entrypoint = 'cli'): string => JSON.stringify({
  type: 'assistant', entrypoint, timestamp: ts, message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill } }] },
});
const typed = (skill: string, ts: string): string => JSON.stringify({
  type: 'user', entrypoint: 'cli', timestamp: ts, message: { content: `<command-name>/${skill}</command-name>` },
});

/** A complete `config.placements` entry — the schema wants id, version, scope and fingerprint too. */
const entry = (placedAt: string) => ({ id: '00000000-0000-4000-8000-000000000000', team: 't', version: null, scope: { kind: 'global' as const }, placed_at: placedAt, fingerprint: 'f' });

/** A machine with placed skills and a transcript corpus. */
async function machine(lines: string[], placements: Record<string, ReturnType<typeof entry>>) {
  const stateRoot = await mkdtemp(join(tmpdir(), 'terum-usage-state-'));
  const projectsRoot = await mkdtemp(join(tmpdir(), 'terum-usage-projects-'));
  await mkdir(join(projectsRoot, 'p'), { recursive: true });
  await writeFile(join(projectsRoot, 'p', 's.jsonl'), lines.join('\n'));
  const store = createConfigStore(stateRoot);
  await store.ensureRoot();
  await store.update((config) => { config.placements = placements as never; });
  return { stateRoot, projectsRoot, store };
}

const PLACED = { '/home/me/.claude/skills/codex-spec': entry(at('2026-07-01T00:00:00.000Z')) };

describe('usage — the JSON object carries the per-day buckets', () => {
  it('emits daily alongside rows, summing to the same counts', async () => {
    const m = await machine([typed('codex-spec', '2026-09-01T12:00:00.000Z'), typed('codex-spec', '2026-09-01T13:00:00.000Z'), firing('codex-spec', '2026-09-03T12:00:00.000Z')], PLACED);
    const result = await run({ config: m.store, projectsRoot: m.projectsRoot, now: () => NOW }, io);
    expect(result.ok).toBe(true);
    expect(result.value!.daily).toEqual([
      { day: '2026-09-01', skill: 'codex-spec', d1: 0, d2: 2 },
      { day: '2026-09-03', skill: 'codex-spec', d1: 1, d2: 0 },
    ]);
    expect(result.value!.rows[0]).toMatchObject({ d1: 1, d2: 2, placedAt: '2026-07-01T00:00:00.000Z' });
  });
});

describe('usage — the row set is the placements ledger', () => {
  it('reports a placed skill people name but the model never chooses', async () => {
    const m = await machine([typed('codex-spec', '2026-09-01T00:00:00.000Z'), typed('codex-spec', '2026-09-02T00:00:00.000Z')], PLACED);
    const result = await run({ config: m.store, projectsRoot: m.projectsRoot, now: () => NOW }, io);
    expect(result.ok).toBe(true);
    expect(result.value!.rows).toEqual([expect.objectContaining({ skill: 'codex-spec', d1: 0, d2: 2, autonomy: 0 })]);
  });

  it('keeps a bundled firing out of the rows and out of the unused count', async () => {
    const m = await machine([firing('artifact-design', '2026-09-01T00:00:00.000Z')], PLACED);
    const result = await run({ config: m.store, projectsRoot: m.projectsRoot, now: () => NOW }, io);
    expect(result.value!.rows.map((row) => row.skill)).toEqual(['codex-spec']);
    expect(result.value!.unrecognised).toEqual([{ skill: 'artifact-design', d1: 1, d2: 0 }]);
    expect(result.value!.unused).toBe(1);
  });

  it('narrows to one skill when named', async () => {
    const m = await machine([], { ...PLACED, '/home/me/.claude/skills/handoff': entry(at('2026-07-01T00:00:00.000Z')) });
    const result = await run({ config: m.store, projectsRoot: m.projectsRoot, ref: 'handoff', now: () => NOW }, io);
    expect(result.value!.rows.map((row) => row.skill)).toEqual(['handoff']);
  });

  it('is an empty report, not an error, on a machine that has never run Claude Code', async () => {
    const m = await machine([], {});
    const result = await run({ config: m.store, projectsRoot: join(tmpdir(), 'terum-usage-nope'), now: () => NOW }, io);
    expect(result.ok).toBe(true);
    expect(result.value!.rows).toEqual([]);
  });
});

describe('usage — the archive is off the report read path (D2)', () => {
  it('appends what it scanned', async () => {
    const m = await machine([typed('codex-spec', '2026-09-01T00:00:00.000Z')], PLACED);
    const result = await run({ config: m.store, projectsRoot: m.projectsRoot, now: () => NOW }, io);
    expect(result.value!.archived).toBe(1);
  });

  it('a second run appends nothing — the tuple is the key', async () => {
    const m = await machine([typed('codex-spec', '2026-09-01T00:00:00.000Z')], PLACED);
    await run({ config: m.store, projectsRoot: m.projectsRoot, now: () => NOW }, io);
    const second = await run({ config: m.store, projectsRoot: m.projectsRoot, now: () => NOW }, io);
    expect(second.value!.archived).toBe(0);
  });

  it('DELETING THE ARCHIVE CHANGES NO NUMBER THE DEFAULT REPORT PRINTS — the property that keeps it cheap', async () => {
    const m = await machine([typed('codex-spec', '2026-09-01T00:00:00.000Z'), firing('codex-spec', '2026-09-03T00:00:00.000Z')], PLACED);
    const before = await run({ config: m.store, projectsRoot: m.projectsRoot, now: () => NOW }, io);
    await rm(archivePath(m.stateRoot), { force: true });
    const after = await run({ config: m.store, projectsRoot: m.projectsRoot, now: () => NOW }, io);
    expect(after.value!.rows).toEqual(before.value!.rows);
    expect(after.value!.unused).toBe(before.value!.unused);
    expect(after.value!.usedArchive).toBe(false);
  });

  it('consults the archive only when the window reaches past retention', async () => {
    const m = await machine([typed('codex-spec', '2026-09-01T00:00:00.000Z')], PLACED);
    const wide = await run({ config: m.store, projectsRoot: m.projectsRoot, since: '2026-01-01T00:00:00.000Z', now: () => NOW }, io);
    expect(wide.value!.usedArchive).toBe(true);
  });
});

describe('usage — caveats are printed every time', () => {
  it('never omits the invocations-not-outcomes disclaimer', async () => {
    const m = await machine([], PLACED);
    const result = await run({ config: m.store, projectsRoot: m.projectsRoot, now: () => NOW }, io);
    expect(result.value!.caveats[0]).toContain('invocations, not outcome-changing uses');
  });
});

describe('placedSkills', () => {
  it('names a row by the placement basename and labels it team', () => {
    expect(placedSkills(PLACED)).toEqual([{ name: 'codex-spec', label: 'team', placedAt: '2026-07-01T00:00:00.000Z' }]);
  });

  it('collapses a skill placed in two scopes to its earliest placement', () => {
    const rows = placedSkills({
      '/a/handoff': entry('2026-08-01T00:00:00.000Z'),
      '/b/handoff': entry('2026-07-01T00:00:00.000Z'),
    });
    expect(rows).toEqual([{ name: 'handoff', label: 'team', placedAt: '2026-07-01T00:00:00.000Z' }]);
  });
});

describe('renderReport — §7 output', () => {
  const report = (rows: UsageResult['rows'], extra: Partial<UsageResult> = {}): UsageResult => ({
    since: '2026-08-16T00:00:00.000Z', until: '2026-09-15T00:00:00.000Z',
    rows, unused: 0, unrecognised: [], daily: [], archived: 0, problems: [], usedArchive: false,
    caveats: ['Counts are invocations, not outcome-changing uses; reopenings are not deduped.'], ...extra,
  });
  const row = (skill: string, d1: number, d2: number, availability: 'full' | 'partial' | 'unknown' = 'full'): UsageResult['rows'][number] =>
    ({ skill, label: 'team', d1, d2, autonomy: d1 + d2 === 0 ? null : d1 / (d1 + d2), availability, placedAt: '2026-07-01T00:00:00.000Z' });

  it('marks the case the verb exists for — used, never chosen', () => {
    expect(renderReport(report([row('codex-spec', 0, 4)]))[0]).toContain('never chosen from its description');
  });

  it('does not mark a skill the model did choose', () => {
    expect(renderReport(report([row('a', 1, 1)]))[0]).not.toContain('never chosen');
  });

  it('says so plainly when nothing fired', () => {
    expect(renderReport(report([row('a', 0, 0)], { unused: 1 }))).toContain('No placed skill fired in this window.');
  });

  it('prints every caveat, always', () => {
    expect(renderReport(report([row('a', 1, 0)])).at(-1)).toContain('invocations, not outcome-changing uses');
  });

  it('keeps unplaced names out of the table unless --all is passed', () => {
    const r = report([row('a', 1, 0)], { unrecognised: [{ skill: 'artifact-design', d1: 6, d2: 0 }] });
    expect(renderReport(r).join('\n')).not.toContain('artifact-design');
    expect(renderReport(r, { all: true }).join('\n')).toContain('artifact-design');
  });

  it('discloses a partial-window placement rather than implying full availability', () => {
    expect(renderReport(report([row('a', 0, 1, 'partial')]))[0]).toContain('placed mid-window');
  });

  it('--all folds the tail into the one table rather than stacking a block beneath it (§6)', () => {
    const r = report([row('chosen', 2, 0)], { unrecognised: [{ skill: 'unplaced', d1: 0, d2: 3 }] });
    const rendered = renderReport(r, { all: true });
    expect(rendered.join('\n')).not.toContain('Fired here, but not placed by this machine');
    // Folded means sorted as one table: never-chosen leads, whether or not the ledger placed it.
    expect(rendered[0]).toContain('unplaced');
    expect(rendered[1]).toContain('chosen');
  });

  it('marks an unplaced name apart from a placed one whose ledger records no date', () => {
    const rendered = renderReport(report([row('dateless', 0, 1, 'unknown')], {
      unrecognised: [{ skill: 'unplaced', d1: 0, d2: 1 }],
    }), { all: true }).join('\n');
    // Both are 'we cannot say how long it was available', but for different reasons, and a report
    // that prints one sentence for two different facts is the conflation §2.2 names as the hazard.
    expect(rendered).toContain('availability unknown');
    expect(rendered).toContain('not placed by this machine');
  });

  it('still withholds the tail behind the hint when --all is absent', () => {
    const rendered = renderReport(report([row('a', 1, 0)], { unrecognised: [{ skill: 'unplaced', d1: 6, d2: 0 }] })).join('\n');
    expect(rendered).toContain('pass --all to list them');
    expect(rendered).not.toContain('not placed by this machine');
  });
});

describe('usage — a skill Terum did not place still has observable firings', () => {
  it('reports counts for a hand-installed skill instead of withholding them behind --all', async () => {
    // The `decision-walk` regression: it lives at ~/.claude/skills/decision-walk with four recorded
    // firings and no placements row, and `usage decision-walk` said only that something unnamed had
    // fired somewhere. Asked about one skill, answer about that skill.
    const m = await machine([typed('decision-walk', '2026-09-01T00:00:00.000Z'), firing('decision-walk', '2026-09-02T00:00:00.000Z')], PLACED);
    const result = await run({ config: m.store, projectsRoot: m.projectsRoot, ref: 'decision-walk', now: () => NOW }, io);
    expect(result.value!.rows).toEqual([]);
    expect(result.value!.unrecognised).toEqual([{ skill: 'decision-walk', d1: 1, d2: 1 }]);
  });

  it('scopes the tail to the named skill rather than every unplaced name on the machine', async () => {
    const m = await machine([typed('decision-walk', '2026-09-01T00:00:00.000Z'), firing('artifact-design', '2026-09-02T00:00:00.000Z')], PLACED);
    const result = await run({ config: m.store, projectsRoot: m.projectsRoot, ref: 'decision-walk', now: () => NOW }, io);
    expect(result.value!.unrecognised.map((row) => row.skill)).toEqual(['decision-walk']);
  });

  it('renders those counts inline for a single skill, with no --all hint', () => {
    const rendered = renderReport({
      since: 'a', until: 'b', rows: [], unused: 0, unrecognised: [{ skill: 'decision-walk', d1: 1, d2: 3 }],
      archived: 0, problems: [], usedArchive: false, daily: [], caveats: ['c'],
    }, { single: true }).join('\n');
    expect(rendered).toContain('decision-walk');
    expect(rendered).toContain('1 autonomous');
    expect(rendered).not.toContain('--all');
    expect(rendered).not.toContain('No placed skill fired');
  });
});

describe('usage — --since is compared as a string, so it has to be a real one', () => {
  it('rejects an almost-right bound instead of silently reporting an empty window', async () => {
    const m = await machine([typed('codex-spec', '2026-09-01T00:00:00.000Z')], PLACED);
    // '2026-9-1' sorts ABOVE '2026-09-15' — '9' beats '0' at the third character — so unvalidated
    // it would filter every event out and print a confident zero.
    const result = await run({ config: m.store, projectsRoot: m.projectsRoot, since: '2026-9-1', now: () => NOW }, io);
    if (result.ok) throw new Error('expected a malformed --since to fail, not to report an empty window');
    expect(result.error).toContain('--since needs an ISO-8601 date');
    expect(result.error).toContain('2026-9-1');
  });

  it('accepts a bare date, the form a person actually types, and reads it as midnight UTC', async () => {
    const m = await machine([typed('codex-spec', '2026-09-01T12:00:00.000Z')], PLACED);
    const result = await run({ config: m.store, projectsRoot: m.projectsRoot, since: '2026-09-01', now: () => NOW }, io);
    expect(result.ok).toBe(true);
    expect(result.value!.since).toBe('2026-09-01T00:00:00.000Z');
    expect(result.value!.rows.find((row) => row.skill === 'codex-spec')!.d2).toBe(1);
  });

  it('canonicalises an offset timestamp so the downstream comparison is between like forms', () => {
    expect(normaliseSince('2026-09-01T00:00:00+02:00')).toBe('2026-08-31T22:00:00.000Z');
  });

  it('rejects a date the calendar does not have', () => {
    expect(normaliseSince('2026-02-30')).toBeNull();
    expect(normaliseSince('2026-13-01')).toBeNull();
  });

  it('rejects prose, which Date.parse would otherwise take a guess at', () => {
    expect(normaliseSince('last week')).toBeNull();
    expect(normaliseSince('')).toBeNull();
  });
});
