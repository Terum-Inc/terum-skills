# Which skills actually fire

An eval tells you whether a skill helps when it runs. `usage` tells you whether it runs at all, and
whether the model picked it or a person had to name it.

```sh
npx -y terum-skills@latest usage [skill] [--since <iso>] [--all] [--json]
```

The number the verb exists for is a skill with `0 autonomous, N explicit`: people reach for it, and
the model never chooses it from its description.

## What it reads

Claude Code's own session transcripts, at `~/.claude/projects/<project>/<session>.jsonl`
(`%USERPROFILE%\.claude\projects\…` on Windows). The scan is exactly one level deep, so the nested
subagent and workflow transcripts that live deeper are not counted. A missing projects directory is
an empty result, not an error.

It does not read the session hook, a log file, or anything on the network.

## What an event is

Four fields and nothing else: the detector that saw it, the skill name, the timestamp straight from
the record, and the entrypoint.

Two detectors, because a slash-invoked skill writes no `Skill` record at all:

| Detector | Evidence | Meaning |
| --- | --- | --- |
| **D1, autonomous** | An assistant `tool_use` block named `Skill`; the skill name is `input.skill` | The model chose it from the catalog |
| **D2, explicit** | `<command-name>/name</command-name>` in a user message | A person named it |

D2 is additional to D1, never a subset. Claude Code's own 39 built-in slash commands (`clear`,
`compact`, `model`, `review`, `resume` and the rest) travel in the same envelope, so they are
excluded by name.

Records that are not a person at a terminal are filtered out by one field pair,
`entrypoint === 'cli'` and `isSidechain !== true`. That is what keeps every eval sandbox and every
subagent session out of the counts. A malformed line is skipped rather than fatal, and a truncated
final line is the normal shape of a file Claude Code is still appending to.

An unreadable transcript is reported and not counted:

```
warning: could not read /home/you/.claude/projects/foo/bar.jsonl (EACCES: permission denied); its firings are not counted.
```

## The archive and the 30-day window

The default window is the last **30 days**, because Claude Code prunes transcripts at roughly that
age. Without something else, the report would be permanently capped at whatever the last 30 days
still hold.

That something else is one append-only file:

```
~/.terum/skills/run/usage-events.jsonl
```

Every run appends the events it has scanned, before it reports, so each run widens what the next one
can see. The dedup key **is** the four-field tuple, so appending the same event twice adds one line,
not two. No session id, no file path and no cursor is ever persisted, and there is no free text in
it at all.

The retention rule is deliberate and worth stating plainly: **the default window is answered from
transcripts alone.** The archive is consulted only when `--since` names a moment earlier than 30 days
ago. Deleting the archive therefore changes no number today's report prints. It only shortens how far
back a `--since` can reach.

`--since` takes an ISO-8601 lower bound and replaces the 30-day default. The upper bound is always
now.

The value is validated and canonicalised before anything downstream reads it. A bare `YYYY-MM-DD`
is accepted and read as midnight UTC, because that is the form a person types; a fuller value needs
`YYYY-MM-DDThh:mm`, with optional seconds and either a `Z` or a numeric offset such as `+02:00`. The calendar is checked
explicitly rather than left to `Date.parse`, which rejects month 13 but rolls `2026-02-30` over into
March 2. Anything else is refused before the scan, and the run exits 1:

```
--since needs an ISO-8601 date or timestamp, like 2026-09-01 or 2026-09-01T00:00:00Z; received 2026-9-1.
```

The refusal is the whole point of the validation. Every comparison after it is a plain string
comparison, against each record's own timestamp and against the 30-day default, so an almost-right
bound like `2026-9-1` sorts above `2026-09-15` and would report an empty window. An empty window is
indistinguishable from "nothing fired".

## The report

```
handoff         0 autonomous    7 explicit  ·  never chosen from its description
decision-walk   2 autonomous    4 explicit
deploy-check    9 autonomous    0 explicit  (placed mid-window)
14 skills placed here and never fired in this window.
3 fired names had no placement here; pass --all to list them.

Counts are invocations, not outcome-changing uses; reopenings are not deduped.
30-day window: Claude Code prunes transcripts, so earlier use is visible only where this machine has already archived it.
```

