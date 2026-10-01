import type { Design } from '../fixtures/schema';
import type { EvalQueueItem } from './eval-queue';
export type Result<T> = {ok:true;value:T}|{ok:false;error:string;cancelled?:true;refused?:true;reason?:'no-team'|'ambiguous-team'|'not-in-library'|'not-found'|'ambiguous-ref'|'unreadable'|'invalid-config';value?:T};
export interface LaunchContext { writtenAt: string; target?: string; intent?: 'setup' }
export class PromptCancelledError extends Error { readonly cancelled = true as const; }
export interface AskOptions {detail?:readonly string[];descriptions?:readonly string[];default?:string}
export interface Prompter {readonly interactive:boolean;confirm(question:string,options?:AskOptions):Promise<boolean>;text(question:string,defaultValue?:string,options?:AskOptions):Promise<string>;select(question:string,choices:readonly string[],options?:AskOptions):Promise<string>;print(line:string):void}
/** §9.2/D13: `path` is `text` whose answer is a filesystem path — the shell may offer a folder chooser. */
export type AskKind='confirm'|'text'|'select'|'path';
/** Carried with a question from the run that asked it: when `signal` aborts, the run has settled and the question is withdrawn. */
export type PromptOptions={signal?:AbortSignal};
export interface PromptQuestion {kind:AskKind;question:string;choices?:readonly string[];default?:string;detail?:readonly string[];descriptions?:readonly string[]}
export type Frame={t:'print';line:string}|{t:'ask';id:string;kind:AskKind;question:string;default?:string;choices?:readonly string[];detail?:readonly string[];descriptions?:readonly string[]}|{t:'progress';done:number;total:number;label?:string;/** The skill this rung is about, when one run works through several (a batched publish). Absent for a verb doing one thing. */item?:string}|{t:'result';ok:boolean;error?:string;declined?:boolean;refused?:boolean};
export interface Run<T>{readonly frames:AsyncIterable<Frame>;answer(id:string,value:string|boolean):void;cancel():Promise<void>;readonly done:Promise<Result<T>>}
/** `windowControlsEnd`: right edge, in CSS px from the window's left edge, of the OS controls drawn over the web content under `mac-overlay` (68 before macOS 26, 76 from it); null when the OS draws none there. */
export interface Capabilities {appVersion:string;windowChrome:'mac-overlay'|'native'|'cosmetic';windowControlsEnd:number|null;disablePerMachine:boolean;inboxEventLog:boolean;offtargetKind:boolean;machineRegistry:boolean;perCaseEvalTables:boolean;openInEditor:boolean;clipboard:boolean}
// §7.1: the local key is `libraryProjects`, not `projects` — `projects` is already the marketplace's
// team-projects screen, and desktop/AGENTS.md invariant 2 forbids one flag meaning two things.
export const FEATURE_KEYS = ['favorites','follow','roles','lastSeen','installScope','inviteScoping','disablePerMachine','projectMembers','liftOnCards','runEvalInApp','perCase','progress','memberRole','localIdentity','libraryProjects','projectRename','projects','refresh','appUpdate','reconcile','serve','usage','misses'] as const;
export type FeatureKey = typeof FEATURE_KEYS[number];
export type Features = Readonly<Record<FeatureKey, boolean>>;
export interface Surfaces {libraryProjects:boolean;divergence:boolean;status:boolean;settings:boolean;onboarding:boolean;library:boolean;skill:boolean;receipts:boolean;inbox:boolean;catalog:boolean;roster:boolean;update:boolean;appUpdate:boolean}
export interface ReadOptions {signal?:AbortSignal}
export type Theme='dark'|'light'|'system';
export type Scope=string;
export type TokenKey=keyof Design['TOKENS'];
/** `bundled` marks a folder this tool placed itself — the /terum-skills manual setup writes to the
 *  global skills root. It is a neutral fact, not a fault: it draws a muted chip rather than the
 *  `broken` alert, and it gates eval and publish the same way (Ryan, 2026-09-14). */
