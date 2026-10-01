# The desktop app

The app is a window onto the CLI. It is a small native shell whose only jobs are the window, the OS integrations (folder chooser, clipboard, reveal in your file browser, opening a link) and a bridge that starts the CLI.

Every board you see is the answer to one or more CLI runs. The app spawns the CLI as `<node> <cli-entry> --frames <verb> …` and renders the JSON frames that come back. A question the CLI would ask you in a terminal arrives as a frame and becomes a dialog; your answer goes back to the same process. Nothing in the app reaches the network itself: git, `gh` and the Claude Code CLI all run inside the CLI child.

The first frame of every run is `hello`, and it carries the feature switches that CLI version supports. The app answers its own capability questions from that frame and treats an unknown switch as off, so a control the CLI cannot back is hidden rather than shown broken. That is why the same app build shows fewer controls against an older CLI.

## Getting it

```sh
npx -y terum-skills@latest app
```

On macOS and Windows, `setup` runs this before the rest of the wizard. When the app launches, setup prints `Continuing in the app.` and returns, so you create or join the team in the app rather than in the terminal. When you named a team to join, the line is `Continuing in the app. Join <org>/<repo> there.` If the app could not be installed at that point (gh logged out, offline), setup finishes in the terminal and tries the app once more after its closing summary, so a join that ran in the terminal still ends with the app open. `setup --no-app` keeps the whole wizard in the terminal, and so does any setup that is not at an interactive terminal. See [Install](../getting-started/install.md).

`app` needs a logged-in `gh`: it downloads through `gh release download` and has no HTTP client of its own.

| Machine | Asset it downloads | What it does with it |
|---|---|---|
| macOS (Apple silicon) | `terum-skills-desktop_<version>_aarch64.app.tar.gz` | Verifies the published SHA-256, unpacks the archive, moves the bundle onto `~/Applications/Terum Skills.app`, opens it |
| macOS (Intel) | `terum-skills-desktop_<version>_x64.app.tar.gz` | The same |
| Windows (x64) | `terum-skills-desktop_<version>_x64-setup.exe` | Verifies the SHA-256, runs the installer with `/S`: a silent per-user install under `%LOCALAPPDATA%\Terum Skills`, no elevation. Starts the app detached |
| Windows (ARM64) | `terum-skills-desktop_<version>_arm64-setup.exe` | The same |
| Linux, WSL, anything else | none | Prints one line and exits 0. There is no app |

The download comes from release `v<version>` of `github.com/ryanliu-terum/terum-skills`, where `<version>` is the version of the CLI you ran. Two checks then have to pass before anything is installed: the file's SHA-256 must equal the published `.sha256` beside it, and `gh attestation verify <asset> --repo ryanliu-terum/terum-skills` must confirm the build-provenance attestation GitHub recorded when the release workflow produced those bytes. Either failure discards the download and names which check failed, and the second needs gh 2.49 or newer. The record of the install goes to `~/.terum/skills/app/<version>/installed.json`, and `~/.terum/skills/run/app.json` records the Node binary, the CLI entry and the `PATH` the app must replay.

On macOS the bundle always lands on the same path, so a Dock pin survives an update, and the bundle already there is moved aside first and restored if the swap fails.

On Linux the CLI prints `There is no Linux desktop app yet; everything works from the terminal.` Inside WSL it prints `The desktop app runs on the Windows side of this machine, not inside WSL. Install terum-skills there and run this command from a Windows terminal; from here, everything works in the terminal.`

### Why the app verb and not the Releases page

The release assets are public, but downloading them by hand costs you the two things the `app` verb takes care of.

The macOS bundle is ad-hoc signed and never notarized: `tauri.conf.json` sets the signing identity to `-`, and the release workflow asserts the signature is ad-hoc rather than notarizing it. A copy you fetch in a browser carries macOS's quarantine attribute, which a bundle that is not notarized does not survive. Files written by `gh` carry no quarantine attribute, so the bundle that `app` places opens with no Gatekeeper dialog at all.

The Windows installer is unsigned: no certificate is configured and the release workflow signs nothing. `app` runs the same installer with `/S`, per user, with no prompt and no elevation.

A download by hand also skips the attestation check the CLI runs. [Security](../../SECURITY.md) has the commands for verifying a release yourself, and what signing is still open.