**A row is a placement.** The row set is Terum's placements ledger: there is one row for every skill
this machine has placed, zero-filled when it never fired. A team skill you never installed has no
row, because the question ("did the model pass it over?") is only askable about a skill that was
actually available. The row's name is the basename of its placement path; when the same skill is
placed in more than one scope, the earliest placement date wins.

| Part of a line | Meaning |
| --- | --- |
| `N autonomous` | D1 firings in the window: the model chose it |
| `M explicit` | D2 firings in the window: a person named it |
| `· never chosen from its description` | Printed when autonomy is exactly 0, which means it fired only because people named it. This is the annotation the verb exists for. |
| `(placed mid-window)` | It was placed after the window opened, so it was only available for part of it |
| `(availability unknown)` | The ledger records no placement date for it |
| `(not placed by this machine)` | A folded tail entry: nothing on this machine placed that name, so nothing can be said about how long it was available |

A skill placed after the window closed is not a row at all.

Rows that never fired are not printed, but they are counted:

```
14 skills placed here and never fired in this window.
```

When nothing fired and nothing is in the tail, the first line is `No placed skill fired in this
window.` instead.

**The unrecognised tail** is fired names with no placement on this machine: a folder you put in
`~/.claude/skills` by hand, or a skill from somewhere else entirely. They never become rows in the
data model, because `label` and `availability` are ledger evidence that would have to be invented
for them. By default you get a one-line hint. With `--all`, or when you named a single skill, they
are folded into the one table and re-sorted with it, each marked for exactly what the ledger cannot
say:

```
codex-spec        0 autonomous    5 explicit  ·  never chosen from its description  (placed mid-window)
handoff           0 autonomous    3 explicit  ·  never chosen from its description  (placed mid-window)
name              0 autonomous    1 explicit  ·  never chosen from its description  (not placed by this machine)
decision-walk     1 autonomous    3 explicit  (not placed by this machine)
artifact-design   7 autonomous    0 explicit  (not placed by this machine)
```

Folding is a render decision, not a change to the data model: the JSON keeps `rows` and
`unrecognised` apart whatever you pass. `(not placed by this machine)` and `(availability unknown)`
never share a marker either, because they are two different facts: the first is a name no placement
here accounts for, the second a placement the ledger recorded with no date.

**The two caveats print every time**, at the end, and no flag suppresses them:

> Counts are invocations, not outcome-changing uses; reopenings are not deduped.

> 30-day window: Claude Code prunes transcripts, so earlier use is visible only where this machine
> has already archived it.

They are the reason the report stays honest. A count that implied a skill *helped* is the one thing
this report must never print.

### Ordering

Rows sort by the argument they make, not alphabetically: ascending autonomy first, then descending
explicit count, then by name. The skills people reach for and the model never picks end up at the
top. Under `--all` the tail is sorted into the same table rather than appended to it, so an unplaced
name with autonomy 0 leads placed rows that the model did choose sometimes.

The `rows` array in `--json` carries one more rule the table cannot show: skills that fired come
first and never-fired rows sort last, because a row that never fired says nothing about the
description.

### Naming one skill

```sh
npx -y terum-skills@latest usage handoff
```

The corpus scan is the same; the filter is applied afterwards. The tail is narrowed to that name and
always listed, so a skill that fired from a copy Terum did not place still shows its counts instead
of hiding behind the `--all` hint. When the named skill has no placement row, the whole-machine
"placed here and never fired" tally is omitted, because it would be noise.

### `--json`

