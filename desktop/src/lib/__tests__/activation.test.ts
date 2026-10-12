import { describe, expect, it } from 'vitest';
import { activationFindings, activationOverview, daysAgoLabel, history, historyDays, parseWindow, scopeTimeline, skillActivity, skillNote, skillRows, skillUsage, windowDays, windowLabel, yearCalendar } from '../activation';
import type { SkillActivity } from '../activation';
import type { MissesModel, ReceiptSummary, SkillCard, UsageDay, UsageReport, UsageRow } from '../../backend/types';

const report = (rows: UsageRow[], unrecognised: UsageReport['unrecognised'] = []): UsageReport => ({
  since: '2026-08-16T00:00:00.000Z', until: '2026-09-15T00:00:00.000Z',
  rows, unused: rows.filter(r => r.d1 + r.d2 === 0).length, unrecognised, daily: [],
  caveats: ['Counts are invocations, not outcome-changing uses; reopenings are not deduped.'],
});
const row = (skill: string, d1: number, d2: number, availability: UsageRow['availability'] = 'full'): UsageRow =>
  ({ skill, label: 'team', d1, d2, autonomy: d1 + d2 === 0 ? null : d1 / (d1 + d2), availability, placedAt: '2026-07-01T00:00:00.000Z' });
/** Only the fields the tile and the popup read off a card. */
const card = (name: string, flags: SkillCard['flags'] = [], summary: ReceiptSummary | null = null): SkillCard => ({ name, flags, summary }) as unknown as SkillCard;
const verdict = (v: ReceiptSummary['verdict'], [w, l, t]: [number, number, number], partial: [number, number] | null = null): ReceiptSummary => ({ w, l, t, n: w + l + t, lift: 0, verdict: v, partial, signP: '' });

describe('skillUsage — never-installed and never-fired are different answers', () => {
  it('returns null firings only when the skill appears nowhere — no row AND no observed firing', () => {
    expect(skillUsage(report([row('other', 1, 0)]), 'deploy-check').firings).toBeNull();
  });

  it('falls back to the unrecognised tail: a firing counts even if Terum did not place the copy', () => {
    // The `decision-walk` regression. Four firings were recorded under ~/.claude/skills/ with no
    // ledger row, and dropping them made the tab claim there was nothing to observe.
    expect(skillUsage(report([], [{ skill: 'decision-walk', d1: 1, d2: 3 }]), 'decision-walk').firings).toEqual({ d1: 1, d2: 3, autonomy: 0.25, availability: 'unknown', placed: false });
  });

  it('prefers the ledger row over the tail when a skill somehow appears in both', () => {
    expect(skillUsage(report([row('a', 2, 0)], [{ skill: 'a', d1: 9, d2: 9 }]), 'a').firings).toMatchObject({ d1: 2, placed: true });
  });

  it('returns zeroed firings — NOT null — for a skill placed here that never fired', () => {
    // The case the whole feature exists to surface. Collapsing it into null throws it away.
    expect(skillUsage(report([row('deploy-check', 0, 0)]), 'deploy-check').firings).toEqual({ d1: 0, d2: 0, autonomy: null, availability: 'full', placed: true });
  });

  it('carries the autonomy ratio for the used-but-never-chosen case', () => {
    expect(skillUsage(report([row('codex-spec', 0, 4)]), 'codex-spec').firings).toMatchObject({ d1: 0, d2: 4, autonomy: 0 });
  });

  it('carries the window and every caveat through unchanged', () => {
    const model = skillUsage(report([row('a', 1, 1)]), 'a');
    expect(model.since).toBe('2026-08-16T00:00:00.000Z');
    expect(model.caveats[0]).toContain('invocations, not outcome-changing uses');
  });

  it('preserves a partial-window placement rather than flattening it to full', () => {
    expect(skillUsage(report([row('a', 0, 1, 'partial')]), 'a').firings?.availability).toBe('partial');
  });
});

