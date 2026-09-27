# Hygiene checks

Hygiene is the free tier. It is deterministic, runs entirely in memory, calls no model, and touches no network. It reads a skill folder's bytes and returns findings in two tiers: errors, which fail closed and stop whatever was about to happen, and warnings, which print and gate nothing.

There are eight codes, HYG1 to HYG8.

## The eight gates

| Code | What it inspects | Tier | How to fix |
| --- | --- | --- | --- |
| HYG1 | `SKILL.md` frontmatter against a strict schema, then `name` against the folder name, then `allowed-tools`. | Error | Make the frontmatter parse, and match `name:` to the folder. The message names the allowed top-level fields and, for a bad grant, the line. `skill fix` sets `name:` for you. |
| HYG2 | Every decoded text file, for a bidi control or zero-width character, and for a whitespace-delimited token that mixes Unicode scripts. | Error | Delete the invisible character, or rewrite the mixed-script token. `skill fix` strips the invisible set; a mixed-script token is yours to rewrite. |
| HYG3 | Every decoded text file, for a credential-shaped value, and for an email address that is not the author's. | Error | Remove the credential. For a fixture address, use a reserved domain. |
| HYG4 | Every file, for an executable mode bit, a leading `#!`, and an extension outside the allowlist. | Error | Clear the mode bit, drop the shebang, or rename the file to an allowlisted extension. `skill fix` clears the bit on a file that is not a script. |
| HYG5 | The declared `license`, the team's `policy.skill_license`, and any bundled `LICENSE*` file. | Error | Make the licenses that are present agree. `skill fix` rewrites `license:` to the team policy. |
| HYG6 | `SKILL.md` length, and the `description` field. | Warning for size, error for an empty description | Write a description. A long `SKILL.md` is a warning only; trim it if you care about the context it costs. |
| HYG7 | `metadata.terum-category` against the team's category list. | Warning | Add the category to `team.json`, or change the line. It is advice, not an enum. |
| HYG8 | How many repository paths outside the skill folder the `SKILL.md` body references. | Warning | Move the file into the skill folder, so the skill carries what it depends on. |

### HYG1, the frontmatter contract

The strict schema requires `name`, `description`, `license`, and `metadata` with `id`, `author`, and `terum-category`. `allowed-tools` is optional. Nothing else may appear at the top level. Extra keys under `metadata` are allowed.

`eval` and `skill fix` run a lenient variant in which `license` and the three managed `metadata` fields are optional, because a folder that has never been published legitimately carries none of them. Every other clause still applies: no unknown top-level key, the folder name must equal `name`, and the grant must parse.

Eval also accepts the fields Claude Code documents for a skill that run nothing on your machine: `model`, `effort`, `context`, `agent`, `background`, `disallowed-tools`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable` and `when_to_use`. An eval measures a skill as Claude Code runs it. A field like `model: haiku` changes that run, so moving it under `metadata` would change the result. `hooks` is still refused, because Claude Code registers a skill's hooks as commands that run on your machine. Any other unknown key is refused too, and the message names it. Validation, publishing and the fix command keep the stricter list, so a published skill stays portable to any Agent Skills host.

`allowed-tools` must be a YAML list of strings, or one comma-separated string. Absent, empty, or a bare `allowed-tools:` line all normalize to no grant, which is fine. Anything else is malformed and fails, and the zod parse cannot catch it, which is why HYG1 checks it separately.

Errors read like this:

```
HYG1 SKILL.md:2: SKILL.md name reviewer does not equal folder review-helper.
HYG1 SKILL.md:4: my-skill: allowed-tools is malformed (SKILL.md line 4): {"Bash":true}. Use a YAML list of tool patterns, or one comma-separated string.
```

### HYG2, the mixed-script rule

Two things fail. First, any of the bidi controls U+202A to U+202E and U+2066 to U+2069, or the zero-width characters U+200B to U+200D, U+2060, and U+FEFF. A leading byte-order mark counts: the decoder is told to keep it so this check can see it.

Second, any whitespace-delimited token whose letters do not all share one Unicode script. Digits, punctuation, and symbols are Common or Inherited and are always permitted. A letter belonging to no enumerated script counts as one distinct script of its own, so a Latin token spiked with an unlisted alphabet still fails.

The rule is per token, not per file, and that is the point. Honest multilingual prose alternates alphabets between words, so it passes. The Cyrillic-in-Latin homoglyph attack alternates inside one word, so it fails, and a rule that allowed one foreign alphabet per word would let it through. The honest casualty is a hyphenated cross-script token such as `GitHub-репозиторий`, which the author rewrites after a clear error message.

A file is text only if its first 8 KiB contain no NUL byte and the whole file decodes as strict UTF-8. Anything else is binary, and binaries are subject to HYG4 alone.

### HYG3, credentials and addresses

Credential shapes are checked first, and a credential finding wins over an email finding in the same file.

| Pattern | Matches |
| --- | --- |
| `ghp_[A-Za-z0-9]{20,}` | GitHub personal access token |
| `github_pat_[A-Za-z0-9_]{20,}` | Fine-grained GitHub token |
| `sk-ant-[A-Za-z0-9_-]{10,}` | Anthropic API key |
| `AKIA[0-9A-Z]{16}` | AWS access key id |
| `-----BEGIN … PRIVATE KEY----- … -----END … PRIVATE KEY-----` | A PEM private key block |
| `Bearer\s+eyJ…\.…\.…` | A bearer JWT |

The same list is what gets replaced with `[redacted]` in anything that leaves your machine, so the two can never drift apart.

For email, one address is exempt: the one inside the angle brackets of `metadata.author`. An author field with no angle brackets exempts nothing. These domains are always exempt: `example.com`, `example.org`, `example.net`, `test.com`, `localhost`, and anything ending `.invalid`, `.test`, `.example`, `.local`, or `.localhost`. `test.com` and the `.local` family are there because `git config user.email test@test.com` is the idiomatic fixture line.

The finding names the address and the exempt author, because this is a leak check and not an authorship gate:

```
HYG3 fixtures/seed.md:12: Contains the email address sam@acme.io, which is not the skill author's (the skill author is you@example.com). Hygiene refuses addresses that could reach a real person; use a reserved domain such as example.com in test fixtures.
```

### HYG4, executables and extensions

The allowlist, and nothing else, may appear as a file extension:

```
.md .txt .json .yaml .yml .csv .toml .xml .html .css .js .ts .py .sh .sql .svg .png .jpg .jpeg .gif .webp .pdf
```

A file with no extension at all fails. The allowlist is never waivable.

Separately, a file with an executable mode bit, or one whose first two characters are `#!`, fails. `.sh` and `.py` are allowlisted as content, but the executable form is the signal, not the language: a `.sh` file with a shebang still fails. `publish` waives the mode-bit and shebang findings and carries the bytes and the mode to the team. `validate`, `eval`, and `skill fix` never waive them, so the same folder that publishes can still fail `validate`.

