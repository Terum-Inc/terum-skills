import { describe, expect, it } from 'vitest';
import { cliUsage, mapUsageReport, type CliUsage } from '../usage';

const report = (rows: CliUsage['rows']): CliUsage => ({
  since: '2026-08-16T00:00:00.000Z', until: '2026-09-15T00:00:00.000Z',
  rows, unused: 0, unrecognised: [], caveats: ['Counts are invocations, not outcome-changing uses; reopenings are not deduped.'],
});
const row = (skill: string, d1: number, d2: number, availability: 'full' | 'partial' | 'unknown' = 'full'): CliUsage['rows'][number] =>
  ({ skill, label: 'team', d1, d2, autonomy: d1 + d2 === 0 ? null : d1 / (d1 + d2), availability });

// The per-skill projection (`skillUsage`) and the Library tile (`activationOverview`) are pure over
// this model and tested in src/lib/__tests__/activation.test.ts; this file pins only the CLI boundary.
describe('mapUsageReport — the whole machine, rows and tail kept apart', () => {
  it('carries rows, the unused count, the tail, the window and every caveat through unchanged', () => {
    const r = { ...report([row('a', 2, 0), row('b', 0, 0, 'partial')]), unused: 1, unrecognised: [{ skill: 'z', d1: 1, d2: 3 }] };
    expect(mapUsageReport(r)).toEqual({
      since: '2026-08-16T00:00:00.000Z', until: '2026-09-15T00:00:00.000Z',
      // A 0.21 CLI emits neither placedAt nor daily: both read as null, never as a guess.
      rows: [{ skill: 'a', label: 'team', d1: 2, d2: 0, autonomy: 1, availability: 'full', placedAt: null }, { skill: 'b', label: 'team', d1: 0, d2: 0, autonomy: null, availability: 'partial', placedAt: null }],
      unused: 1,
      unrecognised: [{ skill: 'z', d1: 1, d2: 3 }],
      caveats: ['Counts are invocations, not outcome-changing uses; reopenings are not deduped.'],
      daily: null,
    });
  });

  it('carries the per-day buckets and the ledger date when a 0.22 CLI emits them', () => {
    const model = mapUsageReport({ ...report([{ ...row('a', 1, 0), placedAt: '2026-07-01T00:00:00.000Z' }]), daily: [{ day: '2026-09-01', skill: 'a', d1: 1, d2: 0 }] });
    expect(model.rows[0]!.placedAt).toBe('2026-07-01T00:00:00.000Z');
    expect(model.daily).toEqual([{ day: '2026-09-01', skill: 'a', d1: 1, d2: 0 }]);
  });

  it('never folds an unplaced name into a row — the ledger has no availability to give it', () => {
    const model = mapUsageReport({ ...report([]), unrecognised: [{ skill: 'decision-walk', d1: 1, d2: 3 }] });
    expect(model.rows).toEqual([]);
    expect(model.unrecognised).toEqual([{ skill: 'decision-walk', d1: 1, d2: 3 }]);
  });

  it('drops the fields nothing reads (archived, problems, usedArchive) rather than passing them through', () => {
    const model = mapUsageReport(cliUsage.parse({ ...report([row('a', 1, 0)]), archived: 3, usedArchive: false, problems: [] }));
    expect(Object.keys(model).sort()).toEqual(['caveats', 'daily', 'rows', 'since', 'unrecognised', 'until', 'unused']);
  });
});

describe('cliUsage — a read degrades rather than throws', () => {
  it('accepts unknown fields from a newer CLI', () => {
    const parsed = cliUsage.parse({ ...report([row('a', 1, 0)]), archived: 3, usedArchive: false, somethingNew: true });
    expect(parsed.rows[0]!.skill).toBe('a');
  });

  it('rejects a payload missing the fields the panel reads', () => {
    expect(() => cliUsage.parse({ since: 'x', until: 'y', rows: [{ skill: 'a' }], unused: 0, unrecognised: [], caveats: [] })).toThrow();
  });

  it('rejects an availability value the panel has no branch for', () => {
    expect(() => cliUsage.parse(report([{ skill: 'a', label: 'team', d1: 0, d2: 0, autonomy: null, availability: 'sometimes' } as never]))).toThrow();
  });
});