describe('windowLabel', () => {
  it('derives the window from the report bounds rather than assuming 30 days', () => {
    expect(windowLabel({ since: '2026-08-16T00:00:00.000Z', until: '2026-09-15T00:00:00.000Z' })).toBe('last 30 days');
    expect(windowLabel({ since: '2026-09-08T00:00:00.000Z', until: '2026-09-15T00:00:00.000Z' })).toBe('last 7 days');
    expect(windowLabel({ since: '2026-09-15T00:00:00.000Z', until: '2026-09-15T12:00:00.000Z' })).toBe('last 1 day');
  });
});

describe('activationOverview — the Library tile, joined to this root by name', () => {
  const machine = report([row('deploy-check', 0, 4), row('release-notes', 3, 1), row('test-writer', 2, 0, 'partial'), row('pr-review', 0, 0), row('env-audit', 0, 0, 'unknown')], [{ skill: 'incident-triage', d1: 1, d2: 3 }]);

  it('puts every reckoned card in exactly one of three buckets', () => {
    const cards = ['deploy-check', 'release-notes', 'test-writer', 'pr-review', 'env-audit', 'incident-triage', 'commit-msg'].map(name => card(name));
    const a = activationOverview(machine, cards);
    expect(a).toEqual({
      value: '4 of 7',
      meter: { chosen: 3, byName: 1, silent: 3, total: 7 },
      meter_text: '3 chosen by the model · 1 by name only · 3 never fired',
      note: 'last 30 days · 1 placed mid-window',
    });
    expect(a.meter.chosen + a.meter.byName + a.meter.silent).toBe(a.meter.total);
  });

  it('counts a firing from a copy Terum did not place — evidence is evidence', () => {
    expect(activationOverview(machine, [card('incident-triage')]).value).toBe('1 of 1');
  });

  it('counts a placed-and-silent skill and a never-observed one both as never fired, and claims nothing more', () => {
    const a = activationOverview(machine, [card('pr-review'), card('commit-msg')]);
    expect(a.value).toBe('0 of 2');
    expect(a.meter).toEqual({ chosen: 0, byName: 0, silent: 2, total: 2 });
    expect(a.note).toBe('last 30 days');
  });

  it('leaves the bundled manual out of the reckoning', () => {
    expect(activationOverview(machine, [card('release-notes'), card('terum-skills', ['bundled'])])).toMatchObject({ value: '1 of 1', meter: { total: 1 } });
    expect(activationOverview(machine, [card('terum-skills', ['bundled'])])).toEqual({ value: '0', meter: { chosen: 0, byName: 0, silent: 0, total: 0 }, meter_text: '', note: '' });
  });

  it('reads 0 with no captions for an empty board', () => {
    expect(activationOverview(machine, [])).toEqual({ value: '0', meter: { chosen: 0, byName: 0, silent: 0, total: 0 }, meter_text: '', note: '' });
  });

  it('draws no rate', () => {
    const a = activationOverview(machine, ['deploy-check', 'release-notes'].map(name => card(name)));
    expect(a.value + a.meter_text + a.note).not.toMatch(/%/);
  });
});

describe('windowDays and the small helpers', () => {
  it('spans every calendar day the window touches', () => {
    const days = windowDays({ since: '2026-08-16T00:00:00.000Z', until: '2026-09-15T00:00:00.000Z' });
    expect(days).toHaveLength(31);
    expect(days).toContain('2026-09-01');
    expect(days.every((d, i) => i === 0 || d > days[i - 1]!)).toBe(true);
  });

  it('steps by calendar date across a daylight-saving change, so no day repeats or vanishes', () => {
    // 2025-09-15 to 2026-09-15 crosses both changes in every zone that observes one; 365 days, 366 dates.
    const days = windowDays({ since: '2025-09-15T12:00:00.000Z', until: '2026-09-15T12:00:00.000Z' });
    expect(days).toHaveLength(366);
    expect(new Set(days).size).toBe(366);
    expect(days[0]).toBe('2025-09-15');
    expect(days[365]).toBe('2026-09-15');
  });

  it('counts days ago against the report clock, never the app clock', () => {
    const until = '2026-09-15T12:00:00.000Z';
    expect(daysAgoLabel(until, '2026-09-15')).toBe('today');
    expect(daysAgoLabel(until, '2026-09-14')).toBe('yesterday');
    expect(daysAgoLabel(until, '2026-09-03')).toBe('12 days ago');
  });

  it('reads the window from the URL and falls back to the CLI default', () => {
    expect(parseWindow('90')).toBe(90);
    expect(parseWindow('365')).toBe(365);
    expect(parseWindow(undefined)).toBe(30);
    expect(parseWindow('7')).toBe(30);
    expect(parseWindow('nope')).toBe(30);
  });

  it('reads two windows back and never less than a year, so the calendar always has one', () => {
    expect(historyDays(30)).toBe(365);
    expect(historyDays(90)).toBe(365);
    expect(historyDays(365)).toBe(732);
  });
});