So install the app with `app`, and update it from inside the app or with `app-update`.

## First run

The app reads `~/.terum/skills/run/app.json` on every launch. The `app` verb writes it, which is why opening the bundle from Spotlight or the Dock on a machine where `app` has never run leaves every board with this error:

```
The desktop app could not find where terum-skills is installed. Run `terum-skills app` from a terminal once; it records the location and opens this app.
```

The fix is the same command:

```sh
npx -y terum-skills@latest app
```

It rewrites the file and opens the app. The app re-reads it whenever the window regains focus, so a terminal run repairs a window that is already open.

The app runs exactly the Node binary and CLI entry that file records. It never calls `npx` and never resolves a version of its own.

## The window

Every board sits in the same frame.

The top bar carries Back and Forward, the search box with its `⌘K` chip, and, on the right, the status chips: an update chip when a newer app build is available or ready, a chip for a running eval and one for a running publish, each with a Stop control while it runs and a ✕ afterwards.

The sidebar has two groups. Library holds Global and Projects, one row per registered project, with Add project under them. Team holds Marketplace and Members. The footer shows who you are and opens Settings. Hide sidebar collapses it to nothing and a Show sidebar button appears in the top bar; the Projects group collapses on its own. Both states live in the URL and are remembered.

| Shortcut | Action |
|---|---|
| `⌘K` | Search |
| `⌘,` | Settings |
| `⌘R` | Sync now |
| `⌘[` and `⌘]` | Back and forward |

On Windows and Linux the same chords answer to Ctrl as well. They are ignored inside a text field or a dialog.

Two habits are worth knowing. Almost everything is right-clickable: a skill card offers its whole action list plus Copy name, and adds Copy path, Show in Finder and Open in editor when it has a folder on this machine; sidebar folders, Settings rows and member rows offer the same kind of menu; an error line copies itself; and a copy reports itself in a short toast. Paths, versions and commands are selectable text, and every dialog prints the `npx -y terum-skills@latest …` command it is about to run, which you can copy and run yourself instead.

## Library

The Library is one board per root: Global (`~/.claude/skills`) and one for each project you registered with `project add`. The sidebar lists them under Library ▸ Projects, with a project registered inside another drawn under it, one indent deeper. Both are read with `ls --local`.

The header names the root and its path, and for a project it names the GitHub slug or says `GitHub: not connected`. Under it are the overview tiles (Skills, Evaluated, Activation, Needs attention), then the search and sort row, then the cards.

The Skills tile carries the root's publish state as one caption line, in the word the cards use: `3 unpublished`, with `· 1 with an unknown publish state` appended when the CLI could not tell, `All published to the marketplace` when nothing is left unknown, and nothing at all when nothing is known.

The Activation tile is the Library's view of [`usage`](../evaluating/usage.md): how many of this root's skills fired on this machine in the window, as `4 of 15`, over a three-segment meter and its caption, `3 chosen by the model · 1 by name only · 11 never fired`. Chosen means the model picked the skill from its description at least once; by name only means it fired only because a person named it, which is the finding `usage` exists for; never fired is everything else on the board. Under that is the window and any hedge the counts need (`last 30 days · 1 placed mid-window`). The tile reads `usage --json` itself, once for the whole machine and shared with every skill page, so a slow transcript scan never holds the cards back: it draws a skeleton while the scan runs, a dash with the CLI's error if the scan fails, and a dash with `This terum-skills version cannot report skill firings.` when the CLI predates the verb. An empty library reads `Nothing fired yet`. The manual that setup places is left out of the count.

Clicking the Activation tile opens the **Activation** popup, a link in the URL as `?dialog=activation`. It holds three rows on one date axis (the running total of fires beside the window before, misfires from the latest miss screening, and how many skills have gone a full window without firing), then one row per skill with its firings by day, who started them, its misfires, when it last fired and its eval verdict, then **Worth a look**: what stands out, in counts, such as a skill that only fires when named or one that passes its evals and never fires. Its picker sets the window for the tile too, 30 days, 90 days or 1 year, in the URL as `?window=`. The longer windows reach into this machine's `usage` archive. Misfires come only from a screening a person starts; nothing spends a model call on its own.

