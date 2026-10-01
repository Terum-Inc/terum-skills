import type { UsageDay, UsageReport, UsageRow } from '../types';

/**
 * The mock's whole-machine firings, generated per window from one table of days so every surface
 * — the Library tile, its timeline, a skill page's calendar and figures — reads the same report the
 * way the real adapter's callers do. The clock is fixed: the window always ends at `MOCK_UNTIL`.
 *
 * The last 30 days are written by hand, and they are the fixture every test knows:
 *   deploy-check     0 autonomous / 4 explicit — the case the feature exists for
 *   release-notes    3 / 1
 *   test-writer      2 / 0, placed mid-window (partial availability)
 *   pr-review        0 / 0, placed and silent — but it DID fire ~7 weeks ago, so a longer window
 *                    brings it back to life and the dead-skills line shows why the window matters
 *   env-audit        0 / 0 with no placement date (availability unknown)
 *   incident-triage  1 / 3, fired but never placed by Terum (the unrecognised tail)
 *   commit-msg       nothing recorded in any window, which is not a claim that it is uninstalled
 * Days further back are deterministic pseudo-random per skill, so the 90-day and 1-year calendars
 * have texture without the numbers drifting between runs.
 */
export const MOCK_UNTIL = '2026-09-15T12:00:00.000Z';
const DAY = 86_400_000;
const untilMs = Date.parse(MOCK_UNTIL);

/** Local calendar date of the instant `k` days before the window's end (noon UTC, so no timezone within ±11h flips it). */
const dayBack = (k: number): string => {
  const d = new Date(untilMs - k * DAY);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const iso = (k: number): string => new Date(untilMs - k * DAY).toISOString();

/** [days back, d1, d2] — the hand-written last 30 days. */
const LAST_30: Record<string, [number, number, number][]> = {
  'deploy-check': [[2, 0, 1], [6, 0, 1], [13, 0, 1], [21, 0, 1]],
  'release-notes': [[1, 1, 0], [8, 1, 1], [17, 1, 0]],
  'test-writer': [[4, 1, 0], [9, 1, 0]],
  'incident-triage': [[5, 1, 0], [11, 0, 1], [12, 0, 1], [19, 0, 1]],
};
/** The ledger: name → placement date (null = the ledger has no date). Names absent here are unplaced. */
const PLACED: Record<string, string | null> = {
  'deploy-check': iso(76), 'release-notes': iso(76), 'test-writer': iso(12), 'pr-review': iso(76), 'env-audit': null,
};
/** Daily firing odds beyond the hand-written month, per skill: [P(autonomous), P(explicit)]. */
const OLDER: Record<string, [number, number]> = {
  'deploy-check': [0, 0.13], 'release-notes': [0.11, 0.03], 'incident-triage': [0.05, 0.09],
};
/** pr-review's two firings ~7 weeks back: dead at 30 days, alive at 90. */
const PR_REVIEW_DAYS = [45, 52];

/** A small, stable hash in [0, 1): the same (skill, day, salt) always fires the same way. FNV over the
 *  key, then murmur3's finalizer — without the finalizer, consecutive days differ only in their last
 *  character and the high bits barely moved, so one skill fired every day and another never. */
function noise(skill: string, k: number, salt: number): number {
  let x = 2166136261;
  for (const c of `${skill}:${k}:${salt}`) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619) >>> 0; }
  x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function mockUsage(days: number): UsageReport {
  const daily: UsageDay[] = [];
  const push = (k: number, skill: string, d1: number, d2: number) => { if (k <= days && d1 + d2 > 0) daily.push({ day: dayBack(k), skill, d1, d2 }); };
  for (const [skill, entries] of Object.entries(LAST_30)) for (const [k, d1, d2] of entries) push(k, skill, d1, d2);
  for (let k = 31; k <= days; k += 1) {
    for (const [skill, [pAuto, pExplicit]] of Object.entries(OLDER)) {
      const placedAt = PLACED[skill];
      if (placedAt !== undefined && placedAt !== null && Date.parse(placedAt) > untilMs - k * DAY) continue;
      const d1 = noise(skill, k, 1) < pAuto ? 1 + (noise(skill, k, 3) < 0.3 ? 1 : 0) : 0;
      const d2 = noise(skill, k, 2) < pExplicit ? 1 : 0;
      push(k, skill, d1, d2);
    }
    if (PR_REVIEW_DAYS.includes(k)) push(k, 'pr-review', 1, 0);
  }
  daily.sort((a, b) => a.day.localeCompare(b.day) || a.skill.localeCompare(b.skill));

  const since = iso(days);
  const totals = new Map<string, { d1: number; d2: number }>();
  for (const d of daily) { const t = totals.get(d.skill) ?? { d1: 0, d2: 0 }; t.d1 += d.d1; t.d2 += d.d2; totals.set(d.skill, t); }
  const rows: UsageRow[] = Object.entries(PLACED).map(([skill, placedAt]) => {
    const { d1, d2 } = totals.get(skill) ?? { d1: 0, d2: 0 };
    return { skill, label: 'team', d1, d2, autonomy: d1 + d2 === 0 ? null : d1 / (d1 + d2), availability: placedAt === null ? 'unknown' : placedAt > since ? 'partial' : 'full', placedAt };
  });
  const unrecognised = [...totals.entries()].filter(([skill]) => !(skill in PLACED)).map(([skill, { d1, d2 }]) => ({ skill, d1, d2 }));
  return {
    since, until: MOCK_UNTIL, rows, unused: rows.filter(r => r.d1 + r.d2 === 0).length, unrecognised, daily,
    caveats: ['Counts are invocations, not outcome-changing uses; reopenings are not deduped.', '30-day window: Claude Code prunes transcripts, so earlier use is visible only where this machine has already archived it.'],
  };
}