// ---- Per-day projections. Days are the machine's own calendar days, so fixtures sit at noon UTC
// and the window's bounds are checked by length, never by which local date they fall on.

const daily = (rows: [string, string, number, number][]): UsageDay[] => rows.map(([day, skill, d1, d2]) => ({ day, skill, d1, d2 }));
const dated = (skill: string, placedAt: string | null, d1 = 0, d2 = 0): UsageRow => ({ ...row(skill, d1, d2), placedAt, availability: placedAt === null ? 'unknown' : 'full' });
/** A 30-day window report and the year-long read behind it. */
function reads(rows: UsageRow[], windowDaily: UsageDay[], olderDaily: UsageDay[], unrecognised: UsageReport['unrecognised'] = []): { window: UsageReport; older: UsageReport } {
  const window: UsageReport = { ...report(rows, unrecognised), since: '2026-08-16T12:00:00.000Z', until: '2026-09-15T12:00:00.000Z', daily: windowDaily };
  const older: UsageReport = { ...report(rows, unrecognised), since: '2025-09-15T12:00:00.000Z', until: '2026-09-15T12:00:00.000Z', daily: olderDaily };
  return { window, older };
}
const screening = (groups: MissesModel['groups'], since = '2026-09-08T12:00:00.000Z'): MissesModel => ({ groups, screened: 40, calls: 4, truncated: false, unjudged: 0, since, until: '2026-09-15T12:00:00.000Z', caveats: [] });

describe('history — the window is the authority for its own days', () => {
  it('draws nothing per day on a CLI that predates the buckets, rather than an empty calendar', () => {
    const { window, older } = reads([dated('a', null, 1, 0)], [], []);
    expect(history({ ...window, daily: null }, older)).toBeNull();
    expect(history(window, { ...older, daily: null })).toBeNull();
  });

  it('takes the window read for its days and the longer read only for the days before', () => {
    // The older read disagrees about 1 Sep (read at another moment); the window's answer wins.
    const { window, older } = reads([dated('a', null, 1, 0)], daily([['2026-09-01', 'a', 1, 0]]), daily([['2026-09-01', 'a', 5, 5], ['2026-08-01', 'a', 2, 1]]));
    const h = history(window, older)!;
    expect(h.days[h.start]).toBe('2026-08-16');
    expect(h.days).toHaveLength(366);
    expect(h.days.length - h.start).toBe(31);
    const a = h.bySkill.get('a')!, at = (day: string) => [a.d1[h.days.indexOf(day)], a.d2[h.days.indexOf(day)]];
    expect(at('2026-09-01')).toEqual([1, 0]);
    expect(at('2026-08-01')).toEqual([2, 1]);
  });
});