export type IndicatorKey='update'|'local'|'broken'|'bundled';
export interface ReceiptSummary {w:number;l:number;t:number;n:number;lift:number;verdict:'PASS'|'NEUTRAL'|'FAIL';partial:[number,number]|null;signP:string}
/** The provenance a card must keep reachable from any receipt number it draws (frame-protocol.md). */
export interface CardProvenance {model:string;k:number;ccVersion:string;runner:string;when:string}
/** Where a skill stands with the team, which decides whether Publish can run: `endorsed` is
 *  listed in team.json, `shared` is in the team repo but not endorsed, `unshared` is a folder
 *  the team repo does not hold, `unknown` is a team the CLI could not read. */
export type TeamState='endorsed'|'shared'|'unshared'|'unknown';/** 'placed': this machine has the skill (a ledger placement — including one only the unfiltered status ledger sees — or an identified on-disk copy). 'recorded': the team people file says this user installed it, but nothing is on this machine — the truthful in-between state (per ryanliu, 2026-09-09). 'absent': neither. The booleans `placed`/`onDiskOnly` keep the finer disk-provenance split (ledger-tracked vs user's own copy) within the 'placed' state. */
export type InstallState='placed'|'recorded'|'absent';/** Which detail backend can describe this card. A team card is addressed by name through
 *  `skill({ref})`; a folder that belongs to no team exists only on this machine and must be
 *  addressed by `path` through `localSkill({path})`, because the team inventory has no row for
 *  it. Never infer this from `project` — that field carries the root a folder lives in ('Global'
 *  or a checkout's basename), which no longer distinguishes the two. */
