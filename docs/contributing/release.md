# Cutting a release

A release is one explicit workflow dispatch, on `main`, for a named version at a named merged commit. Nothing in the release workflow bumps a version: the bump is a pull request you merge first, and the dispatch only publishes what is already on `main`.

You need write access to the repository and, for the irreversible step, approval on the `npm` environment.

## The version-bump pull request

Branch `release/<version>` off `main`. Title the pull request `release: <version>` and make one commit on the branch titled `chore(release): <version>`.

The bump is five files and seven lines, and nothing else:

| File | Lines | What changes |
| --- | --- | --- |
| `package.json` | 1 | `version` |
| `package-lock.json` | 2 | the root entry only: the top-level `version` and the `""` package's `version` |
| `desktop/package.json` | 1 | `version`, kept in lockstep with the root |
| `desktop/package-lock.json` | 2 | the root entry only, as above |
| `docs/frame-protocol.md` | 1 | the sentence that begins "The current package reports version" |

`desktop/src-tauri/Cargo.toml` is deliberately left alone. Tauri reads the root `package.json` for the version it stamps into the bundles, so bumping the crate would add a third place to keep in step for no gain.

No test pins the `frame-protocol.md` sentence. It is a release artifact in a document that is otherwise a specification, so it is the line most often forgotten. Check it before you open the pull request.

Merge the pull request with a merge commit. Note the merge commit's full 40-hex SHA; you dispatch against that exact commit.

## Dispatching the release workflow

Run `.github/workflows/release.yml` from the Actions tab, on `main`, with:

| Input | Value |
| --- | --- |
| `expected_version` | the version you are releasing, for example `0.20.1` |
| `expected_sha` | the full 40-hex SHA of the merge commit |
| `dry_run` | `false`, unless `.github/workflows/release.yml` changed since the last release; then `true` for the first run, then `false` |
| `dist_tag` | `latest`, unless you are backfilling an older stable version. A prerelease dispatched under `latest` is published under `next` instead |

Dispatch with `dry_run=false` directly unless `.github/workflows/release.yml` changed since the last release. A real run already stops before anything is written when `validate`, `build` or `desktop` fails, because `publish` needs all three, so for a routine version bump a dry run only repeats that work. `git diff --stat v<previous version> origin/main -- .github/workflows/release.yml` prints nothing when the workflow is unchanged. When `release.yml` did change, dispatch with `dry_run=true` first: a dry run runs `validate`, `build`, `desktop` and `audit`, which proves the gates, the tarball and the desktop matrix, and it performs neither the npm write nor the GitHub write. It does not exercise the `npm` environment approval: `publish` is the job that declares that environment, and a dry run skips it (`release.yml:296-298`). Once it passes, re-dispatch with the same `expected_version` and `expected_sha` and `dry_run=false`.

The workflow refuses a dispatch that is not on `refs/heads/main`, an `expected_sha` that is not 40 hex characters, and an `expected_sha` that does not equal the commit the dispatch actually resolved to. That last one is the common failure: `main` moved between the merge and the dispatch, so re-dispatch on the intended commit.

## What each job does

### validate

Checks the dispatch, then plans. It asserts the ref and the SHA, fetches `origin/main` and confirms the SHA is an ancestor of it (which catches a force-push), and then requires reviewed-merge evidence: GitHub must report at least one merged pull request for the commit, or the commit must have two parents. A commit that is neither is refused.

It then runs `node scripts/release-plan.mjs --plan` against live observations of the git tags, the npm registry and the GitHub Releases, and publishes the plan's outputs to the rest of the run: `state`, `reason`, `version`, `tag`, `prerelease`, `dist_tag`, `previous_tag` and `mark_latest`.

### build

Runs only when the plan says `publish`. It installs with `npm ci`, runs `npm run lint`, `npm run typecheck` and `npm test`, then packs once.