describe('scopeTimeline — the popup\'s three lines', () => {
  const { window, older } = reads(
    [dated('a', '2026-07-01T12:00:00.000Z', 1, 2), dated('b', '2026-09-05T12:00:00.000Z', 1, 0)],
    daily([['2026-09-01', 'a', 1, 0], ['2026-09-03', 'a', 0, 2], ['2026-09-08', 'b', 1, 0], ['2026-09-08', 'other', 9, 9]]),
    daily([['2026-08-01', 'a', 1, 1], ['2026-07-20', 'c', 0, 1]]),
  );
  const h = history(window, older)!, cards = [card('a'), card('b'), card('c')];

  it('runs the root\'s firings up to the window total, and leaves other skills out', () => {
    const t = scopeTimeline(h, window, cards, null);
    expect(t.days).toHaveLength(31);
    expect(t.cumulative[t.cumulative.length - 1]).toBe(4);
    expect(t.fires[t.days.indexOf('2026-09-03')]).toBe(2);
    expect(t.autonomous[t.days.indexOf('2026-09-03')]).toBe(0);
    // 'other' fired nine-and-nine on 8 Sep; it is not on this root.
    expect(t.fires[t.days.indexOf('2026-09-08')]).toBe(1);
    expect(t.total).toBe(3);
  });

  it('sets the window before beside it, day for day', () => {
    const t = scopeTimeline(h, window, cards, null);
    expect(t.previous).toHaveLength(31);
    // a on 1 Aug (2) and c on 20 Jul (1) both fall in the 31 days before 16 Aug.
    expect(t.previous![t.previous!.length - 1]).toBe(3);
  });

  it('counts a skill dead once a full window has passed without a firing, and a later placement only from its day', () => {
    const t = scopeTimeline(h, window, cards, null), at = (day: string) => t.dead[t.days.indexOf(day)];
    // 16 Aug: a fired 1 Aug and c on 20 Jul, both within the 31 days before; b is not placed yet.
    expect(at('2026-08-16')).toBe(0);
    expect(t.present[t.days.indexOf('2026-08-16')]).toBe(2);
    // 20 Aug: c's firing has left the run of 31 days, so c is dead.
    expect(at('2026-08-20')).toBe(1);
    // 5 Sep: b arrives and has not fired.
    expect(at('2026-09-05')).toBe(2);
    expect(at('2026-09-08')).toBe(1);
    // The last day is the tile's "never fired" for these three: only c.
    expect(t.dead[t.dead.length - 1]).toBe(activationOverview(window, cards).meter.silent);
  });

  it('draws misfires only once a screening exists, over the days it covered, for this root alone', () => {
    expect(scopeTimeline(h, window, cards, null).misfires).toBeNull();
    const m = scopeTimeline(h, window, cards, screening([{ skill: 'a', candidates: [{ prompt: 'p', ts: '2026-09-10T12:00:00.000Z', noPriorContext: false }, { prompt: 'q', ts: '2026-09-12T12:00:00.000Z', noPriorContext: true }] }, { skill: 'zzz', candidates: [{ prompt: 'r', ts: '2026-09-10T12:00:00.000Z', noPriorContext: false }] }])).misfires!;
    expect(m.total).toBe(2);
    expect(m.from).toBe(t0('2026-09-08'));
    expect(m.cumulative[m.cumulative.length - 1]).toBe(2);
    expect(m.cumulative).toHaveLength(m.to - m.from + 1);
  });

  it('leaves the bundled manual out, as the tile does', () => {
    expect(scopeTimeline(h, window, [card('a'), card('terum-skills', ['bundled'])], null).total).toBe(1);
  });

  function t0(day: string): number { return scopeTimeline(h, window, cards, null).days.indexOf(day); }
});

describe('skillRows — one row per skill, counted as the tile counts', () => {
  const { window, older } = reads(
    [dated('a', '2026-07-01T12:00:00.000Z', 1, 2), dated('quiet', '2026-06-01T12:00:00.000Z', 0, 0)],
    daily([['2026-09-01', 'a', 1, 0], ['2026-09-03', 'a', 0, 2]]),
    daily([['2026-08-05', 'quiet', 1, 1]]),
    [{ skill: 'loose', d1: 0, d2: 0 }],
  );
  const h = history(window, older)!;

  it('sorts by firings, then by name, and takes its counts from the window report', () => {
    const rows = skillRows(h, window, [card('quiet'), card('zz'), card('a')], null);
    expect(rows.map(r => r.card.name)).toEqual(['a', 'quiet', 'zz']);
    expect(rows[0]).toMatchObject({ d1: 1, d2: 2, total: 3, previous: 0, lastFired: '2026-09-03' });
    expect(rows[0]!.bins).toHaveLength(31);
    expect(rows[0]!.bins!.find(b => b.from === '2026-09-03')).toMatchObject({ d1: 0, d2: 2 });
  });

  it('reaches before the window for a quiet skill: when it last fired, and what the window before held', () => {
    const quiet = skillRows(h, window, [card('quiet')], null)[0]!;
    expect(quiet.total).toBe(0);
    expect(quiet.lastFired).toBe('2026-08-05');
    expect(quiet.previous).toBe(2);
    expect(quiet.misfires).toBeNull();
  });

  it('counts screened candidates in the window, and keeps the row when there is no per-day history', () => {
    const rows = skillRows(h, window, [card('a')], screening([{ skill: 'a', candidates: [{ prompt: 'p', ts: '2026-09-10T12:00:00.000Z', noPriorContext: false }] }]));
    expect(rows[0]!.misfires).toBe(1);
    const flat = skillRows(null, window, [card('a')], null)[0]!;
    expect(flat).toMatchObject({ total: 3, bins: null, lastFired: null, previous: null });
  });
});

