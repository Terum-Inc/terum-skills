/** B7: explicit source and documentation invocation policy.
 * Exact trimmed line patterns prevent file-wide exemptions, including the shipped manual.
 * Line numbers are informational; the tripwire matches file AND content and checks multiplicity.
 */
export const invocationLiteralCatalog: readonly { file: string; line: number; policy: 'routed' | 'fixed' | 'prose' | 'not-a-hint'; pattern: string }[] = [
  {
    "file": "src/lib/render/cells.ts",
    "line": 57,
    "policy": "fixed",
    "pattern": "return item.skill === undefined ? `${sigil}terum-skills ${item.verb}${tail}` : `${sigil}${item.skill}${tail}`;"
  },
  {
    "file": "src/lib/render/board.ts",
    "line": 31,
    "policy": "prose",
    "pattern": "/** A next step: a named skill (`/skill-info x`, `$skill-info x`) or a verb (`/terum-skills install x`); `raw` is a command that is not a terum-skills verb. */"
  },
  {
    "file": "src/lib/render/verbs/update.ts",
    "line": 7,
    "policy": "not-a-hint",
    "pattern": "const b = board(`terum-skills ${running ?? 'version unknown'}`);"
  },
  {
    "file": "src/lib/render/verbs/status.ts",
    "line": 20,
    "policy": "not-a-hint",
    "pattern": "const b = board(version === null ? 'terum-skills (version unknown)' : `terum-skills ${version}`);"
  },
  {
    "file": "src/lib/render/verbs/status.ts",
    "line": 57,
    "policy": "not-a-hint",
    "pattern": "/^terum-skills /, /^Team .+ \\((you are|configured handle) @/, /^  Repository: /, /^  Clone: /,"
  },
  {
    "file": "src/commands/install.ts",
    "line": 40,
    "policy": "prose",
    "pattern": "/** Where that bootstrap offers the bundled terum-skills skills (test knob). */"
  },
  {
    "file": "src/cli.ts",
    "line": 46,
    "policy": "not-a-hint",
    "pattern": "program.name('terum-skills').description('Share private Claude Code skills through a team git repository.').exitOverride();"
  },
  {
    "file": "src/cli.ts",
    "line": 168,
    "policy": "prose",
    "pattern": "program.command('uninstall').description('Remove terum-skills from this machine: your team (placed skills, local clone, cache), the session-start hook and the terum-skills skills for Claude Code and Codex if present, and ~/.terum/skills except recovery data; then prints the package-manager step').allowExcessArguments().action(async (_options: Record<string, never>, command: Command) => execute(async (io) => command.args.length ? failure(`To remove a skill, use \\`${invocation(context.form, 'uninstall-skill <ref>')}\\`.`) : active.uninstallMachine({ launch: context.launch, form: context.form }, io), { verb: 'uninstall', notices: true }));"
  },
  {
    "file": "src/index.ts",
    "line": 25,
    "policy": "prose",
    "pattern": "// A reader that closes early (`terum-skills ls | head -5`) surfaces as an asynchronous 'error' on"
  },
  {
    "file": "src/lib/editHook.ts",
    "line": 13,
    "policy": "prose",
    "pattern": "* dist/claude/hooks/ from assets/claude/hooks/terum-skills-edit.mjs) and is placed under the state"
  },
  {
    "file": "src/lib/editHook.ts",
    "line": 14,
    "policy": "prose",
    "pattern": "* root by `setup`, on the same contract as the session hook and the `/terum-skills` manual: one"
  },
  {
    "file": "src/lib/editHook.ts",
    "line": 22,
    "policy": "prose",
    "pattern": "* the author's machine, the `terum-skills` skill had 0 model-initiated invocations across 7,158"
  },
  {
    "file": "src/lib/editHook.ts",
    "line": 26,
    "policy": "not-a-hint",
    "pattern": "export const EDIT_HOOK_FILE = 'terum-skills-edit.mjs';"
  },
  {
    "file": "src/lib/editHook.ts",
    "line": 28,
    "policy": "not-a-hint",
    "pattern": "export const EDIT_HOOK_MARKER = '// terum-skills managed hook';"
  },
  {
    "file": "src/lib/editHook.ts",
    "line": 87,
    "policy": "not-a-hint",
    "pattern": "if (bundled === null) throw new Error(`The terum-skills edit hook is not bundled in this copy of terum-skills (expected at ${options.source}).`);"
  },
  {
    "file": "src/lib/editHook.ts",
    "line": 90,
    "policy": "not-a-hint",
    "pattern": "if (presence.kind === 'foreign') throw new Error(`${target} exists and is not the bundled terum-skills edit hook (${presence.why}); move it aside and re-run.`);"
  },
  {
    "file": "src/lib/editHook.ts",
    "line": 146,
    "policy": "not-a-hint",
    "pattern": "if (state === 'unavailable') { io.print(`The terum-skills edit hook is not bundled in this copy of terum-skills (expected at ${options.source}); skipped.`); return 'unavailable'; }"
  },
  {
    "file": "src/lib/editHook.ts",
    "line": 147,
    "policy": "not-a-hint",
    "pattern": "if (state === 'foreign') { io.print(`${target} exists and is not the bundled terum-skills edit hook; left alone. Move it aside and re-run setup to install it.`); return 'foreign'; }"
  },
  {
    "file": "src/lib/editHook.ts",
    "line": 150,
    "policy": "not-a-hint",
    "pattern": "if (state === 'current' && await eventHookInstalled(options.settingsFile, 'PostToolUse')) { io.print(`The terum-skills edit hook at ${target} is current.`); return 'present'; }"
  },
  {
    "file": "src/lib/editHook.ts",
    "line": 151,
    "policy": "not-a-hint",
    "pattern": "if (state === 'outdated' || state === 'current') { await installEditHook(options); io.print(`Updated the terum-skills edit hook at ${target}.`); return 'replaced'; }"
  },
  {
    "file": "src/lib/editHook.ts",
    "line": 157,
    "policy": "not-a-hint",
    "pattern": "io.print(`Installed the terum-skills edit hook at ${target} and a Write/Edit hook in ${options.settingsFile}.`);"
  },
  {
    "file": "src/lib/frames.ts",
    "line": 75,
    "policy": "not-a-hint",
    "pattern": "return verb || operands[0] || 'terum-skills';"
  },
  {
    "file": "src/lib/hook.ts",
    "line": 42,
    "policy": "not-a-hint",
    "pattern": "return typeof command === 'string' && command.includes('terum-skills');"
  },
  {
    "file": "src/lib/hook.ts",
    "line": 180,
    "policy": "not-a-hint",
    "pattern": "if (typeof command === 'string' && command.includes('terum-skills')) return command;"
  },
  {
    "file": "src/lib/invocation.ts",
    "line": 7,
    "policy": "routed",
    "pattern": "export const NPX_PREFIX = 'npx -y terum-skills@latest';"
  },
  {
    "file": "src/lib/invocation.ts",
    "line": 27,
    "policy": "not-a-hint",
    "pattern": "const candidate = join(entry, 'terum-skills');"
  },
  {
    "file": "src/lib/invocation.ts",
    "line": 49,
    "policy": "routed",
    "pattern": "return [form === 'bare' ? 'terum-skills' : NPX_PREFIX, verb, ...args.map((arg) => typeof arg === 'string' ? shellQuote(arg) : arg.raw)].join(' ');"
  },
  {
    "file": "src/lib/invocation.ts",
    "line": 11,
    "policy": "not-a-hint",
    "pattern": "* the placed /terum-skills manual: the bare binary when this copy is the global install on PATH,"
  },
  {
    "file": "src/lib/invocation.ts",
    "line": 18,
    "policy": "fixed",
    "pattern": "return form === 'bare' ? 'terum-skills' : `npx -y terum-skills@${version ?? 'latest'}`;"
  },
  {
    "file": "src/lib/launch.ts",
    "line": 57,
    "policy": "prose",
    "pattern": "const location = `This copy of terum-skills runs from ${launch?.path || 'an unknown location'}.`;"
  },
  {
    "file": "src/lib/launch.ts",
    "line": 59,
    "policy": "fixed",
    "pattern": "case 'global': return [location, 'If you installed it with npm: npm uninstall -g terum-skills   (pnpm: pnpm remove -g terum-skills · yarn: yarn global remove terum-skills · bun: bun remove -g terum-skills · Volta: volta uninstall terum-skills)'];"
  },
  {
    "file": "src/lib/launch.ts",
    "line": 60,
    "policy": "fixed",
    "pattern": "case 'local': return [location, `It is a dependency of ${launch.root}: run npm uninstall terum-skills there, or remove it from that package.json.`];"
  },
  {
    "file": "src/lib/launch.ts",
    "line": 61,
    "policy": "fixed",
    "pattern": "case 'npx': return [location, 'It is an npx cache copy, so there is nothing to uninstall for it. If you also installed the package globally or in a project, remove that with the tool you used, e.g. npm uninstall -g terum-skills.'];"
  },
  {
    "file": "src/lib/local-skills.ts",
    "line": 146,
    "policy": "prose",
    "pattern": "reject('inside-state-root', `inside the terum-skills state directory ${options.stateRoot}`);"
  },
  {
    "file": "src/lib/package.ts",
    "line": 5,
    "policy": "not-a-hint",
    "pattern": "export const PACKAGE_NAME = 'terum-skills';"
  },
  {
    "file": "src/lib/package.ts",
    "line": 6,
    "policy": "not-a-hint",
    "pattern": "export const APPROVED_UPSTREAM = 'https://github.com/ryanliu-terum/terum-skills.git';"
  },
  {
    "file": "src/lib/readme.ts",
    "line": 14,
    "policy": "not-a-hint",
    "pattern": "export const README_BEGIN = '<!-- terum-skills:begin -->';"
  },
  {
    "file": "src/lib/readme.ts",
    "line": 15,
    "policy": "not-a-hint",
    "pattern": "export const README_END = '<!-- terum-skills:end -->';"
  },
  {
    "file": "src/lib/readme.ts",
    "line": 116,
    "policy": "fixed",
    "pattern": "const command = repo && isSkillName(skill.name) ? `\\`npx -y terum-skills@latest install ${repo}/${skill.name}\\`` : '—';"
  },
  {
    "file": "src/lib/remote.ts",
    "line": 239,
    "policy": "prose",
    "pattern": "if (credentials) return \"Git has no usable HTTPS credentials for github.com (terum-skills runs git without a terminal prompt).\\nStore one with your Git credential helper, or run `gh auth setup-git --hostname github.com` so gh's active account supplies them, then retry.\";"
  },
  {
    "file": "src/lib/runner.ts",
    "line": 90,
    "policy": "not-a-hint",
    "pattern": "resolve({ code: expired ? 124 : code ?? 1, stdout: Buffer.concat(out).toString('utf8'), stderr: expired ? `terum-skills: ${command} ${verb} exceeded ${options.deadlineMs! / 1000} s` : Buffer.concat(err).toString('utf8') });"
  },
  {
    "file": "src/lib/skill-overrides.ts",
    "line": 4,
    "policy": "prose",
    "pattern": "* Claude Code loads whatever sits in a skills directory, so terum-skills cannot switch a placed copy"
  },
  {
    "file": "src/lib/skill-source.ts",
    "line": 22,
    "policy": "prose",
    "pattern": "throw new Error(`${source} is inside the terum-skills state directory ${stateRoot}; move the folder elsewhere and connect that path.`);"
  },
  {
    "file": "src/lib/skill-source.ts",
    "line": 58,
    "policy": "prose",
    "pattern": "// The terum-skills skills ship inside this package and are placed by setup; none is a team skill,"
  },
  {
    "file": "src/lib/skill-source.ts",
    "line": 60,
    "policy": "not-a-hint",
    "pattern": "if (isManagedFrontmatter(parsed)) return reject('managed-wrapper', 'a terum-skills skill that ships with terum-skills; not a team skill', 'This folder is a terum-skills skill that ships with terum-skills and is placed by setup; it cannot be connected to a team.');"
  },
  {
    "file": "src/lib/teamRepo.ts",
    "line": 81,
    "policy": "prose",
    "pattern": "/** Another terum-skills process holds this clone's writer lock. A per-team caller (sync) skips the team and continues; a single-clone verb (publish) fails. */"
  },
  {
    "file": "src/lib/teamRepo.ts",
    "line": 137,
    "policy": "not-a-hint",
    "pattern": "const waitingLine = (info: { label: string; elapsedMs: number }): string => `Waiting for another terum-skills operation on ${info.label} to finish… (${Math.round(info.elapsedMs / 1000)} s)`;"
  },
  {
    "file": "src/lib/teamRepo.ts",
    "line": 518,
    "policy": "fixed",
    "pattern": "const launch = launcher ? `${shellQuote(launcher.node)} ${shellQuote(launcher.entry)} guard-push` : `npx -y ${shellQuote(`terum-skills@${packageVersion() ?? 'latest'}`)} guard-push`;"
  },
  {
    "file": "src/lib/teamRepo.ts",
    "line": 519,
    "policy": "fixed",
    "pattern": "const warning = `terum-skills push guard: ${launcher ? launcher.entry : 'npx'} is gone, so this push was NOT checked. Re-run \\`npx -y terum-skills@latest team join <remote>\\` to re-arm it.`;"
  },
  {
    "file": "src/lib/teamRepo.ts",
    "line": 522,
    "policy": "not-a-hint",
    "pattern": "'# terum-skills: the D12 ownership guard for a raw push from this clone. Regenerated on every join; do not edit.',"
  },
  {
    "file": "src/lib/teamRepo.ts",
    "line": 619,
    "policy": "prose",
    "pattern": "// freeze on a working tree that never moves again. The writer lock held here proves no terum-skills process"
  },
  {
    "file": "src/lib/teamRepo.ts",
    "line": 679,
    "policy": "not-a-hint",
    "pattern": "if (now() >= deadline) throw new CloneBusy(`Another terum-skills operation holds the write lock on ${options.label ?? root}; retry when it finishes.`);"
  },
  {
    "file": "src/lib/teamRepo.ts",
    "line": 704,
    "policy": "not-a-hint",
    "pattern": "throw new CloneBusy(`The write lock on ${label ?? root} is stamped ${Math.round(aheadMs / 1000)} s in this machine's future (${lockPath}), so waiting cannot clear it; remove that directory if no terum-skills command is running.`);"
  },
  {
    "file": "src/lib/update.ts",
    "line": 167,
    "policy": "prose",
    "pattern": "const prefix = `Newer terum-skills release ${candidate.source === 'git-tags' ? 'advertised' : 'observed'}: ${candidate.version} (running ${running}). `;"
  },
  {
    "file": "src/lib/update.ts",
    "line": 168,
    "policy": "fixed",
    "pattern": "if (launch?.kind === 'local') return `${prefix}If installed locally with npm, run npm install ${launch.dependencyKind === 'devDependencies' ? '--save-dev ' : ''}terum-skills@latest in ${launch.root}.`;"
  },
  {
    "file": "src/lib/update.ts",
    "line": 169,
    "policy": "fixed",
    "pattern": "if (launch?.kind === 'global') return `${prefix}If installed globally with npm, run npm install -g terum-skills@latest.`;"
  },
  {
    "file": "src/lib/update.ts",
    "line": 170,
    "policy": "fixed",
    "pattern": "return `${prefix}This copy: ${launch?.path ?? 'unknown'}. Run the latest release with npx -y terum-skills@latest <command>; re-run setup with it to move the session hook and /terum-skills skill.`;"
  },
  {
    "file": "src/lib/wrapper.ts",
    "line": 13,
    "policy": "not-a-hint",
    "pattern": "export const MANAGED_BY = 'terum-skills';"
  },
  {
    "file": "src/lib/wrapper.ts",
    "line": 21,
    "policy": "not-a-hint",
    "pattern": "/** The command spelling every placed copy teaches (lib/invocation.ts pinnedPrefix); the bundled copies say `npx -y terum-skills@latest`. */"
  },
  {
    "file": "src/lib/wrapper.ts",
    "line": 41,
    "policy": "not-a-hint",
    "pattern": "* A bundled skill with every `npx -y terum-skills@latest` replaced by this machine's spelling. The"
  },
  {
    "file": "src/lib/wrapper.ts",
    "line": 144,
    "policy": "not-a-hint",
    "pattern": "if (presence.kind === 'foreign') throw new Error(`${directory} exists and is not a bundled terum-skills skill (${presence.why}); move it aside and re-run.`);"
  },
  {
    "file": "src/lib/wrapper.ts",
    "line": 221,
    "policy": "not-a-hint",
    "pattern": "if (states.kind === 'unavailable') { io.print(`The terum-skills skills are not bundled in this copy of terum-skills (expected under ${states.bundle}); skipped.`); return 'unavailable'; }"
  },
  {
    "file": "src/lib/wrapper.ts",
    "line": 224,
    "policy": "not-a-hint",
    "pattern": "for (const root of roots) for (const skill of root.skills) if (skill.state === 'foreign') io.print(`${skill.directory} exists and is not a bundled terum-skills skill (${skill.why}); left alone. Move it aside and re-run setup to install the bundled one.`);"
  },
  {
    "file": "src/lib/wrapper.ts",
    "line": 227,
    "policy": "not-a-hint",
    "pattern": "if (written.length) io.print(`Installed the terum-skills skills at ${root.root}: ${listNames(written)}.`);"
  },
  {
    "file": "src/lib/wrapper.ts",
    "line": 228,
    "policy": "not-a-hint",
    "pattern": "if (refreshed.length) io.print(`Updated the terum-skills skills at ${root.root}: ${listNames(refreshed)}.`);"
  },
  {
    "file": "src/lib/wrapper.ts",
    "line": 229,
    "policy": "not-a-hint",
    "pattern": "for (const { skill, error } of failed) io.print(`Could not install the terum-skills skill ${skill.name} at ${root.root}: ${reason(error)}`);"
  },
  {
    "file": "src/lib/wrapper.ts",
    "line": 238,
    "policy": "not-a-hint",
    "pattern": "io.print(`The terum-skills skills at ${current.map((root) => root.root).join(' and ')} are current.`);"
  },
  {
    "file": "src/lib/placer/vendor/skillhub/skill-target-lock.ts",
    "line": 61,
    "policy": "not-a-hint",
    "pattern": "const lockDir = join(tmpdir(), `terum-skills-target-locks-${uid}`)"
  },
  {
    "file": "src/lib/evals/generate.ts",
    "line": 11,
    "policy": "not-a-hint",
    "pattern": "const HEADER = '# generated by terum-skills eval-gen — review before trusting';"
  },
  {
    "file": "src/commands/app.ts",
    "line": 17,
    "policy": "prose",
    "pattern": "* `terum-skills app` (decision walk 2026-09-08, D1 D3 D7 D8): make sure this version's desktop app is on the"
  },
  {
    "file": "src/commands/app.ts",
    "line": 23,
    "policy": "not-a-hint",
    "pattern": "export const APP_REPOSITORY = 'ryanliu-terum/terum-skills';"
  },
  {
    "file": "src/commands/app.ts",
    "line": 24,
    "policy": "not-a-hint",
    "pattern": "export const APP_SLUG = 'terum-skills-desktop';"
  },
  {
    "file": "src/commands/app.ts",
    "line": 75,
    "policy": "prose",
    "pattern": "if (!version) return permanent('This copy of terum-skills has no version; the desktop app is published per version.');"
  },
  {
    "file": "src/commands/app.ts",
    "line": 81,
    "policy": "prose",
    "pattern": "if (platform === 'wsl') io.print('The desktop app runs on the Windows side of this machine, not inside WSL. Install terum-skills there and run this command from a Windows terminal; from here, everything works in the terminal.');"
  },
  {
    "file": "src/commands/app.ts",
    "line": 118,
    "policy": "prose",
    "pattern": "if (!(await exists(file)) || !(await exists(`${file}.sha256`))) return permanent(`No desktop app is published for terum-skills ${version} (looked for ${asset} on release v${version} of ${APP_REPOSITORY}). ${tail(args.form)}`);"
  },
  {
    "file": "src/commands/app.ts",
    "line": 161,
    "policy": "routed",
    "pattern": "if (emulation) io.print(`This machine has an ARM64 processor but you are running an x64 build of Node, so terum-skills and everything the desktop app starts will run under emulation. Install the ARM64 build of Node from nodejs.org, then run \\`${invocation(args.form, 'app')}\\` again to record it.`);"
  },
  {
    "file": "src/commands/app.ts",
    "line": 229,
    "policy": "prose",
    "pattern": "if (RELEASE_ASSETS_MISSING.test(text)) return permanent(`No desktop app is published for terum-skills ${version} (looked for ${asset} on release v${version} of ${APP_REPOSITORY}). ${tail(form)}`);"
  },
  {
    "file": "src/commands/eval.ts",
    "line": 396,
    "policy": "prose",
    "pattern": "// HEAD is not engine provenance (§5.3: \"terum-skills commit of the running CLI\"; review P2)."
  },
  {
    "file": "src/commands/guardPush.ts",
    "line": 68,
    "policy": "not-a-hint",
    "pattern": "if (checked) io.print(`terum-skills push guard: ${checked} path(s) to ${stripRemoteCredentials(args.url)} are yours.`);"
  },
  {
    "file": "src/commands/invite.ts",
    "line": 86,
    "policy": "prose",
    "pattern": "/** Optional global install so the bare `terum-skills` command exists on the teammate's machine (Ryan, 2026-09-06); the npx line below works without it. */"
  },
  {
    "file": "src/commands/invite.ts",
    "line": 87,
    "policy": "fixed",
    "pattern": "export const GLOBAL_INSTALL = 'npm install -g terum-skills';"
  },
  {
    "file": "src/commands/invite.ts",
    "line": 89,
    "policy": "fixed",
    "pattern": "export function joinCommand(target: string): string { return `npx -y terum-skills@latest setup ${target}`; }"
  },
  {
    "file": "src/commands/invite.ts",
    "line": 94,
    "policy": "fixed",
    "pattern": "return [`Send this to your teammate:`, '```', GLOBAL_INSTALL, joinCommand(ownerRepo), '', `Bare equivalent: npx -y terum-skills@latest team join ${ownerRepo}`, '```', 'If you have a pending GitHub invitation, setup tries to accept it using your logged-in gh account; without gh authentication, it asks you to accept it in your browser. Git must also have access to this repository.'];"
  },
  {
    "file": "src/commands/leave.ts",
    "line": 62,
    "policy": "not-a-hint",
    "pattern": "if (!releaseTeam) throw new Error(`Another terum-skills sync holds the session lock on ${name} (${lockPath(store.root, name)}); retry when it finishes, or remove that file if no session is syncing.`);"
  },
  {
    "file": "src/commands/publish.ts",
    "line": 268,
    "policy": "prose",
    "pattern": "if (teamSource === undefined) throw new Error('This repository has no team.json; it is not a terum-skills team repo.');"
  },
  {
    "file": "src/commands/readme.ts",
    "line": 47,
    "policy": "not-a-hint",
    "pattern": "const comment = ['<!-- terum-skills:pr-comment -->', '## terum-skills publish preview', ...(skills.length ? skills.map((skill) => `- ${inlineText(skill.name)} (${inlineText(skill.category)})`) : ['- No new skill versions.'])].join('\\n');"
  },
  {
    "file": "src/commands/refresh.ts",
    "line": 166,
    "policy": "not-a-hint",
    "pattern": "// The SessionStart entry itself. Every release before 0.21 wrote `npx -y terum-skills@latest`,"
  },
  {
    "file": "src/commands/refresh.ts",
    "line": 173,
    "policy": "not-a-hint",
    "pattern": "try { if (await migrateHook(target) === 'migrated') notices.push(`Pinned your session hook to this copy of terum-skills (${target.command}); it no longer fetches the newest release at session start. Re-run \\`${invocation(args.form, 'setup')}\\` after an update to move it.`); }"
  },
  {
    "file": "src/commands/refresh.ts",
    "line": 181,
    "policy": "not-a-hint",
    "pattern": "if (written.length) notices.push('Updated your terum-skills skills for this CLI.');"
  },
  {
    "file": "src/commands/refresh.ts",
    "line": 182,
    "policy": "not-a-hint",
    "pattern": "for (const failure of failed) notices.push(`Could not update your terum-skills skills for this CLI: ${failure}`);"
  },
  {
    "file": "src/commands/refresh.ts",
    "line": 189,
    "policy": "not-a-hint",
    "pattern": "notices.push('Updated your terum-skills edit hook for this CLI.');"
  },
  {
    "file": "src/commands/setup.ts",
    "line": 73,
    "policy": "prose",
    "pattern": "/** Where the bundled terum-skills skills are read from and placed (test knob). */"
  },
  {
    "file": "src/commands/setup.ts",
    "line": 92,
    "policy": "prose",
    "pattern": "'Welcome to terum-skills.',"
  },
  {
    "file": "src/commands/setup.ts",
    "line": 94,
    "policy": "prose",
    "pattern": "'This wizard helps you create a team, join one, invite teammates, place the terum-skills skills for Claude Code and Codex, and offer the session hook and a reminder to publish a skill after Claude edits one; re-run it any time to continue, and leave the invitation question blank to skip it.',"
  },
  {
    "file": "src/commands/setup.ts",
    "line": 146,
    "policy": "prose",
    "pattern": "`Setup stopped here, so the project, eval, session hook, terum-skills skills and edit-hook steps were not reached — run \\`${invocation(form, 'setup')}\\` again to finish.`,"
  },
  {
    "file": "src/commands/setup.ts",
    "line": 509,
    "policy": "prose",
    "pattern": "// The terum-skills skills ship inside this package, and setup is the one onboarding step"
  },
  {
    "file": "src/commands/status.ts",
    "line": 51,
    "policy": "not-a-hint",
    "pattern": "io.print(version === null ? 'terum-skills (version unknown)' : `terum-skills ${version}`);"
  },
  {
    "file": "src/commands/team.ts",
    "line": 110,
    "policy": "not-a-hint",
    "pattern": "io.print('Commit this to .github/workflows/terum-skills.yml in an ordinary PR by someone with push access.');"
  },
  {
    "file": "src/commands/team.ts",
    "line": 123,
    "policy": "fixed",
    "pattern": "if (targetHandle === binding.handle) throw new Error('You cannot remove yourself; run team leave <team> to leave this machine, or ask another admin to remove you.');"
  },
  {
    "file": "src/commands/team.ts",
    "line": 144,
    "policy": "fixed",
    "pattern": "if (typeof targetRaw.github !== 'string' || targetRaw.github.trim() === '') throw new Error(`${targetHandle} has no GitHub login on the roster, so there is no host access to revoke; run \\`team remove ${targetHandle} --archive-only\\` to archive the membership.`);"
  },
  {
    "file": "src/commands/team.ts",
    "line": 183,
    "policy": "fixed",
    "pattern": "throw new Error(`${targetHandle} is archived; @${login}'s access could not be revoked: ${reason}. Re-run team remove ${targetHandle} to retry.`);"
  },
  {
    "file": "src/commands/team.ts",
    "line": 200,
    "policy": "prose",
    "pattern": "if (source === undefined) throw new Error('This repository has no team.json; it is not a terum-skills team repo.');"
  },
  {
    "file": "src/commands/team.ts",
    "line": 390,
    "policy": "fixed",
    "pattern": "catch (error) { throw new Error(`${error instanceof Error ? error.message : String(error)} Your roster entry people/${identity.handle}.json was already pushed to ${normalized}; run \\`${invocation(args.form, 'team join', args.target)}\\` again to continue under the existing entry, or ask an admin to \\`team remove ${identity.handle}\\` if you did not mean to join twice.`); }"
  },
  {
    "file": "src/commands/team.ts",
    "line": 431,
    "policy": "prose",
    "pattern": "if (teamJson === undefined) throw new Error('This repository has no team.json; it is not a terum-skills team repo.');"
  },
  {
    "file": "src/commands/team.ts",
    "line": 522,
    "policy": "prose",
    "pattern": "return 'Ignored the credential embedded in the remote URL: terum-skills never stores one or passes one to git. Git access uses your configured Git credentials.';"
  },
  {
    "file": "src/commands/team.ts",
    "line": 595,
    "policy": "not-a-hint",
    "pattern": "await writeFile(pathJoin(staging, 'README.md'), `# ${teamName} skills\\n\\n<!-- terum-skills:begin -->\\n<!-- terum-skills:end -->\\n`);"
  },
  {
    "file": "src/commands/team.ts",
    "line": 596,
    "policy": "not-a-hint",
    "pattern": "await writeFile(pathJoin(staging, '.github', 'workflows', 'terum-skills.yml'), WORKFLOW);"
  },
  {
    "file": "src/commands/team.ts",
    "line": 612,
    "policy": "fixed",
    "pattern": "export const WORKFLOW = `# This workflow requires published terum-skills npm artifacts (M4)."
  },
  {
    "file": "src/commands/team.ts",
    "line": 613,
    "policy": "fixed",
    "pattern": "name: terum-skills"
  },
  {
    "file": "src/commands/team.ts",
    "line": 640,
    "policy": "fixed",
    "pattern": "[ -z \"$name\" ] || [ ! -d \"skills/$name\" ] || npx -y terum-skills@latest validate \"$name\" --cwd ."
  },
  {
    "file": "src/commands/team.ts",
    "line": 651,
    "policy": "fixed",
    "pattern": "- run: npx -y terum-skills@latest receipt-check --base origin/main"
  },
  {
    "file": "src/commands/team.ts",
    "line": 659,
    "policy": "fixed",
    "pattern": "- run: npx -y terum-skills@latest readme"
  },
  {
    "file": "src/commands/team.ts",
    "line": 680,
    "policy": "fixed",
    "pattern": "run: npx -y terum-skills@latest readme --pr-comment origin/main > /tmp/terum-skills-comment.md"
  },
  {
    "file": "src/commands/team.ts",
    "line": 685,
    "policy": "fixed",
    "pattern": "existing=$(gh api \"repos/\\${{ github.repository }}/issues/$PR/comments\" --paginate --jq '.[] | select(.body | contains(\"<!-- terum-skills:pr-comment -->\")) | .id' | head -n 1)"
  },
  {
    "file": "src/commands/team.ts",
    "line": 686,
    "policy": "fixed",
    "pattern": "body=$(cat /tmp/terum-skills-comment.md)"
  },
  {
    "file": "src/commands/team.ts",
    "line": 726,
    "policy": "prose",
    "pattern": "if (source === undefined) throw new Error('This repository has no team.json; it is not a terum-skills team repo.');"
  },
  {
    "file": "src/commands/team.ts",
    "line": 800,
    "policy": "prose",
    "pattern": "if (source === undefined) throw new Error('This repository has no team.json; it is not a terum-skills team repo.');"
  },
  {
    "file": "src/commands/teamMigrate.ts",
    "line": 29,
    "policy": "prose",
    "pattern": "/** §13: terum-skills team migrate. Terminal-only; a human runs it after the B1 release propagates. */"
  },
  {
    "file": "src/commands/uninstallMachine.ts",
    "line": 60,
    "policy": "prose",
    "pattern": "detail.push('terum-skills will be removed from this machine.');"
  },
  {
    "file": "src/commands/uninstallMachine.ts",
    "line": 75,
    "policy": "not-a-hint",
    "pattern": "if (editHookPresence.kind === 'foreign') detail.push(`  ${editHookPath} is not the bundled terum-skills edit hook (${editHookPresence.why}); left alone`);"
  },
  {
    "file": "src/commands/uninstallMachine.ts",
    "line": 84,
    "policy": "fixed",
    "pattern": "detail.push('Your membership and installed-skill records in the team repo are unchanged. Rejoining does not re-place skills; `npx -y terum-skills@latest install member <handle>` does.');"
  },
  {
    "file": "src/commands/uninstallMachine.ts",
    "line": 86,
    "policy": "prose",
    "pattern": "if (!(await io.confirm('Remove terum-skills from this machine?', { detail }))) return cancelled('Uninstall was cancelled.');"
  },
  {
    "file": "src/commands/uninstallMachine.ts",
    "line": 92,
    "policy": "prose",
    "pattern": "io.print(`Wrote a record of this machine's terum-skills state to ${record}.`);"
  },
  {
    "file": "src/commands/uninstallMachine.ts",
    "line": 111,
    "policy": "not-a-hint",
    "pattern": "try { if (await removeEditHook(editHook) === 'removed') io.print(`Removed the terum-skills edit hook from ${editHookPath} and ${editHook.settingsFile}.`); }"
  },
  {
    "file": "src/commands/uninstallMachine.ts",
    "line": 35,
    "policy": "prose",
    "pattern": "// The terum-skills skills setup placed under each host's skills root: only a copy carrying our marker is ours to remove."
  },
  {
    "file": "src/commands/uninstallMachine.ts",
    "line": 73,
    "policy": "not-a-hint",
    "pattern": "detail.push(root.managed.length ? `  terum-skills skills in ${root.root}: ${root.managed.map((skill) => skill.name).join(', ')}` : `  No terum-skills skills in ${root.root}`);"
  },
  {
    "file": "src/commands/uninstallMachine.ts",
    "line": 74,
    "policy": "not-a-hint",
    "pattern": "for (const entry of root.foreign) detail.push(`  ${entry.directory} is not a bundled terum-skills skill (${entry.why}); left alone`);"
  },
  {
    "file": "src/commands/uninstallMachine.ts",
    "line": 108,
    "policy": "not-a-hint",
    "pattern": "catch (error) { return failure(`${message(error)}; removing the terum-skills skills stopped at ${skill.directory} and the teams were left in place`); }"
  },
  {
    "file": "src/commands/uninstallMachine.ts",
    "line": 110,
    "policy": "not-a-hint",
    "pattern": "if (removed.length) io.print(`Removed the terum-skills skills from ${root.root}: ${removed.join(', ')}.`);"
  },
  {
    "file": "src/commands/unpublish.ts",
    "line": 140,
    "policy": "prose",
    "pattern": "if (source === undefined) throw new Error('This repository has no team.json; it is not a terum-skills team repo.');"
  },
  {
    "file": "src/commands/update.ts",
    "line": 26,
    "policy": "not-a-hint",
    "pattern": "const lines = [`terum-skills ${running ?? 'version unknown'}`, `This copy: ${path}`];"
  },
  {
    "file": "src/commands/update.ts",
    "line": 47,
    "policy": "fixed",
    "pattern": "case 'local': return [`If managed with npm, run in ${launch.root}:`, `  npm install ${launch.dependencyKind === 'devDependencies' ? '--save-dev ' : ''}terum-skills@latest`];"
  },
  {
    "file": "src/commands/update.ts",
    "line": 46,
    "policy": "fixed",
    "pattern": "case 'global': return ['If installed globally with npm, run:', '  npm install -g terum-skills@latest', 'Otherwise, update it with the tool that installed this copy.', 'Then run terum-skills setup once if the session hook or /terum-skills skill names a version: it re-points them at this copy.'];"
  },
  {
    "file": "src/commands/update.ts",
    "line": 48,
    "policy": "fixed",
    "pattern": "case 'npx': return [`Cache request recorded as: ${launch.request ?? 'unknown'}`, \"To request the registry's latest release, run:\", '  npx -y terum-skills@latest <command>', 'This does not update other local or global installations.', 'The session hook and /terum-skills skill keep the version that set them up until you re-run:', '  npx -y terum-skills@latest setup'];"
  },
  {
    "file": "src/commands/update.ts",
    "line": 50,
    "policy": "fixed",
    "pattern": "default: return ['Installation method could not be established.', 'Update this copy with the tool that installed it.', \"To run the registry's latest release:\", '  npx -y terum-skills@latest <command>', 'The session hook and /terum-skills skill keep the version that set them up until you re-run:', '  npx -y terum-skills@latest setup'];"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 2,
    "policy": "prose",
    "pattern": "name: terum-skills"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 3,
    "policy": "prose",
    "pattern": "description: \"Drive the terum-skills CLI from a Claude Code or Codex session: run any verb with --format md and show its board — inspect the Library or the team Marketplace, search, fetch with sync, validate or fix a local skill, install the latest version into Global or an added project, publish a local skill as an immutable version, manage the eval queue — and prepare the verbs that belong in a terminal (project setup, skill move/copy/rename/delete, prune, reconcile, machine uninstall, team administration). Use when the user wants to manage, evaluate, publish or install skills and no narrower terum-skills skill fits.\""
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 5,
    "policy": "prose",
    "pattern": "managed-by: terum-skills"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 6,
    "policy": "prose",
    "pattern": "short-description: \"Run any terum-skills verb from a session\""
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 9,
    "policy": "prose",
    "pattern": "Run one `terum-skills` verb on the user's behalf and show its board, or prepare the verb for a"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 15,
    "policy": "prose",
    "pattern": "eval (with the cost confirmation), eval-report, skill-status (`status` then `update`), sync-skills."
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 18,
    "policy": "prose",
    "pattern": "This file ships inside the `terum-skills` npm package with those seven skills. Setup places them at"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 21,
    "policy": "prose",
    "pattern": "`sync --hook` refreshes or adds them in a root that already holds one, announcing"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 22,
    "policy": "prose",
    "pattern": "`Updated your terum-skills skills for this CLI.` A foreign folder at one of those names is left alone."
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 28,
    "policy": "prose",
    "pattern": "note beginning *\"You edited <name>, a skill in this machine's terum-skills Library\"* appears after an"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 31,
    "policy": "prose",
    "pattern": "the `publish` it names here. A skill edited and never published is a skill only that machine has."
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 34,
    "policy": "prose",
    "pattern": "path can have several tokens (`skill move`, `team project create`); pass the remaining arguments"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 35,
    "policy": "prose",
    "pattern": "unchanged. With no arguments, ask which verb, defaulting to `status`. Explain the tables below"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 54,
    "policy": "fixed",
    "pattern": "- Always `npx -y terum-skills@latest ls --format md`-shaped — exactly that spelling, a real verb, `--format md` last — for a runnable command."
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 66,
    "policy": "prose",
    "pattern": "- This CLI has no standalone refresh command; `sync` fetches. `team migrate` exists but is"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 73,
    "policy": "prose",
    "pattern": "| `status` | nothing | show the board; exit 0 means the query succeeded, not that setup is complete. Pending work needs the matching install or removal retried, not a fetch |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 74,
    "policy": "prose",
    "pattern": "| `ls`, `ls --local`, `ls member <h>`, `ls project <n>`, `ls skill <name>` | nothing | show the board (the list-skills and skill-info skills exist for the common cases) |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 75,
    "policy": "prose",
    "pattern": "| `project add <abs-path>`, `project remove <abs-path>`, `project rename <abs-path> --to <name>`, `project list` | confirm with the user before adding, renaming, or forgetting a root | show the board, or the fenced block for `project rename`; removing a project leaves its files and placement ledger unchanged; a folder registered inside another registered folder is listed as its sub-project |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 76,
    "policy": "prose",
    "pattern": "| `search <term> [--category <c>] [--author <a>] [--project <p>]` | nothing | show the board; `No skills found.` is a result |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 77,
    "policy": "prose",
    "pattern": "| `skill fix <abs-path>` | confirm with the user, as for install: it rewrites the folder's SKILL.md | it applies the repairs with one right answer (quote a frontmatter value YAML refuses, `name` to the folder, `license` to team policy, strip invisible characters, clear an executable bit on a non-script) and prints `Still needs you` for the rest; show the fenced block |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 78,
    "policy": "prose",
    "pattern": "| `skill category <abs-path> --to <name>` | confirm with the user: it rewrites the folder's category | show the board; it rewrites `metadata.terum-category` locally and publishes nothing, so the team keeps showing the category its newest version carries until the user runs the `publish` the output prints. Any name is accepted; an off-list one gets the same advisory warning `publish` gives |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 79,
    "policy": "prose",
    "pattern": "| `validate <abs-path or name> [--cwd <team-root>]` | requires team policy from the configured clone or an explicit team root | show the board's findings verbatim. Validation does not inject managed fields; an unpublished folder may fail strict frontmatter checks. Publish injects its managed fields before checking; local eval permits those fields to be absent |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 80,
    "policy": "prose",
    "pattern": "| `update` | nothing | show the board; the CLI never runs a package manager, and the command it prints is for the user's terminal |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 81,
    "policy": "prose",
    "pattern": "| `app` | confirm download/install and opening the desktop app | show the fenced block |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 82,
    "policy": "prose",
    "pattern": "| `app-update --check` | nothing | show cached advertisement and installed/staged state; `--force` on this check requests a release probe |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 83,
    "policy": "prose",
    "pattern": "| `app-update --stage [--release <version>]`, `app-update --apply [--release <version>] [--reason manual]` | confirm download or installation; on macOS quit the running app before terminal apply | staging verifies the download; apply hands installation to a detached process |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 84,
    "policy": "prose",
    "pattern": "| `sync` | say it fetches and resets each disposable team clone to `origin/main`; it never uploads, places, or edits the user's skill folders | show the board; disclose each team reported as not refreshed. Run it in the background when your shell tool can |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 85,
    "policy": "prose",
    "pattern": "| `sync --hook` | do not run by hand; this is the SessionStart entry and refuses `--format` | stdout is the reload directive, notices go to stderr; only Terum's managed skills may be refreshed |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 86,
    "policy": "prose",
    "pattern": "| `install <ref> [--into global\\|<project root>]`, `install member <h> [--into global\\|<project root>]`, `install project <n> [--into global\\|<project root>]` | confirm the skill/list and destination: this places files and writes install records. Use an explicitly chosen `--into`; an unregistered project path refuses and needs `project add` first | installs the highest numbered version in the clone. A tool-grant question or replace question needs a terminal; report any completed work from the board's **Notes** before handing off |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 87,
    "policy": "prose",
    "pattern": "| `publish <ref> [--project <p>] [--category <c>]` | confirm the local skill, the team when more than one is configured, and any `--project` or `--category` the user chose; say that it rewrites the folder's managed frontmatter and writes an immutable version to team main. Omit optional flags the user has not chosen | show the fenced block, including the version line and any category disclosure. Its only question is a confirm when the latest local eval of these exact bytes failed; without a TTY that refuses before the local write-back or the team write, so quote the refusal and hand the same command to a terminal |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 88,
    "policy": "prose",
    "pattern": "| `invite <github-login…>` | confirm with the user: sends GitHub collaborator invitations | show the fenced block and the teammate join line |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 89,
    "policy": "prose",
    "pattern": "| `profile [--name <display>] [--bio <text>] [--role <role>] [--project <name>]… [--remove <skill>]` | confirm the profile changes; project membership names team projects; `--remove` takes one skill off the profile list | show the fenced block |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 90,
    "policy": "prose",
    "pattern": "| `login --set <key=value>` | confirm the identity change; keys are `name`, `email`, `default-handle`; repeat the flag for multiple fields | show the identity notice; published versions keep their recorded author |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 91,
    "policy": "prose",
    "pattern": "| `team workflow-update --print` | nothing | show the workflow scaffold and its manual migration instruction; this does not migrate the team's skill layout |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 92,
    "policy": "prose",
    "pattern": "| `eval <skill> [flags]` | use the eval skill: it confirms the cost first | the eval skill shows the board |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 93,
    "policy": "prose",
    "pattern": "| `eval <skill> <skill>… [--batch <n>] [--parallel <n>]`, `eval --pending` | confirm the paid runs once for the whole batch: several skills run as one batch after one agent probe; `--pending` means every shared skill with no receipt for its current version; `--batch <n>` asks before each further batch (a question — hand it to a terminal, or run without `--batch`) | show the batch board (`Evaluated X of N`); a declined continuation queues the rest for later |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 94,
    "policy": "prose",
    "pattern": "| `eval <skill…> --window overnight\\|later`, `eval --pending --window overnight` | confirm queueing; nothing is paid for now | show the queued board; overnight items run in the desktop app between 01:00 and 05:00, later items wait for `eval --drain` |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 95,
    "policy": "prose",
    "pattern": "| `eval-report <skill> [--team <team>]` | nothing | show the board: committed receipts and local run history for a skill in the team clone; no fetch |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 96,
    "policy": "prose",
    "pattern": "| `eval --queue-list` | nothing | show the queue board |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 97,
    "policy": "prose",
    "pattern": "| `eval --dequeue <skill>` | confirm removal from the queue | show the remaining items; a team-qualified selector is also accepted |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 98,
    "policy": "prose",
    "pattern": "| `eval --drain [--parallel <n>] [--window overnight] [--max <n>]` | confirm paid runs, as the eval skill does | show the drain board's successes and failures; default parallelism is four |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 99,
    "policy": "prose",
    "pattern": "| `uninstall-skill <ref> [--from global\\|<project root>]` | confirm the removal; `member <h>` and `project <n>` selectors also exist | it asks once before removing, so expect the refusal block: hand the command over |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 100,
    "policy": "prose",
    "pattern": "| `serve` | do not run as a one-shot command; it requires `--frames` and a request/answer client, and refuses `--format` | accepts only `status`, `ls`, `eval-report`, `search`, `validate`, `update`; every write uses its own process |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 108,
    "policy": "prose",
    "pattern": "copy stays under that project. If the kept-copy path already exists, the command refuses; move"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 109,
    "policy": "prose",
    "pattern": "that backup elsewhere yourself before retrying. Neither the Library nor `prune` cleans old-skills."
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 112,
    "policy": "prose",
    "pattern": "profile with no question, interactive or not; `profile --remove <name>` takes it off again."
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 139,
    "policy": "fixed",
    "pattern": "| `project add` (no path) | none | `npx -y terum-skills@latest project add` — asks for a folder |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 140,
    "policy": "fixed",
    "pattern": "| `unpublish <skill> [--yes]` | none; confirm the skill and team with the user | `npx -y terum-skills@latest unpublish <skill>` — it asks the user to type the skill's name; use `--yes` only after an explicit confirmation |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 141,
    "policy": "fixed",
    "pattern": "| `skill move <abs-path> --to global\\|<project root>` | none | `npx -y terum-skills@latest skill move <abs-path> --to <destination>` |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 142,
    "policy": "fixed",
    "pattern": "| `skill copy <abs-path> --to global\\|<project root>` | none | `npx -y terum-skills@latest skill copy <abs-path> --to <destination>` — the source folder stays where it is |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 143,
    "policy": "fixed",
    "pattern": "| `skill rename <abs-path> --to <new-name>` | none | `npx -y terum-skills@latest skill rename <abs-path> --to <new-name>` |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 144,
    "policy": "fixed",
    "pattern": "| `skill delete <abs-path>` | none | `npx -y terum-skills@latest skill delete <abs-path>` |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 145,
    "policy": "fixed",
    "pattern": "| `skill disable <abs-path>` | none | `npx -y terum-skills@latest skill disable <abs-path>` — writes `off` for the folder's name into Claude Code's own `skillOverrides` setting (the same key the `/skills` menu writes); the folder stays where it is |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 146,
    "policy": "fixed",
    "pattern": "| `skill enable <abs-path>` | none | `npx -y terum-skills@latest skill enable <abs-path>` — removes that `off` and nothing else |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 147,
    "policy": "fixed",
    "pattern": "| `prune` | none; an empty quarantine simply returns | `npx -y terum-skills@latest prune` |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 148,
    "policy": "fixed",
    "pattern": "| `uninstall` | none | `npx -y terum-skills@latest uninstall` — machine teardown, preserving recovery data and printing the package-manager step |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 149,
    "policy": "prose",
    "pattern": "| `team leave <name>`, `team remove <handle>` | none | the same command with the supported npx prefix |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 150,
    "policy": "fixed",
    "pattern": "| `team move <org>/<repo> [--from <team>] [--yes]` | none; one confirmation, then leave + join + re-place | `npx -y terum-skills@latest team move <org>/<repo>` — when a team's repository was recreated elsewhere (`sync` reports it and offers this) |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 151,
    "policy": "fixed",
    "pattern": "| `team project create [name] [--remote <url>]` | none | `npx -y terum-skills@latest team project create <name> --remote <url>` |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 152,
    "policy": "fixed",
    "pattern": "| `team project delete [name] [--yes]` | none; the CLI confirms and names what survives | `npx -y terum-skills@latest team project delete <name>` — removes the list only; its skills stay in the marketplace |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 153,
    "policy": "fixed",
    "pattern": "| `team migrate [--team <name>]` | none | `npx -y terum-skills@latest team migrate` — once per team, from a terminal, only after the release carrying the new CLI has reached every teammate (an un-upgraded teammate cannot read a migrated repo); refuses under `--frames` |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 154,
    "policy": "fixed",
    "pattern": "| `reconcile [--list]` | `--list` lists matches without asking or writing | `npx -y terum-skills@latest reconcile` — it asks before recording a Library folder as an installed team skill |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 155,
    "policy": "fixed",
    "pattern": "| `setup [target]`, `team create`, `team join <target>`, `login` | none; setup/join can clone before asking | `npx -y terum-skills@latest setup` / `setup <org>/<repo>` / `team create` / `team join <target>` / `login` with the same npx prefix |"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 159,
    "policy": "prose",
    "pattern": "publish needs no project and asks for none. Identical bytes reuse the existing version;"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 163,
    "policy": "prose",
    "pattern": "category line. Otherwise the CLI discloses the source before writing. It writes managed frontmatter"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 165,
    "policy": "prose",
    "pattern": "without asking — publishing is the endorsement (`profile --remove <name>` takes it back). A failed"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 166,
    "policy": "prose",
    "pattern": "team write can leave that frontmatter on disk. Do not treat publish as a dry run."
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 168,
    "policy": "prose",
    "pattern": "The `skill` folder operations require a direct child of Global or an added project's skills root."
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 169,
    "policy": "prose",
    "pattern": "Only `delete` asks you to type the folder's name; move, copy and rename ask nothing, because each"
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 175,
    "policy": "prose",
    "pattern": "the curated profile unchanged. `prune` permanently deletes confirmed quarantine contents only."
  },
  {
    "file": ".claude/skills/terum-skills/SKILL.md",
    "line": 193,
    "policy": "prose",
    "pattern": "When `CODEX_SANDBOX_NETWORK_DISABLED=1` is set and the command starts with `npx`, add `--prefer-offline` after `npx` so a cached package resolves without the registry; if npx still reports a network error, ask the user to run the command in a terminal. In that sandbox the verbs that need the network — `sync`, `install`, `publish`, `invite`, `eval`, and `update`'s release probe — are handed to a terminal with the reason."
  },
  {
    "file": "README.md",
    "line": 1,
    "policy": "prose",
    "pattern": "# terum-skills"
  },
  {
    "file": "README.md",
    "line": 5,
    "policy": "prose",
    "pattern": "[![npm](https://img.shields.io/npm/v/terum-skills)](https://www.npmjs.com/package/terum-skills)"
  },
  {
    "file": "README.md",
    "line": 6,
    "policy": "prose",
    "pattern": "[![CI](https://github.com/ryanliu-terum/terum-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/ryanliu-terum/terum-skills/actions/workflows/ci.yml)"
  },
  {
    "file": "README.md",
    "line": 21,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest setup"
  },
  {
    "file": "README.md",
    "line": 26,
    "policy": "fixed",
    "pattern": "To join an existing team, a repository admin invites you from the app's Members page (or with `invite <github-login>`) using your GitHub username. GitHub emails you the invitation, and the app gives them the one-line join command to send you: `npx -y terum-skills@latest setup <org>/<repo>`."
  },
  {
    "file": "README.md",
    "line": 46,
    "policy": "prose",
    "pattern": "We're interested in collaborators, and just as much in feedback and the things you want us to add. Join our Discord to talk to us: [discord.gg/SVVzejCf9](https://discord.gg/SVVzejCf9)! Bugs and feature requests are also welcome as [GitHub issues](https://github.com/ryanliu-terum/terum-skills/issues), or just email ryanliu@terum.ai directly (I've offered your email as tribute Ryan)."
  },
  {
    "file": "README.md",
    "line": 68,
    "policy": "prose",
    "pattern": "- Setup places eight skills for Claude Code and Codex (`list-skills`, `skill-info`, `search-skills`, `eval`, `eval-report`, `skill-status`, `sync-skills`, and `terum-skills` for any other verb) in your global skills folders, so either assistant can run these commands for you inside a session and show the result as a board, and offers a session-start hook that keeps the team repo fetched."
  },
  {
    "file": "README.md",
    "line": 97,
    "policy": "prose",
    "pattern": "- **Cases** live in the skill folder and travel with it. A skill with none still gets evaluated: `eval` generates either one suite or between three and seven cases, sized to the skill's complexity, plus five should-trigger and five should-not-trigger prompts. Every generated file is marked as generated."
  },
  {
    "file": "README.md",
    "line": 121,
    "policy": "fixed",
    "pattern": "Every verb runs as `npx -y terum-skills@latest <verb>`. The ones you'll type by hand:"
  },
  {
    "file": "README.md",
    "line": 125,
    "policy": "prose",
    "pattern": "| `setup [<org>/<repo>]` | Create a team, or join one by naming its repo; opens the app on macOS and Windows |"
  },
  {
    "file": "README.md",
    "line": 126,
    "policy": "prose",
    "pattern": "| `app` | Install and open the desktop app (macOS and Windows) |"
  },
  {
    "file": "README.md",
    "line": 127,
    "policy": "prose",
    "pattern": "| `publish <skill>` | Publish a local folder as an immutable version; identical bytes attach new evals instead |"
  },
  {
    "file": "README.md",
    "line": 128,
    "policy": "prose",
    "pattern": "| `install <skill>` | Copy a team skill into Global or a project you added; also `install member <handle>` and `install project <name>` |"
  },
  {
    "file": "README.md",
    "line": 129,
    "policy": "prose",
    "pattern": "| `eval <skill>` | Evaluate a local skill with your own Claude Code login |"
  },
  {
    "file": "README.md",
    "line": 130,
    "policy": "prose",
    "pattern": "| `sync` | Fetch the team repo; places nothing and edits none of your skills |"
  },
  {
    "file": "README.md",
    "line": 137,
    "policy": "prose",
    "pattern": "| Team | `setup [<org>/<repo>]` · `login` · `status` · `invite <github-login>…` · `profile` · `team create [name]` · `team join <target>` · `team leave <name>` · `team move <target>` · `team remove <handle>` · `team migrate` · `team workflow-update` · `team project create [name]` · `team project delete [name]` |"
  },
  {
    "file": "README.md",
    "line": 138,
    "policy": "prose",
    "pattern": "| Library | `ls` · `ls --local` · `ls member <handle>` · `ls project <name>` · `search <term>` · `project add [path]` · `project remove <path>` · `project rename <path>` · `project list` · `reconcile` · `skill move <path>` · `skill copy <path>` · `skill rename <path>` · `skill delete <path>` · `skill fix <path>` · `skill category <path>` · `skill enable <path>` · `skill disable <path>` · `prune` |"
  },
  {
    "file": "README.md",
    "line": 139,
    "policy": "prose",
    "pattern": "| Sharing | `publish <ref>` · `unpublish <skill>` · `install <ref>` · `uninstall-skill <ref>` · `sync` |"
  },
  {
    "file": "README.md",
    "line": 140,
    "policy": "prose",
    "pattern": "| Evals | `validate <path\\|name>` · `eval <skill…>` · `eval-report [skill]` · `usage [skill]` · `misses [skill]` |"
  },
  {
    "file": "README.md",
    "line": 141,
    "policy": "prose",
    "pattern": "| Machine | `app` · `app-update` · `update` · `uninstall` · `serve` (for programs, needs `--frames`) |"
  },
  {
    "file": "README.md",
    "line": 148,
    "policy": "fixed",
    "pattern": "Setup places eight skills at `~/.claude/skills/<name>/` for Claude Code and `~/.codex/skills/<name>/` for Codex (when `~/.codex` exists), so either assistant can run terum-skills for you inside a session and show the result as a Markdown board. They ship inside the npm package; re-running `npx -y terum-skills@latest setup` after an update refreshes them, and the session hook refreshes or adds them on a machine that already holds one. Invoke them as `/name` in Claude Code and `$name` in Codex: Each placed copy names the copy of the CLI that placed it, never `@latest`. Uninstall removes the copies it placed; a folder at one of those names that is not the bundled skill is left alone."
  },
  {
    "file": "README.md",
    "line": 152,
    "policy": "prose",
    "pattern": "| `list-skills [--local\\|--team]` | `ls --local --format md` and `ls --format md` — your Library and the team Marketplace |"
  },
  {
    "file": "README.md",
    "line": 153,
    "policy": "prose",
    "pattern": "| `skill-info <name>` | `ls skill <name> --format md`, then `eval-report <name> --format md` for a team skill |"
  },
  {
    "file": "README.md",
    "line": 154,
    "policy": "prose",
    "pattern": "| `search-skills <term>` | `search <term> --format md` |"
  },
  {
    "file": "README.md",
    "line": 155,
    "policy": "prose",
    "pattern": "| `eval <skill> [flags]` | `eval <skill> --format md`, after confirming the cost with you |"
  },
  {
    "file": "README.md",
    "line": 156,
    "policy": "prose",
    "pattern": "| `eval-report <skill>` | `eval-report <skill> --format md` |"
  },
  {
    "file": "README.md",
    "line": 157,
    "policy": "prose",
    "pattern": "| `skill-status` | `status --format md`, then `update --format md` |"
  },
  {
    "file": "README.md",
    "line": 158,
    "policy": "prose",
    "pattern": "| `sync-skills` | `sync --format md` |"
  },
  {
    "file": "README.md",
    "line": 159,
    "policy": "prose",
    "pattern": "| `terum-skills <verb …>` | any verb with `--format md`; the verbs that ask a question are handed to your terminal |"
  },
  {
    "file": "README.md",
    "line": 163,
    "policy": "fixed",
    "pattern": "`npx -y terum-skills@latest --help` lists the verbs, and `<verb> --help` their options; the full reference is [docs/reference/cli.md](docs/reference/cli.md). Programs drive the CLI with `--frames`, one JSON object per line; see [docs/frame-protocol.md](docs/frame-protocol.md)."
  },
  {
    "file": "README.md",
    "line": 165,
    "policy": "prose",
    "pattern": "**Boards.** Every command above takes `--format <plain|md|pretty|json|auto>` (default `plain`, the output the tables describe). `--format md` renders the result as a Markdown board — the form the shipped Claude Code and Codex skills ask for — `pretty` draws box tables with colour for a terminal, `json` writes one document (`{ verb, ok, exitCode, error?, declined?, refused?, value?, lines }`), and `auto` picks `pretty` on a TTY and `md` otherwise. `--rows <n|all>` caps table rows (default 25), `--width <n>` sets a pretty board's width, `--host <claude|codex|terminal>` phrases the board's **Next** line, `--no-color` drops ANSI. The flags go anywhere before `--`; they are refused with `--frames`, `serve`, and `sync --hook`, whose stdout is spoken for. `ls skill <name>` shows one skill whole, and `ls skill`, `eval-report` and `validate` accept a unique prefix; `eval` takes an exact or case-insensitive name; each of the four, run inside a Library skill folder, needs no name at all (`validate` also accepts any skill folder by path). A usage error (unknown verb, missing argument, bad option value) under any `--format` writes nothing to stdout — one stderr message and exit 1, nothing runs; a reader that sees exit 1 with empty stdout reads stderr."
  },
  {
    "file": "README.md",
    "line": 169,
    "policy": "fixed",
    "pattern": "Updates are yours to take. The session hook and the eight skills setup places run the copy of the CLI that set them up: the bare `terum-skills` binary when that copy is a global install the CLI found on your PATH on macOS or Linux, otherwise `npx -y terum-skills@<version>` pinned to that release. Nothing fetches a newer CLI at session start. `update` prints the newest advertised release and the exact command that updates *this* copy; after updating, re-run `setup` and the hook and skill move with it. The desktop app asks GitHub for a new release once a day, downloads it, and installs it when you quit, overnight, or when you press Install now, whichever you chose in Settings ▸ Updates; every download must match its published checksum and carry a build attestation from this repository's release workflow. `npx -y terum-skills@latest uninstall` removes your team from this machine (placed skills, the local clone, the hooks, the Claude Code skill, and on macOS the app bundle) and keeps your backups, quarantine, and local eval runs. On Windows, remove the app from Settings ▸ Apps."
  },
  {
    "file": "SECURITY.md",
    "line": 3,
    "policy": "prose",
    "pattern": "What terum-skills runs on your machine, when, and how a release is built and checked. Written so"
  },
  {
    "file": "SECURITY.md",
    "line": 8,
    "policy": "prose",
    "pattern": "The two hooks are opt-in at `terum-skills setup`, each with its own y/N; the eight skills are placed"
  },
  {
    "file": "SECURITY.md",
    "line": 9,
    "policy": "prose",
    "pattern": "by every `setup` run. Everything is removed by `terum-skills uninstall`."
  },
  {
    "file": "SECURITY.md",
    "line": 13,
    "policy": "prose",
    "pattern": "| Session hook | Once per Claude Code session start, in the background, at most once an hour per team | The copy of the CLI that set it up (see *Pinned, not latest*) with `sync --hook` | Fetches your team's private git repository into `~/.terum/skills`; refreshes skills it placed under `~/.claude/skills/` and the two files below; uploads nothing |"
  },
  {
    "file": "SECURITY.md",
    "line": 18,
    "policy": "prose",
    "pattern": "The CLI never runs a package manager on your behalf. `terum-skills update` prints the command that"
  },
  {
    "file": "SECURITY.md",
    "line": 24,
    "policy": "prose",
    "pattern": "the bare `terum-skills` binary when you installed the package globally, otherwise"
  },
  {
    "file": "SECURITY.md",
    "line": 25,
    "policy": "prose",
    "pattern": "`npx -y terum-skills@<version>` with the exact version that ran `setup`. Nothing on this machine"
  },
  {
    "file": "SECURITY.md",
    "line": 27,
    "policy": "prose",
    "pattern": "yourself and, for the pinned `npx` spelling, re-run `setup` so the hook and the skills move with it."
  },
  {
    "file": "SECURITY.md",
    "line": 29,
    "policy": "fixed",
    "pattern": "Releases before 0.21 wrote `npx -y terum-skills@latest` into the hook. The first session hook run of"
  },
  {
    "file": "SECURITY.md",
    "line": 37,
    "policy": "prose",
    "pattern": "grep -n terum-skills ~/.claude/settings.json"
  },
  {
    "file": "SECURITY.md",
    "line": 55,
    "policy": "prose",
    "pattern": "`terum-skills app` and `app-update` download the app for the CLI's own version through"
  },
  {
    "file": "SECURITY.md",
    "line": 60,
    "policy": "prose",
    "pattern": "2. `gh attestation verify <asset> --repo ryanliu-terum/terum-skills` succeeds. This checks the"
  },
  {
    "file": "SECURITY.md",
    "line": 68,
    "policy": "prose",
    "pattern": "npm audit signatures            # in a project where terum-skills is installed"
  },
  {
    "file": "SECURITY.md",
    "line": 69,
    "policy": "prose",
    "pattern": "gh attestation verify terum-skills-desktop_<version>_<suffix> --repo ryanliu-terum/terum-skills"
  },
  {
    "file": "SECURITY.md",
    "line": 80,
    "policy": "prose",
    "pattern": "- **Skill content itself.** A skill your team publishes is text Claude Code reads; terum-skills"
  },
  {
    "file": "docs/NEXT.md",
    "line": 1,
    "policy": "prose",
    "pattern": "# What comes next for the public face of terum-skills"
  },
  {
    "file": "docs/NEXT.md",
    "line": 39,
    "policy": "prose",
    "pattern": "`npx -y terum-skills@<version>` for teams that want reproducible setups."
  },
  {
    "file": "docs/README.md",
    "line": 1,
    "policy": "prose",
    "pattern": "# terum-skills documentation"
  },
  {
    "file": "docs/README.md",
    "line": 3,
    "policy": "prose",
    "pattern": "terum-skills evaluates Claude Code skills and shares them across a team through one private git repository. There is no server. The CLI does the work; the desktop app is a window onto it."
  },
  {
    "file": "docs/README.md",
    "line": 8,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest setup"
  },
  {
    "file": "docs/README.md",
    "line": 36,
    "policy": "prose",
    "pattern": "- [Hygiene](evaluating/hygiene.md): the deterministic gates, `validate`, `skill fix`."
  },
  {
    "file": "docs/README.md",
    "line": 38,
    "policy": "prose",
    "pattern": "- [Generated evals](evaluating/generated-evals.md): what `eval` writes when a skill has no tests."
  },
  {
    "file": "docs/README.md",
    "line": 41,
    "policy": "prose",
    "pattern": "- [Usage](evaluating/usage.md): which placed skills fired on this machine, and what `misses` screens for when one never did."
  },
  {
    "file": "docs/README.md",
    "line": 50,
    "policy": "prose",
    "pattern": "- [Layout-3 migration](migration-layout-3.md): release notes for `team migrate`."
  },
  {
    "file": "docs/concepts/how-it-works.md",
    "line": 29,
    "policy": "prose",
    "pattern": "| GitHub's API, through `gh` | Invitations, access-revoking `team remove`, the admin lookup behind `status --permissions`, the invitation your join accepts, and the search for a successor repository when a team's repository has gone. These are GitHub-only; on another host they refuse rather than guess. |"
  },
  {
    "file": "docs/concepts/how-it-works.md",
    "line": 30,
    "policy": "prose",
    "pattern": "| `github.com/ryanliu-terum/terum-skills` | A `git ls-remote --tags` release probe, at most once a day, and only when a team on this machine has a GitHub remote. Desktop app downloads come from that repository's releases through `gh release download`. |"
  },
  {
    "file": "docs/concepts/how-it-works.md",
    "line": 46,
    "policy": "prose",
    "pattern": "The guard is the authorization model, and it is per verb. `publish` may add files into a version folder that does not exist yet, and may not touch one that does. `unpublish` is the only thing that may remove a version folder. Every other verb may write your own people file and nothing else, and `team.json` only in the exact shape its verb needs. The generated `README.md` is the one path every verb may write, because it is regenerated from the catalogue rather than hand-edited. A write that touches one path it does not own is refused whole. See [the team repository reference](../reference/team-repo.md) for the layout and the per-verb rules."
  },
  {
    "file": "docs/concepts/how-it-works.md",
    "line": 61,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest sync"
  },
  {
    "file": "docs/concepts/how-it-works.md",
    "line": 64,
    "policy": "prose",
    "pattern": "`sync` moves the team clone forward. For each configured team it runs `git fetch` and then `git reset --hard origin/main` under that clone's writer lock, and records the fetch in `~/.terum/skills/run/<team>.stamp`. That is all it does to the team."
  },
  {
    "file": "docs/concepts/how-it-works.md",
    "line": 66,
    "policy": "prose",
    "pattern": "It exists because every read verb is fetch-free by contract. `ls`, `search` and `status` read the clone exactly as it stands and never move it, so a teammate's publish reaches your machine only when something fetches. The app runs `sync` in the background at launch and on window focus, at most once a minute."
  },
  {
    "file": "docs/concepts/how-it-works.md",
    "line": 68,
    "policy": "prose",
    "pattern": "`sync` does not:"
  },
  {
    "file": "docs/concepts/how-it-works.md",
    "line": 81,
    "policy": "prose",
    "pattern": "Two things are worth knowing about the edges. When a GitHub team's repository answers \"not found\", `sync` looks for where the team went and, at a terminal, offers to move this machine to the successor. Taking that offer runs `team move`, which does remove and re-place your placed skills from the new team. And in session-hook mode `sync` corrects three things it put on your machine itself. Its own `SessionStart` entry in `~/.claude/settings.json`, when that entry runs a copy of the CLI other than the one running now, is re-pointed at this copy. The eight bundled skills under `~/.claude/skills/` (and `~/.codex/skills/` where Codex is installed) and the edit-hook script at `~/.terum/skills/hooks/terum-skills-edit.mjs` are rewritten when they are outdated copies of its own, and a skills root that already holds some of the eight receives the ones it is missing. An edit hook you declined is never installed later, a skills root holding none of Terum's copies is left for `setup` to fill, and a file that is not this tool's is never touched."
  },
  {
    "file": "docs/concepts/how-it-works.md",
    "line": 85,
    "policy": "prose",
    "pattern": "Setup offers a Claude Code session-start hook, defaulting to No. When installed it runs `sync --hook` at every session start: a fetch of the team clone, a reconcile of what is placed, and a refresh of the managed `/terum-skills` copy and the edit-hook script when they are outdated copies of Terum's own. It prints one line to stdout for Claude and everything else to stderr. Concurrent session starts queue on the clone's writer lock for four seconds; one that still cannot take it reports `<team>: not refreshed (busy)` on stderr and exits 0."
  },
  {
    "file": "docs/concepts/how-it-works.md",
    "line": 87,
    "policy": "prose",
    "pattern": "The entry runs the copy of the CLI that installed it, not the registry's latest release: the bare `terum-skills` binary when that copy is a global install the CLI found on your PATH on macOS or Linux, and `npx -y terum-skills@<version>` pinned to that release otherwise. Nothing on this machine fetches a newer CLI at session start, and a release you install reaches the hook when you re-run `setup`. An entry written by an earlier release, which named `@latest`, is re-pointed at the running copy by the first `sync --hook` that sees it. The hook entry, what it writes and how to remove it are in [Claude Code integration](../guides/claude-code-integration.md); what runs on your machine and when, and how a download is checked, are in [security](../../SECURITY.md)."
  },
  {
    "file": "docs/concepts/how-it-works.md",
    "line": 95,
    "policy": "prose",
    "pattern": "**Any git remote.** The team needs a shared git remote, not GitHub specifically. Storage and sync work anywhere git works. Only membership administration needs a collaborator API, which is why `invite` and access-revoking `team remove` are GitHub-only and say so instead of pretending."
  },
  {
    "file": "docs/concepts/library-and-marketplace.md",
    "line": 12,
    "policy": "prose",
    "pattern": "- **A project you registered**: `<project>/.claude/skills`, for every folder you added with `project add`. A folder registered inside another registered folder is that project's sub-project, named by its path inside it; the tree is the folder structure."
  },
  {
    "file": "docs/concepts/library-and-marketplace.md",
    "line": 15,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest project add <path>"
  },
  {
    "file": "docs/concepts/library-and-marketplace.md",
    "line": 16,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest ls --local"
  },
  {
    "file": "docs/concepts/library-and-marketplace.md",
    "line": 23,
    "policy": "prose",
    "pattern": "### What `ls --local` reports per folder"
  },
  {
    "file": "docs/concepts/library-and-marketplace.md",
    "line": 48,
    "policy": "prose",
    "pattern": "| Placed | `install` copied a team version here and recorded a ledger row for the path: the skill's uuid, its team, its version, its scope, the date, and a fingerprint of what it wrote. The ledger is the only authority for a path this tool may delete. |"
  },
  {
    "file": "docs/concepts/library-and-marketplace.md",
    "line": 49,
    "policy": "prose",
    "pattern": "| Adopted | The folder was already here and you told `install --adopt <path>` to record it. The ledger row is written, but not one byte is copied. |"
  },
  {
    "file": "docs/concepts/library-and-marketplace.md",
    "line": 54,
    "policy": "prose",
    "pattern": "\"Disabled\" is deliberately not a Terum concept. `skill disable` and `skill enable` write Claude Code's own setting, the same key its `/skills` menu writes, so the app's switch and Claude's menu can never disagree. A global folder is governed by `~/.claude/settings.json`; a folder in a project is read from the user file, then the checkout's `.claude/settings.json`, then its `.claude/settings.local.json`, and written to the last of those. Only `off` belongs to this tool: `name-only` and `user-invocable-only` read as enabled, and `enable` never removes them."
  },
  {
    "file": "docs/concepts/library-and-marketplace.md",
    "line": 59,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest ls"
  },
  {
    "file": "docs/concepts/library-and-marketplace.md",
    "line": 62,
    "policy": "prose",
    "pattern": "This reads the team clone as it stands. It does not fetch; run `sync` first if you want today's version of the repository."
  },
  {
    "file": "docs/concepts/library-and-marketplace.md",
    "line": 102,
    "policy": "prose",
    "pattern": "| Created by | `team project create`, or the app's Create project button | `project add <path>` |"
  },
  {
    "file": "docs/concepts/library-and-marketplace.md",
    "line": 103,
    "policy": "prose",
    "pattern": "| Used for | Grouping published skills, and `install project <name>` | Finding your local skills, and choosing an install destination |"
  },
  {
    "file": "docs/concepts/library-and-marketplace.md",
    "line": 105,
    "policy": "prose",
    "pattern": "They interact in exactly one place: `install project <name>` reads that team project's declared remotes and defaults the `Install to` question to the registered library project whose `origin` matches one of them, if precisely one does. Every other install offers `Global (~/.claude/skills)` as the default."
  },
  {
    "file": "docs/concepts/library-and-marketplace.md",
    "line": 114,
    "policy": "prose",
    "pattern": "| Written by | `install`, automatically | `publish`, with no question; `install`, after asking once with a default of No |"
  },
  {
    "file": "docs/concepts/library-and-marketplace.md",
    "line": 115,
    "policy": "prose",
    "pattern": "| Removed by | `uninstall-skill`, when the last local copy at that scope goes | `profile --remove <skill>` |"
  },
  {
    "file": "docs/concepts/library-and-marketplace.md",
    "line": 118,
    "policy": "prose",
    "pattern": "Publishing and installing both add the entry without asking: typing `publish` or `install <name>` chose the skill by hand, and that is the endorsement. It is one entry per skill, updated in place, and `profile --remove` takes it off."
  },
  {
    "file": "docs/concepts/library-and-marketplace.md",
    "line": 120,
    "policy": "prose",
    "pattern": "`install member <handle>` installs that person's `profile[]`, not their `installed[]`. You get what they endorse, not everything they happen to have."
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 9,
    "policy": "prose",
    "pattern": "| Any verb that writes to the team repository: `publish`, `unpublish`, `install`, `uninstall-skill`, `profile`, `team remove`, `team project create`, `team project delete`, `team migrate` | Your team's git remote | A `git fetch`, then a `git push` of one commit. Its content is whatever the verb owns: version bytes, receipts, your people file, `team.json`. Git also sends your git credentials for that remote. | Do not run the verb. There is no local-only mode for a write: the repository is where team state lives. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 10,
    "policy": "prose",
    "pattern": "| `team create`, `team join`, `team move` | Your team's git remote | `team create --remote <url>` runs `git ls-remote --heads` to prove the repository is empty, then pushes one scaffold commit carrying `team.json`, your people file and the workflow. `team join` runs `git clone` of the whole repository, then adds your people file through the fetch-and-push above. `team move` is a local teardown followed by a join against the new remote and one install per skill it is putting back. | Nothing binds a machine to a team without reaching that team's remote. `team leave` is the exception in the other direction: it changes nothing in the repository and never pushes. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 11,
    "policy": "prose",
    "pattern": "| `sync`, and the app's background refresh at launch and on window focus | Your team's git remote | A `git fetch` only, for every configured team. Nothing is pushed. | Do not run `sync`, and turn off the app's automatic refresh by not using the app. The read verbs never fetch, so a clone you never refresh stays where it is. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 13,
    "policy": "prose",
    "pattern": "| `eval`, on a machine that has a team | Your team's git remote | A `git fetch` before the run, so the incumbent arm reads a current clone. Then, when the evaluated bytes are already a published version, a `git push` of the receipt for that run as one committed file. | `eval --no-commit` stops the push. The fetch runs whenever a team is configured. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 14,
    "policy": "prose",
    "pattern": "| `invite <login>` | GitHub API, through `gh` | `PUT repos/<owner>/<repo>/collaborators/<login>`: the repository slug and each login you typed, under your gh credentials. | Add collaborators on GitHub yourself. `invite` has no team-repo write path, so skipping it costs nothing else. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 15,
    "policy": "prose",
    "pattern": "| `team remove <handle>` | GitHub API, through `gh` | An admin probe of `repos/<owner>/<repo>`, then the repository's collaborator and invitation lists, then a `DELETE` of that person's collaborator entry or pending invitation. | `team remove --archive-only`, which archives the handle in `team.json` and touches no host API. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 16,
    "policy": "prose",
    "pattern": "| `status --permissions` | GitHub API, through `gh` | `repos/<owner>/<repo>/collaborators?permission=admin`, to mark which members are repository admins. The flag is real but hidden from `status --help`. | Run plain `status`. Without the flag the lookup does not happen and the admin column reads as unknown. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 17,
    "policy": "prose",
    "pattern": "| `sync`, when a GitHub team's repository answers \"not found\" | GitHub API, through `gh` | `user/repository_invitations`, then `user/repos?affiliation=collaborator,organization_member,owner`, then `repos/<owner>/<repo>/contents/team.json` for up to eight of that owner's repositories you can already reach, newest push first. That last read is what tells a candidate repository from a team repository. Cached for ten minutes. | Only runs for a GitHub remote, only after the repository is already gone, and never in session-hook mode. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 18,
    "policy": "prose",
    "pattern": "| `team join` and `setup <org>/<repo>` | GitHub API, through `gh` | `user/repository_invitations` to find the matching invitation, a `PATCH` to accept it, and `repos/<owner>/<repo>` to check whether you already have access. | Accept the invitation in the browser first. Without a logged-in `gh`, joining prints the invitation URL and waits instead of calling the API. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 20,
    "policy": "prose",
    "pattern": "| `login`, `setup`, and `team create`, where they check the GitHub CLI | GitHub API, through `gh` | `gh auth status`. This tool reads its exit code and nothing else, and never sees a token; what that command sends is gh's own. `gh --version` runs locally and sends nothing. At a terminal, a logged-out `gh` is offered `gh auth login`, which is gh's own flow. | Run without `gh` installed. Every GitHub-only operation then refuses and says it needs `gh`. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 21,
    "policy": "prose",
    "pattern": "| `team create` on GitHub | GitHub API, through `gh` | `gh repo create <owner>/<repo> --private`, then a read of its `nameWithOwner`, then `--delete-branch-on-merge`. | `team create <name> --remote <url>` against a repository you made yourself. That path calls no repository API. It still asks a logged-in `gh` for your login to default the handle question, and running without `gh` installed stops that too. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 22,
    "policy": "prose",
    "pattern": "| `eval`, execution arms | Anthropic, through your Claude Code login | One `claude -p` session per arm, run in a sandbox directory. The task text, the staged skill folder, and whatever files the case stages. The agent runs with Bash, Read, Write, Edit, Glob, Grep, Task and Workflow available inside that sandbox. | Do not run `eval`. There is no offline arm. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 23,
    "policy": "prose",
    "pattern": "| `eval`, trigger cases | Anthropic, through your Claude Code login | For each trigger prompt: the prompt, plus the name and description of every skill folder in the same Library root as the skill under test. The whole point of the test is whether the model picks your skill out of that catalogue. | `eval --execution-only`, or run the skill from a Library root that holds nothing you would rather not name. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 24,
    "policy": "prose",
    "pattern": "| `eval`, generating missing eval assets | Anthropic, through your Claude Code login | The full `SKILL.md` and the names of the other files in the folder, never their contents. A trigger generation also sends the same catalogue; a case generation does not. | `eval --no-gen`, and author `evals/cases/` and `evals/triggers.yaml` by hand. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 25,
    "policy": "prose",
    "pattern": "| `eval`, the judge | Anthropic, through your Claude Code login | The task, the rubric, and the last 6,000 characters of each of the two transcripts. | Not separable from an execution run; a comparison has to be judged. A case with no `judge` rubric is decided by its checks alone and makes no judge call; `--triggers-only` runs no arms at all. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 26,
    "policy": "prose",
    "pattern": "| `misses` | Anthropic, through your Claude Code login | Each harvested prompt with its system-reminder blocks stripped, up to three preceding turns trimmed to their last 1,000 characters, and the name and description of every placed skill dated at or before that prompt, in batches of ten to `claude -p --max-turns 1 --disallowedTools '*'` on `sonnet`. | Do not run `misses`. It has no offline mode, and nothing else runs it: the app has no surface for it and `serve` refuses it. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 27,
    "policy": "prose",
    "pattern": "| `publish`, choosing a category | Anthropic, through your Claude Code login | The first 2,000 characters of your `SKILL.md` and the team's category list, to `claude --model haiku`. | Declare `metadata.terum-category` in the file, or pass `--category <name>`. Either one skips the call entirely. Offline, the call fails and the category falls back to `misc`. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 28,
    "policy": "prose",
    "pattern": "| `update`, and `app-update` (which the app runs at launch and on window focus) | `github.com/ryanliu-terum/terum-skills` | `git ls-remote --tags` against the public release repository, at most once a day. It asks for the tag list and nothing else: it sends no version of yours, no identity and no query. Git supplies whatever it would normally send to github.com, your credential helper included. It runs only when a team on this machine has a GitHub remote. | Use a non-GitHub team remote, and the probe never runs. Otherwise it is one tag listing per day. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 29,
    "policy": "prose",
    "pattern": "| `app`, and applying an app update | `github.com/ryanliu-terum/terum-skills` | `gh release download v<version>` for the platform asset and its checksum, then `gh attestation verify <asset> --repo ryanliu-terum/terum-skills`, which asks GitHub for the build-provenance attestation recorded for exactly those bytes. Both run under your gh credentials. The download sends the release tag and the asset name; the verify step sends this repository slug and the SHA-256 of the bytes already on your disk, and nothing about you or your team. | Do not install the desktop app. The CLI is complete without it, and there is no Linux app to download in any case. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 30,
    "policy": "prose",
    "pattern": "| Sending a teammate the join instructions | Nothing, on its own | The block `invite` prints contains an optional global install line, a `setup <org>/<repo>` line, its bare `team join` equivalent, one sentence about invitations, and your repository slug. Nothing else: no token, no handle, no member list, no skill names. You paste it wherever you like. | It is already inert; treat the repository slug as the one fact it discloses. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 43,
    "policy": "prose",
    "pattern": "| `github` | Your GitHub login, or empty. Present so `team remove` can put it in a REST path. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 44,
    "policy": "prose",
    "pattern": "| `bio`, `role`, `projects` | Self-described, written only by `profile`. Job labels and registry membership, not permissions. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 47,
    "policy": "prose",
    "pattern": "| `local_skills` | A single number: how many skill folders your machine held across your Global root and your registered projects, counted the last time `install` or `profile` wrote your people file. Not names, not paths. It is a self-report, and it is absent rather than zero when no count has been made. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 61,
    "policy": "prose",
    "pattern": "| The usage event archive | `~/.terum/skills/run/usage-events.jsonl`, append-only, with exactly four fields per line: the skill name, a timestamp, which kind of firing it was, and the entrypoint. No session id, no path, no free text. It is read by `usage` and by nothing else, and it never leaves the machine. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 63,
    "policy": "prose",
    "pattern": "| Quarantine | `~/.terum/skills/quarantine/<timestamp>/<name>`, where an edited copy goes instead of being deleted. Only `prune` empties it, after listing every path and asking. |"
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 66,
    "policy": "prose",
    "pattern": "One item on that list has a second copy that does not stay local. When `eval` generates missing assets it also writes them into the skill folder itself, at `evals/cases/` or `evals/suite.yaml`, and `evals/triggers.yaml`, and `publish` writes a skill's eval assets to the team on every publish. The copy under the run directory stays here; the copy in your folder is part of the skill you share."
  },
  {
    "file": "docs/concepts/privacy-and-network.md",
    "line": 84,
    "policy": "prose",
    "pattern": "What they do not silence is everything else. They do not stop `update` or `app-update` from probing the release repository, they do not stop the app's launch-time update check, and they do not stop a single `git`, `gh` or `claude` call any verb makes. They are about one printed line."
  },
  {
    "file": "docs/concepts/versions-and-identity.md",
    "line": 75,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest unpublish <skill>"
  },
  {
    "file": "docs/concepts/versions-and-identity.md",
    "line": 88,
    "policy": "prose",
    "pattern": "- **It does not rewrite history.** The bytes stay reachable in the team repository's git history. This removes them from the working tree, which is what the catalogue, `ls`, the README and `install` actually read."
  },
  {
    "file": "docs/concepts/versions-and-identity.md",
    "line": 93,
    "policy": "prose",
    "pattern": "The identity does not restart with them, and `unpublish --help` says otherwise:"
  },
  {
    "file": "docs/concepts/versions-and-identity.md",
    "line": 109,
    "policy": "prose",
    "pattern": "Install copies `skills/<name>/v<max>/` as it stands in your clone, so the version you get is the newest one your last `sync` brought down."
  },
  {
    "file": "docs/concepts/versions-and-identity.md",
    "line": 131,
    "policy": "prose",
    "pattern": "- **`install` seeds them.** After copying a version it copies that version's committed receipts into your local store, filed under the digest each one names. Pre-digest receipts and unreadable ones are skipped with a notice. So a skill you have installed already shows its team score locally, offline."
  },
  {
    "file": "docs/concepts/versions-and-identity.md",
    "line": 132,
    "policy": "prose",
    "pattern": "- **`eval` publishes its own,** when the bytes it evaluated are already a published version of that skill. It writes exactly one path, `evals/<uuid>/v<N>/<runId>.json`, and it never mints a version or moves skill bytes. Pass `--no-commit` to keep the run on this machine. When the bytes are not a published version there is nothing to attach it to, and the run says so."
  },
  {
    "file": "docs/concepts/versions-and-identity.md",
    "line": 133,
    "policy": "prose",
    "pattern": "- **`publish` attaches them.** Every local receipt taken of exactly the bytes being published is copied into the repository, stamped with the skill's uuid and the version it landed at. Local runs of earlier bytes are left behind, and a publish that minted a version says how many:"
  },
  {
    "file": "docs/contributing/release.md",
    "line": 38,
    "policy": "prose",
    "pattern": "Dispatch with `dry_run=true` first. A dry run runs `validate`, `build`, `desktop` and `audit`, so it proves the gates, the tarball and the desktop matrix, and it performs neither the npm write nor the GitHub write. It does not exercise the `npm` environment approval: `publish` is the job that declares that environment, and a dry run skips it (`release.yml:296-298`). Then re-dispatch with the same `expected_version` and `expected_sha` and `dry_run=false`."
  },
  {
    "file": "docs/contributing/release.md",
    "line": 52,
    "policy": "prose",
    "pattern": "Runs only when the plan says `publish`. It installs with `npm ci`, runs `npm run lint`, `npm run typecheck` and `npm test`, then packs once."
  },
  {
    "file": "docs/contributing/release.md",
    "line": 56,
    "policy": "prose",
    "pattern": "The tarball is then inspected. It must contain `package.json`, `README.md`, `SECURITY.md`, `LICENSE`, `NOTICE`, `dist/index.js`, `dist/claude/skills/<name>/SKILL.md` for each of the eight bundled skills and `dist/claude/hooks/terum-skills-edit.mjs`, and no path may contain `__tests__` or start with `src/`. `SECURITY.md` and the shipped skills are what make this check stricter than the equivalent one in `ci.yml`, which requires neither (`ci.yml:84`). The packed tarball is then installed into a fresh throwaway project and run from a foreign directory, and uploaded as the `release-tarball` artifact with the digest that `publish` later compares against."
  },
  {
    "file": "docs/contributing/release.md",
    "line": 60,
    "policy": "prose",
    "pattern": "Builds the app on four runners. It is gated on the same `publish` state but runs on dry runs too, which is how the matrix is proven without publishing."
  },
  {
    "file": "docs/contributing/release.md",
    "line": 64,
    "policy": "prose",
    "pattern": "| `macos-latest` | `aarch64-apple-darwin` | `app` | `aarch64.app.tar.gz` |"
  },
  {
    "file": "docs/contributing/release.md",
    "line": 65,
    "policy": "prose",
    "pattern": "| `macos-latest` | `x86_64-apple-darwin` | `app` | `x64.app.tar.gz` |"
  },
  {
    "file": "docs/contributing/release.md",
    "line": 69,
    "policy": "prose",
    "pattern": "Each asset is named `terum-skills-desktop_<version>_<suffix>`, with a `.sha256` sidecar beside it. The matrix does not fail fast, so one broken runner still tells you about the other three."
  },
  {
    "file": "docs/contributing/release.md",
    "line": 73,
    "policy": "prose",
    "pattern": "On a run that is not a dry run, each asset then gets a build-provenance attestation from `actions/attest-build-provenance`, recorded by GitHub against this repository under the job's own OIDC identity (`release.yml:282-286`). The step is skipped on a dry run, so no attestation ever exists for bytes that no Release carries. `terum-skills app` and `app-update` check that attestation with `gh attestation verify` after the checksum, so an asset swapped on the Release together with its `.sha256` is refused (`src/commands/app.ts:280-289`)."
  },
  {
    "file": "docs/contributing/release.md",
    "line": 79,
    "policy": "prose",
    "pattern": "Runs only when the plan says `publish` and `dry_run` is `false`, and it needs `validate`, `build` and `desktop` to have succeeded. The desktop app is therefore always built before the npm publish, so a CLI version can never reach the registry without its app."
  },
  {
    "file": "docs/contributing/release.md",
    "line": 93,
    "policy": "prose",
    "pattern": "Finally it creates the GitHub Release with `gh release create <tag> --verify-tag --title \"terum-skills <version>\" --generate-notes`, bounded below by the previous stable tag when there is one, marked latest only when the plan says so, and marked prerelease when the version is one. The desktop assets are attached to that same Release. If the Release already exists the step prints `Release <tag> exists; left untouched` and does nothing."
  },
  {
    "file": "docs/contributing/release.md",
    "line": 112,
    "policy": "prose",
    "pattern": "| `publish` | Not on npm yet. | The full run: build, desktop, publish, finalize. |"
  },
  {
    "file": "docs/contributing/release.md",
    "line": 143,
    "policy": "prose",
    "pattern": "- `terum-skills-desktop_<version>_aarch64.app.tar.gz` for Apple silicon"
  },
  {
    "file": "docs/contributing/release.md",
    "line": 144,
    "policy": "prose",
    "pattern": "- `terum-skills-desktop_<version>_x64.app.tar.gz` for Intel Macs"
  },
  {
    "file": "docs/contributing/release.md",
    "line": 145,
    "policy": "prose",
    "pattern": "- `terum-skills-desktop_<version>_arm64-setup.exe` for Windows on ARM64"
  },
  {
    "file": "docs/contributing/release.md",
    "line": 146,
    "policy": "prose",
    "pattern": "- `terum-skills-desktop_<version>_x64-setup.exe` for Windows on x64"
  },
  {
    "file": "docs/contributing/release.md",
    "line": 150,
    "policy": "prose",
    "pattern": "What stands in for a certificate is the build-provenance attestation the desktop job records. The CLI discards any asset that carries no valid attestation for this repository, and says so. Releases cut before that step landed carry none, so a CLI built from this tree refuses their assets; `app` only ever downloads the app for its own version, so that reaches a user only through `app-update --release <version>` aimed at an older Release."
  },
  {
    "file": "docs/evaluating/generated-evals.md",
    "line": 3,
    "policy": "prose",
    "pattern": "A skill with no tests cannot be measured. Rather than report an empty verdict, `eval` writes the missing assets itself, into the skill folder, and tells you it did."
  },
  {
    "file": "docs/evaluating/generated-evals.md",
    "line": 54,
    "policy": "prose",
    "pattern": "Every generated case carries a `bucket`, and at least one case in the set must be `adversarial`. What the validator refuses is fixed: a count outside 3 to 7, a name that is not unique lowercase-hyphenated, a `fixture` key, a missing or off-list bucket, a check outside the whitelist, a body the case loader rejects, a `files` key the sandbox guard refuses, a `setup` that cannot start, and a set with no adversarial case."
  },
  {
    "file": "docs/evaluating/generated-evals.md",
    "line": 66,
    "policy": "prose",
    "pattern": "The generator is held to a narrower contract than an authored case. Checks may use only `transcript_mentions`, `transcript_omits`, `command_matching`, `no_command_matching`, `file_exists`, and `file_absent`. `command_succeeds` is excluded deliberately: it would make the generator author a verification program, and a wrong verifier silently corrupts the score in both arms. The other kinds are declarative and inspectable at a glance. A generated case may not carry a `fixture`, because there is no fixture tree for it to point at, so it seeds its sandbox with inline `files` and `setup` alone. Names must be lowercase and hyphenated, and unique."
  },
  {
    "file": "docs/evaluating/generated-evals.md",
    "line": 70,
    "policy": "prose",
    "pattern": "Before anything is written, every generated case is seeded once in a throwaway sandbox, exactly as an arm would seed it, with no skill staged: the `files` keys go through the same path guard, and `setup` is actually executed under `/bin/sh -ce`. That is the only way to catch prose in `setup`, because prose is valid shell. \"Assume codex is logged in\" runs a program named `Assume`, exits 127, and would have silently dropped the case at run time."
  },
  {
    "file": "docs/evaluating/generated-evals.md",
    "line": 88,
    "policy": "prose",
    "pattern": "The model never writes shell that runs against an arm. The engine composes the suite's `setup` itself, and that setup is the suite's own self-check:"
  },
  {
    "file": "docs/evaluating/generated-evals.md",
    "line": 98,
    "policy": "prose",
    "pattern": "The clean base is committed without the probes and without the patch, every probe has to pass against it, the patch is applied, every probe has to fail after it, and both are deleted. An arm therefore opens on a repository whose only uncommitted change is the planted diff, with no probe and no patch left in the tree to read. A probe that disagrees with the diff makes `setup` exit non-zero, which drops the whole suite as `  suite: ABORTED (setup) — setup failed (rc=1): ...` and scores nothing, rather than scoring both arms against a defect that is not there."
  },
  {
    "file": "docs/evaluating/generated-evals.md",
    "line": 100,
    "policy": "prose",
    "pattern": "Four things happen before a generated suite is written anywhere. The patch is checked with `git apply --check` against the files in a throwaway directory, and a patch that does not apply comes back as `plants_diff does not apply (rc=1): ...`, carrying git's own reason. The suite is materialized: the probes become `.probes/<name>.sh` and the patch becomes `.plants.diff` inside `files`, the engine's `setup` is added, `timeout_minutes: 120` and `requires: []` are set, and each row is reduced to its `name` and `checks`, so `kind` and `probe` do not reach the file. The result is loaded through the same loader an authored `evals/suite.yaml` goes through. Then the whole setup is run once in a throwaway sandbox, and a failure is reported as `generated suite dry run failed: ...`. Each of those is a correction the model gets a chance to fix."
  },
  {
    "file": "docs/evaluating/generated-evals.md",
    "line": 117,
    "policy": "prose",
    "pattern": "# generated by terum-skills eval-gen — review before trusting"
  },
  {
    "file": "docs/evaluating/generated-evals.md",
    "line": 145,
    "policy": "prose",
    "pattern": "Before the write-back, the generated files go through the HYG2 and HYG3 predicates with the folder's own author exemption, which is the same rule the next `validate`, `publish`, or `eval` will apply to them. A finding aborts and writes nothing:"
  },
  {
    "file": "docs/evaluating/generated-evals.md",
    "line": 171,
    "policy": "prose",
    "pattern": "To regenerate, delete the asset and run `eval` again. Deleting `evals/cases/` or `evals/suite.yaml` regenerates the execution assets, and the shape is chosen again on that run, so cases can come back as a suite. Deleting `evals/triggers.yaml` regenerates the triggers."
  },
  {
    "file": "docs/evaluating/generated-evals.md",
    "line": 175,
    "policy": "prose",
    "pattern": "Before it writes, `eval` prints this:"
  },
  {
    "file": "docs/evaluating/generated-evals.md",
    "line": 197,
    "policy": "prose",
    "pattern": "eval assets: cases: generated (4) · triggers: generated"
  },
  {
    "file": "docs/evaluating/generated-evals.md",
    "line": 206,
    "policy": "prose",
    "pattern": "eval assets: cases: generated suite · triggers: generated"
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 11,
    "policy": "prose",
    "pattern": "| HYG1 | `SKILL.md` frontmatter against a strict schema, then `name` against the folder name, then `allowed-tools`. | Error | Make the frontmatter parse, and match `name:` to the folder. The message names the allowed top-level fields and, for a bad grant, the line. `skill fix` sets `name:` for you. |"
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 12,
    "policy": "prose",
    "pattern": "| HYG2 | Every decoded text file, for a bidi control or zero-width character, and for a whitespace-delimited token that mixes Unicode scripts. | Error | Delete the invisible character, or rewrite the mixed-script token. `skill fix` strips the invisible set; a mixed-script token is yours to rewrite. |"
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 14,
    "policy": "prose",
    "pattern": "| HYG4 | Every file, for an executable mode bit, a leading `#!`, and an extension outside the allowlist. | Error | Clear the mode bit, drop the shebang, or rename the file to an allowlisted extension. `skill fix` clears the bit on a file that is not a script. |"
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 15,
    "policy": "prose",
    "pattern": "| HYG5 | The declared `license`, the team's `policy.skill_license`, and any bundled `LICENSE*` file. | Error | Make the licenses that are present agree. `skill fix` rewrites `license:` to the team policy. |"
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 24,
    "policy": "prose",
    "pattern": "`eval` and `skill fix` run a lenient variant in which `license` and the three managed `metadata` fields are optional, because a folder that has never been published legitimately carries none of them. Every other clause still applies: no unknown top-level key, the folder name must equal `name`, and the grant must parse."
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 78,
    "policy": "prose",
    "pattern": "Separately, a file with an executable mode bit, or one whose first two characters are `#!`, fails. `.sh` and `.py` are allowlisted as content, but the executable form is the signal, not the language: a `.sh` file with a shebang still fails. `publish` waives the mode-bit and shebang findings and carries the bytes and the mode to the team. `validate`, `eval`, and `skill fix` never waive them, so the same folder that publishes can still fail `validate`."
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 94,
    "policy": "prose",
    "pattern": "A `metadata.terum-category` that is not in the team's list, compared case-insensitively, produces a warning. It fires only when a category list is actually supplied, which is only at `publish`, where the team's `team.json` is in hand. `validate` and `eval` supply none, so HYG7 never fires there. The CLI help for `validate` says so in as many words."
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 106,
    "policy": "prose",
    "pattern": "The count is the staged paths plus the ones skipped for size. Paths that resolve nowhere are reported separately by `eval` and are not counted here. The fix is to move the file into the skill folder, so an installed copy carries its own method."
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 108,
    "policy": "prose",
    "pattern": "## `validate`"
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 111,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest validate <path|name>"
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 114,
    "policy": "prose",
    "pattern": "Deterministic and offline. It runs the same gate the other callers run, and it also plans the repairs `skill fix` would make. That plan is returned to the app, which draws its Fix control from the count; the terminal prints the findings only."
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 151,
    "policy": "prose",
    "pattern": "`validate` without `--cwd` needs a configured team, because it reads `policy.skill_license` from your team clone. On a machine with no team it fails with the get-started lines instead. Pass `--cwd <checkout>` to validate against a checkout directly."
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 153,
    "policy": "prose",
    "pattern": "A folder that has never been published fails HYG1 on the managed fields. `validate` uses the strict schema, which requires `license`, `metadata.id`, `metadata.author`, and `metadata.terum-category`. Those four are written by `publish` when it injects managed fields, so a fresh local folder does not have them yet. `eval` runs the same gate with those four optional, which is why an unpublished folder can be evaluated but not validated."
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 155,
    "policy": "prose",
    "pattern": "## `skill fix`"
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 158,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest skill fix <path>"
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 197,
    "policy": "prose",
    "pattern": "| `validate` | The folder on disk | Required | Never waived | None, so HYG7 cannot fire |"
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 198,
    "policy": "prose",
    "pattern": "| `eval` | The local folder exactly as it is | Optional | Never waived | None, so HYG7 cannot fire |"
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 199,
    "policy": "prose",
    "pattern": "| `publish` | The map after managed fields are injected | Required | Waived | The team's, so HYG7 fires here and only here |"
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 200,
    "policy": "prose",
    "pattern": "| `skill fix` | The folder after its repairs | Optional | Never waived | None |"
  },
  {
    "file": "docs/evaluating/hygiene.md",
    "line": 202,
    "policy": "prose",
    "pattern": "`eval` runs one more pass that is not a folder gate. When it generates eval assets, the generated bytes go through the HYG2 and HYG3 predicates alone, with the folder's own author exemption, before they are written. Every path it is about to write is inspected: `evals/triggers.yaml`, `evals/suite.yaml`, and each `evals/cases/<name>.yaml`. A finding there aborts the run without writing anything:"
  },
  {
    "file": "docs/evaluating/overview.md",
    "line": 10,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest eval <skill>"
  },
  {
    "file": "docs/evaluating/overview.md",
    "line": 130,
    "policy": "prose",
    "pattern": "Run an eval before you publish. `publish` reads the local receipts taken of the exact bytes it is about to publish, and if the newest of them is FAIL it asks:"
  },
  {
    "file": "docs/evaluating/overview.md",
    "line": 151,
    "policy": "prose",
    "pattern": "On Windows that is `%USERPROFILE%\\.terum\\skills\\evals\\local\\…`. Transcripts and sandboxes are kept for inspection and are never cleaned up by `eval`."
  },
  {
    "file": "docs/evaluating/overview.md",
    "line": 153,
    "policy": "prose",
    "pattern": "A receipt reaches the team in one of two ways. If the bytes you evaluated are already exactly a published version, `eval` commits the receipt itself to `evals/<skill id>/v<N>/<run id>.json` and prints `Published this receipt to <team> for Version N of <skill>.` If they are not, it prints the share hint instead, and the receipt travels the next time you publish: `publish` attaches every local receipt taken of the published bytes. `--no-commit` keeps a receipt on your machine either way."
  },
  {
    "file": "docs/evaluating/overview.md",
    "line": 159,
    "policy": "prose",
    "pattern": "A skill that launches subagents costs a full session per case, and ten planted defects as ten cases cost ten sessions per arm. A suite is the answer: `evals/suite.yaml` holds one task, one sandbox, and many named sub-cases, and the engine runs exactly one session per arm and scores every sub-case against that one transcript. Ten defects then cost one session and still produce ten independently decided rows. A suite is authored by you or written by the run's own generator, no suite row is ever judged, and any receipt containing suite rows has its sign test pinned at 1.0. When the folder's static scan sees a skill that names the `Task`, `Agent`, or `Workflow` tools or runs `codex exec` or `claude -p`, `eval` prints the evidence and asks `Use the one-session heavy evaluation mode?`; the answer is recorded in the local run record, and the one-session mode itself is selected by whether the run has a suite at all, authored in the folder or generated by this run. See [test assets](test-assets.md) for the file format, [generated evals](generated-evals.md#suites) for what a generated one contains, and the worked example in this repository."
  },
  {
    "file": "docs/evaluating/overview.md",
    "line": 191,
    "policy": "prose",
    "pattern": "- [Hygiene checks](hygiene.md) for the eight gates and `validate`."
  },
  {
    "file": "docs/evaluating/results-and-receipts.md",
    "line": 52,
    "policy": "fixed",
    "pattern": "These bytes are not a published version, so nothing was shared. To share these results, publish the skill again: npx -y terum-skills@latest publish deploy-check"
  },
  {
    "file": "docs/evaluating/results-and-receipts.md",
    "line": 58,
    "policy": "fixed",
    "pattern": "This run's verdict is FAIL: evaluate a fix rather than publishing these bytes — npx -y terum-skills@latest publish deploy-check asks before it publishes a failed verdict."
  },
  {
    "file": "docs/evaluating/results-and-receipts.md",
    "line": 175,
    "policy": "prose",
    "pattern": "case that never started is in `dropped_cases` with `setup` or `staging` and a detail; a dead arm"
  },
  {
    "file": "docs/evaluating/results-and-receipts.md",
    "line": 211,
    "policy": "prose",
    "pattern": "| `engine_version` | The running terum-skills package version. |"
  },
  {
    "file": "docs/evaluating/results-and-receipts.md",
    "line": 319,
    "policy": "prose",
    "pattern": "## Reading receipts back: `eval-report`"
  },
  {
    "file": "docs/evaluating/results-and-receipts.md",
    "line": 322,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest eval-report <skill> [--team <team>]"
  },
  {
    "file": "docs/evaluating/results-and-receipts.md",
    "line": 349,
    "policy": "prose",
    "pattern": "The terminal output of `eval-report` is the warnings only. The structured value is what the app and"
  },
  {
    "file": "docs/evaluating/results-and-receipts.md",
    "line": 383,
    "policy": "prose",
    "pattern": "into the repo; your next `sync` (or any verb that refreshes the clone, or the app's background fetch"
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 9,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest eval <skill-or-path>"
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 20,
    "policy": "prose",
    "pattern": "`%USERPROFILE%\\.claude\\skills` on Windows) plus every project registered with `project add`. A path"
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 31,
    "policy": "prose",
    "pattern": "`~/code/deploy-check` is not a skill folder in your library (~/.claude/skills or an added project's .claude/skills); add the project holding it with `project add`, or install it from the marketplace first."
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 45,
    "policy": "fixed",
    "pattern": "This machine is configured for teams a, b; Terum Skills keeps one team per machine. Run `npx -y terum-skills@latest team leave <name>` for each you no longer want; until then name one with --team."
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 56,
    "policy": "prose",
    "pattern": "The folder as it sits on disk goes through the same deterministic hygiene checks `validate` runs,"
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 101,
    "policy": "prose",
    "pattern": "usage runs out, it is marked unscored and must be run again."
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 198,
    "policy": "prose",
    "pattern": "3. Run the case's `setup` under `/bin/sh -ce` in the sandbox, killed at 60 seconds. A non-zero exit"
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 248,
    "policy": "prose",
    "pattern": "| A case's `setup` hook | 60 seconds, then SIGKILL |"
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 322,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest eval deploy-check hybrid-review handoff"
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 363,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest eval deploy-check hybrid-review --window overnight"
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 367,
    "policy": "fixed",
    "pattern": "Queued 2 evals for overnight: the app runs them in parallel between 01:00 and 05:00 while it is open and idle. Run them now with `npx -y terum-skills@latest eval --drain`."
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 373,
    "policy": "fixed",
    "pattern": "Queued 2 evals for later. Run them with `npx -y terum-skills@latest eval --drain`."
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 400,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest eval --queue-list"
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 401,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest eval --drain"
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 402,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest eval --drain --window overnight --max 3 --parallel 2"
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 403,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest eval --dequeue deploy-check"
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 436,
    "policy": "prose",
    "pattern": "someone runs `eval --drain`."
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 451,
    "policy": "prose",
    "pattern": "Waiting for another terum-skills operation on myteam to finish… (12 s)"
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 457,
    "policy": "prose",
    "pattern": "Another terum-skills operation holds the write lock on myteam; retry when it finishes."
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 469,
    "policy": "prose",
    "pattern": "Another terum-skills drain is already running; wait for it to finish or stop it."
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 494,
    "policy": "prose",
    "pattern": "| **Run eval** | `eval [--k n] [--model m] [--judge-model j] [--team t] -- <ref>` |"
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 495,
    "policy": "prose",
    "pattern": "| **Queue for overnight** | `eval [--k n] [--model m] [--judge-model j] [--team t] --window overnight -- <ref>` |"
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 502,
    "policy": "prose",
    "pattern": "`eval [flags] [--team t] [--batch n | --window overnight] [--pending] -- <skill>…` and shows the"
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 533,
    "policy": "prose",
    "pattern": "| `Another terum-skills operation holds the write lock on <team>; retry when it finishes.` | Another write verb holds the clone. |"
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 534,
    "policy": "prose",
    "pattern": "| `Another terum-skills drain is already running; wait for it to finish or stop it.` | A second `--drain`. |"
  },
  {
    "file": "docs/evaluating/running-evals.md",
    "line": 536,
    "policy": "prose",
    "pattern": "| `Provide a skill (or several), --pending, --queue-list, --drain, or --dequeue.` | `eval` with nothing to act on. |"
  },
  {
    "file": "docs/evaluating/test-assets.md",
    "line": 37,
    "policy": "prose",
    "pattern": "| `files` | map of path to string | No | Inline files written into the sandbox before `setup`. Must be a map. Values are coerced to strings. |"
  },
  {
    "file": "docs/evaluating/test-assets.md",
    "line": 39,
    "policy": "prose",
    "pattern": "| `setup` | string | No | POSIX shell run by `/bin/sh -ce` in the sandbox, after `files` and before the skill is staged. 60 second cap. A non-zero exit drops the case. |"
  },
  {
    "file": "docs/evaluating/test-assets.md",
    "line": 128,
    "policy": "prose",
    "pattern": "A suite is authored by hand or written by the generator. `eval` generates one when the folder holds no execution asset at all and the generator judges the skill measurable against a planted ground truth; `metadata.eval.shape: suite` in your frontmatter demands that shape, and no flag asks for one. A generated suite is written in the format below, with `timeout_minutes: 120`, `requires: []`, and a `setup` the engine composes rather than the model. See [generated evals](generated-evals.md#suites)."
  },
  {
    "file": "docs/evaluating/test-assets.md",
    "line": 139,
    "policy": "prose",
    "pattern": "A sub-case carrying any of `judge`, `task`, `files`, `fixture`, `setup`, or `bucket` is refused by name, for example `suite 'suite': sub-case must not carry 'judge'`. Everything a sub-case would need from those fields belongs to the shared session."
  },
  {
    "file": "docs/evaluating/test-assets.md",
    "line": 197,
    "policy": "prose",
    "pattern": "The `setup` line is the interesting part. It commits the clean base with the patch file excluded by pathspec, applies the patch as uncommitted working-tree edits, and deletes the patch. When the agent starts, `git diff` in the sandbox is exactly the planted defects, and the patch is in neither the commit, the index, nor the worktree. The sub-case names, which are the answer key, live in `evals/`, which is never staged."
  },
  {
    "file": "docs/evaluating/usage.md",
    "line": 3,
    "policy": "prose",
    "pattern": "An eval tells you whether a skill helps when it runs. `usage` tells you whether it runs at all, and"
  },
  {
    "file": "docs/evaluating/usage.md",
    "line": 7,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest usage [skill] [--since <iso>] [--all] [--json]"
  },
  {
    "file": "docs/evaluating/usage.md",
    "line": 172,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest usage handoff"
  },
  {
    "file": "docs/evaluating/usage.md",
    "line": 184,
    "policy": "prose",
    "pattern": "unreadable transcripts) and `usedArchive`. Every row carries `skill`, `label`, `d1`, `d2`,"
  },
  {
    "file": "docs/evaluating/usage.md",
    "line": 205,
    "policy": "prose",
    "pattern": "That is what `misses` separates. It harvests the prompts you actually typed out of the same"
  },
  {
    "file": "docs/evaluating/usage.md",
    "line": 208,
    "policy": "prose",
    "pattern": "reasons: it spends model calls, and `usage` promises it makes none, which is what lets the app run"
  },
  {
    "file": "docs/evaluating/usage.md",
    "line": 209,
    "policy": "prose",
    "pattern": "`usage` on every skill page."
  },
  {
    "file": "docs/evaluating/usage.md",
    "line": 212,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest misses [skill] [--since <iso>] [--limit <n>] [--json]"
  },
  {
    "file": "docs/evaluating/usage.md",
    "line": 220,
    "policy": "prose",
    "pattern": "A skill's **Activity** tab draws these counts and only these counts. It runs `usage --json` once,"
  },
  {
    "file": "docs/evaluating/usage.md",
    "line": 221,
    "policy": "prose",
    "pattern": "with no skill argument, and filters client-side: `usage <skill>` costs the same whole-corpus scan as"
  },
  {
    "file": "docs/evaluating/usage.md",
    "line": 236,
    "policy": "prose",
    "pattern": "The CLI's two caveats are repeated underneath, verbatim. On a terum-skills version that cannot report"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 1,
    "policy": "prose",
    "pattern": "# Frame mode: driving terum-skills from a program"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 3,
    "policy": "prose",
    "pattern": "`terum-skills --frames <verb> [options]` runs any verb with a program, not a person, on the other end. Every line the CLI writes to stdout is one JSON object (a frame); every line it reads from stdin is one JSON object. Nothing else is on stdout. Diagnostics about the channel itself go to stderr. Without `--frames`, nothing changes."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 7,
    "policy": "prose",
    "pattern": "The flag is position-independent before the first `--` (`--frames status` and `status --frames` are the same) and is removed before the verb's own options are parsed."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 18,
    "policy": "prose",
    "pattern": "| `progress` | `{\"t\":\"progress\",\"step\":\"...\",\"current\":n,\"total\":n,\"item\":\"...\"}` | Coarse step reporting for a long verb. `install`, `publish` and eval batches (including setup’s `evals` step) emit it. `step` names the step (`evals`, `install`'s four phases, or `publish`'s five: refresh, category, check, publish, profile, of which the category rung is skipped when the folder already declares one or `--category` was passed); `current` counts what is done so far and `total` appears only when the verb knows it. `item` names the skill the rung is about when a verb works through several — `publish <ref...>` with two or more refs emits it — and is absent for a verb doing one thing; a shell driving one process for a whole selection needs it to know which row a rung belongs to, and inferring by order is wrong the moment an item is skipped. `features.progress` is `true`. Never required, never ordered against `ask`; a shell that ignores it is unaffected. |"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 19,
    "policy": "prose",
    "pattern": "| `result` | `{\"t\":\"result\",\"verb\":\"install\",\"ok\":true,\"exitCode\":0,\"value\":{...}}` | Always last. `verb` is the invoked verb. `value` is the verb's own result object when it has one. A failing result may also carry `value`, the verb's partial result (for example, `eval` after a partially failed queue drain). On failure: `ok:false`, `exitCode:1`, `error` is the one-line message, and `declined:true` when set by the CLI's typed decline (the person said no) rather than by matching the error text, and `refused:true` when the CLI refused the operation before any side effect (one team per machine); a refusal is not a decline. After `result` the CLI stops reading stdin and exits. |"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 23,
    "policy": "prose",
    "pattern": "`--format` (the Markdown / terminal / JSON boards of `README.md`) and `--frames` are exclusive: a run given both ends in one `result` frame with the error `--frames is already a machine format; drop --format.` and exit 1. `serve` refuses `--format` on stderr too (`serve answers over --frames; drop --format.`). A usage error (unknown verb, missing argument, bad option value) under any `--format` writes nothing to stdout — one stderr message and exit 1, nothing runs; a reader that sees exit 1 with empty stdout reads stderr."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 36,
    "policy": "prose",
    "pattern": "1. **The `gh auth login` offer never arrives over frames.** When `gh` is installed but logged out, the CLI in frame mode prints `GitHub CLI is installed but logged out. Run \\`gh auth login\\` in a terminal, then try again.` instead of asking (it would otherwise hand its stdio to `gh`, which here means the frame pipes). Likewise `setup` never asks the desktop-app opt-in question over frames. If a shell ever does see that confirm, the CLI is older than 0.1.6: answer `false`."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 37,
    "policy": "prose",
    "pattern": "2. **Never use `sync --hook` over frames.** Its stdout is the Claude Code reload directive, not frames; the CLI refuses it with a `result` frame and exit 1. Call plain `sync` for both foreground and background use: it fetches and changes nothing on this machine (see `f-sync`)."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 39,
    "policy": "prose",
    "pattern": "4. **`cwd` is advisory; every write names its destination.** `install` asks `Install to` (or takes `--into`), `sync` fetches every team clone from any cwd, `uninstall-skill` takes `--from`."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 40,
    "policy": "prose",
    "pattern": "5. **`uninstall`: the consent inventory is the confirm's detail.** Render `ask.detail` verbatim in the danger dialog; answer false to cancel. Its result includes cleanup outcomes, `kept`, `record`, and CLI-generated `advice`."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 43,
    "policy": "prose",
    "pattern": "## Read sessions (`serve`)"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 45,
    "policy": "prose",
    "pattern": "`terum-skills --frames serve` starts one stdio session, advertising `features.serve: true`"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 46,
    "policy": "prose",
    "pattern": "in its single `hello`. Without `--frames`, `serve` immediately fails"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 47,
    "policy": "prose",
    "pattern": "with the error `serve requires --frames` and exits 1. This is an app-owned child, not a"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 53,
    "policy": "prose",
    "pattern": "{\"t\":\"request\",\"id\":\"r7\",\"argv\":[\"status\",\"--team\",\"acme\"],\"cwd\":\"/some/path\"}"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 62,
    "policy": "prose",
    "pattern": "Only `status`, `ls`, `eval-report`, `search`, `validate`, `update`, and `usage` are accepted. Any"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 63,
    "policy": "prose",
    "pattern": "other verb gets `ok:false` with `serve does not run <verb>; spawn it as its own process`, without"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 65,
    "policy": "prose",
    "pattern": "(including `update`'s release-advertisement probe and local release-state maintenance). Six of the"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 66,
    "policy": "prose",
    "pattern": "seven write nothing. `usage` is the one deliberate exception: it appends the firings it scanned to"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 74,
    "policy": "prose",
    "pattern": "one-shot protocol states that `serve` deliberately breaks.** Rule 6 (\"one run per verb\")"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 75,
    "policy": "prose",
    "pattern": "continues to hold for every verb except `serve` itself."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 93,
    "policy": "prose",
    "pattern": "< {\"t\":\"request\",\"id\":\"r1\",\"argv\":[\"status\"]}"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 94,
    "policy": "prose",
    "pattern": "< {\"t\":\"request\",\"id\":\"r2\",\"argv\":[\"ls\",\"--local\"],\"cwd\":\"/work/acme\"}"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 95,
    "policy": "prose",
    "pattern": "> {\"t\":\"print\",\"id\":\"r1\",\"level\":\"info\",\"line\":\"terum-skills 0.14.0\"}"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 98,
    "policy": "prose",
    "pattern": "< {\"t\":\"request\",\"id\":\"r3\",\"argv\":[\"install\",\"example\"]}"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 116,
    "policy": "prose",
    "pattern": "$ printf '' | terum-skills --frames status"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 118,
    "policy": "prose",
    "pattern": "{\"t\":\"print\",\"level\":\"info\",\"line\":\"terum-skills 0.14.0\"}"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 124,
    "policy": "prose",
    "pattern": "An `install` whose tool grants are declined:"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 193,
    "policy": "prose",
    "pattern": "`team migrate` is registered but terminal-only: under `--frames` it fails before doing any work and tells the"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 195,
    "policy": "prose",
    "pattern": "command: use `sync`. Neither belongs in the advertised verb list."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 197,
    "policy": "prose",
    "pattern": "`hello.features` names `libraryProjects`, `projectRename`, `projects`, `memberRole`, `localIdentity`, `roles`, `favorites`, `follow`, `lastSeen`, `installScope`, `inviteScoping`, `disablePerMachine`, `projectMembers`, `liftOnCards`, `runEvalInApp`, `perCase`, `progress`, `refresh`, `appUpdate`, `reconcile`, `serve`, `usage`, and `misses`."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 201,
    "policy": "prose",
    "pattern": "`reconcile`, `serve`, `usage`."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 206,
    "policy": "prose",
    "pattern": "`libraryProjects` is the explicit local registry (`project add`, `project remove`, `project list`), and `projectRename` its `project rename`;"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 207,
    "policy": "prose",
    "pattern": "`projects` is team grouping (`team project create`). `memberRole` is the owner-written job label;"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 208,
    "policy": "prose",
    "pattern": "`roles` supports GitHub Admin/Member permissions from `status --permissions` (otherwise unknown)."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 209,
    "policy": "prose",
    "pattern": "`installScope` supports destinations and destination-aware removal. `appUpdate` and `serve`"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 210,
    "policy": "prose",
    "pattern": "advertise their respective verbs. `reconcile` gates the Library's Sync action, which runs the fetch-only `sync` and then `reconcile --list`."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 227,
    "policy": "prose",
    "pattern": "Team `ls` includes `people` with automatic `installed` records and curated `profile` entries."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 229,
    "policy": "prose",
    "pattern": "`ls` also carries `viewer: { handle, team }` on every team read and, on `ls member`, `ls project` and `ls skill`, a `selection` (`{ kind: 'member', handle }`, `{ kind: 'project', name }`, `{ kind: 'skill', name, source: 'team' | 'library' }`); `ls skill <name>` is the one-skill read — `skills` holds the team record (or nothing), `local` the Library row (or nothing), `projects` only the lists holding it. `member` gained `displayName`, per-install `name`/`version`, and `profile`; `installedBy` rows gained `version`. Additive; protocol stays 1."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 247,
    "policy": "prose",
    "pattern": "`install <ref> [--into global|<project root>]` installs the highest numbered version in the clone,"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 248,
    "policy": "prose",
    "pattern": "including its eval assets. `install member <handle>` and `install project <name>` use the same"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 250,
    "policy": "prose",
    "pattern": "is refused with a `project add` hint; install never registers a root itself."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 274,
    "policy": "prose",
    "pattern": "`install --adopt <path> [--team <team>]` records a direct child of the Global Library or a registered"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 275,
    "policy": "prose",
    "pattern": "project as installed when its bytes equal exactly one published version in the selected team and its folder"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 281,
    "policy": "prose",
    "pattern": "`reconcile --list [--team <team>]` scans unrecorded Library folders once and returns"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 284,
    "policy": "prose",
    "pattern": "renamed rows carry `version` and `teamName` and are reported only. Running `reconcile` without `--list` asks"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 288,
    "policy": "prose",
    "pattern": "`publish <ref> [--project <name>] [--category <name>]` resolves a local Library folder, checks"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 292,
    "policy": "prose",
    "pattern": "publish has no project select. A local FAIL receipt can trigger a confirm; there is no"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 293,
    "policy": "prose",
    "pattern": "unconditional publish confirmation. `project` in the result is the named project or `null`."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 298,
    "policy": "prose",
    "pattern": "`publish <ref...>` with **two or more** refs publishes the selection in one run: one refresh, every"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 301,
    "policy": "prose",
    "pattern": "profile entry rides in that skill's own commit rather than following as a second write, so"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 322,
    "policy": "prose",
    "pattern": "`skill move <path> --to global|<project root>`, `skill copy <path> --to global|<project root>`,"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 323,
    "policy": "prose",
    "pattern": "`skill rename <path> --to <new-name>`, and"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 324,
    "policy": "prose",
    "pattern": "`skill delete <path>` are one-shot frame writes. Only `skill delete` asks: its `text` ask is"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 336,
    "policy": "prose",
    "pattern": "`skill disable <path>` / `skill enable <path>` are one-shot frame writes with no ask. They are the"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 338,
    "policy": "prose",
    "pattern": "and the app draws no switch): `disable` writes `\"off\"` for the"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 340,
    "policy": "prose",
    "pattern": "`enable` removes that `\"off\"` (never a `name-only` or `user-invocable-only` a person set by hand). A folder under"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 344,
    "policy": "prose",
    "pattern": "so. Every `ls --local` row, and every `notOffered` entry (a symlinked or half-broken folder Claude Code still"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 346,
    "policy": "prose",
    "pattern": "the switch belongs to any folder under a skills root, placed by Terum or not. `skill delete` drops the folder's"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 347,
    "policy": "prose",
    "pattern": "`\"off\"` the way `uninstall-skill` does, and `skill rename` / `skill move` carry it to the new name or the new"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 350,
    "policy": "prose",
    "pattern": "`skill fix <path>` is a one-shot frame write with no ask. It applies every repair whose outcome is"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 352,
    "policy": "prose",
    "pattern": "(the `ls --local` `invalid-yaml` reason), setting `name` to the folder name, setting `license` to the"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 353,
    "policy": "prose",
    "pattern": "team policy, removing HYG2's invisible characters, and clearing an executable mode on a non-script."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 354,
    "policy": "prose",
    "pattern": "It then runs the same inspection and hygiene gate as `ls --local` and `validate` and prints what still"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 358,
    "policy": "prose",
    "pattern": "three, and `validate`'s result carries `repairs`, one sentence per change `skill fix` would make, and"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 361,
    "policy": "prose",
    "pattern": "`skill category <path> --to <name>` is a one-shot frame write with no ask. It rewrites"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 367,
    "policy": "prose",
    "pattern": "category inside that version's immutable files), and print the `publish` that would mint the next"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 372,
    "policy": "prose",
    "pattern": "`prune` lists quarantine paths and asks `Delete <n> quarantined item(s)?`; empty quarantine asks"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 375,
    "policy": "prose",
    "pattern": "Neither `skill` nor `project` is in `SERVE_READ_VERBS`: serve gates on the first argv token, so"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 376,
    "policy": "prose",
    "pattern": "even `project list` needs its own process. The seven accepted verbs are unchanged."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 378,
    "policy": "prose",
    "pattern": "## What `status` reports about this machine"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 380,
    "policy": "prose",
    "pattern": "`status`'s result carries two architecture fields, on success and on a failing read alike:"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 399,
    "policy": "prose",
    "pattern": "`app` reports the same condition as `emulation`, either `\"win32-arm64-on-x64\"` or `null`, and prints one"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 407,
    "policy": "prose",
    "pattern": "`eval-report <skill> [--team <team>]` is read-only: it reads the local clone and this machine's run tree without fetching, networking, or prompting. `result.value` is an `EvalReport`:"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 414,
    "policy": "prose",
    "pattern": "`eval`'s own result (`EvalResult`) gained `report: { aggregate, triggers }` — the numbers `renderReport` prints, as data — and `receiptPath` on a completed run; `eval --drain` gained `outcomes: { skill, team?, ok, error? }[]`, one per attempted item in queue order. `validate` gained `directory`, the folder it checked. Additive; protocol stays 1."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 416,
    "policy": "prose",
    "pattern": "`sync [--team <team>]` fetches and resets the disposable clone under its writer lock and records"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 420,
    "policy": "prose",
    "pattern": "`project add [path]` · `project remove <path>` · `project list` · `project rename <path> --to <name>` are the Library's local project registry. `add` asks `Which folder?` as a `path` ask when no argument is given (default: the nearest git repository above the cwd) and returns `{ path, label, added, parent, reconcile? }`; after a newly added project it scans only that project, and frame mode carries the non-writing reconcile result so the shell can open a dialog only when it is non-empty. `remove` returns `{ path, placementsRemaining, subProjectsRemaining }` and forgets the path only, so nothing on disk changes; `list` returns `{ projects: { path, label, parent, rootState, skillFolders }[] }` in tree order; `rename` returns `{ path, label, previous }` and changes display text only, never the folder. A project registered inside another registered project is its sub-project: `parent` is that project's root (null at the top level), read off the paths on every call so the tree always matches the folder structure, and every `ls --local` project section carries the same `parent`. A sub-project's derived label is its path inside the parent (`apps/web`); a renamed label is kept as typed until renamed again, and the derived labels move out of its way. A project is added only by an explicit act: no verb registers one as a side effect, and `install --into <path>` refuses a path that is not already a project rather than adding it."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 424,
    "policy": "prose",
    "pattern": "`app-update --check` (the default) reads the cached release advertisement and local staged/installed versions, and keeps that advertisement fresh by itself: when the last probe is missing or a day old it probes release tags under the same GitHub-team policy and 10 s deadline as `update` (`probe: 'ok' | 'failed'`, at most once a day), otherwise it serves the cache (`probe: 'cached'`, or `'failed'` while the day's attempt failed). `--check --force` probes regardless of the cap. A check never touches the app or the CLI; its only write is the CLI's own release state in `run/latest-version.json` (the advertisement, the attempt, and the running observation every `sync` used to record). Checks always succeed, reporting probe failures as data. Until 0.15.0 the check was read-only and the advertisement was filled by the old sync; after the fetch-only sync collapse (§10) nothing on the app's path probed, so the app could never learn about a newer version by itself. The check owns the probe now."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 426,
    "policy": "prose",
    "pattern": "`app-update --stage [--release <version>]` downloads the selected release through `gh`, verifies its published SHA-256, and stages it without installing. The default release is this CLI's version. An advertised tag with missing release assets returns `ok: true, notPublished: true, staged: false`; the shell stays quiet and retries on the next launch."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 428,
    "policy": "prose",
    "pattern": "`app-update --apply [--release <version>] [--reason on-close|overnight|manual]` hands a staged install to a detached process. The public result values are:"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 448,
    "policy": "prose",
    "pattern": "`app-update --apply` returns as soon as the background installer process exists. The shell must then quit; it is the shell's job to quit and the CLI never kills it. `--apply` watches the CLI's parent process only in frame mode, where that parent is the shell itself; from a terminal it installs immediately."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 454,
    "policy": "prose",
    "pattern": "`ls` skill rows add `frontmatter: string | null` beside `body`; `ls --local` rows and `notOffered` entries also include the raw fenced frontmatter when readable (otherwise null), without adding body text to local inventory; key order, quoting, and internal line endings are preserved, and older CLIs may omit the field."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 457,
    "policy": "prose",
    "pattern": "`app-update --reason on-close|overnight|manual` records the install reason in every apply marker and forwards it from `--apply` to `--apply-now`. Omission remains compatible with old callers and displays the manual wording. No CLI verb or feature key is added."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 459,
    "policy": "prose",
    "pattern": "The desktop checks once at launch; that check refreshes the advertisement at most once a day (App updates above) and displays the advertised version in its top-bar update chip. Settings ▸ Updates uses `updates:app:policy`: `ask` (manual download/install), `on-close` (the default), or `overnight` (01:00–05:00 local after 30 idle minutes). The old boolean migrates once: false → ask, true → on-close. Successful install markers display “Updated to {version}”, adding “when you quit” or “overnight”; `updates:app:lastShown` acknowledges the marker across launches while the current session retains it. Failure markers remain visible. Settings ▸ Updates also carries a one-shot `Update and relaunch` row: it runs `app-update --check --force`, then `--stage` for the advertised build when it is newer and not yet staged, then the same confirmation dialog and `--apply --reason manual` followed by quit. A failed probe is reported as unreachable rather than as up to date, and the launch hook's automatic policy skips a version the row already started downloading in this session."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 461,
    "policy": "prose",
    "pattern": "Native-command amendment: `app_update_on_close({ version: string | null })` arms or disarms one detached installer. This additional command is necessary because the installer must outlive the WebView. The base actually has six commands including `quit`, so this is its seventh (the original decision's “five” count predates `quit`). On the last window's CloseRequested or ExitRequested, the shell consumes the arm once and invokes the recorded Node/CLI with `app-update --apply-now --release <version> --reason on-close`, plus `--await-pid <shell-pid>` to preserve the CLI's Windows wait. It uses a new process group on macOS and CREATE_NO_WINDOW | DETACHED_PROCESS on Windows and stays outside the bridge's child cleanup. The command follows the existing application-command registration, without a separate app ACL permission. Before spawning, the shell writes a waiting marker; a spawn failure replaces it with a failed marker. A child that dies before executing the CLI leaves the waiting marker visible as an unfinished install on the next launch. An unwritable marker is logged without preventing close. A manual or overnight handoff first disarms the close action to prevent two installers; a failed handoff restores the previous arm unless the policy changed in the meantime."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 469,
    "policy": "prose",
    "pattern": "`eval --queue-list` returns `{ items }`, where each item has `skill`, `path`, `contentHash`, `requestedAt`, optional `team`,"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 470,
    "policy": "prose",
    "pattern": "`window: \"overnight\" | \"later\"`, and an optional `lastError`. `eval --dequeue <team>/<skill>` removes all queued"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 474,
    "policy": "prose",
    "pattern": "`eval --drain [--parallel n] [--window overnight] [--max n]` returns `{ items, attempted, completed, failures }`."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 482,
    "policy": "prose",
    "pattern": "`eval <skill> <skill>… [--parallel n] [--batch n] [--window overnight|later] [--pending]` (past setup, 2026-09-13) runs the wizard's Now / In batches / Overnight choices as flags over any set of Library skills, or over `--pending`, the wizard's own candidate set (every shared skill with no receipt for its current version; needs a team). Several skills run as one batch after a single agent probe, `--parallel` deep (default four, never more than the batch). `--batch n` runs n at a time and asks `Continue with the next …?` before each further batch; a declined continuation queues the remainder for `later`, and a non-interactive caller runs every batch unasked. `--window` queues instead of running and never probes. The result is `{ mode: \"ran\" | \"queued\", team, skills, ok, failed, queued, stoppedAfter? }`; a run with failures is `ok:false` with that partial value, exactly like a drain. Print and `progress` frames name each skill and `progress.total` is the whole set. One skill with none of those flags is the ordinary single eval; the queue modes refuse skills, `--batch` and `--pending`."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 485,
    "policy": "prose",
    "pattern": "summary and marks the step `printed`; the shell owns the choices by calling `reconcile --list` and then"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 486,
    "policy": "prose",
    "pattern": "`install --adopt` or `publish`. `--no-existing`, quiet and non-interactive setup mark it `skipped`."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 490,
    "policy": "prose",
    "pattern": "team clone: sum each arm mean multiplied by `provenance.cases.length * provenance.k`, for both cost and duration. Receipts with null arm measurements do not qualify. With fewer than three eligible receipts,"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 493,
    "policy": "prose",
    "pattern": "A declined batch continuation queues the remaining skills for `later`; `eval --drain` includes those items."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 497,
    "policy": "prose",
    "pattern": "between 01:00 and 05:00 after thirty minutes without pointer or keyboard activity. The app starts `eval --drain --parallel 4` once that night; Stop cancels that one process. Activity, the preference, and the window are checked before launch; an active batch may finish. This unfiltered drain includes later items too, as required by A1. The app must remain open. Closed-app scheduling is deferred; a person can run"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 498,
    "policy": "prose",
    "pattern": "`eval --drain` manually at any time. The overnight preference defaults to true."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 520,
    "policy": "prose",
    "pattern": "eval offer available. Batch-size input is limited to three attempts. An empty drain prints `No queued evals.`;"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 526,
    "policy": "prose",
    "pattern": "`sync` fetches each configured team clone and hard-resets it to `origin/main`, one team at a time,"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 533,
    "policy": "prose",
    "pattern": "The result is `{ changed, teams, notices }`. `notices` carries run-wide lines already phrased for a person, one concern per entry and no diagnostics, because a frame-driven caller may render them verbatim: the desktop app prints them under Settings ▸ Sync after an automatic fetch that did not refresh every team. Each attempted team reports `team`, its own `changed`,"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 537,
    "policy": "prose",
    "pattern": "session-start hook left it alone (§8); a plain `sync` always fetches. Top-level `changed` is true when any team moved; a tracked tree that was"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 553,
    "policy": "prose",
    "pattern": "terum-skills process is writing the clone; a younger one is named in `detail` and never touched. Every prompt"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 564,
    "policy": "prose",
    "pattern": "copy and adds a missing one, and it replaces `~/.terum/skills/hooks/terum-skills-edit.mjs`. Each"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 565,
    "policy": "prose",
    "pattern": "rewrite is reported as a notice (`Updated your terum-skills skills for this CLI.`, `Updated your"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 566,
    "policy": "prose",
    "pattern": "terum-skills edit hook for this CLI.`). A foreign copy, or an edit hook that is absent because the"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 569,
    "policy": "prose",
    "pattern": "An interactive terminal `sync` may also offer to follow a team repository that has gone, and an"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 570,
    "policy": "prose",
    "pattern": "accepted offer runs `team move --yes`, which removes and re-places every placed skill. The offer is"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 574,
    "policy": "prose",
    "pattern": "Work recorded in `pending` is drained by re-running the matching `install` or `uninstall-skill`, never"
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 575,
    "policy": "prose",
    "pattern": "by `sync`."
  },
  {
    "file": "docs/frame-protocol.md",
    "line": 577,
    "policy": "prose",
    "pattern": "The desktop app is an unattended caller: it spawns plain `sync` at the first hello whose `features.refresh` is true and again whenever its window regains focus, at most once a minute, one at a time, and never while a foreground write verb of its own is running. It drives the run read-only and kills it rather than answer, so `sync` must never ask a question; it keeps only `changed`, each team's `state`/`detail`, and `notices`, so anything a person needs to act on has to be in those fields rather than in printed prose. Every completed automatic fetch refreshes the stamp-driven boards (Status, Settings ▸ Sync, Inbox); one that moved a clone also refreshes the Marketplace boards."
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 6,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest team create [name]"
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 9,
    "policy": "prose",
    "pattern": "`setup` runs this for you when you pick \"Create a new team\". Run `team create` directly when you already know the answers, or when you are creating the team against a remote you made yourself."
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 11,
    "policy": "fixed",
    "pattern": "Creating on GitHub needs a logged-in `gh`. Without one the command stops with what to do instead: \"Creating a GitHub team needs the GitHub CLI (gh) in phase 1. Install it from https://cli.github.com and run `gh auth login`, or create the team against an existing empty remote with `npx -y terum-skills@latest team create <name> --remote <url>`.\" A `gh` that is installed but logged out is offered \"GitHub CLI is installed but logged out. Run `gh auth login` now?\" first; declining that, or a login that does not take, stops with \"GitHub authentication is required to create a team: run `gh auth login` and retry, or create the team against an existing empty remote with `npx -y terum-skills@latest team create <name> --remote <url>`.\""
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 13,
    "policy": "fixed",
    "pattern": "This machine can be on one team at a time. A second `team create` is refused before anything is created: \"One team per machine: This machine is on team `<name>` (`<remote>`). Terum Skills keeps one team per machine: run `npx -y terum-skills@latest team leave <name>` first, then re-run `…`.\""
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 27,
    "policy": "prose",
    "pattern": "3. **The repository name**, on the GitHub path only. `team create` prints `What should the GitHub repository name be for the team \"<team>\"? Suggested name: <team>-shared-skills.` and then asks `GitHub repository name` with that suggestion as the default. If GitHub says the name is taken, it prints `The repository name <spec> is already taken on GitHub.` and asks again, up to three attempts in total. A collision on the host never renames your team."
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 31,
    "policy": "prose",
    "pattern": "`team create` runs `gh repo create <repo> --private` (or `<org>/<repo>` with `--org`), so the repository is private from the first moment. It then asks `gh` which owner the name resolved to, and runs `gh repo edit <owner/repo> --delete-branch-on-merge`. That last setting is cosmetic housekeeping for merged branches; if it fails, nothing else changes."
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 39,
    "policy": "prose",
    "pattern": "- `README.md`: a heading plus the `terum-skills:begin` and `terum-skills:end` markers."
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 40,
    "policy": "prose",
    "pattern": "- `.github/workflows/terum-skills.yml`: the team workflow. On a pull request it validates every skill the diff touches; on a push to `main` it re-renders the repository README between those two markers and commits the result when it changed."
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 44,
    "policy": "prose",
    "pattern": "Locally, `team create` writes `~/.terum/skills/teams/<team>/` (the clone, on `main`) and the team binding plus your identity defaults in `~/.terum/skills/config.json`."
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 48,
    "policy": "prose",
    "pattern": "Every clone is armed with a `pre-push` hook in `.git/hooks`, and `core.hooksPath` is set to that folder. It re-runs this CLI's own write rules over each pushed branch. A deletion or a non-branch ref is refused outright; an existing branch is judged against the content it replaces, a new one from its fork point off `main`. Of the paths that remain, a raw push may change `README.md`, your own `people/<handle>.json`, and a narrow set of `team.json` edits. `skills/` and `evals/` are always refused, because a version is minted by `publish` and a receipt is written by the run that produced it. This exists to stop accidents, not to stop anyone: `git push --no-verify` bypasses it, attributed to you. If the launcher the hook was armed with has been removed, the hook exits 0 with one warning line saying the push was not checked, and tells you to re-run `team join <remote>` to re-arm it."
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 53,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest team create <name> --remote <url>"
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 56,
    "policy": "fixed",
    "pattern": "The remote must already exist and hold no branches. If it has any, the command refuses: \"`<remote>` already has branches; `npx -y terum-skills@latest team create --remote` needs an empty repository. To join an existing team run `npx -y terum-skills@latest team join <remote>`.\" A credential pasted into the URL is dropped before the URL reaches git, config, or any message, and the drop is announced: \"Ignored the credential embedded in the remote URL: terum-skills never stores one or passes one to git. Git access uses your configured Git credentials.\""
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 60,
    "policy": "fixed",
    "pattern": "- `invite` refuses: \"Access is managed on the host for `<remote>`; this operation is GitHub-only in phase 1.\" Setup prints the same fact and hands you the join command instead: \"Access to `<remote>` is managed on the host; grant it there, then send teammates: `npx -y terum-skills@latest setup <remote>`\"."
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 61,
    "policy": "prose",
    "pattern": "- `team remove` can only archive. Revoking host access is GitHub-only, so a non-GitHub team uses `team remove <handle> --archive-only` and revokes access on its own host."
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 62,
    "policy": "prose",
    "pattern": "- The CLI's release probe is off. It runs only when a configured team remote is on GitHub, so `update` says \"Release advertisements are not checked on this machine.\""
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 67,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest invite <github-login> [<github-login>…]"
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 72,
    "policy": "prose",
    "pattern": "The whole batch is validated before a single invitation is sent, so a typo costs nothing. Each login is then added with one GitHub API call per person. GitHub requires repository admin permission to add a collaborator; terum-skills applies no check of its own, so a member without admin gets GitHub's 403 back, and inside setup that ends the wizard after naming what is already durable. The call carries no permission parameter, so each collaborator gets GitHub's default permission for that endpoint, which is write. Anyone you invite can therefore publish to the team repository, which is the intended model: publishing appends an immutable version folder, and any member may publish or unpublish."
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 90,
    "policy": "prose",
    "pattern": "npm install -g terum-skills"
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 91,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest setup <owner>/<repo>"
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 93,
    "policy": "fixed",
    "pattern": "Bare equivalent: npx -y terum-skills@latest team join <owner>/<repo>"
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 98,
    "policy": "prose",
    "pattern": "The fenced middle is there so it pastes cleanly into Slack or email. The `npm install -g` line is optional: it only gives your teammate the bare `terum-skills` command, and the `npx` line below works without it."
  },
  {
    "file": "docs/getting-started/create-a-team.md",
    "line": 103,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest setup <org>/<repo>"
  },
  {
    "file": "docs/getting-started/first-eval.md",
    "line": 6,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest eval <skill>"
  },
  {
    "file": "docs/getting-started/first-eval.md",
    "line": 13,
    "policy": "prose",
    "pattern": "**Claude Code, installed and logged in.** Before any paid work, `eval` runs `claude --version` and then one real one-turn agent task in a throwaway directory. A failure stops the run there, with the reason: \"`claude` is not runnable (…) — is Claude Code installed and on PATH?\" or \"preflight agent task failed — check that `claude` is logged in and the model 'sonnet' is available: …\"."
  },
  {
    "file": "docs/getting-started/first-eval.md",
    "line": 15,
    "policy": "prose",
    "pattern": "**The folder in your Library.** That means Global (`~/.claude/skills`) or a project you registered with `project add`. Your working directory is not a Library root. A ref no root holds is refused without spending anything: \"No local skill folder named `<name>` in your library; install it from the marketplace first, or pass the folder's path.\", or, for a path, \"`<path>` is not a skill folder in your library (~/.claude/skills or an added project's .claude/skills); add the project holding it with `project add`, or install it from the marketplace first.\""
  },
  {
    "file": "docs/getting-started/first-eval.md",
    "line": 17,
    "policy": "prose",
    "pattern": "**A team is optional.** `eval` evaluates a local folder, so a machine with no team still runs it. A team adds three things: the incumbent arm, the license policy that hygiene checks against, and a place to share the receipt."
  },
  {
    "file": "docs/getting-started/first-eval.md",
    "line": 45,
    "policy": "prose",
    "pattern": "7. **Runs the cases.** Each case is seeded into a fresh sandbox (its fixture, its inline files, its `setup` script), then run once per arm per repetition. A suite, authored or generated, is seeded once per arm per repetition instead, and every one of its rows is scored against that one session."
  },
  {
    "file": "docs/getting-started/first-eval.md",
    "line": 79,
    "policy": "fixed",
    "pattern": "These bytes are not a published version, so nothing was shared. To share these results, publish the skill again: npx -y terum-skills@latest publish <skill>"
  },
  {
    "file": "docs/getting-started/first-eval.md",
    "line": 85,
    "policy": "fixed",
    "pattern": "These bytes are not a published version, so nothing was shared. This run's verdict is FAIL: evaluate a fix rather than publishing these bytes — npx -y terum-skills@latest publish <skill> asks before it publishes a failed verdict."
  },
  {
    "file": "docs/getting-started/first-eval.md",
    "line": 92,
    "policy": "prose",
    "pattern": "| `eval <skill> --triggers-only` | Only the trigger eval: would a model reading descriptions pick this skill for these prompts. No sandboxes, no arms, no agent sessions. |"
  },
  {
    "file": "docs/getting-started/first-eval.md",
    "line": 93,
    "policy": "prose",
    "pattern": "| `eval <skill> --case <stem>` | One authored case, by its file stem. An authored `evals/suite.yaml` is skipped with a printed line, because a suite session can run for a long time. |"
  },
  {
    "file": "docs/getting-started/first-eval.md",
    "line": 94,
    "policy": "prose",
    "pattern": "| `eval <skill> --no-gen` | No generation. The run uses only the assets the folder already has, and nothing is written into your skill folder. |"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 1,
    "policy": "prose",
    "pattern": "# Install terum-skills"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 6,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest setup"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 12,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest setup <org>/<repo>"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 15,
    "policy": "prose",
    "pattern": "Bare `setup` cannot join. Choosing \"Join an existing team\" at the role question prints what to ask the owner for and writes nothing."
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 22,
    "policy": "prose",
    "pattern": "| A logged-in GitHub CLI (`gh`) | Only to create a team on GitHub, and afterwards for `invite`, `team remove`, and downloading or updating the app. Joining a team needs none of it: you can accept the invitation in a browser, and git access uses your configured Git credentials. |"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 24,
    "policy": "prose",
    "pattern": "| Claude Code, logged in | Only for `eval`, which spawns `claude` for every arm. The rest of the CLI never calls a model, except the one category suggestion `publish` asks for. |"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 26,
    "policy": "prose",
    "pattern": "`gh` in two states matters. Installed but logged out is not the same as absent: setup offers \"GitHub CLI is installed but logged out. Run `gh auth login` now?\" and runs gh's own login for you when you say yes. Creating a team against a non-GitHub remote (`team create --remote <url>`) needs no `gh` at all. See [create a team](create-a-team.md)."
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 34,
    "policy": "prose",
    "pattern": "| Linux | Yes | No. `app` prints \"There is no Linux desktop app yet; everything works from the terminal.\" and exits 0. |"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 35,
    "policy": "prose",
    "pattern": "| WSL | Yes | No. `app` prints \"The desktop app runs on the Windows side of this machine, not inside WSL. Install terum-skills there and run this command from a Windows terminal; from here, everything works in the terminal.\" |"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 46,
    "policy": "prose",
    "pattern": "Welcome to terum-skills."
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 48,
    "policy": "prose",
    "pattern": "This wizard helps you create a team, join one, invite teammates, place the terum-skills skills for Claude Code and Codex, and offer the session hook and a reminder to publish a skill after Claude edits one; re-run it any time to continue, and leave the invitation question blank to skip it."
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 61,
    "policy": "fixed",
    "pattern": "Setup asks rather than guessing because the two answers are not symmetric: a wrong \"create\" leaves a private GitHub repository you did not want, while a wrong \"join\" costs a re-run. Choosing \"Join an existing team\" prints the hand-off and exits without writing anything: \"Ask the team owner to invite you, then run the command they send you.\" A machine that already has a team prints \"Resuming setup for team `<name>`. Terum Skills keeps one team per machine; to move this machine to another team run `npx -y terum-skills@latest team leave <name>` first.\""
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 65,
    "policy": "prose",
    "pattern": "5. **Team.** Creator: `team create`, which asks for the team name, your identity, and the GitHub repository name. Joiner: `team join <target>`, which accepts the invitation, clones, and asks for your handle. See [create a team](create-a-team.md) and [join a team](join-a-team.md). A configured team whose clone is missing is re-cloned here; a folder that exists but is not a complete clone of that remote is refused with the repair to run."
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 73,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest install <team>/<skill>   — install a shared skill (add @<version> to pin it)"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 74,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest ls [--local]             — list members and shared skills; --local lists your own"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 75,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest search <term>            — find a skill by name, description, or category"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 76,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest sync                     — fetch the team clone"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 77,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest publish <skill>          — publish a local skill explicitly"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 78,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest eval <skill>             — evaluate a shared skill locally before publishing"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 81,
    "policy": "prose",
    "pattern": "The `@<version>` hint in that first line is stale. `install` refuses a pin today: \"Installing a previous version is not supported yet; install installs the latest version.\""
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 85,
    "policy": "prose",
    "pattern": "9. **Your existing skills.** Setup runs `reconcile` over your Library: \"Checking your library against the team…\". A folder whose bytes match a shared version is offered as \"Record `<name>` as installed (Version N)?\". A folder with the same name and different bytes is offered as \"Publish your version of `<name>` as Version N of the team's `<name>`?\", followed by why it can: either \"Your folder carries the team's id for `<name>`.\", or, when it does not, a sentence naming who published the team's copy, warning that publishing makes your content the next version of their skill, and giving the `skill rename` command that keeps them separate. Rows are independent, and nothing is written unless you say yes. `--no-existing` skips it."
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 94,
    "policy": "fixed",
    "pattern": "Skip         Evaluate any skill later with `npx -y terum-skills@latest eval <skill>`."
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 103,
    "policy": "prose",
    "pattern": "13. **The skills.** No question: setup places the eight terum-skills skills into your global skills folders and prints `Installed the terum-skills skills at ~/.claude/skills: eval, eval-report, list-skills, search-skills, skill-info, skill-status, sync-skills, terum-skills.` and, when `~/.codex` exists, the same line for `~/.codex/skills`. Without `~/.codex` on the machine the run says `No ~/.codex on this machine; Codex skills skipped.` Copies already there are refreshed where out of date, and a folder at one of those names that is not ours is named and left alone."
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 105,
    "policy": "prose",
    "pattern": "14. **Edit hook.** \"Remind Claude Code to publish a skill after it edits one? (installs ~/.terum/skills/hooks/terum-skills-edit.mjs and a Write/Edit hook in ~/.claude/settings.json)\" (default No)."
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 107,
    "policy": "prose",
    "pattern": "The two hooks are separate questions on purpose. The session hook fetches on a schedule; the edit hook runs after every Write and Edit the agent makes and reads the path it touched. Folding the second into a yes already given would install something else. Both default to No, and declining either is remembered only in the sense that nothing was written: a later `sync --hook` never installs a hook you declined, it only refreshes one you accepted. A re-run does not ask again for one you already have. An installed session hook is reported rather than offered, and out-of-date copies of the eight skills, or an out-of-date edit-hook script of ours, are refreshed without a question. The skills themselves are placed on every setup run, and a skills root that already holds Terum's copies also receives any of the eight that are missing from `sync --hook`. Anything at one of those paths that is not ours is named and left alone. The hook entry and the placed skills all name the copy of the CLI that wrote them rather than the registry's latest release, so a session runs the copy you installed; a later `sync --hook` re-points an entry written by an earlier release at the copy that is running and says so on stderr. See [Claude Code integration](../guides/claude-code-integration.md), and [security](../../SECURITY.md) for what runs on this machine and when."
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 127,
    "policy": "prose",
    "pattern": "| `~/.terum/skills/config.json` | Always, at `team create` or `team join` | Your team binding, your identity defaults, the placement ledger, tool-consent records, registered projects. Mode 0600. |"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 128,
    "policy": "prose",
    "pattern": "| `~/.terum/skills/teams/<team>/` | `team create`, `team join` | The clone of the team repo, on `main`, with a `pre-push` guard armed in `.git/hooks`. |"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 130,
    "policy": "prose",
    "pattern": "| `~/.claude/settings.json` | Only if you accept the session hook | A `hooks.SessionStart` entry with matcher `startup` that runs `sync --hook` through the copy of the CLI that installed it, in the same bare-or-npx form the CLI uses for the commands it prints: `terum-skills sync --hook` for a global install the CLI found on your PATH on macOS or Linux, otherwise `npx -y terum-skills@<version> sync --hook` pinned to the release that ran setup (`async`, 60 s timeout). See *Other ways to run it* below. |"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 131,
    "policy": "prose",
    "pattern": "| `~/.claude/settings.json` | Only if you accept the edit hook | A `hooks.PostToolUse` entry with matcher `Write\\|Edit` running `node \"<home>/.terum/skills/hooks/terum-skills-edit.mjs\"` (10 s timeout, not async). |"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 133,
    "policy": "prose",
    "pattern": "| `~/.claude/skills/<name>/`, eight folders, and `~/.codex/skills/<name>/` when `~/.codex` exists | Every setup run | The bundled skills that let Claude Code and Codex run terum-skills for you; see [Claude Code integration](../guides/claude-code-integration.md#the-eight-skills). Anything else already at one of those paths is named and left alone. |"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 134,
    "policy": "prose",
    "pattern": "| `~/.terum/skills/hooks/terum-skills-edit.mjs` | Only if you accept the edit hook | The reminder script. It imports nothing from the package and reads no network. |"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 145,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest status"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 148,
    "policy": "prose",
    "pattern": "`status` is an offline read. It prints the CLI version, then for your team: your handle, the repository, the clone's state (with the command to restore it when it is missing, incomplete, or a clone of something else), the member count and the first five members, the number of shared skills, and how stale the clone is. A membership line appears only when your roster entry is archived or absent. With no team configured it prints the two get-started commands and still exits 0. It returns a failure only when a configured team's details could not be read."
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 152,
    "policy": "fixed",
    "pattern": "The `npx -y terum-skills@latest …` form resolves the registry's latest release on each run, so a command you type is always the newest release. The session hook and the placed skills are the exception: each is pinned to the copy that installed it, and re-running `setup` is what moves them."
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 157,
    "policy": "prose",
    "pattern": "npx -y terum-skills@0.20.1 setup"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 163,
    "policy": "prose",
    "pattern": "npm install -g terum-skills"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 164,
    "policy": "prose",
    "pattern": "terum-skills status"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 167,
    "policy": "prose",
    "pattern": "When you then run the bare command on macOS or Linux, the CLI prints its own commands in the bare form (`terum-skills ls`) rather than the npx form, so anything you copy out of its output already matches how you run it. On Windows, and whenever the CLI is launched through npm or npx, it keeps the npx form."
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 173,
    "policy": "fixed",
    "pattern": "| `npx -y terum-skills@latest` | Each run requests the registry's latest release. Re-run `setup` to move the session hook and the placed skills onto it. |"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 174,
    "policy": "prose",
    "pattern": "| Global install | Run what `update` prints: `npm install -g terum-skills@latest`. Where the hook and the skill were written in the bare form they follow the new global install on their own; where they name a version, re-run `setup`, which is what `update` says. |"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 175,
    "policy": "prose",
    "pattern": "| Local dependency | Run what `update` prints: `npm install terum-skills@latest` (or `--save-dev`) in that project, then re-run `setup` to move the hook and the skill. |"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 180,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest update"
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 183,
    "policy": "prose",
    "pattern": "`update` prints the running version, where this copy lives, the latest advertised release, and the command that would update this copy. Where that copy is a global install, an npx run, or one whose installation method could not be established, it also names the re-run of `setup` that moves the session hook and the placed skills onto the release you updated to. It never runs a package manager. The release advertisement comes from a `git ls-remote --tags` probe of this project's public repository, capped at once a day for the passive notice and forced when you run `update` yourself. A machine whose team remote is not on GitHub does not probe at all, and says so: \"Release advertisements are not checked on this machine.\""
  },
  {
    "file": "docs/getting-started/install.md",
    "line": 187,
    "policy": "fixed",
    "pattern": "`npx -y terum-skills@latest uninstall` removes terum-skills from this machine after one confirmation that lists everything it is about to touch: your team binding, every placed skill folder, the team clone, the version cache and run files, the session hook and the Write/Edit entry in `~/.claude/settings.json`, the managed skills under `~/.claude/skills/` and `~/.codex/skills/` and the edit-hook script (a foreign file at any of those paths is named and left alone), the app download records, and `config.json`. It keeps your quarantine folder when it holds anything, the `backups/` folder including a record of the uninstall, and `evals/` with its runs and transcripts, and it says so under `Kept:` before you answer. More can survive than that line names. At the end it removes `app/` outright, but removes `run/`, `cache/`, `teams/` and `quarantine/` only when they are already empty. So anything still under `run/`, such as the usage archive and the eval queue, stays behind and is reported as `Kept <path> (not empty)`, and a quarantine folder is reported with its item count. The state root `~/.terum/skills` itself is left in place whenever anything remains inside it, with no line at all. A clone holding uncommitted or unpushed work is moved to quarantine rather than deleted, and a placed folder you have edited is quarantined rather than deleted. Your membership and installed-skill records in the team repo are unchanged. On macOS the app bundle at `~/Applications/Terum Skills.app` is deleted; on Windows the app stays installed and you remove it from Windows Settings, Apps. The npm package itself is never removed by this command; the last line tells you how. Full detail, including what survives and why, is in [local state](../reference/local-state.md)."
  },
  {
    "file": "docs/getting-started/join-a-team.md",
    "line": 6,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest setup <org>/<repo>"
  },
  {
    "file": "docs/getting-started/join-a-team.md",
    "line": 9,
    "policy": "prose",
    "pattern": "`setup` with a target joins and then continues with the rest of the wizard (a project, your existing skills, the evals offer, the three Claude Code hooks). For the join on its own:"
  },
  {
    "file": "docs/getting-started/join-a-team.md",
    "line": 12,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest team join <org>/<repo>"
  },
  {
    "file": "docs/getting-started/join-a-team.md",
    "line": 15,
    "policy": "prose",
    "pattern": "`team join` still ends with one offer of the session-start hook, after the join itself is durable. It never places the eight skills or offers the edit hook; only `setup` does."
  },
  {
    "file": "docs/getting-started/join-a-team.md",
    "line": 46,
    "policy": "prose",
    "pattern": "Your handle is how the team repo names you: `people/<handle>.json`, the author line on skills you publish, and `install member <handle>`. A handle is 1 to 39 characters: letters, digits, and single internal hyphens, stored lowercase. It defaults to the handle this machine already uses, and to your GitHub login when there is none."
  },
  {
    "file": "docs/getting-started/join-a-team.md",
    "line": 59,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest ls"
  },
  {
    "file": "docs/getting-started/join-a-team.md",
    "line": 60,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest search <term>"
  },
  {
    "file": "docs/getting-started/join-a-team.md",
    "line": 61,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest install <skill>"
  },
  {
    "file": "docs/getting-started/join-a-team.md",
    "line": 64,
    "policy": "prose",
    "pattern": "`ls` lists the members and the shared skills from your clone, offline. `install` copies the latest version of a skill into Global (`~/.claude/skills`) or into a project you have registered, and asks `Install to` at an interactive terminal; over a pipe, with no projects registered, it goes to Global without asking. `ls --local` shows your own folders and how they relate to the team. See [install and manage skills](../guides/install-and-manage.md) and [Library and Marketplace](../concepts/library-and-marketplace.md)."
  },
  {
    "file": "docs/getting-started/join-a-team.md",
    "line": 73,
    "policy": "fixed",
    "pattern": "One team per machine: This machine is on team <name> (<remote>). Terum Skills keeps one team per machine: run `npx -y terum-skills@latest team leave <name>` first, then re-run `<the command you ran>`."
  },
  {
    "file": "docs/getting-started/join-a-team.md",
    "line": 79,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest team leave <name>"
  },
  {
    "file": "docs/getting-started/join-a-team.md",
    "line": 93,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest team move <org>/<repo>"
  },
  {
    "file": "docs/getting-started/join-a-team.md",
    "line": 100,
    "policy": "prose",
    "pattern": "- **`setup <org>/<repo>`** on a machine already bound to a different team first checks whether the old repository still exists. Only a clear \"repository not found\" counts; offline or access denied keeps the ordinary one-team refusal. When it is gone, setup prints \"Team `<current>`'s repository `<url>` no longer exists on GitHub.\" and asks \"Move this machine from `<current>` to `<url>`?\" before doing the move for you."
  },
  {
    "file": "docs/getting-started/join-a-team.md",
    "line": 101,
    "policy": "prose",
    "pattern": "- **`sync`** at a terminal asks GitHub what replaced a repository that answers \"not found\": a pending invitation from the same owner, or a repository of theirs you can already reach that carries a `team.json`. It prints one line naming what it found and offers \"Move this machine from `<team>` to the replacement?\" with the candidates and `Not now`. Over a pipe or in hook mode it prints the `team move` command instead of asking."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 3,
    "policy": "prose",
    "pattern": "terum-skills puts four things inside your Claude Code setup, and the first of them inside Codex too. Setup places the first, the eight skills, without asking. The two hooks are separate offers during setup, each with its own question, and both default to No, so neither hook is on your machine unless you answered yes. The fourth, the per-machine switch, is a verb you run."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 7,
    "policy": "prose",
    "pattern": "| The eight skills | `~/.claude/skills/<name>/`, and `~/.codex/skills/<name>/` for Codex | Run terum-skills for you and show the result as a board; the manual among them says which verbs to hand to your terminal |"
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 9,
    "policy": "prose",
    "pattern": "| The edit hook | `~/.terum/skills/hooks/terum-skills-edit.mjs` and `~/.claude/settings.json` | Reminds Claude to publish a skill after it edits one |"
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 12,
    "policy": "prose",
    "pattern": "Two more places where the two tools meet are covered at the end: evals drive your own logged-in Claude Code, and `usage` and `misses` read Claude Code's session transcripts."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 16,
    "policy": "prose",
    "pattern": "terum-skills ships eight skills inside the npm package. Setup places them for Claude Code under `~/.claude/skills/<name>/` and, when `~/.codex` exists on the machine, for Codex under `~/.codex/skills/<name>/` (`CODEX_HOME` moves that root). Seven are narrow, one per common request; the eighth, `terum-skills`, is the operator manual for everything else. With them installed, asking Claude or Codex to \"list my team's skills\" or \"evaluate this skill\" gets a correct invocation instead of a guess, and the result comes back as a Markdown board (`--format md`)."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 20,
    "policy": "prose",
    "pattern": "| `list-skills [--local\\|--team]` | `ls --local --format md` and `ls --format md`: your Library and the team Marketplace |"
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 21,
    "policy": "prose",
    "pattern": "| `skill-info <name>` | `ls skill <name> --format md`, then `eval-report <name> --format md` for a team skill |"
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 22,
    "policy": "prose",
    "pattern": "| `search-skills <term>` | `search <term> --format md` |"
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 23,
    "policy": "prose",
    "pattern": "| `eval <skill> [flags]` | `eval <skill> --format md`, after confirming the cost with you |"
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 24,
    "policy": "prose",
    "pattern": "| `eval-report <skill>` | `eval-report <skill> --format md` |"
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 25,
    "policy": "prose",
    "pattern": "| `skill-status` | `status --format md`, then `update --format md` |"
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 26,
    "policy": "prose",
    "pattern": "| `sync-skills` | `sync --format md` |"
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 27,
    "policy": "prose",
    "pattern": "| `terum-skills <verb …>` | any verb with `--format md`; the verbs that ask a question are handed to your terminal |"
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 29,
    "policy": "fixed",
    "pattern": "None of the copies that land on your machine is the bundled copy byte for byte. Every `npx -y terum-skills@latest` in each of them is rewritten to the spelling this machine uses: `terum-skills` where the [bare invocation form](../reference/cli.md#invocation) is available, and `npx -y terum-skills@<the version that placed it>` everywhere else, including every Windows machine. A session therefore runs the copy you installed, never whatever the registry has published since."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 34,
    "policy": "prose",
    "pattern": "Installed the terum-skills skills at ~/.claude/skills: eval, eval-report, list-skills, search-skills, skill-info, skill-status, sync-skills, terum-skills."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 35,
    "policy": "prose",
    "pattern": "Installed the terum-skills skills at ~/.codex/skills: eval, eval-report, list-skills, search-skills, skill-info, skill-status, sync-skills, terum-skills."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 38,
    "policy": "prose",
    "pattern": "On a machine without `~/.codex` the run says `No ~/.codex on this machine; Codex skills skipped.` and writes the Claude Code set alone. When every copy is already current it says `The terum-skills skills at ~/.claude/skills and ~/.codex/skills are current.` and writes nothing."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 42,
    "policy": "prose",
    "pattern": "Terum's copies are marked in each SKILL.md frontmatter: the skill's own `name` plus `metadata.managed-by: terum-skills`. That marker is the whole idempotency key."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 44,
    "policy": "prose",
    "pattern": "An outdated copy carrying that marker is refreshed in place without a question, because a stale skill teaches the agent the wrong verbs. Setup does it, and so does `sync --hook`: in a root that already holds one of Terum's copies it rewrites the outdated ones and adds any that are missing, which is how a release that ships a new skill reaches you, printing `Updated your terum-skills skills for this CLI.` on its notice channel. Outdated means byte-different from the bundled copy rendered in this machine's spelling, so a copy placed by a different copy of the CLI is outdated by that definition and is rewritten on the next setup or hook run."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 60,
    "policy": "prose",
    "pattern": "`status`, `ls`, `ls member`, `ls project`, `ls skill`, `ls --local`, `project add <path>`, `project remove`, `project rename`, `project list`, `search`, `skill fix`, `skill category`, `validate`, `update`, `app`, `app-update`, `sync`, `install`, `publish`, `invite`, `profile`, `login --set`, `team workflow-update --print`, the whole `eval` family, `eval-report` and `serve`."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 64,
    "policy": "prose",
    "pattern": "`unpublish`, `reconcile`, `project add` with no path, `skill move`, `skill copy`, `skill rename`, `skill delete`, `skill enable`, `skill disable`, `prune`, `uninstall-skill`, `uninstall`, `team leave`, `team remove`, `team move`, `team project create`, `team project delete`, `team migrate`, and the wizards: `setup`, `team create`, `team join`, bare `login`."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 66,
    "policy": "prose",
    "pattern": "The manual's own rules keep that line honest: never pipe `y` on stdin, never invent flags, never drive the CLI through `expect` or `script`, and never use `--frames` to get around the TTY rule. It also tells the agent to confirm with you before anything that spends money (every `eval`) or changes the team (`install`, `publish`, `invite`, `profile`)."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 70,
    "policy": "fixed",
    "pattern": "There is no separate remove verb. `npx -y terum-skills@latest uninstall` removes the managed copies as part of the machine teardown and prints `Removed the terum-skills skills from <root>: <names>.` for each root. Otherwise delete the folders under `~/.claude/skills/` and `~/.codex/skills/` yourself; setup places them again next time."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 86,
    "policy": "prose",
    "pattern": "{ \"type\": \"command\", \"command\": \"npx -y terum-skills@0.20.1 sync --hook\", \"async\": true, \"timeout\": 60 }"
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 91,
    "policy": "prose",
    "pattern": "The command is this copy of the CLI, pinned, and never `@latest`. Where the [bare invocation form](../reference/cli.md#invocation) is available, which means a global install this CLI found first on `PATH` on macOS or Linux, the entry reads `terum-skills sync --hook` instead; everywhere else, including every Windows machine, it is the npx form carrying this copy's version. Nothing fetches a newer CLI at the start of a session, and a newer release reaches the entry only when you update the package and re-run `setup`."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 93,
    "policy": "prose",
    "pattern": "Before the first write it takes one verbatim backup of your settings file to `~/.terum/skills/backups/settings.<timestamp>.json`, and only if no settings backup exists yet. Writes are atomic and keep the file's mode. A settings file that is not valid JSON, or whose `hooks`, `hooks.SessionStart` or `hooks.PostToolUse` is the wrong shape, is refused outright: `Cannot edit <path>: it is not valid JSON. Fix it by hand or move it aside, then re-run.` Reinstalling strips every terum-skills command already under `SessionStart` first, so there is never a duplicate, and a group that holds other people's commands keeps them."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 101,
    "policy": "fixed",
    "pattern": "Re-pointing its own entry is a one-time migration. Releases before the pinning change wrote `npx -y terum-skills@latest sync --hook`, so a hook run compares the command in the entry against the one this copy would write and rewrites the entry when the two differ. It never installs an entry where none of ours exists, because an hourly hook must not install what somebody declined. When it does rewrite one, stderr carries:"
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 104,
    "policy": "fixed",
    "pattern": "Pinned your session hook to this copy of terum-skills (npx -y terum-skills@0.20.1 sync --hook); it no longer fetches the newest release at session start. Re-run `npx -y terum-skills@latest setup` after an update to move it."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 115,
    "policy": "prose",
    "pattern": "Everything else, including per-team failures and the two refresh notices, goes to stderr so that line stays parseable. Concurrent runs on one clone are serialised by that clone's own writer lock, and a run that finds it held reports `<team>: not refreshed (busy)` on stderr and still exits 0. `sync --hook` is refused under `--frames`."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 121,
    "policy": "prose",
    "pattern": "The hook goes when your last team goes. `team leave <name>` removes it with the last team and prints `Removed the session hook from <path>.`, and `uninstall` removes it during machine teardown. There is no separate switch, and the app's Settings ▸ Sync row says so: it is read-only and reads `Managed by setup`. You can also delete the entry from `~/.claude/settings.json` by hand."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 130,
    "policy": "prose",
    "pattern": "Remind Claude Code to publish a skill after it edits one? (installs ~/.terum/skills/hooks/terum-skills-edit.mjs and a Write/Edit hook in ~/.claude/settings.json) [y/N]"
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 133,
    "policy": "prose",
    "pattern": "Yes writes the script to `~/.terum/skills/hooks/terum-skills-edit.mjs` and this entry into `hooks.PostToolUse`:"
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 139,
    "policy": "prose",
    "pattern": "{ \"type\": \"command\", \"command\": \"node \\\"<home>/.terum/skills/hooks/terum-skills-edit.mjs\\\"\", \"timeout\": 10 }"
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 146,
    "policy": "prose",
    "pattern": "When the edit is inside a skill folder, terum-skills is set up and a team is configured, the hook writes a note that begins:"
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 149,
    "policy": "prose",
    "pattern": "You edited <name>, a skill in this machine's terum-skills Library (<folder>)."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 152,
    "policy": "prose",
    "pattern": "The rest of the note says whether that folder is an installed copy of a team version, that the edit is local until it is published, and gives the `publish` and `eval` commands, with the warning that `publish` asks questions and so needs a real terminal. It appears once per skill per session, recorded under `~/.terum/skills/run/edit-hints/`, swept after seven days. Any failure is silence: the script always exits 0, because a reminder is never worth interrupting an edit."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 156,
    "policy": "prose",
    "pattern": "`uninstall` removes both halves, the settings entry first so that no entry ever names a deleted script, and prints `Removed the terum-skills edit hook from <path> and <settings>.` By hand, delete the `Write|Edit` entry from `~/.claude/settings.json` and the script under `~/.terum/skills/hooks/`. A file at that path that is not Terum's own keeps its settings entry too: the CLI removes only what it wrote."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 160,
    "policy": "prose",
    "pattern": "Claude Code loads whatever sits in a skills directory, so terum-skills cannot switch a placed copy off without moving the folder. It does not have to. Claude Code has its own `skillOverrides` setting, and `off` hides a skill from the model and from the `/` menu. This is the same key the `/skills` menu writes."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 163,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest skill disable ~/.claude/skills/deploy-check"
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 164,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest skill enable ~/.claude/skills/deploy-check"
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 176,
    "policy": "prose",
    "pattern": "Only `off` belongs to terum-skills. `name-only` and `user-invocable-only` still let Claude or you reach the skill, so they read as enabled, and `enable` never removes them. Names are matched the way Claude Code matches them, ignoring case and spacing, so a hand-written entry is honoured."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 187,
    "policy": "prose",
    "pattern": "The switch on a Library card in [the app](desktop-app.md) calls exactly this verb, and the next Library read brings `enabled` back from the same settings files, so the app's switch and Claude's menu can never disagree. Every row `ls --local` returns carries the same `enabled` field. A skill moved or renamed with `skill move` or `skill rename` carries its `off` to the destination's settings file, and removing a skill clears the `off` so a reinstall is not born disabled."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 195,
    "policy": "prose",
    "pattern": "`usage` reads Claude Code's own transcripts under `~/.claude/projects` and counts each placed skill's firings, then archives what it scanned to `~/.terum/skills/run/usage-events.jsonl` so the count survives Claude Code's roughly 30-day transcript retention. It makes no model call at all, which is what lets the app run it on every skill page. Its `--since` bound is validated and canonicalised before the scan, and `--all` folds the names that fired with no placement here into the one table."
  },
  {
    "file": "docs/guides/claude-code-integration.md",
    "line": 197,
    "policy": "prose",
    "pattern": "`misses` reads the same transcripts for the question `usage` cannot answer: which prompts a placed skill should have been chosen for and was not. It harvests the prompts themselves rather than firing records, and it does spend Claude Code sessions, one `claude -p` call per ten prompts, so it is a verb you run rather than something a page opens. It writes nothing."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 12,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest app"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 15,
    "policy": "prose",
    "pattern": "On macOS and Windows, `setup` runs this before the rest of the wizard. When the app launches, setup prints `Continuing in the app.` and returns, so you create or join the team in the app rather than in the terminal. When you named a team to join, the line is `Continuing in the app. Join <org>/<repo> there.` If the app could not be installed at that point (gh logged out, offline), setup finishes in the terminal and tries the app once more after its closing summary, so a join that ran in the terminal still ends with the app open. `setup --no-app` keeps the whole wizard in the terminal, and so does any setup that is not at an interactive terminal. See [Install](../getting-started/install.md)."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 17,
    "policy": "prose",
    "pattern": "`app` needs a logged-in `gh`: it downloads through `gh release download` and has no HTTP client of its own."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 21,
    "policy": "prose",
    "pattern": "| macOS (Apple silicon) | `terum-skills-desktop_<version>_aarch64.app.tar.gz` | Verifies the published SHA-256, unpacks the archive, moves the bundle onto `~/Applications/Terum Skills.app`, opens it |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 22,
    "policy": "prose",
    "pattern": "| macOS (Intel) | `terum-skills-desktop_<version>_x64.app.tar.gz` | The same |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 23,
    "policy": "prose",
    "pattern": "| Windows (x64) | `terum-skills-desktop_<version>_x64-setup.exe` | Verifies the SHA-256, runs the installer with `/S`: a silent per-user install under `%LOCALAPPDATA%\\Terum Skills`, no elevation. Starts the app detached |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 24,
    "policy": "prose",
    "pattern": "| Windows (ARM64) | `terum-skills-desktop_<version>_arm64-setup.exe` | The same |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 27,
    "policy": "prose",
    "pattern": "The download comes from release `v<version>` of `github.com/ryanliu-terum/terum-skills`, where `<version>` is the version of the CLI you ran. Two checks then have to pass before anything is installed: the file's SHA-256 must equal the published `.sha256` beside it, and `gh attestation verify <asset> --repo ryanliu-terum/terum-skills` must confirm the build-provenance attestation GitHub recorded when the release workflow produced those bytes. Either failure discards the download and names which check failed, and the second needs gh 2.49 or newer. The record of the install goes to `~/.terum/skills/app/<version>/installed.json`, and `~/.terum/skills/run/app.json` records the Node binary, the CLI entry and the `PATH` the app must replay."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 31,
    "policy": "prose",
    "pattern": "On Linux the CLI prints `There is no Linux desktop app yet; everything works from the terminal.` Inside WSL it prints `The desktop app runs on the Windows side of this machine, not inside WSL. Install terum-skills there and run this command from a Windows terminal; from here, everything works in the terminal.`"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 35,
    "policy": "prose",
    "pattern": "The release assets are public, but downloading them by hand costs you the two things the `app` verb takes care of."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 37,
    "policy": "prose",
    "pattern": "The macOS bundle is ad-hoc signed and never notarized: `tauri.conf.json` sets the signing identity to `-`, and the release workflow asserts the signature is ad-hoc rather than notarizing it. A copy you fetch in a browser carries macOS's quarantine attribute, which a bundle that is not notarized does not survive. Files written by `gh` carry no quarantine attribute, so the bundle that `app` places opens with no Gatekeeper dialog at all."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 39,
    "policy": "prose",
    "pattern": "The Windows installer is unsigned: no certificate is configured and the release workflow signs nothing. `app` runs the same installer with `/S`, per user, with no prompt and no elevation."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 43,
    "policy": "prose",
    "pattern": "So install the app with `app`, and update it from inside the app or with `app-update`."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 47,
    "policy": "prose",
    "pattern": "The app reads `~/.terum/skills/run/app.json` on every launch. The `app` verb writes it, which is why opening the bundle from Spotlight or the Dock on a machine where `app` has never run leaves every board with this error:"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 50,
    "policy": "prose",
    "pattern": "The desktop app could not find where terum-skills is installed. Run `terum-skills app` from a terminal once; it records the location and opens this app."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 56,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest app"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 80,
    "policy": "fixed",
    "pattern": "Two habits are worth knowing. Almost everything is right-clickable: a skill card offers its whole action list plus Copy name, and adds Copy path, Show in Finder and Open in editor when it has a folder on this machine; sidebar folders, Settings rows and member rows offer the same kind of menu; an error line copies itself; and a copy reports itself in a short toast. Paths, versions and commands are selectable text, and every dialog prints the `npx -y terum-skills@latest …` command it is about to run, which you can copy and run yourself instead."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 84,
    "policy": "prose",
    "pattern": "The Library is one board per root: Global (`~/.claude/skills`) and one for each project you registered with `project add`. The sidebar lists them under Library ▸ Projects, with a project registered inside another drawn under it, one indent deeper. Both are read with `ls --local`."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 88,
    "policy": "prose",
    "pattern": "Each card carries the skill's project and category, its name, description, version line, size, any install count, and its flags. A card for a folder on this machine also carries the per-machine switch: it runs `skill enable` or `skill disable`, which writes Claude Code's own `skillOverrides` setting. See [Claude Code integration](claude-code-integration.md)."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 95,
    "policy": "prose",
    "pattern": "| Sync | Runs `sync`, then `reconcile --list`, and opens the reconcile dialog |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 96,
    "policy": "prose",
    "pattern": "| Add project | Opens a folder chooser, then runs `project add` on what you chose |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 97,
    "policy": "prose",
    "pattern": "| Drag a folder onto the board | One `project add` per dropped folder |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 98,
    "policy": "prose",
    "pattern": "| Right-click a project row | Show in Finder, Copy path, Rename… (runs `project rename --to <name> -- <path>`, a display name only) and Manage projects… |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 101,
    "policy": "prose",
    "pattern": "The card menu runs one verb each: Run eval (`eval`), and for a folder no team has, Move to… (`skill move`), Copy to… (`skill copy`), Rename… (`skill rename`), Delete… (`skill delete`). For a team skill it offers Install… (`install`), Reinstall… when your people file records the install but nothing is on this machine, or Uninstall… (`uninstall-skill`) instead. Publish to team… (`publish`) and Unpublish… (`unpublish`) are on both. A row the card cannot run is disabled and carries the reason."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 103,
    "policy": "prose",
    "pattern": "In selection mode each card takes a checkbox and a bar appears above the grid: `N of M selected`, Select all, Clear, `Publish N skills to team…`, and `Evaluate N skills…`. Publishing a selection opens a dialog that lists every selected card as ready or skipped with its reason, offers the publish target, and then runs one `publish` process per skill, one at a time. When it ends the board reports `Published N of M skills` and the count that failed. `Evaluate N skills…` hands the selection to the eval dialog described below."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 105,
    "policy": "prose",
    "pattern": "Sync is the Library's own two-step: the fetch-only `sync` verb first, so the comparison is against the team as it is now, then `reconcile --list` to see which of your folders match a team version by bytes or by name. When nothing matches, the board says so instead of opening a dialog."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 109,
    "policy": "prose",
    "pattern": "Opening a card opens its detail page. A team skill is addressed by name; a folder the team has never seen is addressed by its path. The page reads `ls --local`, `ls --team`, `status`, `validate` and `eval-report`."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 118,
    "policy": "prose",
    "pattern": "| Activity | Live firing counts for this skill, from `usage` |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 124,
    "policy": "fixed",
    "pattern": "Every action names the command it runs, and each dialog shows that `npx -y terum-skills@latest …` line before you confirm."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 128,
    "policy": "prose",
    "pattern": "| Install | `install [--team <t>] [--into <root>] -- <ref>` |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 129,
    "policy": "prose",
    "pattern": "| Remove | `uninstall-skill [--team <t>] [--from global\\|<root>] -- <ref>` |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 130,
    "policy": "prose",
    "pattern": "| Publish | `publish [--team <t>] [--project <p>] [--category <c>] -- <ref>` |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 131,
    "policy": "prose",
    "pattern": "| Unpublish | `unpublish [--team <t>] --yes -- <ref>`, behind typing the skill's name |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 132,
    "policy": "prose",
    "pattern": "| Run eval | `eval [--k <n>] [--model <m>] [--judge-model <m>] [--team <t>] -- <ref>` |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 133,
    "policy": "prose",
    "pattern": "| Enable / disable | `skill enable -- <path>` / `skill disable -- <path>` |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 134,
    "policy": "prose",
    "pattern": "| Move, Copy, Rename, Delete | `skill move`, `skill copy`, `skill rename`, `skill delete` |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 135,
    "policy": "prose",
    "pattern": "| Fix | `skill fix -- <path>` |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 136,
    "policy": "prose",
    "pattern": "| Change category | `skill category --to <name> -- <path>` |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 139,
    "policy": "prose",
    "pattern": "There is no Validate control. The page runs `validate` as part of its own read, but the button that runs it again sits on the Quality tab, which is not shipped. Fix is offered beside the `broken` flag instead, and that flag comes from `ls --local`."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 145,
    "policy": "prose",
    "pattern": "The Marketplace is the team's published skills, read from the team repo clone with `status`, `ls --team` and `ls --local`. Nothing here fetches. The home board is a search box over four shelves: Top rated, Teams / Projects, People and Browse by category. Three of them open a list view of their own, and each list view carries its own search and a sort toggle between the drawn ranking and A to Z. Teams / Projects has no list view: a team project opens its own page straight from the shelf, as a person does. Top rated is ordered by install count, which its own subtitle says: `by installs, from people files`. Nothing in the app ranks by eval outcome, so the name promises more than the data carries."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 147,
    "policy": "prose",
    "pattern": "A team project's page installs the whole project with `install project <name>`, and its dialog offers the destination the same way the skill dialog does, including an Add project… button that registers a new root first. Removing runs `uninstall-skill project <name>`. A person's page does the same with `install member <handle>` and `uninstall-skill member <handle>`; what it installs is that person's curated profile list."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 149,
    "policy": "fixed",
    "pattern": "New project creates a team project by running `team project create [--remote <url>] -- <name>`. Its own terminal hint reads `npx -y terum-skills@latest project create <name>`, which fails when you paste it: there is no top-level `project create`. Use the `team project create` form above."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 151,
    "policy": "prose",
    "pattern": "A team project is a name and a repository. Skills reach it by being published to it, so the way to add a skill to a project is the publish target on the skill's Publish dialog or in Settings ▸ Publishing, not a control on the project page. The home board's Teams / Projects shelf still says `their skills place when you sync inside the repo`; a fetch places nothing, so a project's skills reach a machine only when someone runs `install`."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 155,
    "policy": "prose",
    "pattern": "`⌘K` (`Ctrl+K` on Windows and Linux) opens the Search board. It is a screen, not an overlay palette. It runs `search -- <query>` across every configured team, and reads your roots and the catalogue beside it, then groups the results under Skills, Your library, People and Projects. A source that fails prints the CLI's own sentence under its own group; the other groups still render."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 159,
    "policy": "prose",
    "pattern": "Members reads the roster with `status --permissions` and `ls --team`. The columns are Name, Status (the GitHub permission), Joined, Skills and Last seen, and a Find members box filters them."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 161,
    "policy": "prose",
    "pattern": "Invite takes one or more GitHub logins, comma or space separated, validated against the same rule the CLI uses, and runs `invite [--team <t>] -- <login>…`. It reports each login as invited, as already having access, or with the CLI's own error. The dialog also shows the block to send your teammate, which is the join command from `status`:"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 164,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest setup <org>/<repo>"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 174,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest team remove <handle>"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 183,
    "policy": "prose",
    "pattern": "The tour's first step is the exception. `/onboarding/boot` is not the drawn tour but a real `setup` run, streamed into the window with its questions as dialogs, and it is the board setup hands you when it prints `Continuing in the app.`"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 198,
    "policy": "prose",
    "pattern": "| Name, Email, Default handle | your current values | Saved on blur by `login --set name=… --set email=… --set default-handle=…` |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 204,
    "policy": "prose",
    "pattern": "The team card names the team, its remote, its member and skill counts and your handle. Clone shows the working copy and its state. Last fetch shows the stamp and a Sync now button (`sync`). Leave on this machine opens the confirmation for `team leave -- <name>`. Join another team opens a dialog that runs `setup <org>/<repo>`. While a team is configured the row shows `Leave <team> first` in place of the Join button, because Terum Skills keeps one team per machine."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 215,
    "policy": "prose",
    "pattern": "| Quarantine | What is in quarantine, with Prune… (`prune`), the only thing that deletes it. A CLI that does not report the contents gets one line saying so and no button |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 216,
    "policy": "prose",
    "pattern": "| Projects | One row per registered project, a sub-project captioned with its parent, with Rename (`project rename --to <name> -- <path>`) and Remove (`project remove -- <path>`), and a field plus Add (`project add -- <path>`) |"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 222,
    "policy": "prose",
    "pattern": "Sync now runs `sync`. The row states the automatic policy in the app's own words: at launch and when you come back to the app, at most once a minute. When the last automatic fetch failed, this is where the CLI's first error line and its notices appear. The section repeats the quarantine row and its Prune… button."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 226,
    "policy": "prose",
    "pattern": "The Skills group is read-only: tracked installs follow the team, pinned installs stay where they are, and a fetch only tells you a newer version exists. Running `install` again is what places it."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 228,
    "policy": "prose",
    "pattern": "The CLI group has Show update command, which runs `update` and shows the advice it prints. `update` never runs a package manager. Two read-only rows describe the release notice and the release probe: the probe reads release tags from `github.com/ryanliu-terum/terum-skills` at most once a day, and only while a team on this machine lives on GitHub."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 274,
    "policy": "prose",
    "pattern": "Diagnostics ▸ Status runs `status` in a dialog. The Logs row exists to say there is no log file: the CLI prints as it goes."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 276,
    "policy": "prose",
    "pattern": "The danger zone runs `uninstall`, the machine teardown. The app renders the CLI's own consent inventory as the confirmation, and refuses to start while an eval is running. See [Uninstalling the app](#uninstalling-the-app)."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 298,
    "policy": "prose",
    "pattern": "Reads never fetch, so a teammate's commit reaches you only when something runs the fetch-only `sync` verb. The app runs it in the background at two moments: once when it first sees a CLI that supports it, and whenever the window regains focus."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 308,
    "policy": "prose",
    "pattern": "**Learning about a release.** At launch the app asks the CLI for the state of things with `app-update --check`. The CLI probes the release tags of `github.com/ryanliu-terum/terum-skills` with `git ls-remote --tags`, at most once a day and only while a team on this machine has a GitHub remote. On a machine with no such team the row reads `<version> · release advertisements are not checked on this machine.` Regaining focus repeats the launch check while it has never succeeded, and after an hour re-reads the CLI's answer. Check again and Update and relaunch force a probe now."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 310,
    "policy": "prose",
    "pattern": "**Staging.** Unless the policy is Ask me, a newer version is downloaded as soon as it is seen: `app-update --stage --release <version>` fetches the asset and its `.sha256` with `gh`, verifies the checksum and the build attestation, unpacks the bundle on macOS, and records it under `~/.terum/skills/app/<version>/`. A version whose download failed or was cancelled is not retried automatically in the same session."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 320,
    "policy": "prose",
    "pattern": "Install now (and Try again after a failed install) opens one confirmation: `Install <version> and relaunch now?`, with the warning that relaunching closes the window and stops anything the app is running. Relaunch runs `app-update --apply`, which hands the install to a detached process that waits for the app to exit, installs, and starts the new version."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 327,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest app-update --check"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 328,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest app-update --stage --release <version>"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 329,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest app-update --apply --release <version>"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 334,
    "policy": "fixed",
    "pattern": "**App and CLI versions.** A released app build carries the same version number as the CLI release it ships with, and `npx -y terum-skills@latest app` downloads the app for the CLI version you ran. The app then runs whatever Node binary and CLI entry `app.json` recorded, usually the npx cache copy that ran `app`. The two advance separately after that: the app through this update channel, the CLI through `npx -y terum-skills@latest`. On macOS `app` never downgrades a bundle that is already this version or newer, so after the app has updated itself past your CLI, `app` opens the newer one. Settings ▸ About shows both numbers."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 344,
    "policy": "prose",
    "pattern": "Settings ▸ Advanced ▸ Remove… runs `uninstall`, which tears down what Terum put on this machine and, on macOS only, deletes the app bundle. It does not remove the npm package; its last lines tell you how."
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 347,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest uninstall"
  },
  {
    "file": "docs/guides/desktop-app.md",
    "line": 350,
    "policy": "prose",
    "pattern": "On macOS this deletes `~/Applications/Terum Skills.app` and the download records under `~/.terum/skills/app`. A copy that is running keeps running until you quit it, and cannot be reopened from the Dock. Running `app` downloads it again."
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 10,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest install <ref>"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 32,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest install member ajayw36"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 33,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest install project docs-site"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 36,
    "policy": "prose",
    "pattern": "`install member` installs what that person stands behind, which is their `profile[]` list, not"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 45,
    "policy": "prose",
    "pattern": "`install project` installs every skill the team project lists, at that project's scope. An unknown"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 65,
    "policy": "prose",
    "pattern": "For `install project`, the preselected row is the registered root whose `origin` matches one of the"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 66,
    "policy": "prose",
    "pattern": "team project's remotes. With no match the default is Global. With more than one match nothing is"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 79,
    "policy": "fixed",
    "pattern": "/home/me/dev/web is not a project in your library. Add it with `npx -y terum-skills@latest project add /home/me/dev/web`, or pass --into global."
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 88,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest project add [path]"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 89,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest project remove <path>"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 90,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest project rename <path> --to <name>"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 91,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest project list"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 95,
    "policy": "prose",
    "pattern": "Library reads it from then on: `ls --local`, `publish`, `eval`, and the install destination list."
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 97,
    "policy": "prose",
    "pattern": "`project add` with no argument asks `Which folder?`, offering the nearest enclosing git repository"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 99,
    "policy": "prose",
    "pattern": "or `/home/me/dev/web is already in your library.` When a team is configured it then runs `reconcile`"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 104,
    "policy": "prose",
    "pattern": "off the paths every time and never stored, so it always matches the folder structure: `project list`"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 105,
    "policy": "prose",
    "pattern": "draws a sub-project indented under its parent, `ls --local` names the parent on its section, and the"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 107,
    "policy": "prose",
    "pattern": "`project rename <path> --to <name>` gives any row a name of your own. It changes display text only:"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 114,
    "policy": "prose",
    "pattern": "`project remove` forgets the registration and touches no files:"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 121,
    "policy": "prose",
    "pattern": "`project list` prints one line per project with its label, path, scan state, and skill-folder count,"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 149,
    "policy": "prose",
    "pattern": "install keeps it at `<project>/.claude/old-skills/<name>`. Nothing scans that folder: Claude Code"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 155,
    "policy": "prose",
    "pattern": "move the kept copy elsewhere before retrying.`"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 158,
    "policy": "prose",
    "pattern": "interactive or not, the same way `publish` adds what you publish. `profile --remove deploy-check`"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 169,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest install --adopt ~/.claude/skills/deploy-check"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 174,
    "policy": "prose",
    "pattern": "team skill byte for byte:"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 208,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest uninstall-skill deploy-check"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 209,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest uninstall-skill member ajayw36"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 210,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest uninstall-skill project docs-site"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 213,
    "policy": "prose",
    "pattern": "`uninstall-skill member` is the exact inverse of `install member`: it targets that person's current"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 214,
    "policy": "prose",
    "pattern": "`profile[]` list, and every scope comes from this machine's own ledger. `uninstall-skill project`"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 215,
    "policy": "prose",
    "pattern": "takes back exactly what `install project` placed, at project scope, so a Global copy you installed"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 253,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest sync"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 263,
    "policy": "prose",
    "pattern": "its own hook entry, and accepting the successor offer runs `team move`, which removes and re-places"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 277,
    "policy": "prose",
    "pattern": "`sync --hook` is what a Claude Code session-start hook runs. It differs in four ways:"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 282,
    "policy": "fixed",
    "pattern": "the command `npx -y terum-skills@latest`. The run says `Pinned your session hook to this copy of"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 283,
    "policy": "prose",
    "pattern": "terum-skills (<command>)` and names the `setup` to re-run after your next update. Nothing is"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 287,
    "policy": "prose",
    "pattern": "and missing ones added, printing `Updated your terum-skills skills for this CLI.`, and so is the edit"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 288,
    "policy": "prose",
    "pattern": "hook's script, printing `Updated your terum-skills edit hook for this CLI.` A copy you declined, or never saw offered, is never installed"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 308,
    "policy": "prose",
    "pattern": "Taking it runs `team move` for you. A hook, a pipe or a non-interactive run prints the command"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 309,
    "policy": "fixed",
    "pattern": "instead: ``To follow it, run `npx -y terum-skills@latest team move ryanliu-terum/shared-skills`.``"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 315,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest reconcile"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 316,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest reconcile --list"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 338,
    "policy": "fixed",
    "pattern": "Publish your version of deploy-check as Version 4 of the team's deploy-check? Your folder carries no team id for this name, and the team's copy was published by ajayw36; publishing makes your content the next version of their skill. To keep them separate, rename yours first: npx -y terum-skills@latest skill rename /home/me/.claude/skills/deploy-check --to <new-name>."
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 345,
    "policy": "prose",
    "pattern": "itself after `project add`, over the project that was added."
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 351,
    "policy": "prose",
    "pattern": "| `skill move <path> --to global\\|<project root>` | Moves the folder to another Library root. The original is gone. |"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 352,
    "policy": "prose",
    "pattern": "| `skill copy <path> --to global\\|<project root>` | Copies it into another root. The original stays. |"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 353,
    "policy": "prose",
    "pattern": "| `skill rename <path> --to <new-name>` | Renames the folder and rewrites `name:` in its `SKILL.md`. |"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 354,
    "policy": "prose",
    "pattern": "| `skill delete <path>` | Removes the folder after you type its name. |"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 355,
    "policy": "prose",
    "pattern": "| `skill fix <path>` | Applies every mechanical repair and reports what still needs you. |"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 356,
    "policy": "prose",
    "pattern": "| `skill category <path> --to <name>` | Rewrites `metadata.terum-category`. See [Publishing](publish.md#changing-a-category). |"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 357,
    "policy": "prose",
    "pattern": "| `skill enable <path>` / `skill disable <path>` | Switches the folder on or off for Claude Code on this machine. |"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 403,
    "policy": "prose",
    "pattern": "reach the skill, so they read as enabled and `enable` leaves them alone. A renamed or moved folder"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 408,
    "policy": "prose",
    "pattern": "delete goes there: a drifted copy on uninstall, a deleted non-placement, a displaced folder it could"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 409,
    "policy": "prose",
    "pattern": "not remove, and a team clone with unpushed work on `team leave`."
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 412,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest prune"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 422,
    "policy": "prose",
    "pattern": "| `ls` | The team: members, then one line per shared skill with its author, category, install count, latest version, project listing and last change date. |"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 423,
    "policy": "prose",
    "pattern": "| `ls --local` | Your Library: one section per root, each row's name, placement state and path, then the folders that could not be inspected as skills, then the counts. |"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 424,
    "policy": "prose",
    "pattern": "| `ls member <handle>` | What that member authored and what they have installed. |"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 425,
    "policy": "prose",
    "pattern": "| `ls project <name>` | The skills a team project lists. |"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 426,
    "policy": "prose",
    "pattern": "| `search <term>` | Shared skills whose name, description or category contains the term. |"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 427,
    "policy": "prose",
    "pattern": "| `status` | This machine: CLI version, the configured team and your handle, its repository, clone state, the first five members and the roster size, the shared skill count, and whether the clone may be stale. |"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 429,
    "policy": "prose",
    "pattern": "`search` narrows with `--category`, `--author` and `--project`, each matched as a substring except"
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 437,
    "policy": "fixed",
    "pattern": "acme may be stale; run `npx -y terum-skills@latest sync`."
  },
  {
    "file": "docs/guides/install-and-manage.md",
    "line": 440,
    "policy": "prose",
    "pattern": "`ls --local` is the one that shows folders which are not shareable. A folder the scan could not"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 8,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest publish <skill-or-path>"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 13,
    "policy": "prose",
    "pattern": "registered with `project add`. A path that resolves outside those roots is not found, so publish can"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 21,
    "policy": "fixed",
    "pattern": "| A configured team with a joined handle | `npx -y terum-skills@latest setup <org>/<repo>`. Publish refuses with `Team <team> has no joined handle.` when the machine has a team entry but never completed a join. |"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 22,
    "policy": "fixed",
    "pattern": "| A folder that passes hygiene | `npx -y terum-skills@latest validate <path>` reports every finding. `npx -y terum-skills@latest skill fix <path>` repairs the mechanical ones. |"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 24,
    "policy": "prose",
    "pattern": "`validate` runs the same deterministic checks publish runs, offline and with no model call. `skill"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 25,
    "policy": "prose",
    "pattern": "fix` writes only the repairs whose right answer is fixed by something outside your typing: YAML"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 35,
    "policy": "prose",
    "pattern": "`validate` needs a configured team, because the licence check reads the team's policy."
  },
  {
    "file": "docs/guides/publish.md",
    "line": 40,
    "policy": "prose",
    "pattern": "lock. If another terum-skills command holds that lock, publish waits (about 75 seconds at a"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 41,
    "policy": "prose",
    "pattern": "terminal, about 4 seconds when nothing can be asked) and prints `Waiting for another terum-skills"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 73,
    "policy": "prose",
    "pattern": "| `metadata.author` | `Name <email>` from your identity. Change it with `login --set`. |"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 89,
    "policy": "prose",
    "pattern": "| HYG4 | A file extension that is not on the allowlist. Refuses. Publish waives the executable-mode and shebang findings; `validate` does not. |"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 134,
    "policy": "prose",
    "pattern": "`Your profile now lists deploy-check at Version 4.` Typing `publish` is the endorsement, so"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 142,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest profile --remove deploy-check"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 145,
    "policy": "prose",
    "pattern": "`profile --remove` matches the skill name or the uuid on the entry itself, so it works for a"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 177,
    "policy": "prose",
    "pattern": "`publish` still reads `opens a pull request under policy \"pr\", commits directly under policy"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 198,
    "policy": "prose",
    "pattern": "After it writes generated assets, `eval` prints `That changes the skill's content: the next publish"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 204,
    "policy": "prose",
    "pattern": "`publish --category` fills a category in; it never replaces a declared one. The editor is a separate"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 208,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest skill category ~/.claude/skills/deploy-check --to ops"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 223,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest publish deploy-check"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 232,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest unpublish <skill>"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 237,
    "policy": "prose",
    "pattern": "publish has to be retractable by whoever notices it. The typed-name confirmation is the whole brake."
  },
  {
    "file": "docs/guides/publish.md",
    "line": 259,
    "policy": "prose",
    "pattern": "**What stays.** Installed copies on other machines keep working until each machine runs `sync`, which"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 278,
    "policy": "prose",
    "pattern": "The `unpublish` help text adds `Republishing starts again at Version 1 under a new id.` The uuid half"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 287,
    "policy": "prose",
    "pattern": "| `No local skill folder named deploy-check in your library. Inspect it with …` | No Library root holds an entry by that name. Add the project holding it with `project add`. |"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 291,
    "policy": "prose",
    "pattern": "| `HYG1 SKILL.md: SKILL.md field metadata.id is invalid …` | A hygiene error. Run `validate`, then `skill fix` for the mechanical ones. |"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 292,
    "policy": "prose",
    "pattern": "| `deploy-check is no longer in the repository as 4f3a19c2; run sync and retry.` | The team's newest version of that name carries a different uuid. Someone republished the name, or two people have a folder with the same name. Run `sync` and look at `ls` before retrying. |"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 293,
    "policy": "prose",
    "pattern": "| `Another terum-skills operation holds the write lock on acme; retry when it finishes.` | Another command is writing the clone. Wait and retry. |"
  },
  {
    "file": "docs/guides/publish.md",
    "line": 295,
    "policy": "prose",
    "pattern": "| `Unknown project docs-site.` | `--project` named a project the team does not have. Create it with `team project create`. |"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 10,
    "policy": "prose",
    "pattern": "handle is not in `team.json`'s `archived` list. Nothing else grants or records membership. `status`"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 22,
    "policy": "prose",
    "pattern": "moment it matters. `team remove` asks `repos/<owner>/<repo>` for `.permissions.admin` before it"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 24,
    "policy": "prose",
    "pattern": "the answer is not `true`. `status --permissions` adds one network call that lists the repository's admin"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 28,
    "policy": "prose",
    "pattern": "**`profile --role` is a label.** It writes a free-text `role` string of up to 32 characters onto your"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 36,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest invite ada grace"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 72,
    "policy": "prose",
    "pattern": "npm install -g terum-skills"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 73,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest setup acme/skills"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 75,
    "policy": "fixed",
    "pattern": "Bare equivalent: npx -y terum-skills@latest team join acme/skills"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 80,
    "policy": "prose",
    "pattern": "The global install is optional. It exists so the bare `terum-skills` command works on their machine;"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 86,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest team remove ada-handle"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 87,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest team remove ada-handle --archive-only"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 110,
    "policy": "prose",
    "pattern": "remove ada-handle --archive-only` to archive the membership.``"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 140,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest team leave acme"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 143,
    "policy": "prose",
    "pattern": "`team leave` is machine-local. It writes nothing to the team repository, and your membership is"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 177,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest team move acme/shared-skills"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 181,
    "policy": "prose",
    "pattern": "three-command chore. `team move` does it in order: tear the old team down locally, join the target,"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 207,
    "policy": "fixed",
    "pattern": "https://github.com/acme/shared-skills failed: <error> Run `npx -y terum-skills@latest team join"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 210,
    "policy": "prose",
    "pattern": "`sync` offers this move by itself when a GitHub team's repository answers \"repository not found\". See"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 218,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest login --set name=\"Ada Lovelace\" --set email=ada@example.com"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 219,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest login --set default-handle=ada-handle"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 229,
    "policy": "prose",
    "pattern": "Already-published versions are immutable, so they keep the author they were minted with. Bare `login`"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 243,
    "policy": "prose",
    "pattern": "`profile` refuses to change `email`, `github` or `handle`: those are bound by join and prove who you"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 248,
    "policy": "prose",
    "pattern": "`profile[]` is what a teammate installs with `install member <handle>`. Publishing adds an entry"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 258,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest team project create docs-site --remote https://github.com/acme/web"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 259,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest team project delete docs-site"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 263,
    "policy": "prose",
    "pattern": "project name is 1 to 64 characters: letters, digits, spaces, dot, underscore or hyphen, and cannot"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 275,
    "policy": "prose",
    "pattern": "project named Docs.`"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 277,
    "policy": "prose",
    "pattern": "`create` prints two lines, and the second depends on whether it has a repository:"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 290,
    "policy": "prose",
    "pattern": "the destination. When a teammate runs `install project docs-site`, the registered project root whose"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 296,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest publish deploy-check --project docs-site"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 299,
    "policy": "prose",
    "pattern": "and teammates take the whole list with `install project docs-site`."
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 301,
    "policy": "prose",
    "pattern": "`delete` removes the list and never a skill. The confirmation says so, because that is the only"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 310,
    "policy": "prose",
    "pattern": "team retires a project card it no longer wants."
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 314,
    "policy": "prose",
    "pattern": "`status` is the read that answers \"what does this machine think the team is\": the CLI version, the"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 323,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest team migrate"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 326,
    "policy": "prose",
    "pattern": "`team migrate` brings a team repository to layout 3: every skill's files move into `v1/`, receipts are"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 334,
    "policy": "prose",
    "pattern": "team migrate is a terminal-only operation; run it without --frames after the auto-share removal release has propagated."
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 342,
    "policy": "prose",
    "pattern": "this team repository uses an older layout; an admin should run `team migrate` to upgrade it"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 359,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest team workflow-update --print"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 365,
    "policy": "fixed",
    "pattern": "`npx -y terum-skills@latest team workflow-update` is print-only; pass --print."
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 368,
    "policy": "prose",
    "pattern": "After the YAML it prints `Commit this to .github/workflows/terum-skills.yml in an ordinary PR by"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 371,
    "policy": "prose",
    "pattern": "The workflow that `team create` commits has four jobs. Two of them do work today:"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 375,
    "policy": "prose",
    "pattern": "| `hygiene` | Pull requests to `main` | Runs `validate` over every skill name touched by the diff under `skills/`. |"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 376,
    "policy": "prose",
    "pattern": "| `readme` | Pushes to `main` | Runs `readme` and commits the regenerated `README.md` when it changed. |"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 377,
    "policy": "prose",
    "pattern": "| `receipt-check` | Pull requests from a `publish/` branch | Never fires. |"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 381,
    "policy": "prose",
    "pattern": "straight to `main` and creates no branch, so no pull request ever has a `publish/` head. `receipt-check`"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 382,
    "policy": "prose",
    "pattern": "itself is retired and answers `receipt-check is retired; publish records receipts when it mints a"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 386,
    "policy": "prose",
    "pattern": "update path is a print and a pull request you make yourself."
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 393,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest team create acme --remote https://git.example.com/acme/skills.git"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 394,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest team join https://git.example.com/acme/skills.git"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 397,
    "policy": "prose",
    "pattern": "`team create --remote` needs an **empty** repository that you already have credentials for. A remote"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 404,
    "policy": "prose",
    "pattern": "| Creating, joining, publishing, unpublishing, installing, syncing | `invite` |"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 405,
    "policy": "prose",
    "pattern": "| `team remove --archive-only` | `team remove` without `--archive-only` |"
  },
  {
    "file": "docs/guides/team-admin.md",
    "line": 414,
    "policy": "prose",
    "pattern": "`team remove <handle> --archive-only` and `team join`."
  },
  {
    "file": "docs/migration-layout-3.md",
    "line": 3,
    "policy": "prose",
    "pattern": "Batch B8 builds `terum-skills team migrate`. Shipping this command does not authorize running it."
  },
  {
    "file": "docs/migration-layout-3.md",
    "line": 13,
    "policy": "prose",
    "pattern": "project cards, whatever they are named, are carried across untouched; `team project delete`"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 3,
    "policy": "prose",
    "pattern": "Every command terum-skills registers, what it asks, what it writes, and how it refuses."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 10,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest ls"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 13,
    "policy": "prose",
    "pattern": "If you install the package globally (`npm install -g terum-skills`), the same commands work under the bare name:"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 16,
    "policy": "prose",
    "pattern": "terum-skills ls"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 19,
    "policy": "fixed",
    "pattern": "The CLI detects which form you used and prints follow-up commands back in that form. It only uses the bare form when this copy was launched from a global install, the first `terum-skills` on your `PATH` resolves to that same copy, no `npm_*` environment variable is set, and the platform is not Windows. Everything else, including every npx run and every Windows run, prints the `npx -y terum-skills@latest …` form. This is a display hint only. It never changes what the command does."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 27,
    "policy": "prose",
    "pattern": "`-h, --help` prints the command list. It works on the program, on a group (`team`, `team project`, `skill`, `project`, `ls`) and on every individual command, and commander also registers `help [command]`, which prints the same text. Help is free everywhere except on `serve`: `serve --help` prints its help, then writes the line `{\"t\":\"result\",\"verb\":\"serve\",\"ok\":false,\"exitCode\":1,\"error\":\"(outputHelp)\"}` to stdout and exits 1, because the bin sends every `serve` invocation into the session path before it looks at the flag."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 33,
    "policy": "fixed",
    "pattern": "Create a team: npx -y terum-skills@latest setup"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 34,
    "policy": "fixed",
    "pattern": "Join a team:   npx -y terum-skills@latest setup <org>/<repo>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 45,
    "policy": "prose",
    "pattern": "`--frames` turns the CLI into a JSON-line channel for another program. The flag is global and position-independent: it is taken off `process.argv` before the command parser sees it, so `--frames ls` and `ls --frames` are identical, and after a `--` separator it is an ordinary operand. In frame mode the CLI writes one JSON object per stdout line (`hello`, `print`, `ask`, `progress`, `result`), reads `answer` and `cancel` objects on stdin, and sends every diagnostic to stderr so stdout stays parseable. Exactly one `result` frame ends a run. Two commands refuse the flag: `sync --hook` and `team migrate`. The full contract, including the feature map in the `hello` frame, is in [the frame protocol](../frame-protocol.md)."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 49,
    "policy": "prose",
    "pattern": "terum-skills keeps one team per machine. `team create`, `team join` and `setup` refuse to bind a second one before they do anything, and say which team is already bound and how to leave it."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 51,
    "policy": "prose",
    "pattern": "A machine can still end up with more than one configured team (it was configured before that rule, or a team was added under a second name), so most commands accept `--team <team>`. It is hidden from `--help` on every command except `eval` and `eval-report`. How a command picks a team:"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 59,
    "policy": "fixed",
    "pattern": "| More than one team, no `--team` | `` This machine is configured for teams a, b; Terum Skills keeps one team per machine. Run `npx -y terum-skills@latest team leave <name>` for each you no longer want; until then name one with --team. `` |"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 61,
    "policy": "prose",
    "pattern": "`install` and `uninstall-skill` parse the ref's own team parts before anything else. `publish`, `unpublish`, `team project create` and `team project delete` go through the same resolver but hand it no ref parts, so only the last rule below reaches them:"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 63,
    "policy": "fixed",
    "pattern": "- A three-part ref, `owner/repo/skill`, names the repository `github.com/owner/repo`. If that repository is the configured team, it is used. If the machine is on a different team, the one-team rule refuses. If the machine has no team at all, `install` continues by running `setup <org>/<repo>` in quiet mode and then installing, while `uninstall-skill` stops with `` This machine has not joined <remote>; run `npx -y terum-skills@latest team join <org>/<repo>` first. ``"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 65,
    "policy": "prose",
    "pattern": "- A bare ref on a machine with more than one team and no `--team` fails with `A bare skill ref is ambiguous across configured teams; use <team>/<skill> or --team. Matching refs: a/x, b/x.` The second sentence appears only where the verb passed a skill name, so `unpublish` and the two `team project` commands print the first sentence alone."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 67,
    "policy": "prose",
    "pattern": "`status`, `search`, `sync`, `reconcile` and `uninstall` run over every configured team when no `--team` is given."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 77,
    "policy": "prose",
    "pattern": "`--help` and `--version` exit 0, with the `serve --help` exception above. A reader that closes the pipe (`… | head -5`) is not a failure: the CLI marks its output broken so a later question fails closed instead of waiting on a prompt nobody can see."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 86,
    "policy": "prose",
    "pattern": "| `TERUM_SKILLS_AGENT_CMD` | The command `eval` runs as the agent. Defaults to `claude`. |"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 89,
    "policy": "prose",
    "pattern": "| `LOCALAPPDATA` | Windows only. Where `app` and `app-update` install and look for the desktop app. |"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 90,
    "policy": "prose",
    "pattern": "| `PATH` | Read to decide whether the bare invocation form is available, read again with `PATHEXT` and `USERPROFILE` when `eval` resolves the agent command on Windows, and recorded in `~/.terum/skills/run/app.json` so the desktop app can start this CLI. |"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 93,
    "policy": "prose",
    "pattern": "None of these suppress the release probe itself. `update` and `app-update --check` still ask GitHub for release tags; only the one-line notice is suppressed."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 97,
    "policy": "fixed",
    "pattern": "`team` is a group. `npx -y terum-skills@latest team` lists its subcommands."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 102,
    "policy": "prose",
    "pattern": "Usage: terum-skills setup [options] [target]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 105,
    "policy": "fixed",
    "pattern": "Arguments: `[target]`, optional. Either `<org>/<repo>` on GitHub or any git remote URL. With a target, setup joins that repository. Without one it asks whether to create a team or join one, but only on a machine with no team configured. With one configured it prints `` Resuming setup for team <x>. Terum Skills keeps one team per machine; to move this machine to another team run `npx -y terum-skills@latest team leave <x>` first. `` and never asks."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 115,
    "policy": "prose",
    "pattern": "What it does: setup is the onboarding wizard, and the desktop app comes before the team. Only the welcome lines, the move question below and the one-team check run ahead of it. Where an app exists for the platform and a person is at an interactive terminal, setup installs and opens the app without asking, prints `Continuing in the app.` (or `Continuing in the app. Join <org>/<repo> there.` when a target was given and the move question did not fire) and returns. The team is then created or joined inside the app. The terminal wizard continues only when the app step is skipped: on Linux and WSL, over a pipe, over frames, with `--no-app`, in `install`'s quiet bootstrap, or when the app hand-off fails. In the terminal it then asks the create-or-join question, checks the GitHub CLI, creates or joins the team, invites teammates, offers to add a project, reconciles your Library against the team, offers to evaluate shared skills with no receipt, offers the session hook, places the eight terum-skills skills for Claude Code and Codex, and finally offers the edit hook. When the app hand-off had failed for a cause the wizard can change (gh logged out, offline), setup tries the app once more after the closing summary, without a target; a cause that cannot change, such as no app published for this version or a rejected download, is not retried. A bare `setup` cannot join: choosing \"Join an existing team\" prints the command to ask the team owner for and exits having written nothing."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 122,
    "policy": "prose",
    "pattern": "- Everything `team create` or `team join` asks"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 125,
    "policy": "prose",
    "pattern": "- Everything `reconcile` asks about your existing Library folders"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 128,
    "policy": "prose",
    "pattern": "- `Remind Claude Code to publish a skill after it edits one? (installs ~/.terum/skills/hooks/terum-skills-edit.mjs and a Write/Edit hook in ~/.claude/settings.json)`"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 130,
    "policy": "prose",
    "pattern": "The last two default to No, and each one prints the absolute path it would write rather than the `~` form shown here. Between them setup places the eight skills without a question and prints `Installed the terum-skills skills at <root>: <names>.` for each root it wrote. See [local state](local-state.md) for exactly what each one writes."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 132,
    "policy": "prose",
    "pattern": "Two of the things setup writes carry a `terum-skills` command that later runs without you typing it: the `SessionStart` hook entry and the `/terum-skills` manual. Both name this copy of the CLI rather than the registry's newest release. Where the bare invocation form is available they name `terum-skills`; everywhere else, including every Windows machine and every npx run, they name `npx -y terum-skills@<this version>`. Nothing fetches a newer CLI at the start of a session. After you update the package, re-run `setup` once and both move to the new copy."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 134,
    "policy": "prose",
    "pattern": "Writes: `~/.terum/skills/config.json`, the team clone under `~/.terum/skills/teams/<team>/`, the eight skill folders under `~/.claude/skills/` (and under `~/.codex/skills/` when `~/.codex` exists), and whichever of `~/.claude/settings.json` and `~/.terum/skills/hooks/terum-skills-edit.mjs` you accept. On macOS and Windows it also installs the desktop app. It writes the team repository through `team create` or `team join` only."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 136,
    "policy": "prose",
    "pattern": "Fails when: the machine is already on a different team; you are creating a team on GitHub without a logged-in `gh`; the clone directory exists but is not a complete clone of that remote; an invitation hits GitHub's cap, a permission refusal or an authentication failure; or the delegated `team create` or `team join` fails for any of its own reasons, which aborts the wizard. A failed invite prints what is already durable and how to finish before it exits."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 141,
    "policy": "prose",
    "pattern": "Usage: terum-skills login [options]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 150,
    "policy": "prose",
    "pattern": "What it does: records this machine's identity in `config.json`: GitHub login, team handle, display name and email. Bare, it checks the GitHub CLI first, then collects the four fields, then prints one of three lines about `gh` and `Identity saved: <Name> <email> (@login), default handle <handle>.` With `--set` it prompts for nothing and accepts only the keys `name`, `email` and `default-handle`. It never writes a team entry: only `team create` and `team join` do that, because only they prove your handle against the roster."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 161,
    "policy": "prose",
    "pattern": "Usage: terum-skills status [options]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 171,
    "policy": "fixed",
    "pattern": "What it does: prints the CLI version, then for each configured team its handle, its repository as `https://github.com/<owner>/<repo>`, clone state, member count with the first five members, the number of shared skills, the literal line `Evaluated skills: not yet available`, and the staleness line `` <team> may be stale; run `npx -y terum-skills@latest sync`. `` A membership line appears only when your entry is archived or absent; an active member sees none. It reads the local clone and never fetches, so exit 0 means the query succeeded, not that the setup is healthy or that you still have access. With no team configured it prints the get-started lines and still exits 0. `--permissions` is the only thing here that touches the network."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 173,
    "policy": "prose",
    "pattern": "The staleness line is not a timer alone. The stamp counts as fresh only when `~/.terum/skills/run/<team>.stamp` exists, is a file, and was written in the last hour without being dated more than a minute into the future. A machine that has never synced has no stamp, so its first `status` prints the line."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 184,
    "policy": "prose",
    "pattern": "Usage: terum-skills invite [options] <github-login...>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 193,
    "policy": "prose",
    "pattern": "What it does: adds each login as a collaborator on the team's GitHub repository through `gh api -X PUT --include repos/<owner>/<repo>/collaborators/<login>`. `--include` is load-bearing: the status branches below are read out of the `HTTP/… <code>` header it prints. The whole batch is validated for syntax before a single invitation is sent, so a typo costs nothing. Per login it prints `Invited @x.` (201), `@x already has access.` (204) or `@x already has access (owner).` (422 on the repository owner). It always ends by printing the block to send a teammate, which carries `npm install -g terum-skills`, the `setup <org>/<repo>` command and a `team join` line labelled `Bare equivalent:` although it too is written in the npx form. Invitations carry no permission parameter, so GitHub grants its default (push)."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 204,
    "policy": "prose",
    "pattern": "Usage: terum-skills profile [options]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 218,
    "policy": "prose",
    "pattern": "What it does: rewrites your own `people/<handle>.json` in the team repository in one write. It is the team-facing profile, not the machine identity that `login` sets. `--remove` takes one entry off the curated `profile[]` list that publishing adds to, matched on the entry's own copy of the name or its id, so it works for a skill whose folder is long gone. Every run also refreshes your `local_skills` count, unless the Library could not be counted, in which case the old number stands. `--name` is mirrored back into `config.display_name` locally. It prints `Updated <handle>: <fields>.` or `No profile changes for <handle>.`"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 224,
    "policy": "prose",
    "pattern": "Fails when: you try to change `email`, `github` or `handle` (`profile cannot change <field>.`, checked before anything is read); no team resolves; the clone has no `team.json` and `--project` was given (`Missing team.json.`); a `--project` names a project that is not in `team.json` (`Unknown project <project>.`); your person file is missing (`Missing people/<handle>.json.`); `--remove` names something not on your profile (`<name> is not on your profile.`)."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 229,
    "policy": "prose",
    "pattern": "Usage: terum-skills team create [options] [name]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 240,
    "policy": "prose",
    "pattern": "What it does: creates the team's private repository, scaffolds it, and binds this machine to it. On the GitHub path it runs `gh repo create <spec> --private`, sets delete-branch-on-merge, then pushes a bootstrap commit holding `team.json` (layout version 3, seven default categories, an empty project list, `policy.skill_license` of `UNLICENSED`), your `people/<handle>.json`, `skills/.gitkeep`, `evals/.gitkeep`, a generated `README.md` and `.github/workflows/terum-skills.yml`. With `--remote <url>` it uses an existing empty repository and your ambient git credentials, and needs no GitHub CLI at all. There is no clone step on either path: the scaffold is committed in a staging repository beside the clone path, pushed with `-u`, armed with the pre-push guard, and then renamed into `~/.terum/skills/teams/<team>/`. A failure at any point leaves only the staging directory, which is removed. It then writes the team entry into `config.json` and offers the session hook, whose entry names this copy of the CLI the way [setup](#setup) describes."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 246,
    "policy": "fixed",
    "pattern": "Fails when: a team is already configured on this machine; `--repo` or `--org` is combined with `--remote`; the name is already configured for another remote (`<remote> is already configured as team <name>.`); a clone directory already exists at that path; `gh` is missing or logged out on the GitHub path; `--remote` cannot be reached (`Cannot reach <remote>: …`); the repository name is taken three times, or `gh repo create` fails for any other reason (`Could not create the GitHub repository <spec>: …`); the new repository's owner cannot be resolved (`Created <spec> but could not resolve its owner: …`); the scaffold push or the clone rename fails, which prints advice distinguishing a pushed scaffold from an untouched repository; another process configures a team while this one is running; `--remote` points at a repository that already has branches. That last message reads `` <remote> already has branches; `npx -y terum-skills@latest team create --remote` needs an empty repository. To join an existing team run `npx -y terum-skills@latest team join <remote>`. ``"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 251,
    "policy": "prose",
    "pattern": "Usage: terum-skills team join [options] <target>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 271,
    "policy": "prose",
    "pattern": "Usage: terum-skills team leave [options] <name>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 280,
    "policy": "prose",
    "pattern": "Asks: `Leave <name>? This removes N placed skill(s), the local clone and your skill consent records; your membership in <remote> is unchanged.` (the middle clause is `and the local clone` when other teams remain). Leave prints `<remote>` as the stored remote with any credentials stripped, so `github.com/acme/skills`, where `status` and `team move` print the same repository as `https://github.com/acme/skills`."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 284,
    "policy": "prose",
    "pattern": "Fails when: the team is not configured; you decline the confirmation (`Leave was cancelled.`); another terum-skills sync holds the session lock on that team, or the clone's own writer lock cannot be taken."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 289,
    "policy": "prose",
    "pattern": "Usage: terum-skills team move [options] <target>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 301,
    "policy": "prose",
    "pattern": "The teardown is the same code `team leave` runs, with two deliberate differences. Move never removes the session hook, because the next step binds a team again inside the same run, and it never re-offers the hook on the join half. It also asks for no second confirmation once you have answered the one below."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 303,
    "policy": "prose",
    "pattern": "Asks: `Move this machine from <from> (<url>) to <url>?` with the detail lines about re-placement and the replaced clone, unless `--yes`. From `team join`: the `gh auth login` offer always, a handle collision always, and the identity questions only where this machine never recorded a full identity."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 305,
    "policy": "prose",
    "pattern": "Writes: everything the teardown removes and everything `team join` writes apart from the hook, plus one placement per restored skill and your `people/<handle>.json` install rows in the new repository."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 307,
    "policy": "fixed",
    "pattern": "Fails when: the target is already this team's remote; the confirmation is declined or the caller is non-interactive without `--yes`; the join fails after the teardown succeeded, which reports `` Left <from>, but joining <url> failed: … Run `npx -y terum-skills@latest team join <target>` to finish the move. `` Both `<url>` values there are rendered as `https://github.com/<owner>/<repo>` for a GitHub remote, not as you typed them."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 312,
    "policy": "prose",
    "pattern": "Usage: terum-skills team remove [options] <handle>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 333,
    "policy": "prose",
    "pattern": "Usage: terum-skills team migrate [options]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 348,
    "policy": "prose",
    "pattern": "Fails when: run with `--frames` (`team migrate is a terminal-only operation; run it without --frames after the auto-share removal release has propagated.`); or any of the migration's own refusals. Most carry the prefix `Migration refused:` (an invalid skill folder name, a name the SKILL.md contradicts, a version path that already exists, duplicate ids, a conflicting `version_tree`, a missing HEAD tree identity, a missing path, an unexpected or misfiled receipt path, a destination that exists, a non-regular file). Some do not: an unreadable `skills/<name>/SKILL.md` fails as `Invalid skills/<name>/SKILL.md: <error>`, and the layout-3 validation of the rewritten `team.json` and people files fails under their own names. It also fails when the repository reached layout 3 but the push guard could not be re-armed."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 353,
    "policy": "prose",
    "pattern": "Usage: terum-skills team project create [options] [name]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 365,
    "policy": "prose",
    "pattern": "That first line is stale. `sync` places nothing: it fetches each clone and resets it, and auto-share is gone. What the remote does today is preselect the destination when a teammate runs `install project <name>` inside that checkout. The option's own help text says so correctly (\"its skills place when a teammate installs inside that folder\"), and only the printed confirmation still says \"syncs\"."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 371,
    "policy": "prose",
    "pattern": "Fails when: the team has no joined handle; the clone cannot be refreshed, because it is locked, stale or its remote is unreachable; no name was given and the caller is non-interactive (`Specify a project name.`); the clone is not a team repository (`This repository has no team.json; it is not a terum-skills team repo.`); the name fails the project-name rule; the team already has a project with that name, ignoring case; another project already claims that remote (`<project> already claims <remote>; a repository belongs to one project.`); the write produced nothing (`Nothing was written for project <name>; rerun the command.`)."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 376,
    "policy": "prose",
    "pattern": "Usage: terum-skills team project delete [options] [name]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 392,
    "policy": "prose",
    "pattern": "Fails when: the team has no joined handle; the clone cannot be refreshed; no name was given and the caller is non-interactive; the clone is not a team repository (`This repository has no team.json; it is not a terum-skills team repo.`); the team has no project with exactly that name; you decline the confirmation (`Project <name> was not deleted.`); the write produced nothing (`Nothing was written for project <name>; rerun the command.`)."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 397,
    "policy": "prose",
    "pattern": "Usage: terum-skills team workflow-update [options]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 406,
    "policy": "prose",
    "pattern": "What it does: prints the current GitHub Actions workflow scaffold byte for byte, followed by `Commit this to .github/workflows/terum-skills.yml in an ordinary PR by someone with push access.` It never writes a repository: an existing team updates its workflow through a normal pull request, reviewed like any other change to the repository."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 412,
    "policy": "fixed",
    "pattern": "Fails when: `--print` was not passed. The message is `` `npx -y terum-skills@latest team workflow-update` is print-only; pass --print. ``"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 416,
    "policy": "fixed",
    "pattern": "`skill` and `project` are groups. `npx -y terum-skills@latest skill` and `… project` list their subcommands."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 421,
    "policy": "prose",
    "pattern": "Usage: terum-skills ls [options] [command]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 424,
    "policy": "prose",
    "pattern": "Arguments: none, or the subcommand `member` or `project`."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 431,
    "policy": "prose",
    "pattern": "What it does: without `--local`, prints the team inventory from the local clone: `Members:` with `(inactive)` beside archived handles, then one line per shared skill in the form `name — author; category; N installs; Version K; endorsement; date`, then a pointer to `ls --local`. It never fetches, so what you see is the clone as of the last sync. With `--local` it scans Global (`~/.claude/skills`) and every registered library project, and joins each folder against every configured clone by content digest, never by name, so each row can say which team version it matches, whether it is an installed placement, whether it has drifted from what was placed, whether Claude Code has it switched off, and what its evals say."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 437,
    "policy": "prose",
    "pattern": "Fails when: `--local` is combined with `member` or `project` (`--local cannot be combined with member or project.`); `--local` is combined with `--team` (`--local lists every configured team; drop --team.`); the selected team's `team.json` or people directory cannot be read."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 442,
    "policy": "prose",
    "pattern": "Usage: terum-skills ls member [options] <handle>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 449,
    "policy": "prose",
    "pattern": "| `--team` (hidden) | `<team>` | the parent `ls` value, then the configured team | Configured team, required when more than one exists. |"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 451,
    "policy": "prose",
    "pattern": "This subcommand has no description of its own, so `ls --help` lists it with an empty description."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 464,
    "policy": "prose",
    "pattern": "Usage: terum-skills ls project [options] <name>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 471,
    "policy": "prose",
    "pattern": "| `--team` (hidden) | `<team>` | the parent `ls` value, then the configured team | Configured team, required when more than one exists. |"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 475,
    "policy": "prose",
    "pattern": "What it does: prints `Project <name>:` and one line per skill the project lists, in the same format `ls` uses."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 486,
    "policy": "prose",
    "pattern": "Usage: terum-skills search [options] <term>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 499,
    "policy": "prose",
    "pattern": "What it does: searches the local clones. It is read-only and offline, prints hits through the same line format `ls` uses, and adds a staleness line per team when that clone has not been fetched within the hour. An empty result prints `No skills found.`"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 505,
    "policy": "fixed",
    "pattern": "Fails when: every configured team failed. A team that is not cloned yet prints ``<team> is not cloned yet; run `npx -y terum-skills@latest sync`.``, any other team-level problem prints `<team> could not be searched: <reason>`, and a team whose hits all have unreadable history counts as failed with `<team>: no skill history could be read; see the per-skill reasons above.` Each of those only fails the run when no other team succeeded."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 510,
    "policy": "prose",
    "pattern": "Usage: terum-skills project add [options] [path]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 517,
    "policy": "prose",
    "pattern": "What it does: registers a folder as a library project, so its `.claude/skills` directory becomes one of the roots terum-skills reads and installs into. Registration is explicit: the current working directory is never a project, and nothing is inferred from the placement ledger. After a folder is actually added, and only when a team is configured, it runs `reconcile` scoped to that root so a folder you already have can be recorded as installed or published. Over frames or a pipe that reconcile runs in list mode and offers nothing. A reconcile that fails does not fail the add: it prints `Could not check that project against the team: <reason>` and the project stays registered."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 521,
    "policy": "prose",
    "pattern": "Writes: `config.projects[]` in `~/.terum/skills/config.json`. Adding a project relabels the whole set, so adding `/b/web` renames an existing `/a/web` row. A folder inside a registered project is added as its sub-project and labelled by its path inside the parent (`Added <path> to your library as a sub-project of <label>.`); a folder above registered projects adopts them as its sub-projects and says so. The tree is read off the paths and never stored. A name chosen with `project rename` is kept; only derived labels move."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 528,
    "policy": "prose",
    "pattern": "Usage: terum-skills project remove [options] <path>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 546,
    "policy": "prose",
    "pattern": "Usage: terum-skills project list [options]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 562,
    "policy": "prose",
    "pattern": "Usage: terum-skills project rename [options] <path>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 582,
    "policy": "prose",
    "pattern": "Usage: terum-skills reconcile [options]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 592,
    "policy": "prose",
    "pattern": "What it does: compares the folders in your Library that terum-skills does not already track against every published version in the selected teams, by content digest. It prints `Checking your library against the team…`, then classifies each candidate as identical (same bytes, same name), renamed (same bytes, different folder name) or differing (same name, different bytes). Renamed rows are reported as `<path> holds the bytes of <name> Version K under a different folder name; nothing is offered for it.` and nothing is offered for them. It then prints the count line `N of your skills match the team's exactly; M share a name with a team skill but differ.`, or `Nothing to reconcile: none of your skills match a team skill by bytes or by name.` Interactively it walks the identical rows offering to record them as installed, and the differing rows offering to publish yours as the next version, and ends `Recorded N installs. Published M skills.` Rows are independent: a failure on one is printed and the next is still offered."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 594,
    "policy": "prose",
    "pattern": "Asks: `Record <name> as installed (Version K)?` per identical row. Per differing row, `Publish your version of <name> as Version K of the team's <name>? Your folder carries the team's id for <name>.` when the ids match, and otherwise a longer sentence naming the team's author and ending with the `skill rename` command that would keep the two apart."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 603,
    "policy": "prose",
    "pattern": "Usage: terum-skills skill move [options] <path>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 623,
    "policy": "prose",
    "pattern": "Usage: terum-skills skill copy [options] <path>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 632,
    "policy": "prose",
    "pattern": "What it does: copies a Library folder into another root and leaves the original where it is. The copy is staged and renamed into place, so a partial folder is never visible. The copy gets no ledger row and no `.git/info/exclude` entry: it is a plain folder you now own in a second root, the same shape a hand-written skill has. Because it carries the source's `metadata.id`, `ls` still joins the two to one skill."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 638,
    "policy": "prose",
    "pattern": "Fails when: the same conditions as `skill move`."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 643,
    "policy": "prose",
    "pattern": "Usage: terum-skills skill rename [options] <path>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 663,
    "policy": "prose",
    "pattern": "Usage: terum-skills skill delete [options] <path>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 670,
    "policy": "prose",
    "pattern": "What it does: the only `skill` subcommand that asks. If the folder is a recorded team placement it delegates to the uninstall path, which also drops your install record in the team repository, and prints `This skill was installed from the team — deleting it also removes it from your installs.` Otherwise it moves the folder to `~/.terum/skills/quarantine/<stamp>/<name>` and prints `Moved <src> to <dst>. Undo by moving it back before prune.` Either way it clears the folder's `skillOverrides` off-switch, so a folder written again under that name is not born disabled."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 681,
    "policy": "prose",
    "pattern": "Usage: terum-skills skill fix [options] <path>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 688,
    "policy": "prose",
    "pattern": "What it does: applies only the repairs that have one right answer, then tells you what still needs you. It quotes a frontmatter scalar that YAML refuses, sets `name:` to the folder name, sets `license:` to the team's policy license, strips the invisible characters HYG2 flags from every text file, and clears the executable bit on a file with no shebang. Then it re-runs the same inspection and hygiene gate that `validate` uses and prints `Still needs you (N):` with the remainder, or `<name>: hygiene passes.` / `<name>: nothing to fix; hygiene passes.` With no readable team there is no policy license to conform to, so `license` is left alone."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 699,
    "policy": "prose",
    "pattern": "Usage: terum-skills skill category [options] <path>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 708,
    "policy": "prose",
    "pattern": "What it does: rewrites `metadata.terum-category` in the local SKILL.md and stops. There is no publish, no network call and no team write. A value the team already spells differently takes the team's spelling, so `--to Ops` lands in the one `ops` bucket. An off-list value is written and given the same warning HYG7 prints. Because a published category lives inside an immutable version folder, the command then says what the team still shows and prints the `publish` that would mint the next version."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 714,
    "policy": "prose",
    "pattern": "Fails when: `--to` is empty (`--to must be a non-empty category name.`); the folder has no SKILL.md (`<path> has no SKILL.md; there is no category to change.`); the frontmatter is not readable YAML (``<path>: SKILL.md frontmatter is not readable YAML; run `skill fix <path>` first.``); the folder already declares that category (`<name> already declares <category>; nothing to change.`)."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 719,
    "policy": "prose",
    "pattern": "Usage: terum-skills skill enable [options] <path>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 726,
    "policy": "prose",
    "pattern": "What it does: removes this tool's `off` entry from Claude Code's own `skillOverrides` setting, which is the same key the `/skills` menu writes. Nothing moves and no ledger row changes. A folder under Global is governed by `~/.claude/settings.json`; a folder in a project checkout is written to that checkout's `.claude/settings.local.json`. Only `off` belongs to terum-skills: a `name-only` or `user-invocable-only` value set by hand reads as enabled and is never removed. It prints `Enabled <name>: Claude Code loads it again on this machine (skillOverrides in <file>).` or `<name> is already enabled; nothing changed.`"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 737,
    "policy": "prose",
    "pattern": "Usage: terum-skills skill disable [options] <path>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 750,
    "policy": "prose",
    "pattern": "Fails when: the same conditions as `skill enable`."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 755,
    "policy": "prose",
    "pattern": "Usage: terum-skills prune [options]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 773,
    "policy": "prose",
    "pattern": "Usage: terum-skills publish [options] <ref>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 786,
    "policy": "prose",
    "pattern": "Asks: `Your latest eval of these exact bytes failed against the previous version. Publish anyway?`, only when the newest local receipt for these bytes is a FAIL. The default is no, and declining cancels with `Publish was cancelled.` The code has a second branch that would name a version instead, but it cannot be reached: the gate reads local receipts only, and `eval` writes every local receipt with a null version, which publish fills in later."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 790,
    "policy": "prose",
    "pattern": "Fails when: no team is configured or the team has no joined handle; `--category` is empty; the ref names no folder in your Library (`` No local skill folder named <name> in your library. Inspect it with `ls --local`, or add the project holding it with `project add`. ``); the folder was rejected by the scan or has no SKILL.md; hygiene finds errors; `--project` names a project the team does not have; the name's existing lineage declares a different id (`<name> is no longer in the repository as <id8>; run sync and retry.`); the clone is not a team repository (`This repository has no team.json; it is not a terum-skills team repo.`); the write lock or the push fails."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 795,
    "policy": "prose",
    "pattern": "Usage: terum-skills unpublish [options] <skill>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 813,
    "policy": "prose",
    "pattern": "Fails when: the team has no joined handle; the name is empty; the team has no published skill by that name (``<team> has no published skill named <name>. List what is published with `ls`.``); the newest version's SKILL.md has no `metadata.id`; the caller is non-interactive and `--yes` was not passed (`Refusing to unpublish <name> without confirmation; pass --yes.`); the clone is not a team repository (`This repository has no team.json; it is not a terum-skills team repo.`); the skill vanished between the read and the write (`<name> is no longer in the <team> repository; nothing to unpublish.`); the write produced nothing (`Nothing was written for <name>; rerun the command.`)."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 818,
    "policy": "prose",
    "pattern": "Usage: terum-skills install [options] [ref] [value]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 825,
    "policy": "prose",
    "pattern": "| `install <ref>` | One skill. `<skill>`, `<team>/<skill>` or `<owner>/<repo>/<skill>`. |"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 826,
    "policy": "prose",
    "pattern": "| `install member <handle>` | Every skill on that member's curated profile, not their `installed[]` list. |"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 827,
    "policy": "prose",
    "pattern": "| `install project <name>` | Every skill the named team project lists, recorded at project scope. The destination is still chosen by the question below, so answering Global places the folders in Global while the ledger rows still say project. |"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 828,
    "policy": "prose",
    "pattern": "| `install --adopt <path>` | Record a folder you already have as installed, without copying a byte. |"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 839,
    "policy": "prose",
    "pattern": "What it does: installs the latest version of a skill into Global (`~/.claude/skills/<name>`) or into a registered project (`<checkout>/.claude/skills/<name>`). The folder is staged and renamed into place, so a partial folder is never visible. It then records a placement row with the fingerprint actually on disk, seeds any committed receipts for that version into the machine's local eval store, and writes one row into your `people/<handle>.json` `installed[]` list along with a refreshed `local_skills` count. For a project destination it adds `.claude/skills/<name>` to that checkout's `.git/info/exclude`. `--adopt` skips the copy entirely: the folder must match a published version byte for byte and must be named after that skill. A three-part ref on a machine that has joined nothing runs `setup <org>/<repo>` in quiet mode first, then installs."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 843,
    "policy": "prose",
    "pattern": "- `Install to` with `Global (~/.claude/skills)` and each registered project. Only `install project <name>` has a team project's remote in hand, so only there is a checkout preselected by matching its `origin`, and only when exactly one matches. Everywhere else the preselection is Global."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 854,
    "policy": "prose",
    "pattern": "Fails when: `--adopt` is combined with a skill selector (`Give a skill to install or --adopt <path>, not both.`) or with `--into` (`--adopt records a folder where it is; it takes no destination.`); nothing is given at all (`Nothing to install: give a skill, or --adopt <path> for a folder you already have.`); the ref pins a version (`Installing a previous version is not supported yet; install installs the latest version.`); `--into` names a folder that is not a registered project (`` <path> is not a project in your library. Add it with `project add <path>`, or pass --into global. ``); a non-interactive caller has projects registered but gave no `--into` (`Pass --into global or --into <project root>`); the ref is not a name the team publishes (`No skill <ref> in team <team>.`); the ref has more than three segments (`Invalid skill ref <value>.`); the bare ref is ambiguous across teams; the skill's folder holds no version (`skills/<name> holds no v<N> folder.`); the team has no joined handle (`Team <team> has no joined handle.`); the destination root has gone (`Project folder <root> is missing`); the member's profile is empty; the project is unknown (`Unknown project <project>.`); the kept path for a displaced copy already exists; consent is declined. For `--adopt`: the path is not in your Library; it matches no published version byte for byte; it holds a skill's bytes under a different folder name (`… holds the bytes of <name> Version K under a different folder name; rename it to <name> first.`); or it is already recorded as installed."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 859,
    "policy": "prose",
    "pattern": "Usage: terum-skills uninstall-skill [options] <ref> [value]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 862,
    "policy": "prose",
    "pattern": "Arguments: `<ref>` required, `[value]` optional. Same three shapes as install: `<ref>`, `member <handle>`, `project <name>`."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 871,
    "policy": "prose",
    "pattern": "What it does: removes placed skill folders from this machine and drops the matching rows from your `people/<handle>.json` `installed[]` list in one team write. A row is dropped only when the last copy at that scope goes. Your curated profile is never touched. A folder whose bytes no longer match the recorded fingerprint is moved to `~/.terum/skills/quarantine`, never deleted, and the command says where it went. It also clears the folder's `skillOverrides` off-switch, so a reinstall is not born disabled. `uninstall-skill member <handle>` takes that person's current profile list intersected with this machine's ledger; `uninstall-skill project <name>` takes only project-scoped copies, so a Global copy you installed separately stays."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 877,
    "policy": "fixed",
    "pattern": "Fails when: no ref is given (``Provide a skill ref, `member <handle>`, or `project <name>`.``); `member` or `project` is given with no value (``Provide a member handle: `npx -y terum-skills@latest uninstall-skill member <handle>`.`` and the matching project line); the team has no joined handle; the skill is not in the team (`No skill <ref> in team <team>.`); the project is unknown (`Unknown project <project>.`); `--from` is neither `global` nor an absolute path, or a non-interactive caller faces an ambiguous copy, or several stranded destinations are pending, all of which print `Pass --from global or --from <checkout root>`; the chosen copy does not match (`Invalid uninstall destination.`); the team write fails after the folders are already gone, which reports what already went. A skill the team has but this machine never placed is not a failure: it prints `<id8> is not placed on this machine.` and exits 0."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 882,
    "policy": "prose",
    "pattern": "Usage: terum-skills sync [options]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 894,
    "policy": "prose",
    "pattern": "The verb's help says \"Nothing on this machine is changed\", and that is true of your skills in the ordinary case, but two paths do write outside the clone. `--hook` refreshes three artefacts of terum-skills' own: its own `SessionStart` entry, the eight skills it placed for Claude Code and Codex, and the edit-hook script. Each is touched only where it is already present and out of date (never when absent, which for a hook means you declined it, and never when foreign), with one extension: a skills root that already holds Terum's copies also receives any of the eight that are missing. Refreshing the edit hook is both halves of it, so that path also rewrites the `PostToolUse` entry in `~/.claude/settings.json`, after backing the file up."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 899,
    "policy": "fixed",
    "pattern": "Pinned your session hook to this copy of terum-skills (npx -y terum-skills@0.20.1 sync --hook); it no longer fetches the newest release at session start. Re-run `npx -y terum-skills@latest setup` after an update to move it."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 902,
    "policy": "prose",
    "pattern": "A settings file this run cannot read or write is a notice too, never a failure, because the fetch has already happened: `Could not pin the session hook in <path>: <reason>`. Each placed skill is compared against the bundled copy rendered in this machine's own spelling, so a copy placed by a different copy of the CLI counts as outdated and is rewritten with `Updated your terum-skills skills for this CLI.`"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 904,
    "policy": "prose",
    "pattern": "The second path is the successor move: a terminal `sync` that finds the remote gone offers to follow the team to its replacement, which runs `team move --yes`: that removes every skill the old team had placed here and places again only the ones the new team also shares."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 912,
    "policy": "prose",
    "pattern": "Fails when: the config cannot be read; `--team` names nothing configured; you accept a successor move and the move fails. Under `--frames`, `--hook` is refused before the command runs, with `` `sync --hook` is the session hook and is not available over frames; run plain `sync`. ``"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 919,
    "policy": "prose",
    "pattern": "Usage: terum-skills validate [options] <path|name>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 929,
    "policy": "prose",
    "pattern": "What it does: runs the deterministic hygiene gate. It is offline: no model call and no network call. It checks HYG1 frontmatter, HYG2 hidden characters, HYG3 credentials and foreign emails, HYG4 executables and extensions, HYG5 license agreement, HYG6 description and size, HYG7 off-list category, and HYG8 outside dependencies. It also returns the list of changes `skill fix` would make."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 931,
    "policy": "prose",
    "pattern": "Two of those eight need a note. HYG6 is two checks under one code: an error when `description` is empty or missing, and a warning when the whole of SKILL.md runs over 20,000 characters, which is the file's length and not the description's. HYG7 is only checked at publish, where the team's category list is in hand, so it never fires here. HYG8 warns when the folder references repository paths outside itself, and `validate`'s own help text omits it, listing HYG1 to HYG7 as though that were the whole set. Without `--cwd`, a folder at your current directory wins over the configured clone, because a work-in-progress folder is usually named like the skill it will become; with `--cwd`, the name is tried first inside that checkout. A `skills/<name>/` container descends to the newest version, and a `skills/<name>/v<N>/` path is named by its `<name>` segment."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 942,
    "policy": "prose",
    "pattern": "Usage: terum-skills eval [options] [skills...]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 973,
    "policy": "prose",
    "pattern": "Generation is shape-first. One model call decides what the skill needs and returns one of two things. A skill that can be measured against a world holding a hidden truth (a repository with planted defects, a spec with planted contradictions, a log with facts that must and must not be repeated) gets a ground-truth **suite**: a `task`, a `files` map, a `plants_diff`, a map of one-line shell probes that each defect case names, and between 2 and 6 defect cases plus exactly one distractor, checked with `transcript_mentions` and `transcript_omits` only. A skill whose behaviour depends on how it is asked gets **cases**, in the shape it always had. Before a generated suite is written anywhere, the patch is checked with `git apply --check` against the files, the suite is composed with the engine's own setup, loaded, and dry-run in a sandbox; a probe that does not pass on the clean base and fail on the patched tree makes that dry run fail and the generation goes back to the model as a correction. `metadata.eval.shape` in your SKILL.md fixes the choice at `suite` or `cases`, and any other value fails before the model call. The run announces which it got: `eval assets: cases: generated suite · triggers: generated`. The write-back line names the file to delete to regenerate, `evals/suite.yaml` for a suite and `evals/cases/` for cases."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 985,
    "policy": "prose",
    "pattern": "Fails when: `--triggers-only` and `--execution-only` are combined; `--k` is not a positive integer; the ref names no Library folder; the folder was rejected by the scan; `--case` names no case (`No eval case named <stem> for <name>.`); hygiene fails; the preflight fails; generated assets fail hygiene; `metadata.eval.shape` holds anything other than `suite` or `cases` (`Could not generate execution cases: SKILL.md metadata.eval.shape must be 'suite' or 'cases'. Retry the command or pass --no-gen.`); the exact spelling a generated asset would take already exists on disk, which is refused rather than overwritten (`<path> already exists, so the generated eval suite was not written — a generated asset never overwrites an authored one. Rename or delete it, then run eval again.`, and the matching lines for `evals/cases/` and `evals/triggers.yaml`). In queue mode: more than one of `--queue-list`, `--drain`, `--dequeue` (`Choose only one of --queue-list, --drain, or --dequeue.`); `--window`, `--max` or `--parallel` without `--drain`; `--window` other than `overnight`; `--max` or `--parallel` not a positive integer; none of the three queue flags, which is the bare `eval` with no skills (`Provide a skill (or several), --pending, --queue-list, --drain, or --dequeue.`); a skill argument (`Queue modes do not accept a skill argument.`); `--batch` or `--pending`; any per-skill selection flag (`Queue modes use the queued team and the full committed skill; per-skill selection flags are unavailable.`); the queued bytes no longer match disk; any item failing, which returns `N queued evals failed; they remain queued.` In batch mode: `--window` with `--batch` or `--parallel`; `--window` other than `overnight` or `later`; `--batch` or `--parallel` not a positive integer; no skills and no `--pending` (`Provide at least one skill, or --pending.`); `--pending` with no team; and any skill failing."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 992,
    "policy": "prose",
    "pattern": "Usage: terum-skills eval-report [options] <skill>"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1012,
    "policy": "prose",
    "pattern": "Usage: terum-skills usage [options] [skill]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1039,
    "policy": "prose",
    "pattern": "Usage: terum-skills misses [options] [skill]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1046,
    "policy": "prose",
    "pattern": "| `--since` | `<iso>` | 7 days ago | ISO-8601 lower bound, validated and canonicalised exactly as `usage` validates it. |"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1050,
    "policy": "prose",
    "pattern": "What it does: answers the one question [`usage`](#usage) cannot. A skill that never fired at all is a single number there, and \"nobody needed it\" and \"it was needed and missed\" are the same number. This verb separates them. It harvests the prompts a person actually typed out of the same transcripts, asks a model which placed skills each prompt should have selected, and keeps a `(prompt, skill)` pair only where the prompt's own turn holds no firing of that skill by either detector, so a slash command you typed yourself is never reported as a miss. The catalogue is rebuilt for each batch from that batch's first timestamp, so the judge is never shown a skill that was not placed yet, and a placement the ledger cannot date is left out of every catalogue rather than assumed available."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1052,
    "policy": "prose",
    "pattern": "Unlike `usage`, it spends model calls: prompts go to `claude -p` in batches of ten, on `sonnet`, with tools disallowed and a two-minute deadline per call, one call per batch, and the call count is printed in the first line. It is not one of the verbs `serve` runs and the desktop app has no surface for it, so nothing triggers it by opening a page. The output is candidates for review and never a rate, and two caveats print every time and cannot be suppressed:"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1074,
    "policy": "prose",
    "pattern": "Usage: terum-skills app [options]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1079,
    "policy": "prose",
    "pattern": "What it does: installs and opens the desktop app for this CLI version, and records where this CLI is so the app can drive it. It downloads `terum-skills-desktop_<version>_<suffix>` from the GitHub release `v<version>` of `ryanliu-terum/terum-skills` through `gh release download`, with a ten-minute deadline, and then checks it twice: the published SHA-256 beside it, and the asset's build provenance with `gh attestation verify <file> --repo ryanliu-terum/terum-skills`, under a two-minute deadline. Both are required, because the checksum ships in the same release as the asset and so cannot catch an asset swapped together with its checksum. Bytes the release workflow did not produce in that repository are discarded rather than installed. On macOS it unpacks the archive and places the bundle at `~/Applications/Terum Skills.app`, a fixed path so a Dock pin survives updates; the previous bundle is renamed aside first and restored if the swap fails. On Windows the asset is a per-user NSIS installer run with `/S`, which installs under `%LOCALAPPDATA%\\Terum Skills` with no elevation. It then writes `~/.terum/skills/run/app.json` with the Node binary, this CLI's entry point, `PATH` and version, sets `config.app` to opted-in, and opens the app. On macOS it never downgrades: a bundle already at that path at this version or newer is kept."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1081,
    "policy": "prose",
    "pattern": "On Linux, WSL and anything else with no published asset it prints one honest line and exits 0. In WSL that line is `The desktop app runs on the Windows side of this machine, not inside WSL. Install terum-skills there and run this command from a Windows terminal; from here, everything works in the terminal.`"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1087,
    "policy": "prose",
    "pattern": "Fails when: `gh` is missing or logged out; the release has no matching asset; the machine is offline or behind a proxy that blocks github.com; the download exceeds ten minutes; the checksum does not match (`The downloaded desktop app did not match its published checksum, so it was discarded (expected <a>, got <b>).`); the asset has no valid build attestation (`The downloaded desktop app has no valid build attestation from ryanliu-terum/terum-skills, so it was discarded: <detail>.`), which is also what a release built before desktop assets were attested looks like; `gh` is too old to check one (`This copy of gh cannot verify build attestations (gh 2.49 or newer is needed), so the downloaded desktop app was discarded.`); the archive cannot be unpacked (`Could not unpack the desktop app: …`) or holds no application bundle; the installer exits non-zero; the executable is not where it should be afterwards; the app cannot be opened (`Could not open Terum Skills: …`). Each of those ends with `` Everything works from the terminal. Run `app` later to try again. `` One failure does not: a copy of the CLI with no readable version stops at `This copy of terum-skills has no version; the desktop app is published per version.`"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1092,
    "policy": "prose",
    "pattern": "Usage: terum-skills app-update [options]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1108,
    "policy": "prose",
    "pattern": "What it does: this is the desktop app's own update path, driven by the app rather than typed. `--check` maintains the release state under the daily probe cap and reports the platform, the CLI version, the latest advertised release, the probe outcome, every installed version, the newest staged one, this process's parent pid, and the last apply. `--stage` downloads the asset and puts it through the same two checks as [`app`](#app), its published checksum and its build attestation, without installing it; it unpacks the bundle on macOS, keeps the installer on Windows, and records `app/<version>/staged.json`. `--apply` spawns a detached child running `--apply-now` and returns, so the app can quit. The detached leg waits up to 30 seconds for the awaited process to exit, swaps the macOS bundle and reopens it, or runs the Windows installer with `/S /UPDATE /R`, records each phase in `~/.terum/skills/run/app-update.json`, and prunes old version directories. Pruning keeps four names: the two newest, the version this run applied, and this CLI's own version."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1119,
    "policy": "prose",
    "pattern": "Usage: terum-skills update [options]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1124,
    "policy": "prose",
    "pattern": "What it does: reports on this copy of the CLI, and prints the command that would update it when there is one to print. It never runs a package manager. It prints `terum-skills <version>`, `This copy: <path>`, `Declared dependency of: <root>` for an out-of-date local dependency, and then the release line: `Release advertisements are not checked on this machine.` on a machine with no GitHub team remote, `Latest advertised release: <version> (observed <at>)` on a good probe, or the three lines `Could not check release advertisements: <e>`, `Last successful observation: …` and `npm availability was not checked.` on a failed one. It adds `pre-release tags are not compared` where the probe saw pre-release tags, and `Latest observed registry release: <v> (npx cache, <at>)` where the npx cache is ahead. Unlike the passive notice, `update` asks GitHub now rather than honouring the daily cap."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1126,
    "policy": "fixed",
    "pattern": "The last block depends on the answer. When this copy already matches the advertisement and the probe succeeded, there is no advice at all: the output ends `This copy matches the release advertisement. npm availability was not checked.` Otherwise it prints advice keyed on how this copy was installed, and there are five branches, not four. A global install gets `npm install -g terum-skills@latest` and then `Then run terum-skills setup once if the session hook or /terum-skills skill names a version: it re-points them at this copy.`; a local dependency gets `npm install [--save-dev] terum-skills@latest` in the declaring root and nothing further; an npx copy gets the cache request, the `npx -y terum-skills@latest <command>` form, and the two lines `The session hook and /terum-skills skill keep the version that set them up until you re-run:` and `npx -y terum-skills@latest setup`; a source checkout gets the git workflow plus `npm run build`; and a copy whose provenance cannot be established gets `Installation method could not be established.`, the npx form, and the same two setup lines. The passive stderr notice carries the same advice in the branch it uses for a copy that is neither a local dependency nor a global install: `Run the latest release with npx -y terum-skills@latest <command>; re-run setup with it to move the session hook and /terum-skills skill.`"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1137,
    "policy": "prose",
    "pattern": "Usage: terum-skills uninstall [options]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1140,
    "policy": "prose",
    "pattern": "Arguments: none. Excess arguments are accepted by the parser and then refused, so `uninstall <skill>` fails with ``To remove a skill, use `uninstall-skill <ref>`.``"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1142,
    "policy": "prose",
    "pattern": "What it does: removes terum-skills from this machine after one confirmation whose detail is a full inventory. It writes a record of your config to `~/.terum/skills/backups/uninstall.<stamp>.json`, removes the session hook, the managed skills under `~/.claude/skills/` and `~/.codex/skills/`, and the edit hook (its settings entry first, then the script), then tears down every configured team in a loop, deletes `config.json`, removes `run/app.json` and `run/latest-version.json`, deletes the macOS app bundle on darwin only, removes `app/`, and then tries to `rmdir` `run/`, `cache/`, `teams/`, `quarantine/` and the store root. A directory that is not empty is kept and reported, with one exception: a non-empty store root is kept silently. Since `backups/` is written on every run, that is the case you will always hit, so `~/.terum/skills` itself survives without a line saying so. Anything at a skill or edit-hook path that is not ours is named and left alone. The session-hook entry is matched by its command naming `terum-skills`, so an entry pinned to a version goes as readily as the `@latest` one older releases wrote."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1146,
    "policy": "prose",
    "pattern": "Asks: `Remove terum-skills from this machine?` with the inventory as detail."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1150,
    "policy": "prose",
    "pattern": "Fails when: `~/.claude/settings.json` cannot be read (`…; nothing was removed`); the edit hook cannot be read (`<path> could not be read: <reason>`, with no suffix); the hook, wrapper or edit hook cannot be removed (`…; nothing else was removed`); a team is added while the uninstall is running (`Team <x> was added while uninstalling; re-run uninstall.`); a team teardown fails, which prints `Done:` and `Remaining:` and `` Re-run `uninstall` to continue. ``; `config.json` is kept because something is still configured; a path cannot be removed for any reason other than being absent or not empty (`` Could not remove <path>: <reason>. Everything else was removed; re-run `uninstall` to retry. ``)."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1155,
    "policy": "prose",
    "pattern": "Usage: terum-skills serve [options]"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1158,
    "policy": "prose",
    "pattern": "Arguments: none, and no options of its own. `-h, --help` exists but does not behave: the bin routes every `serve` invocation into the session path before it reads the flag, so `serve --help` prints the help, follows it with a failing `result` frame carrying `\"error\":\"(outputHelp)\"` on stdout, and exits 1."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1160,
    "policy": "prose",
    "pattern": "This command is for a program, not a person. Without `--frames` it fails immediately with `serve requires --frames`, on a channel that stamps no id."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1162,
    "policy": "prose",
    "pattern": "What it does: runs one long-lived stdio session that reads `request` frames and answers them, so a shell such as the desktop app pays the process start cost once instead of per read. Requests run strictly serially, because changing the working directory is process-global, and the directory is restored after each one. Every frame belonging to a request is stamped with that request's id; the opening `hello` frame carries none, because it belongs to the session rather than to a request. It serves seven read verbs and refuses everything else with `serve does not run <verb>; spawn it as its own process`:"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1164,
    "policy": "prose",
    "pattern": "`status`, `ls`, `eval-report`, `search`, `validate`, `update`, `usage`"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1166,
    "policy": "prose",
    "pattern": "`usage` is the one entry that writes, deliberately: it appends to `~/.terum/skills/run/usage-events.jsonl`, which never takes the clone writer lock this list exists to protect, and a machine whose owner only uses the app would otherwise never archive anything."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1170,
    "policy": "prose",
    "pattern": "Writes: nothing of its own beyond what `usage` appends."
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1180,
    "policy": "prose",
    "pattern": "| `readme` | The host-side entry point for the GitHub Actions workflow the team scaffold installs. It runs inside a team checkout, not on a configured machine, and regenerates that repository's `README.md` between its `terum-skills:begin` and `terum-skills:end` markers. With `--pr-comment <base-ref>` it prints the publish-preview comment instead, anchored by an HTML comment so the Action can find and update its own comment. It refuses loudly on a repository that has not migrated to layout 3. |"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1181,
    "policy": "prose",
    "pattern": "| `guard-push` | The pre-push hook armed inside every team clone. It takes `<remote> <url> [refs...]`: the url selects the configured team, the remote is the label used in the printed `git fetch` remedies, and git's `<local ref> <local sha> <remote ref> <remote sha>` groups follow. Each branch update is diffed against the content it replaces, or against its fork point off main when the branch is new, and held to the pusher's own identity. Its main refusal is that ownership check, which rejects a hand-pushed `team.json`, skill version or eval receipt. It also refuses any deletion, any non-branch ref, a push to a remote this machine has not joined, a ref list that is not a whole number of groups, a new branch whose base cannot be resolved, and a diff it could not run. Every non-zero exit aborts the push. Most refusals name `git push --no-verify` as the bypass, attributed to you, but the ownership refusals do not: they are passed through as written. |"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1182,
    "policy": "prose",
    "pattern": "| `receipt-check` | A retired stub kept alive only because the scaffolded workflow still calls it. It prints `receipt-check is retired; publish records receipts when it mints a version.` and exits 0. |"
  },
  {
    "file": "docs/reference/cli.md",
    "line": 1183,
    "policy": "fixed",
    "pattern": "| `share` | Retired. It always fails with `` `share` is retired; run `npx -y terum-skills@latest publish <skill>` to publish a skill explicitly. `` It is deliberately excluded from the verb list the frame protocol advertises. |"
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 3,
    "policy": "prose",
    "pattern": "Everything terum-skills writes on your machine, who writes it, and what survives removal."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 36,
    "policy": "prose",
    "pattern": "│   └── terum-skills-edit.mjs          the PostToolUse edit hook script"
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 49,
    "policy": "prose",
    "pattern": "The directories terum-skills creates under the state root are 0700 and the JSON files it writes there are 0600; inside a team clone, git's own umask applies. The helper most of those directories go through refuses a path that is a symbolic link, is not a directory, or is owned by another user. It also tightens a pre-existing directory whose mode is looser. On Windows the mode work is skipped, because Windows synthesizes mode bits; the shape and owner checks still apply. Two things sit outside the rule, both under the 0700 root: the directory `install` creates to seed a committed receipt under `evals/local/`, and the files an eval run writes into its own run directory, which take your umask."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 55,
    "policy": "prose",
    "pattern": "Written only by the configuration store, which reads, mutates and writes it under `config.json.lock` and replaces it atomically (temp file, fsync, rename) at mode 0600. It is deleted only by `uninstall`. Unknown keys are preserved. `login --set`, `project add` and `project remove` ask for a preserving write, which rewrites only the bytes of the values they change, so hand formatting survives there; every other write re-serializes the whole file."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 76,
    "policy": "prose",
    "pattern": "- `teams` is written only by `team create` and `team join`, always with the handle they proved against the roster. One remote maps to one team name and one name to one remote, checked again under the lock immediately before binding."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 77,
    "policy": "prose",
    "pattern": "- `approvals` remembers a tool-grant consent by the hash of the skill's `allowed-tools`, so `install` does not ask again while the content is unchanged. `team leave` clears it when the last team goes."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 79,
    "policy": "prose",
    "pattern": "- `placements` is the authority for every path this tool may delete. A row exists only for a folder terum-skills copied from a team version, and only directly under a `.claude/skills` root. `fingerprint` is what was on disk when it was placed, which is how a hand-edited copy is recognised later."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 80,
    "policy": "prose",
    "pattern": "- `projects` is your library project registry, written only by `project add`, `project remove` and `project rename`. Labels are derived across the whole set, so adding one project can relabel another; a name chosen with `project rename` carries `renamed_at` and is kept. A folder inside another registered folder is labelled by its path inside it, and its parent is read off the paths, never stored."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 81,
    "policy": "prose",
    "pattern": "- `app` records that you ran `app`."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 82,
    "policy": "prose",
    "pattern": "- The four identity fields are written by `login` and by `team create`/`team join`. `profile --name` writes `display_name` on its own."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 88,
    "policy": "prose",
    "pattern": "A full git clone of the team repository, on branch `main`. `team join` clones it. `team create` builds it in a staging repository at `teams/<team>.bootstrap-<uuid>`, pushes it, and renames that into place, removing the staging copy if anything fails. A missing clone is restored only by re-running `setup` or `team join`. `sync` fetches the clone and hard-resets it to `origin/main`; it never repairs and never re-clones."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 90,
    "policy": "prose",
    "pattern": "Two things are written into the clone's own git directory: `.git/hooks/pre-push` at mode 0700, which runs the hidden `guard-push` verb, and `core.hooksPath=.git/hooks`, set so a machine-wide hooks path cannot hide it. `team join` and `team migrate` re-arm both, so an interrupted arming is repaired by re-running."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 92,
    "policy": "prose",
    "pattern": "The writer lock for one clone sits beside it rather than inside it, at `~/.terum/skills/teams/.<team>.safewrite.lock`. Every fetch, reset, commit and push takes it. A second process waits, then fails with `Another terum-skills operation holds the write lock on <team>; retry when it finishes.` rather than racing."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 100,
    "policy": "prose",
    "pattern": "`<team>.stamp` is written by `sync` after a fetch that fully succeeded: `{\"head\":\"<sha>\",\"at\":\"<iso>\"}` at 0600. It is the only thing that makes a session-hook run a fast no-op: a clone stamped within the last hour is reported fresh and left alone. `status` and `search` read its file timestamp for their staleness line. A stamp dated well into the future is not treated as evidence of a recent sync."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 102,
    "policy": "prose",
    "pattern": "`<team>.lock` is the teardown mutex, created with an exclusive open at 0600, holding `{\"pid\",\"host\",\"token\",\"started\"}`. `team leave` and `uninstall` take it while they tear a team down, and fail rather than wait when another holder has it. The session hook does not take it: `sync --hook` queues on the clone's writer lock above, and a run that cannot get that lock within four seconds reports `<team>: not refreshed (busy)` on stderr and exits 0. A lock is stale after ten minutes, or immediately when it names a dead process on this host, and is then reclaimed once. A reclaim that is killed mid-move can leave `<team>.lock.stale-<uuid>` behind; `team leave` and `uninstall` sweep those along with the stamp."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 104,
    "policy": "prose",
    "pattern": "`<team>.successors.json` is the cached answer to \"where did this repository go\", written by `sync` when a GitHub remote answers \"repository not found\": `{\"remote\":\"…\",\"at\":<ms>,\"search\":{…}}` at 0600, valid for ten minutes. A person at a terminal always gets a fresh lookup."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 114,
    "policy": "prose",
    "pattern": "An item is keyed on the bytes it was queued against, not on a version number, so editing the folder after queueing makes the drain refuse that item by name rather than evaluate something else. `team` is optional, because a folder belonging to no team is still evaluable. An item that fails the schema (every item queued before the current shape) is dropped on read, and the CLI says how many and which. Two locks guard it: `eval-queue.json.state.lock` for a rewrite and `eval-queue.json.drain.lock` for a whole drain, so enqueueing stays possible while a paid run is in flight."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 116,
    "policy": "prose",
    "pattern": "`usage-events.jsonl` is written by `usage`, and by `usage` alone, as an append of whole lines. Each line has exactly four fields: `{\"kind\":\"D1\",\"skill\":\"deploy\",\"ts\":\"<iso>\",\"entrypoint\":\"cli\"}`. The tuple is its own deduplication key, so no session id, file path or cursor is ever stored, and a rescan over transcripts already seen adds nothing. It is off the report's read path: deleting it changes no number today's default 30-day window prints. It exists only so a window reaching past Claude Code's transcript retention has anything to answer from."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 118,
    "policy": "prose",
    "pattern": "`app.json` is written by `app`, at 0600: `{\"schema\":1,\"node\":\"…\",\"entry\":\"…\",\"path\":\"<PATH>\",\"version\":\"…\",\"writtenAt\":\"<iso>\",\"target\":\"…\",\"intent\":\"setup\"}`. It is how the desktop app finds Node and this CLI on every launch, which is why reopening the app from the Dock a week later still works. Run `app` once on a machine or the app has nothing to drive."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 123,
    "policy": "prose",
    "pattern": "{ \"schema\": 1, \"package\": \"terum-skills\", \"upstream\": \"…\","
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 137,
    "policy": "prose",
    "pattern": "`skill-files/<sha256>.json` is the crash-recovery journal for `skill move`, `skill copy`, `skill rename` and `skill delete`. It records the source, destination, ledger row, fingerprint, any kept copy, and whether the operation finished, so an interrupted run resumes on the folder the first run resolved rather than the names you typed."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 151,
    "policy": "prose",
    "pattern": "`install` also seeds this tree: for each receipt the team has committed for the version it has placed, it copies the file to `evals/local/<digest>/<runId>/receipt.json`. A receipt this client cannot read, or one written before content digests existed, is skipped with a printed line rather than aborting the install."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 153,
    "policy": "prose",
    "pattern": "An older layout, `evals/<team>/<skill id>/<run id>/`, is still read by `eval-report` and merged into its local-runs list. Nothing writes it any more, and nothing migrates it."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 157,
    "policy": "prose",
    "pattern": "`hooks/terum-skills-edit.mjs` is the PostToolUse edit-hook script, written at 0600 by an atomic temp-and-rename. It begins with the marker `// terum-skills managed hook`; anything at that path without it is left alone and named as foreign. The copy shipped inside the package is the source, and `sync --hook` rewrites this file when it is an outdated copy of the CLI's own, never when it is absent (which means you declined it) and never when it is foreign."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 159,
    "policy": "prose",
    "pattern": "The script itself reads the hook payload on stdin, returns immediately unless the edited path is strictly inside a folder under a `.claude/skills` directory, reads `config.json` and returns if terum-skills has no team here, deduplicates through `run/edit-hints/`, and writes an `additionalContext` note naming the skill, whether it is an installed placement of a team version, and the `publish` and `eval` commands. It imports nothing from the package and makes no network call, and any failure is silence."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 163,
    "policy": "prose",
    "pattern": "`app/<version>/installed.json` is `{\"schema\":1,\"version\":\"…\",\"platform\":\"…\",\"bundle\":\"…\",\"installedAt\":\"<iso>\"}`, and `app/<version>/staged.json` is the same with `stagedAt` in place of `installedAt`, plus `installer` (the Windows setup file, `null` on macOS). The whole staging directory is renamed into place in one move, so `<version>/` only ever exists complete. `app/.download-*` directories are in-progress downloads; any older than an hour is swept on the next run. `app-update --apply-now` prunes old version directories, keeping the newest two plus the version it installed plus the CLI's own."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 169,
    "policy": "prose",
    "pattern": "`quarantine/<ISO stamp>/<name>` is where terum-skills puts a folder instead of deleting it. Three things land here:"
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 171,
    "policy": "prose",
    "pattern": "- a placed copy whose bytes no longer match its ledger fingerprint, when `uninstall-skill`, `skill delete`, `team leave` or `uninstall` removes it"
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 172,
    "policy": "prose",
    "pattern": "- a folder deleted with `skill delete` that was not a recorded placement"
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 173,
    "policy": "prose",
    "pattern": "- a team clone holding uncommitted or unpushed work at `team leave` or `uninstall`, as `quarantine/<stamp>/teams-<team>`"
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 175,
    "policy": "prose",
    "pattern": "`prune` is the only command that empties it."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 179,
    "policy": "prose",
    "pattern": "`backups/settings.<ISO stamp>.json` is one verbatim copy of `~/.claude/settings.json`, taken once ever, immediately before the first time terum-skills writes to that file. If any `settings.*.json` already exists here, no further backup is taken."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 181,
    "policy": "prose",
    "pattern": "`backups/uninstall.<ISO stamp>.json` is the whole of `config.json` as it was, written by `uninstall` before it removes anything."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 183,
    "policy": "prose",
    "pattern": "Both are 0600. Neither is ever removed by terum-skills."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 187,
    "policy": "prose",
    "pattern": "A legacy directory. Nothing writes it. `team leave` and `uninstall` remove `cache/<team>` and the directory itself, which is the only reason it is still named anywhere."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 191,
    "policy": "prose",
    "pattern": "One more lock lives in the system temporary directory, because it protects a destination folder that may be anywhere: `<tmpdir>/terum-skills-target-locks-<uid>/<sha256 of the target path>.lock`. Every local lifecycle mutation for one skill destination takes it, it goes stale after a minute, and the directory is forced to 0700 and refused if another user owns it. An eval also uses that directory twice: `terum-evals-preflight-*` for the preflight agent run, and `terum-eval-gen-*` while it generates execution cases, which it removes when the generation finishes."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 195,
    "policy": "prose",
    "pattern": "These are the only files terum-skills writes outside its own state root. Setup places the eight skills without asking and offers the two hook entries separately, each with its own question, and either hook can be declined. What each of them runs, and when, is summarised in [security](../../SECURITY.md)."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 205,
    "policy": "prose",
    "pattern": "{ \"type\": \"command\", \"command\": \"npx -y terum-skills@0.20.1 sync --hook\", \"async\": true, \"timeout\": 60 }"
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 210,
    "policy": "fixed",
    "pattern": "The command is not fixed text. It is `sync --hook` behind the spelling of the copy of the CLI that wrote the entry, which is the same bare-or-npx form that copy uses for every command it prints: `terum-skills` when it is a global install found on your PATH on macOS or Linux, and `npx -y terum-skills@<version>` pinned to that copy's own version otherwise, which is what the example above shows. The `@latest` spelling never appears in a fresh entry, so a session start runs the release you installed and fetches no other. A copy whose own `package.json` cannot be read falls back to `npx -y terum-skills@latest`, because nothing more specific can be named."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 218,
    "policy": "prose",
    "pattern": "{ \"type\": \"command\", \"command\": \"node \\\"<home>/.terum/skills/hooks/terum-skills-edit.mjs\\\"\", \"timeout\": 10 }"
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 225,
    "policy": "prose",
    "pattern": "`sync --hook` rewrites the `SessionStart` entry when its command is anything other than this copy's spelling: the `@latest` command earlier releases wrote, or a pin on an older version. It re-installs the entry exactly as setup would, in the file the entry already lives in, and reports:"
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 228,
    "policy": "fixed",
    "pattern": "Pinned your session hook to this copy of terum-skills (npx -y terum-skills@0.20.1 sync --hook); it no longer fetches the newest release at session start. Re-run `npx -y terum-skills@latest setup` after an update to move it."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 233,
    "policy": "prose",
    "pattern": "Writes to this file are atomic (temp file, fsync, rename), at 0600, preserving the original file's mode, and are preceded by the one-time backup described above. Re-installing strips every existing terum-skills command from the file first, so there is never a duplicate; a hook group holding other people's commands as well keeps those commands and loses only ours."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 235,
    "policy": "prose",
    "pattern": "terum-skills refuses to edit this file at all when it is not valid JSON, or when `hooks`, `hooks.SessionStart` or `hooks.PostToolUse` is the wrong shape. The message is `Cannot edit <path>: it is not valid JSON. Fix it by hand or move it aside, then re-run.`"
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 241,
    "policy": "fixed",
    "pattern": "The eight skills terum-skills places for Claude Code and, when `~/.codex` exists (`CODEX_HOME` moves it), for Codex: `eval`, `eval-report`, `list-skills`, `search-skills`, `skill-info`, `skill-status`, `sync-skills` and `terum-skills`. Each is a single `SKILL.md` written from the copy bundled in the package with one substitution: every `npx -y terum-skills@latest` in the bundled text becomes this machine's own spelling, by the same rule as the hook entry above. Its managed marker is two fields in its own frontmatter: the skill's `name` and `metadata.managed-by: terum-skills`. Anything else at one of those paths, including a symbolic link, a file, a folder with no `SKILL.md`, or a different skill, is judged foreign: it is named and never written to or removed."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 243,
    "policy": "prose",
    "pattern": "The `terum-skills` manual among them tells the agent how to run terum-skills on your behalf: that the shell tool has no TTY, to invoke the CLI in that one spelling and no other, which verbs it may run in-session, which verbs it must hand to your terminal because they ask questions, and what an eval costs. The other seven each wrap one verb with `--format md` and show its board."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 245,
    "policy": "prose",
    "pattern": "A copy of terum-skills' own that this CLI has moved past is refreshed without a question, both by `setup` and by `sync --hook` at every session start. The comparison is against the bundled text already rendered in this copy's spelling, so a copy placed by a different release counts as outdated and is rewritten. A root holding none of Terum's copies is left alone by everything but `setup`, which places the whole set without asking; a root that holds some receives the ones that are missing from `sync --hook` too."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 253,
    "policy": "prose",
    "pattern": "For a project placement, `install` appends `.claude/skills/<name>` to that checkout's `.git/info/exclude`, so the copy does not show up as an untracked change in your repository."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 255,
    "policy": "prose",
    "pattern": "terum-skills will only remove a folder that has a `placements` row in `config.json` and sits directly under a `.claude/skills` root. Anything else is refused by construction."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 259,
    "policy": "prose",
    "pattern": "When something would displace a folder you already have, the old folder is kept rather than overwritten. The keep path is `old-skills` beside the skills root: `~/.claude/old-skills/<name>` for Global, `<checkout>/.claude/old-skills/<name>` for a project. Two commands use it, `install` when you accept `Replace it with Version <N>?` and `skill move`/`skill copy` when the destination is occupied. Both refuse outright when that keep path already exists, so a second run cannot overwrite the first run's rescue. Both add `.claude/old-skills/` to the checkout's `.git/info/exclude`."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 265,
    "policy": "prose",
    "pattern": "Enabled and disabled are not terum-skills concepts. They are Claude Code's own `skillOverrides` setting, the same key the `/skills` menu writes, which maps a skill name to `on`, `name-only`, `user-invocable-only` or `off`. terum-skills reads that key and writes exactly one value into it, `off`, and keeps no state of its own, so the app's switch and Claude's menu cannot disagree. A `name-only` or `user-invocable-only` set by hand reads as enabled and is never removed."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 273,
    "policy": "prose",
    "pattern": "When terum-skills creates `<checkout>/.claude/settings.local.json` for the first time, it appends `.claude/settings.local.json` to that checkout's `.git/info/exclude`. A checkout without git keeps the setting and is told why the exclude was skipped."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 275,
    "policy": "prose",
    "pattern": "`skill disable` writes the entry, `skill enable` removes it, `skill move` and `skill rename` carry it to the new path, and `skill delete` and `uninstall-skill` clear it so a folder written again under that name is not born disabled."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 283,
    "policy": "prose",
    "pattern": "On Windows it is a per-user install under `%LOCALAPPDATA%\\Terum Skills`, from an NSIS installer run with `/S`, which needs no elevation. The executable is `%LOCALAPPDATA%\\Terum Skills\\terum-skills-desktop.exe`."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 285,
    "policy": "prose",
    "pattern": "There is no Linux or WSL build. `app` says so and exits 0."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 287,
    "policy": "prose",
    "pattern": "The app keeps its own preferences (theme, layout, and its update policy) in `preferences.json` in the config directory the OS gives an application with the bundle identifier `com.terum.skills`. Tauri resolves that to `~/Library/Application Support/com.terum.skills` on macOS and `%APPDATA%\\com.terum.skills` on Windows. terum-skills never reads or writes that file, and `uninstall` says out loud that it was not touched."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 289,
    "policy": "prose",
    "pattern": "The app needs `~/.terum/skills/run/app.json` to drive the CLI. Run `app` once on a machine and it is written."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 293,
    "policy": "prose",
    "pattern": "`uninstall` asks once, with a full inventory as the detail of the question, and then works through it in order."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 299,
    "policy": "prose",
    "pattern": "- the PostToolUse entry and then `~/.terum/skills/hooks/terum-skills-edit.mjs`, in that order, so an entry never names a deleted script"
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 316,
    "policy": "prose",
    "pattern": "- your membership and installed-skill records in the team repository. Rejoining does not place skills again; `install member <handle>` does."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 325,
    "policy": "prose",
    "pattern": "`team leave <name>` is the single-team version of the same teardown, and it never touches the team repository."
  },
  {
    "file": "docs/reference/local-state.md",
    "line": 329,
    "policy": "prose",
    "pattern": "It does not remove: the placed terum-skills skills, the edit hook, the quarantine, the backups, the local eval runs, the usage archive, the eval queue, the desktop app, or anything in the team repository. Your membership stands until an admin runs `team remove <handle>`."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 12,
    "policy": "prose",
    "pattern": "| `git` | Everything repository-shaped: cloning, `sync`, publish, install | Probed for `status`'s report and otherwise never gated. A command that needs git and cannot find it fails with git's own message. |"
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 13,
    "policy": "prose",
    "pattern": "| `gh` | Creating a GitHub team, `invite`, access-revoking `team remove`, the admin chips behind `status --permissions`, and downloading the desktop app and its updates | Presence and login are distinct states. `status` reports presence only and never runs `gh auth status`. Downloading the app also needs gh 2.49 or newer, which is the first version with `gh attestation`; an older one discards the download and says so. |"
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 21,
    "policy": "prose",
    "pattern": "| Creating a team on any other remote, with `team create <name> --remote <url>` | Not needed at all. Ambient git credentials do the work. |"
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 30,
    "policy": "prose",
    "pattern": "| macOS, Apple Silicon | `terum-skills-desktop_<version>_aarch64.app.tar.gz` | `~/Applications/Terum Skills.app` |"
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 31,
    "policy": "prose",
    "pattern": "| macOS, Intel | `terum-skills-desktop_<version>_x64.app.tar.gz` | `~/Applications/Terum Skills.app` |"
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 32,
    "policy": "prose",
    "pattern": "| Windows, ARM64 | `terum-skills-desktop_<version>_arm64-setup.exe` | `%LOCALAPPDATA%\\Terum Skills\\terum-skills-desktop.exe` |"
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 33,
    "policy": "prose",
    "pattern": "| Windows, x64 | `terum-skills-desktop_<version>_x64-setup.exe` | `%LOCALAPPDATA%\\Terum Skills\\terum-skills-desktop.exe` |"
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 40,
    "policy": "prose",
    "pattern": "2. `gh attestation verify <asset> --repo ryanliu-terum/terum-skills` exits 0. A failure reads `The downloaded desktop app has no valid build attestation from ryanliu-terum/terum-skills, so it was discarded: <what gh reported>.`, and a `gh` too old to know the sub-command reads `This copy of gh cannot verify build attestations (gh 2.49 or newer is needed), so the downloaded desktop app was discarded.`"
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 42,
    "policy": "prose",
    "pattern": "The checksum alone catches a damaged download. It cannot catch an asset replaced on the Release together with its `.sha256`, which is what the attestation is for. Both checks run for `app` and for a staged `app-update`. See [security](../../SECURITY.md) for how a release is built and how to verify one yourself."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 49,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest app"
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 52,
    "policy": "prose",
    "pattern": "That downloads the archive for this CLI's own version from the `ryanliu-terum/terum-skills` releases through `gh`, verifies its checksum and its build attestation, unpacks it, and moves the bundle onto `~/Applications/Terum Skills.app`. The path is fixed on purpose: it is visible, Spotlight indexes it, and it stays the same across updates, so a Dock pin survives them. The bundle already there is renamed aside first and removed last, so a failure halfway through puts the old one back rather than leaving you with no app. Then the CLI runs `open` on it."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 60,
    "policy": "prose",
    "pattern": "An ad-hoc signature is enough to open the app, as long as the file does not carry macOS's quarantine attribute. Files written by `gh` do not carry it, which is why the `app` path opens without a Gatekeeper dialog."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 62,
    "policy": "prose",
    "pattern": "Downloading `terum-skills-desktop_<version>_aarch64.app.tar.gz` from the GitHub Releases page in a browser is a different matter. The browser sets the quarantine attribute, and Gatekeeper then reports the unpacked bundle as damaged and offers to move it to the Trash. Use the `app` verb instead. It is the supported path, and it is the only one the product tests."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 66,
    "policy": "prose",
    "pattern": "`app` never downgrades. If the app has updated itself past your CLI's version, running `app` opens the newer bundle rather than replacing it. On every other platform the check is whether this version has an install record and a locatable executable."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 68,
    "policy": "fixed",
    "pattern": "`npx -y terum-skills@latest uninstall` deletes `~/Applications/Terum Skills.app`. This is the one platform where uninstall removes the app. A copy that is running keeps running until you quit it, and it cannot be reopened from the Dock afterwards; `app` downloads it again."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 73,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest app"
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 76,
    "policy": "prose",
    "pattern": "downloads the NSIS installer for your architecture and runs it with `/S`, which installs silently, per user, under `%LOCALAPPDATA%\\Terum Skills`, with no elevation prompt. The executable is `%LOCALAPPDATA%\\Terum Skills\\terum-skills-desktop.exe`, and the CLI then starts it detached so your terminal is not held until you quit the app."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 82,
    "policy": "prose",
    "pattern": "The Windows installer is unsigned. There is no certificate configured and no signing step in the release workflow. Running the `-setup.exe` by hand, after downloading it from the Releases page, trips SmartScreen's unknown-publisher prompt. The `app` path runs the same installer silently and does not surface that dialog."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 96,
    "policy": "prose",
    "pattern": "If your CPU is ARM64 but you are running an x64 build of Node, `app` prints:"
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 99,
    "policy": "fixed",
    "pattern": "This machine has an ARM64 processor but you are running an x64 build of Node, so terum-skills and everything the desktop app starts will run under emulation. Install the ARM64 build of Node from nodejs.org, then run `npx -y terum-skills@latest app` again to record it."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 102,
    "policy": "prose",
    "pattern": "It warns and continues; it does not refuse. Take the warning seriously anyway, because it is durable. `app` records the absolute path of the Node binary that ran it into `~/.terum/skills/run/app.json`, and the app then spawns exactly that binary for every command it runs, for the life of the install. An x64 Node recorded once means every child the app ever starts is emulated. Install ARM64 Node and run `app` again to re-record it."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 104,
    "policy": "prose",
    "pattern": "`status` reports both `hostArch` and `processArch`. Two fields, not one, so you can see a mismatch."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 120,
    "policy": "prose",
    "pattern": "A path such as `\\\\wsl.localhost\\Ubuntu\\home\\you\\project` works, and you can register it with `project add`. It is also the slowest configuration the product supports. That share is a 9P filesystem over a virtual socket, and every single filesystem operation pays its round trip, so a command whose cost is \"one operation per skill folder\" becomes \"one network round trip per skill folder\"."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 122,
    "policy": "prose",
    "pattern": "If `ls --local` or the app's Library feels slow, a `\\\\wsl.localhost` root is the first thing to check. Working from a folder on the Windows filesystem removes that cost entirely."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 151,
    "policy": "fixed",
    "pattern": "`npx -y terum-skills@latest uninstall` does not remove the desktop app on Windows. It says so:"
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 161,
    "policy": "prose",
    "pattern": "There is no desktop app. `app` prints one honest line and exits 0, because nothing failed."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 172,
    "policy": "prose",
    "pattern": "The desktop app runs on the Windows side of this machine, not inside WSL. Install terum-skills there and run this command from a Windows terminal; from here, everything works in the terminal."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 177,
    "policy": "prose",
    "pattern": "`setup` skips its app step entirely on both, so the wizard creates or joins the team in the terminal rather than handing off to the app. Everything else is identical: publish, install, eval, sync, the team repository, the session hook, the eight skills for Claude Code and Codex, and the edit hook all work exactly as they do elsewhere."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 179,
    "policy": "prose",
    "pattern": "If you work in WSL but want the app, install terum-skills on the Windows side and run `app` from a Windows terminal. Note that the two sides have separate state: `~/.terum/skills` inside WSL and `%USERPROFILE%\\.terum\\skills` on Windows are different machines as far as the product is concerned."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 195,
    "policy": "prose",
    "pattern": "The app never uses `npx` and never resolves a version. It runs the exact Node binary and CLI entry that `app` recorded in `~/.terum/skills/run/app.json`."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 200,
    "policy": "prose",
    "pattern": "- On a CLI that advertises the `serve` feature, reads go through one long-lived child rather than one process per read. A fixed allow-list of seven verbs is eligible: `status`, `ls`, `eval-report`, `search`, `validate`, `update` and `usage`. Six of those write nothing. `usage` is the deliberate exception: it appends to a machine-local log and never takes the team clone's writer lock, which is what the list protects. Every other verb gets its own process."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 207,
    "policy": "prose",
    "pattern": "Every write to the team repository is one `git fetch` plus one `git push`, and a verb that refreshes the clone first (publish, `sync`) adds another fetch. A write that loses a race repeats the fetch and the push."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 211,
    "policy": "prose",
    "pattern": "`sync` gives its fetch a 20-second deadline and then kills it, so an unreachable remote costs you 20 seconds, not a hang. Per-team failures are reported and never fail the whole run."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 213,
    "policy": "prose",
    "pattern": "### What `ls --local` costs"
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 215,
    "policy": "prose",
    "pattern": "`ls --local` is a filesystem scan of your Global root plus each registered project root. It fetches nothing and spawns nothing except one `git remote get-url origin` per registered project root; the Global root is not a checkout, so it costs no child at all. Folder scans run 8 at a time, and fingerprints and health checks run 8 at a time."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 228,
    "policy": "prose",
    "pattern": "- The macOS bundle is ad-hoc signed and not notarized, and the Windows installer is unsigned. Install both through the `app` verb; downloading them from the Releases page by hand runs into Gatekeeper and SmartScreen respectively."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 229,
    "policy": "prose",
    "pattern": "- The app needs `~/.terum/skills/run/app.json` to exist. Opening the bundle from the Dock or Spotlight on a machine where `app` has never run makes every board fail with a message telling you to run `terum-skills app` from a terminal once. Running `app` writes it."
  },
  {
    "file": "docs/reference/platforms.md",
    "line": 231,
    "policy": "prose",
    "pattern": "- `uninstall` removes the app bundle on macOS only. On Windows the app stays and you remove it from Settings ▸ Apps."
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 13,
    "policy": "prose",
    "pattern": "Do not edit the clone. Author skills in your Library and publish them. A clone that holds uncommitted or unpushed work when you run `team leave` or `uninstall` is moved to `~/.terum/skills/quarantine/<stamp>/teams-<team>` instead of being deleted, so work is never lost, but it is also never published from there."
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 21,
    "policy": "prose",
    "pattern": "`team create` scaffolds and pushes this, in one commit whose message is `<handle>: create team <name>`:"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 34,
    "policy": "prose",
    "pattern": "terum-skills.yml"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 46,
    "policy": "prose",
    "pattern": "| `evals/<skill-uuid>/archive/<40-hex>/<runId>.json` | A receipt carried over by `team migrate` that describes bytes no current version holds. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 65,
    "policy": "prose",
    "pattern": "| `name` | string, at least 1 character | The team's display name, typed at `team create`. The key your machine stores the team under is chosen separately: the creator's is this name, a joiner's is the repository name taken from the remote unless `team join --as <name>` says otherwise. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 67,
    "policy": "prose",
    "pattern": "| `projects` | object keyed by project name | Each value is `{ \"remotes\": [], \"skills\": [] }`. `remotes` holds git remote URLs, stored normalised, and `team project create` writes at most one because the guard admits no more. It preselects a destination and nothing else: when you install a skill this project lists, a registered library project whose `origin` matches one of them becomes the default answer to `Install to`. `skills` are the skill uuids the project lists. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 68,
    "policy": "prose",
    "pattern": "| `archived` | array of handles | Handles whose membership `team remove` archived. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 86,
    "policy": "prose",
    "pattern": "A team is born with no projects. A skill reaches the team by being published, which writes `skills/<name>/v<N>/`; a project is an optional membership list a team creates when it wants one. Repositories created under an older layout may carry a `Global` project; `team project delete` retires it."
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 88,
    "policy": "prose",
    "pattern": "A project name is 1 to 64 characters of letters, digits, spaces, dots, underscores and hyphens, and cannot start with a dot or a space. It is stored exactly as typed, but `team project create` compares names case-insensitively, so `Payments` and `payments` cannot become two cards nobody can tell apart."
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 99,
    "policy": "prose",
    "pattern": "| `github` | a GitHub login, or `\"\"` | Your GitHub login. Empty is allowed for a member on a non-GitHub remote. An empty value is never identity evidence, and this value becomes a REST path segment when an admin runs `team remove`. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 100,
    "policy": "prose",
    "pattern": "| `bio` | string | Free text, written by `profile --bio`. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 101,
    "policy": "prose",
    "pattern": "| `role` | string up to 32 characters, optional | A self-described job label written by `profile --role`. It is not an authorization role. No code reads it to decide what you may do. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 103,
    "policy": "prose",
    "pattern": "| `profile` | array, optional | Your curated endorsements: the skills you stand behind. See the shape below. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 104,
    "policy": "prose",
    "pattern": "| `projects` | array of strings, optional | Which team projects you are on, written by `profile --project`. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 112,
    "policy": "prose",
    "pattern": "`installed[]` and `profile[]` mean different things and are used differently. `installed[]` is automatic and says a copy is on a machine; `install member <handle>` reads the other one, `profile[]`, because that is the curated list."
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 186,
    "policy": "prose",
    "pattern": "`team migrate` carries receipts across from layout 2. A receipt whose recorded tree matches the bytes that became `v1` is re-keyed to `evals/<uuid>/v1/<runId>.json`. One that describes other bytes goes to `evals/<uuid>/archive/<40-hex>/<runId>.json`, keyed by the old tree hash. Nothing reads the archive for a verdict; it exists so no historical receipt is destroyed."
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 193,
    "policy": "prose",
    "pattern": "this team repository uses an older layout; an admin should run `team migrate` to upgrade it"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 198,
    "policy": "prose",
    "pattern": "Exactly two callers may read a layout-2 `team.json`: `team migrate` itself, and the precondition check that decides whether a migration is needed. They use a lenient schema that also admits the layout-2 `global` list and the retired `policy.publish` key. Everything else reads the strict one."
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 209,
    "policy": "prose",
    "pattern": "<!-- terum-skills:begin -->"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 210,
    "policy": "prose",
    "pattern": "<!-- terum-skills:end -->"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 218,
    "policy": "prose",
    "pattern": "<!-- terum-skills:begin -->"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 229,
    "policy": "fixed",
    "pattern": "| deploy-check | infra | Checks a deploy before it ships | 3 | project: Payments | Version 4 | PASS | `npx -y terum-skills@latest install acme/team-skills/deploy-check` |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 231,
    "policy": "prose",
    "pattern": "<!-- terum-skills:end -->"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 267,
    "policy": "prose",
    "pattern": "`team create` commits `.github/workflows/terum-skills.yml`. It has four jobs."
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 271,
    "policy": "fixed",
    "pattern": "| `hygiene` | A pull request against `main` (opened, synchronize, reopened) | `contents: read` | Diffs `skills/` against the base, reduces the paths to skill names, and runs `npx -y terum-skills@latest validate \"<name>\" --cwd .` for each name whose folder still exists. It passes a name rather than a path, because under layout 3 `validate` resolves the newest version folder itself. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 272,
    "policy": "fixed",
    "pattern": "| `receipt-check` | A pull request whose head branch starts with `publish/` | `contents: read` | `npx -y terum-skills@latest receipt-check --base origin/main`. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 273,
    "policy": "fixed",
    "pattern": "| `readme` | A push to `main` | `contents: write` | `npx -y terum-skills@latest readme`, then commits and pushes `README.md` as `github-actions[bot]` with the message `chore: regenerate skills README` when it changed. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 274,
    "policy": "prose",
    "pattern": "| `publish-comment` | A pull request whose head branch starts with `publish/` | `contents: read`, `pull-requests: write` | `readme --pr-comment origin/main`, then creates or updates the PR comment it finds by the `<!-- terum-skills:pr-comment -->` anchor. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 278,
    "policy": "prose",
    "pattern": "`readme` is the only job with `contents: write`. That is why the never-blank refusals above exist: this is the one place a derived artifact is committed over the team's catalogue without a human reading it first."
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 280,
    "policy": "prose",
    "pattern": "`receipt-check` and `publish-comment` cannot fire today. Both gate on a head branch named `publish/…`, and the CLI pushes only to `main`; nothing in the product creates such a branch. `receipt-check` also invokes a verb that is now a no-op shim, printing `receipt-check is retired; publish records receipts when it mints a version.`"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 282,
    "policy": "prose",
    "pattern": "The workflow is migration debt. It invokes the latest published CLI, so between a layout-3 release and a team's own migration the README job refuses layout 2 and exits non-zero. That red interval is expected and ends when an admin runs `team migrate`."
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 287,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest team workflow-update --print"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 290,
    "policy": "fixed",
    "pattern": "Without `--print` the command fails with `` `npx -y terum-skills@latest team workflow-update` is print-only; pass --print. `` With `--print` it emits the workflow verbatim followed by `Commit this to .github/workflows/terum-skills.yml in an ordinary PR by someone with push access.`"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 318,
    "policy": "prose",
    "pattern": "How long a second process waits depends on who is watching. With a terminal or an app on the other end, it waits 75 seconds, which outlasts a full 30-second write plus the 60-second window after which an abandoned lock goes stale. It prints a line after the first second and then at most one every five: `Waiting for another terum-skills operation on <team> to finish… (12 s)`. With nobody watching, a session hook or a piped script, it waits 4 seconds in silence and then fails, because a script wants to fail fast."
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 320,
    "policy": "prose",
    "pattern": "A lock whose timestamp is more than a minute in this machine's future is refused immediately rather than waited on, because it can never go stale: `The write lock on <team> is stamped 420 s in this machine's future (<path>), so waiting cannot clear it; remove that directory if no terum-skills command is running.`"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 326,
    "policy": "prose",
    "pattern": "| Clone busy | Another process held the writer lock for the whole wait | `Another terum-skills operation holds the write lock on <team>; retry when it finishes.` |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 341,
    "policy": "prose",
    "pattern": "| j | `migrate` | Structural, by direction | Adds: `skills/*/v1/**`, `evals/<uuid>/v1/<runId>.json`, `evals/<uuid>/archive/<40-hex>/<runId>.json`. Removes: any `skills/*/` path that is not under a `v<N>/` folder, and `evals/<uuid>/<40-hex>/<runId>.json`. Modifies: `team.json`, `README.md`, and every member's `people/*.json`. Removing anything under `skills/<name>/v<N>/` stays refused even here. This row runs first, and it never parses `team.json`, because the pre-image is layout 2. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 342,
    "policy": "prose",
    "pattern": "| a′ | `publish` | `skills/<name>/v<N>/**` | Add only. The unit of immutability is the version prefix, not the path: files are admitted only when no sibling under `skills/<name>/v<N>/` already exists. Adding one file to a committed version is refused, because it would change that version's bytes. Fails closed if the tree cannot list its own paths. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 343,
    "policy": "prose",
    "pattern": "| a″ | `publish` | `skills/<name>/evals/**` | Add and modify. Removal refused. Ownership is not consulted: the last publisher's assets win. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 344,
    "policy": "prose",
    "pattern": "| g | `publish` | `evals/<uuid>/v<N>/<runId>.json` | Add only, and the uuid must equal the `metadata.id` of some version's `SKILL.md` in the same commit. Judged per path, not per commit, because one publish legitimately writes a version, a project list, a people file and several receipts at once. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 345,
    "policy": "prose",
    "pattern": "| k | `unpublish` | `skills/<targetSkill>/**`, `evals/<targetSkillId>/**`, `people/*.json` | The only row that may remove a version folder. Removal only, except people files, which are modify-only and only to drop this skill's `profile[]` entries. That is verified by rebuilding the expected file and comparing it, so no other edit can ride along. Fails closed unless the caller names both the skill and its uuid. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 347,
    "policy": "prose",
    "pattern": "| b | `join`, `install`, `uninstall`, `profile`, `publish` | `people/<your own handle>.json` | Your own file only. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 348,
    "policy": "prose",
    "pattern": "| c | `publish` | `team.json` | Only `projects[*].skills` may move. Project keys, remotes and every other field must be byte-identical. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 349,
    "policy": "prose",
    "pattern": "| c′ | `unpublish` | `team.json` | The same predicate as row c. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 351,
    "policy": "prose",
    "pattern": "| e | `join` | `team.json` | `archived` becomes exactly the old list minus your own handle. A set difference, not a length check. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 352,
    "policy": "prose",
    "pattern": "| i | `project` | `team.json` | Exactly one new project key, born `{ \"remotes\": [] or [one], \"skills\": [] }`, with that exact key set. Every pre-existing project and every other field byte-identical. |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 359,
    "policy": "prose",
    "pattern": "`unpublish` removes bytes from the working tree; it does not rewrite history and it does not reach anyone's machine. Installed copies keep working, and the next `sync` reports them as removed from the team. Republishing the same name starts again at `v1`, and the receipts that were keyed to the old ordinals are gone with the rest of the skill."
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 367,
    "policy": "prose",
    "pattern": "`team create` and `team join` both write `.git/hooks/pre-push` mode `0700` and set `core.hooksPath` to `.git/hooks`, so a machine-wide hooks path cannot hide it. Arming is idempotent and happens on every join, so an interrupted arming is repaired by the command the failure advice names. `team migrate` re-arms it too."
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 369,
    "policy": "prose",
    "pattern": "The hook checks that its launcher still exists before running it. If the CLI it was armed with is gone, it exits 0 with one line on stderr saying the push was not checked and telling you to re-run `team join` to re-arm it. It turns git's stdin ref lines into arguments, because the CLI reads stdin nowhere except when asking you a question."
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 376,
    "policy": "prose",
    "pattern": "- **Anything under `skills/`.** A version is minted, not written. Only `publish` digests a folder, compares it against every existing version and picks the next ordinal; a hand push that lands bytes in `skills/<name>/v<N>/` produces a version whose number means nothing."
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 379,
    "policy": "fixed",
    "pattern": "- **A top-level path it does not recognise.** This almost always means the hook predates the repository, so it says so: ``this clone's push guard predates the repository's layout; re-run `npx -y terum-skills@latest team join '<remote>'` to re-arm it``. It does not advise `--no-verify`, because that would teach you to disable the guard permanently."
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 392,
    "policy": "fixed",
    "pattern": "npx -y terum-skills@latest team create <name> --remote <url>"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 403,
    "policy": "prose",
    "pattern": "| README regeneration | The committed workflow's `readme` job, after every push to `main` | Inside every write's own commit, from the in-memory tree |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 404,
    "policy": "prose",
    "pattern": "| `invite` | Adds a repository collaborator through the GitHub API | Refused: `Access is managed on the host for <remote>; this operation is GitHub-only in phase 1.` Setup prints host-managed access guidance instead of asking for logins |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 405,
    "policy": "prose",
    "pattern": "| `team remove` | Archives the membership and revokes host access | Refused for the same reason. `team remove <handle> --archive-only` still works and archives the membership |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 406,
    "policy": "fixed",
    "pattern": "| The README's Install column | `npx -y terum-skills@latest install <org>/<repo>/<skill>` | A dash |"
  },
  {
    "file": "docs/reference/team-repo.md",
    "line": 409,
    "policy": "prose",
    "pattern": "Everything else is identical: publishing, installing, versioning, receipts, the guard, the push hook, and `sync`."
  },
  {
    "file": "docs/roadmap.md",
    "line": 3,
    "policy": "prose",
    "pattern": "Every other page in these docs describes what terum-skills does today. This page is the only one that describes direction: what is decided and unbuilt, what is still an open question, and what has been ruled out."
  },
  {
    "file": "docs/roadmap.md",
    "line": 16,
    "policy": "prose",
    "pattern": "- **The heavy answer choosing the sessions.** Planned. `eval` detects a skill that spawns subagents, prints the notice and asks `Use the one-session heavy evaluation mode?`. The decision behind that question is that yes runs one session per arm at `k` of 1 and no runs the skill once per case. Neither branch is wired: the answer reaches the run log and nothing reads it, and the one-session shape comes from an `evals/suite.yaml`, authored or generated, instead. The checkbox the notice's own wording points at is not drawn in the app either."
  },
  {
    "file": "docs/roadmap.md",
    "line": 20,
    "policy": "prose",
    "pattern": "- **Boards for a terminal and for an agent session.** Planned. The decision is that there is no MCP server. One skill file per command points at the CLI, the same bytes for Claude Code and for Codex, and the CLI renders each read model as a Markdown or ANSI board behind a global `--format` flag. Neither the flag nor the per-command skills exist yet; setup offers you one skill, `/terum-skills`, which runs any verb for you."
  },
  {
    "file": "docs/roadmap.md",
    "line": 22,
    "policy": "prose",
    "pattern": "- **A progress bar for a running eval.** Deferred. A batch of evals reports which skill it has reached, and `install`, `publish` and setup's evals step report their steps. Inside a single run the engine reports nothing, so the app shows the run's output lines and a busy indicator until it settles. It is revisited when the engine reports its own phases."
  },
  {
    "file": "docs/roadmap.md",
    "line": 36,
    "policy": "prose",
    "pattern": "- **An index of skills beyond your own team.** Under consideration. Nothing in the record settles whether it happens or what would order it. Today the [Marketplace](concepts/library-and-marketplace.md) shows what your own team has published and its top-rated shelf orders by install count, and `search` reads the local clone of every team configured on this machine with no network call, so a skill in a team you are not a member of is not reachable at all. Anything wider than one team's clone needs a server, and any server we run is a stated non-goal."
  },
  {
    "file": "docs/roadmap.md",
    "line": 42,
    "policy": "prose",
    "pattern": "- **Scoped invitations.** Not planned. `invite <github-login>` adds someone to the whole team repo as a collaborator, which is the unit GitHub gives, and the scoping section came off the design for that reason. Narrowing an invitation to a project would need a new field in the team file, and that table is closed."
  },
  {
    "file": "docs/roadmap.md",
    "line": 46,
    "policy": "prose",
    "pattern": "- **Editing a team project.** Deferred. `team project create` and `team project delete` ship; changing a project's repository, renaming it or editing its key does not. Each is its own authorization and its own guard row, and deleting a key un-places skills for every teammate. The consequence is worth knowing in advance: a team project created without a repository link cannot be given one later from the app."
  },
  {
    "file": "docs/roadmap.md",
    "line": 52,
    "policy": "prose",
    "pattern": "- **Sharing commands, agents and hooks.** Deferred. Skills are the only unit for now, and a folder carrying a `.claude-plugin` or `hooks` folder is never offered as a candidate to share. `ls --local` lists it with the note `contains plugin or hook definitions`. Commands are cheap to add when someone asks; hooks come back only with a rule that flags and shows what they would run."
  },
  {
    "file": "docs/roadmap.md",
    "line": 56,
    "policy": "prose",
    "pattern": "- **Relabelling a whole catalogue at once.** Deferred. `publish` suggests a category and `skill category` sets one, so new work lands labelled. A back-fill verb waits for a team with more than about fifteen shared skills still sitting on `misc`, or for a change to the category list itself."
  },
  {
    "file": "docs/roadmap.md",
    "line": 70,
    "policy": "fixed",
    "pattern": "- **A Linux build.** Deferred. Releases build macOS on arm64 and x64 and Windows on x64 and arm64. On Linux, `npx -y terum-skills@latest app` prints `There is no Linux desktop app yet; everything works from the terminal.` and exits 0, and inside WSL it points you at the Windows side of the same machine. It is revisited when a teammate works on a Linux desktop."
  },
  {
    "file": "docs/roadmap.md",
    "line": 72,
    "policy": "prose",
    "pattern": "- **Signing and notarization.** Deferred. The macOS bundle is ad-hoc signed and never notarized and the Windows installer is unsigned, so a bundle downloaded from the Releases page in a browser hits Gatekeeper, and a manually run installer trips SmartScreen. Installing through `app` avoids both: it downloads with `gh`, which writes no macOS quarantine flag, and on Windows it runs the installer itself with `/S`. A Developer ID certificate costs an annual fee and brings mandatory notarization."
  },
  {
    "file": "docs/roadmap.md",
    "line": 74,
    "policy": "prose",
    "pattern": "- **The Inbox.** Deferred. The bell and the Inbox route are hidden: the surface is off and the read model behind it is a declared gap. Two of the item kinds it was drawn with, `update` and `review`, were deleted along with the mechanisms behind them, and the five that remain have no producer. Whoever lights the Inbox decides what the rest of it reports."
  },
  {
    "file": "docs/roadmap.md",
    "line": 76,
    "policy": "prose",
    "pattern": "- **The onboarding tour.** Deferred. The app's first run drives `setup` from a Boot step, so creating or joining a team does happen in the app. The six-step tour behind that step, Welcome through Style, Basics, Team, Feedback and Done, is drawn but never reached: its read model is a declared gap and the surface is off, so once setup settles you land in the Library. The tour's wording is held until the surface goes live."
  },
  {
    "file": "docs/roadmap.md",
    "line": 78,
    "policy": "fixed",
    "pattern": "- **The Quality tab.** Deferred. A skill page has a Quality tab that says `Hygiene checks and tool grants for this skill will land on this tab.`; the pane behind it, with per-check hygiene results, tool grants, Validate and Fix, is written and switched off, because whether it is ready is not that tab's own call to make. Until it ships, `npx -y terum-skills@latest validate <skill>` gives you the same checks, and [hygiene](evaluating/hygiene.md) explains them."
  },
  {
    "file": "docs/roadmap.md",
    "line": 90,
    "policy": "prose",
    "pattern": "- **Signing in without the GitHub CLI.** Deferred. `login` and every GitHub operation go through `gh`, which you authenticate once. A device-code flow inside terum-skills is revisited when an admin turns up with neither `gh` nor the patience for a token, or when token scopes cause two support requests."
  },
  {
    "file": "docs/roadmap.md",
    "line": 96,
    "policy": "prose",
    "pattern": "- **Updating the team's workflow for you.** Deferred. `team workflow-update --print` prints the current workflow file and the line `Commit this to .github/workflows/terum-skills.yml in an ordinary PR by someone with push access.`, and the verb deliberately has no write path. A guarded write waits for the template to need a second team-wide bump, or for there to be more team repos than hand migration can carry."
  },
  {
    "file": "docs/roadmap.md",
    "line": 98,
    "policy": "prose",
    "pattern": "- **A `terum-skills://` link that installs.** Deferred. It is the only path to clicking a link in chat and having the skill install. It needs OS protocol registration, a confirmation dialog and a refusal for a repo you are not a member of, and it pays off once most recipients already have the CLI."
  },
  {
    "file": "docs/roadmap.md",
    "line": 100,
    "policy": "prose",
    "pattern": "- **Posting to Slack from Share.** Deferred. `invite` prints a block you paste into Slack yourself. Posting it directly needs a Slack app token stored on your machine, and waits until copy-and-paste sharing proves people use it."
  },
  {
    "file": "docs/roadmap.md",
    "line": 102,
    "policy": "prose",
    "pattern": "- **A roles model of our own.** Not planned. The role beside a name on the Members page is a GitHub repository permission, Admin or Member, read through `status --permissions`; when that lookup is unavailable the CLI reports `unknown` and the app shows a dash rather than defaulting anyone to Member. Admin stays repo admin on the host, read-only in the app: there is no role field in the team file, no verb to change one, and the guard table that would have to admit one is closed."
  },
  {
    "file": "docs/roadmap.md",
    "line": 104,
    "policy": "prose",
    "pattern": "- **Pending invitations on the Members page.** Planned. The page draws an Invited row, and the decision is that `ls` gains a `--host` flag that reads the repository's pending invitations and its admin list from GitHub, holds them in the process and writes neither to the team repo. Neither the flag nor the list exists yet, so the page shows members only. An invitee has no people file until they join, which is why the row carries no Joined, Skills or Last seen."
  },
  {
    "file": "docs/roadmap.md",
    "line": 114,
    "policy": "prose",
    "pattern": "- **Making the writing commands sub-second.** Not planned. `install`, `publish`, `sync`, `eval`, `uninstall-skill` and the other writing verbs stay on one process per call, because they hold the clone's writer lock and own their own cancellation. Their time is git, the network or a model in any case, and the aim is to show that time rather than hide it. See [platforms](reference/platforms.md) for what each platform costs."
  },
  {
    "file": "docs/roadmap.md",
    "line": 116,
    "policy": "prose",
    "pattern": "- **Prerelease builds.** Not planned. The version probe compares published releases only, and when the repository advertises a prerelease tag `update` prints `pre-release tags are not compared`. The app's own updater follows the same releases."
  },
  {
    "file": "docs/roadmap.md",
    "line": 120,
    "policy": "prose",
    "pattern": "Three ways to reach the maintainers. The Discord is at [discord.gg/SVVzejCf9](https://discord.gg/SVVzejCf9), bugs and feature requests go to [GitHub issues](https://github.com/ryanliu-terum/terum-skills/issues), and ryanliu@terum.ai reaches one of them directly."
  }
];