Before packing it runs `npm pkg set gitHead=<sha>` and restores `package.json` afterwards. npm records `gitHead` only when publishing from a directory with a real `.git`, and a tarball publish would otherwise leave the registry with no link back to a commit. That stamped `gitHead` is the source evidence the planner and the drift audit require.

The tarball is then inspected. It must contain `package.json`, `README.md`, `SECURITY.md`, `LICENSE`, `NOTICE`, `dist/index.js`, `dist/claude/skills/<name>/SKILL.md` for each of the eight bundled skills and `dist/claude/hooks/terum-skills-edit.mjs`, and no path may contain `__tests__` or start with `src/`. `SECURITY.md` and the shipped skills are what make this check stricter than the equivalent one in `ci.yml`, which requires neither (`ci.yml:84`). The packed tarball is then installed into a fresh throwaway project and run from a foreign directory, and uploaded as the `release-tarball` artifact with the digest that `publish` later compares against.

### desktop

Builds the app on four runners. It is gated on the same `publish` state but runs on dry runs too, which is how the matrix is proven without publishing.

| Runner | Target | Bundle | Asset suffix |
| --- | --- | --- | --- |
| `macos-latest` | `aarch64-apple-darwin` | `app` | `aarch64.app.tar.gz` |
| `macos-latest` | `x86_64-apple-darwin` | `app` | `x64.app.tar.gz` |
| `windows-11-vs2026-arm` | `aarch64-pc-windows-msvc` | `nsis` | `arm64-setup.exe` |
| `windows-latest` | `x86_64-pc-windows-msvc` | `nsis` | `x64-setup.exe` |

Each asset is named `terum-skills-desktop_<version>_<suffix>`, with a `.sha256` sidecar beside it. The matrix does not fail fast, so one broken runner still tells you about the other three.

On macOS the job verifies the ad-hoc signature before tarring the `.app`: it runs `codesign --verify --deep --strict` and then confirms the signature is `adhoc`. An ad-hoc signature that does not verify makes Gatekeeper report the app as damaged instead of merely unverified.

On a run that is not a dry run, each asset then gets a build-provenance attestation from `actions/attest-build-provenance`, recorded by GitHub against this repository under the job's own OIDC identity (`release.yml:282-286`). The step is skipped on a dry run, so no attestation ever exists for bytes that no Release carries. `terum-skills app` and `app-update` check that attestation with `gh attestation verify` after the checksum, so an asset swapped on the Release together with its `.sha256` is refused (`src/commands/app.ts:280-289`).

`tauri-action` is given no `tagName`, so it never touches a Release and never writes updater artifacts. The Release is created later, by `finalize`, from the uploaded artifacts.

### publish

Runs only when the plan says `publish` and `dry_run` is `false`, and it needs `validate`, `build` and `desktop` to have succeeded. The desktop app is therefore always built before the npm publish, so a CLI version can never reach the registry without its app.

This job declares `environment: npm`, and that is the human approval gate. The run pauses there until a reviewer approves it. It is the last point at which the release can be stopped.

It publishes with OIDC trusted publishing: `id-token: write` plus a pinned npm CLI, then `npm publish ./release/<filename> --provenance --access public --tag <dist_tag>`. It then runs `scripts/release-plan.mjs --verify-publication`, a bounded poll that waits until the registry serves this version with the integrity digest `build` recorded, a `gitHead` equal to the released commit, and an attestation.

### finalize

Writes the tag and the Release, and only after re-verifying the publication.

It creates an annotated tag `v<version>` at the released commit, as `github-actions[bot]`, and never with force. If the remote tag already exists it must already point at the same commit, and a failed push re-reads the remote before the job fails. Tags are never moved.

It then downloads the `desktop-*` artifacts and applies the artifact-exists gate: each of the four assets must be present, larger than 1,000,000 bytes, have a `.sha256` sidecar, and pass `shasum -a 256 -c`. A missing or trivial asset fails the release rather than shipping a Release with a hole in it.