Each card carries the skill's project and category, its name, description, version line, size, any install count, and its flags. A card for a folder on this machine also carries the per-machine switch: it runs `skill enable` or `skill disable`, which writes Claude Code's own `skillOverrides` setting. See [Claude Code integration](claude-code-integration.md).

| Control | What it does |
|---|---|
| Search | Filters the cards already on screen by name and description. It is in-memory over what the CLI served, and lives in the URL as `?q=` |
| Sort | Recently updated (the default), Name, or Category. In the URL as `?sort=` |
| Select | Turns on selection mode. Escape or Done leaves it |
| Sync | Runs `sync`, then `reconcile --list`, and opens the reconcile dialog |
| Add project | Opens a folder chooser, then runs `project add` on what you chose |
| Drag a folder onto the board | One `project add` per dropped folder |
| Right-click a project row | Show in Finder, Copy path, Rename… (runs `project rename --to <name> -- <path>`, a display name only) and Manage projects… |
| Card menu (⋯ or right-click) | The card's actions, plus Copy name, and, for a card with a folder on this machine, Copy path, Show in Finder (Show in Explorer on Windows) and Open in editor |

The card menu runs one verb each: Run eval (`eval`), and for a folder no team has, Move to… (`skill move`), Copy to… (`skill copy`), Rename… (`skill rename`), Delete… (`skill delete`). For a team skill it offers Install… (`install`), Reinstall… when your people file records the install but nothing is on this machine, or Uninstall… (`uninstall-skill`) instead. Publish to team… (`publish`) and Unpublish… (`unpublish`) are on both. A row the card cannot run is disabled and carries the reason.

In selection mode each card takes a checkbox and a bar appears above the grid: `N of M selected`, Select all, Clear, `Publish N skills to team…`, and `Evaluate N skills…`. Publishing a selection opens a dialog that lists every selected card as ready or skipped with its reason, offers the publish target, and then runs one `publish` process per skill, one at a time. When it ends the board reports `Published N of M skills` and the count that failed. `Evaluate N skills…` hands the selection to the eval dialog described below.

Sync is the Library's own two-step: the fetch-only `sync` verb first, so the comparison is against the team as it is now, then `reconcile --list` to see which of your folders match a team version by bytes or by name. When nothing matches, the board says so instead of opening a dialog.

## Skill detail

Opening a card opens its detail page. A team skill is addressed by name; a folder the team has never seen is addressed by its path. The page reads `ls --local`, `ls --team`, `status`, `validate` and `eval-report`.

The page ships four tabs.

| Tab | What it shows |
|---|---|
| SKILL.md | The frontmatter and the rendered body, with the file list and Open in editor |
| Evals | The receipt for this version, the history of runs beside it, and Run eval |
| Quality | Not shipped. The tab draws a coming-soon panel |
| Activity | Live firings for this skill, from `usage`: four figures for the window (firings, active days, longest streak, last fired), one note when the firings raise one (never chosen from its description, placed and never fired), the last year as a contributions-style calendar with the window bracketed under it, what happened since placement, and the prompts a miss screening found it should have caught. The window picker (30 days, 90 days, 1 year) lives in the URL as `?window=` |

The SKILL.md tab's caption ends with `read from …`, and that is where the bytes on screen came from: the path of the copy on this machine when the skill is placed here, and `the team repo clone · <slug>` when it is not. It tells you whether you are reading your own folder or the team's published version.

The details rail on the right carries the status line and the per-machine switch, a Manage with Terum… menu for a folder Terum did not place, the details (scope, version, files, size, context, installs), the repository link, the author, when it was last evaluated, and the command that shares it.

Every action names the command it runs, and each dialog shows that `npx -y terum-skills@latest …` line before you confirm.

| Action | Verb |
|---|---|
| Install | `install [--team <t>] [--into <root>] -- <ref>` |
| Remove | `uninstall-skill [--team <t>] [--from global\|<root>] -- <ref>` |
| Publish | `publish [--team <t>] [--project <p>] [--category <c>] -- <ref>` |
| Unpublish | `unpublish [--team <t>] --yes -- <ref>`, behind typing the skill's name |
| Run eval | `eval [--k <n>] [--model <m>] [--judge-model <m>] [--team <t>] -- <ref>` |
| Enable / disable | `skill enable -- <path>` / `skill disable -- <path>` |
| Move, Copy, Rename, Delete | `skill move`, `skill copy`, `skill rename`, `skill delete` |
| Fix | `skill fix -- <path>` |
| Change category | `skill category --to <name> -- <path>` |
| Copy command | Copies the line the dialog shows to the clipboard |

