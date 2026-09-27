# Running an eval

An eval runs each of your skill's cases in two fresh sandboxes, one with the skill staged and one
without, and in a third against an earlier version when the team has a receipted one. It spends your
own Claude account. Everything that can refuse the run runs first: the flag checks, the hygiene
gate, the queue guards and the preflight all happen before the first case does.

```sh
npx -y terum-skills@latest eval <skill-or-path>
```

The ref is a skill name or a path to the folder. Everything below is one run of that command, in the
order the code does it.

## A single run, step by step

### 1. Resolve the skill

A name is matched against your Library roots: Global (`~/.claude/skills`, or
`%USERPROFILE%\.claude\skills` on Windows) plus every project registered with `project add`. A path
is matched against the folder it names, after `~` expansion and through the parent's realpath, so a
symlinked home still matches. A name no root holds is refused:

```
No local skill folder named `deploy-check` in your library; install it from the marketplace first, or pass the folder's path.
```

A path that resolves outside every Library root is refused as firmly, in its own words:

```
`~/code/deploy-check` is not a skill folder in your library (~/.claude/skills or an added project's .claude/skills); add the project holding it with `project add`, or install it from the marketplace first.
```

A folder that exists but the Library scan rejected is refused with the scan's own detail, against
the path, not with either sentence above: `<path> is not a usable skill folder: <detail>`, or
`<path> could not be read as a skill folder: <reason>` when it could not be read at all.

