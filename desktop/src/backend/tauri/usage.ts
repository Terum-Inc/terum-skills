import { z } from 'zod';
import type { UsageReport } from '../types';

/** Mirrors `UsageResult` in src/commands/usage.ts. `passthrough()` throughout: a NEWER CLI may add
 *  fields, and a read must degrade rather than throw. An OLDER CLI is handled before we get here —
 *  it does not advertise `features.usage`, so the control is greyed and the verb is never spawned.
 *  `placedAt` and `daily` arrive with 0.24 and are optional here, so an older CLI, which
 *  advertises the feature and emits neither, still parses: the counts draw and the calendar says why
 *  it cannot. */
const row = z.object({
  skill: z.string(), label: z.string(), d1: z.number(), d2: z.number(),
  autonomy: z.number().nullable(), availability: z.enum(['full', 'partial', 'unknown']),
  placedAt: z.string().nullable().optional(),
}).passthrough();

const day = z.object({ day: z.string(), skill: z.string(), d1: z.number(), d2: z.number() }).passthrough();

export const cliUsage = z.object({
  since: z.string(), until: z.string(),
  rows: z.array(row),
  unused: z.number(),
  unrecognised: z.array(z.object({ skill: z.string(), d1: z.number(), d2: z.number() }).passthrough()),
  caveats: z.array(z.string()),
  daily: z.array(day).optional(),
}).passthrough();

export type CliUsage = z.infer<typeof cliUsage>;

/**
 * The whole machine's report, as the app's model.
 *
 * The verb is called ONCE per span (a window, and the history behind it) with no ref and projected by the callers (`skillUsage`,
 * `activationOverview`, `history`, `scopeTimeline`, `yearCalendar` in lib/activation.ts), never once per skill.
 * `usage <skill>` filters AFTER the corpus scan, so a per-skill spawn costs the same full scan as
 * an unfiltered one (measured 2026-09-15: 1.3s either way over 706 transcripts / 160 MB), and
 * `cached()` keys on argv, so per-skill calls would be per-skill cache entries and per-skill rescans.
 *
 * `rows` and `unrecognised` stay apart here exactly as the CLI keeps them: a row's `availability`
 * is ledger evidence, and an unplaced name has none to carry. Extra CLI fields (`archived`,
 * `problems`, `usedArchive`) are dropped, not surfaced — nothing in the app reads them yet.
 */
export function mapUsageReport(report: CliUsage): UsageReport {
  return {
    since: report.since, until: report.until,
    rows: report.rows.map(r => ({ skill: r.skill, label: r.label, d1: r.d1, d2: r.d2, autonomy: r.autonomy, availability: r.availability, placedAt: r.placedAt ?? null })),
    unused: report.unused,
    unrecognised: report.unrecognised.map(r => ({ skill: r.skill, d1: r.d1, d2: r.d2 })),
    caveats: report.caveats,
    daily: report.daily === undefined ? null : report.daily.map(d => ({ day: d.day, skill: d.skill, d1: d.d1, d2: d.d2 })),
  };
}