There is no Validate control. The page runs `validate` as part of its own read, but the button that runs it again sits on the Quality tab, which is not shipped. Fix is offered beside the `broken` flag instead, and that flag comes from `ls --local`.

The Install dialog offers the destination (Global or one of your projects) and lists the tool grants you are approving. Unpublish is styled as the destructive action it is: it removes every version of the skill for everyone in the team.

## Marketplace

The Marketplace is the team's published skills, read from the team repo clone with `status`, `ls --team` and `ls --local`. Nothing here fetches. The home board is a search box over four shelves: Top rated, Teams / Projects, People and Browse by category. Three of them open a list view of their own, and each list view carries its own search and a sort toggle between the drawn ranking and A to Z. Teams / Projects has no list view: a team project opens its own page straight from the shelf, as a person does. Top rated is ordered by install count, which its own subtitle says: `by installs, from people files`. Nothing in the app ranks by eval outcome, so the name promises more than the data carries.

A team project's page installs the whole project with `install project <name>`, and its dialog offers the destination the same way the skill dialog does, including an Add project… button that registers a new root first. Removing runs `uninstall-skill project <name>`. A person's page does the same with `install member <handle>` and `uninstall-skill member <handle>`; what it installs is that person's curated profile list.

New project creates a team project by running `team project create [--remote <url>] -- <name>`. Its own terminal hint reads `npx -y terum-skills@latest project create <name>`, which fails when you paste it: there is no top-level `project create`. Use the `team project create` form above.

A team project is a name and a repository. Skills reach it by being published to it, so the way to add a skill to a project is the publish target on the skill's Publish dialog or in Settings ▸ Publishing, not a control on the project page. The home board's Teams / Projects shelf still says `their skills place when you sync inside the repo`; a fetch places nothing, so a project's skills reach a machine only when someone runs `install`.

## Search

`⌘K` (`Ctrl+K` on Windows and Linux) opens the Search board. It is a screen, not an overlay palette. It runs `search -- <query>` across every configured team, and reads your roots and the catalogue beside it, then groups the results under Skills, Your library, People and Projects. A source that fails prints the CLI's own sentence under its own group; the other groups still render.

## Members

Members reads the roster with `status --permissions` and `ls --team`. The columns are Name, Status (the GitHub permission), Joined, Skills and Last seen, and a Find members box filters them.

Invite takes one or more GitHub logins, comma or space separated, validated against the same rule the CLI uses, and runs `invite [--team <t>] -- <login>…`. It reports each login as invited, as already having access, or with the CLI's own error. The dialog also shows the block to send your teammate, which is the join command from `status`:

```sh
npx -y terum-skills@latest setup <org>/<repo>
```

The roster never lists a pending invitation. This CLI reports none, so the app draws none rather than claiming there are zero, and an invited teammate appears only once they join. The Invite dialog says as much: `Adds each login as a collaborator on the team repository. GitHub emails each invitation; they appear on the roster once they join.`

The permission chip is read-only and comes from GitHub. Admin means admin permission on the team repository, read when you sync. A repository owned by a personal account carries only owner and write, so everyone but the owner reads as Member. A dash means the permission could not be read, which is not the same as Member.

There is no remove control on a member row. Removing someone runs one confirmation the app does not drive yet, so it stays in the terminal:

```sh
npx -y terum-skills@latest team remove <handle>
```

See [Team admin](team-admin.md).

## What the app hides

Two drawn surfaces are not reachable when the app is driving the real CLI, because no verb answers them: the Inbox (and its sidebar rows and bell) and the onboarding tour. The Inbox route redirects to the Library, Settings ▸ Inbox is filtered out of the navigation, and every tour step redirects to the Library as well. They are visible only in the browser mock the maintainers develop against.

The tour's first step is the exception. `/onboarding/boot` is not the drawn tour but a real `setup` run, streamed into the window with its questions as dialogs, and it is the board setup hands you when it prints `Continuing in the app.`

The Quality tab is drawn but not shipped, and the Activity tab ships the firing counts only, not the drawn activity feed.

## Settings