### HYG5, license agreement

Three sources can declare a license: the frontmatter `license` field, the team's `policy.skill_license`, and any bundled file whose name matches `LICENSE*`. Each is normalized by trimming, case-folding, and mapping the three long forms (`Apache License Version 2.0`, `MIT License`, `BSD 3-Clause`) onto their SPDX identifiers. A bundled file is read for an `SPDX-License-Identifier:` line first, then for the text of those three licenses.

Every license actually present must be the same. An absent declared license and an absent team policy are each nothing to conform to, never a mismatch, so a local folder with no team and no `license:` fails this gate only if it bundles two `LICENSE*` files that disagree.

### HYG6, description and size

An empty or whitespace-only `description` is an error. There is nothing to load a skill on without it.

A `SKILL.md` longer than 20,000 UTF-16 code units is a warning, quoting the measured length and the overage. That is roughly 5,000 tokens. It says outright that size alone does not block the operation. There is no other size limit anywhere in hygiene: no per-file cap, no folder cap.

### HYG7, the off-list category

A `metadata.terum-category` that is not in the team's list, compared case-insensitively, produces a warning. It fires only when a category list is actually supplied, which is only at `publish`, where the team's `team.json` is in hand. `validate` and `eval` supply none, so HYG7 never fires there. The CLI help for `validate` says so in as many words.

The category list is advice, not an enum. An off-list category is written and shipped, and the marketplace gives it a bucket of its own.

### HYG8, dependencies the skill does not carry

Before hygiene runs, the `SKILL.md` body is scanned for repository-relative path tokens. A token that resolves to something under the repository root but outside the skill folder is a dependency: the eval engine stages it into the candidate and incumbent sandboxes, and anything over a 20 MB running total is skipped. HYG8 warns when that count is above zero:

```
warning HYG8 SKILL.md: this skill references 2 repository paths outside its folder; it depends on files it does not carry
```

The count is the staged paths plus the ones skipped for size. Paths that resolve nowhere are reported separately by `eval` and are not counted here. The fix is to move the file into the skill folder, so an installed copy carries its own method.

## `validate`

```sh
npx -y terum-skills@latest validate <path|name>
```

Deterministic and offline. It runs the same gate the other callers run, and it also plans the repairs `skill fix` would make. That plan is returned to the app, which draws its Fix control from the count; the terminal prints the findings only.

### What it resolves

Without `--cwd`, a directory at the path you gave wins, and only if nothing is there does the argument get treated as a skill name in your configured team's clone, resolving to the newest version folder. A work-in-progress folder is almost always named after the published skill it will become, so the local path has to win.

With `--cwd <team-checkout>`, the order reverses: the argument is tried as a skill name in that checkout first, and only then as a path relative to it. The flag exists for a CI checkout that has no configuration, and in a team repository `evals`, `people`, and `skills` are real directories a well-formed skill may legitimately be named after.

Three directory shapes are handled:

| Shape | What validates |
| --- | --- |
| A directory holding `SKILL.md` | Itself, named by its basename. |
| `skills/<name>/v<N>/` | Itself, named `<name>`, never `v<N>`. Naming it by its basename would make HYG1 reject every published skill. |
| `skills/<name>/` with no `SKILL.md` | The newest version folder underneath. |

A path matching none of those validates as it is, and lets hygiene say what is wrong with it.

### What it prints

Warnings first, one line each, prefixed with `warning`:

```
warning HYG6 SKILL.md: SKILL.md is 24,180 characters, 4,180 over the 20,000-character guideline (~5k tokens). Size alone does not block this operation; loading this skill uses that much more context.
```

Then, on failure, one line per error in the form `HYG<n> <path>[:<line>]: <message>`, and the summary `Hygiene failed for <name>:` with the same lines on stderr. On success, one line:

```
my-skill: hygiene passed.
my-skill: hygiene passed (2 warnings).
```

Exit code is 0 when there are no errors and 1 when there are. Warnings never change the exit code.

### Two things that surprise people

`validate` without `--cwd` needs a configured team, because it reads `policy.skill_license` from your team clone. On a machine with no team it fails with the get-started lines instead. Pass `--cwd <checkout>` to validate against a checkout directly.

A folder that has never been published fails HYG1 on the managed fields. `validate` uses the strict schema, which requires `license`, `metadata.id`, `metadata.author`, and `metadata.terum-category`. Those four are written by `publish` when it injects managed fields, so a fresh local folder does not have them yet. `eval` runs the same gate with those four optional, which is why an unpublished folder can be evaluated but not validated.

## `skill fix`

```sh
npx -y terum-skills@latest skill fix <path>
```

It repairs the faults that have exactly one right answer, decided by something other than what the author typed: YAML's own grammar, the folder name, the team policy, HYG2's invisible set, and a file mode. Nothing moves, nothing is published, and the folder is your own.

It applies, in order:

1. Quotes a frontmatter value that YAML refuses because it holds `: `, leaving the text itself unchanged.
2. Sets `name:` to the folder name.
3. Sets `license:` to the team's `policy.skill_license`, when a team is configured and the declared license differs. With no configured team, `license:` is left alone.
4. Removes every HYG2 invisible character from every text file, counting what it removed.
5. Clears the executable mode bit on any file that is not a script. A file starting with `#!` keeps its bit, because clearing it would break the script and leave HYG4 standing anyway.

Each change prints one plain sentence:

```
Quoted `description` in SKILL.md so the frontmatter parses; the text is unchanged.
Set name to `my-skill` to match the folder (was `myskill`).
Set license to `Apache-2.0`, the team's policy (was `MIT`).
Removed 3 invisible characters from references/notes.md.
Cleared the executable mode on templates/report.md.
```

Then it re-runs the inspection and the hygiene gate over the repaired folder and lists what is left:

```
Still needs you (2):
  HYG3 SKILL.md:31: Contains a credential-shaped value.
  HYG4 scripts/run.sh: File begins with a shebang.
```

When everything passes it prints `<name>: hygiene passes.`, or `<name>: nothing to fix; hygiene passes.` when there was nothing to do. When it could repair nothing and findings remain, it exits 1 with `<name>: nothing here is a fault fix covers; N findings still need you (listed above).`

Anything whose right answer is a judgement is deliberately not repaired: a description, a category, an extra frontmatter field, a credential-shaped token, a shebang script. Those are reported.

## When hygiene runs

| Caller | On what | Managed fields | Executables | Category list |
| --- | --- | --- | --- | --- |
| `validate` | The folder on disk | Required | Never waived | None, so HYG7 cannot fire |
| `eval` | The local folder exactly as it is | Optional | Never waived | None, so HYG7 cannot fire |
| `publish` | The map after managed fields are injected | Required | Waived | The team's, so HYG7 fires here and only here |
| `skill fix` | The folder after its repairs | Optional | Never waived | None |

`eval` runs one more pass that is not a folder gate. When it generates eval assets, the generated bytes go through the HYG2 and HYG3 predicates alone, with the folder's own author exemption, before they are written. Every path it is about to write is inspected: `evals/triggers.yaml`, `evals/suite.yaml`, and each `evals/cases/<name>.yaml`. A finding there aborts the run without writing anything:

```
The generated eval assets for <skill> failed hygiene, so nothing was written:
HYG3 evals/cases/seed-repo.yaml:4: Contains the email address …
This is a defect in generation, not in your skill. Run eval again to regenerate.
```

That pass exists because the folder gate already ran, before those bytes existed. Without it, a clean run would leave the folder dirty and the failure would only appear on some later command.

## Next

- [How an eval works](overview.md) for where the gate sits in a run.
- [Generated evals](generated-evals.md) for what gets written into `evals/`.
- [Publishing](../guides/publish.md) for the injection step HYG1 depends on.
- [CLI reference](../reference/cli.md#validate) for the full option list.