Finally it creates the GitHub Release with `gh release create <tag> --verify-tag --title "terum-skills <version>" --generate-notes`, bounded below by the previous stable tag when there is one, marked latest only when the plan says so, and marked prerelease when the version is one. The desktop assets are attached to that same Release. If the Release already exists the step prints `Release <tag> exists; left untouched` and does nothing.

Release notes come from GitHub's own `--generate-notes`. Nothing in the workflow writes a note body.

### audit

Runs regardless of what happened before it, and re-runs `scripts/release-plan.mjs --drift`. An incomplete release fails the run even when every earlier job was green.

## The planner and recovery

`scripts/release-plan.mjs --plan` returns exactly one state. That state is what gates every later job.

| State | Meaning | What the run does |
| --- | --- | --- |
| `refuse` | The dispatch is not releasable. | Errors and exits 1. |
| `observation-error` | The registry or the Releases API could not be read. | Errors and exits 1. An unreadable world is never read as "absent". |
| `noop` | Published, tagged at this commit, and released. | Notices and stops. |
| `tag-only` | On npm from this commit, but the tag is missing. | Skips build and publish; `finalize` creates the tag. |
| `release-only` | Tag and npm agree; the GitHub Release is missing. | Skips build and publish; `finalize` creates the Release. |
| `publish` | Not on npm yet. | The full run: build, desktop, publish, finalize. |

A dispatch is refused when the version is not strict SemVer, when the SHA is not 40 hex characters, when `dist_tag` is not a valid npm dist-tag, when `package.json` at that commit names a different package or a different version, when the tag already exists at another commit, when the version is on npm from another commit, when the version is on npm with no `gitHead` or `sourceCommit` linking it to this one, or when a stable version older than the newest published stable is dispatched under `latest`. That last refusal names its own remedy: re-dispatch with `dist_tag` set to another tag, for example `previous`, to backfill it.

A provenance attestation is not source evidence. It proves that a trusted workflow built the tarball, not which commit it built. Only a registry `gitHead` or `sourceCommit` equal to the dispatched commit counts, which is why `build` stamps `gitHead` into the packed manifest.

Recovery is the same dispatch again. If a run fails partway, re-dispatch with the same `expected_version` and the same `expected_sha`. The planner works out which of publish, tag and Release is still missing and the jobs that are already done skip themselves. There is no separate repair procedure and no manual tagging.

The two recovery states have no desktop artifacts in their own run, so the artifact-exists gate refuses to create a Release from them. That is the intended failure: run a full publish instead of attaching nothing.

## The drift audit

`.github/workflows/release-drift.yml` runs `scripts/release-plan.mjs --drift` daily at 07:00 UTC, on demand, and after every `Release` run completes. It is detection, kept separate from authorization, and it exits 1 on any of:

| State | What it means |
| --- | --- |
| `published-untagged` | A version is on npm with no `v<version>` tag. |
| `tagged-unpublished` | A tag exists for a version that is not on npm. |
| `source-mismatch` | The registry and the tag name different commits. |
| `source-unverified` | A published version carries no `gitHead` or `sourceCommit`. |
| `release-missing` | A tag has no GitHub Release. |
| `channel-mismatch` | The highest stable tag is not what the `latest` dist-tag serves, or the highest prerelease tag is not what `next` serves. |

A malformed `v*` ref is flagged separately as `malformed-ref`. A registry or API failure exits 2 as an observation error, never as "absent". Unreleased development on `main` is pending work: it is reported as information, not a failure.

Drift matters because the shipped CLI reads it. The update check in `src/lib/update.ts` observes `git ls-remote --tags` against the approved upstream repository, keeps the highest `refs/tags/v<x.y.z>` as the advertised release, and caches it in `~/.terum/skills/run/latest-version.json` (`%USERPROFILE%\.terum\skills\run\latest-version.json` on Windows) for a day at a time. A tag without a published version therefore advertises an upgrade that nobody can install, on every machine, until someone notices. Once a day is the shortest useful interval for catching that; a weekly audit would leave the false advertisement up for a week.

## The app's assets and their signing status

Every Release carries four desktop assets and their checksums:

- `terum-skills-desktop_<version>_aarch64.app.tar.gz` for Apple silicon
- `terum-skills-desktop_<version>_x64.app.tar.gz` for Intel Macs
- `terum-skills-desktop_<version>_arm64-setup.exe` for Windows on ARM64
- `terum-skills-desktop_<version>_x64-setup.exe` for Windows on x64

None of them is signed with a purchased certificate. The macOS bundles use Tauri's ad-hoc signing identity `-`, which is why the workflow verifies the signature is present and valid rather than absent: an ad-hoc signature that verifies gets the "unidentified developer" path, while a broken or missing one gets "damaged". The Windows installers are unsigned NSIS installers that install for the current user. Expect SmartScreen and Gatekeeper warnings on first launch, and say so wherever you point people at a download.

What stands in for a certificate is the build-provenance attestation the desktop job records. The CLI discards any asset that carries no valid attestation for this repository, and says so. Releases cut before that step landed carry none, so a CLI built from this tree refuses their assets; `app` only ever downloads the app for its own version, so that reaches a user only through `app-update --release <version>` aimed at an older Release.

## Announcements

`.github/workflows/release-announcement.yml` runs when a `Release` run completes successfully, and announces the release it made in two places, each from the same notes (`scripts/release-notes.mjs`): the pull requests whose merge commits lie between the previous stable tag and this one, with `feat` titles as "New", `fix` and untyped titles as "Fixes and improvements", a `type!:` title or a `BREAKING CHANGE` note as "Breaking changes", and docs, CI, test and other upkeep left out of the announced bullets.

| Job | Script | Where it goes | Secret |
| --- | --- | --- | --- |
| `announce` | `scripts/release-announcement.mjs` | The team Discord channel, through a webhook, pinging @everyone | `DISCORD_WEBHOOK_URL` (channel Settings → Integrations → Webhooks) |
| `website` | `scripts/site-changelog.mjs` | `changelog.json` on `main` of `Terum-Inc/Terum-Website`, which Vercel deploys as [terum.ai/changelog](https://www.terum.ai/changelog) | `SITE_REPO_TOKEN` (a fine-grained token with Contents read and write on that repository only) |

The workflow listens for the `Release` run rather than the `release: published` event because release.yml creates the tag and the Release with `GITHUB_TOKEN`, and events made with that token start no other workflow. A dry run of release.yml tags nothing, so both scripts find no release at the dispatched commit and do nothing. A recovery run finds its release already published before the run started and does nothing either. The website job compares what it built with the file already on the site and commits nothing when they agree, so a rerun never redeploys the site.

The website leads each release with one line. It is the parenthetical in the release pull request's title when there is one, for example `release: 0.16.0 (Windows setup hand-off, team move, skill fix)`, so that is where to write the summary you want people to see; without one, the first feature merged stands for the release, then the first fix, then "Behind-the-scenes improvements".

To announce a release by hand, or to repeat one, run the workflow from the Actions tab with `tag` set to the release (for example `v0.23.0`). `backfill` rebuilds every release in `changelog.json` rather than just that one; use it after changing how titles are classified. Locally, both scripts take `--dry-run` to print what they would send, and `scripts/site-changelog.mjs --all --out changelog.json` writes the whole file for seeding the website repository by hand. Without `SITE_REPO_TOKEN` a local run cannot read the file already on the site, so it builds from GitHub alone.

## After a release

Regenerate the changelog from the release evidence and commit it:

```sh
node scripts/changelog.mjs
```

The generator reads the merged `release/<version>` pull requests and the GitHub Releases through `gh`, so it needs an authenticated `gh` and it runs after the Release exists, not before. Without one it exits 2 and says the script needs the GitHub CLI logged in. `node scripts/changelog.mjs --check` reports drift without writing and exits 1 when `CHANGELOG.md` is out of date. No workflow runs it, so it is yours and the reviewer's to run. Commit `CHANGELOG.md` on its own, as a `docs:` change.