Settings has one navigation entry per section: Account, Team, This machine, Sync, Updates, Evals, Publishing, Appearance, Advanced, About. `⌘,` opens it. Most rows are a read of CLI state; only the app's own chrome is a preference the app stores, and anything else refuses a write with `This setting is owned by the CLI, not app preferences.`

### Account

| Row | Default | What it does |
|---|---|---|
| GitHub | read-only | Whether `git` and `gh` are present. Authentication is not checked |
| Open gh | | Copies `gh auth login`. The app never changes your credentials |
| Access to team repos | read-only, `Ambient git credentials` | Terum stores no token of its own |
| Name, Email, Default handle | your current values | Saved on blur by `login --set name=… --set email=… --set default-handle=…` |
| Handle on `<team>` | locked | Fixed once your people file exists |
| Sign out | | Copies `gh auth logout` |

### Team

The team card names the team, its remote, its member and skill counts and your handle. Clone shows the working copy and its state. Last fetch shows the stamp and a Sync now button (`sync`). Leave on this machine opens the confirmation for `team leave -- <name>`. Join another team opens a dialog that runs `setup <org>/<repo>`. While a team is configured the row shows `Leave <team> first` in place of the Join button, because Terum Skills keeps one team per machine.

Team policy (categories, skill licence, team projects) is read-only. It lives in `team.json` and changes by a pull request on GitHub; the app has no verb for it.

### This machine

| Group | Contents |
|---|---|
| Identity | The machine name and OS. Terum keeps no list of your machines and nothing here is committed |
| Placed here | The placement ledger: Path, Scope, Version, Placed, State. A row opens its skill; right-click for reveal and copy path |
| Tool approvals | What you approved, per skill, with the exact tool list |
| Quarantine | What is in quarantine, with Prune… (`prune`), the only thing that deletes it. A CLI that does not report the contents gets one line saying so and no button |
| Projects | One row per registered project, a sub-project captioned with its parent, with Rename (`project rename --to <name> -- <path>`) and Remove (`project remove -- <path>`), and a field plus Add (`project add -- <path>`) |

### Sync

The session-start hook row is read-only and reads `Managed by setup`. The app cannot read or change `~/.claude/settings.json` yet, so it never claims the hook is installed or not.

Sync now runs `sync`. The row states the automatic policy in the app's own words: at launch and when you come back to the app, at most once a minute. When the last automatic fetch failed, this is where the CLI's first error line and its notices appear. The section repeats the quarantine row and its Prune… button.

### Updates

The Skills group is read-only: tracked installs follow the team, pinned installs stay where they are, and a fetch only tells you a newer version exists. Running `install` again is what places it.

The CLI group has Show update command, which runs `update` and shows the advice it prints. `update` never runs a package manager. Two read-only rows describe the release notice and the release probe: the probe reads release tags from `github.com/ryanliu-terum/terum-skills` at most once a day, and only while a team on this machine lives on GitHub.

The app group is the app's own update channel, covered below.

### Evals

These are the flags the app passes to every eval it starts.

| Setting | Default | Effect |
|---|---|---|
| Repetitions per case | what the CLI reports; options 1, 3, 5, 10 | `--k`. Unset passes no flag and the CLI uses k = 1. When the CLI reports no default at all the chooser is not drawn and the app passes no eval flags |
| Model for the arms | `sonnet` | `--model` |
| Judge | `sonnet` | `--judge-model` |
| Escalation judge | read-only, `opus · not yet` | The CLI does not take it |
| Evaluate pending… | | Opens the batch dialog for every shared skill with no receipt for its current version |
| Run queued evals overnight | on | Drains the queue between 01:00 and 05:00 while the app is open and idle |
| Agent CLI | read-only | Evals drive the `claude` CLI on this machine, on your own subscription |
| Sandbox | read-only, `--setting-sources project` | So your global skills cannot leak into a result |
| Run trees | | Reveals `~/.terum/skills/evals/<team>`, the older layout; this CLI writes runs under `evals/local/<digest>/`. Nothing prunes these |
| Commit receipts | on | Stored per machine. The app passes no flag for it, so receipts follow the CLI's own behaviour |

### Publishing