export interface SkillCard {
 edited:boolean;
 localEval:(ReceiptSummary & {runnerHandle:string|null;version:string|null})|null;localEvalStale:boolean;
 /** Machine-local annotation from placements; never used for catalogue ordering or counts. */
 installedVersion:string|null;latestVersion:string|null;evalVersion:number|null;evalStale:boolean;latestEvalState:'ok'|'none'|'invalid'|null;profileVersion:string|null;
 /** Cross-mirror overlays spec §4.3 — the byte-level join. Marketplace: an on-disk copy's bytes equal a published version ('identical'), equal none ('differs'), or there is no copy / the CLI predates the key (null). Library: the folder's bytes equal a version ('identical'), equal none though the team knows this skill or the ledger placed it ('differs'), relate to no team skill at all ('none'), or the CLI predates the key (null). Never an ordering or count input. */
 localMatch:'identical'|'differs'|'none'|null;
 /** The folder's frontmatter uuid belongs to a team skill. Marketplace cards are team skills by construction (true). */
 knownToTeam:boolean;
teamed:boolean;path:string|null;updated:string|null;favorites?:number|null;grants:string[]|null;normalizedGrants:string|null;grantsHash:string|null;project:string;category:string;name:string;desc:string;size:string;installs:string;favorite:boolean;flags:IndicatorKey[];flagText:Partial<Record<IndicatorKey,string>>;/** The broken flag names a fault `skill fix` repairs (an `invalid-yaml` or `name-mismatch` folder); the detail page draws Fix beside it. */fixable?:boolean;enabled:boolean;installed:InstallState;placed:boolean;onDiskOnly:boolean;teamState:TeamState;paths:[string,string][];projectRoots?:string[];provenance?:CardProvenance|null;wlt:[number,number,number]|null;cases?:number|undefined;partial?:[number,number]|null|undefined;summary:ReceiptSummary|null;installsN:number;tokensK:number;indicators:Record<IndicatorKey,{icon:string;token:TokenKey;text:string}>}
export type Receipt=NonNullable<Design['DETAIL']['receipt']>;
export interface SkillMdBlock {kind:'h2'|'p'|'ol'|'code';content:string|string[]}
export interface ReportNumbers {holes:number;nRounds:number;triggerTotal:number;precisionObserved?:string}
export interface EvalEstimate {cases:number;k:number;arms:number;runs:number;minutes:number;dollars:number;model:string}
export type SkillDetail=Omit<Design['DETAIL'],keyof SkillCard|'root'|'history'|'lines'|'version_full'|'repo'|'path'|'files'> & SkillCard & {path:string|null;repoPath:string;files:string[]|null;pathLabel:string;repo:string|null;version_full:string|null;team:string|null;installScopes:[string,string][];installScopePaths?:Record<string,string>;projectNames:string[]|null;favorites:number|null;lines:number|null;hygieneCaption:string|null;hygieneStatus:'pass'|'fail'|null;hygieneWhen:string|null;skillRef:string;root:'Global'|'Marketplace';history:(Design['DETAIL']['history'][number]&{summary:ReceiptSummary|null;local?:true;runId?:string;report?:{receipt:Receipt;summary:ReceiptSummary;numbers:ReportNumbers;incumbentLift:[number,string]|null}})[];skillMd:{frontmatter:string;body:SkillMdBlock[];markdown?:string|null};evalEstimate:EvalEstimate|null;evalEstimateText:string;evalEstimateTip:string;evalCommand:string;shareCommand:string;incumbentLift:[number,string]|null;reportNumbers:ReportNumbers|null;scoreFractions:{routesExpected:number|null;roi:[number,number]|null};
 versions:{placed:string|null;teamCurrent:string|null;evaluated:string|null}|null;
 latestState:'ok'|'none'|'invalid';invalidReceiptFile:string|null;evalReportError:string|null;
 /** A same-named local folder the driving CLI is too old to identify: presence is unknown, so the
  *  page must not claim "Not installed" nor offer an Install that would collide with it. */
 unidentifiedLocal:{path:string;pathLabel:string}|null;
 /** The Library root this detail describes, as the backend resolved it: `id` is the sidebar's root
  *  id — the literal 'Global', or a checkout's repo root — and `label` is the crumb's first part.
  *  Null when the read was not anchored to one root (a bare-name deep link answered machine-wide,
  *  or the marketplace), and the screen then falls back to `root`. A page must never derive this
  *  from a path: root membership is the backend's to decide (desktop/AGENTS.md invariant 1). */
 owningRoot:{id:string;label:string}|null;
 /** The viewer's own handle in this team, so the page describes the viewer's install as theirs
  *  instead of a teammate's. Null when the detail is not team-scoped, as for a local folder that
  *  belongs to no team and therefore has no per-team handle to compare against.
  *  This is the per-team handle, never the machine's default identity — they can differ. */
 viewerHandle:string|null;
 localRuns:{runId:string;runDir:string;executionStatus:'complete'|'partial'|'failed'|'unknown';committed:boolean;receipt:Receipt|null;summary:ReceiptSummary|null}[];
};
/** One skill's live firing counts (build spec §4.2), read from the CLI's `usage` verb.
 *
 *  `firings:null` means this machine has no PLACEMENT for the skill — it was never installed here,
 *  so it was never in a position to be passed over. That is not the same as `{d1:0,d2:0}`, which
 *  means it was installed and the model ignored it anyway. The second is the case this whole
 *  feature exists to find; a panel that renders both as "no firings" throws it away. */
export interface UsageModel{firings:{d1:number;d2:number;autonomy:number|null;availability:'full'|'partial'|'unknown';placed:boolean}|null;since:string;until:string;caveats:string[]}
/** One skill's miss-screening result, from the CLI's `misses` verb.
 *
 *  A candidate is a (prompt, skill) PAIR the judge said applied and no firing was observed for --
 *  NEVER a measured miss rate. The CLI refuses to compute one and this model must not invent one:
 *  the judge sees a trimmed window, not the session. `truncated` means --limit dropped pairs;
 *  `unjudged` means a model call failed, so those prompts were scored in neither direction. */