`--json` prints the aggregate object instead of the table: `since`, `until`, `rows`, `unused`,
`unrecognised`, `daily`, `caveats`, plus `archived` (how many events this run added), `problems`
(the unreadable transcripts) and `usedArchive`. Every row carries `skill`, `label`, `d1`, `d2`,
`autonomy`, `availability` and `placedAt` (the ledger's date, or null). `daily` is the same
firings again, bucketed by the machine's own calendar day: one `{ day, skill, d1, d2 }` per local
day a name fired, placed or not, sorted by day then name, and summing to the same totals as the
rows and the tail. It exists so a reader can draw a calendar of when a skill fired; it is still
counts, never a rate. `since` is the canonicalised bound, not the string you typed, and `--all`
does not reach this shape at all: the object always carries `rows` and `unrecognised` separately.

## What it does not do

No fetch. No clone lock. No agent, no model call. It reads the team repository not at all and your
transcripts read-only. Its **only** write is the append to the machine-local archive described above,
and nothing in it ever leaves this machine.

## When a skill never fires at all

This report can tell you the model passed a skill over only when that skill fired at least once.
For a skill that never fired, "nobody needed it" and "it was needed and missed" are the same row,
folded into one line:

```
14 skills placed here and never fired in this window.
```

That is what `misses` separates. It harvests the prompts you actually typed out of the same
transcripts, asks a model which placed skills each prompt should have selected, and keeps a pair
only where nothing fired for that skill. It is a separate verb rather than a flag here for two
reasons: it spends model calls, and `usage` promises it makes none, which is what lets the app run
`usage` on every skill page.

```sh
npx -y terum-skills@latest misses [skill] [--since <iso>] [--limit <n>] [--json]
```

Its output is candidates for review and never a rate. The flags, the report and the refusals are in
[the CLI reference](../reference/cli.md#misses).

## In the app

Two surfaces draw these counts and only these counts, and both project the same reads: the app runs
`usage --json` with no skill argument and joins the result to whatever it is drawing by skill name.
`usage <skill>` costs the same whole-corpus scan as an unfiltered one, so one read serves every skill
page and every Library root, and a placement (an install or an uninstall) is what refreshes it.

Both surfaces offer the same three windows, **30 days**, **90 days** and **1 year**, as a picker
that lives in the URL (`?window=90`), so a view is a link. Each window takes two reads:

| Read | Span | What it is for |
| --- | --- | --- |
| The window | 30, 90 or 365 days | Every count inside the window. 30 days is the CLI's own default and passes no flag |
| The history | A year for 30 and 90 days; two years and two days for a year | The days before the window opened: the window before it, day for day; a full window of silence behind each day; when a quiet skill last fired; a skill page's year |

The window's own report is the authority for every day it covers, and the history only fills the
days before it, so a count inside the window is always the tile's. Every read but the 30-day window
passes `--since` and so reaches into this machine's archive, which holds only what earlier runs here
scanned; the CLI's caveat says so on every read, and the calendar simply has fewer lit days the
further back it goes on a machine that has not run `usage` for long.

### The Activation tile

The Library's third overview tile reads `4 of 15`: how many of this root's skills fired in the
window, over every skill on the board. Under the number is a three-segment meter and its caption,
`3 chosen by the model · 1 by name only · 11 never fired`:

| Bucket | Meaning |
| --- | --- |
| Chosen by the model | The model picked it from its description at least once (`d1 > 0`) |
| By name only | It fired, but only because a person named it — autonomy exactly 0, the annotation this verb exists for |
| Never fired | Nothing observed, whether the ledger has a row for it or not. The tile reads transcripts, not the filesystem, so this is not a claim about whether the skill is installed |

A firing from a copy Terum did not place counts, because it is evidence either way. The manual that
setup places is left out of the reckoning: it is reached for by name by design and would brand itself
"by name only" on every machine. The last line is the window and any hedge the counts need:
`last 30 days · 1 placed mid-window`.

The tile reads `usage` itself rather than through the Library read, so the transcript scan never
holds the cards back and a failed scan costs one tile, not the board. It draws a skeleton while the
scan runs, a dash with the CLI's error if it fails, a dash with `This terum-skills version cannot
report skill firings.` on a CLI that predates the verb, and `Nothing fired yet` for an empty library.
It never draws a percentage. Once it has a count, the tile is a button that opens the Activation
popup.

### The Activation popup

Clicking the tile opens a popup (`?dialog=activation`, so it is a link and Back closes it) with the
window picker in its header and three sections.

**Activation over time.** Three rows on one date axis, each on its own scale, because a handful of
firings a day and every skill on the root are different magnitudes:

| Row | What it is |
| --- | --- |
| Fires | The running total of this root's firings through each day, so the line ends on the number beside it. A dashed line is the window before, day for day, and the number carries the difference: `14 ↓6` over `20 in the 30 days before` |
| Misfires | The running total of miss candidates for this root's skills, drawn only across the days the latest screening covered (7 by default). Until a person starts a screening, from this row or from a skill page, the row holds the button and its cost instead of a flat line that would read as "none" |
| Dead skills | How many of the root's skills had no firing in the window-length run of days ending that day. A skill the ledger placed later is not counted before it arrived. The last value is the tile's "never fired" |

Pointing at a day marks it on every row and names its values. The misfires row is absent on a CLI
that cannot screen.

**Skills.** One row per skill on the root, busiest first: a small bar per day (per week beyond 30
days) with the model's choices solid and a person's pale, then **Firings**, **By model**, **By
name**, **Misfires** (`—` until a screening), **Last fired** (counted back inside the window, dated
before it) and the eval verdict as the card draws it. Skills that never fired in the window are
grouped under their own line. A row opens that skill's Activity tab in the same window.

**Worth a look.** What stands out, as sentences of counts, worst first:

| Finding | When |
| --- | --- |
| `<skill> keeps firing and fails its evals` | The verdict is FAIL and it fired at least three times; says how many eval cases it lost |
| `<skill> only fires when named` | It fired at least three times and the model never chose it |
| `<n> skills pass their evals but never fire` | PASS, and silent for the whole window |
| `<skill> went quiet` | Silent for the window after firing in the window before; says when it last fired |
| `<skill> fails its evals and never fires` | FAIL and silent: a candidate to remove |
| `<skill> took hold` | Placed in the last 30 days and firing since |

A verdict from a partial eval run is never leaned on, and once a screening has run a finding adds
how many prompts the skill should have caught. None of them is a rate. The CLI's caveats close the
popup, verbatim. On a CLI that predates `daily`, the popup says why the timeline is missing and the
table still counts from the window's rows.

### The Activity tab

A skill's **Activity** tab draws, under the heading `Activation` with the window picker beside it:

1. **Four figures** for the window: **Firings** (with the difference from the window before and a
   two-tone bar of `0 by the model · 4 by name`), **Active days** (`4 of 31`), **Longest streak**
   (`3 days`, `3–5 Sep`) and **Last fired** (`Yesterday`, `Mon 14 Sep`, marked when it falls before
   the window). With nothing observed and no ledger row, Firings reads `—`: a zero would read
   exactly like the placed-and-silent case, which is a different finding.
2. **One note**, when the firings raise one, from a ladder so each outcome has exactly one:

   | State | What it says |
   | --- | --- |
   | Nothing observed | `No firings recorded for this skill in the last 30 days`, and that this reads session transcripts, not the filesystem, so it says nothing about whether the skill is installed |
   | Placed, never fired | `Placed here and never fired in the last 30 days`, then why when the record can say: it fired in the window before, or it passes its evals so the description is the likely gap, or it fails them too |
   | Fired, autonomy 0 | `Only fires when named`: `Never chosen from its description: all 4 firings in the last 30 days were typed by name.` |
   | Firing and failing | `Keeps firing and fails its evals`, with the eval cases it lost |

   A skill the model chooses gets no note.
3. **The year**, drawn the way a contributions graph is: one cell a day for the last year, weeks as
   columns with Monday at the top, as wide as the page, the colour deepening by quartile of the
   busiest day shown. A day before the ledger placed the skill is an outline: silence there is not
   silence. For 30 and 90 days the window is bracketed under the weeks it covers, `The last 30 days ·
   4 firings`. Every cell names its day and its counts on hover.
4. **Since placement**: when Terum placed it (`Not placed by Terum` for the unrecognised tail,
   `Undated` when the ledger records no date, `No Terum placement recorded` with nothing observed),
   when it first and last fired, and its busiest week. When the placement predates the record, the
   earliest firing is named as the earliest on record.
5. **Misfires**: this skill's candidates from the latest screening, newest first, each with its day
   and whether the prompt had no prior context, then the screening's own caveats. Before a screening
   it says what one costs, and the button starts it.
6. **The CLI's caveats**, verbatim.

On a terum-skills version that cannot report firings, the tab says so and offers nothing; a failed
read shows the CLI's error, copyable, and no figures. On a CLI older than 0.24, which reports the counts but not
the `daily` buckets, the firing count still draws and the calendar's place says why it is missing.

## Related

- [Running an eval](running-evals.md)
- [Results and receipts](results-and-receipts.md)
- [The desktop app](../guides/desktop-app.md)
- [Local state](../reference/local-state.md)
- [CLI reference](../reference/cli.md)