There is one exception, and it is eval's alone. The Library scan refuses any top-level key outside
the Agent Skills standard, because a shared skill has to stay portable. Eval measures a skill as
Claude Code runs it. So a folder refused only for Claude Code's own fields that run nothing on your
machine goes through as it is: `model`, `effort`, `context`, `agent`, `background`,
`disallowed-tools`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable` and
`when_to_use`. A folder that sets `model: haiku` to save cost is measured with that field in place,
the way Claude Code runs it. The rest of its checks still run: the grant must parse, and no symlink
may sit inside the folder. `hooks` is still refused, because Claude Code registers a skill's hooks
as commands that run on your machine. Any other key is refused as well. The refusal names the key:

```
<path> is not a usable skill folder: unsupported top-level field hooks (hooks register commands that run on this machine, so eval does not run a skill that declares them)
```

Publishing is unchanged. It still refuses the same folder until the field moves under `metadata`
or is removed.

The team is optional. It supplies exactly three things: the incumbent arm, the licence the hygiene
check compares against, and the `skill_id` a shared receipt needs. A machine with no team configured
evaluates anyway, with one opponent.

A machine configured for more than one team, with no `--team`, stops before any work:

```
This machine is configured for teams a, b; Terum Skills keeps one team per machine. Run `npx -y terum-skills@latest team leave <name>` for each you no longer want; until then name one with --team.
```

### 2. Refresh the team clone

When a team is selected, its clone is fetched and hard reset to `origin/main` under the clone's
writer lock, before anything reads skill content. This is what pins the incumbent and the team
policy to one state for the whole run. With no team, this step does not happen.

### 3. Hygiene on the local bytes

The folder as it sits on disk goes through the same deterministic hygiene checks `validate` runs,
with two differences. The four Terum-managed frontmatter fields (`license`, `metadata.id`,
`metadata.author` and `metadata.terum-category`) are treated as optional, because eval targets a
folder that may never have been published. And the Claude Code fields listed in step 1 are accepted
at the top level, while `hooks` is still refused. Every other check is unchanged and fails closed.

Warnings print and gate nothing. An error ends the run before any model call:

```
Hygiene failed for deploy-check:
HYG3 notes.md:12: ...
```

With no team there is no policy licence to conform to, so the licence check compares the frontmatter
against the folder's own `LICENSE` file alone. See [Hygiene](hygiene.md).

### 4. Stage dependencies, and the heavy question

The body of your `SKILL.md` is scanned for path-shaped tokens. A path that exists inside the skill
folder already travels with it. A path that exists under the enclosing git repository is staged into
every arm that stages the skill. A path that does not exist and looks like a file or a dot-directory
is reported as missing. Prose like `critical/high` is not a path and is ignored.

```
Staging dependency scripts/review.mjs
SKILL.md references tools/missing.py, which is not present here; the skill may not run
assets/corpus is 31.4 MB; staging it would exceed the 20 MB cap; not staged
```

The cap is 20 MB across the whole plan. A token that would push the total over is skipped with the
line above, not silently dropped. For a script (`.js .mjs .cjs .ts .sh .py`) the whole containing
directory is copied so its siblings travel; `node_modules`, `.git` and `__tests__` never are. The
baseline arm never receives dependencies.

Then the skill is scanned for evidence that it calls subagents: `metadata.eval.heavy` in the
frontmatter decides outright when it is present; otherwise the first file naming the `Agent`, `Task`
or `Workflow` tool, then `codex exec`, then `claude -p`. When the scan says heavy and you passed
neither `--heavy` nor `--no-heavy`, the run prints the evidence, prints this notice, and asks:

```
This skill appears to call subagents, which can be expensive. Instead of
running it once per case, this evaluation runs one session with the skill
and one without, against a single fixture with many checks, to limit usage
and wall-clock time. The verdict therefore rests on one session and will
vary more between runs. To reduce variance, uncheck the box below; that
runs the skill <n> times in sequence. If the run is interrupted or your
usage runs out, it is marked unscored and must be run again.
```

`<n>` is the number of authored case files, or the word `each` when the folder has none. There is no
box to uncheck: on the terminal the notice is followed by the y/N question below, and the app draws
no control for it in its pre-run dialog.

```
Use the one-session heavy evaluation mode?
```

The default answer is yes. A non-interactive channel cannot answer it, so a heavy skill evaluated
from a script needs `--heavy` or `--no-heavy` or the run fails on the closed prompt.

What the answer changes, in the shipped code: nothing about how the run executes. The resolved value
is recorded in the run tree's `run.jsonl` as `heavy` and `heavy_evidence` and read by nothing else.
One-session mode is selected by one thing only, whether the run has an `evals/suite.yaml` at all:
authored in the skill folder, or written by this run's generator. A skill with a suite runs one
session per arm whether you answer yes or no; a skill with ordinary cases runs one session per case
per arm either way. See
[Test assets](test-assets.md).

### 5. Preflight

Two paid-path probes, before any generation or sandbox:

1. `claude --version`, with a 15 second cap. Its output is recorded as the receipt's `cc_version`.
2. One real one-turn agent task, `Reply with the single word: ok`, in a throwaway temp directory, on
   the run's model, with a 120 second cap.

Either failure ends the run:

```
preflight agent task failed — check that `claude` is logged in and the model 'sonnet' is available: ...
```

A batch or a drain takes one probe for the whole run and reuses it for every skill.

### 6. Generate what is missing

Generation runs per asset, and only for an asset that is absent.

| Asset | Generated when |
| --- | --- |
| `evals/cases/*.yaml` or `evals/suite.yaml` | `--triggers-only` not given, `--no-gen` not given, no authored case file, and no `evals/suite.yaml` |
| `evals/triggers.yaml` | `--execution-only` not given, `--no-gen` not given, and no authored `evals/triggers.yaml` |

Which execution asset is written is the generator's own choice of shape: one suite for a skill it
can measure against a planted ground truth, a set of cases otherwise. `metadata.eval.shape` in your
frontmatter, `suite` or `cases`, fixes that choice; any other value ends the run before the model
call with `Could not generate execution cases: SKILL.md metadata.eval.shape must be 'suite' or
'cases'. Retry the command or pass --no-gen.` See [Generated evals](generated-evals.md#the-shape).

A `suite.yaml` counts as an authored execution asset and suppresses case generation. There is no
flag that forces regeneration: to regenerate, delete the asset and run again. Generated bytes are
put through the content hygiene checks before they are written; a finding aborts the run and writes
nothing. Then the run prints where they are going:

```
Writing generated evals/cases/ and evals/triggers.yaml into /home/you/.claude/skills/deploy-check — they were missing, so this run made them. That changes the skill's content: the next publish mints a new version and the current local eval score blanks. To regenerate, delete evals/cases/ and run eval again.
```

That line overstates what happens. `evals/` is excluded from a skill's content digest, so writing
generated eval assets does not change the folder's identity: the next publish ships them without
minting a version, and a receipt taken of these bytes still matches. The regeneration instruction in
the line is correct.

A run that generated a suite names that file in both places, as `Writing generated evals/suite.yaml`
and as `To regenerate, delete evals/suite.yaml and run eval again.`

Assets land by rename, the cases first, then the suite, then the triggers, so each one is absent or
whole and never partial. A copy of the same bytes is also written to the run tree under
`generated/`, and a generated suite is read back from that copy for the run itself. See
[Generated evals](generated-evals.md).

### 7. Choose the arms

| Arm | Sandbox contents | Present when |
| --- | --- | --- |
| `baseline` | The case's fixture, files and setup. No skill, no dependencies. | Always |
| `candidate` | The same, plus the folder under eval staged at `.claude/skills/<name>`, plus its dependencies. | Always |
| `incumbent` | The same, from a committed version folder in the team clone. | A team clone, a `metadata.id`, and a receipted version whose bytes differ from the candidate's |

The incumbent is the version whose newest receipt run id is the most recent, not the highest version
number, and never a version whose committed bytes digest equal to the candidate's. A version that
has been published but never evaluated is never the incumbent. With no clone, no team, no id, or
nothing left after that exclusion, the run has one opponent.

### 8. Seed each sandbox

Every arm and every repetition gets its own fresh temporary directory under the run tree's
`sandboxes/`. A retry re-seeds from scratch. The order is fixed:

1. Copy the case's `fixture` directory, resolved relative to the case file's directory.
2. Write the case's inline `files`. An absolute path, a `..` segment, or a first segment of
   `.claude` is refused. A file ending `.sh`, or anything whose first segment is `bin`, gets mode
   0755.
3. Run the case's `setup` under `/bin/sh -ce` in the sandbox, killed at 60 seconds. A non-zero exit
   drops the case.
4. Stage the skill tree at `.claude/skills/<name>`, excluding the top-level `evals/` and `fixtures/`
   directories so the skill cannot read its own answer key. Skipped entirely for `baseline`.
5. Stage the dependency plan. Skipped entirely for `baseline`.

### 9. Run the arm

Each arm is one headless Claude Code session:

```sh
claude -p "<the case's task>" \
  --output-format stream-json --verbose \
  --max-turns <max_turns, default 200> \
  --permission-mode acceptEdits \
  --allowedTools "Bash Read Write Edit Glob Grep Task Workflow" \
  --setting-sources project \
  --strict-mcp-config \
  --append-system-prompt "<the headless note>" \
  --model <--model, default sonnet>
```

The working directory is the sandbox and `CLAUDE_PROJECT_DIR` points at it. The appended system
prompt is identical for every arm:

> You are running inside an automated, unattended evaluation. No human can answer questions; never
> stop to ask one — act on your best judgment and complete the task.

`Task` and `Workflow` are on the allowed list on purpose: without them the headless permission gate
blocks a subagent-calling skill's launch and it degrades to prose. Every arm gets the same list, so
the comparison stays fair.

`--setting-sources project` means your `~/.claude/settings.json` is not loaded. Its stated reason in
the code is this product's own session hook, which would start a sync that takes the clone lock the
run is holding. It is not a mechanism for excluding your other user-level skills. What guarantees
the arms differ is the contamination assertion after the fact: the session's `init` event reports
the skill list it resolved, and the run is refused when

- a staged arm reports no skill list at all, or
- the skill under test is missing from an arm that staged it, or present in an arm that did not.

That assertion covers the skill under test only. A contamination failure ends the whole eval.

Timeouts and caps:

| Limit | Value |
| --- | --- |
| One arm session | `timeout_minutes` from the case, default 120 minutes |
| Turns in one session | `max_turns` from the case, default 200 |
| A `requires` probe | 30 seconds each |
| A case's `setup` hook | 60 seconds, then SIGKILL |
| A `command_succeeds` check | 120 seconds |
| A trigger, generation or judge call | 120 seconds, except generation at 300 seconds |
| `claude --version` at preflight | 15 seconds |

The session's raw stdout is written to `transcripts/<case>.<arm>.<rep>.jsonl` before any error is
raised, so a partial stream survives for inspection.

### 10. `requires` skips

A case or suite that declares `requires` has every entry probed before any agent run: a bare name
through `command -v`, or `python3:<module>` through an import. Values are passed as argv, never
interpolated into a shell. If anything is missing the case runs nothing:

```
  hybrid-review: SKIPPED (environment) — missing codex
```

Its rows are never produced, so they show up as the gap between `expected_rows` and `scored_rows`
and make the run partial.

### 11. Retries, dead arms, dropped cases

Each (case, arm, repetition) gets at most two attempts.

| Failure | What happens |
| --- | --- |
| The session hit its time cap | Never retried. `  <case> rep0 candidate: timed out, not retried: ...` The arm is dead. |
| The agent exited non-zero, first attempt | The first transcript is kept as `.attempt-1.jsonl`, a fresh sandbox is seeded, and the arm runs again. `  <case> rep0 candidate: agent run failed, retrying once: ...` |
| The agent exited non-zero, second attempt | `  <case> rep0 candidate: agent run failed twice, scoring empty: ...` The arm is dead. |
| Seeding threw | The case is dropped, not the run: `  <case>: ABORTED (setup) — setup failed (rc=1): ...` or `ABORTED (staging)`. |

A dead arm is an unscored hole, not a zero. Its comparison row is a tie decided by
`candidate-run-failed`, `opponent-run-failed` or `both-arms-failed`, and every such row is filtered
out of the counts, the arm scores, the efficiency means and the per-case table. It shows only as
`expected_rows` minus `scored_rows`.

Every other row prints as it settles:

```
  unsafe-request rep0 candidate-vs-baseline: win (checks)
```

### 12. Report, receipt, share

The run prints its report, writes the receipt and the run tree, and then either commits the receipt
to the team or prints the share hint. See [Results and receipts](results-and-receipts.md).

## Options

| Option | Effect |
| --- | --- |
| `--k <n>` | Repetitions per execution case. Default 1. Must be a positive integer. Total agent sessions are cases × k × arms. |
| `--case <stem>` | Run only the authored case file with that stem. Never causes cases to be generated; a missing `evals/triggers.yaml` is still generated. Skips an authored suite and says so: `Skipping evals/suite.yaml: --case <stem> names an authored case; the suite runs only in a full run.` |
| `--triggers-only` | Run the trigger selection only. Refused together with `--execution-only`. |
| `--execution-only` | Run the execution cases only. |
| `--model <model>` | The model for every arm, for generation, and for trigger selection. Default `sonnet`. |
| `--judge-model <model>` | The model the pairwise judge uses. Defaults to `--model`. The escalation model is `opus` and is not configurable. |
| `--no-gen` | Do not generate missing eval assets. A skill with no assets then evaluates nothing. |
| `--heavy` / `--no-heavy` | Answer the heavy question without being asked. Records the value; changes no execution behaviour. |
| `--team <team>` | Which configured team supplies the clone, the policy and the receipt's team. Required on a machine with more than one. |
| `--no-commit` | Keep the receipt on this machine. The local receipt is always written either way. |
| `--parallel <n>` | Evals to run at a time. Default 4. Inside a `--batch` it is capped at the batch width. |
| `--batch <n>` | Run this many at a time and ask before each further batch. |
| `--pending` | Add every shared skill with no receipt for its current version. Needs a team. |
| `--window overnight\|later` | Queue the named skills instead of running them. Refused together with `--batch` or `--parallel`. |
| `--queue-list` | List the queue and exit. |
| `--drain` | Run the queue. |
| `--max <n>` | With `--drain`, the maximum number of queued items to attempt. |
| `--dequeue <skill>` | Remove `<skill>` or `<team>/<skill>` from the queue. |

## Several skills at once

```sh
npx -y terum-skills@latest eval deploy-check hybrid-review handoff
```

Every ref is resolved before any paid work, so a name no root holds fails the request rather than a
batch halfway through. Duplicates by folder path are collapsed. One preflight probe covers the whole
run.

```
Evaluating 3 skills, 3 at a time…
── deploy-check ──
...
✓ deploy-check
Evaluated 3 of 3; 0 failed.
```

Each skill's output is buffered and printed as one contiguous block, so two parallel runs never
interleave. A question from any run flushes that run's block first and takes a run-wide mutex, so
only one question is open at a time.

`--parallel <n>` sets how many run at a time and defaults to 4. `--batch <n>` sets a width: the run
does `n`, then asks

```
Continue with the next 4? (4 of 12 done, 8 left)
```

Declining queues the remainder for the `later` window and stops. Concurrency inside a batch is
`min(--parallel ?? 4, --batch)`.

`--pending` adds every shared skill whose current version has no receipt at all. A skill whose
newest receipt for that version fails the schema is reported and left out rather than re-run. A
candidate with no copy on this machine is reported and left out, never run to fail. When the pending
set is
empty you get one of four sentences, so an empty batch does not read as "everything is evaluated"
when it is not.

## Queueing evals for later

`--window` queues instead of running, and never probes the paid agent:

```sh
npx -y terum-skills@latest eval deploy-check hybrid-review --window overnight
```

```
Queued 2 evals for overnight: the app runs them in parallel between 01:00 and 05:00 while it is open and idle. Run them now with `npx -y terum-skills@latest eval --drain`.
```

`--window later` queues without that promise:

```
Queued 2 evals for later. Run them with `npx -y terum-skills@latest eval --drain`.
```

The queue is one file, `~/.terum/skills/run/eval-queue.json` (`%USERPROFILE%\.terum\skills\run\eval-queue.json`).
Each item records the skill name, the folder on this machine, the `sha256:` content hash of that
folder at the moment it was queued, when it was requested, the window, the team when there is one,
and the last error if a drain has failed on it.

**Re-keyed on the content hash** means two things. First, the queue's identity is the pair (skill
name, content hash), so queueing the same bytes twice is one item, and queueing the same skill after
an edit is a second, separate item. Naming a different window for bytes already queued moves the
existing item instead of adding a paid run. Second, the drain passes that hash back to the eval as
the bytes it is allowed to bill for. If the folder changed in the meantime:

```
The queued bytes of deploy-check are no longer what is on disk; dequeue it and queue it again.
```

No paid work happens. A drain also skips bytes that already have a local receipt:

```
Already evaluated these exact bytes of deploy-check.
```

### Listing, draining and cancelling

```sh
npx -y terum-skills@latest eval --queue-list
npx -y terum-skills@latest eval --drain
npx -y terum-skills@latest eval --drain --window overnight --max 3 --parallel 2
npx -y terum-skills@latest eval --dequeue deploy-check
```

`--queue-list` prints one line per item and `No queued evals.` when there are none:

```
myteam/deploy-check@sha256:8f2c… · overnight · 2026-09-16T02:11:07.412Z
```

`--drain` with no `--window` drains both windows. With no skill named, `--window`, `--max` and
`--parallel` require `--drain`, and a drain accepts only `--window overnight`. `--max` slices the
list; `--parallel` defaults to 4. Each
item is re-checked against the live queue before it starts, so cancelling during a drain works. A
successful item is removed from the queue; a failed one stays, with `lastError` recorded, and the
verb ends with `N queued evals failed; they remain queued.`

Queue modes refuse a skill argument, `--batch`, `--pending`, and every per-skill selection flag
(`--no-gen`, `--case`, `--triggers-only`, `--execution-only`, `--team`): a drain runs the queued team
and the full committed set of assets.

`--dequeue <skill>` takes a bare name only when that name is unambiguous. A name queued under a team
refuses and names the two-part forms rather than cancelling paid runs you did not name.

### What drains the overnight window

The desktop app does, and only the desktop app. With **Settings ▸ Evals ▸ Run queued evals
overnight** on (the default), the app fires at most once per local calendar night, between 01:00 and
05:00 local time, after 30 minutes with no pointer, keyboard or wheel activity, while the app is open
and no other eval, setup or drain is running. It checks the queue holds at least one `overnight`
item and then runs a single drain of the **whole** queue at `--parallel 4`, carrying your
Settings ▸ Evals defaults for `--k`, `--model` and `--judge-model`.

Nothing else drains it. Closing the app, or turning that switch off, means the queue waits until
someone runs `eval --drain`.

## The eval lock

An eval that has a team takes that team clone's writer lock twice: for the fetch and reset at the
start, and for the receipt commit at the end. A `--pending` run takes it once more, for the refresh
that finds the pending set. Read verbs take no lock at all, so the app's own reads can never be the
holder.

A second write verb on the same clone waits before it fails. At a terminal, or over the frame
protocol the app speaks, the budget is 75 seconds; for anything with nobody on the other end (the
session hook, a piped script) it is 4 seconds and silent. While waiting, a line arrives after the
first second and then at most every five:

```
Waiting for another terum-skills operation on myteam to finish… (12 s)
```

When the budget runs out:

```
Another terum-skills operation holds the write lock on myteam; retry when it finishes.
```

One refusal is different. A lock file stamped more than 60 seconds into this machine's future can
never go stale, so waiting is pointless and the verb says so immediately, naming the path to remove.

The lock file is `.<clone-name>.safewrite.lock` beside the clone, under `~/.terum/skills/teams/`.

A drain takes a second, separate lock so that enqueueing and dequeueing stay available while a paid
run is going:

```
Another terum-skills drain is already running; wait for it to finish or stop it.
```

Stop in the app sends a `cancel` frame, and a POSIX `SIGTERM` does the same thing: both run the
shutdown hooks, which kill the live agent children with SIGKILL, and then exit 143. The exit is what
releases the file locks this process holds, which is why the CLI exits rather than signalling
itself. A cancelled run is not guaranteed to emit a final result.

Ctrl-C at a terminal is different. Nothing here handles SIGINT, so the shell's signal goes to the
whole foreground group, the agent children included, and the shutdown hooks do not run.

## Running an eval from the app

On a skill's page, **Run eval** opens a dialog headed `Run an eval on <name>?`. It shows the
estimate when there is one and this otherwise: `No previous run to estimate from. This uses your
Claude account and can take a while.` It also shows the terminal line that does the same thing. Once
the run starts, the same dialog says which bytes it is evaluating: `Evaluates the copy on this
machine at <path>.`, or `This skill is no longer on this machine.` when the folder went away
mid-run. A skill with no copy on this machine gets neither button, only the reason: `Install it
first — evals run against the copy on your machine.`

Two buttons run something:

| Button | Command |
| --- | --- |
| **Run eval** | `eval [--k n] [--model m] [--judge-model j] [--team t] -- <ref>` |
| **Queue for overnight** | `eval [--k n] [--model m] [--judge-model j] [--team t] --window overnight -- <ref>` |

The `ref` is the folder path for a local card and the skill name for a team card. The three flags
come from Settings ▸ Evals and feed every eval the app starts, including the overnight drain.

In the Library, **Select** then **Evaluate N skills…** opens the several-skills dialog with three choices:
Now (all at once, four at a time), In batches (with a batch size field), and Overnight. It passes
`eval [flags] [--team t] [--batch n | --window overnight] [--pending] -- <skill>…` and shows the
line it will run.

The app runs one eval at a time. Starting a second refuses with `An eval is already running for
<ref>`.

While a run is live, the top bar carries a chip: `Starting · <name>`, then `Evaluating · <name>`,
then `Evaluating · 3 of 12` once the batch reports progress. Clicking it reopens the streaming
dialog. Beside it is a square **Stop** button. Stop closes the child's stdin, waits 1.5 seconds for
the protocol cancellation, then signals the process group, then kills it. The run's result becomes
`Evaluation stopped.` and the chip reads `Eval stopped · <name>` until you dismiss it with its ✕ or
start another run. Closing the dialog does not stop the run. Quitting the app does: every child is
cancelled, and after a short grace period killed.

## Exit codes and the lines you will hit

The verb exits 0 on success and 1 on any failure, with the failure on stderr. A cancel exits 143.

| Line | Cause |
| --- | --- |
| `--triggers-only and --execution-only cannot be used together.` | Both flags. |
| `--k must be a positive integer.` | `--k 0`, `--k 1.5`. |
| `No local skill folder named <ref> in your library; ...` | The name is in no Library root. |
| `<path> is not a usable skill folder: <detail>` | The folder is there but the Library scan rejected it. A folder it could not read at all gets `<path> could not be read as a skill folder: <reason>`. |
| `Hygiene failed for <name>:` | A hygiene error. Nothing was billed. |
| ``preflight agent task failed — check that `claude` is logged in and the model '<m>' is available: ...`` | Claude Code is not usable for this run. |
| `No eval case named <stem> for <name>.` | `--case` named a stem with no file. |
| `The generated eval assets for <name> failed hygiene, so nothing was written:` | A defect in generation, not in your skill. Run again. |
| ``Could not generate execution cases: <reason>. Retry the command or pass --no-gen.`` | Three model calls produced nothing the validator accepted. Triggers fail the same way, as `Could not generate triggers: <reason>.` A `<reason>` of ``SKILL.md metadata.eval.shape must be 'suite' or 'cases'`` comes from your own frontmatter, and retrying does not fix it. |
| `Could not write the generated eval assets into <dir>: ...` | The message names which assets landed whole and which did not. |
| `arm '<arm>' resolved skills [...] — '<name>' leaked into an arm without it staged; refusing the run (§7.3)` | Contamination. The whole eval fails. |
| `Another terum-skills operation holds the write lock on <team>; retry when it finishes.` | Another write verb holds the clone. |
| `Another terum-skills drain is already running; wait for it to finish or stop it.` | A second `--drain`. |
| `The queued bytes of <skill> are no longer what is on disk; dequeue it and queue it again.` | The folder changed after it was queued. |
| `Provide a skill (or several), --pending, --queue-list, --drain, or --dequeue.` | `eval` with nothing to act on. |
| `--window, --max and --parallel require --drain.` | A queue flag without `--drain`. |
| `--batch and --parallel run evals now; --window queues them instead.` | Both kinds of flag together. |
| `<n> of <N> evals failed.` | A batch with failures. The partial result is still returned. |
| `<n> queued evals failed; they remain queued.` | A drain with failures. |

A hygiene failure and a queue-guard refusal happen before anything is billed. The preflight is the
first thing that spends, and it is one `--version` call and one one-turn task. A contamination
refusal comes after the arms have already run.

## Related

- [How evaluation works](overview.md)
- [Hygiene](hygiene.md)
- [Test assets](test-assets.md)
- [Generated evals](generated-evals.md)
- [Results and receipts](results-and-receipts.md)
- [CLI reference](../reference/cli.md)