export interface MissesModel{groups:{skill:string;candidates:{prompt:string;ts:string;noPriorContext:boolean}[]}[];screened:number;calls:number;truncated:boolean;unjudged:number;since:string;until:string;caveats:string[]}
export type EvalReportModel=Pick<SkillDetail,'receipt'|'summary'|'incumbentLift'|'reportNumbers'|'history'|'versions'|'latestState'|'invalidReceiptFile'|'localRuns'|'evalEstimate'|'evalEstimateText'|'evalEstimateTip'|'scoreFractions'|'wlt'>;
// D22: `update` (update-available) and `review` (PR review) are the two mechanisms this refactor
// deletes, so they are no longer item kinds. design.json still records their canvas rows; the mock
// projection drops them rather than loosening the byte-locked fixture schema.
export type InboxKind='share'|'alert'|'eval'|'author'|'team';
export const INBOX_KINDS:readonly InboxKind[]=['share','alert','eval','author','team'];
export type InboxItem=Omit<Design['INBOX'][number],'kind'> & {id:string;skillRef:string;kind:InboxKind;summary:ReceiptSummary|null;incumbentLift:[number,string]|null;reportNumbers?:ReportNumbers};
export type Person=Omit<Design['ROSTER'][number], 'followers'|'role'> & {role:string|null;followers:number|null;projects:string[];organization:string|null;lastPublish:string;skills:string[];installable:string[];adoption:number;publishLine:string;teamsLine:string;buckets:[string,string[]][];profileVersions:Record<string,string>;placeNote:string;onDisk:[number,number]};
/** `remoteSlugs` is every remote of the team project as `owner/repo`, normalised by the adapter's `repoSlug`; the install-destination picker matches a checkout on ANY of them (bulk-install-destination spec §3). `remote` stays display copy: the first remote's URL. */
export type Project=Omit<Design['PROJECTS'][number], 'evaluated'|'favorites'|'admin'|'updated'> & {admin:Design['PROJECTS'][number]['admin']|null;updated:string|null;evaluated:number|null;favorites:number|null;memberHandles:string[];memberInitials:string[];skillsIn:string[];remoteSlugs:string[]};
export interface Catalog {scanned:string[]|null;repository:string|null;skills:SkillCard[];extras:SkillCard[];people:Person[];projects:Project[];categories:Design['CATEGORIES'];categoryRemaining:Record<string,number>;topRated:string[];peopleByAdoption:string[];projectsByMembers:string[];categorySkills:Record<string,string[]>;filterDefault:Design['FILTER_DEFAULT'];filterCount:number;verdictCounts:Record<'PASS'|'NEUTRAL'|'FAIL'|'Not evaluated',number|null>;catalogN:number;teamN:number;bulkInstall:Record<string,{total:number;asking:number}>}
/** `skillsTotal` is how many skills that member's own machine last reported having (their people file's `local_skills`) — a self-report about them, not a fact about this machine; null when nobody has reported one. */
export type Member=Omit<Design['ROSTER'][number], 'followers'|'role'|'joined'> & {role:string|null;followers:number|null;joined:string|null;skillsTotal:number|null;status:string;projects:string[];lastSeen:string;lastPublish:string};
/** `invited`, `joined` and `skillsTotal` are null when the source does not report them — the screen omits the claim rather than asserting zero or a date. */
export interface Roster {members:Member[];invited:Design['INVITED']|null;member:Record<string,{status:string;projects:string[];lastSeen:string}>;byAdoption:string[]}
/** `slug` is owner/repo on GitHub and null on every other host; `remote` is null when the folder has no origin at all. */
export interface RootRemote {url:string;slug:string|null}
/** §7.2 removed `detected`: every project root is here because the user added it. */
export interface Root {id:string;kind:'global'|'checkout';label:string;root:string;rootState?:'scanned'|'absent'|'unreadable'|undefined;registered:boolean;count?:string|undefined;remote?:RootRemote|null|undefined;/** Sub-projects: the id (repo root) of the registered checkout whose folder holds this one; null at the top level, and on a CLI that predates the tree. */parent?:string|null|undefined}
export type LibraryScope={kind:'global'}|{kind:'checkout';root:string};
export interface ReconcileRow {path:string;name:string;team:string;skillId:string|null}
export interface ReconcileResult {identical:(ReconcileRow&{version:string})[];differing:(ReconcileRow&{teamVersion:string;nextVersion:string;sameId:boolean;teamAuthor:string})[];renamed:(ReconcileRow&{version:string;teamName:string})[];adopted:string[];published:string[]}
export interface ProjectAdded {path:string;label:string;added:boolean;/** The registered project the folder sits inside, when it was added as a sub-project. */parent?:string|null|undefined;reconcile?:ReconcileResult}
/** `project create`: the team project as team.json now holds it. A new project is always born with no skills. */
export interface ProjectCreated {team:string;name:string;remotes:string[];skills:number}
export interface ProjectRemoved {path:string;placementsRemaining:number;/** Registered folders inside the forgotten one: they stay, drawn one level up. */subProjectsRemaining?:number|undefined}
/** `project rename`: display text only — the folder keeps its name, and no team file changes. */
export interface ProjectRenamed {path:string;label:string;previous:string}
/** The Library overview row's fourth tile counts skills never published to the team marketplace. It
 *  stands where the design board draws Team installs, so the two extra strings are declared here
 *  rather than in `src/fixtures/design.json`, which invariant 3 forbids hand-editing (`installs` /
 *  `installs_note` / `zero.installs` therefore stay in the generated shape, now unread by the row).
 *  `unpublished` is '—' when the driving CLI is too old to report publish state — an unknown, never
 *  a zero. */