| Setting | Default | Effect |
|---|---|---|
| Publish to | `Marketplace only` | The publish target the dialogs open with. A team project here is an extra list the skill is added to, sent as `--project` |
| Category | `Model suggests` | `Model suggests` sends no `--category`; `Ask before publishing` asks in the dialog. A category already declared in SKILL.md is kept either way |
| Eval receipts | read-only, `Attached automatically` | Every local eval of the exact bytes you publish is attached to the new version |

Neither default can actually be changed here. `publish:target` and `publish:category` are not among the keys the app is allowed to store, so picking another option fails with the refusal above, `This setting is owned by the CLI, not app preferences.`, and the chooser stays where it was. Every publish dialog therefore opens on `Marketplace only`, and because the category default can never reach `Ask before publishing`, no dialog draws a Category field. You can still choose a different target inside a publish dialog for that one publish, and `--category` is yours from the terminal.

Below the defaults, Shared from this machine lists every folder in Global with its state on the team (In sync, Edited since publish, Not published yet, Not shared) and a Publish… button for each one that is out of step. Two read-only groups spell out what publish does every time, and that a fetch never uploads anything.

### Appearance

| Setting | Default |
|---|---|
| Theme | Dark. System and Light are the other choices |
| Open at start | `Library ▸ Global` |
| Sidebar counts | on |
| Keyboard | Read-only. `⌘K` search, `⌘,` settings, `⌘R` sync now, `⌘[` and `⌘]` back and forward, spelled for your platform |

### Advanced

Local state points at `~/.terum/skills` and says what deleting `config.json` costs: every skill Terum placed goes invisible to the tool, every tool approval is asked again, and your handle, email and display name are asked again. Two more rows reveal the version cache and the eval run trees.

Diagnostics ▸ Status runs `status` in a dialog. The Logs row exists to say there is no log file: the CLI prints as it goes.

The danger zone runs `uninstall`, the machine teardown. The app renders the CLI's own consent inventory as the confirmation, and refuses to start while an eval is running. See [Uninstalling the app](#uninstalling-the-app).

### About

The app version, the CLI version (with a Check button), the agent CLI and the platform, each copyable, plus a right-click that copies all four lines for a bug report. Under Project are the feedback link and the licence.

## Running evals in the app

Run eval is on the card menu, on the Evals tab and on the Evals empty state. All of them open the same dialog, which names the skill, estimates the cost from earlier runs when it can, and shows the command it is about to run. It has two buttons: Run eval starts it now, and Queue for overnight queues it for the app's 01:00 to 05:00 window instead.

An eval runs against the copy on this machine, so the dialog refuses a skill with no local folder rather than spending a click on a certain failure.

While a run is live the dialog streams the CLI's own lines and a status line: `Starting…`, then `Running…`, then `N of M evaluated` once the CLI reports progress. Closing the dialog does not stop the run.

The top bar carries a chip for as long as the app remembers the run: `Starting · <skill>`, `Evaluating · <skill>`, `Evaluating · N of M`, then `Eval finished`, `Eval failed` or `Eval stopped`. Clicking the chip reopens the dialog. While the run is live, a red Stop button sits beside the chip and cancels it; afterwards a ✕ forgets the settled run. A card covered by the running eval shows a pulsing dot.

One eval at a time. Starting a second while one is running is refused with `An eval is already running for <skill>`, and the overnight drainer skips its window rather than competing.

Results land in the skill's Evals tab. A finished run closes its dialog once and the tab refreshes to the new receipt, with earlier runs listed in History beside it. Receipts and transcripts are written under `~/.terum/skills/evals/local/<digest>/<run-id>/` whether or not the app is open. See [Running evals](../evaluating/running-evals.md) and [Results and receipts](../evaluating/results-and-receipts.md).

## Background sync

Reads never fetch, so a teammate's commit reaches you only when something runs the fetch-only `sync` verb. The app runs it in the background at two moments: once when it first sees a CLI that supports it, and whenever the window regains focus.

It is throttled to at most once a minute, runs one at a time, and never starts while a write verb is running in the foreground. There are no timers: an app you leave open all afternoon fetches nothing until you come back to it. Every completed attempt is recorded, and a failed one shows its first error line in Settings ▸ Sync.

Returning to the window also marks the boards you are looking at as stale. They keep their current contents and are replaced when the fresh read differs, so coming back never blanks the screen.

## Updating the app