describe('activationFindings — what stands out, in counts', () => {
  const { window, older } = reads(
    [dated('loud', '2026-06-01T12:00:00.000Z', 1, 3), dated('named', '2026-06-01T12:00:00.000Z', 0, 3), dated('sleeper', '2026-06-01T12:00:00.000Z'), dated('quiet', '2026-06-01T12:00:00.000Z'), dated('broken', '2026-06-01T12:00:00.000Z'), dated('fresh', '2026-09-03T12:00:00.000Z', 2, 0), dated('half', '2026-06-01T12:00:00.000Z')],
    daily([['2026-09-01', 'loud', 1, 3], ['2026-09-02', 'named', 0, 3], ['2026-09-06', 'fresh', 2, 0]]),
    daily([['2026-08-05', 'quiet', 1, 0]]),
  );
  const h = history(window, older)!;
  const cards = [
    card('loud', [], verdict('FAIL', [1, 5, 3])), card('named', [], verdict('PASS', [11, 3, 4])), card('sleeper', [], verdict('PASS', [7, 0, 2])),
    card('quiet', [], verdict('PASS', [6, 2, 1])), card('broken', [], verdict('FAIL', [0, 5, 4])), card('fresh'), card('half', [], verdict('PASS', [5, 0, 2], [7, 9])),
  ];
  const findings = activationFindings(skillRows(h, window, cards, null), 30, window.until);
  const titled = (text: string) => findings.find(f => f.title.includes(text));

  it('names each case once, worst first', () => {
    expect(findings.map(f => f.tone)).toEqual(['bad', 'warn', 'warn', 'quiet', 'quiet', 'good']);
    expect(titled('keeps firing and fails its evals')?.body).toBe('4 firings in the last 30 days, and it lost 5 of its 9 eval cases.');
    expect(titled('only fires when named')?.body).toMatch(/^Never chosen from its description: all 3 firings/);
    expect(titled('passes its evals but never fires')?.skills).toEqual(['sleeper']);
    expect(titled('went quiet')?.body).toBe('1 firing in the 30 days before, none since 5 Aug.');
    expect(titled('fails its evals and never fires')?.skills).toEqual(['broken']);
    expect(titled('took hold')?.body).toBe('Placed 3 Sep and fired 2 times since, 2 of them chosen by the model.');
  });

  it('never leans on a partial eval run', () => {
    expect(findings.some(f => f.skills.includes('half'))).toBe(false);
  });

  it('adds what a screening found, and states no rate anywhere', () => {
    const screened = activationFindings(skillRows(h, window, cards, screening([{ skill: 'named', candidates: [{ prompt: 'p', ts: '2026-09-10T12:00:00.000Z', noPriorContext: false }] }])), 30, window.until);
    expect(screened.find(f => f.skills.includes('named'))?.body).toMatch(/The last screening found 1 prompt it should have caught\.$/);
    for (const f of screened) expect(f.title + f.body).not.toMatch(/\d%/);
  });
});