export type LibraryOverview=Design['LIBRARY_OVERVIEW'] & {unpublished:string;unpublished_note:string;zero:Design['LIBRARY_OVERVIEW']['zero'] & {unpublished:string}};
export interface Library {roots:Root[];scanned:string[]|null;skills:SkillCard[];overview:LibraryOverview;title:string;root:Root;problems?:readonly {source:string;message:string}[]}
/** attention = failingEvals + updatesAvailable + notEvaluated; counts.Alerts = attention, counts.Updates = updatesAvailable. Absent CLI counters are omitted. */
export type CloneState = {state:'absent'} | {state:'incomplete';reason:'not-a-repository'|'no-team-json'|'unverifiable';error?:string} | {state:'foreign'|'ok';origin:string};
/** name comes from team.json via status; key is the config identifier. They may differ; there is no label. */
export interface TeamStatus {
 name:string;key:string;remote:string|null;handle:string;clone:string|null;members:number|null;skills:number|null;
 last_sync:string|null;stamp:string|null;policy:{license:string}|null;categories:string[]|null;
 pending:{op:'install'|'uninstall';id:string;scope:{kind:'global'}|{kind:'project';project:string};version:string|null;started:string}[];
 joinCommand:string|null;joinBlock:readonly string[]|null;
 cloneState?:CloneState|null;readable?:boolean|null;
}
export type Machine=Design['MACHINE'] & {hostname:string};
export type Identity=Design['ME'] & {initials:string;footerLabel:string};
export interface StatusLedger {
  placements:{path:string;id:string;team:string;version:string|null;scope:{kind:'global'}|{kind:'project';project:string};placed_at:string}[];
  approvals:{id:string;grants:string;approved_at:string}[];
}
export interface StatusResult {ledger?:StatusLedger|null;machine:Machine;me:Identity;teams:TeamStatus[];counts:Record<string,string>;tools:{git:boolean;gh:boolean};roots:Root[]}
export interface SearchArgs {q:string;kinds?:readonly ('skill'|'member'|'project')[]}
/** No `endorsed`: the CLI's SearchHit dropped it (refactor spec §4.1; review r1 HIGH) — a skill's lists are the catalog's projects, not a search field. */
export interface SearchHit {kind:'skill'|'member'|'project';ref:string;name:string;description:string;team:string|null;category:string|null;author:string|null;installs:number|null;latest:string|null}
export interface IdentityArgs {name?:string;email?:string;defaultHandle?:string}
export interface IdentityWrite {updated:{key:string;value:string}[];notice:string|null}
export interface InstallArgs {team?:string;ref?:string;adopt?:string;scope?:Scope;kind?:'skill'|'member'|'project';member?:string;project?:string;yesProfile?:boolean}
export interface InstalledResult {id:string;name:string;scope:Scope;path:string|null;version:string|null;profiled:boolean}
export interface UninstallArgs {from?:string;team?:string;ref:string;kind?:'skill'|'member'|'project';member?:string;project?:string}
export interface UninstalledResult {id:string;name:string}
export interface MachineUninstallResult {removed:string[];removedPlacements:number;hookRemoved:boolean;wrapperRemoved:boolean;configRemoved:boolean;kept:string[];record:string;advice:string[]}
export interface PublishArgs {team?:string;ref:string;message?:string;/** ALSO list the skill in `team.json projects[<project>].skills`; publishing itself goes to the marketplace. */project?:string;/** The skill's terum-category (`--category`): skips the CLI's model suggestion. A declared category in SKILL.md still wins. */category?:string}
/**
 * §5.3. `version` is the `v<N>` this publish minted, or — when the bytes were byte-identical to a
 * version already in the repo — the one it matched, which `identicalTo` names. `created` is the
 * honest "did anything new land" flag, and it is deliberately not the same question as "did
 * anything change": a publish can add the skill to a project without minting a version.
 */
