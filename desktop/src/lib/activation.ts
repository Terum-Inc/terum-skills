import type { MissesModel, ReceiptSummary, SkillCard, UsageDay, UsageModel, UsageReport, UsageWindow } from '../backend/types';
import { USAGE_WINDOWS } from '../backend/types';

/**
 * Activation — what the CLI's `usage` verb knows about a skill firing on this machine, projected
 * for the two surfaces that draw it: a skill page's Activity tab and a Library root's Activation
 * tile and the popup it opens. Every surface reads the SAME whole-machine reports (Backend.usage,
 * one per span) and projects here, so the tab, the tile and the popup can never disagree about what
 * fired.
 *
 * Two reads, one table (`history`): the window's own report is the authority for every day it
 * covers — its rows are what the tile counts, and its `daily` buckets are the same tally by day —
 * and a longer read fills only the days before the window opened. That longer read is what lets a
 * day look a full window back (dead skills), the window be set against the one before it, and a
 * skill page draw a year.
 *
 * Every function is pure over the reports. None of them derives a rate, and nothing here implies a
 * skill *helped*: the counts are invocations.
 *
 * Days are the machine's own calendar days, as the CLI buckets them (`daily`); a report's bounds
 * are instants, so a window's first and last days are their local dates.
 */

const DAY = 86_400_000;
const pad = (n: number): string => String(n).padStart(2, '0');
/** The machine's own calendar date for an instant — the same rule the CLI's `localDay` applies. */
export function localDay(ts: string): string { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
/** A `YYYY-MM-DD` as a local-midnight Date, so arithmetic on it stays on calendar days. */
export function parseDay(day: string): Date { const [y, m, d] = day.split('-').map(Number); return new Date(y!, m! - 1, d!); }
const dayOf = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
/** Every calendar day the window touches, first to last. Stepped by calendar date, never by 24 hours:
 *  a day that gains or loses an hour at a daylight-saving change would otherwise repeat or vanish. */
export function windowDays(report: Pick<UsageReport, 'since' | 'until'>): string[] {
 const cursor = parseDay(localDay(report.since)), last = localDay(report.until);
 const days: string[] = [];
 for (let day = dayOf(cursor); day <= last; cursor.setDate(cursor.getDate() + 1), day = dayOf(cursor)) days.push(day);
 return days;
}
/** Whole calendar days from one date to another, by date rather than by 24-hour steps. */
const daysBetween = (from: string, to: string): number => Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY);
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
/** "Tue 9 Sep" — how a day is named to a person. Fixed names, not the host locale: ICU's en-GB says "Sept". */
export function dayLabel(day: string): string { const d = parseDay(day); return `${WEEKDAYS[weekdayIndex(day)]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; }
/** "9 Sep" — an axis tick. */
export function shortDayLabel(day: string): string { const d = parseDay(day); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; }
/** "9 Sep 2026" — a date that may sit in another year. */
export function fullDayLabel(day: string): string { const d = parseDay(day); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
/** "3–5 Sep", or "30 Aug – 5 Sep" across a month. */
export function dayRangeLabel(from: string, to: string): string {
 if (from === to) return shortDayLabel(from);
 const a = parseDay(from), b = parseDay(to);
 return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear() ? `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}` : `${shortDayLabel(from)} – ${shortDayLabel(to)}`;
}
/** Monday-first weekday index, 0..6. */
export const weekdayIndex = (day: string): number => (parseDay(day).getDay() + 6) % 7;
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * One skill's firings out of the whole-machine report.
 *
 * Three sources, in order, because an observed firing is evidence no matter who placed the copy:
 *
 *  1. a **row** — this skill is in Terum's `placements` ledger, so its availability is known;
 *  2. the **`unrecognised` tail** — it fired here but Terum did not place it (a hand-installed
 *     folder under `~/.claude/skills/`, which the app itself labels "yours, not placed by Terum").
 *     `placed: false`, availability unknown, because no ledger row means no `placed_at`;
 *  3. neither — nothing was observed. That is NOT the same as "not installed", and the tab must
 *     not claim it is: this model sees firings, not the filesystem.
 *
 * Dropping case 2 was a real bug — `decision-walk` had four recorded firings and the tab said there
 * was nothing to observe, while the rail beside it read "Installed · on this machine".
 */
export function skillUsage(report: UsageReport, skill: string): UsageModel {
 const row = report.rows.find(r => r.skill === skill);
 const loose = row === undefined ? report.unrecognised.find(r => r.skill === skill) : undefined;
 const firings: UsageModel['firings'] = row !== undefined
  ? { d1: row.d1, d2: row.d2, autonomy: row.autonomy, availability: row.availability, placed: true }
  : loose !== undefined
   ? { d1: loose.d1, d2: loose.d2, autonomy: loose.d1 + loose.d2 === 0 ? null : loose.d1 / (loose.d1 + loose.d2), availability: 'unknown', placed: false }
   : null;
 return { firings, since: report.since, until: report.until, caveats: report.caveats };
}

/** "last 30 days" — the window's length in days, from the report's own bounds, never assumed. */
export function windowLabel(report: Pick<UsageReport, 'since' | 'until'>): string {
 const days = Math.max(1, Math.round((Date.parse(report.until) - Date.parse(report.since)) / DAY));
 return `last ${days} day${days === 1 ? '' : 's'}`;
}
/** The window as a sentence names it, and the one before it: "the last 30 days" / "the 30 days before". */
export function windowPhrase(days: UsageWindow): { current: string; previous: string } {
 return days === 365 ? { current: 'the last year', previous: 'the year before' } : { current: `the last ${days} days`, previous: `the ${days} days before` };
}

export interface ActivationOverview {
 /** "4 of 15": skills on this board that fired, over the skills reckoned. */
 value: string;
 /** The meter's three segments; `total` is every reckoned skill so the never-fired remainder is its own segment. */
 meter: { chosen: number; byName: number; silent: number; total: number };
 meter_text: string;
 /** The window, then the hedges the counts need: skills placed part-way through it. '' at total 0. */
 note: string;
}

/** The cards a Library root reckons: the manual that setup places is out, it is reached for by name by design. */
export const reckoned = (skills: readonly SkillCard[]): SkillCard[] => skills.filter(skill => !skill.flags.includes('bundled'));

/**
 * The Library root's Activation tile, from the whole-machine report joined to this root's cards by
 * name — the name is what the Placer wrote and what a firing record names. Three buckets, and
 * every reckoned card lands in exactly one: **chosen** (the model picked it from its description at
 * least once), **by name only** (fired, but only because a person named it — autonomy 0, the
 * annotation `usage` exists for), **never fired** (nothing observed, whether or not the ledger has a
 * row: this tile reads transcripts, not the filesystem, so it makes no installed-or-not claim).
 *
 * A firing from a copy Terum did not place counts — it is evidence, the same rule as `skillUsage`.
 * Bundled folders are out of the reckoning: the manual is reached for by name by design, and it
 * would brand itself "by name only" and skew the meter of every library that carries it.
 */
export function activationOverview(report: UsageReport, skills: readonly SkillCard[]): ActivationOverview {
 const cards = reckoned(skills);
 let chosen = 0, byName = 0, partial = 0;
 for (const card of cards) {
  const { firings } = skillUsage(report, card.name);
  if (firings === null || firings.d1 + firings.d2 === 0) continue;
  if (firings.d1 > 0) chosen += 1; else byName += 1;
  if (firings.availability === 'partial') partial += 1;
 }
 const total = cards.length, fired = chosen + byName, silent = total - fired;
 return {
  value: total === 0 ? '0' : `${fired} of ${total}`,
  meter: { chosen, byName, silent, total },
  meter_text: total === 0 ? '' : `${chosen} chosen by the model · ${byName} by name only · ${silent} never fired`,
  note: total === 0 ? '' : windowLabel(report) + (partial > 0 ? ` · ${partial} placed mid-window` : ''),
 };
}

/** "today", "yesterday", "12 days ago" — a calendar day against the report's own end, never the app clock. */
export function daysAgoLabel(until: string, day: string): string {
 const k = daysBetween(day, localDay(until));
 return k <= 0 ? 'today' : k === 1 ? 'yesterday' : `${k} days ago`;
}

/** The `?window=` URL value as one of the offered windows; anything else is the CLI's own 30 days. */
export function parseWindow(value: string | undefined): UsageWindow { const n = Number(value); return (USAGE_WINDOWS as readonly number[]).includes(n) ? (n as UsageWindow) : 30; }

/** How far back the second read reaches for a window: two windows and a margin, so every day in the
 *  window can look a full window back and the window before it can be counted whole; and at least a
 *  year, so a skill page always has its calendar. 30 and 90 share one read (365), a year reads two. */
export function historyDays(days: UsageWindow): number { return Math.max(365, 2 * days + 2); }

// ---- The per-day table. Everything below returns null when either report carries no `daily` (a
// CLI that predates the buckets), so a surface can say why the calendar is missing rather than
// drawing an empty one that would read as "never fired".

export interface DayCounts { d1: number[]; d2: number[] }
export interface History {
 /** Every calendar day on record, oldest first, ending on the window's last day. */
 days: string[];
 /** Index of the window's first day in `days`: the window is `days.slice(start)`. */
 start: number;
 /** The window report's own end, for "days ago". */
 until: string;
 /** Per skill name, counts aligned with `days`. A name that never fired is absent. */
 bySkill: Map<string, DayCounts>;
}

/** The window's report for its own days, the longer read for the days before it. */
export function history(window: UsageReport, older: UsageReport): History | null {
 if (window.daily === null || older.daily === null) return null;
 const inWindow = windowDays(window), first = inWindow[0] ?? localDay(window.until);
 const days = [...windowDays(older).filter(day => day < first), ...inWindow];
 const index = new Map(days.map((day, i) => [day, i]));
 const bySkill = new Map<string, DayCounts>();
 const add = (d: UsageDay): void => {
  const i = index.get(d.day); if (i === undefined) return;
  let counts = bySkill.get(d.skill);
  if (counts === undefined) { counts = { d1: days.map(() => 0), d2: days.map(() => 0) }; bySkill.set(d.skill, counts); }
  counts.d1[i]! += d.d1; counts.d2[i]! += d.d2;
 };
 for (const d of older.daily) if (d.day < first) add(d);
 for (const d of window.daily) add(d);
 return { days, start: days.length - inWindow.length, until: window.until, bySkill };
}
const firedOn = (counts: DayCounts | undefined, i: number): number => counts === undefined ? 0 : counts.d1[i]! + counts.d2[i]!;
function sumOver(counts: DayCounts | undefined, from: number, to: number): { d1: number; d2: number } {
 let d1 = 0, d2 = 0;
 if (counts !== undefined) for (let i = Math.max(0, from); i < to; i += 1) { d1 += counts.d1[i]!; d2 += counts.d2[i]!; }
 return { d1, d2 };
}
/** The window before this one, day for day; null when the record does not reach that far back. */
function previousRange(h: History): [number, number] | null { const n = h.days.length - h.start; return h.start - n < 0 ? null : [h.start - n, h.start]; }
function lastFiredDay(h: History, counts: DayCounts | undefined): string | null { for (let i = h.days.length - 1; i >= 0; i -= 1) if (firedOn(counts, i) > 0) return h.days[i]!; return null; }
/** The ledger's placement day for a name, or null when it records none or has no row. */
function placedDay(report: UsageReport, name: string): string | null { const at = report.rows.find(r => r.skill === name)?.placedAt ?? null; return at === null ? null : localDay(at); }

// ---- The Library popup: three lines over the window, a row per skill, and the findings.

export interface ScopeTimeline {
 /** The window's days. */
 days: string[];
 /** Firings of this root's skills per day, and the part of them the model chose. */
 fires: number[]; autonomous: number[];
 /** The running total of `fires` through each day. */
 cumulative: number[];
 /** The running total over the window before, day for day; null when the record is too short. */
 previous: number[] | null;
 /** Reckoned skills present that day with no firing in the window-length run of days ending that day.
  *  The last value is the tile's "never fired". A skill the ledger placed later is not yet present. */
 dead: number[];
 /** Reckoned skills present each day: the "of N" beside `dead`. */
 present: number[];
 /** Miss candidates for this root, over the screened days inside the window; null until a screening. */
 misfires: { from: number; to: number; perDay: number[]; cumulative: number[]; total: number } | null;
 total: number;
}

/**
 * The Library root's three lines. Fires and misfires are running totals, so each line ends on the
 * number printed beside it; dead skills is a level. Misfires are the miss screening's candidates by
 * their prompt's day, drawn only across the days the screening covered (7 by default) — a flat line
 * before them would read as "no misses" where nothing was asked. Candidates, never a miss rate.
 */
export function scopeTimeline(h: History, window: UsageReport, skills: readonly SkillCard[], misses: MissesModel | null): ScopeTimeline {
 const cards = reckoned(skills), n = h.days.length - h.start, days = h.days.slice(h.start);
 const fires = days.map(() => 0), autonomous = days.map(() => 0);
 for (const card of cards) { const c = h.bySkill.get(card.name); if (c === undefined) continue; for (let k = 0; k < n; k += 1) { fires[k]! += c.d1[h.start + k]! + c.d2[h.start + k]!; autonomous[k]! += c.d1[h.start + k]!; } }
 let run = 0; const cumulative = fires.map(v => (run += v));
 const prev = previousRange(h);
 let previous: number[] | null = null;
 if (prev !== null) {
  let total = 0; previous = [];
  for (let k = 0; k < n; k += 1) { for (const card of cards) total += firedOn(h.bySkill.get(card.name), prev[0] + k); previous.push(total); }
 }
 // The last firing on or before each day, per card, so "silent for a window" is one comparison.
 const arrivals = cards.map(card => {
  const counts = h.bySkill.get(card.name), last: number[] = [];
  let seen = -1; for (let i = 0; i < h.days.length; i += 1) { if (firedOn(counts, i) > 0) seen = i; last.push(seen); }
  return { placed: placedDay(window, card.name), last };
 });
 const dead: number[] = [], present: number[] = [];
 for (let k = 0; k < n; k += 1) {
  const i = h.start + k, day = h.days[i]!;
  let here = 0, silent = 0;
  for (const a of arrivals) { if (a.placed !== null && a.placed > day) continue; here += 1; if (a.last[i]! < i - n + 1) silent += 1; }
  dead.push(silent); present.push(here);
 }
 let misfires: ScopeTimeline['misfires'] = null;
 if (misses !== null) {
  const names = new Set(cards.map(c => c.name)), index = new Map(days.map((d, k) => [d, k])), perDay = days.map(() => 0);
  let lo = index.get(localDay(misses.since)) ?? (localDay(misses.since) < days[0]! ? 0 : n), hi = index.get(localDay(misses.until)) ?? (localDay(misses.until) > days[n - 1]! ? n - 1 : -1);
  for (const group of misses.groups) {
   if (!names.has(group.skill)) continue;
   for (const c of group.candidates) { const k = index.get(localDay(c.ts)); if (k === undefined) continue; perDay[k]! += 1; lo = Math.min(lo, k); hi = Math.max(hi, k); }
  }
  let total = 0; const cum: number[] = [];
  for (let k = lo; k <= hi; k += 1) { total += perDay[k]!; cum.push(total); }
  misfires = { from: lo, to: hi, perDay, cumulative: cum, total };
 }
 return { days, fires, autonomous, cumulative, previous, dead, present, misfires, total: cards.length };
}

export interface SkillRow {
 card: SkillCard;
 /** The window's counts, exactly as the tile reads them (`skillUsage`); null when nothing was observed. */
 firings: UsageModel['firings'];
 d1: number; d2: number; total: number;
 /** Firings in the window before; null when the record does not reach that far back. */
 previous: number | null;
 /** Per day at 30 days, per Monday-first week beyond; null without per-day buckets. */
 bins: { from: string; to: string; d1: number; d2: number }[] | null;
 /** This skill's candidates in the window from the latest screening; null until one has run. */
 misfires: number | null;
 /** The last day on record with a firing, which may sit before the window. */
 lastFired: string | null;
 placedAt: string | null;
}

/** One row per reckoned card, busiest first; ties by name. Sorted by firings, never by a receipt number. */
export function skillRows(h: History | null, window: UsageReport, skills: readonly SkillCard[], misses: MissesModel | null): SkillRow[] {
 const n = h === null ? 0 : h.days.length - h.start, prev = h === null ? null : previousRange(h);
 const days = h === null ? [] : h.days.slice(h.start);
 const groups: [number, number][] = [];
 if (h !== null) {
  if (n <= 31) for (let k = 0; k < n; k += 1) groups.push([k, k]);
  else { let from = 0; for (let k = 0; k < n; k += 1) if (weekdayIndex(days[k]!) === 6 || k === n - 1) { groups.push([from, k]); from = k + 1; } }
 }
 const inWindow = (ts: string): boolean => { const day = localDay(ts); return days.length > 0 ? day >= days[0]! && day <= days[n - 1]! : true; };
 const rows = reckoned(skills).map((card): SkillRow => {
  const firings = skillUsage(window, card.name).firings, counts = h?.bySkill.get(card.name);
  const d1 = firings?.d1 ?? 0, d2 = firings?.d2 ?? 0;
  const bins = h === null ? null : groups.map(([a, b]) => ({ from: days[a]!, to: days[b]!, ...sumOver(counts, h.start + a, h.start + b + 1) }));
  const previous = h === null || prev === null ? null : ((s) => s.d1 + s.d2)(sumOver(counts, prev[0], prev[1]));
  const candidates = misses?.groups.find(g => g.skill === card.name)?.candidates ?? [];
  return { card, firings, d1, d2, total: d1 + d2, previous, bins, misfires: misses === null ? null : candidates.filter(c => inWindow(c.ts)).length, lastFired: h === null ? null : lastFiredDay(h, counts), placedAt: placedDay(window, card.name) };
 });
 return rows.sort((a, b) => b.total - a.total || a.card.name.localeCompare(b.card.name));
}

export type Tone = 'bad' | 'warn' | 'quiet' | 'good';
export interface Finding { tone: Tone; title: string; body: string; skills: string[] }
/** A verdict the findings may lean on: a whole run's, never a partial one's. */
const verdictOf = (summary: ReceiptSummary | null): ReceiptSummary['verdict'] | null => summary === null || summary.partial !== null ? null : summary.verdict;
const missClause = (misfires: number | null, subject: string): string => misfires ? ` The last screening found ${plural(misfires, 'prompt')} ${subject} should have caught.` : '';

/**
 * What stands out on this root, in plain sentences, worst first. Each one is a statement of counts —
 * firings, eval cases, screened prompts — joined to the card's own verdict; none is a rate. A partial
 * eval run's verdict is never leaned on. "Took hold" is about the last month whatever the window.
 */
export function activationFindings(rows: readonly SkillRow[], days: UsageWindow, until: string): Finding[] {
 const { current, previous } = windowPhrase(days), out: Finding[] = [];
 const verdict = (r: SkillRow) => verdictOf(r.card.summary);
 for (const r of rows) if (verdict(r) === 'FAIL' && r.total >= 3) out.push({ tone: 'bad', title: `${r.card.name} keeps firing and fails its evals`, body: `${plural(r.total, 'firing')} in ${current}, and it lost ${r.card.summary!.l} of its ${plural(r.card.summary!.n, 'eval case')}.`, skills: [r.card.name] });
 for (const r of rows) if (r.total >= 3 && r.d1 === 0) out.push({ tone: 'warn', title: `${r.card.name} only fires when named`, body: `Never chosen from its description: all ${plural(r.total, 'firing')} in ${current} were typed by name.${missClause(r.misfires, 'it')}`, skills: [r.card.name] });
 const quiet = rows.filter(r => r.total === 0 && (r.previous ?? 0) > 0);
 const sleepers = rows.filter(r => verdict(r) === 'PASS' && r.total === 0 && !quiet.includes(r));
 if (sleepers.length) {
  const missed = sleepers.reduce((sum, r) => sum + (r.misfires ?? 0), 0);
  out.push({ tone: 'warn', title: sleepers.length === 1 ? `${sleepers[0]!.card.name} passes its evals but never fires` : `${sleepers.length} skills pass their evals but never fire`, body: `${sleepers.length === 1 ? 'It wins its eval cases when it runs, so the skill is not the problem' : 'They win their eval cases when they run, so the skills are not the problem'}; the description probably does not match how you ask.${missClause(missed || null, sleepers.length === 1 ? 'it' : 'they')}`, skills: sleepers.map(r => r.card.name) });
 }
 for (const r of quiet) out.push({ tone: 'quiet', title: `${r.card.name} went quiet`, body: `${plural(r.previous!, 'firing')} in ${previous}, none since${r.lastFired === null ? '' : ` ${shortDayLabel(r.lastFired)}`}.${missClause(r.misfires, 'it')}`, skills: [r.card.name] });
 for (const r of rows) if (verdict(r) === 'FAIL' && r.total === 0) out.push({ tone: 'quiet', title: `${r.card.name} fails its evals and never fires`, body: `Nothing depended on it in ${current}. A candidate to remove.`, skills: [r.card.name] });
 const lastDay = localDay(until);
 for (const r of rows) if (r.placedAt !== null && daysBetween(r.placedAt, lastDay) < 30 && r.total > 0) out.push({ tone: 'good', title: `${r.card.name} took hold`, body: `Placed ${shortDayLabel(r.placedAt)} and fired ${plural(r.total, 'time')} since, ${r.d1} of them chosen by the model.`, skills: [r.card.name] });
 return out;
}

// ---- The skill page.

export interface SkillActivity {
 /** The window's counts, exactly as the tile and the popup read them. */
 firings: UsageModel['firings'];
 d1: number; d2: number; total: number;
 previous: number | null;
 /** Days in the window with a firing, over the days of the window. */
 activeDays: number; days: number;
 /** The longest run of consecutive firing days inside the window. */
 streak: { length: number; from: string; to: string } | null;
 /** The whole record, which may reach before the window. */
 lastFired: string | null;
 firstFired: string | null;
 busiestWeek: { total: number; from: string; to: string } | null;
 onRecord: number;
 recordFrom: string;
 placedAt: string | null;
}

/** A skill's figures for its Activity tab. `firstFired` is the first firing on or after the placement
 *  when the record reaches back to it, else the earliest on record. */
export function skillActivity(h: History, window: UsageReport, name: string): SkillActivity {
 const counts = h.bySkill.get(name), firings = skillUsage(window, name).firings, n = h.days.length - h.start, prev = previousRange(h);
 let active = 0, runLength = 0, best: SkillActivity['streak'] = null;
 for (let k = 0; k < n; k += 1) {
  const i = h.start + k;
  if (firedOn(counts, i) > 0) { active += 1; runLength += 1; if (best === null || runLength > best.length) best = { length: runLength, from: h.days[i - runLength + 1]!, to: h.days[i]! }; }
  else runLength = 0;
 }
 const placedAt = placedDay(window, name), from = placedAt !== null && placedAt > h.days[0]! ? h.days.indexOf(placedAt) : 0;
 let first: string | null = null, onRecord = 0, week = 0, busiest: SkillActivity['busiestWeek'] = null;
 for (let i = Math.max(0, from); i < h.days.length; i += 1) {
  const today = firedOn(counts, i);
  if (today > 0 && first === null) first = h.days[i]!;
  onRecord += today;
  week += today - (i - 7 >= Math.max(0, from) ? firedOn(counts, i - 7) : 0);
  if (week > 0 && (busiest === null || week > busiest.total)) busiest = { total: week, from: h.days[Math.max(Math.max(0, from), i - 6)]!, to: h.days[i]! };
 }
 const d1 = firings?.d1 ?? 0, d2 = firings?.d2 ?? 0;
 return {
  firings, d1, d2, total: d1 + d2,
  previous: prev === null ? null : ((s) => s.d1 + s.d2)(sumOver(counts, prev[0], prev[1])),
  activeDays: active, days: n, streak: best,
  lastFired: lastFiredDay(h, counts), firstFired: first, busiestWeek: busiest, onRecord,
  recordFrom: h.days[0]!, placedAt,
 };
}

export interface YearCell { day: string; d1: number; d2: number; total: number; /** The ledger placed this skill after this day, so silence here is not silence. */ beforePlacement: boolean; /** 0 = nothing, 1..4 = quartile of the busiest day shown. */ level: 0 | 1 | 2 | 3 | 4 }
export interface YearCalendar {
 cells: YearCell[];
 /** Monday-first weekday of the first cell; a cell's slot is its index plus this. */
 firstWeekday: number;
 columns: number;
 months: { label: string; column: number }[];
 /** Firings across every cell drawn. */
 total: number;
 /** The column holding the window's first day, where the window's bracket starts; null when the window is the whole calendar. */
 windowColumn: number | null;
 /** The ledger's placement day when it falls inside the calendar. */
 placedDay: string | null;
}

/** A skill's year as GitHub draws one: weeks as columns, Monday on top, the window bracketed under it.
 *  A year window draws its own days, so the calendar's count is the window's count. */
export function yearCalendar(h: History, window: UsageReport, name: string): YearCalendar {
 const n = h.days.length - h.start, span = Math.min(h.days.length, Math.max(n, 365)), from = h.days.length - span;
 const days = h.days.slice(from), counts = h.bySkill.get(name), placed = placedDay(window, name);
 let max = 0; for (let i = from; i < h.days.length; i += 1) max = Math.max(max, firedOn(counts, i));
 let total = 0;
 const cells = days.map((day, k): YearCell => {
  const i = from + k, d1 = counts?.d1[i] ?? 0, d2 = counts?.d2[i] ?? 0, t = d1 + d2;
  total += t;
  return { day, d1, d2, total: t, beforePlacement: placed !== null && day < placed, level: t === 0 ? 0 : (Math.min(4, Math.ceil((t / max) * 4)) as 1 | 2 | 3 | 4) };
 });
 const firstWeekday = days.length ? weekdayIndex(days[0]!) : 0;
 const columns = Math.ceil((days.length + firstWeekday) / 7);
 // A month is named over the first column that starts in it; a sliver of a month at the left edge
 // yields its label when the next month's would sit on top of it.
 const months: YearCalendar['months'] = [];
 let lastMonth = '';
 days.forEach((day, k) => {
  const month = day.slice(0, 7);
  if (month === lastMonth) return;
  lastMonth = month;
  const column = Math.floor((k + firstWeekday) / 7);
  if (months.length && months[months.length - 1]!.column === column) return;
  months.push({ label: MONTHS[parseDay(day).getMonth()]!, column });
 });
 if (months.length > 1 && months[1]!.column - months[0]!.column < 3) months.shift();
 const windowStart = h.start - from;
 return { cells, firstWeekday, columns, months, total, windowColumn: windowStart <= 0 ? null : Math.floor((windowStart + firstWeekday) / 7), placedDay: placed !== null && placed > days[0]! ? placed : null };
}

/**
 * The one note a skill page raises about its firings, or null. A ladder, so each outcome has exactly
 * one note and no two share one: nothing observed (never a not-installed claim), placed and silent,
 * reached for by name but never chosen — the reason the feature exists — and firing on a failing eval.
 */
export function skillNote(a: SkillActivity, summary: ReceiptSummary | null, days: UsageWindow, misfires: number | null): Omit<Finding, 'skills'> | null {
 const { current, previous } = windowPhrase(days), verdict = verdictOf(summary);
 if (a.firings === null) return { tone: 'quiet', title: `No firings recorded for this skill in ${current}`, body: 'This reads session transcripts, not the filesystem, so it says nothing about whether the skill is installed.' };
 if (a.total === 0) {
  const body = (a.previous ?? 0) > 0 ? `It fired ${plural(a.previous!, 'time')} in ${previous}${a.lastFired === null ? '' : `, last on ${shortDayLabel(a.lastFired)}`}.`
   : verdict === 'PASS' ? 'It wins its eval cases when it runs, so the skill is not the problem; the description probably does not match how you ask.'
   : verdict === 'FAIL' ? 'It also fails its evals, so nothing lost out. A candidate to remove.' : '';
  return { tone: verdict === 'PASS' ? 'warn' : 'quiet', title: `${a.firings.placed ? 'Placed here and never fired' : 'Never fired'} in ${current}`, body: body + missClause(misfires, 'it') };
 }
 if (a.d1 === 0) return { tone: 'warn', title: 'Only fires when named', body: `Never chosen from its description: all ${plural(a.total, 'firing')} in ${current} were typed by name.${missClause(misfires, 'it')}` };
 if (verdict === 'FAIL' && a.total >= 3) return { tone: 'bad', title: 'Keeps firing and fails its evals', body: `${plural(a.total, 'firing')} in ${current}, and it lost ${summary!.l} of its ${plural(summary!.n, 'eval case')}.` };
 return null;
}
