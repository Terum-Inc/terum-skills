/**
 * Pure aggregation (build spec §5, ME1 — the shape `src/lib/evals/stats.ts` uses): events plus the
 * placement inventory in, rows out. No filesystem, no clock, no config. Testable with fixture
 * arrays alone.
 *
 * **The row set is the placements ledger (D1).** A row exists for every skill this machine has
 * placed, zero-filled when it never fired. `team` / `library` / `bundled-or-foreign` are LABELS on
 * a row, never what makes a row exist — a team skill this machine never placed has no row at all,
 * because the question this report answers ("did the model pass it over?") is only askable about a
 * skill that was actually available. Whether never-installed team skills deserve a report is D4's
 * question, not this one.
 */
import type { UsageEvent } from './transcripts.js';

export type SkillLabel = 'team' | 'library' | 'bundled-or-foreign';

/** One entry of the placement inventory, already flattened from `config.placements` by the caller. */
export interface PlacedSkill {
  name: string;
  label: SkillLabel;
  /** ISO-8601 from the ledger, or null when the ledger does not record one. */
  placedAt: string | null;
}

/**
 * How much of the window this skill was actually available for. Derived from the ledger, never
 * assumed — §2.2's rule is that availability is reconstructed from `placements` plus the record
 * timestamp, or the row says so.
 */
export type Availability = 'full' | 'partial' | 'unknown';

export interface UsageRow {
  skill: string;
  label: SkillLabel;
  /** The model chose it from its description. */
  d1: number;
  /** A human named it by slash command. */
  d2: number;
  /** `d1 / (d1 + d2)`, or null when it never fired — a ratio over nothing is not zero. */
  autonomy: number | null;
  availability: Availability;
  /** The ledger's placement date, so a reader can tell "silent" from "not yet placed" on any given
   *  day. Null when the ledger records none — the same fact `availability: 'unknown'` states. */
  placedAt: string | null;
}

/** A fired name with no placement on this machine. Never folded into a row (§5). */
export interface UnrecognisedRow { skill: string; d1: number; d2: number }

/**
 * One (local day, skill) bucket with at least one firing. The day is the machine's own calendar
 * date — this report is read on the machine that wrote the transcripts, and a person's "Tuesday"
 * is their Tuesday, not UTC's. There is a bucket for every fired name, placed or not, so a
 * per-skill view of a hand-placed copy has the same days to draw as a ledger row does.
 */
export interface DailyRow { day: string; skill: string; d1: number; d2: number }

export interface UsageReport {
  /** Inclusive ISO bounds of the window the rows describe. */
  since: string;
  until: string;
  rows: UsageRow[];
  /** Placed here and never fired in this window. */
  unused: number;
  unrecognised: UnrecognisedRow[];
  /** The same firings as `rows` and `unrecognised`, bucketed by local day (sorted by day, then
   *  skill). Sums to the same totals; a consumer may draw a calendar from it, never a rate. */
  daily: DailyRow[];
}

export interface AggregateOptions {
  since: string;
  until: string;
}

const within = (ts: string, since: string, until: string): boolean => ts >= since && ts <= until;

/** The machine's own calendar date for an instant, `YYYY-MM-DD`. */
export function localDay(ts: string): string {
  const date = new Date(ts);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Availability for one row. A skill placed part-way through the window was only available for part
 * of it, and saying "unused" of it without that caveat is the install/ignore conflation §2.2 names
 * as the hazard.
 */
function availabilityOf(placedAt: string | null, since: string): Availability {
  if (placedAt === null) return 'unknown';
  return placedAt > since ? 'partial' : 'full';
}

/**
 * Rows for every placed skill, plus the unrecognised tail.
 *
 * Sort order is the report's argument, not alphabetical: the rows that matter are the ones a human
 * reached for and the model never did, so ascending autonomy comes first, then descending explicit
 * count. Never-fired rows sort last — they say nothing about the description.
 */
export function aggregate(events: readonly UsageEvent[], placed: readonly PlacedSkill[], options: AggregateOptions): UsageReport {
  const { since, until } = options;
  const counts = new Map<string, { d1: number; d2: number }>();
  const days = new Map<string, DailyRow>();
  for (const event of events) {
    if (!within(event.ts, since, until)) continue;
    const entry = counts.get(event.skill) ?? { d1: 0, d2: 0 };
    if (event.kind === 'D1') entry.d1 += 1; else entry.d2 += 1;
    counts.set(event.skill, entry);
    // The same tally again, by local day: the two must sum to the same numbers, so they are fed by
    // the same loop over the same filtered events.
    const day = localDay(event.ts), key = day + '\u0000' + event.skill;
    const bucket = days.get(key) ?? { day, skill: event.skill, d1: 0, d2: 0 };
    if (event.kind === 'D1') bucket.d1 += 1; else bucket.d2 += 1;
    days.set(key, bucket);
  }

  const rows: UsageRow[] = [];
  const claimed = new Set<string>();
  for (const skill of placed) {
    // A skill placed after the window closed was never in the room; it is not a row.
    if (skill.placedAt !== null && skill.placedAt > until) continue;
    claimed.add(skill.name);
    const { d1, d2 } = counts.get(skill.name) ?? { d1: 0, d2: 0 };
    rows.push({
      skill: skill.name,
      label: skill.label,
      d1, d2,
      autonomy: d1 + d2 === 0 ? null : d1 / (d1 + d2),
      availability: availabilityOf(skill.placedAt, since),
      placedAt: skill.placedAt,
    });
  }

  rows.sort((a, b) => {
    const fired = (row: UsageRow): number => (row.d1 + row.d2 === 0 ? 1 : 0);
    if (fired(a) !== fired(b)) return fired(a) - fired(b);
    if (a.autonomy !== b.autonomy) return (a.autonomy ?? 1) - (b.autonomy ?? 1);
    if (a.d2 !== b.d2) return b.d2 - a.d2;
    return a.skill.localeCompare(b.skill);
  });

  const unrecognised = [...counts.entries()]
    .filter(([skill]) => !claimed.has(skill))
    .map(([skill, { d1, d2 }]): UnrecognisedRow => ({ skill, d1, d2 }))
    .sort((a, b) => b.d1 + b.d2 - (a.d1 + a.d2) || a.skill.localeCompare(b.skill));

  const daily = [...days.values()].sort((a, b) => a.day.localeCompare(b.day) || a.skill.localeCompare(b.skill));

  return { since, until, rows, unused: rows.filter((row) => row.d1 + row.d2 === 0).length, unrecognised, daily };
}