describe('skillActivity and yearCalendar — the skill page', () => {
  const { window, older } = reads(
    [dated('a', '2026-07-01T12:00:00.000Z', 3, 2)],
    daily([['2026-09-01', 'a', 1, 0], ['2026-09-02', 'a', 0, 1], ['2026-09-03', 'a', 2, 1]]),
    daily([['2026-07-06', 'a', 1, 0], ['2026-08-01', 'a', 0, 1]]),
  );
  const h = history(window, older)!;

  it('reads the window\'s figures and the record\'s milestones', () => {
    const a = skillActivity(h, window, 'a');
    expect(a).toMatchObject({ d1: 3, d2: 2, total: 5, previous: 1, activeDays: 3, days: 31, lastFired: '2026-09-03', firstFired: '2026-07-06', onRecord: 7, placedAt: '2026-07-01' });
    expect(a.streak).toEqual({ length: 3, from: '2026-09-01', to: '2026-09-03' });
    expect(a.busiestWeek).toEqual({ total: 5, from: '2026-08-28', to: '2026-09-03' });
  });

  it('draws a year for a short window, bracketing the window, and outlines the days before placement', () => {
    const c = yearCalendar(h, window, 'a');
    expect(c.cells).toHaveLength(365);
    expect(c.total).toBe(7);
    expect(c.windowColumn).not.toBeNull();
    expect(c.placedDay).toBe('2026-07-01');
    expect(c.cells.find(x => x.day === '2026-06-30')?.beforePlacement).toBe(true);
    expect(c.cells.find(x => x.day === '2026-07-01')?.beforePlacement).toBe(false);
    expect(c.cells.find(x => x.day === '2026-09-03')).toMatchObject({ total: 3, level: 4 });
    expect(c.months.length).toBeGreaterThanOrEqual(12);
  });

  it('draws the window itself when the window is the year, so the two counts agree', () => {
    const year: UsageReport = { ...older, daily: older.daily };
    const longer: UsageReport = { ...older, since: '2024-09-12T12:00:00.000Z' };
    const hy = history(year, longer)!, c = yearCalendar(hy, year, 'a');
    expect(c.cells).toHaveLength(hy.days.length - hy.start);
    expect(c.windowColumn).toBeNull();
  });
});

describe('skillNote — one note per outcome, no two outcomes share one', () => {
  const base: SkillActivity = { firings: null, d1: 0, d2: 0, total: 0, previous: 0, activeDays: 0, days: 31, streak: null, lastFired: null, firstFired: null, busiestWeek: null, onRecord: 0, recordFrom: '2025-09-15', placedAt: null };
  const firings = (d1: number, d2: number, placed = true): SkillActivity => ({ ...base, firings: { d1, d2, autonomy: d1 + d2 === 0 ? null : d1 / (d1 + d2), availability: 'full', placed }, d1, d2, total: d1 + d2 });
  const notes = [
    skillNote(base, null, 30, null),
    skillNote(firings(0, 0), null, 30, null),
    skillNote(firings(0, 4), null, 30, null),
    skillNote(firings(3, 0), null, 30, null),
    skillNote(firings(3, 1), verdict('FAIL', [1, 5, 3]), 30, null),
  ];

  it('keeps the outcomes apart, and does not brand a skill the model chooses', () => {
    expect(new Set(notes.map(n => n?.title ?? null)).size).toBe(5);
    expect(notes[3]).toBeNull();
  });

  it('names the case the feature exists for, and only that case', () => {
    expect(notes[2]?.body).toMatch(/Never chosen from its description/);
    for (const other of [notes[0], notes[1], notes[4]]) expect(other?.body ?? '').not.toMatch(/Never chosen/);
  });

  it('says placed-and-never-fired rather than nothing, and nothing-recorded rather than not-installed', () => {
    expect(notes[1]?.title).toMatch(/Placed here and never fired/);
    expect(notes[0]?.title).toMatch(/No firings recorded/);
    expect(notes[0]?.title + ' ' + notes[0]?.body).not.toMatch(/[Nn]ot installed/);
  });

  it('says why a silent skill is silent when the record can', () => {
    expect(skillNote({ ...firings(0, 0), previous: 2, lastFired: '2026-08-01' }, null, 30, null)?.body).toBe('It fired 2 times in the 30 days before, last on 1 Aug.');
    expect(skillNote(firings(0, 0), verdict('PASS', [7, 0, 2]), 30, 3)?.body).toMatch(/description probably does not match how you ask\. The last screening found 3 prompts it should have caught\.$/);
  });

  it('states no rate anywhere', () => { for (const n of notes) expect((n?.title ?? '') + (n?.body ?? '')).not.toMatch(/\d%/); });
});