export interface PublishResult {name:string;/** The project also listed, or null — the marketplace alone. */project:string|null;version:string|null;created:boolean;identicalTo:string|null;attachedEvals:number;evalAssets:number;profileAdded:boolean;projectAdded:boolean;/** Why this skill alone was not published, when a batched run refused it and published the rest; null otherwise. */refused?:string|null}
/** A selection published in one run: one refresh, every question asked once, one push. Order is preserved in the result. */
export interface PublishManyArgs extends Omit<PublishArgs,'ref'> {refs:readonly string[]}
export interface UnpublishArgs {team?:string;/** The skill's marketplace name — the `skills/<name>/` folder, never a Library path. */ref:string}
/**
 * The inverse of `PublishResult`: what the retraction actually removed. Every count is reported so the
 * app can say it plainly — a skill listed in no project and endorsed by nobody still unpublishes, and
 * the zeroes are the honest answer rather than a reason to hide the line.
 *
 * `versions` is newest-first (`['v4','v3',…]`). Anyone in the team may unpublish any skill
 * (2026-09-14); the CLI's only brake is the typed-name confirmation, which the app answers with
 * `--yes` after its own dialog has made the person name the skill.
 */
export interface UnpublishResult {name:string;id:string;versions:string[];evalAssets:number;receipts:number;projects:string[];profiles:number}
export interface SyncArgs {team?:string}
// The fetch-only sync result (§10). `detail` is the CLI's own reason for a state other than 'refreshed';
// it is spelled the same here as in the CLI so the popup can render it.
/** Where a team whose repository no longer exists may have gone (CLI lib/successor.ts). */
export interface SyncSuccessor {ownerRepo:string;source:'invitation'|'member';teamName:string|null;at:string|null}
export interface SyncTeam {team:string;state:string;detail?:string;
 /** The remote answered "repository not found"; `successors` are the replacements GitHub knows of, `summary` the CLI's one line about it. */
 missing?:true;successors?:SyncSuccessor[];lookup?:string;summary?:string}
export interface SyncResult {notices:string[];changed:boolean;teams:SyncTeam[]}
// No `role`: GitHub's collaborator `permission` is "Only valid on organization-owned repositories" and
// the CLI's invite verb takes only logins and --team, so an invitation cannot carry one (Ryan, 2026-09-10).
export interface InviteArgs {team?:string;logins:string[];scope?:Scope}
export interface InviteResult {invited:string[];already:string[];failed:{login:string;error:string}[]}
/** `move`: follow a team whose repository moved — `remote` is the new `<org>/<repo>`, `team` the configured team to leave; the dialog that offers it is the confirmation, so the CLI runs with --yes. */
export interface TeamArgs {kind:'create'|'join'|'remove'|'leave'|'move';name?:string;team?:string;remote?:string;handle?:string}
export interface TeamResult {name:string;kind:TeamArgs['kind'];
 /** `move` only: what came back. */
 restored?:string[];missing?:string[];failed?:{name:string;error:string}[]}
