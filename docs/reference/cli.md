# CLI reference

Every command terum-skills registers, what it asks, what it writes, and how it refuses.

## Invocation

Run the CLI through npx and you always get the published release:

```sh
npx -y terum-skills@latest ls
```

If you install the package globally (`npm install -g terum-skills`), the same commands work under the bare name:

```sh
terum-skills ls
```

The CLI detects which form you used and prints follow-up commands back in that form. It only uses the bare form when this copy was launched from a global install, the first `terum-skills` on your `PATH` resolves to that same copy, no `npm_*` environment variable is set, and the platform is not Windows. Everything else, including every npx run and every Windows run, prints the `npx -y terum-skills@latest …` form. This is a display hint only. It never changes what the command does.

This page writes every example in the npx form.

## Version and help

`-v, --version` prints the package version, or the literal `version unknown` when the version cannot be read, and exits 0. The current package reports `0.20.1`, and that is the version the CLI writes into the commands it places for you rather than `@latest`: see [setup](#setup).

`-h, --help` prints the command list. It works on the program, on a group (`team`, `team project`, `skill`, `project`, `ls`) and on every individual command, and commander also registers `help [command]`, which prints the same text. Help is free everywhere except on `serve`: `serve --help` prints its help, then writes the line `{"t":"result","verb":"serve","ok":false,"exitCode":1,"error":"(outputHelp)"}` to stdout and exits 1, because the bin sends every `serve` invocation into the session path before it looks at the flag.

The root help ends with a "Get started" block:

```
Get started:
  Create a team: npx -y terum-skills@latest setup
  Join a team:   npx -y terum-skills@latest setup <org>/<repo>
  Have a skill install command? Run it directly.
  If no teams are configured, it guides you through setup first.
```

The first two lines are the same lines a read-only command prints when no team is configured on the machine.

Four commands are registered hidden and never appear in `--help`. They are described under [Hidden commands](#hidden-commands). Twenty-two options are hidden too: seventeen `--team` options, plus `--as`, `--from`, `--permissions`, `--await-pid` and `--apply-now`. This page lists them, marked "(hidden)".

## Frames

`--frames` turns the CLI into a JSON-line channel for another program. The flag is global and position-independent: it is taken off `process.argv` before the command parser sees it, so `--frames ls` and `ls --frames` are identical, and after a `--` separator it is an ordinary operand. In frame mode the CLI writes one JSON object per stdout line (`hello`, `print`, `ask`, `progress`, `result`), reads `answer` and `cancel` objects on stdin, and sends every diagnostic to stderr so stdout stays parseable. Exactly one `result` frame ends a run. Two commands refuse the flag: `sync --hook` and `team migrate`. The full contract, including the feature map in the `hello` frame, is in [the frame protocol](../frame-protocol.md).

## Choosing a team

terum-skills keeps one team per machine. `team create`, `team join` and `setup` refuse to bind a second one before they do anything, and say which team is already bound and how to leave it.

A machine can still end up with more than one configured team (it was configured before that rule, or a team was added under a second name), so most commands accept `--team <team>`. It is hidden from `--help` on every command except `eval` and `eval-report`. How a command picks a team:

| Situation | What happens |
| --- | --- |
| `--team X` names a configured team | That team is used. |
| `--team X` names nothing configured | `Team X is not configured.` |
| Exactly one team configured, no `--team` | That team is used. |
| No team configured | The command fails with the "No team is configured on this machine." block and the two setup lines. |
| More than one team, no `--team` | `` This machine is configured for teams a, b; Terum Skills keeps one team per machine. Run `npx -y terum-skills@latest team leave <name>` for each you no longer want; until then name one with --team. `` |

`install` and `uninstall-skill` parse the ref's own team parts before anything else. `publish`, `unpublish`, `team project create` and `team project delete` go through the same resolver but hand it no ref parts, so only the last rule below reaches them:

- A three-part ref, `owner/repo/skill`, names the repository `github.com/owner/repo`. If that repository is the configured team, it is used. If the machine is on a different team, the one-team rule refuses. If the machine has no team at all, `install` continues by running `setup <org>/<repo>` in quiet mode and then installing, while `uninstall-skill` stops with `` This machine has not joined <remote>; run `npx -y terum-skills@latest team join <org>/<repo>` first. ``
- A two-part ref, `team/skill`, names the configured team by its local name.
- A bare ref on a machine with more than one team and no `--team` fails with `A bare skill ref is ambiguous across configured teams; use <team>/<skill> or --team. Matching refs: a/x, b/x.` The second sentence appears only where the verb passed a skill name, so `unpublish` and the two `team project` commands print the first sentence alone.

`status`, `search`, `sync`, `reconcile` and `uninstall` run over every configured team when no `--team` is given.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | The command succeeded. Nothing is written to stderr. For a read-only query it means the query worked, not that your setup is healthy. |
| 1 | The command failed. One line of failure text goes to stderr. Under `--frames` the same text is the `error` field of the terminal `result` frame. A usage error from the argument parser also exits 1. |
| 143 | A `cancel` frame arrived under `--frames`. The CLI runs its shutdown hooks (releasing locks and killing child processes) and exits. |

`--help` and `--version` exit 0, with the `serve --help` exception above. A reader that closes the pipe (`… | head -5`) is not a failure: the CLI marks its output broken so a later question fails closed instead of waiting on a prompt nobody can see.

## Environment variables

| Variable | Effect |
| --- | --- |
| `CI` | Any non-empty value disables the passive update notice on stderr. |
| `NO_UPDATE_NOTIFIER` | Any non-empty value disables the passive update notice. |
| `TERUM_SKILLS_NO_UPDATE_NOTIFIER` | Any non-empty value disables the passive update notice. |
| `TERUM_SKILLS_AGENT_CMD` | The command `eval` runs as the agent. Defaults to `claude`. |
| `NO_COLOR` | Set to anything, turns off the decorated banner and colour. `TERM=dumb` does the same. |
| `TERUM_SKILLS_PLAIN_PROMPTS` | Any non-empty value replaces the cursor-driven list with the numbered line prompt. `TERM=dumb` does the same, and so does either stream not being a terminal. |
| `LOCALAPPDATA` | Windows only. Where `app` and `app-update` install and look for the desktop app. |
| `PATH` | Read to decide whether the bare invocation form is available, read again with `PATHEXT` and `USERPROFILE` when `eval` resolves the agent command on Windows, and recorded in `~/.terum/skills/run/app.json` so the desktop app can start this CLI. |
| `npm_command`, `npm_lifecycle_event`, `npm_execpath`, `npm_config_user_agent` | Any of these present, even empty, forces the npx invocation form in printed commands. |

None of these suppress the release probe itself. `update` and `app-update --check` still ask GitHub for release tags; only the one-line notice is suppressed.

## Team

`team` is a group. `npx -y terum-skills@latest team` lists its subcommands.

### setup

```
Usage: terum-skills setup [options] [target]
```

Arguments: `[target]`, optional. Either `<org>/<repo>` on GitHub or any git remote URL. With a target, setup joins that repository. Without one it asks whether to create a team or join one, but only on a machine with no team configured. With one configured it prints `` Resuming setup for team <x>. Terum Skills keeps one team per machine; to move this machine to another team run `npx -y terum-skills@latest team leave <x>` first. `` and never asks.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--app` | none | on where an app exists | Open the desktop app. |
| `--no-app` | none | off | Keep setup in the terminal and do not open the desktop app. |
| `--no-projects` | none | off | Do not offer to add a project to your library. |
| `--no-existing` | none | off | Do not check existing Library skills against the team. |
| `--no-evals` | none | off | Do not offer to evaluate the shared skills that have no receipt. |

What it does: setup is the onboarding wizard, and the desktop app comes before the team. Only the welcome lines, the move question below and the one-team check run ahead of it. Where an app exists for the platform and a person is at an interactive terminal, setup installs and opens the app without asking, prints `Continuing in the app.` (or `Continuing in the app. Join <org>/<repo> there.` when a target was given and the move question did not fire) and returns. The team is then created or joined inside the app. The terminal wizard continues only when the app step is skipped: on Linux and WSL, over a pipe, over frames, with `--no-app`, in `install`'s quiet bootstrap, or when the app hand-off fails. In the terminal it then asks the create-or-join question, checks the GitHub CLI, creates or joins the team, invites teammates, offers to add a project, reconciles your Library against the team, offers to evaluate shared skills with no receipt, offers the session hook, places the eight terum-skills skills for Claude Code and Codex, and finally offers the edit hook. When the app hand-off had failed for a cause the wizard can change (gh logged out, offline), setup tries the app once more after the closing summary, without a target; a cause that cannot change, such as no app published for this version or a rejected download, is not retried. A bare `setup` cannot join: choosing "Join an existing team" prints the command to ask the team owner for and exits having written nothing.

Asks, in order, where the step is reached:

- `Move this machine from <current> to <new url>?` (only when a target is given, one team is bound, and that team's repository answers "repository not found")
- `Create a team or join one?` with `Create a new team` and `Join an existing team`, no default
- `` GitHub CLI is installed but logged out. Run `gh auth login` now? ``
- Everything `team create` or `team join` asks
- `Invite teammates by inputting their GitHub usernames (comma or space separated; blank to skip)`, re-asked as `Those GitHub usernames could not be invited; enter them again (comma or space separated; blank to skip)` when every failure was a typo or an unknown login, for at most three rounds. A cap or a permission refusal exits instead.
- `Add a project?`, then `Which folder?`
- Everything `reconcile` asks about your existing Library folders
- `Evaluate the N shared skills that have no receipt yet? This runs Claude on each one and records results locally.` with `Now`, `In batches`, `Overnight`, `Skip`, defaulting to `Skip`; `In batches` then asks `How many at a time?`, and each batch boundary asks `Continue with the next N? (X of Y done, Z left)`
- `Install the Claude Code session-start hook so team skills sync automatically? (edits ~/.claude/settings.json)`
- `Remind Claude Code to publish a skill after it edits one? (installs ~/.terum/skills/hooks/terum-skills-edit.mjs and a Write/Edit hook in ~/.claude/settings.json)`

The last two default to No, and each one prints the absolute path it would write rather than the `~` form shown here. Between them setup places the eight skills without a question and prints `Installed the terum-skills skills at <root>: <names>.` for each root it wrote. See [local state](local-state.md) for exactly what each one writes.

Two of the things setup writes carry a `terum-skills` command that later runs without you typing it: the `SessionStart` hook entry and the `/terum-skills` manual. Both name this copy of the CLI rather than the registry's newest release. Where the bare invocation form is available they name `terum-skills`; everywhere else, including every Windows machine and every npx run, they name `npx -y terum-skills@<this version>`. Nothing fetches a newer CLI at the start of a session. After you update the package, re-run `setup` once and both move to the new copy.

Writes: `~/.terum/skills/config.json`, the team clone under `~/.terum/skills/teams/<team>/`, the eight skill folders under `~/.claude/skills/` (and under `~/.codex/skills/` when `~/.codex` exists), and whichever of `~/.claude/settings.json` and `~/.terum/skills/hooks/terum-skills-edit.mjs` you accept. On macOS and Windows it also installs the desktop app. It writes the team repository through `team create` or `team join` only.

Fails when: the machine is already on a different team; you are creating a team on GitHub without a logged-in `gh`; the clone directory exists but is not a complete clone of that remote; an invitation hits GitHub's cap, a permission refusal or an authentication failure; or the delegated `team create` or `team join` fails for any of its own reasons, which aborts the wizard. A failed invite prints what is already durable and how to finish before it exits.

### login

```
Usage: terum-skills login [options]
```

Arguments: none.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--set` | `<key=value>` | none | Set name, email, or default-handle without prompting. Repeatable. |

What it does: records this machine's identity in `config.json`: GitHub login, team handle, display name and email. Bare, it checks the GitHub CLI first, then collects the four fields, then prints one of three lines about `gh` and `Identity saved: <Name> <email> (@login), default handle <handle>.` With `--set` it prompts for nothing and accepts only the keys `name`, `email` and `default-handle`. It never writes a team entry: only `team create` and `team join` do that, because only they prove your handle against the roster.

Asks: with `--set`, nothing. Bare, `` GitHub CLI is installed but logged out. Run `gh auth login` now? ``, then the single confirm `Use this identity?` when all four fields are already known. Answering yes ends the questions; answering no falls through to the four questions `GitHub login (- for none)` (`GitHub login` where nothing can be suggested), `Team handle`, `Your name` and `Your email`. A machine that knows less than four fields gets the four questions with no confirm. Each of the four is asked at most three times in total, printing its rule after a rejected answer.

Writes: `~/.terum/skills/config.json` only. No team repository write.

Fails when: `--set` names a key other than `name`, `email` or `default-handle` (`Accepted keys: name, email, default-handle.`, checked before the `=`); a `--set` argument has no `=` (`Use --set <key>=<value>. Accepted keys: name, email, default-handle.`); a value fails its schema; an identity answer is still invalid after three attempts (`Invalid <question> after 3 attempts: <rule>`).

### status

```
Usage: terum-skills status [options]
```

Arguments: none.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--team` (hidden) | `<team>` | all configured teams | Show only this configured team. |
| `--permissions` (hidden) | none | off | Also ask GitHub which members hold admin permission. One network call. |

What it does: prints the CLI version, then for each configured team its handle, its repository as `https://github.com/<owner>/<repo>`, clone state, member count with the first five members, the number of shared skills, the literal line `Evaluated skills: not yet available`, and the staleness line `` <team> may be stale; run `npx -y terum-skills@latest sync`. `` A membership line appears only when your entry is archived or absent; an active member sees none. It reads the local clone and never fetches, so exit 0 means the query succeeded, not that the setup is healthy or that you still have access. With no team configured it prints the get-started lines and still exits 0. `--permissions` is the only thing here that touches the network.

The staleness line is not a timer alone. The stamp counts as fresh only when `~/.terum/skills/run/<team>.stamp` exists, is a file, and was written in the last hour without being dated more than a minute into the future. A machine that has never synced has no stamp, so its first `status` prints the line.

Asks: nothing.

Writes: nothing.

Fails when: any selected team's details could not be read. The line is `<team>: local team details could not be read.` and the per-team reason is printed above it. An unknown `--team` fails the whole command with `Team <team> is not configured.` instead.

### invite

```
Usage: terum-skills invite [options] <github-login...>
```

Arguments: one or more GitHub logins, variadic and required.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--team` (hidden) | `<team>` | the configured team | Configured team, required when more than one exists. |

What it does: adds each login as a collaborator on the team's GitHub repository through `gh api -X PUT --include repos/<owner>/<repo>/collaborators/<login>`. `--include` is load-bearing: the status branches below are read out of the `HTTP/… <code>` header it prints. The whole batch is validated for syntax before a single invitation is sent, so a typo costs nothing. Per login it prints `Invited @x.` (201), `@x already has access.` (204) or `@x already has access (owner).` (422 on the repository owner). It always ends by printing the block to send a teammate, which carries `npm install -g terum-skills`, the `setup <org>/<repo>` command and a `team join` line labelled `Bare equivalent:` although it too is written in the npx form. Invitations carry no permission parameter, so GitHub grants its default (push).

Asks: nothing.

Writes: nothing locally and nothing in the team repository. The change is on the GitHub host.

Fails when: any login is syntactically invalid (nothing is sent); the remote is not a GitHub repository; GitHub answers 404 (`there is no GitHub user named @x`); GitHub answers 403 mentioning invitations, which is its cap of 50 per repository per day; `gh` is missing or logged out.

### profile

```
Usage: terum-skills profile [options]
```

Arguments: none.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--name` | `<display>` | unchanged | Your display name on the team. |
| `--bio` | `<text>` | unchanged | Free text on your person page. |
| `--role` | `<role>` | unchanged | Your job label on the team. |
| `--project` | `<name>` | unchanged | Project membership. Repeat for each project. Commander collects the values into an array, which the CLI passes on only when it is non-empty, so omitting the flag never clears your projects. |
| `--remove` | `<skill>` | none | Take a skill off your profile. Publishing adds it. |
| `--team` (hidden) | `<team>` | the configured team | Configured team. |

What it does: rewrites your own `people/<handle>.json` in the team repository in one write. It is the team-facing profile, not the machine identity that `login` sets. `--remove` takes one entry off the curated `profile[]` list that publishing adds to, matched on the entry's own copy of the name or its id, so it works for a skill whose folder is long gone. Every run also refreshes your `local_skills` count, unless the Library could not be counted, in which case the old number stands. `--name` is mirrored back into `config.display_name` locally. It prints `Updated <handle>: <fields>.` or `No profile changes for <handle>.`

Asks: nothing.

Writes: `people/<handle>.json` in the team repository, and `~/.terum/skills/config.json` when `--name` was given.

Fails when: you try to change `email`, `github` or `handle` (`profile cannot change <field>.`, checked before anything is read); no team resolves; the clone has no `team.json` and `--project` was given (`Missing team.json.`); a `--project` names a project that is not in `team.json` (`Unknown project <project>.`); your person file is missing (`Missing people/<handle>.json.`); `--remove` names something not on your profile (`<name> is not on your profile.`).

### team create

```
Usage: terum-skills team create [options] [name]
```

Arguments: `[name]`, optional. Prompted as `Team name` when omitted.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--org` | `<org>` | your own account | GitHub organization. |
| `--repo` | `<repo>` | `<team name>-shared-skills` | GitHub repository name. |
| `--remote` | `<url>` | none | Push the scaffold to an existing empty remote instead of creating one on GitHub. |

What it does: creates the team's private repository, scaffolds it, and binds this machine to it. On the GitHub path it runs `gh repo create <spec> --private`, sets delete-branch-on-merge, then pushes a bootstrap commit holding `team.json` (layout version 3, seven default categories, an empty project list, `policy.skill_license` of `UNLICENSED`), your `people/<handle>.json`, `skills/.gitkeep`, `evals/.gitkeep`, a generated `README.md` and `.github/workflows/terum-skills.yml`. With `--remote <url>` it uses an existing empty repository and your ambient git credentials, and needs no GitHub CLI at all. There is no clone step on either path: the scaffold is committed in a staging repository beside the clone path, pushed with `-u`, armed with the pre-push guard, and then renamed into `~/.terum/skills/teams/<team>/`. A failure at any point leaves only the staging directory, which is removed. It then writes the team entry into `config.json` and offers the session hook, whose entry names this copy of the CLI the way [setup](#setup) describes.

Asks: `Team name` when no name was given; `GitHub repository name`, preceded by the line `What should the GitHub repository name be for the team "<team>"? Suggested name: <team>-shared-skills.`, asked at most three times in total when GitHub says the name is taken; the identity questions; and the session-hook confirm.

Writes: the team repository (the one commit not routed through the safe-write path), `~/.terum/skills/teams/<team>/`, `~/.terum/skills/config.json`, and `~/.claude/settings.json` if you accept the hook.

Fails when: a team is already configured on this machine; `--repo` or `--org` is combined with `--remote`; the name is already configured for another remote (`<remote> is already configured as team <name>.`); a clone directory already exists at that path; `gh` is missing or logged out on the GitHub path; `--remote` cannot be reached (`Cannot reach <remote>: …`); the repository name is taken three times, or `gh repo create` fails for any other reason (`Could not create the GitHub repository <spec>: …`); the new repository's owner cannot be resolved (`Created <spec> but could not resolve its owner: …`); the scaffold push or the clone rename fails, which prints advice distinguishing a pushed scaffold from an untouched repository; another process configures a team while this one is running; `--remote` points at a repository that already has branches. That last message reads `` <remote> already has branches; `npx -y terum-skills@latest team create --remote` needs an empty repository. To join an existing team run `npx -y terum-skills@latest team join <remote>`. ``

### team join

```
Usage: terum-skills team join [options] <target>
```

Arguments: `<target>`, required. `<org>/<repo>` on GitHub, or any git remote URL.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--as` (hidden) | `<name>` | the repository name | Local team name. Ignored with a printed notice when the remote is already configured. |

What it does: joins an existing team. For a GitHub target it accepts a pending invitation through `gh api --method PATCH user/repository_invitations/<id>`; without `gh` it prints the invitation URL and waits for you to accept in a browser. It then clones the repository (or validates and re-arms an existing clone), collects your identity, sets `user.name` and `user.email` inside the clone only, and pushes your `people/<handle>.json` in one safe write. Re-running it for the already-configured remote updates your entry rather than creating a second team. Rejoining under a handle the roster has archived also takes that handle back out of `team.json.archived`, in the same write. Nothing is installed on join: joining is not asking for anyone's skills.

Asks: `` GitHub CLI is installed but logged out. Run `gh auth login` now? ``; `Continue after accepting the invitation?` when it had to send you to the browser; the identity questions, with the handle fixed if this machine already has one for the team; `Team handle` again, asked at most three times in total, on a handle collision.

Writes: `~/.terum/skills/teams/<team>/` (clone plus pre-push guard), `~/.terum/skills/config.json`, `people/<handle>.json` and, on a rejoin, `team.json` in the team repository, and `~/.claude/settings.json` if you accept the hook offer, whose entry names this copy of the CLI the way [setup](#setup) describes.

Fails when: the machine is on a different team; the local team name is already used for another remote; the clone directory exists but is incomplete or is a clone of something else (move it aside and retry); GitHub's invitations cannot be listed or accepted (`Could not list GitHub invitations: …`, `Could not accept the invitation: …`); you decline `Continue after accepting the invitation?` (`Invitation acceptance was declined.`); `git config` inside the clone fails; the handle collides three times.

### team leave

```
Usage: terum-skills team leave [options] <name>
```

Arguments: `<name>`, required. The local team name.

This command has no options beyond `-h, --help`.

What it does: removes the team from this machine and nothing else. It inventories first (placed skills, the clone, pending operations, and the consent records when this is the last team), asks once, then removes every placed skill folder, removes the clone, removes `cache/<team>` and this team's run artifacts, deletes the `config.json` entry, clears `approvals` when it was the last team, and removes the session hook when it was the last team. A placed folder whose bytes no longer match the ledger fingerprint is moved to quarantine, never deleted. A clone holding uncommitted or unpushed work is moved to `~/.terum/skills/quarantine/<stamp>/teams-<team>` instead of removed. The team repository is not touched: your membership stands.

Asks: `Leave <name>? This removes N placed skill(s), the local clone and your skill consent records; your membership in <remote> is unchanged.` (the middle clause is `and the local clone` when other teams remain). Leave prints `<remote>` as the stored remote with any credentials stripped, so `github.com/acme/skills`, where `status` and `team move` print the same repository as `https://github.com/acme/skills`.

Writes: removes local paths as above, and edits two settings files: `~/.claude/settings.json` to take the session hook out when this was the last team, and the settings file governing each removed placement to clear its `skillOverrides` off-switch, backing each up under `~/.terum/skills/backups/` first. No team repository write.

Fails when: the team is not configured; you decline the confirmation (`Leave was cancelled.`); another terum-skills sync holds the session lock on that team, or the clone's own writer lock cannot be taken.

### team move

```
Usage: terum-skills team move [options] <target>
```

Arguments: `<target>`, required. `<org>/<repo>` or a git remote URL.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--from` (hidden) | `<team>` | the configured team | The configured team to move away from. Required when more than one exists. |
| `--yes` | none | off | Skip the confirmation, for a script or a shell that already asked. |

What it does: follows a team whose repository moved. In one run it tears the old team down locally, restores the consent records the teardown cleared, joins the new repository carrying the identity this machine already proved, and then places again every skill the old team had placed here that the new team also shares, at the same scope. It reports `Moved to <to> as <handle>: N skill(s) placed again, M not shared there (…), K failed.` A skill the new team does not share is reported, not invented: it is gone from this machine and does not come back.

The teardown is the same code `team leave` runs, with two deliberate differences. Move never removes the session hook, because the next step binds a team again inside the same run, and it never re-offers the hook on the join half. It also asks for no second confirmation once you have answered the one below.

Asks: `Move this machine from <from> (<url>) to <url>?` with the detail lines about re-placement and the replaced clone, unless `--yes`. From `team join`: the `gh auth login` offer always, a handle collision always, and the identity questions only where this machine never recorded a full identity.

Writes: everything the teardown removes and everything `team join` writes apart from the hook, plus one placement per restored skill and your `people/<handle>.json` install rows in the new repository.

Fails when: the target is already this team's remote; the confirmation is declined or the caller is non-interactive without `--yes`; the join fails after the teardown succeeded, which reports `` Left <from>, but joining <url> failed: … Run `npx -y terum-skills@latest team join <target>` to finish the move. `` Both `<url>` values there are rendered as `https://github.com/<owner>/<repo>` for a GitHub remote, not as you typed them.

### team remove

```
Usage: terum-skills team remove [options] <handle>
```

Arguments: `<handle>`, required. The teammate's team handle.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--team` (hidden) | `<team>` | the configured team | Configured team, required when more than one exists. |
| `--archive-only` | none | off | Archive roster membership without attempting host access changes. |

What it does: archives a member in the roster and revokes their GitHub access. It fetches `origin/main` fresh rather than trusting the local clone, requires GitHub repository admin permission, and refuses to remove the last remaining admin. It appends the handle to `team.json.archived` in one safe write, then deletes the collaborator and cancels every pending invitation for that login. Nothing that person published is removed: archiving marks the roster entry inactive.

Asks: `Revoke GitHub access for @<login> and archive <handle>? (y/N)`, or `Archive <handle>? (y/N)` with `--archive-only`.

Writes: `team.json` in the team repository. The access change is on the GitHub host.

Fails when: this machine has no member handle for the team; you name yourself; the remote is not GitHub, unless `--archive-only` was passed, which is the one part of this verb that is not a host operation; the fetch fails (`Could not fetch <remote>: …`); the roster entry is unreadable (`Invalid people/<handle>.json: …`); you do not hold repository admin permission (`Team removal requires GitHub repository admin permission.`), which is checked on a GitHub remote even with `--archive-only`; the handle is not on `origin/main`; the target declares no GitHub login and `--archive-only` was not passed; the target is the last remaining admin; another active roster entry declares the same GitHub login; GitHub's admins, collaborators or invitations cannot be listed; you decline the confirmation (`Team removal was cancelled.`). If archiving succeeded but revocation failed, the message is `<handle> is archived; @<login>'s access could not be revoked: …. Re-run team remove <handle> to retry.`

### team migrate

```
Usage: terum-skills team migrate [options]
```

Arguments: none.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--team` (hidden) | `<team>` | the configured team | Configured team, required when more than one exists. |

What it does: migrates the team repository to layout 3 in one safe write. It moves every `skills/<name>/*` into `skills/<name>/v1/`, re-keys receipts from `evals/<id>/<tree-hash>/<run>.json` to `evals/<id>/v1/<run>.json` (stamping the content digest) or archives them under `evals/<id>/archive/<hash>/`, rewrites `installed[].version` in every people file, drops the legacy `global[]` list and `policy.publish`, and sets `layout_version: 3`. It then re-arms the clone's push guard, which it also does on an already-migrated repository so an interrupted run is repaired by re-running. Run it only after the release removing auto-share has reached your teammates. See [the layout 3 migration](../migration-layout-3.md).

Asks: nothing.

Writes: the team repository, and `.git/hooks/pre-push` plus `core.hooksPath` in the local clone.

Fails when: run with `--frames` (`team migrate is a terminal-only operation; run it without --frames after the auto-share removal release has propagated.`); or any of the migration's own refusals. Most carry the prefix `Migration refused:` (an invalid skill folder name, a name the SKILL.md contradicts, a version path that already exists, duplicate ids, a conflicting `version_tree`, a missing HEAD tree identity, a missing path, an unexpected or misfiled receipt path, a destination that exists, a non-regular file). Some do not: an unreadable `skills/<name>/SKILL.md` fails as `Invalid skills/<name>/SKILL.md: <error>`, and the layout-3 validation of the rewritten `team.json` and people files fails under their own names. It also fails when the repository reached layout 3 but the push guard could not be re-armed.

### team project create

```
Usage: terum-skills team project create [options] [name]
```

Arguments: `[name]`, optional. Prompted when omitted and the caller is interactive.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--remote` | `<url>` | none | The project's repository. Its skills place when a teammate installs inside that folder. |
| `--team` (hidden) | `<team>` | the configured team | Configured team, required when more than one exists. |

What it does: adds a project card to `team.json`. A team project groups shared skills and names the repository they place into. It refreshes the clone first so the name-collision check reads current data, then writes `projects[<name>] = { remotes, skills: [] }` in one safe write, committed directly to `main`. It prints `Created project <name> in <team>.` and then either `Its skills place when a teammate syncs inside <remote>.` or `No repository yet — its skills place nowhere automatically until it has one.`

That first line is stale. `sync` places nothing: it fetches each clone and resets it, and auto-share is gone. What the remote does today is preselect the destination when a teammate runs `install project <name>` inside that checkout. The option's own help text says so correctly ("its skills place when a teammate installs inside that folder"), and only the printed confirmation still says "syncs".

Asks: `Project name?` when no name was given and the caller is interactive.

Writes: `team.json` in the team repository. Locally, the refresh resets the clone to `origin/main` and takes its writer lock, and the safe write commits inside that clone before pushing.

Fails when: the team has no joined handle; the clone cannot be refreshed, because it is locked, stale or its remote is unreachable; no name was given and the caller is non-interactive (`Specify a project name.`); the clone is not a team repository (`This repository has no team.json; it is not a terum-skills team repo.`); the name fails the project-name rule; the team already has a project with that name, ignoring case; another project already claims that remote (`<project> already claims <remote>; a repository belongs to one project.`); the write produced nothing (`Nothing was written for project <name>; rerun the command.`).

### team project delete

```
Usage: terum-skills team project delete [options] [name]
```

Arguments: `[name]`, optional. Prompted when omitted and the caller is interactive.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--yes` | none | off | Skip the confirmation. |
| `--team` (hidden) | `<team>` | the configured team | Configured team, required when more than one exists. |

What it does: deletes a project card and nothing else. The skills it listed stay in the marketplace: a project is a list, and the bytes live in `skills/<name>/v<N>/`, which this command cannot reach. It refreshes the clone, requires an exact name match, then removes the key in one safe write to `main`. It prints `Deleted project <name> from <team>.` and, when the project listed anything, `Its N skill(s) are still in the marketplace; install them by name.`

Asks: `Delete project <name> from <team>? Its N skills stay in the marketplace; only the project list is removed.` (`Its 1 skill stays` for one), unless `--yes`.

Writes: `team.json` in the team repository, and no skill bytes anywhere. Locally, the refresh resets the clone to `origin/main` and the safe write commits inside it.

Fails when: the team has no joined handle; the clone cannot be refreshed; no name was given and the caller is non-interactive; the clone is not a team repository (`This repository has no team.json; it is not a terum-skills team repo.`); the team has no project with exactly that name; you decline the confirmation (`Project <name> was not deleted.`); the write produced nothing (`Nothing was written for project <name>; rerun the command.`).

### team workflow-update

```
Usage: terum-skills team workflow-update [options]
```

Arguments: none.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--print` | none | off | Print the workflow YAML and migration instruction. |

What it does: prints the current GitHub Actions workflow scaffold byte for byte, followed by `Commit this to .github/workflows/terum-skills.yml in an ordinary PR by someone with push access.` It never writes a repository: an existing team updates its workflow through a normal pull request, reviewed like any other change to the repository.

Asks: nothing.

Writes: nothing.

Fails when: `--print` was not passed. The message is `` `npx -y terum-skills@latest team workflow-update` is print-only; pass --print. ``

## Library

`skill` and `project` are groups. `npx -y terum-skills@latest skill` and `… project` list their subcommands.

### ls

```
Usage: terum-skills ls [options] [command]
```

Arguments: none, or the subcommand `member` or `project`.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--local` | none | off | List your local Claude Code skills and their team status instead of the team inventory. |
| `--team` (hidden) | `<team>` | the configured team | Configured team, required when more than one exists. |

What it does: without `--local`, prints the team inventory from the local clone: `Members:` with `(inactive)` beside archived handles, then one line per shared skill in the form `name — author; category; N installs; Version K; endorsement; date`, then a pointer to `ls --local`. It never fetches, so what you see is the clone as of the last sync. With `--local` it scans Global (`~/.claude/skills`) and every registered library project, and joins each folder against every configured clone by content digest, never by name, so each row can say which team version it matches, whether it is an installed placement, whether it has drifted from what was placed, whether Claude Code has it switched off, and what its evals say.

Asks: nothing.

Writes: nothing.

Fails when: `--local` is combined with `member` or `project` (`--local cannot be combined with member or project.`); `--local` is combined with `--team` (`--local lists every configured team; drop --team.`); the selected team's `team.json` or people directory cannot be read.

### ls member

```
Usage: terum-skills ls member [options] <handle>
```

Arguments: `<handle>`, required.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--team` (hidden) | `<team>` | the parent `ls` value, then the configured team | Configured team, required when more than one exists. |

This subcommand has no description of its own, so `ls --help` lists it with an empty description.

What it does: prints one member's authored and installed skills, as `Member <handle>:`, `  Authored: …`, `  Installed: …`. Authorship is matched on the normalized `metadata.author` byline, which publish writes from the machine identity, so it follows the name and email you had when you published.

Asks: nothing.

Writes: nothing.

Fails when: no handle is given (`Specify a member handle.`); the handle is not a valid handle; no member has it (`No member named <handle>.`).

### ls project

```
Usage: terum-skills ls project [options] <name>
```

Arguments: `<name>`, required. A team project name.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--team` (hidden) | `<team>` | the parent `ls` value, then the configured team | Configured team, required when more than one exists. |

This subcommand also has no description of its own.

What it does: prints `Project <name>:` and one line per skill the project lists, in the same format `ls` uses.

Asks: nothing.

Writes: nothing.

Fails when: the team has no project with that name (`No project named <name>.`).

### search

```
Usage: terum-skills search [options] <term>
```

Arguments: `<term>`, required. Matched case-insensitively against a skill's name, description and category. An empty term matches everything.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--category` | `<category>` | none | Keep only skills whose category contains this, ignoring case. |
| `--author` | `<author>` | none | Keep only skills whose author byline contains this, ignoring case. |
| `--project` | `<project>` | none | Keep only skills the named team project lists. |

None of the three has a help description. There is no `--team`: search runs over every configured team and prefixes `<team>:` when there is more than one.

What it does: searches the local clones. It is read-only and offline, prints hits through the same line format `ls` uses, and adds a staleness line per team when that clone has not been fetched within the hour. An empty result prints `No skills found.`

Asks: nothing.

Writes: nothing.

Fails when: every configured team failed. A team that is not cloned yet prints ``<team> is not cloned yet; run `npx -y terum-skills@latest sync`.``, any other team-level problem prints `<team> could not be searched: <reason>`, and a team whose hits all have unreadable history counts as failed with `<team>: no skill history could be read; see the per-skill reasons above.` Each of those only fails the run when no other team succeeded.

### project add

```
Usage: terum-skills project add [options] [path]
```

Arguments: `[path]`, optional. Prompted when omitted.

This command has no options beyond `-h, --help`.

What it does: registers a folder as a library project, so its `.claude/skills` directory becomes one of the roots terum-skills reads and installs into. Registration is explicit: the current working directory is never a project, and nothing is inferred from the placement ledger. After a folder is actually added, and only when a team is configured, it runs `reconcile` scoped to that root so a folder you already have can be recorded as installed or published. Over frames or a pipe that reconcile runs in list mode and offers nothing. A reconcile that fails does not fail the add: it prints `Could not check that project against the team: <reason>` and the project stays registered.

Asks: `Which folder?`, defaulting to the nearest git repository root above the current directory, otherwise the current directory. A typed `~` is expanded in-process.

Writes: `config.projects[]` in `~/.terum/skills/config.json`. Adding a project relabels the whole set, so adding `/b/web` renames an existing `/a/web` row. A folder inside a registered project is added as its sub-project and labelled by its path inside the parent (`Added <path> to your library as a sub-project of <label>.`); a folder above registered projects adopts them as its sub-projects and says so. The tree is read off the paths and never stored. A name chosen with `project rename` is kept; only derived labels move.

Fails when: the path does not exist (`<path> does not exist.`); it is not a folder; it is inside `~/.terum/skills`; it is the Global home root (`<path> is the Global home root and cannot be added as a project.`). An already-registered path is not a failure: it prints `<path> is already in your library.` and exits 0.

### project remove

```
Usage: terum-skills project remove [options] <path>
```

Arguments: `<path>`, required.

This command has no options beyond `-h, --help`.

What it does: forgets a project. Files are left exactly where they are and the placement ledger is untouched, so skills placed under that root stay on disk and stay recorded. It prints `Removed <path> from your library.` followed by `N placements recorded under <path> stay in the ledger; uninstall-skill removes them.` When registered folders sit inside the removed one it adds `N sub-projects under <path> stay in your library.`: they stay registered, drawn one level up.

Asks: nothing.

Writes: `config.projects[]` in `~/.terum/skills/config.json`.

Fails when: the path is not registered (`<path> is not in your library.`).

### project list

```
Usage: terum-skills project list [options]
```

Arguments: none. No options beyond `-h, --help`.

What it does: prints one line per registered project, `<label> — <path>; <root state>; N skill folders`, in tree order with a sub-project indented two spaces under the project whose folder holds it, or `none` when there are none.

Asks: nothing.

Writes: nothing.

Fails when: the config cannot be read.

### project rename

```
Usage: terum-skills project rename [options] <path>
```

Arguments: `<path>`, required.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--to` | `<name>` | required | The new name: 1 to 64 characters, not `Global`. |

What it does: names a Library row. It is display text and nothing else: the folder keeps its name, every path in the ledger stays as it is, and no team file changes. The name is kept until you rename again; when a later add would derive the same name, the derived label is the one qualified. It prints `Renamed <old> to <new>; the folder <path> is unchanged.`

Asks: nothing.

Writes: `config.projects[]` in `~/.terum/skills/config.json` (`label` and `renamed_at`).

Fails when: the path is not registered (`<path> is not in your library.`); the name is empty, longer than 64 characters, or `Global` (`a project name is 1-64 characters and is not Global`); another project already carries that chosen name (`Another project is already named <name> (<path>).`).

### reconcile

```
Usage: terum-skills reconcile [options]
```

Arguments: none.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--list` | none | off | List matches without asking or writing. |
| `--team` (hidden) | `<team>` | every configured team | Configured team, required when more than one exists. |

What it does: compares the folders in your Library that terum-skills does not already track against every published version in the selected teams, by content digest. It prints `Checking your library against the team…`, then classifies each candidate as identical (same bytes, same name), renamed (same bytes, different folder name) or differing (same name, different bytes). Renamed rows are reported as `<path> holds the bytes of <name> Version K under a different folder name; nothing is offered for it.` and nothing is offered for them. It then prints the count line `N of your skills match the team's exactly; M share a name with a team skill but differ.`, or `Nothing to reconcile: none of your skills match a team skill by bytes or by name.` Interactively it walks the identical rows offering to record them as installed, and the differing rows offering to publish yours as the next version, and ends `Recorded N installs. Published M skills.` Rows are independent: a failure on one is printed and the next is still offered.

Asks: `Record <name> as installed (Version K)?` per identical row. Per differing row, `Publish your version of <name> as Version K of the team's <name>? Your folder carries the team's id for <name>.` when the ids match, and otherwise a longer sentence naming the team's author and ending with the `skill rename` command that would keep the two apart.

Writes: with `--list`, nothing. Otherwise one placement ledger row and one `installed[]` row per adoption, and a full publish per accepted differing row.

Fails when: no team is configured; an unknown `--team` is given; a scoped root is not registered (`<path> is not one of your registered projects.`). Per-row failures do not fail the run.

### skill move

```
Usage: terum-skills skill move [options] <path>
```

Arguments: `<path>`, required. A folder directly under a registered Library skills root.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--to` | `<destination>` | required | `global`, or a registered project root. |

What it does: moves a Library folder to another root. The original is gone. The placement ledger row follows the folder, and a Claude Code `skillOverrides` off-switch on the old path is carried to the destination root's settings file. A folder already at the destination is kept at `<root-parent>/old-skills/<name>` and `.claude/old-skills/` is added to that checkout's `.git/info/exclude`. The whole operation is journalled under `~/.terum/skills/run/skill-files/`, so an interrupted run resumes where it stopped.

Asks: nothing. The typed-name confirmation was removed for move, copy and rename because each is reversible by a second run and nothing is ever overwritten.

Writes: the destination folder, the source folder's removal, `config.placements`, the destination checkout's `.claude/settings.local.json` when an off-switch travels, `.git/info/exclude`, and the journal file.

Fails when: the folder is not directly under a Library skills root (`Refusing <path>: it must sit directly under a Library skills root.`); its parent is not a registered root (`Refusing <path>: its parent is not a registered Library root.`); the path is not a plain folder (`Refusing <path>: not a plain folder (symlinks are not allowed).`) or contains one (`Refusing <path>: contains a symlink.`); `--to` is not `global` or a registered project root (`Choose global or a registered project root; add the project with project add first.`); source and destination are the same folder (`The source and destination are the same folder.`); the keep path already exists (`<path> already exists; move the kept copy elsewhere before retrying.`); the source is gone and no sibling carries its recorded `metadata.id` (`<path> no longer exists and no sibling has its recorded metadata.id.`, or `Several sibling folders carry <id>; cannot safely repair <path>.` when more than one does).

### skill copy

```
Usage: terum-skills skill copy [options] <path>
```

Arguments: `<path>`, required.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--to` | `<destination>` | required | `global`, or a registered project root. |

What it does: copies a Library folder into another root and leaves the original where it is. The copy is staged and renamed into place, so a partial folder is never visible. The copy gets no ledger row and no `.git/info/exclude` entry: it is a plain folder you now own in a second root, the same shape a hand-written skill has. Because it carries the source's `metadata.id`, `ls` still joins the two to one skill.

Asks: nothing.

Writes: the destination folder and the journal file. No ledger row for the copy.

Fails when: the same conditions as `skill move`.

### skill rename

```
Usage: terum-skills skill rename [options] <path>
```

Arguments: `<path>`, required.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--to` | `<destination>` | required | The new skill name. |

What it does: renames the folder inside its own root and rewrites `name:` in its SKILL.md to match, because the folder name is the invocation name. The ledger row and any off-switch follow the new name.

Asks: nothing.

Writes: the renamed folder, its SKILL.md, `config.placements`, the settings file when an off-switch travels, and the journal file.

Fails when: the new name is not 1 to 64 lowercase alphanumerics or single hyphens (`The new name must be 1–64 lowercase alphanumerics or single hyphens.`); the destination already exists (`<dest> already exists; choose another name.`); the rails above.

### skill delete

```
Usage: terum-skills skill delete [options] <path>
```

Arguments: `<path>`, required.

This command has no options beyond `-h, --help`.

What it does: the only `skill` subcommand that asks. If the folder is a recorded team placement it delegates to the uninstall path, which also drops your install record in the team repository, and prints `This skill was installed from the team — deleting it also removes it from your installs.` Otherwise it moves the folder to `~/.terum/skills/quarantine/<stamp>/<name>` and prints `Moved <src> to <dst>. Undo by moving it back before prune.` Either way it clears the folder's `skillOverrides` off-switch, so a folder written again under that name is not born disabled.

Asks: `Type <name> to delete this folder`. A mismatch cancels with `The name did not match; nothing changed.`

Writes: quarantine or removal of the folder, `config.placements`, the Claude Code settings file, the journal file, and for a placement, `people/<handle>.json` in the team repository.

Fails when: the rails above; the destination quarantine path cannot be written.

### skill fix

```
Usage: terum-skills skill fix [options] <path>
```

Arguments: `<path>`, required.

This command has no options beyond `-h, --help`.

What it does: applies only the repairs that have one right answer, then tells you what still needs you. It quotes a frontmatter scalar that YAML refuses, sets `name:` to the folder name, sets `license:` to the team's policy license, strips the invisible characters HYG2 flags from every text file, and clears the executable bit on a file with no shebang. Then it re-runs the same inspection and hygiene gate that `validate` uses and prints `Still needs you (N):` with the remainder, or `<name>: hygiene passes.` / `<name>: nothing to fix; hygiene passes.` With no readable team there is no policy license to conform to, so `license` is left alone.

Asks: nothing. Every change it makes is fixed by an authority outside the author's typing.

Writes: files inside the folder only. No team repository write, no network call.

Fails when: the folder has no SKILL.md (`<path> has no SKILL.md; nothing to fix.`); it repaired nothing and findings remain. That last case exits 1 with `<name>: nothing here is a fault fix covers; N findings still need you (listed above).`

### skill category

```
Usage: terum-skills skill category [options] <path>
```

Arguments: `<path>`, required.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--to` | `<name>` | required | The new category. Your team's list is advice, not an enum, so any name is accepted. |

What it does: rewrites `metadata.terum-category` in the local SKILL.md and stops. There is no publish, no network call and no team write. A value the team already spells differently takes the team's spelling, so `--to Ops` lands in the one `ops` bucket. An off-list value is written and given the same warning HYG7 prints. Because a published category lives inside an immutable version folder, the command then says what the team still shows and prints the `publish` that would mint the next version.

Asks: nothing.

Writes: the folder's SKILL.md.

Fails when: `--to` is empty (`--to must be a non-empty category name.`); the folder has no SKILL.md (`<path> has no SKILL.md; there is no category to change.`); the frontmatter is not readable YAML (``<path>: SKILL.md frontmatter is not readable YAML; run `skill fix <path>` first.``); the folder already declares that category (`<name> already declares <category>; nothing to change.`).

### skill enable

```
Usage: terum-skills skill enable [options] <path>
```

Arguments: `<path>`, required.

This command has no options beyond `-h, --help`.

What it does: removes this tool's `off` entry from Claude Code's own `skillOverrides` setting, which is the same key the `/skills` menu writes. Nothing moves and no ledger row changes. A folder under Global is governed by `~/.claude/settings.json`; a folder in a project checkout is written to that checkout's `.claude/settings.local.json`. Only `off` belongs to terum-skills: a `name-only` or `user-invocable-only` value set by hand reads as enabled and is never removed. It prints `Enabled <name>: Claude Code loads it again on this machine (skillOverrides in <file>).` or `<name> is already enabled; nothing changed.`

Asks: nothing.

Writes: `~/.claude/settings.json` or `<checkout>/.claude/settings.local.json`.

Fails when: the path is not a folder directly under a `.claude/skills` directory (`Refusing to change <path>: it is not a folder directly under a .claude/skills directory.`); there is nothing at the path (`Nothing at <path>.`); the settings file is not valid JSON, or its `skillOverrides` is not an object.

### skill disable

```
Usage: terum-skills skill disable [options] <path>
```

Arguments: `<path>`, required.

This command has no options beyond `-h, --help`.

What it does: writes `off` for that skill name into the same `skillOverrides` key. The files stay where they are; Claude Code stops loading the skill on this machine. When it creates a checkout's `.claude/settings.local.json`, it adds that path to `.git/info/exclude`, and says so if the exclude could not be written. It prints `Disabled <name>: Claude Code no longer loads it on this machine (skillOverrides in <file>).` or `<name> is already disabled; nothing changed.`

Asks: nothing.

Writes: `~/.claude/settings.json` or `<checkout>/.claude/settings.local.json`, plus `.git/info/exclude` on first creation.

Fails when: the same conditions as `skill enable`.

### prune

```
Usage: terum-skills prune [options]
```

Arguments: none. No options beyond `-h, --help`.

What it does: prints the full path of every item directly under `~/.terum/skills/quarantine`, asks once, then deletes them all and prints `Deleted N quarantined item(s).` This is the only command that permanently removes quarantined output. Everything else that "removes" a drifted skill or a clone with unpushed work moves it here instead.

Asks: `Delete N quarantined item(s)?` Declining prints `Prune cancelled; nothing deleted.` and still exits 0.

Writes: deletes quarantine entries.

Fails when: an entry cannot be removed. An empty or missing quarantine prints `Quarantine is empty.` and exits 0.

## Sharing

### publish

```
Usage: terum-skills publish [options] <ref>
```

Arguments: `<ref>`, required. A local Library skill name or a folder path. Never something inside the team clone: you publish what is on your machine.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--category` | `<name>` | asked of the model | The skill's `terum-category`. Skips the model suggestion. |
| `--project` | `<project>` | none | Also list the skill under this team project. Without it the skill goes to the marketplace alone. |
| `--team` (hidden) | `<team>` | the configured team | Configured team, required when more than one exists and the ref is bare. |

What it does: copies one local folder into the team repository as its next immutable version, and commits directly to `main`. Its own help text is stale: it reads `Publish a skill to the team's marketplace: opens a pull request under policy "pr", commits directly under policy "push"`. There is no `policy.publish` field any more, and the push path is main-only, so no pull request is ever opened. Publish fetches the clone, reads your folder, and unless the folder already declares a category or `--category` was given, asks a model for one through `claude`. It injects the managed fields (`license`, `metadata.id`, `metadata.author`, `metadata.terum-category`) into the SKILL.md, runs hygiene on the injected result, digests it, writes the injected SKILL.md back into your own folder, and then mints `skills/<name>/v<max+1>/` (or reuses an identical existing version). In the same write it refreshes `skills/<name>/evals/`, attaches every local receipt for those exact bytes as `evals/<id>/v<N>/<runId>.json`, and appends the skill to the named project. A second, independent write then adds the skill to your profile with no question, because publishing is itself the endorsement; if that write fails the publish still succeeded.

Asks: `Your latest eval of these exact bytes failed against the previous version. Publish anyway?`, only when the newest local receipt for these bytes is a FAIL. The default is no, and declining cancels with `Publish was cancelled.` The code has a second branch that would name a version instead, but it cannot be reached: the gate reads local receipts only, and `eval` writes every local receipt with a null version, which publish fills in later.

Writes: your own folder's SKILL.md (with the managed fields), and in the team repository the new version folder, the mutable eval assets, the attached receipts, the project list when `--project` was given, and your `people/<handle>.json` profile entry.

Fails when: no team is configured or the team has no joined handle; `--category` is empty; the ref names no folder in your Library (`` No local skill folder named <name> in your library. Inspect it with `ls --local`, or add the project holding it with `project add`. ``); the folder was rejected by the scan or has no SKILL.md; hygiene finds errors; `--project` names a project the team does not have; the name's existing lineage declares a different id (`<name> is no longer in the repository as <id8>; run sync and retry.`); the clone is not a team repository (`This repository has no team.json; it is not a terum-skills team repo.`); the write lock or the push fails.

### unpublish

```
Usage: terum-skills unpublish [options] <skill>
```

Arguments: `<skill>`, required. The marketplace name, never a local path.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--yes` | none | off | Skip the typed-name confirmation. |
| `--team` (hidden) | `<team>` | the configured team | Configured team, required when more than one exists. |

What it does: retracts a skill from the team's marketplace. Anyone in the team may unpublish any skill; there is no ownership check. In one write it removes every version folder and the mutable eval assets under `skills/<name>/`, every receipt under `evals/<id>/`, the uuid from every project list, and the entry from every member's profile. `installed[]` rows are deliberately left alone. The git history is not rewritten, so the bytes remain in the repository's past. Installed copies keep working until each machine syncs, which then reports the skill as removed from the team.

Republishing the same folder later starts again at Version 1. The help text adds "under a new id", and that part is stale: publish reuses the id the folder already declares whenever no published skill claims it, which after an unpublish is always. A fresh uuid is minted only for a folder that declares none, or whose declared id another published name now owns.

Asks: after printing `This removes ALL N versions of <name> from the <team> marketplace, for everyone.` and `Installed copies keep working until each machine syncs, and the git history is not rewritten.`, it asks `Type the skill name to confirm:`. A mismatch cancels.

Writes: the team repository only.

Fails when: the team has no joined handle; the name is empty; the team has no published skill by that name (``<team> has no published skill named <name>. List what is published with `ls`.``); the newest version's SKILL.md has no `metadata.id`; the caller is non-interactive and `--yes` was not passed (`Refusing to unpublish <name> without confirmation; pass --yes.`); the clone is not a team repository (`This repository has no team.json; it is not a terum-skills team repo.`); the skill vanished between the read and the write (`<name> is no longer in the <team> repository; nothing to unpublish.`); the write produced nothing (`Nothing was written for <name>; rerun the command.`).

### install

```
Usage: terum-skills install [options] [ref] [value]
```

Arguments: both optional, and four shapes share them.

| Form | Meaning |
| --- | --- |
| `install <ref>` | One skill. `<skill>`, `<team>/<skill>` or `<owner>/<repo>/<skill>`. |
| `install member <handle>` | Every skill on that member's curated profile, not their `installed[]` list. |
| `install project <name>` | Every skill the named team project lists, recorded at project scope. The destination is still chosen by the question below, so answering Global places the folders in Global while the ledger rows still say project. |
| `install --adopt <path>` | Record a folder you already have as installed, without copying a byte. |

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--yes-profile` (hidden) | none | off | Accepted and ignored: the installed skill is always added to your profile. Kept so older desktop builds that pass it keep working. |
| `--into` | `<global\|root>` | asked | Where to place it. `global`, or a registered project root. |
| `--adopt` | `<path>` | none | Record this existing Library folder as installed without copying it. |
| `--team` (hidden) | `<team>` | the configured team | Configured team. |

`--into` has no help description.

What it does: installs the latest version of a skill into Global (`~/.claude/skills/<name>`) or into a registered project (`<checkout>/.claude/skills/<name>`). The folder is staged and renamed into place, so a partial folder is never visible. It then records a placement row with the fingerprint actually on disk, seeds any committed receipts for that version into the machine's local eval store, and writes one row into your `people/<handle>.json` `installed[]` list along with a refreshed `local_skills` count. For a project destination it adds `.claude/skills/<name>` to that checkout's `.git/info/exclude`. `--adopt` skips the copy entirely: the folder must match a published version byte for byte and must be named after that skill. A three-part ref on a machine that has joined nothing runs `setup <org>/<repo>` in quiet mode first, then installs.

Asks:

- `Install to` with `Global (~/.claude/skills)` and each registered project. Only `install project <name>` has a team project's remote in hand, so only there is a checkout preselected by matching its `origin`, and only when exactly one matches. Everywhere else the preselection is Global.
- `Approve these tools for <name>?` with the skill's `allowed-tools` list as detail, remembered by grants hash so it is not asked again for the same content
- `Install <name> despite malformed allowed-tools?` when the list cannot be parsed
- `Replace it with Version K?` when a folder of that name is already at the destination, with the detail lines `You already have a skill named <name>.` and `Your copy is kept at <root-parent>/old-skills/<name>.`

The installed skill is added to your profile without a question. When that write fails after the skill is on disk, the install still succeeds and prints `Installed <name>, but could not add it to your profile: <reason>`.

`--adopt` takes a different path through the verb and reaches only the two consent questions. It never asks where to install, because it installs nowhere, and never touches your profile.

Writes: the destination folder; `config.pending` before and after; `config.placements`; `config.approvals`, which is what keeps the tool question from repeating; receipts under `~/.terum/skills/evals/local/<digest>/<runId>/receipt.json`; `.git/info/exclude` in a project checkout; and `people/<handle>.json` in the team repository.

Fails when: `--adopt` is combined with a skill selector (`Give a skill to install or --adopt <path>, not both.`) or with `--into` (`--adopt records a folder where it is; it takes no destination.`); nothing is given at all (`Nothing to install: give a skill, or --adopt <path> for a folder you already have.`); the ref pins a version (`Installing a previous version is not supported yet; install installs the latest version.`); `--into` names a folder that is not a registered project (`` <path> is not a project in your library. Add it with `project add <path>`, or pass --into global. ``); a non-interactive caller has projects registered but gave no `--into` (`Pass --into global or --into <project root>`); the ref is not a name the team publishes (`No skill <ref> in team <team>.`); the ref has more than three segments (`Invalid skill ref <value>.`); the bare ref is ambiguous across teams; the skill's folder holds no version (`skills/<name> holds no v<N> folder.`); the team has no joined handle (`Team <team> has no joined handle.`); the destination root has gone (`Project folder <root> is missing`); the member's profile is empty; the project is unknown (`Unknown project <project>.`); the kept path for a displaced copy already exists; consent is declined. For `--adopt`: the path is not in your Library; it matches no published version byte for byte; it holds a skill's bytes under a different folder name (`… holds the bytes of <name> Version K under a different folder name; rename it to <name> first.`); or it is already recorded as installed.

### uninstall-skill

```
Usage: terum-skills uninstall-skill [options] <ref> [value]
```

Arguments: `<ref>` required, `[value]` optional. Same three shapes as install: `<ref>`, `member <handle>`, `project <name>`.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--from` | `<global\|root>` | asked when ambiguous | Which copy to remove. |
| `--team` (hidden) | `<team>` | the configured team | Configured team. |

`--from` has no help description.

What it does: removes placed skill folders from this machine and drops the matching rows from your `people/<handle>.json` `installed[]` list in one team write. A row is dropped only when the last copy at that scope goes. Your curated profile is never touched. A folder whose bytes no longer match the recorded fingerprint is moved to `~/.terum/skills/quarantine`, never deleted, and the command says where it went. It also clears the folder's `skillOverrides` off-switch, so a reinstall is not born disabled. `uninstall-skill member <handle>` takes that person's current profile list intersected with this machine's ledger; `uninstall-skill project <name>` takes only project-scoped copies, so a Global copy you installed separately stays.

Asks: `Remove which copy?` listing the paths, when several copies match at one scope and no `--from` was given. Then one confirmation with the full preview as detail: `Remove <name>?`, or `Remove <handle>'s N skills from this machine?` (`Remove the N skills on your profile from this machine?` when it is you), or `Remove <project>'s N skills from this machine?` The detail opens with `Folders removed (N):` and lists every folder with its scope, then `Local changes are moved to ~/.terum/skills/quarantine, never deleted.`, then `Install records dropped from your people file (N): <names>` (or `(0)`, with `: another copy stays, so your records are kept` appended when a copy survives), and ends `Your profile is unchanged.` The member form adds `Targets are <handle>'s current profile list, not what you installed from them.` and the project form adds `Copies installed to Global stay.` Declining returns `Remove was declined.`

Writes: removes or quarantines each placement folder; `config.placements` and `config.pending`; the Claude Code settings file; and `people/<handle>.json` in the team repository.

Fails when: no ref is given (``Provide a skill ref, `member <handle>`, or `project <name>`.``); `member` or `project` is given with no value (``Provide a member handle: `npx -y terum-skills@latest uninstall-skill member <handle>`.`` and the matching project line); the team has no joined handle; the skill is not in the team (`No skill <ref> in team <team>.`); the project is unknown (`Unknown project <project>.`); `--from` is neither `global` nor an absolute path, or a non-interactive caller faces an ambiguous copy, or several stranded destinations are pending, all of which print `Pass --from global or --from <checkout root>`; the chosen copy does not match (`Invalid uninstall destination.`); the team write fails after the folders are already gone, which reports what already went. A skill the team has but this machine never placed is not a failure: it prints `<id8> is not placed on this machine.` and exits 0.

### sync

```
Usage: terum-skills sync [options]
```

Arguments: none.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--hook` | none | off | Session-start mode. |
| `--team` (hidden) | `<team>` | every configured team | Sync only this configured team. The hidden help text calls it "required when more than one exists", which is stale: with no `--team`, sync runs over every configured team. |

What it does: fetches each team clone and hard-resets it to `origin/main`, under that clone's writer lock, with a 20 second deadline and a git environment that cannot open a credential prompt. It never re-clones and never repairs: a missing, incomplete or foreign clone is reported and skipped. One team failing does not fail the run; only an unreadable config or an unknown `--team` does. On success it writes `~/.terum/skills/run/<team>.stamp`.

The verb's help says "Nothing on this machine is changed", and that is true of your skills in the ordinary case, but two paths do write outside the clone. `--hook` refreshes three artefacts of terum-skills' own: its own `SessionStart` entry, the eight skills it placed for Claude Code and Codex, and the edit-hook script. Each is touched only where it is already present and out of date (never when absent, which for a hook means you declined it, and never when foreign), with one extension: a skills root that already holds Terum's copies also receives any of the eight that are missing. Refreshing the edit hook is both halves of it, so that path also rewrites the `PostToolUse` entry in `~/.claude/settings.json`, after backing the file up.

The `SessionStart` entry is the one-time migration off the `@latest` spelling earlier releases wrote. Hook mode compares the command in your entry against the command this copy would write and rewrites the entry when they differ, so the correction lands in the file the entry already lives in, under the consent you gave when you accepted it. It installs nothing where no entry of ours exists. When it rewrites one, it says so on stderr:

```
Pinned your session hook to this copy of terum-skills (npx -y terum-skills@0.20.1 sync --hook); it no longer fetches the newest release at session start. Re-run `npx -y terum-skills@latest setup` after an update to move it.
```

A settings file this run cannot read or write is a notice too, never a failure, because the fetch has already happened: `Could not pin the session hook in <path>: <reason>`. Each placed skill is compared against the bundled copy rendered in this machine's own spelling, so a copy placed by a different copy of the CLI counts as outdated and is rewritten with `Updated your terum-skills skills for this CLI.`

The second path is the successor move: a terminal `sync` that finds the remote gone offers to follow the team to its replacement, which runs `team move --yes`: that removes every skill the old team had placed here and places again only the ones the new team also shares.

In `--hook` mode, a clone fetched within the last hour is reported fresh and left alone, stdout carries exactly one line (`{"hookSpecificOutput":{"hookEventName":"SessionStart","reloadSkills":true}}`) and every notice goes to stderr so that line stays parseable.

Asks: nothing in hook mode or over frames. In a terminal, when a GitHub remote answers "repository not found", `Move this machine from <team> to the replacement?` listing the candidate repositories and `Not now`.

Writes: each clone's git state, `~/.terum/skills/run/<team>.stamp`, `~/.terum/skills/run/<team>.successors.json` (cached ten minutes, and a terminal run reads past the cache), and in hook mode the three managed Claude Code artefacts when they are out of date, plus `~/.claude/settings.json` and a backup under `~/.terum/skills/backups/` when the `SessionStart` entry is re-pointed or the edit hook is refreshed.

Fails when: the config cannot be read; `--team` names nothing configured; you accept a successor move and the move fails. Under `--frames`, `--hook` is refused before the command runs, with `` `sync --hook` is the session hook and is not available over frames; run plain `sync`. ``

## Evals

### validate

```
Usage: terum-skills validate [options] <path|name>
```

Arguments: `<path|name>`, required. A shared skill by name, or a local source folder by path.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--cwd` | `<team-checkout>` | none | Read the skill and team policy directly from this team checkout. |
| `--team` (hidden) | `<team>` | the configured team | Configured team, required when more than one exists. |

What it does: runs the deterministic hygiene gate. It is offline: no model call and no network call. It checks HYG1 frontmatter, HYG2 hidden characters, HYG3 credentials and foreign emails, HYG4 executables and extensions, HYG5 license agreement, HYG6 description and size, HYG7 off-list category, and HYG8 outside dependencies. It also returns the list of changes `skill fix` would make.

Two of those eight need a note. HYG6 is two checks under one code: an error when `description` is empty or missing, and a warning when the whole of SKILL.md runs over 20,000 characters, which is the file's length and not the description's. HYG7 is only checked at publish, where the team's category list is in hand, so it never fires here. HYG8 warns when the folder references repository paths outside itself, and `validate`'s own help text omits it, listing HYG1 to HYG7 as though that were the whole set. Without `--cwd`, a folder at your current directory wins over the configured clone, because a work-in-progress folder is usually named like the skill it will become; with `--cwd`, the name is tried first inside that checkout. A `skills/<name>/` container descends to the newest version, and a `skills/<name>/v<N>/` path is named by its `<name>` segment.

Asks: nothing.

Writes: nothing.

Fails when: hygiene finds errors, which prints each finding and then `Hygiene failed for <name>: …`; the target resolves to nothing (`skills/<target> holds no v<N> folder.`); the folder tree holds a symlink (`Skill folder contains symlink <path>.`). Without `--cwd` it also needs a configured team, because the team supplies the policy license. A folder that has never been published fails HYG1 on the managed fields publish adds.

### eval

```
Usage: terum-skills eval [options] [skills...]
```

Arguments: `[skills...]`, variadic. Library skill names or folder paths. The argument list, together with the flags, selects one of three modes.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--k` | `<n>` | 1 | Repetitions per execution case. Use `--k 3` or more for a receipt you intend to gate on. |
| `--no-commit` | none | off | Keep the receipt on this machine instead of publishing it to the team. |
| `--triggers-only` | none | off | Run the trigger arm only. No help description. |
| `--execution-only` | none | off | Run the execution cases only. No help description. |
| `--case` | `<stem>` | all cases | Run one authored case by file stem. No help description. |
| `--model` | `<model>` | `sonnet` | The model alias the arms run on. No help description. |
| `--judge-model` | `<model>` | whatever `--model` resolves to | The model alias the judge runs on. No help description. |
| `--no-gen` | none | off | Do not generate missing eval assets. |
| `--heavy` | none | asked | Answer the heavy-mode question with yes. Records the answer and nothing else. |
| `--no-heavy` | none | asked | Answer the heavy-mode question with no. Records the answer and nothing else. |
| `--team` | `<team>` | the configured team | Configured team. No help description, and not hidden. |
| `--parallel` | `<n>` | 4 | Evals to run at a time. |
| `--batch` | `<n>` | all at once | Run this many at a time and ask before each further batch. Declining queues the rest for later. |
| `--pending` | none | off | Every shared skill with no receipt for its current version. This is what setup offers. |
| `--queue-list` | none | off | List queued evals. |
| `--drain` | none | off | Run queued evals. |
| `--window` | `<window>` | none | With skills, queue them for `overnight` or `later` instead of running. With `--drain`, drain that window alone; only `overnight` is accepted there. |
| `--max` | `<n>` | all | Maximum queued items to attempt. |
| `--dequeue` | `<skill>` | none | Remove a skill from the queue. `<skill>` or `<team>/<skill>`. |

The mode is chosen like this. Any of `--queue-list`, `--drain`, `--dequeue` or `--max` selects queue mode, and so does giving no skills and no `--pending`. Exactly one skill with none of `--pending`, `--batch`, `--window` or `--parallel` is a single run. Anything else is batch mode.

What it does, single run: evaluates the bytes of a local Library folder, not the clone. The team is best effort: it supplies the incumbent arm, the hygiene license policy and the receipt's skill id, and a machine with no team runs baseline and candidate alone rather than being turned away. It reports hygiene warnings and staged dependencies, asks the heavy-mode question for a skill that looks like it spawns subagents, runs a paid preflight against `claude`, generates any missing eval assets and writes them back into your own folder, runs the candidate, baseline and incumbent arms in fresh sandboxes, writes the run tree and `receipt.json` under `~/.terum/skills/evals/local/<content digest>/<runId>/`, and prints the report. The digest folder is the bare hex, with the `sha256:` prefix stripped.

Generation is shape-first. One model call decides what the skill needs and returns one of two things. A skill that can be measured against a world holding a hidden truth (a repository with planted defects, a spec with planted contradictions, a log with facts that must and must not be repeated) gets a ground-truth **suite**: a `task`, a `files` map, a `plants_diff`, a map of one-line shell probes that each defect case names, and between 2 and 6 defect cases plus exactly one distractor, checked with `transcript_mentions` and `transcript_omits` only. A skill whose behaviour depends on how it is asked gets **cases**, in the shape it always had. Before a generated suite is written anywhere, the patch is checked with `git apply --check` against the files, the suite is composed with the engine's own setup, loaded, and dry-run in a sandbox; a probe that does not pass on the clean base and fail on the patched tree makes that dry run fail and the generation goes back to the model as a correction. `metadata.eval.shape` in your SKILL.md fixes the choice at `suite` or `cases`, and any other value fails before the model call. The run announces which it got: `eval assets: cases: generated suite · triggers: generated`. The write-back line names the file to delete to regenerate, `evals/suite.yaml` for a suite and `evals/cases/` for cases.

The heavy-mode question is a record, not a switch. Whatever you answer, and whichever of `--heavy` or `--no-heavy` you pass, the value reaches `run.jsonl` and nothing else: the one-session shape comes from an `evals/suite.yaml`, authored or generated on this run, and from nothing else. The team name also goes to `run.jsonl`, not into `receipt.json`. Unless `--no-commit`, when the evaluated bytes already are a published version it attaches the receipt to that version in one narrow team write and prints `Published this receipt to <team> for Version K of <name>.` When they are not, it prints the share hint instead.

What it does, batch mode: resolves every named skill before any paid work, runs one preflight for the whole run, then evaluates them `--parallel` at a time. With `--batch N` it asks before each further batch and queues the remainder for `later` when you decline. With `--window overnight` or `--window later` it queues them instead of running them. It ends `Evaluated N of M; K failed.` on stdout, and when K is not zero the run itself fails with `N of M evals failed.`

What it does, queue mode: `--queue-list` and `--dequeue` print one line per queued item, `<team>/<skill>@<contentHash> · <window> · <requestedAt> · <lastError>`, or `No queued evals.` `--drain` runs the queue under a drain lock, re-checks each item is still queued, re-keys on the content hash so edited bytes are refused, and skips bytes that already have a receipt.

Asks: `Use the one-session heavy evaluation mode?`, default yes, when the skill looks heavy and neither `--heavy` nor `--no-heavy` was given. `Continue with the next N? (X of Y done, Z left)` between batches.

Writes: the run tree under `~/.terum/skills/evals/local/<digest>/<runId>/` (`receipt.json`, `run.jsonl`, `transcripts/`, `sandboxes/`, and `generated/` when assets were generated); generated `evals/cases/`, `evals/suite.yaml` and `evals/triggers.yaml` inside your own skill folder, announced with the line beginning `Writing generated … into <dir>`; `~/.terum/skills/run/eval-queue.json` when queueing; and `evals/<id>/v<N>/<runId>.json` in the team repository when the receipt matches a published version.

Fails when: `--triggers-only` and `--execution-only` are combined; `--k` is not a positive integer; the ref names no Library folder; the folder was rejected by the scan; `--case` names no case (`No eval case named <stem> for <name>.`); hygiene fails; the preflight fails; generated assets fail hygiene; `metadata.eval.shape` holds anything other than `suite` or `cases` (`Could not generate execution cases: SKILL.md metadata.eval.shape must be 'suite' or 'cases'. Retry the command or pass --no-gen.`); the exact spelling a generated asset would take already exists on disk, which is refused rather than overwritten (`<path> already exists, so the generated eval suite was not written — a generated asset never overwrites an authored one. Rename or delete it, then run eval again.`, and the matching lines for `evals/cases/` and `evals/triggers.yaml`). In queue mode: more than one of `--queue-list`, `--drain`, `--dequeue` (`Choose only one of --queue-list, --drain, or --dequeue.`); `--window`, `--max` or `--parallel` without `--drain`; `--window` other than `overnight`; `--max` or `--parallel` not a positive integer; none of the three queue flags, which is the bare `eval` with no skills (`Provide a skill (or several), --pending, --queue-list, --drain, or --dequeue.`); a skill argument (`Queue modes do not accept a skill argument.`); `--batch` or `--pending`; any per-skill selection flag (`Queue modes use the queued team and the full committed skill; per-skill selection flags are unavailable.`); the queued bytes no longer match disk; any item failing, which returns `N queued evals failed; they remain queued.` In batch mode: `--window` with `--batch` or `--parallel`; `--window` other than `overnight` or `later`; `--batch` or `--parallel` not a positive integer; no skills and no `--pending` (`Provide at least one skill, or --pending.`); `--pending` with no team; and any skill failing.

One quirk worth knowing: `--max` on its own selects queue mode, where it then fails with `--window, --max and --parallel require --drain.`

### eval-report

```
Usage: terum-skills eval-report [options] <skill>
```

Arguments: `<skill>`, required. A team skill name or its uuid.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--team` | `<team>` | the configured team | Configured team, required when more than one exists. Visible in help. |

What it does: shows one skill's committed eval receipts and this machine's local runs. It is read-only and never fetches, so it reports the clone as of your last sync. It returns the placed, current and evaluated versions, the newest receipt and whether it is valid, the full history sorted by version then run id, and the local runs merged from the content-keyed store and the legacy per-team tree. When the current version has no receipt of its own, the newest valid one is shown and the report names which version it came from.

Asks: nothing.

Writes: nothing.

Fails when: no skill in the team has that name or id (`No skill named or identified by <ref> exists in team <team>.`). An invalid newest receipt is a printed warning, not a failure.

### usage

```
Usage: terum-skills usage [options] [skill]
```

Arguments: `[skill]`, optional. Narrows the report to one placed skill by name.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--since` | `<iso>` | 30 days ago | ISO-8601 lower bound, validated and canonicalised before the scan; a bare `YYYY-MM-DD` is read as midnight UTC. Older than transcript retention is answered from this machine's archive. |
| `--all` | none | off | Fold fired names with no placement into the main table. |
| `--json` | none | off | Emit the aggregate object, including the per-day `daily` buckets and each row's `placedAt`. |

What it does: reads Claude Code's own session transcripts and reports which placed skills fired on this machine, and whether the model chose one from its description or a person named it. There is no fetch, no model call and no network call. Before reporting, it appends the firings it scanned to `~/.terum/skills/run/usage-events.jsonl`, so a later window can reach past Claude Code's roughly 30-day transcript retention. Rows come from the placement ledger, but the printed table shows only the ones that fired. Placements that never fired are counted into one line, `N skills placed here and never fired in this window.`, and appear individually only under `--json`. A name that fired with no placement here is a one-line hint by default; with `--all`, or when you named one skill, it is folded into the same table and re-sorted with it, marked `(not placed by this machine)`. That fold is display only, so the `--json` object always keeps `rows` and `unrecognised` apart. `--since` is validated and canonicalised first, because every comparison after it is a plain string comparison: an almost-right bound like `2026-9-1` would sort above `2026-09-15` and report an empty window, which reads exactly like nothing having fired. Two caveats print every time and cannot be suppressed:

```
Counts are invocations, not outcome-changing uses; reopenings are not deduped.
30-day window: Claude Code prunes transcripts, so earlier use is visible only where this machine has already archived it.
```

Asks: nothing.

Writes: `~/.terum/skills/run/usage-events.jsonl`, and nothing else.

Fails when: `--since` is not a date this can compare (`--since needs an ISO-8601 date or timestamp, like 2026-09-01 or 2026-09-01T00:00:00Z; received <value>.`); the config cannot be read; or the archive append fails. Reading the archive never fails the run: an unreadable file reads as empty and a malformed line is skipped. An unreadable transcript is a printed `warning: could not read <path> (<reason>); its firings are not counted.` and a smaller corpus, never a failure.

### misses

```
Usage: terum-skills misses [options] [skill]
```

Arguments: `[skill]`, optional. Narrows the printed queue to one skill. It is a view filter and nothing more: the catalogue the judge is shown is never narrowed by it.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--since` | `<iso>` | 7 days ago | ISO-8601 lower bound, validated and canonicalised exactly as `usage` validates it. |
| `--limit` | `<n>` | 20 | Cap the review queue. |
| `--json` | none | off | Emit the candidate queue. |

What it does: answers the one question [`usage`](#usage) cannot. A skill that never fired at all is a single number there, and "nobody needed it" and "it was needed and missed" are the same number. This verb separates them. It harvests the prompts a person actually typed out of the same transcripts, asks a model which placed skills each prompt should have selected, and keeps a `(prompt, skill)` pair only where the prompt's own turn holds no firing of that skill by either detector, so a slash command you typed yourself is never reported as a miss. The catalogue is rebuilt for each batch from that batch's first timestamp, so the judge is never shown a skill that was not placed yet, and a placement the ledger cannot date is left out of every catalogue rather than assumed available.

Unlike `usage`, it spends model calls: prompts go to `claude -p` in batches of ten, on `sonnet`, with tools disallowed and a two-minute deadline per call, one call per batch, and the call count is printed in the first line. It is not one of the verbs `serve` runs and the desktop app has no surface for it, so nothing triggers it by opening a page. The output is candidates for review and never a rate, and two caveats print every time and cannot be suppressed:

```
Counts are candidates for review, not measured misses; the judge sees a trimmed window, not the session.
Skills with no recorded placement date were left out of the catalogue and cannot appear here.
```

Candidates are grouped by skill, largest group first and then alphabetically, newest prompt first inside a group. Each line is the prompt's date, then the prompt itself flattened to one line, cut to 90 characters and printed as a JSON string, then `(no prior context)` where nothing preceded that prompt in its transcript. `--limit` caps pairs globally after that ordering, so it can truncate mid-group, and says so with `Queue truncated at --limit; more candidates were found than shown.` A batch whose model call failed is reported as `N prompts could not be judged (the model call failed); they are counted in neither direction.`

`--json` emits the same object: `since`, `until`, `groups`, `candidates` (pairs kept), `prompts` (distinct prompts among them), `truncated`, `unjudged`, `screened`, `calls`, `undated` (the ledger names with no date, which appear nowhere else), `problems` and `caveats`.

Asks: nothing.

Writes: nothing. It deliberately never appends to `~/.terum/skills/run/usage-events.jsonl`: that archive holds four fields per event and no free text, and prompt text in it would change what it is.

Fails when: `--since` is not a date this can compare (`--since needs an ISO-8601 date or timestamp, like 2026-09-01 or 2026-09-01T00:00:00Z; received <value>.`); `--limit` is not a positive integer (`--limit must be a positive integer.`); the config cannot be read; or the agent command cannot be resolved, which is how a machine with no Claude Code fails (`` `claude` was not found on PATH — is Claude Code installed? ``). A model call that runs and fails is not a failure of the verb: those prompts are counted in neither direction. An unreadable transcript prints `warning: could not read <path> (<reason>); its prompts are not screened.` and shrinks the corpus.

## Machine

### app

```
Usage: terum-skills app [options]
```

Arguments: none. No options beyond `-h, --help`.

What it does: installs and opens the desktop app for this CLI version, and records where this CLI is so the app can drive it. It downloads `terum-skills-desktop_<version>_<suffix>` from the GitHub release `v<version>` of `ryanliu-terum/terum-skills` through `gh release download`, with a ten-minute deadline, and then checks it twice: the published SHA-256 beside it, and the asset's build provenance with `gh attestation verify <file> --repo ryanliu-terum/terum-skills`, under a two-minute deadline. Both are required, because the checksum ships in the same release as the asset and so cannot catch an asset swapped together with its checksum. Bytes the release workflow did not produce in that repository are discarded rather than installed. On macOS it unpacks the archive and places the bundle at `~/Applications/Terum Skills.app`, a fixed path so a Dock pin survives updates; the previous bundle is renamed aside first and restored if the swap fails. On Windows the asset is a per-user NSIS installer run with `/S`, which installs under `%LOCALAPPDATA%\Terum Skills` with no elevation. It then writes `~/.terum/skills/run/app.json` with the Node binary, this CLI's entry point, `PATH` and version, sets `config.app` to opted-in, and opens the app. On macOS it never downgrades: a bundle already at that path at this version or newer is kept.

On Linux, WSL and anything else with no published asset it prints one honest line and exits 0. In WSL that line is `The desktop app runs on the Windows side of this machine, not inside WSL. Install terum-skills there and run this command from a Windows terminal; from here, everything works in the terminal.`

Asks: nothing when run from the CLI.

Writes: the app bundle or installer output, `~/.terum/skills/app/<version>/installed.json`, `~/.terum/skills/run/app.json`, and `config.app` in `config.json`.

Fails when: `gh` is missing or logged out; the release has no matching asset; the machine is offline or behind a proxy that blocks github.com; the download exceeds ten minutes; the checksum does not match (`The downloaded desktop app did not match its published checksum, so it was discarded (expected <a>, got <b>).`); the asset has no valid build attestation (`The downloaded desktop app has no valid build attestation from ryanliu-terum/terum-skills, so it was discarded: <detail>.`), which is also what a release built before desktop assets were attested looks like; `gh` is too old to check one (`This copy of gh cannot verify build attestations (gh 2.49 or newer is needed), so the downloaded desktop app was discarded.`); the archive cannot be unpacked (`Could not unpack the desktop app: …`) or holds no application bundle; the installer exits non-zero; the executable is not where it should be afterwards; the app cannot be opened (`Could not open Terum Skills: …`). Each of those ends with `` Everything works from the terminal. Run `app` later to try again. `` One failure does not: a copy of the CLI with no readable version stops at `This copy of terum-skills has no version; the desktop app is published per version.`

### app-update

```
Usage: terum-skills app-update [options]
```

Arguments: none.

| Flag | Argument | Default | Meaning |
| --- | --- | --- | --- |
| `--check` | none | the default mode | Ask GitHub for the newest release at most once a day, then report what is advertised and what is staged. Downloads nothing. |
| `--stage` | none | off | Download and verify the desktop app for `--release`. Installs nothing. |
| `--apply` | none | off | Hand the install to a background process and return. The caller must then quit. |
| `--release` | `<version>` | this copy's version | Which released version to act on. |
| `--force` | none | off | With `--check`, ask GitHub now instead of honouring the once-a-day cap. |
| `--reason` | `<reason>` | none | Record why the app is installing. One of `on-close`, `overnight`, `manual`. |
| `--await-pid` (hidden) | `<pid>` | none over a terminal, the parent pid over frames | Wait for this process to exit before installing. |
| `--apply-now` (hidden) | none | off | The detached install leg. Never run this by hand. |

What it does: this is the desktop app's own update path, driven by the app rather than typed. `--check` maintains the release state under the daily probe cap and reports the platform, the CLI version, the latest advertised release, the probe outcome, every installed version, the newest staged one, this process's parent pid, and the last apply. `--stage` downloads the asset and puts it through the same two checks as [`app`](#app), its published checksum and its build attestation, without installing it; it unpacks the bundle on macOS, keeps the installer on Windows, and records `app/<version>/staged.json`. `--apply` spawns a detached child running `--apply-now` and returns, so the app can quit. The detached leg waits up to 30 seconds for the awaited process to exit, swaps the macOS bundle and reopens it, or runs the Windows installer with `/S /UPDATE /R`, records each phase in `~/.terum/skills/run/app-update.json`, and prunes old version directories. Pruning keeps four names: the two newest, the version this run applied, and this CLI's own version.

Asks: nothing.

Writes: `~/.terum/skills/app/<version>/` (`staged.json`, then `installed.json`), `~/.terum/skills/run/app-update.json`, `~/.terum/skills/run/latest-version.json`, and the installed app.

Fails when: more than one of `--check`, `--stage`, `--apply` is given (`Choose one of --check, --stage or --apply.`); `--reason` is not one of the three values; the version is not three numbers (`` `<v>` is not a released version; use three numbers, as in 0.1.11. ``); the platform has no desktop app; nothing is staged for `--apply` (`Nothing is staged for <v>; download it first.`); `--await-pid` is not a process id; the download, checksum, attestation or install fails. Because the attestation check is unconditional, `--release <version>` naming a release built before desktop assets were attested stages nothing: the download is discarded with the no-attestation line. A tag that is advertised before its assets are published is reported as `Terum Skills <v> is announced but its files are not published yet.` and is not a failure.

### update

```
Usage: terum-skills update [options]
```

Arguments: none. No options beyond `-h, --help`.

What it does: reports on this copy of the CLI, and prints the command that would update it when there is one to print. It never runs a package manager. It prints `terum-skills <version>`, `This copy: <path>`, `Declared dependency of: <root>` for an out-of-date local dependency, and then the release line: `Release advertisements are not checked on this machine.` on a machine with no GitHub team remote, `Latest advertised release: <version> (observed <at>)` on a good probe, or the three lines `Could not check release advertisements: <e>`, `Last successful observation: …` and `npm availability was not checked.` on a failed one. It adds `pre-release tags are not compared` where the probe saw pre-release tags, and `Latest observed registry release: <v> (npx cache, <at>)` where the npx cache is ahead. Unlike the passive notice, `update` asks GitHub now rather than honouring the daily cap.

The last block depends on the answer. When this copy already matches the advertisement and the probe succeeded, there is no advice at all: the output ends `This copy matches the release advertisement. npm availability was not checked.` Otherwise it prints advice keyed on how this copy was installed, and there are five branches, not four. A global install gets `npm install -g terum-skills@latest` and then `Then run terum-skills setup once if the session hook or /terum-skills skill names a version: it re-points them at this copy.`; a local dependency gets `npm install [--save-dev] terum-skills@latest` in the declaring root and nothing further; an npx copy gets the cache request, the `npx -y terum-skills@latest <command>` form, and the two lines `The session hook and /terum-skills skill keep the version that set them up until you re-run:` and `npx -y terum-skills@latest setup`; a source checkout gets the git workflow plus `npm run build`; and a copy whose provenance cannot be established gets `Installation method could not be established.`, the npx form, and the same two setup lines. The passive stderr notice carries the same advice in the branch it uses for a copy that is neither a local dependency nor a global install: `Run the latest release with npx -y terum-skills@latest <command>; re-run setup with it to move the session hook and /terum-skills skill.`

Asks: nothing.

Writes: `~/.terum/skills/run/latest-version.json`.

Fails when: the release state cannot be read at all. A failed probe is reported in the output, not as a failure: exit 0 means advice was produced.

### uninstall

```
Usage: terum-skills uninstall [options]
```

Arguments: none. Excess arguments are accepted by the parser and then refused, so `uninstall <skill>` fails with ``To remove a skill, use `uninstall-skill <ref>`.``

What it does: removes terum-skills from this machine after one confirmation whose detail is a full inventory. It writes a record of your config to `~/.terum/skills/backups/uninstall.<stamp>.json`, removes the session hook, the managed skills under `~/.claude/skills/` and `~/.codex/skills/`, and the edit hook (its settings entry first, then the script), then tears down every configured team in a loop, deletes `config.json`, removes `run/app.json` and `run/latest-version.json`, deletes the macOS app bundle on darwin only, removes `app/`, and then tries to `rmdir` `run/`, `cache/`, `teams/`, `quarantine/` and the store root. A directory that is not empty is kept and reported, with one exception: a non-empty store root is kept silently. Since `backups/` is written on every run, that is the case you will always hit, so `~/.terum/skills` itself survives without a line saying so. Anything at a skill or edit-hook path that is not ours is named and left alone. The session-hook entry is matched by its command naming `terum-skills`, so an entry pinned to a version goes as readily as the `@latest` one older releases wrote.

What it keeps: `~/.terum/skills/backups/` always; `~/.terum/skills/evals/` always; `~/.terum/skills/hooks/` when it holds an edit hook that is not ours; `~/.terum/skills/quarantine/` when it holds anything; and `~/.terum/skills/run/` whenever anything is left in it, which in practice means `usage-events.jsonl`, `eval-queue.json`, `edit-hints/`, `skill-files/`, `<team>.successors.json` and `app-update.json` all survive. Your membership and installed-skill records in the team repository are unchanged. On Windows, when a download record exists, the desktop app stays installed: `The desktop app under %LOCALAPPDATA%\Terum Skills stays installed; remove it from Windows Settings ▸ Apps. Only its download record under <root>\app was removed.` The npm package itself is never removed; the last lines tell you the command for the way this copy was installed.

Asks: `Remove terum-skills from this machine?` with the inventory as detail.

Writes: removes the paths above and writes one backup record.

Fails when: `~/.claude/settings.json` cannot be read (`…; nothing was removed`); the edit hook cannot be read (`<path> could not be read: <reason>`, with no suffix); the hook, wrapper or edit hook cannot be removed (`…; nothing else was removed`); a team is added while the uninstall is running (`Team <x> was added while uninstalling; re-run uninstall.`); a team teardown fails, which prints `Done:` and `Remaining:` and `` Re-run `uninstall` to continue. ``; `config.json` is kept because something is still configured; a path cannot be removed for any reason other than being absent or not empty (`` Could not remove <path>: <reason>. Everything else was removed; re-run `uninstall` to retry. ``).

### serve

```
Usage: terum-skills serve [options]
```

Arguments: none, and no options of its own. `-h, --help` exists but does not behave: the bin routes every `serve` invocation into the session path before it reads the flag, so `serve --help` prints the help, follows it with a failing `result` frame carrying `"error":"(outputHelp)"` on stdout, and exits 1.

This command is for a program, not a person. Without `--frames` it fails immediately with `serve requires --frames`, on a channel that stamps no id.

What it does: runs one long-lived stdio session that reads `request` frames and answers them, so a shell such as the desktop app pays the process start cost once instead of per read. Requests run strictly serially, because changing the working directory is process-global, and the directory is restored after each one. Every frame belonging to a request is stamped with that request's id; the opening `hello` frame carries none, because it belongs to the session rather than to a request. It serves seven read verbs and refuses everything else with `serve does not run <verb>; spawn it as its own process`:

`status`, `ls`, `eval-report`, `search`, `validate`, `update`, `usage`

`usage` is the one entry that writes, deliberately: it appends to `~/.terum/skills/run/usage-events.jsonl`, which never takes the clone writer lock this list exists to protect, and a machine whose owner only uses the app would otherwise never archive anything.

Asks: nothing of its own. A served verb's questions become `ask` frames on the session channel.

Writes: nothing of its own beyond what `usage` appends.

Fails when: `--frames` was not given, and when `--help` was given, both of which exit 1. A `cancel` frame carrying an id cancels that request; a bare `cancel` ends the session and exits 143. A clean end of input exits 0.

## Hidden commands

Four commands are registered with `hidden: true` and never appear in `--help`. None of them is meant for a person to type. If you meet one in a workflow file or a git hook, this is what it is.

| Command | What it is |
| --- | --- |
| `readme` | The host-side entry point for the GitHub Actions workflow the team scaffold installs. It runs inside a team checkout, not on a configured machine, and regenerates that repository's `README.md` between its `terum-skills:begin` and `terum-skills:end` markers. With `--pr-comment <base-ref>` it prints the publish-preview comment instead, anchored by an HTML comment so the Action can find and update its own comment. It refuses loudly on a repository that has not migrated to layout 3. |
| `guard-push` | The pre-push hook armed inside every team clone. It takes `<remote> <url> [refs...]`: the url selects the configured team, the remote is the label used in the printed `git fetch` remedies, and git's `<local ref> <local sha> <remote ref> <remote sha>` groups follow. Each branch update is diffed against the content it replaces, or against its fork point off main when the branch is new, and held to the pusher's own identity. Its main refusal is that ownership check, which rejects a hand-pushed `team.json`, skill version or eval receipt. It also refuses any deletion, any non-branch ref, a push to a remote this machine has not joined, a ref list that is not a whole number of groups, a new branch whose base cannot be resolved, and a diff it could not run. Every non-zero exit aborts the push. Most refusals name `git push --no-verify` as the bypass, attributed to you, but the ownership refusals do not: they are passed through as written. |
| `receipt-check` | A retired stub kept alive only because the scaffolded workflow still calls it. It prints `receipt-check is retired; publish records receipts when it mints a version.` and exits 0. |
| `share` | Retired. It always fails with `` `share` is retired; run `npx -y terum-skills@latest publish <skill>` to publish a skill explicitly. `` It is deliberately excluded from the verb list the frame protocol advertises. |
