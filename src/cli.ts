import { run as runSkill } from './commands/skill.js';
import { run as runSkillToggle } from './commands/skillToggle.js';
import { invocation, getStartedLines, type InvocationForm } from './lib/invocation.js';
import { run as profile, type ProfileArgs } from './commands/profile.js';
import { run as runUpdate } from './commands/update.js';
import { run as runApp } from './commands/app.js';
import { run as runAppUpdate } from './commands/appUpdate.js';
import { packageVersion } from './lib/package.js';
import { Command, Option } from 'commander';
import { run as login } from './commands/login.js';
import { run as runProject } from './commands/project.js';
import { run as runReconcile } from './commands/reconcile.js';
import { run as runTeam, type TeamCommand } from './commands/team.js';
import { run as install } from './commands/install.js';
import { run as uninstall } from './commands/uninstall.js';
import { run as runUninstallMachine } from './commands/uninstallMachine.js';
import type { Launch } from './lib/launch.js';
import { run as sync } from './commands/refresh.js';
import { run as prune } from './commands/prune.js';
import { run as search } from './commands/search.js';
import { run as invite } from './commands/invite.js';
import { run as status } from './commands/status.js';
import { run as runLs } from './commands/ls.js';
import { run as readme } from './commands/readme.js';
import { run as runLeave } from './commands/leave.js';
import { run as runPublish, runMany as runPublishMany } from './commands/publish.js';
import { runUnpublish } from './commands/unpublish.js';
import { run as runSetup } from './commands/setup.js';
import { run as runGuardPush } from './commands/guardPush.js';
import { run as runValidate } from './commands/validate.js';
import { run as runEvalReport } from './commands/evalReport.js';
import { run as runUsage } from './commands/usage.js';
import { run as runMisses } from './commands/misses.js';
import { run as runEval } from './commands/eval.js';
import { Prompter } from './lib/prompt.js';
import { OUTPUT_HELP } from './lib/render/options.js';
import { failure, Result } from './lib/result.js';

/**
 * §3: commander wiring only. Every verb is `run(args, io)` in src/commands; this file maps flags
 * to it. `execute` is injected so the mapping and the exit code are testable without a terminal.
 */
export type Execute = (invoke: (io: Prompter) => Promise<Result<unknown>>, meta: { verb: string; notices: boolean }) => Promise<void>;
export interface CliVerbs { skill?: typeof runSkill; skillToggle?: typeof runSkillToggle; project?: typeof runProject; reconcile?: typeof runReconcile; profile?: typeof profile; app?: typeof runApp; appUpdate?: typeof runAppUpdate; update?: typeof runUpdate; login: typeof login; team: TeamCommand; setup?: typeof runSetup; install?: typeof install; uninstall?: typeof uninstall; uninstallMachine?: typeof runUninstallMachine; sync?: typeof sync; prune?: typeof prune; search?: typeof search; invite?: typeof invite; ls?: typeof runLs; status?: typeof status; readme?: typeof readme; publish?: typeof runPublish; publishMany?: typeof runPublishMany; unpublish?: typeof runUnpublish; leave?: typeof runLeave; guardPush?: typeof runGuardPush; validate?: typeof runValidate; eval?: typeof runEval; evalReport?: typeof runEvalReport; usage?: typeof runUsage; misses?: typeof runMisses; }