export interface SetupArgs {target?:string}
export const SETUP_STEP_KEYS = ['welcome','app','role','github','team','invite','projects','existing','evals','community','hook','wrapper','editHook','done'] as const;
export type SetupStep = typeof SETUP_STEP_KEYS[number];
export interface SetupResult {team:string;role:'creator'|'joiner';steps?:Partial<Record<SetupStep,'done'|'skipped'|'printed'|'queued'|'batched'>>|null}
export interface EvalArgs {team?:string;ref:string;cases?:number;
 /** IE6: the rival skill's ref. Present only for a head-to-head run. */
 vs?:string;
 /** IE6 §3.1: the reviewed brief's path. A head-to-head run REQUIRES one — the app derives first. */
 brief?:string}
/** IE6 §3.1: derive the shared brief and stop, so the human can review it before anything is spent. */
export interface DeriveBriefArgs {team?:string;ref:string;vs:string}
export interface DerivedBrief {brief:string;briefPath:string}
/** §6.3: `team` and `id` are null for a folder that belongs to no team, which is now the common case. */
export interface EvalResult {name:string;runDir:string;executionStatus:'complete'|'partial'|'failed';team:string|null;id:string|null;shareHint:boolean}
/** Several skills in one CLI run — `eval <skill>… [--batch n] [--window w] [--pending]`: the wizard's Now / In batches /
 *  Overnight choices, offered past setup. `pending` adds every shared skill with no receipt for its current version
 *  (it needs a team); `batch` is required by, and only read under, mode 'batches'. */
export interface EvalManyArgs {refs:string[];team?:string;mode:'now'|'batches'|'overnight'|'later';batch?:number;pending?:boolean}
/** `queued` holds what the run put on the queue: every skill under a window, or the remainder after a declined
 *  batch, in which case `stoppedAfter` says how many had been attempted. */
export interface EvalManyResult {mode:'ran'|'queued';team:string|null;skills:string[];ok:number;failed:number;queued:EvalQueueItem[];stoppedAfter?:number}
export interface ValidateArgs {team?:string;ref?:string;cwd?:string}
/** `repairs` lists, one sentence each, the changes `skill fix` would make and `repairable` counts them; a CLI that predates the verb omits both and the adapter reads 0 and [], so the app draws no Fix. A CLI with the count but no list draws Fix and the dialog names the count alone. */
export interface ValidateResult {name:string;findings:number;warnings:number;repairable:number;repairs:string[]}
export interface UpdateAdvice {running:string|null;latest:string|null;observation:'newer'|'same'|'older'|'unknown';launch:'global'|'local'|'npx'|'source'|'unknown';description:string;advice:string[];lines:string[]}
export type AppUpdatePhase='waiting'|'installing'|'launched'|'failed';
export type AppUpdateReason='on-close'|'overnight'|'manual';
export interface AppUpdateMarker {version:string;phase:AppUpdatePhase;at:string;error:string|null}
/** The app's own update state. `newer` is computed in the adapter from `latest` vs the running build. */
export interface AppUpdateStatus {acknowledgementError?:string;reason?:AppUpdateReason;appVersion:string;/** The build the CLI resolved for this machine (`win32-arm64`, `darwin-x64`, `unsupported`…), so the row can say which build it downloads. */platform:string;supported:boolean;cliVersion:string|null;latest:string|null;latestAt:string|null;probe:'ok'|'skipped'|'cached'|'failed';probeError:string|null;staged:string|null;installed:string[];lastApply:AppUpdateMarker|null;newer:boolean;ppid:number}
export interface AppUpdateStaged {version:string;staged:boolean;notPublished:boolean;alreadyStaged:boolean}
export interface PrefStore {get<T>(key:string,fallback:T):T;set(key:string,value:unknown):void;readonly ready?:Promise<void>;flush?():Promise<void>;subscribe?(listener:()=>void):Subscription}
export type Subscription=()=>void;
/** A folder dragged from the OS over the window: `enter`/`leave` bracket the hover, `drop` carries the paths (2026-09-14). */
export type FileDropEvent={kind:'enter';paths:string[]}|{kind:'leave'}|{kind:'drop';paths:string[]};
export type ChangeSource='config'|'clone'|'marketplace'|'placed'|'stamp';
/** The last background fetch the app ran by itself: at launch and on window focus, at most once a minute.
 *  Structurally the adapter's own RefreshOutcome (backend/tauri/refresh.ts), restated here so the screens
 *  read the Settings DTO and never import the Tauri adapter. `detail` is the CLI's error text — Settings
 *  renders only its first line — and `notices` the lines the CLI printed alongside it. */