The app updates itself. The CLI never installs a CLI release for you, and this is the one exception.

**Learning about a release.** At launch the app asks the CLI for the state of things with `app-update --check`. The CLI probes the release tags of `github.com/ryanliu-terum/terum-skills` with `git ls-remote --tags`, at most once a day and only while a team on this machine has a GitHub remote. On a machine with no such team the row reads `<version> · release advertisements are not checked on this machine.` Regaining focus repeats the launch check while it has never succeeded, and after an hour re-reads the CLI's answer. Check again and Update and relaunch force a probe now.

**Staging.** Unless the policy is Ask me, a newer version is downloaded as soon as it is seen: `app-update --stage --release <version>` fetches the asset and its `.sha256` with `gh`, verifies the checksum and the build attestation, unpacks the bundle on macOS, and records it under `~/.terum/skills/app/<version>/`. A version whose download failed or was cancelled is not retried automatically in the same session.

**Installing.** Settings ▸ Updates ▸ Install updates picks when a verified download is installed.

| Mode | What it does |
|---|---|
| Ask me | Shows Install now and never installs by itself. It downloads nothing either |
| When I quit (default) | Installs the downloaded update after the app closes |
| Overnight | Installs and relaunches between 01:00 and 05:00 while the app is open and idle |

Install now (and Try again after a failed install) opens one confirmation: `Install <version> and relaunch now?`, with the warning that relaunching closes the window and stops anything the app is running. Relaunch runs `app-update --apply`, which hands the install to a detached process that waits for the app to exit, installs, and starts the new version.

**The relaunch row.** Update and relaunch is the one-gesture version of all of it: `Checks github.com now, downloads and verifies the newest build, then installs it and relaunches the app. Anything the app is running — an eval, a sync — is stopped when it closes.` It owns its own progress lines, so it never mixes with a download already running above it.

From a terminal, the same three steps are:

```sh
npx -y terum-skills@latest app-update --check
npx -y terum-skills@latest app-update --stage --release <version>
npx -y terum-skills@latest app-update --apply --release <version>
```

`--check` honours the once-a-day cap unless you add `--force`. `--stage` downloads and verifies but installs nothing. `--apply` returns immediately and the caller has to quit; on macOS the install fails rather than replacing a bundle that is still running.

**App and CLI versions.** A released app build carries the same version number as the CLI release it ships with, and `npx -y terum-skills@latest app` downloads the app for the CLI version you ran. The app then runs whatever Node binary and CLI entry `app.json` recorded, usually the npx cache copy that ran `app`. The two advance separately after that: the app through this update channel, the CLI through `npx -y terum-skills@latest`. On macOS `app` never downgrades a bundle that is already this version or newer, so after the app has updated itself past your CLI, `app` opens the newer one. Settings ▸ About shows both numbers.

## Where the app keeps its own settings

The app's own preferences (theme, layout, the eval defaults, the update policy) live with the app, not in `~/.terum/skills` and not in the team repo. They are stored in `preferences.json` in the app's config directory: `~/Library/Application Support/com.terum.skills/preferences.json` on macOS, `%APPDATA%\com.terum.skills\preferences.json` on Windows. The set of keys the app may write is fixed in its code, which is why the two publishing defaults above cannot be saved at all. Window size and position are kept separately by the window-state plugin.

Everything else Settings shows is CLI state under `~/.terum/skills`. See [Local state](../reference/local-state.md).

## Uninstalling the app

Settings ▸ Advanced ▸ Remove… runs `uninstall`, which tears down what Terum put on this machine and, on macOS only, deletes the app bundle. It does not remove the npm package; its last lines tell you how.

```sh
npx -y terum-skills@latest uninstall
```

On macOS this deletes `~/Applications/Terum Skills.app` and the download records under `~/.terum/skills/app`. A copy that is running keeps running until you quit it, and cannot be reopened from the Dock. Running `app` downloads it again.

On Windows the app stays installed. The CLI says so: `The desktop app under %LOCALAPPDATA%\Terum Skills stays installed; remove it from Windows Settings ▸ Apps. Only its download record under <root>\app was removed.`

Either way the app's own preferences are kept. Uninstall does not touch them.

To remove only the app and keep everything else, delete `~/Applications/Terum Skills.app` yourself, or uninstall Terum Skills from Windows Settings ▸ Apps.