export function buildProgram(execute: Execute, verbs: CliVerbs = { login, team: runTeam }, context: { form?: InvocationForm; launch?: Launch; noUpdateCheck?: boolean; frames?: boolean; serve?: () => Promise<void> } = {}): Command {
  const active: Required<CliVerbs> = { skill: verbs.skill ?? runSkill, skillToggle: verbs.skillToggle ?? runSkillToggle, project: verbs.project ?? runProject, reconcile: verbs.reconcile ?? runReconcile, profile: verbs.profile ?? profile, app: verbs.app ?? runApp, appUpdate: verbs.appUpdate ?? runAppUpdate, update: verbs.update ?? runUpdate, login: verbs.login, team: verbs.team, setup: verbs.setup ?? runSetup, install: verbs.install ?? install, uninstall: verbs.uninstall ?? uninstall, uninstallMachine: verbs.uninstallMachine ?? runUninstallMachine, sync: verbs.sync ?? sync, prune: verbs.prune ?? prune, search: verbs.search ?? search, invite: verbs.invite ?? invite, ls: verbs.ls ?? runLs, status: verbs.status ?? status, readme: verbs.readme ?? readme, publish: verbs.publish ?? runPublish, publishMany: verbs.publishMany ?? runPublishMany, unpublish: verbs.unpublish ?? runUnpublish, leave: verbs.leave ?? runLeave, guardPush: verbs.guardPush ?? runGuardPush, validate: verbs.validate ?? runValidate, eval: verbs.eval ?? runEval, evalReport: verbs.evalReport ?? runEvalReport, usage: verbs.usage ?? runUsage, misses: verbs.misses ?? runMisses };
  const program = new Command();
  program.version(packageVersion() ?? 'version unknown', '-v, --version');
  program.name('terum-skills').description('Share private Claude Code skills through a team git repository.').exitOverride();
  // Root help gives first-time users a runnable next step, including after a local npm install.
  program.addHelpText('after', [
    '',
    'Get started:',
    ...getStartedLines(context.form).slice(1),
    '  Have a skill install command? Run it directly.',
    '  If no teams are configured, it guides you through setup first.',
  ].join('\n') + '\n' + OUTPUT_HELP);

  program.command('serve').description('Serve serial read requests over --frames stdio')
    .action(async () => {
      if (context.serve) await context.serve();
      else await execute(async () => failure('serve requires --frames'), { verb: 'serve', notices: false });
    });

  program
    .command('login')
    .description('Check the GitHub CLI and record your identity (name, email, GitHub login, default handle); writes no team entry')
    .option('--set <key=value>', 'Set name, email, or default-handle without prompting (repeatable)', (value: string, previous: string[] = []) => [...previous, value])
    .action(async (options: { set?: string[] }) => execute((io) => active.login({ form: context.form, ...options }, io), { verb: 'login', notices: true }));

  program
    .command('setup [target]')
    .description('Onboarding wizard: on a new machine, asks whether to create a team or join one; re-run to resume your team; pass <org>/<repo> or a remote URL to join directly (one team per machine: leave the current team first)')
    .option('--app', 'open the desktop app (the default wherever one exists)')
    .option('--no-app', 'keep setup in the terminal; do not open the desktop app')
    .option('--no-projects', 'do not offer to add a project to your library')
    .option('--no-existing', 'do not check existing Library skills against the team')
    .option('--no-evals', 'do not offer to evaluate the shared skills that have no receipt')
    .action(async (target: string | undefined, options: { app?: boolean; projects?: boolean; existing?: boolean; evals?: boolean }) => execute((io) => active.setup({ form: context.form, target, app: options.app, projects: options.projects, ...(options.existing === false ? { existing: false } : {}), evals: options.evals, cwd: process.cwd() }, io), { verb: 'setup', notices: true }));

  const skill = program.command('skill').description('Move, copy, rename, delete, fix, recategorise, enable, or disable a folder in your Library');
  for (const kind of ['move', 'copy', 'rename'] as const) skill.command(`${kind} <path>`)
    .description(kind === 'move' ? 'Move a Library folder to another root; the original is gone'
      : kind === 'copy' ? 'Copy a Library folder into another root; the original stays where it is'
      : 'Rename a Library folder; the folder name is the invocation name')
    .requiredOption('--to <destination>', kind === 'rename' ? 'new skill name' : 'global or a registered project root')
    .action(async (path: string, options: { to: string }) => execute(io => active.skill({ form: context.form, kind, path, to: options.to }, io), { verb: `skill ${kind}`, notices: true }));
  skill.command('delete <path>').description('Remove a Library folder after typing its name')
    .action(async (path: string) => execute(io => active.skill({ form: context.form, kind: 'delete', path }, io), { verb: 'skill delete', notices: true }));
  skill.command('fix <path>').description('Rewrite SKILL.md frontmatter that is not valid YAML by quoting the offending value; the text stays the same')
    .action(async (path: string) => execute(io => active.skill({ form: context.form, kind: 'fix', path }, io), { verb: 'skill fix', notices: true }));
  skill.command('category <path>').description("Change a Library folder's metadata.terum-category in SKILL.md; nothing is published, so the team keeps showing the category its newest version carries")
    .requiredOption('--to <name>', "the new category; your team's list is advice, not an enum, so any name is accepted")
    .action(async (path: string, options: { to: string }) => execute(io => active.skill({ form: context.form, kind: 'category', path, to: options.to }, io), { verb: 'skill category', notices: true }));
  for (const kind of ['enable', 'disable'] as const) skill.command(`${kind} <path>`)
    .description(kind === 'disable' ? 'Stop Claude Code loading a Library folder on this machine; its files stay where they are (writes skillOverrides in Claude Code settings)' : 'Let Claude Code load a Library folder again on this machine (removes the skillOverrides entry)')
    .action(async (path: string) => execute(io => active.skillToggle({ form: context.form, kind, path }, io), { verb: `skill ${kind}`, notices: true }));

  const project = program.command('project').description('Add, forget, or list the projects in your library — the folders this machine reads skills from');
  project.command('add [path]').description('Add a folder to your library')
    .action(async (path: string | undefined) => execute(io => active.project({ form: context.form, kind: 'add', path, cwd: process.cwd() }, io), { verb: 'project add', notices: true }));
  project.command('remove <path>').description('Forget a project; leave its files and ledger unchanged')
    .action(async (path: string) => execute(io => active.project({ form: context.form, kind: 'remove', path, cwd: process.cwd() }, io), { verb: 'project remove', notices: true }));
  project.command('rename <path>').description('Rename a project in your library; the folder on disk is unchanged').requiredOption('--to <name>', 'the new name')
    .action(async (path: string, options: { to: string }) => execute(io => active.project({ form: context.form, kind: 'rename', path, to: options.to, cwd: process.cwd() }, io), { verb: 'project rename', notices: true }));
  project.command('list').description('List the projects in your library, sub-projects under the project whose folder holds them').addHelpText('after', OUTPUT_HELP)
    .action(async () => execute(io => active.project({ form: context.form, kind: 'list' }, io), { verb: 'project list', notices: true }));

  program.command('reconcile').description('Check Library folders against published team skills')
    .option('--list', 'list matches without asking or writing')
    .addOption(new Option('--team <team>', 'configured team (required when more than one exists)').hideHelp())
    .action(async (options: { list?: boolean; team?: string }) => execute(io => active.reconcile({ form: context.form, ...options }, io), { verb: 'reconcile', notices: true }));

  const team = program.command('team').description(`Create, join, leave, and admin settings for a team; run \`${invocation(context.form, 'team')}\` to see all options`);
  team.command('migrate')
    .description('Migrate this team repository to layout 3; run only after the release removing auto-share has propagated to teammates')
    .addOption(new Option('--team <team>', 'configured team (required when more than one exists)').hideHelp())
    .action(async (options: { team?: string }) => execute(io => context.frames ? Promise.resolve(failure('team migrate is a terminal-only operation; run it without --frames after the auto-share removal release has propagated.')) : active.team({ form: context.form, kind: 'migrate', ...options }, io), { verb: 'team migrate', notices: false }));
  team
    .command('create [name]')
    .description('Create a private team repository and become its first member (asks for the team name and the repository name when omitted)')
    .option('--org <org>', 'GitHub organization (default: your own account)')
    .option('--repo <repo>', 'GitHub repository name (default: <team name>-shared-skills)')
    .option('--remote <url>', 'push the scaffold to an existing EMPTY remote instead of creating one on GitHub')
    .action(async (name: string | undefined, options: { org?: string; repo?: string; remote?: string }) => execute((io) => active.team({ form: context.form, kind: 'create', name, ...options }, io), { verb: 'team create', notices: true }));
  team
    .command('join <target>')
    .description('Join a team: <org>/<repo> on GitHub, or any git remote URL (one team per machine; re-running it for the configured team updates your entry)')
    .addOption(new Option('--as <name>', 'local team name (default: the repository name)').hideHelp())
    .action(async (target: string, options: { as?: string }) => execute((io) => active.team({ form: context.form, kind: 'join', target, ...options }, io), { verb: 'team join', notices: true }));
  team
    .command('remove <handle>')
    .description('Revoke a member’s GitHub access and archive their roster entry')
    .addOption(new Option('--team <team>', 'configured team (required when more than one exists)').hideHelp())
    .option('--archive-only', 'archive roster membership without attempting host access changes')
    .action(async (handle: string, options: { team?: string; archiveOnly?: boolean }) => execute((io) => active.team({ form: context.form, kind: 'remove', handle, ...options }, io), { verb: 'team remove', notices: true }));
  team
    .command('leave <name>')
    .description('Remove this team’s placed skills, its local clone, and its config entry from this machine (your membership is unchanged)')
    .action(async (name: string) => execute((io) => active.leave({ form: context.form, name }, io), { verb: 'team leave', notices: true }));
  team
    .command('move <target>')
    .description('Follow a team whose repository moved: leave the configured team on this machine, join <org>/<repo> (or a git remote URL), and place again every skill the old team had placed here that the new one shares')
    .addOption(new Option('--from <team>', 'the configured team to move away from (required when more than one exists)').hideHelp())
    .option('--yes', 'skip the confirmation (a script, or a shell that already asked)')
    .action(async (target: string, options: { from?: string; yes?: boolean }) => execute((io) => active.team({ form: context.form, kind: 'move', target, ...options }, io), { verb: 'team move', notices: true }));
  const teamProject = team.command('project').description('Team projects: the cards that group shared skills and name the repository they place into');
  teamProject.command('create [name]').description('Create a team project: a name, its repository, and the skills it places')
    .option('--remote <url>', "the project's repository; its skills place when a teammate installs inside that folder")
    .addOption(new Option('--team <team>', 'configured team (required when more than one exists)').hideHelp())
    .action(async (name: string | undefined, options: { remote?: string; team?: string }) => execute(io => active.team({ form: context.form, kind: 'project-create', name, ...options }, io), { verb: 'team project create', notices: true }));
  teamProject.command('delete [name]').description("Delete a team project: removes the list only — its skills stay in the team's marketplace")
    .option('--yes', 'skip the confirmation (a script, or a shell that already asked)')
    .addOption(new Option('--team <team>', 'configured team (required when more than one exists)').hideHelp())
    .action(async (name: string | undefined, options: { yes?: boolean; team?: string }) => execute(io => active.team({ form: context.form, kind: 'project-delete', name, ...options }, io), { verb: 'team project delete', notices: true }));
  team
    .command('workflow-update')
    .description('Print the current workflow scaffold for manual migration; never writes a repository')
    .option('--print', 'print the workflow YAML and migration instruction')
    .action(async (options: { print?: boolean }) => execute((io) => active.team({ form: context.form, kind: 'workflow-update', ...options }, io), { verb: 'team workflow-update', notices: false }));

  program
    .command('invite <github-login...>')
    .description('Invite GitHub users to the configured team')
    .addOption(new Option('--team <team>', 'configured team (required when more than one exists)').hideHelp())
    .action(async (logins: string[], options: { team?: string }) => execute((io) => active.invite({ form: context.form, logins, ...options }, io), { verb: 'invite', notices: true }));
  const ls = program.command('ls').description('List team members and shared skills (--local: your local Claude Code skills and their team status)').option('--local', 'list your local Claude Code skills and their team status instead of the team inventory').addOption(new Option('--team <team>', 'configured team (required when more than one exists)').hideHelp()).addHelpText('after', OUTPUT_HELP);
  ls.action(async (options: { team?: string; local?: boolean }) => execute((io) => active.ls({ form: context.form, cwd: process.cwd(), kind: 'all', ...options }, io), { verb: 'ls', notices: true }));
  ls.command('member <handle>').addOption(new Option('--team <team>', 'configured team (required when more than one exists)').hideHelp()).addHelpText('after', OUTPUT_HELP).action(async (handle: string, options: { team?: string }) => execute((io) => active.ls({ form: context.form, cwd: process.cwd(), kind: 'member', value: handle, team: options.team ?? ls.opts<{ team?: string }>().team, local: ls.opts<{ local?: boolean }>().local }, io), { verb: 'ls', notices: true }));
  ls.command('project <name>').addOption(new Option('--team <team>', 'configured team (required when more than one exists)').hideHelp()).addHelpText('after', OUTPUT_HELP).action(async (name: string, options: { team?: string }) => execute((io) => active.ls({ form: context.form, cwd: process.cwd(), kind: 'project', value: name, team: options.team ?? ls.opts<{ team?: string }>().team, local: ls.opts<{ local?: boolean }>().local }, io), { verb: 'ls', notices: true }));
  ls.command('skill [name]').description('Show one skill in full: the team record when it is shared, else your Library folder (name, id prefix, or a unique prefix; bare inside a skill folder)').addOption(new Option('--team <team>', 'configured team (required when more than one exists)').hideHelp()).addHelpText('after', OUTPUT_HELP).action(async (name: string | undefined, options: { team?: string }) => {
    const teamName = options.team ?? ls.opts<{ team?: string }>().team;
    const local = ls.opts<{ local?: boolean }>().local;
    return execute((io) => active.ls({ form: context.form, cwd: process.cwd(), kind: 'skill', ...(name === undefined ? {} : { value: name }), ...(teamName === undefined ? {} : { team: teamName }), ...(local === undefined ? {} : { local }) }, io), { verb: 'ls', notices: true });
  });
  program.command('status').description('Show local team details; exit 0 means the query succeeded, not a setup-readiness or membership test').addOption(new Option('--team <team>', 'show only this configured team').hideHelp()).addOption(new Option('--permissions', 'also ask GitHub which members hold admin permission (one network call)').hideHelp()).addHelpText('after', OUTPUT_HELP).action(async (options: { team?: string; permissions?: boolean }) => execute((io) => active.status({ ...options, form: context.form }, io), { verb: 'status', notices: true }));
  program
    .command('readme', { hidden: true })
    .option('--pr-comment <base-ref>', 'render the publish preview comment')
    .action(async (options: { prComment?: string }) => execute((io) => active.readme({ ...options, form: context.form }, io), { verb: 'readme', notices: false }));
  // The clone-local pre-push hook (D12): `guard-push <remote> <url> [<local ref> <local sha> <remote ref> <remote sha>]...`.
  program
    .command('guard-push <remote> <url> [refs...]', { hidden: true })
    .action(async (remote: string, url: string, refs: string[]) => execute((io) => active.guardPush({ form: context.form, remote, url, refs }, io), { verb: 'guard-push', notices: false }));

  program
    .command('publish <ref...>')
    .option('--category <name>', "the skill's terum-category; skips the model suggestion")
    .description("Publish a skill to the team's marketplace: opens a pull request under policy \"pr\", commits directly under policy \"push\"")
    .option('--project <project>', "also list the skill under this team project; without it the skill goes to the marketplace alone")
    .addOption(new Option('--team <team>', 'configured team (required when more than one exists and the ref is bare)').hideHelp())
    // One skill keeps the single-skill verb exactly as it was; two or more take the batched path,
    // which asks every question once and pushes once instead of once per skill.
    .action(async (refs: string[], options: { project?: string; team?: string; category?: string }) => execute((io) => refs.length === 1
      ? active.publish({ form: context.form, ref: refs[0]!, ...options, cwd: process.cwd() }, io)
      : active.publishMany({ form: context.form, refs, ...options, cwd: process.cwd() }, io), { verb: 'publish', notices: true }));

  program
    .command('unpublish <skill>')
    .description("Retract a skill from the team's marketplace: removes every version, its eval assets and receipts, and drops it from project lists and member profiles")
    .option('--yes', 'skip the typed-name confirmation')
    .addOption(new Option('--team <team>', 'configured team (required when more than one exists)').hideHelp())
    .addHelpText('after', '\nAnyone in the team may unpublish any skill; there is no ownership check. The git history is not rewritten, and installed copies keep working until each machine syncs, which then reports the skill as removed from the team. Republishing starts again at Version 1 under a new id.')
    .action(async (skill: string, options: { yes?: boolean; team?: string }) => execute((io) => active.unpublish({ form: context.form, ref: skill, ...options }, io), { verb: 'unpublish', notices: true }));

  program.command('validate [path|name]').description("Check a skill's safety and formatting deterministically: a shared skill by name or its local source folder by path (requires a configured team)").addHelpText('after', '\nDeterministic and offline (no model, no network call): HYG1 frontmatter, HYG2 hidden characters, HYG3 credentials and foreign emails, HYG4 executables and extensions, HYG5 license agreement, HYG6 description (size over 20,000 is a warning), HYG7 off-list category (checked only at publish, where the team category list is in hand; never fires here). A folder that has never been connected fails HYG1 on the managed fields connect adds (license, metadata.id, metadata.author, metadata.terum-category); connect it first.' + '\n' + OUTPUT_HELP).addOption(new Option('--team <team>', 'configured team (required when more than one exists)').hideHelp()).option('--cwd <team-checkout>', 'read the skill and team policy directly from this team checkout').action(async (target: string | undefined, options: { team?: string; cwd?: string }) => execute((io) => active.validate({ form: context.form, workingDirectory: process.cwd(), ...(target === undefined ? {} : { target }), ...options }, io), { verb: 'validate', notices: true }));
  program.command('receipt-check', { hidden: true }).action(async () => execute(async (io) => { io.print('receipt-check is retired; publish records receipts when it mints a version.'); return { ok: true, value: undefined }; }, { verb: 'receipt-check', notices: false }));
  program.command('share [ref]', { hidden: true }).action(async () => execute(async () => failure(`\`share\` is retired; run \`${invocation(context.form, 'publish <skill>')}\` to publish a skill explicitly.`), { verb: 'share', notices: false }));
  program.command('usage [skill]').description('Show which placed skills fired on this machine, and whether the model chose them or a person named them (read-only, no fetch, no model call)').option('--since <iso>', 'ISO-8601 lower bound; older than transcript retention is answered from this machine\'s archive').option('--all', 'fold fired names with no placement into the main table').option('--json', 'emit the aggregate object').action(async (ref: string | undefined, options: { since?: string; all?: boolean; json?: boolean }) => execute((io) => active.usage({ form: context.form, ...(ref === undefined ? {} : { ref }), ...options }, io), { verb: 'usage', notices: false }));
  program.command('misses [skill]').description('Screen real prompts for skills that looked applicable and never fired - candidates for review, never a miss rate (spends model calls)').option('--since <iso>', 'ISO-8601 lower bound; defaults to the last 7 days').option('--limit <n>', 'cap the review queue (default 20)', (v) => Number.parseInt(v, 10)).option('--json', 'emit the candidate queue').action(async (ref: string | undefined, options: { since?: string; limit?: number; json?: boolean }) => execute((io) => active.misses({ form: context.form, ...(ref === undefined ? {} : { ref }), ...options }, io), { verb: 'misses', notices: false }));
  program.command('eval-report [skill]').description("Show a skill's committed eval receipts and this machine's local runs (read-only, no fetch)").option('--team <team>', 'configured team (required when more than one exists)').addHelpText('after', OUTPUT_HELP).action(async (ref: string | undefined, options: { team?: string }) => execute((io) => active.evalReport({ form: context.form, cwd: process.cwd(), ...(ref === undefined ? {} : { ref }), ...options }, io), { verb: 'eval-report', notices: false }));
  program.command('eval [skills...]').description("Evaluate local skills; several at once run as a batch, --window queues them for the app or a later drain; a receipt is published to the team when the skill's exact bytes are already a published version").option('--k <n>', 'repetitions per execution case (default 1; --k 3 or more for a receipt you intend to gate on)', Number).option('--no-commit', 'keep the receipt on this machine instead of publishing it to the team').option('--triggers-only').option('--execution-only').option('--case <stem>').option('--model <model>').option('--judge-model <model>').option('--no-gen', 'do not generate missing eval assets').option('--vs <ref>', 'head-to-head: score this skill against another on one neutrally-derived brief (no verdict, no receipt)').option('--brief <path>', 'supply the shared task brief instead of deriving one (required with --vs when nothing can ask)').option('--derive-brief', 'with --vs: derive the shared brief, write it, and stop — review it, then re-run with --brief <path>').option('--heavy', 'use heavy one-session mode without asking').option('--no-heavy', 'use per-case mode without asking').option('--team <team>').option('--parallel <n>', 'evals to run at a time (default: 4)', Number).option('--batch <n>', 'run this many at a time and ask before each further batch; declining queues the rest for later', Number).option('--pending', 'every shared skill with no receipt for its current version (what setup offers)').option('--queue-list', 'list queued evals').option('--drain', 'run queued evals').option('--window <window>', 'with skills: queue them for that window (overnight | later) instead of running; with --drain: drain only that window').option('--max <n>', 'maximum queued items to attempt', Number).option('--dequeue <skill>', 'remove a skill from the queue (<skill> or <team>/<skill>)').addHelpText('after', OUTPUT_HELP).action(async (refs: string[], options: { parallel?: number; batch?: number; pending?: boolean; queueList?: boolean; drain?: boolean; window?: string; max?: number; dequeue?: string; k?: number; triggersOnly?: boolean; executionOnly?: boolean; case?: string; model?: string; judgeModel?: string; gen?: boolean; commit?: boolean; heavy?: boolean; vs?: string; brief?: string; deriveBrief?: boolean; team?: string }) => {
    // commander models `--no-gen` as `gen: false`; with `--gen` deleted (D29) false is the only
    // value it can carry, and `use what is there, generate what is missing` is the default.
    // commander models `--no-X` as a default of `true`, so `commit` is dropped unless it was actually
    // typed: publishing a matching receipt is the default, and only an explicit `--no-commit` opts out.
    const { gen, commit, ...rest } = options;
    const args = { form: context.form, cwd: process.cwd(), ...rest, ...(gen === false ? { noGen: true } : {}), ...(commit === false ? { commit: false } : {}) };
    // Three shapes share the verb: the queue modes (no skills), one skill or none (the ordinary run — a bare `eval`
    // inside a Library skill folder resolves the folder, rung 0), and several skills or the wizard's
    // batch/window/pending choices as flags (runMany). Queue-mode validation stays in runQueue.
    // IE6: a head-to-head compares exactly two skills in one run; the batch and queue shapes
    // have no meaning for it, and silently running the first ref would bill the wrong pair.
    if (options.vs !== undefined && (refs.length > 1 || options.pending || options.batch !== undefined || options.window !== undefined || options.queueList || options.drain || options.dequeue !== undefined)) {
      return execute(async () => failure('--vs compares exactly two skills in one run: pass a single skill, with no batch, queue, or --pending option.'), { verb: 'eval', notices: true });
    }
    const queueMode = options.queueList || options.drain || options.dequeue !== undefined || options.max !== undefined;
    if (queueMode) {
      const { runQueue } = await import('./commands/eval.js');
      return execute(io => runQueue({ ...args, ...(refs[0] === undefined ? {} : { ref: refs[0] }) }, io), { verb: 'eval', notices: true });
    }
    if (refs.length <= 1 && !options.pending && options.batch === undefined && options.window === undefined && options.parallel === undefined) return execute(io => active.eval({ ...args, ...(refs[0] === undefined ? {} : { ref: refs[0] }) }, io), { verb: 'eval', notices: true });
    const { runMany } = await import('./commands/eval.js');
    return execute(io => runMany({ ...args, refs }, io), { verb: 'eval', notices: true });
  });

  program.command('install [ref] [value]').description('Install the latest version, or adopt a matching folder already in your Library').addOption(new Option('--team <team>').hideHelp()).addOption(new Option('--yes-profile').hideHelp()).option('--into <global|root>').option('--adopt <path>', 'record this existing Library folder as installed without copying it').addHelpText('after', OUTPUT_HELP).action(async (ref: string | undefined, value: string | undefined, options: { team?: string; into?: string; adopt?: string }) => execute((io) => active.install(ref === 'member' ? { kind: 'member', member: value, ...options, form: context.form } : ref === 'project' ? { kind: 'project', project: value, ...options, form: context.form } : { ref, ...options, form: context.form }, io), { verb: 'install', notices: true }));
  program.command('uninstall-skill <ref> [value]').description('Remove a placed skill: <ref>, `member <handle>`, or `project <name>`').addOption(new Option('--team <team>').hideHelp()).option('--from <global|root>').addHelpText('after', OUTPUT_HELP).action(async (ref: string, value: string | undefined, options: { team?: string; from?: string }) => execute((io) => active.uninstall(ref === 'member' ? { kind: 'member', member: value, ...options, form: context.form } : ref === 'project' ? { kind: 'project', project: value, ...options, form: context.form } : { ref, ...options, form: context.form }, io), { verb: 'uninstall-skill', notices: true }));
  program.command('uninstall').description('Remove terum-skills from this machine: your team (placed skills, local clone, cache), the session-start hook and the terum-skills skills for Claude Code and Codex if present, and ~/.terum/skills except recovery data; then prints the package-manager step').allowExcessArguments().action(async (_options: Record<string, never>, command: Command) => execute(async (io) => command.args.length ? failure(`To remove a skill, use \`${invocation(context.form, 'uninstall-skill <ref>')}\`.`) : active.uninstallMachine({ launch: context.launch, form: context.form }, io), { verb: 'uninstall', notices: true }));
  program.command('sync').description('Fetch each team clone and reset it to origin/main. Nothing on this machine is changed: no placement, no upload, no edit to your skills.').option('--hook', 'session-start mode').addOption(new Option('--team <team>', 'configured team (required when more than one exists)').hideHelp()).addHelpText('after', OUTPUT_HELP).action(async (options: { hook?: boolean; team?: string }) => execute((io) => active.sync({ ...options, form: context.form }, io), { verb: 'sync', notices: !options.hook }));
  program.command('prune').description('Delete quarantined items after listing and confirmation').action(async () => execute((io) => active.prune({ form: context.form }, io), { verb: 'prune', notices: true }));
  program.command('search <term>').description('Search shared skills by name, description, or category (read-only)').option('--category <category>').option('--author <author>').option('--project <project>').addHelpText('after', OUTPUT_HELP).action(async (term: string, options: { category?: string; author?: string; project?: string }) => execute((io) => active.search({ form: context.form, term, ...options }, io), { verb: 'search', notices: true }));

  program.command('app')
    .description('Open the Terum Skills desktop app for this version, downloading it first if needed (macOS, Windows); records where this CLI is so the app can drive it')
    .action(async () => execute((io) => active.app({ form: context.form, launch: context.launch }, io), { verb: 'app', notices: false }));

  program.command('update')
    .description("Show this copy's version, the latest advertised release, and the command that updates it (prints it, never runs it)")
    .addHelpText('after', OUTPUT_HELP)
    .action(async () => execute((io) => active.update(context, io), { verb: 'update', notices: false }));

  program.command('profile').description('Update your own team profile')
    .option('--name <display>').option('--bio <text>').option('--role <role>')
    .option('--project <name>', 'project membership (repeat for each project)', (value: string, previous: string[]) => [...previous, value], [])
    .option('--remove <skill>', 'take a skill off your profile (publishing adds it)')
    .addOption(new Option('--team <team>').hideHelp())
    .action(async (options: Omit<ProfileArgs, 'projects'> & { project?: string[] }) => {
      const { project, ...rest } = options;
      return execute(io => active.profile({ ...rest, ...(project?.length ? { projects: project } : {}), form: context.form }, io), { verb: 'profile', notices: true });
    });
  program.command('app-update')
    .description('Check for, download, or install a newer Terum Skills desktop app (reports only, unless --stage or --apply)')
    .option('--check', 'ask GitHub for the newest release at most once a day, then report what is advertised and what is staged; downloads nothing (default)')
    .option('--stage', 'download and verify the desktop app for --release; installs nothing')
    .option('--apply', 'hand the install to a background process and return; the caller must then quit')
    .option('--release <version>', 'which released version to act on (default: this copy’s version)')
    .option('--force', 'with --check, ask GitHub now instead of honouring the once-a-day cap')
    .addOption(new Option('--reason <reason>', 'record why the app is installing').choices(['on-close', 'overnight', 'manual']))
    .addOption(new Option('--await-pid <pid>', 'wait for this process to exit before installing').hideHelp())
    .addOption(new Option('--apply-now', 'the detached install leg; never run this by hand').hideHelp())
    .action(async (options: { check?: boolean; stage?: boolean; apply?: boolean; release?: string; force?: boolean; awaitPid?: string; applyNow?: boolean; reason?: string }) => execute((io) => active.appUpdate({ ...options, form: context.form, launch: context.launch }, io), { verb: 'app-update', notices: false }));
  return program;
}