export interface AutoFetchOutcome { at: number; state: 'refreshed' | 'skipped' | 'failed'; detail?: string; notices?: string[] }

export type Settings = { lastAutomatic?: AutoFetchOutcome | null } & Pick<Design, 'PLACEMENTS'|'PLACEMENTS_N'|'PINNED_N'|'APPROVALS'|'APP_VERSION'|'AGENT_CLI'|'COMMUNITY'|'SETTINGS_NAV'|'SHORTCUTS'|'INBOX_KIND_TEXT'|'THEME_OPTIONS'|'CLI_VERSION'|'FOLLOWING'|'INVITE_TIP'|'JOIN_BLOCK_NOTE' > & {
HOOK:Design['HOOK']|null;QUARANTINE:Design['QUARANTINE']|null;CLI_LATEST:string|null;STORAGE:Omit<Design['STORAGE'],'cache_n'|'evals_n'>&{cache_n:number|null;evals_n:number|null};
// mock-only: the drawn specimen login (design INVITEE); the real adapter never sets it
INVITEE?:string;K:number|null;AGENT_CLI_AUTH:'signed-in'|'unknown';MACHINE:Machine;ME:Identity;TEAMS:TeamStatus[];TEAM_POLICY:{license:string|null;categories:string[]|null;categoriesNote:string;projects:string[]|null};SHARED_SPECIMEN:[string,string,string,string]|null;tools:{git:boolean;gh:boolean};syncNote:string|null};
export type Onboarding = Pick<Design, 'ONBOARD_STEPS'|'ONBOARD_BASICS'|'GLOBAL_SET'|'BOOT_STEPS'|'ONBOARD_LATER'|'ONBOARD_COMMUNITY'|'ONBOARD_FETCH_ERROR'|'WELCOME_LINES'|'BASICS_COPY'|'BASICS_HINT'|'THEME_OPTIONS'|'LIBRARY_OVERVIEW'|'INVITEE'|'TEAM_REPO'|'INVITE_TIP'|'JOIN_BLOCK_NOTE'> & {skill:SkillCard;summary:ReceiptSummary|null;arm:Receipt['arm'];used_by:string[];installs_n:number;shareCommand:string;rosterInitials:string[];team:Design['TEAMS'][number];me:Design['ME'];teamN:number;searchResults:{kind:'skill'|'person'|'project';name:string;meta:string;initials?:string}[];joinBlock:string;bootRows:[string,string,string][];failedBootRows:[string,string,string][]};

export interface SkillFileResult {kind:'move'|'copy'|'rename'|'delete'|'fix'|'category';path:string;destination:string|null;quarantined:string|null;installed:boolean;notices:string[]}
/** `skill enable|disable`: the per-machine switch. `settingsFile` is the Claude Code settings file whose `skillOverrides` now says so; `changed:false` means it already did. */
export interface SkillToggleResult {kind:'enable'|'disable';path:string;name:string;enabled:boolean;settingsFile:string;changed:boolean;notices:string[]}
