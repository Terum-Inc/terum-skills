import { canShareImage, shareImage } from '../image-sharing';
import { saveNativeImage } from './image-sharing';
import { registerEvalQueue } from '../eval-queue';
import { createEvalQueue } from './eval-queue';
import { evalPrefFlags } from './eval-flags';
import { cliEvalMany, evalManyArgv, mapEvalMany } from './eval-many';
import { z } from 'zod';
import { createAppUpdate } from './app-update';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { nativePrefs } from './prefs';
import { SETUP_STEP_KEYS, FEATURE_KEYS } from '../types';
import type { Features, SetupStep } from '../types';
import type { CliFrame } from './frames';
import { openPath, openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { writeText, writeImage } from '@tauri-apps/plugin-clipboard-manager';
import { Image } from '@tauri-apps/api/image';
import type { Backend } from '../Backend';
import type { Root, LibraryScope, IdentityWrite, Catalog, Roster, Person, Library, SkillCard, SkillDetail, UpdateAdvice, StatusResult, Settings, Capabilities, Surfaces, ReadOptions, ChangeSource, DeriveBriefArgs, DerivedBrief, EvalArgs, EvalManyArgs, EvalResult, InstallArgs, InstalledResult, InviteArgs, InviteResult, MachineUninstallResult, PublishArgs, PublishResult, UnpublishArgs, UnpublishResult, ReconcileResult, Result, Run, SearchArgs, SearchHit, SetupArgs, SetupResult, Subscription, SyncArgs, SyncResult, TeamArgs, TeamResult, UninstallArgs, UninstalledResult, ValidateArgs, ValidateResult } from '../types';
import { tauriBridge, type AppState, type Bridge } from './bridge';
import { cliRun } from './run';
import { createReadSession } from './session.js';
import { prepareRun } from './prepare-run';
import { cliEvalReport, mapEvalReport, cliReceipt } from './eval-report';
import { cliUsage, mapUsage } from './usage';
import { cliMisses, mapMisses } from './misses';
import { receiptSummary } from '../receipt-summary';
import { relativeTime } from '../../lib/relative-time';
import { personPlaceNote, plural } from '../../screens/marketplace/market-data';
import { SHORTCUTS } from '../../lib/shortcuts';
import { abbreviateHome, stripRemote } from '../paths';
import { macWindowControlsEnd } from '../window-controls';
import { scannedRoots } from './scanned-roots';
import { cliRefresh, createRefreshPolicy, createWorkflowGate } from './refresh';
// §3.2: the version vocabulary exists once. This leaf imports nothing at all, which is the only
// shape `cli-tree-imports.test.ts` admits across the tree boundary.
import { recordedVersionLabel, parseVersionFolder } from '../../../../src/lib/versions.js';
import { overviewCopy } from '../../lib/overview-copy';
import { evaluatedOverview, unpublishedOverview } from '../../lib/overview-counts';
import { bodyExcerpt } from '../../lib/body-excerpt';
import { isUnderRoot, samePath } from '../../lib/skill-path';

/**
 * The real adapter: every long verb is one `terum-skills --frames <verb>` process (run.ts). What the CLI has
 * no verb for yet is answered honestly with a failing Result saying so, so the screens render their
 * drawn error states instead of fixture data pretending to be real. Mappings between the CLI's result shapes
 * (src/commands/*.ts) and the seam's DTOs (../types) are here and nowhere else.
 */

// The CLI's result shapes, as of terum-skills 0.1.5 (src/commands/*.ts). Validated loosely: only the fields the seam reads.
const cliProfile = z.object({ handle: z.string(), changed: z.array(z.string()) });
const memberMetadata = { role: z.string().nullish().transform(value => value ?? null), projects: z.array(z.string()).nullish().transform(value => value ?? []), admin: z.boolean().nullish().transform(v => v ?? null) };
const cliLogin = z.object({ updated: z.array(z.object({ key: z.string(), value: z.string() })), notice: z.string().nullish() });
export const cliInstalled = z.array(z.object({ id: z.string(), team: z.string(), path: z.string().optional(), version: z.string().nullable().optional(), profiled: z.boolean().optional() }).passthrough());
export const cliAdopted = z.object({ id: z.string(), team: z.string(), path: z.string(), version: z.string(), profiled: z.boolean().optional(), adopted: z.literal(true) }).passthrough();
export const cliUninstalled = z.array(z.object({ id: z.string(), team: z.string(), removed: z.number() }).passthrough());
export const cliMachine = z.object({ teams: z.array(z.string()), removedPlacements: z.number(), hookRemoved: z.boolean(), wrapperRemoved: z.boolean(), configRemoved: z.boolean(), kept: z.array(z.string()), record: z.string(), advice: z.array(z.string()) }).passthrough();
// §5.3: publish mints an immutable version on main. There is no branch and no pull request any
// more, so `version` is the `v<N>` it minted — or null when the bytes were identical to one that
// already exists, which `identicalTo` then names.
export const cliPublish = z.object({ team: z.string(), id: z.string(), name: z.string(), project: z.string().nullable(), version: z.string().nullable(), created: z.boolean(), identicalTo: z.string().nullable(), attachedEvals: z.number(), evalAssets: z.number().default(0), profileAdded: z.boolean(), projectAdded: z.boolean(), refused: z.string().nullish() }).passthrough();
// The inverse of cliPublish. Every count is required: a zero is a real answer the app prints, and a
// CLI too old to report one should fail the parse rather than silently render "removed 0 versions".
export const cliUnpublish = z.object({ team: z.string(), id: z.string(), name: z.string(), versions: z.array(z.string()), evalAssets: z.number(), receipts: z.number(), projects: z.array(z.string()), profiles: z.number() }).passthrough();
const cliInvite = z.object({ team: z.string(), invited: z.array(z.string()), already: z.array(z.string()).default([]), failed: z.array(z.object({ login: z.string(), error: z.string() })).default([]) }).passthrough();
const cliTeam = z.object({ team: z.string() }).passthrough();
const cliTeamMove = z.object({ from: z.string(), to: z.string(), handle: z.string(), restored: z.array(z.string()), missing: z.array(z.string()), failed: z.array(z.object({ name: z.string(), error: z.string() })) }).passthrough();
const SETUP_STEP_STATES = ['done','skipped','printed','queued','batched'] as const;
type SetupStepState = typeof SETUP_STEP_STATES[number];
const isSetupStep = (key: string): key is SetupStep => (SETUP_STEP_KEYS as readonly string[]).includes(key);
const isSetupStepState = (state: string): state is SetupStepState => (SETUP_STEP_STATES as readonly string[]).includes(state);
/**
 * Steps are read permissively, like every `.passthrough()` result above it. The frame protocol evolves
 * additively (docs/frame-protocol.md: "Protocol stays 1 because every change is additive") and the app
 * runs whatever CLI the machine recorded, so a CLI newer than this app WILL report steps this app has
 * never heard of. A closed key set made that fatal: 0.17.0 added `editHook`, and every finished setup run
 * in the app died on "the desktop app could not read the result" with the CLI's work already on disk.
 * Unknown keys and unknown states are dropped — the board draws only the steps it knows — and the rest
 * of the result still lands.
 */
const cliSetupSteps = z.record(z.string(), z.string()).nullish().transform((value): Partial<Record<SetupStep, SetupStepState>> | null => {
  if (value === null || value === undefined) return null;
  const steps: Partial<Record<SetupStep, SetupStepState>> = {};
  for (const [key, state] of Object.entries(value)) if (isSetupStep(key) && isSetupStepState(state)) steps[key] = state;
  return steps;
});
export const cliSetup = z.object({ role: z.enum(['creator', 'joiner']), team: z.string(), steps: cliSetupSteps });
// §6.3: a local eval runs against a folder in the Library, which may belong to no team at all —
// hence the nullable `team` and `id`. `shareHint` is the caller's cue to offer publishing.
export const cliEval = z.object({ name:z.string(),runDir:z.string(),executionStatus:z.enum(['complete','partial','failed']),team:z.string().nullish().transform(v=>v??null),id:z.string().nullish().transform(v=>v??null),shareHint:z.literal(true).optional(),alreadyEvaluated:z.boolean().optional() }).passthrough();
export const cliDerivedBrief = z.object({ brief:z.string(),briefPath:z.string(),derivedBriefOnly:z.literal(true) }).passthrough();
const cliValidate = z.object({ name: z.string(), findings: z.number(), warnings: z.number(), repairable: z.number().optional().transform(value => value ?? 0), repairs: z.array(z.string()).optional().transform(value => value ?? []) });
export const cliSearch = z.array(z.object({ team: z.string().optional(), id: z.string(), name: z.string(), author: z.string(), category: z.string(), installs: z.number(), latest: z.string(), description: z.string(), grants: z.string().nullable(), grantsHash: z.string().nullable(), updated: z.string() }));

const cliScope = z.discriminatedUnion('kind', [z.object({ kind: z.literal('global') }), z.object({ kind: z.literal('project'), project: z.string() })]);
const cliCardComparison = z.object({ win: z.number(), loss: z.number(), tie: z.number(), net_lift: z.number(), sign_p: z.number() }).passthrough();
// S7?/card-lift: the newest receipt at this skill's current version, or null. A CLI that predates the
// limb omits it, and the card falls back to the honest '—' exactly as it did before.
export const cliCardReceipt = z.object({ version: z.string().nullish().transform(v => v ?? null), content_digest: z.string().nullish().transform(v => v ?? null), run_id: z.string(), verdict: z.enum(['PASS','NEUTRAL','FAIL']), execution_status: z.enum(['complete','partial','failed']), expected_rows: z.number(), scored_rows: z.number(), comparisons: z.record(z.string(), cliCardComparison), arm_scores: z.record(z.string(), z.number().nullable()), provenance: z.object({ model: z.string(), k: z.number(), cc_version: z.string(), timestamp: z.string(), runner_handle: z.string() }).passthrough() }).passthrough();
export const cliLsSkill = z.object({ id: z.string(), name: z.string(), author: z.string(), category: z.string(), characters: z.number().nullish().transform(value => value ?? null), installs: z.number(), latest: z.string(), latestVersion: z.string().nullable().optional(), evalVersion: z.number().nullable().optional(), latestEvalState: z.enum(['ok','none','invalid']).nullable().optional(), versionCount: z.number().nullish().transform(value => value ?? null), endorsement: z.string(), description: z.string(), grants: z.string().nullable(), grantsHash: z.string().nullable(), updated: z.string(), body: z.string().nullable(), frontmatter: z.string().nullish(), receipt: cliCardReceipt.nullish().transform(value => value ?? null), installedBy: z.array(z.object({ handle: z.string(), displayName: z.string(), scope: cliScope, since: z.string().nullish() })) });
/**
 * §8.4 — the whole roster in one read. This limb is what replaced the marketplace's per-member
 * fan-out: `catalog()` used to spawn `status` + `ls --local` + N × `ls member`, and is now three
 * processes regardless of team size. `.passthrough()` per convention.
 */
/** §8.4: a CLI too old to report the roster in one read. Named so the message is not buried in a branch. */
const STALE_CLI_ROSTER = 'This terum-skills version does not report the team roster in one read; update it with `npx -y terum-skills@latest update`.';
export const cliPerson = z.object({ handle: z.string(), display_name: z.string(), email: z.string(), authored: z.array(z.string()).nullish().transform(v => v ?? []), role: z.string().nullish().transform(v => v ?? null), projects: z.array(z.string()).nullish().transform(v => v ?? []), installed: z.array(z.object({ id: z.string(), version: z.string().nullish().transform(v => v ?? null), scope: cliScope, since: z.string() }).passthrough()), profile: z.array(z.object({ id: z.string(), name: z.string(), version: z.string(), added: z.string(), via: z.enum(['publish', 'install']) }).passthrough()).nullish().transform(v => v ?? []), local_skills: z.number().nullish().transform(v => v ?? null) }).passthrough();
export const cliProject = z.object({ name: z.string(), skills: z.array(z.string()), remotes: z.array(z.string()), description: z.string().optional() }).catchall(z.unknown());
// S7g: every `ls --local` row carries typed provenance and a read-only health; the prose `state` is never parsed.
const cliLocalHealth = z.enum(['up-to-date', 'update-available', 'local-changed', 'both', 'gone-from-repo', 'untracked', 'unknown']);
export const cliLocalRow = z.object({ body: z.string().nullish(), frontmatter: z.string().nullish(), name: z.string(), path: z.string(), state: z.string(), tracked: z.boolean(), placement: z.strictObject({ id: z.string(), team: z.string(), version: z.string().nullable() }).nullable(), health: cliLocalHealth, edited:z.boolean().optional(), localEval:cliReceipt.extend({mine:z.boolean().optional()}).nullable().optional(), localEvalStale:z.boolean().optional(), teamEval:cliReceipt.extend({team:z.string(),mine:z.boolean()}).nullable().optional(), matchedVersion:z.string().nullable().optional(), matchedName:z.string().nullable().optional(), matchedTeam:z.string().nullable().optional(), knownToTeam:z.boolean().optional(), category: z.string().nullish().transform(v=>v??null), description: z.string().nullish().transform(value => value ?? null), characters: z.number().nullish().transform(value => value ?? null), updated: z.string().nullish().transform(value => value ?? null), problem: z.string().optional(), skillId: z.string().nullable().optional(), placed: z.boolean().optional(), enabled: z.boolean().optional() }).strict();
export const cliLocalSection = z.object({ root:z.string(), scope:z.enum(['global','project']), repoRoot:z.string().optional(), remote:z.object({url:z.string(),slug:z.string().nullable()}).nullish(), registered:z.boolean().optional(), rootState:z.enum(['scanned','absent','unreadable']).optional(), label:z.string().optional(), parent:z.string().nullish(), counts:z.object({skillFolders:z.number(),connectable:z.number()}).optional(), rows:z.array(cliLocalRow), notOffered:z.array(z.object({body:z.string().nullish(),frontmatter:z.string().nullish(),skillId:z.string().nullable().optional(),name:z.string(),path:z.string(),reason:z.string(),detail:z.string().optional(),category:z.string().nullish().transform(v=>v??null),description:z.string().nullish().transform(value=>value??null),characters:z.number().nullish().transform(value=>value??null),enabled:z.boolean().optional()})).optional(), problems:z.array(z.object({path:z.string(),reason:z.string()})) });
export const cliSkillFile=z.object({kind:z.enum(['move','copy','rename','delete','fix','category']),path:z.string(),destination:z.string().nullable(),quarantined:z.string().nullable(),installed:z.boolean(),notices:z.array(z.string())});
export const cliSkillToggle=z.object({kind:z.enum(['enable','disable']),path:z.string(),name:z.string(),enabled:z.boolean(),settingsFile:z.string(),changed:z.boolean(),notices:z.array(z.string())});
const cliReconcileRow = z.object({path:z.string(),name:z.string(),team:z.string(),skillId:z.string().nullable()});
export const cliReconcile = z.object({
  identical:z.array(cliReconcileRow.extend({version:z.string()})),
  differing:z.array(cliReconcileRow.extend({teamVersion:z.string(),nextVersion:z.string(),sameId:z.boolean(),teamAuthor:z.string()})),
  renamed:z.array(cliReconcileRow.extend({version:z.string(),teamName:z.string()})),
  adopted:z.array(z.string()),published:z.array(z.string()),
});
export const cliProjectAdded = z.object({path:z.string(),label:z.string(),added:z.boolean(),parent:z.string().nullish(),reconcile:cliReconcile.optional()});
export const cliProjectCreated = z.object({team:z.string(),name:z.string(),remotes:z.array(z.string()),skills:z.number()});
export const cliProjectRemoved = z.object({path:z.string(),placementsRemaining:z.number(),subProjectsRemaining:z.number().optional()});
export const cliProjectRenamed = z.object({path:z.string(),label:z.string(),previous:z.string()});
export const cliLs = z.object({
  roster: z.array(z.object({ handle: z.string(), active: z.boolean(), ...memberMetadata })), skills: z.array(cliLsSkill), problems: z.array(z.object({ source: z.string(), message: z.string() })), projects: z.array(cliProject).optional(), member: z.object({ installed: z.array(z.object({ id: z.string(), scope: cliScope, since: z.string() })).optional(), handle: z.string(), ...memberMetadata }).optional(),
  local: z.array(cliLocalSection).optional(),
  // §8.4: emitted on the `kind:'all'` team read. Optional so a CLI that predates the limb parses.
  people: z.array(cliPerson).optional(),
});
export const cliStatusTeams = z.object({ version: z.string().nullable(), teams: z.array(z.object({ team: z.string(), handle: z.string(), repository: z.string().nullable(), readable: z.boolean(), sharedSkills: z.number().nullable(), memberCount: z.number().nullable(), members: z.array(z.object({ handle: z.string(), displayName: z.string() })).optional() })), ledger: z.object({ placements: z.array(z.object({ id: z.string(), team: z.string(), version: z.string().nullable().optional() }).passthrough()) }).nullish() });
type Inventory = z.infer<typeof cliLs>;
type InventorySkill = z.infer<typeof cliLsSkill>;
type InventoryTeam = z.infer<typeof cliStatusTeams>['teams'][number];
/** The unfiltered status ledger's placements: a fallback presence source that still sees project-scope placements `ls --local` cannot scan (no registered checkout). */
type LedgerPlacements = readonly { id: string; team: string; version?: string | null | undefined }[];

type LocalSection=z.infer<typeof cliLocalSection>;
type LocalRow=z.infer<typeof cliLocalRow>;
type NotOffered=NonNullable<LocalSection['notOffered']>[number];
function normalizePath(path:string):string{return path.replace(/[\\/]+$/,'');}
function basename(path:string):string{return normalizePath(path).split(/[\\/]/).at(-1)??'';}
function labelOf(section:LocalSection):string{return section.label??(section.scope==='global'?'Global':basename(section.repoRoot??section.root));}
/**
 * The card's context weight. There is no tokenizer in the CLI, so this is the same arithmetic the
 * CLI itself prints in HYG6 ("20,000 characters … ~5k tokens"): four characters to a token. The
 * tilde is load-bearing — the number is an estimate, and the card must not read as a measurement.
 */
function tokenLabel(characters:number|null):{size:string;tokensK:number}{
  if(characters===null)return {size:'—',tokensK:0};
  const tokens=Math.round(characters/4);
  return {size:tokens<1000?`~${tokens} tokens`:`~${(tokens/1000).toFixed(1)}k tokens`,tokensK:tokens/1000};
}
/** The registered root the CLI placed a skill into, named the way the app names that root everywhere else ('Global'
 *  or the checkout's label). `section.root` is the skills folder the CLI places under, so containment is exact;
 *  longest root first so a checkout nested inside another never resolves to the outer one. Null when no known
 *  root contains the path — the caller then falls back rather than inventing a destination. */
function scopeOfPath(sections:readonly LocalSection[],path:string|undefined):string|null{
  if(path===undefined)return null;
  const owner=[...sections].sort((a,b)=>b.root.length-a.root.length).find(section=>isUnderRoot(path,section.root));
  return owner===undefined?null:owner.scope==='global'?'Global':labelOf(owner);
}
function rootOf(section:LocalSection,home=''):Root {
  const global=section.scope==='global',repoRoot=section.repoRoot??section.root;
  return {id:global?'global':repoRoot,kind:global?'global':'checkout',label:labelOf(section),root:global?(home?abbreviateHome(section.root,home):'~/.claude/skills'):repoRoot,rootState:section.rootState,registered:section.registered??false,count:section.counts?String(section.counts!.skillFolders):undefined,remote:section.remote??null,parent:global?null:section.parent??null};
}
/** The root a detail was resolved in, in the sidebar's own terms. The checkout id comes from rootOf
 *  so it is byte-identical to the id Sidebar.tsx compares against; the global root uses the literal
 *  'Global' because Sidebar.tsx:31 matches that, not rootOf's lowercase 'global'. */
function owningRootOf(section:LocalSection):{id:string;label:string}{
  return section.scope==='global'?{id:'Global',label:'Global'}:{id:rootOf(section).id,label:labelOf(section)};
}
/** The one `ls --local` section a scoped read is anchored to. The comparison is separator- and
 *  trailing-separator-insensitive because the value arrives from a URL, and library() uses the same
 *  predicate, so any root that opens a checkout Library also opens a scoped detail. */
function sectionFor(local:Inventory,at:LibraryScope):LocalSection|undefined{
  return (local.local??[]).find(section=>at.kind==='global'?section.scope==='global':section.scope==='project'&&samePath(section.repoRoot??section.root,at.root));
}
/** Presence evidence narrowed to one root. Destinations are NOT narrowed — see inventoryDetail. */
function restrictLocal(local:Inventory,section:LocalSection):Inventory{return {...local,local:[section]};}
/** body-excerpt.ts's ratified rule, shared by BOTH card builders so a skill reads the same in the Library
 *  and the Marketplace (hybrid review r1, high — localCard skipped it): the body's first paragraph, else the
 *  frontmatter `description`, else blank. */
function cardSummary(body:string|null|undefined,description:string|null|undefined):string{return bodyExcerpt(body??null)??description??'';}
/** Cross-mirror overlays spec §3.3: the card shows ONE receipt for the folder's exact bytes — the newer of this
 *  machine's own run and the team's committed run (run ids are UTC timestamps, so lexical order is chronological).
 *  On an equal run_id the TEAM receipt wins (review walk D3): install seeds the own store with a copy of the
 *  committed receipt, so the same run exists twice and the twin must not shadow the team's flag. Attribution: a
 *  runner is named iff the shown receipt's `mine` is false — the CLI stamps `mine` on both receipts, so the card
 *  can never say "run by <your own handle>". An own-store receipt from a CLI that predates the flag keeps the D11
 *  reading: a seeded copy (version set) names its runner, an own run (version null) does not. */
function libraryEval(row:LocalRow):{eval:SkillCard['localEval'];receipt:NonNullable<LocalRow['localEval']>|NonNullable<LocalRow['teamEval']>|null} {
  const own=row.localEval??null,team=row.teamEval??null;
  const pick=own&&team?(team.run_id>=own.run_id?team:own):own??team;
  if(!pick)return {eval:null,receipt:null};
  const summary=receiptSummary(pick);
  const named=pick.mine===undefined?Boolean(pick.version):!pick.mine;
  const runnerHandle=named?pick.provenance.runner_handle:null;
  return {eval:summary?{...summary,runnerHandle,version:pick.version??null}:null,receipt:pick};
}
/** §3.1's precedence for the Library version slot's number: the BYTE MATCH, else the ledger's version (review
 *  walk D1; `inventoryCard` applies the same rule to the Marketplace card over every on-disk copy — flip both or neither). A folder installed as v2 whose bytes later became exactly v1 IS v1 — the ledger remembers what was
 *  copied, the digest says what is there now, and the card describes what is there now. */
function libraryVersion(row:LocalRow):string|null {
  return row.matchedVersion??row.placement?.version??null;
}
/** §4.3: identical when the bytes equal a published version; differs when they equal none but the team knows this skill or the ledger placed it; none when nothing ties the folder to a team; null when the CLI predates the key. */
function libraryMatch(row:LocalRow):SkillCard['localMatch'] {
  if(row.matchedVersion===undefined)return null;
  if(row.matchedVersion!==null)return 'identical';
  return row.placement!==null||row.knownToTeam===true?'differs':'none';
}
/** One sentence, shown on both surfaces: the card's chip reveals it on hover, the detail page draws it
 *  under the description, and the disabled Run eval / Publish rows repeat it as their reason. */
export const BUNDLED_NOTE='Bundled with terum-skills — placed by setup, not a team skill.';
function localCard(row:LocalRow&{fixable?:boolean},section:LocalSection,home:string):SkillCard {
  const placed=row.placed??row.placement!==null,local=!placed;
  const shown=libraryEval(row),receipt=shown.receipt,summary=receiptSummary(receipt);
  // A local card makes no claim about team installs; the team fields stay neutral except the two
  // byte-level overlays (spec §2 §7.4): the version its bytes are, and the receipt for those bytes.
  // The identity line names the root the folder lives in, never the word 'local'.
  return {edited:row.edited??row.health==='local-changed',localEval:shown.eval,localEvalStale:row.localEvalStale??false,localMatch:libraryMatch(row),knownToTeam:row.knownToTeam??false,installedVersion:libraryVersion(row),latestVersion:null,evalVersion:null,evalStale:false,latestEvalState:null,profileVersion:null,teamed:false,path:row.path,name:row.name,desc:row.problem!==undefined?row.path+' · '+row.problem:cardSummary(row.body,row.description),project:labelOf(section),category:row.category??'—',installs:'—',installsN:0,installed:'placed',placed,onDiskOnly:!placed,teamState:'unknown',paths:[[abbreviateHome(row.path,home),section.scope]],projectRoots:section.repoRoot?[abbreviateHome(section.repoRoot,home)]:[],flags:row.problem!==undefined?['broken']:local?['local']:[],...(row.fixable?{fixable:true}:{}),flagText:row.problem!==undefined?{broken:row.problem}:local?{local:'Local'}:{},grants:null,normalizedGrants:null,grantsHash:null,...tokenLabel(row.characters),wlt:summary?[summary.w,summary.l,summary.t]:null,summary,provenance:receipt?{model:receipt.provenance.model,k:receipt.provenance.k,ccVersion:receipt.provenance.cc_version,runner:receipt.provenance.runner_handle,when:receipt.provenance.timestamp.slice(0,10)}:null,favorite:false,favorites:null,enabled:row.enabled??true,updated:row.updated ?? null,indicators:{broken:{icon:'alert',token:'bad',text:'The skill version could not be resolved.'},update:{icon:'arrow-up-circle',token:'warn',text:''},local:{icon:'pencil',token:'text3',text:''},bundled:{icon:'box',token:'text3',text:BUNDLED_NOTE}}};}
/** The bundled /terum-skills manual is the one `notOffered` folder that names no fault: setup placed it
 *  and `connect` refuses it by its frontmatter marker, so it can never become a team skill. It keeps its
 *  card (§7.4 D16) and its own description, and carries the neutral `bundled` flag instead of `broken` —
 *  the same flag `localActionReason` reads, so Run eval and Publish stay disabled with a sentence that
 *  describes the folder rather than accusing it (Ryan, 2026-09-14). Every other reason is a fault and
 *  keeps the red flag, the path-and-reason body, and the attention count. */
function notOfferedCard(entry:NotOffered,section:LocalSection,home:string):SkillCard {
  const bundled=entry.reason==='managed-wrapper';
  const card=localCard({name:entry.name,path:entry.path,state:'',tracked:false,placement:null,health:'unknown',category:entry.category,description:entry.description,characters:entry.characters,updated:null,...(bundled?{}:{problem:entry.detail??entry.reason}),fixable:entry.reason==='invalid-yaml'||entry.reason==='name-mismatch',...(entry.enabled===undefined?{}:{enabled:entry.enabled})},section,home);
  return bundled?{...card,flags:['bundled'],flagText:{bundled:BUNDLED_NOTE}}:card;
}
function localDetail(card:SkillCard,section:LocalSection,path:string,home:string):SkillDetail {
  const pathLabel=abbreviateHome(path,home);
  return {...card,desc_long:card.desc,size_bytes:'—',team:null,skillRef:'local:'+path,root:'Global',owningRoot:owningRootOf(section),installScopes:[],projectNames:null,favorites:null,lines:null,hygieneCaption:null,hygieneStatus:null,hygieneWhen:null,path,pathLabel,repo:null,repoPath:pathLabel,version:'—',version_full:null,scope:section.scope==='global'?'Global':labelOf(section),installs_n:0,used_by:[],users:[],author:{name:'',handle:'',role:'',initials:''},files:null,grants_approved:'',receipt:null,history:[],activity:[],hygiene:[],skillMd:{frontmatter:(section.rows.find(row=>samePath(row.path,path))??section.notOffered?.find(row=>samePath(row.path,path)))?.frontmatter??'',body:[],markdown:(section.rows.find(row=>samePath(row.path,path))??section.notOffered?.find(row=>samePath(row.path,path)))?.body??null},evalEstimate:null,evalEstimateText:'',evalEstimateTip:'',evalCommand:'npx -y terum-skills@latest eval '+card.name,shareCommand:'npx -y terum-skills@latest publish '+card.name,incumbentLift:null,reportNumbers:null,scoreFractions:{routesExpected:null,roi:null},versions:null,latestState:'none',invalidReceiptFile:null,evalReportError:null,localRuns:[],unidentifiedLocal:null,viewerHandle:null};
}
/** A bare name that is not in the team may still name a folder on this machine — one nobody has
 *  shared, or one whose frontmatter the CLI could not parse. Deep links, bookmarks and hand-typed
 *  URLs all arrive as a bare name with no path, so the name route resolves them against the local
 *  roots before it reports the name as unknown. Global wins over a checkout because a bare name
 *  carries no root to disambiguate with. */
function localDetailByName(local:Inventory,name:string,home:string):SkillDetail|undefined {
  const sections=[...(local.local??[])].sort((a,b)=>Number(b.scope==='global')-Number(a.scope==='global'));
  for(const section of sections) {
    const row=section.rows.find(row=>row.name===name);
    if(row)return localDetail(localCard(row,section,home),section,row.path,home);
    const entry=section.notOffered?.find(entry=>entry.name===name);
    if(entry)return localDetail(notOfferedCard(entry,section,home),section,entry.path,home);
  }
  return undefined;
}

function localRows(local: Inventory) {
  return local.local?.flatMap(section => section.rows.map(row => ({ ...row, scope: section.scope, root: section.root, repoRoot: section.repoRoot, label: section.label }))) ?? [];
}
// Join provenance by team and ID, including relocated or conflicting tracked folders. Every clause
// is an id the CLI itself reported: a ledger placement, a connected source, or identity read from
// the folder. A ref carrying a team is matched with it; `skillId` is a uuid and needs none.
function onDisk(local: Inventory, team: string, id: string, features: Pick<Features, 'localIdentity'>) {
  return localRows(local).filter(row => (row.placement?.id === id && row.placement.team === team) || (features.localIdentity && row.skillId === id));
}
/**
 * `skillId` reaches `ls --local` rows only from CLI 0.1.8 (the `localIdentity` feature). An older
 * CLI reports an untracked folder with no id at all, so a same-named one is not evidence of
 * absence — presence is unknowable. Name spots that ambiguity and never infers presence: the
 * caller reports "unknown" and the skill still does not count as installed.
 */
function unidentifiedLocal(local: Inventory, name: string, features: Pick<Features, 'localIdentity'>, home: string) {
  if (features.localIdentity) return null;
  const row = localRows(local).find(row => row.name === name && row.placement === null);
  return row ? { path: row.path, pathLabel: abbreviateHome(row.path, home) } : null;
}
// Tri-state install truth from BOTH ledgers and the people file: identified on-disk provenance
// (`ls --local`), then — only for a skill the scan shows nothing for — the unfiltered status
// placements (which still see e.g. a project-scope placement in an unregistered checkout the scan
// never visits), then this user's people-file record. When the scan does cover the skill its richer
// verdict (placed / connected / on-disk-only, or the old-CLI unidentified ambiguity) wins over the
// ledger. 'recorded' = the people file says this user installed it, but nothing is on this machine.
/** Cross-mirror overlays spec §3.2: a folder whose BYTES equal one of this skill's published versions is a
 *  copy of it even with no ledger row and no uuid in its frontmatter (the digest ignores the managed fields). */
function byteMatched(local: Inventory, team: string, name: string) {
  return localRows(local).filter(row => row.matchedVersion != null && row.matchedTeam === team && row.matchedName === name);
}
function inventoryCard(row: InventorySkill, local: Inventory, team: string, features: Pick<Features, 'localIdentity'>, home: string, handle: string, ledger: LedgerPlacements): SkillCard {
  const identified = onDisk(local, team, row.id, features);
  const rows = [...identified, ...byteMatched(local, team, row.name).filter(candidate => !identified.some(known => known.path === candidate.path))];
  const placements = rows.filter(r => r.placement?.id === row.id && r.placement.team === team);
  const present = rows.length > 0;
  const ledgerPlaced = !present && ledger.some(placement => placement.id === row.id && placement.team === team);
  const placed = placements.length > 0 || ledgerPlaced;
  const installed: SkillCard['installed'] = present || ledgerPlaced ? 'placed' : handle !== '' && row.installedBy.some(person => person.handle === handle) ? 'recorded' : 'absent';
  // The card's lift: this receipt's own candidate-vs-baseline comparison, never combined across
  // receipts, with the provenance the number must be read against (frame-protocol.md). A skill with
  // no receipt at its current version keeps summary null, which the card draws as '—'.
  const summary = receiptSummary(row.receipt);
  const provenance = row.receipt ? { model: row.receipt.provenance.model, k: row.receipt.provenance.k, ccVersion: row.receipt.provenance.cc_version, runner: row.receipt.provenance.runner_handle, when: row.receipt.provenance.timestamp.slice(0, 10) } : null;
  // `unknown` is NOT a problem: since the CLI narrowed its health vocabulary (src/commands/ls.ts
  // `healthOf`), an unmodified placement whose fingerprint matches the ledger reports `unknown`, and
  // an edited one reports `local-changed`. Flagging `unknown` marked every clean install broken and
  // left the edited ones clean — exactly backwards. Only an explicit problem or a skill the team
  // dropped is a problem.
  const problem = placements.find(r => r.problem !== undefined || r.health === 'gone-from-repo');
  // Only ledger versions may annotate the catalogue. Multiple differing placements have no
  // single truthful version; keep the annotation null until a per-root display is specified.
  const recordedVersions = ledger.filter(p => p.id === row.id && p.team === team).map(p => p.version ?? null);
  const ledgerVersion = recordedVersions.length > 0 && recordedVersions.every(v => v === recordedVersions[0])
    && recordedVersions[0] != null && parseVersionFolder(recordedVersions[0]) !== null ? recordedVersions[0] : null;
  // §3.2 (review walk D1): the bytes first — the one version every on-disk copy's bytes are; else the ledger's
  // version. Two copies at different matched versions have no single truthful version, so the slot stays null and
  // the copy reads as present.
  const matchedVersions = [...new Set(rows.flatMap(r => r.matchedTeam === team && r.matchedVersion ? [r.matchedVersion] : []))];
  const installedVersion = matchedVersions.length === 0 ? ledgerVersion : matchedVersions.length === 1 ? matchedVersions[0]! : null;
  const scanned = rows.some(r => r.matchedVersion !== undefined);
  const localMatch: SkillCard['localMatch'] = !present || !scanned ? null : matchedVersions.length > 0 ? 'identical' : 'differs';
  const latestVersion = row.latestVersion ?? (parseVersionFolder(row.latest) === null ? null : row.latest);
  const latestN = latestVersion === null ? null : parseVersionFolder(latestVersion);
  return { edited:false, localEval:null, localEvalStale:false, localMatch, knownToTeam:true, installedVersion, latestVersion, evalVersion:row.evalVersion ?? null, evalStale:row.evalVersion != null && latestN !== null && row.evalVersion !== latestN, latestEvalState:row.latestEvalState ?? null, profileVersion:null, teamed:true, path:rows[0]?.path ?? null, name: row.name, category: row.category, project: row.endorsement === 'global' ? 'Global' : row.endorsement.replace(/^project: /, ''), installs: `${row.installs} install${row.installs === 1 ? '' : 's'}`, installsN: row.installs, installed, placed, onDiskOnly: present && !placed, teamState: 'endorsed', paths: rows.map(r => [abbreviateHome(r.path, home), r.scope]), projectRoots: rows.flatMap(r => r.repoRoot ? [abbreviateHome(r.repoRoot, home)] : []), desc: cardSummary(row.body, row.description), grants: row.grants === null ? null : row.grants === 'none' ? [] : row.grants.split('\n'), normalizedGrants: row.grants ?? null, grantsHash: row.grantsHash ?? null, ...tokenLabel(row.characters), wlt: summary ? [summary.w, summary.l, summary.t] : null, summary, provenance, favorite: false, favorites: null, enabled:rows.every(r=>r.enabled??true), flags: problem ? ['broken'] : [], flagText: problem ? { broken: problem.problem ?? 'placed copy could not be inspected' } : {}, updated: row.updated === '—' ? null : row.updated ?? null, indicators: { broken: { icon: 'alert', token: 'bad', text: 'The placed copy could not be inspected.' }, update: { icon: 'arrow-up-circle', token: 'warn', text: '' }, local: { icon: 'pencil', token: 'text3', text: '' }, bundled: { icon: 'box', token: 'text3', text: BUNDLED_NOTE } } };}
function initials(name: string): string { return name.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase(); }
/** `owner/repo` as the team remote spells it (case kept; any host); null when the team has no remote. */
function repoSlug(remote: string | null | undefined): string | null {
  return remote ? stripRemote(remote.trim()).replace(/^github\.com\//, '') : null;
}
/**
 * §8.6: the share command drops its `@<version>` suffix, because §9.1 REFUSES a versioned ref — the
 * command it produced would now fail on the machine it was pasted into. The version itself is still
 * shown; it is a label (`Version 3`) under D1, so it is never sliced to look like a hash.
 */
/** §3.2: `placements[].version` is a version FOLDER (`v1`) since the forced M6 slice — the 12-char
 *  slice below it was the layout-2 tree hash. Anything that does not parse keeps the old rendering,
 *  so a config written by an older CLI still shows something. */
function placementVersionLabel(version: string | null | undefined): string | null {
  if (version === null || version === undefined) return null;
  return recordedVersionLabel(version);
}
function detailVersionFields(repo: string | null, name: string, version: string | null): Pick<SkillDetail, 'version' | 'version_full' | 'shareCommand'> {
  // D1: what a PERSON reads is `Version 3`. `version_full` keeps the FOLDER, because §8.6 makes it a
  // path segment in the repository link — one is prose, the other is an address.
  return { version: version === null ? '—' : recordedVersionLabel(version), version_full: version, shareCommand: repo ? `npx -y terum-skills@latest install ${repo}/${name}` : '—' };
}
/** `local` is the presence evidence — restricted to one section for a scoped read. `scopes` is the
 *  full machine inventory the install destinations come from, so restricting presence never
 *  truncates the Install-to list. `at` names the root a scoped read was anchored to: non-null means
 *  the answer describes exactly that root, so the two root-blind fallbacks (the unfiltered status
 *  ledger and this user's people file) are not consulted — neither records WHICH root. */
/** Resolve tracked people by full author email (or the authored-ID join without email), never an email prefix. */
function inventoryAuthor(row:InventorySkill,inventory:Inventory,team:InventoryTeam):SkillDetail['author'] {
  const name=row.author.replace(/\s*<[^>]*>$/, '').trim();
  const email=row.author.match(/<([^<>]+)>$/)?.[1]?.trim().toLowerCase();
  const people=inventory.people?.filter(person=>email?person.email.trim().toLowerCase()===email:person.authored.includes(row.id)&&person.display_name===name)??[];
  const authored=inventory.people?.filter(person=>person.authored.includes(row.id)&&person.display_name===name)??[];
  const member=people.length===1?people[0]:people.length===0&&authored.length===1?authored[0]:undefined;
  const legacy=team.members?.filter(person=>person.displayName===name)??[];
  const handle=member?.handle??(inventory.people===undefined&&legacy.length===1?legacy[0]!.handle:'');
  return {name,handle,role:member?.role??'',initials:initials(name)};
}
function inventoryDetail(row: InventorySkill, local: Inventory, team: InventoryTeam, placements: LedgerPlacements, validation: Result<ValidateResult>, inventory: Inventory, features: Pick<Features, 'localIdentity'>, home: string, scopes: Inventory = local, at: {id:string;label:string} | null = null): SkillDetail {
  const card = inventoryCard(row, local, team.team, features, home, at ? '' : team.handle, at ? [] : placements), rows = onDisk(local, team.team, row.id, features);
  // Global first by rule, not by the CLI's emission order: a read that names no root answers with
  // the Global copy (the documented bare-name rule at :124-128), and a scoped read has one section.
  const ordered = [...rows].sort((a, b) => Number(b.scope === 'global') - Number(a.scope === 'global'));
  const placed = ordered.find(r => r.placement?.id === row.id && r.placement.team === team.team);
  const path = placed?.path ?? ordered[0]?.path ?? null;
  const installers = row.installedBy;
  const repo = repoSlug(team.repository);
  const version = placed?.placement?.version ?? (row.latest === '—' ? null : row.latest || null);
  const projects = (scopes.local ?? []).filter(section => section.scope === 'project' && section.rootState !== 'absent' && section.label);
  const installScopes: [string, string][] = [['Global', 'every session · ~/.claude/skills'], ...projects.map((section): [string, string] => [section.label!, `project · ${abbreviateHome(section.repoRoot ?? section.root, home)}`])];
  // Captions stay display-only; removal needs the original absolute destination.
  const installScopePaths = Object.fromEntries(projects.flatMap(section => section.repoRoot && projects.filter(other => other.label === section.label).length === 1 ? [[section.label!, section.repoRoot]] : []));
  return { ...card, team: team.team, installScopes, installScopePaths, projectNames: inventory.projects?.map(project => project.name) ?? null, favorites: null, lines: typeof row.body === 'string' ? row.body.replace(/\n$/, '').split('\n').length : null, skillRef: `${team.team}/${row.name}`, root: 'Global', owningRoot: at, desc_long: cardSummary(row.body, row.description), files: null, size_bytes: '—', ...detailVersionFields(repo, row.name, version), scope: placed?.scope === 'global' ? 'Global' : placed?.label ?? placed?.scope ?? null, installs_n: row.installs, installed: card.installed,
    unidentifiedLocal: card.installed === 'placed' ? null : unidentifiedLocal(local, row.name, features, home), viewerHandle: team.handle,
    used_by: [...new Map(installers.map(person => [person.handle, initials(person.displayName)])).values()], users: installers.map(person => [person.handle, initials(person.displayName), `${person.scope.kind === 'global' ? 'Global' : person.scope.project}${person.since ? ` · since ${person.since.slice(0, 10)}` : ''}`]),
    author: inventoryAuthor(row,inventory,team), repo, repoPath: `skills/${row.name}`, path, pathLabel: path === null ? '—' : abbreviateHome(path, home), grants_approved: '', versions:null,latestState:'none',invalidReceiptFile:null,localRuns:[],evalReportError:null, receipt: null, history: [], activity: [], hygiene: [], hygieneCaption: null, hygieneStatus: validation.value === undefined ? null : validation.ok && validation.value.findings === 0 ? 'pass' : 'fail', hygieneWhen: null,
    skillMd: { frontmatter: row.frontmatter ?? '', body: [], markdown: row.body ?? null }, evalEstimate: null, evalEstimateText: '', evalEstimateTip: '', evalCommand: `npx -y terum-skills@latest eval ${row.name}`, incumbentLift: null, reportNumbers: null, scoreFractions: { routesExpected: null, roi: null },
  };
}

const cliUpdate = z.strictObject({ running: z.string().nullable(), latest: z.string().nullable(), observation: z.enum(['newer', 'same', 'older', 'unknown']), launch: z.enum(['global', 'local', 'npx', 'source', 'unknown']), description: z.string(), advice: z.array(z.string()), lines: z.array(z.string()) });

// S7k: explicitly declare every status field; an older payload must not look like unset data.
export const cliStatus = z.object({
 version:z.string().nullable(),
 teams:z.array(z.object({
  team:z.string(),handle:z.string(),repository:z.string().nullable(),
  clone:z.discriminatedUnion('state',[
   z.object({state:z.literal('ok'),origin:z.string().optional()}),z.object({state:z.literal('absent')}),
   z.object({state:z.literal('foreign'),origin:z.string()}),
   z.object({state:z.literal('incomplete'),reason:z.string(),error:z.string().optional()}),
  ]),readable:z.boolean(),
  // `joined` (the day the people file first landed in the team repo) and `skillsTotal` (how many skills
  // that member's machine last reported having) are nullish-tolerant: a CLI older than this app reports
  // neither, and a member who has not synced since the field shipped has no total, so the roster shows
  // '—' rather than a zero nobody reported.
  members:z.array(z.object({handle:z.string(),displayName:z.string(),joined:z.string().nullish().transform(v=>v??null),skillsTotal:z.number().nullish().transform(v=>v??null),...memberMetadata})),memberCount:z.number().nullable(),unreadableMembers:z.number().nullable(),sharedSkills:z.number().nullable(),unreadableSkills:z.number().nullable(),membership:z.enum(['active','inactive','missing']).nullable(),stale:z.boolean(),
  pending:z.array(z.object({op:z.enum(['install','uninstall']),id:z.string(),scope:cliScope,version:z.string().nullable(),started:z.string()})),
  // §4.1/§11.5 deleted `policy.publish`. The mirror is NOT passthrough, so leaving it required would
  // fail the whole status parse and cost the app its Settings screen, not one row.
  syncedAt:z.string().nullable(),policy:z.object({skill_license:z.string()}).passthrough().nullable(),categories:z.array(z.string()).nullable(),clonePath:z.string().nullable(),joinCommand:z.string().nullable(),joinBlock:z.array(z.string()).nullable(),
 })),
 ledger:z.object({
  placements:z.array(z.object({path:z.string(),id:z.string(),team:z.string(),version:z.string().nullable(),scope:cliScope,placed_at:z.string()})),
  approvals:z.array(z.object({id:z.string(),grants:z.string(),approved_at:z.string()})),
 }),
 identity:z.object({default_handle:z.string().nullable(),email:z.string().nullable(),display_name:z.string().nullable(),github:z.string().nullable()}).nullable(),
 tools:z.object({git:z.boolean(),gh:z.boolean()}),
});
const cliLocal=z.object({local:z.array(cliLocalSection),skills:z.array(z.object({id:z.string(),name:z.string(),grantsHash:z.string().nullish().transform(v=>v??null),grants:z.string().nullish().transform(v=>v??null)}))});
type CliStatus=z.infer<typeof cliStatus>;
type CliLocal=z.infer<typeof cliLocal>;

function statusModel(value:CliStatus, local:CliLocal|null, platform:string, features:Pick<Features, 'localIdentity'>,home:string):StatusResult {
 const name=value.identity?.display_name??'';
 const handle=value.teams[0]?.handle??''; // one team per machine — legacy 2+ shows a hint, not a projection
 return {
  ledger:value.ledger??null,
  machine:{os:platform,name:'',hostname:'',gh_login:'',gh_version:''},
  me:{handle,name,email:value.identity?.email??'',default_handle:value.identity?.default_handle??'',initials:name.split(/\s+/).filter(Boolean).map(part=>part[0]).slice(0,2).join('').toUpperCase(),footerLabel:[value.identity?.github,handle,value.identity?.default_handle].find(v=>v)??''},
  teams:value.teams.map(team=>({name:team.team,key:team.team,handle:team.handle,remote:team.repository??null,members:team.memberCount??null,skills:team.sharedSkills??null,clone:team.clonePath===null?null:abbreviateHome(team.clonePath,home),cloneState:team.clone.state==='ok'?team.clone.origin===undefined?null:{state:'ok',origin:team.clone.origin}:team.clone.state==='incomplete'?{state:'incomplete',...(team.clone.error===undefined?{}:{error:team.clone.error}),reason:team.clone.reason==='not-a-repository'||team.clone.reason==='no-team-json'?team.clone.reason:'unverifiable'}:team.clone,readable:team.readable,last_sync:team.syncedAt??null,stamp:team.syncedAt??null,policy:team.policy===null?null:{license:team.policy.skill_license},categories:team.categories??null,pending:team.pending,joinCommand:team.joinCommand??null,joinBlock:team.joinBlock??null})),
  counts:local?.local.find(section=>section.scope==='global')?.counts ? {Global:String(local.local.find(section=>section.scope==='global')!.counts!.skillFolders)} : {},tools:value.tools,roots:local===null?[]:local.local.map(section=>rootOf(section)),
 };
}
// AD-23: the drawn placement states (design fixture PLACEMENTS: 'up to date', 'update available', 'edited locally', 'pinned'); a health the board has no word for is '—'.
const PLACEMENT_STATE:Record<z.infer<typeof cliLocalHealth>,string>={'up-to-date':'up to date','update-available':'update available','local-changed':'edited locally',both:'edited locally · update available','gone-from-repo':'removed from the team',unknown:'—',untracked:'—'};
function settingsModel(value:CliStatus, local:CliLocal|null, status:StatusResult,home:string):Settings {
 const rows=local?.local.flatMap(root=>root.rows)??[];
 const policy=status.teams.length===1?status.teams[0]?.policy??null:null; // one team per machine — legacy 2+ shows a hint, not a projection
 return {
  K:null,MACHINE:status.machine,ME:status.me,TEAMS:status.teams,tools:status.tools,
  INVITE_TIP:"GitHub emails the invitation; the block runs the joiner&#39;s wizard",
  JOIN_BLOCK_NOTE:"GitHub emails the invitation. The block runs the joiner&#39;s wizard: with gh signed in it accepts the pending invitation, otherwise it asks them to accept it in the browser, and git must have access to this repository.",
  TEAM_POLICY:{license:policy?.license??null,categories:status.teams.length===1?status.teams[0]?.categories??null:null,projects:null,categoriesNote:'From team.json; an admin extends it by pull request.'}, // one team per machine — legacy 2+ shows a hint, not a projection
  PLACEMENTS:value.ledger.placements.map(p=>{const row=rows.find(row=>row.path===p.path);const missing=local?.local.some(root=>root.problems.some(problem=>problem.path===p.path))??false;return [abbreviateHome(p.path,home),row?.name??p.id,p.scope.kind==='global'?'Global':p.scope.project,row?.tracked===true?null:placementVersionLabel(p.version),p.placed_at??null,row?PLACEMENT_STATE[row.health]:missing?'folder missing':'—'];}),PLACEMENTS_N:value.ledger.placements.length,
  APPROVALS:value.ledger.approvals.flatMap(approval=>{const skill=local?.skills.find(skill=>skill.id===approval.id&&skill.grantsHash!==null&&skill.grantsHash===approval.grants&&skill.grants!==null);return skill?[[skill.name,skill.grants==='none'?[]:skill.grants!.split('\n'),approval.approved_at]]:[];}),
  QUARANTINE:null,HOOK:null,
  APP_VERSION:import.meta.env.VITE_APP_VERSION,AGENT_CLI:'—',AGENT_CLI_AUTH:'unknown',COMMUNITY:'github.com/ryanliu-terum/terum-skills/issues',
  STORAGE:{cache:'—',cache_n:null,evals:'—',evals_n:null,quarantine:'—'},PINNED_N:value.ledger.placements.filter(p=>{const row=rows.find(row=>row.path===p.path);return row?row.tracked===false:p.version!==null;}).length,
  CLI_VERSION:value.version??'—',CLI_LATEST:null,FOLLOWING:[],SHARED_SPECIMEN:null,
  SETTINGS_NAV:[],SHORTCUTS:SHORTCUTS.map(pair=>[...pair]),INBOX_KIND_TEXT:{share:'Shared with you',alert:'Alert',eval:'Eval finished',author:'Your skill',team:'Team'},THEME_OPTIONS:['System','Light','Dark'],
  syncNote:'The recorded timestamp is shown without clock-skew correction. No fetch recorded on this machine does not mean never synced: leaving a team removes its stamp. Work left undone beside an old timestamp means run sync, not an error.',
 };
}

function newestUpdated(skills: InventorySkill[]): InventorySkill | undefined {
  return skills.filter(skill => /^\d{4}-\d{2}-\d{2}T/.test(skill.updated) && Number.isFinite(Date.parse(skill.updated))).sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated))[0];
}
// `status` is the permission chip: host truth from the CLI's per-member `admin` (gh collaborator permission); 'unknown' when gh could not answer — never a defaulted 'member'.
// `invited` is null, not []: this CLI reports no invitations, and the screen must not assert "0 invitations".
// `joined` and `skillsTotal` are the CLI's own values (the people file's first commit, and the skill total that person's machine last reported); null when it reported neither, which the screen draws as '—'.
function rosterModel(team: CliStatus['teams'][number], inventory: Inventory): Result<Roster> {
  // §8.4: `team.members` — status's roster, already without `team.archived` — IS the membership; the
  // `people[]` limb enriches it. A member `status` names that `ls` does not carry fails closed rather than
  // vanishing from the screen, and a people file `team remove` left behind never re-enters as a
  // teammate. A CLI too old to send `people[]` at all still draws the roster from `status` alone.
  const people = inventory.people === undefined ? undefined : new Map(inventory.people.map(person => [person.handle, person]));
  const enriched = team.members.map(member => {
    if (people === undefined) return member;
    const person = people.get(member.handle);
    if (person === undefined) return null;
    return { ...member, displayName: person.display_name, role: person.role, projects: person.projects, skillsTotal: person.local_skills, joined: member.joined ?? null };
  });
  const missing = team.members.find((_, index) => enriched[index] === null);
  if (missing) return { ok: false, error: `No member data for ${missing.handle}.` };
  const source = enriched.filter((row): row is Exclude<typeof row, null> => row !== null);
  const members = source.map(member => ({ handle: member.handle, name: member.displayName, initials: initials(member.displayName), role: member.role ?? null, projects: member.projects ?? [], followers: null, joined: member.joined, skillsTotal: member.skillsTotal, last_publish: '—', lastPublish: '—', lastSeen: '—', status: member.admin === true ? 'admin' : member.admin === false ? 'member' : 'unknown' }));
  return { ok: true, value: { members, invited: null, member: Object.fromEntries(members.map(member => [member.handle, { status: member.status, projects: member.projects, lastSeen: member.lastSeen }])), byAdoption: [] } };
}
function catalogModel(team: CliStatus['teams'][number], inventory: Inventory, local: Inventory, placements: LedgerPlacements, people: Person[], features: Pick<Features, 'localIdentity'>, home: string, query?: string): Catalog {
  const skills = inventory.skills.map(row => inventoryCard(row, local, team.team, features, home, team.handle, placements));
  const categorySkills: Record<string, string[]> = {};
  for (const skill of skills) (categorySkills[skill.category] ??= []).push(skill.name);
  const projects = (inventory.projects ?? []).map(project => {
    const rows = inventory.skills.filter(skill => project.skills.includes(skill.id));
    const members = people.filter(person => person.projects.includes(project.name));
    const updated = newestUpdated(rows);
    const placement = project.skills.length > 0 ? local.local?.find(section => section.scope === 'project' && section.repoRoot && project.skills.every(id => section.rows.some(row => row.placement?.id === id && row.placement.team === team.team))) : undefined;
    return { name: project.name, key: project.name, ico: 'folder', desc: project.description ?? '', skills: project.skills.length, members: members.length, remote: project.remotes[0] ?? '—', remoteSlugs: project.remotes.map(repoSlug).filter((slug): slug is string => slug !== null), installed: project.skills.length > 0 && rows.length === project.skills.length && rows.every(row => onDisk(local, team.team, row.id, features).some(r => r.scope === 'project' && r.placement?.id === row.id && r.placement.team === team.team)), favorites: null, updated: updated ? relativeTime(updated.updated) : null, path: placement?.repoRoot ?? null, admin: null, evaluated: null, memberHandles: members.map(member => member.handle), memberInitials: members.map(member => member.initials), skillsIn: rows.map(row => row.name) };
  });
  const verdictCounts = { PASS: 0, NEUTRAL: 0, FAIL: 0, 'Not evaluated': 0 };
  for (const skill of skills) verdictCounts[skill.summary?.verdict ?? 'Not evaluated']++;
  return { scanned: scannedRoots(local, home), repository: repoSlug(team.repository), skills: skills.filter(skill => !query || `${skill.name} ${skill.desc}`.toLowerCase().includes(query.toLowerCase())), extras: [], people, projects, categories: Object.entries(categorySkills).map(([name, rows]) => [name, 'tag', rows.length]), categoryRemaining: {}, topRated: [...skills].sort((a, b) => b.installsN - a.installsN).map(skill => skill.name), peopleByAdoption: [...people].sort((a, b) => b.adoption - a.adoption).map(person => person.handle), projectsByMembers: [...projects].sort((a, b) => b.members - a.members).map(project => project.name), categorySkills, filterDefault: { verdicts: [], lift_min: 0, tokens_max: 0, installs_min: 0 }, filterCount: skills.length, verdictCounts, catalogN: skills.length, teamN: people.length, bulkInstall: Object.fromEntries(projects.map(project => [project.key, { total: project.skills, asking: skills.filter(skill => project.skillsIn.includes(skill.name) && skill.normalizedGrants !== null && skill.normalizedGrants !== 'none').length }])) };
}

/**
 * How long a read verb's answer is shared across callers (BUGS.md L18/M24). One Library render used to spawn six CLI
 * processes (three `status`, two `ls --local`, one `ls --team`); every read now goes through one process per argv per
 * window. Mutations clear it outright; focus marks it stale, serving the previously true board while refreshing
 * in the background. The TTL backs up terminal changes while focused and exceeds the QueryClient's 30 s staleTime,
 * so a tab switch does not turn into a cold chain (W-02).
 */
export const READ_CACHE_TTL_MS = 60_000;
/** The Settings error board branches on this: a config.json the CLI refused to parse is repairable in place; anything else is a read failure. */
function readReason(error: string): 'invalid-config' | 'unreadable' {
  return error.includes('Invalid') && error.includes('config.json') ? 'invalid-config' : 'unreadable';
}
/** One app window, one adapter. A second instance (tests construct many) retires the first instance's window
 *  listeners, so a retired backend can never spawn a CLI child on a later focus event. */
let retireWindowListeners: (() => void) | undefined;


export function createTauriBackend(bridge: Bridge = tauriBridge()): Backend {
  // Share in-flight reads and cache success; a terminal launch can repair a missing or broken file.
  let hello: Extract<CliFrame, { t: 'hello' }> | null = null;
  let featuresOnce: Promise<void> | undefined;
  // The first hello tells the adapter whether this CLI can refresh clones. Scheduled as a microtask
  // so it never re-enters run()/cwd() from inside the frame loop.
  const onHello = (frame: Extract<CliFrame, { t: 'hello' }>) => { readSession.observe(frame); const first = hello === null; hello = frame; if (first && frame.features.refresh === true) void Promise.resolve().then(() => { if (!retired) refreshPolicy.trigger(); }); };
  let stateOnce: Promise<AppState | null> | undefined;
  let inFlight: Promise<AppState | null> | undefined;
  let generation = 0;
  let launchListenerReady: Promise<unknown> = Promise.resolve();
  const state = (): Promise<AppState | null> => {
    if (stateOnce) return stateOnce;
    if (inFlight) return stateOnce = inFlight;
    const request = (async () => {
      for (;;) {
        const readingGeneration = generation;
        try {
          const value = await bridge.readAppState();
          if (readingGeneration !== generation) continue;
          if (value) readSession.bind(value);
          return value;
        } catch (error) {
          if (readingGeneration !== generation) continue;
          throw error;
        }
      }
    })();
    inFlight = stateOnce = request;
    void request.then(value => {
      if (inFlight === request) inFlight = undefined;
      if (value === null && stateOnce === request) stateOnce = undefined;
    }, () => {
      if (inFlight === request) inFlight = undefined;
      if (stateOnce === request) stateOnce = undefined;
    });
    return request;
  };
  let homeOnce: Promise<string> | undefined;
  const home = () => (homeOnce ??= bridge.homeDirectory().catch(() => ''));
  // App-config-dir storage, with one-time migration from the old webview keys. Hoisted so eval reads the stored defaults.
  const prefs = nativePrefs();
  async function localPath(path:string):Promise<string> {
    if(path!=='~'&&!path.startsWith('~/'))return path;
    const directory=await home();
    if(!directory)throw new Error('Could not determine the home directory.');
    return directory+path.slice(1);
  }
  async function result<T>(value: Result<T>): Promise<Result<T>> {
    return value.ok ? value : { ...value, error: abbreviateHome(value.error, await home()) };
  }
  const fail = (error: string) => result<never>({ ok: false, error });
  const gap = (what: string) => fail(`${what} is not available from terum-skills yet: the CLI has no verb that returns it. The terminal has everything the app shows here.`);
  const listeners = new Set<(source: ChangeSource) => void>();
  const reads = new Map<string, { promise: Promise<{ result: Result<unknown>; lines: string[] }>; at: number; stale: boolean; refreshing: boolean }>();
  // Every mutation evicts every cached read, and that is deliberate. A targeted map would have to know which
  // reads depend on which write, but a ChangeSource ('config' | 'clone' | 'marketplace' | 'placed' | 'stamp') labels what a verb
  // WROTE, not what a read consumed: `status` reads config and the clone roster, `ls` reads placements and the
  // clone, and nothing in the cache records that. Keeping a read alive because its family was not named would
  // serve a stale board the moment those sets overlap, so the cache clears whole until reads declare their own
  // dependencies. Cost is bounded: a read re-spawns lazily, and the shell caps concurrent children at eight.
  const clearReads = () => { reads.clear(); };
  /** Paint a previously true board immediately and replace it if the refresh differs. */
  const markStale = () => { for (const entry of reads.values()) entry.stale = true; };
  const broadcast = (...sources: ChangeSource[]) => { for (const source of sources) for (const listener of listeners) listener(source); };
  const notify = (...sources: ChangeSource[]) => { if (sources.length === 0) return; clearReads(); broadcast(...sources); };
  // W-08: reads never fetch (src/cli.ts eval-report, docs/frame-protocol.md), so a teammate's committed receipt
  // reaches this machine only when something runs the fetch-only `sync` (§10; the separate `refresh` verb is gone).
  // Reads are invalidated only after the reads already in flight have settled: a notify re-spawns up to seven
  // query prefixes and the shell caps concurrent CLI children at eight (src-tauri/src/lib.rs).
  //
  // Every completed attempt ends in notify('stamp') — the same source the manual Sync now publishes alongside
  // 'marketplace'. A successful fetch wrote run/<team>.stamp, so Settings ▸ Sync's "Last fetched", the Status
  // board and the Inbox are stale; a failed one has a new `lastAutomatic` for Settings ▸ Sync to render, and
  // waiting for the next fetch to show it would be a minute of silence. 'marketplace' is added only when a clone
  // actually moved, because nothing in the catalog can have changed otherwise.
  const settleReads = () => Promise.allSettled([...reads.values()].map(entry => entry.promise));
  const publish = (...sources: ChangeSource[]) => async () => { await settleReads(); notify(...sources); };
  const refreshPolicy = createRefreshPolicy({
    supported: () => hello?.features.refresh === true,
    // `workflowGate` is declared just below and needs this policy in its own idle callback, so exactly one of the
    // two references has to be late-bound. Reading it through a closure is safe: the earliest trigger is the
    // microtask scheduled by the first hello, long after this function body has run.
    busy: () => workflowGate.busy(),
    run: () => read(run(['sync'], cliRefresh, value => value, [])),
    onChanged: publish('marketplace'),
    onRefreshed: publish('stamp'),
    onFailed: publish('stamp'),
  });
  const workflowGate = createWorkflowGate(() => { if (!retired) refreshPolicy.trigger(); });
  // The launch file's write time this adapter last acted on; undefined until the first read.
  let actedLaunchAt: string | null | undefined;
  const onWindowFocus = () => { markStale(); refreshPolicy.trigger(); };
  retireWindowListeners?.();
  let retired = false; let unlistenNativeFocus: (() => void) | undefined;
  if (typeof window !== 'undefined') window.addEventListener('focus', onWindowFocus);
  // The shell's own focus event is authoritative: a WebView may not deliver a DOM `focus` to the page when the
  // app is re-activated. Outside the Tauri shell (browser dev, vitest) getCurrentWindow() throws or its IPC
  // rejects, and the DOM listener above is then the only trigger — which is correct there.
  try { void getCurrentWindow().onFocusChanged(({ payload }) => { if (payload && !retired) onWindowFocus(); }).then(stop => { if (retired) stop(); else unlistenNativeFocus = stop; }, () => undefined); }
  catch { /* Not inside the Tauri shell: there is no window event to subscribe to, and nothing to clean up. */ }
  retireWindowListeners = () => { retired = true; if (typeof window !== 'undefined') window.removeEventListener('focus', onWindowFocus); unlistenNativeFocus?.(); };
  const cwd = () => backend.prefs.get<string>('workspace', '') || undefined;

  function run<TIn, TOut>(argv: readonly (string | Promise<string>)[], schema: z.ZodType<TIn>, map: (value: TIn) => TOut, touches: ChangeSource[] = ['config', 'placed']): Run<TOut> {
    const finishWorkflow = workflowGate.start(argv);
    let job: Run<TOut>;
    try {
      job = cliRun<unknown, TOut>(bridge, state(), argv, { cwd: cwd(), onHello, map: (value) => map(schema.parse(value)), onSettled: (result) => { if (argv[0] === 'setup' || argv[0] === 'team' || argv[0] === 'uninstall') notify('config', 'clone', 'placed'); else if (result.ok || result.value !== undefined) notify(...touches); } });
    } catch (error) { finishWorkflow(); throw error; }
    return {
      done: job.done.then(result).finally(finishWorkflow),
      answer: (id, value) => job.answer(id, value),
      cancel: () => job.cancel(),
      frames: {
        async *[Symbol.asyncIterator]() {
          for await (const frame of job.frames) {
            const directory = await home();
            if (frame.t === 'print') yield { ...frame, line: abbreviateHome(frame.line, directory) };
            else if (frame.t === 'result' && frame.error !== undefined) yield { ...frame, error: abbreviateHome(frame.error, directory) };
            else yield frame;
          }
        },
      },
    };
  }

  const readSession = createReadSession(bridge, {
    state, onHello,
    async read(job) {
      const lines: string[] = [];
      const outcome = await read(job, undefined, lines);
      const directory = await home();
      return { result: await result(outcome), lines: lines.map(line => abbreviateHome(line, directory)) };
    },
  });
  async function readThroughSession(argv: readonly string[]) {
    try {
      const shared = await readSession.request(argv, cwd());
      if (shared) return shared;
    } catch (error) {
      return { result: await fail(error instanceof Error ? error.message : String(error)), lines: [] };
    }
    const lines: string[] = [];
    return read(run(argv, z.unknown(), value => value, []), undefined, lines).then(result => ({ result, lines }));
  }

  /** Query families affected by a refreshed read, without clearing the newly replaced cache. */
  function sourceOf(argv: readonly string[]): ChangeSource {
    if (argv[0] === 'status') return 'config';
    if (argv[0] === 'ls' && argv[1] === '--local') return 'placed';
    return 'clone';
  }
  /** One CLI process per read argv per READ_CACHE_TTL_MS; failures and questions are never kept. Signal-free: a caller's abort must not kill a process other callers share. */
  function sharedRead(argv: readonly string[]): Promise<{ result: Result<unknown>; lines: string[] }> {
    const key = argv.join('\u0000');
    const now = Date.now();
    const hit = reads.get(key);
    if (hit && now - hit.at < READ_CACHE_TTL_MS) {
      if (hit.stale && !hit.refreshing) { hit.refreshing = true; void revalidate(key, argv, hit); }
      return hit.promise;
    }
    return start(key, argv, now);
  }
  function start(key: string, argv: readonly string[], at: number): Promise<{ result: Result<unknown>; lines: string[] }> {
    const promise = readThroughSession(argv);
    const entry = { promise, at, stale: false, refreshing: false };
    reads.set(key, entry);
    void promise.then(({ result }) => { if (!result.ok && reads.get(key) === entry) reads.delete(key); }, () => { if (reads.get(key) === entry) reads.delete(key); });
    return promise;
  }
  /** Failed refreshes drop the entry and broadcast; identical results reset the clock silently.
   * Compare only result: print lines are prose and may drift without a data change. */
  async function revalidate(key: string, argv: readonly string[], entry: { promise: Promise<{ result: Result<unknown>; lines: string[] }>; at: number; stale: boolean; refreshing: boolean }): Promise<void> {
    const previous = await entry.promise.then(value => value.result, () => undefined);
    let next: { result: Result<unknown>; lines: string[] } | undefined;
    try { next = await readThroughSession(argv); }
    catch { next = undefined; }
    if (reads.get(key) !== entry) return;
    entry.refreshing = false;
    entry.stale = false;
    if (next === undefined || !next.result.ok) { reads.delete(key); broadcast(sourceOf(argv)); return; }
    const changed = previous === undefined || JSON.stringify(previous) !== JSON.stringify(next.result);
    reads.set(key, { promise: Promise.resolve(next), at: Date.now(), stale: false, refreshing: false });
    if (changed) broadcast(sourceOf(argv));
  }
  /** A read verb through the shared cache, parsed for this caller. Aborting returns Cancelled for this caller only. */
  async function cached<TIn>(argv: readonly string[], schema: z.ZodType<TIn>, options?: ReadOptions, lines?: string[]): Promise<Result<TIn>> {
    const signal = options?.signal;
    if (signal?.aborted) return { ok: false, error: 'Cancelled.' };
    const shared = sharedRead(argv);
    let onAbort: (() => void) | undefined;
    const outcome = signal
      ? await Promise.race([shared, new Promise<null>(resolve => { onAbort = () => resolve(null); signal.addEventListener('abort', onAbort, { once: true }); })]).finally(() => { if (onAbort) signal.removeEventListener('abort', onAbort); })
      : await shared;
    if (outcome === null) return { ok: false, error: 'Cancelled.' };
    if (lines) lines.push(...outcome.lines);
    const raw = outcome.result;
    if (raw.ok) {
      try { return { ok: true, value: schema.parse(raw.value) }; }
      catch (error) { return { ok: false, error: `terum-skills answered, but the desktop app could not read the result: ${error instanceof Error ? error.message : String(error)}` }; }
    }
    let value: TIn | undefined;
    if (raw.value !== undefined) { try { value = schema.parse(raw.value); } catch { value = undefined; } }
    const failure: Result<TIn> = { ok: false, error: raw.error, ...(raw.refused ? { refused: true } : {}), ...(raw.cancelled ? { cancelled: true } : {}), ...(raw.reason ? { reason: raw.reason } : {}) };
    return value === undefined ? failure : { ...failure, value };
  }

  async function readModels<T>(options:ReadOptions|undefined, map:(value:CliStatus,local:CliLocal|null,platform:string,home:string)=>T):Promise<Result<T>> {
    const [status,local,platform,directory]=await Promise.all([
      cached(['status'], cliStatus, options),
      cached(['ls','--local'], cliLocal, options),
      bridge.hostPlatform().then(value=>({ok:true as const,value})).catch((error:unknown)=>({ok:false as const,error:error instanceof Error?error.message:String(error),value:''})),
      home(),
    ]);
    // A caller's abort is not a read failure: no reason, nothing else touched.
    if (status.value===undefined&&options?.signal?.aborted) return {ok:false,error:'Cancelled.'};
    if (status.value===undefined) return result({ok:false,error:status.ok?'Status returned no data.':status.error,...(!status.ok&&status.refused?{refused:true}:{}),...(!status.ok&&status.cancelled?{cancelled:true}:{}),reason:status.ok?'unreadable':readReason(status.error)});
    const value=map(status.value,local.ok?local.value:null,platform.value,directory);
    const errors=[status,local,platform].flatMap(outcome=>outcome.ok?[]:[outcome.error]);
    return result(errors.length?{ok:false,error:errors.join('\n'),value,reason:status.ok?'unreadable':readReason(status.error)}:{ok:true,value});
  }

  function teamSelectionFailure(teams:readonly {team:string}[]):Result<never> {
    return teams.length===0
      ? {ok:false,error:'No team is configured on this machine.',reason:'no-team'}
      : {ok:false,error:`This machine is configured for teams ${teams.map(team=>team.team).join(', ')}; Terum Skills keeps one team per machine. Leave the ones you no longer want in Settings ▸ Team.`,reason:'ambiguous-team'};
  }

  async function inventoryTeam(team: string | undefined, options?: ReadOptions): Promise<Result<InventoryTeam & { placements: LedgerPlacements }>> {
    const status = await cached(['status', ...(team ? ['--team', team] : [])], cliStatusTeams, options);
    if (!status.ok) return { ok: false, error: status.error };
    if (!team && status.value.teams.length !== 1) return teamSelectionFailure(status.value.teams);
    const selected = team ? status.value.teams.find(value => value.team === team) : status.value.teams.length === 1 ? status.value.teams[0] : undefined;
    if (!selected) return { ok: false, error: 'Select a team explicitly to read its skills.', reason: 'ambiguous-team' };
    if (!selected.readable) return fail(`Team ${selected.team} could not be read.`);
    return { ok: true, value: { ...selected, placements: status.value.ledger?.placements ?? [] } };
  }
  async function peopleInventory(options?: ReadOptions, permissions = false) {
    const status = await cached(['status', ...(permissions ? ['--permissions'] : [])], cliStatus, options);
    if (!status.ok) return status;
    if (status.value.teams.length !== 1) return teamSelectionFailure(status.value.teams);
    const team = status.value.teams[0]!;
    if (!team.readable) return { ok: false as const, error: `Team ${team.team} could not be read.` };
    const inventory = await cached(['ls', '--team', team.team], cliLs, options);
    return inventory.ok ? { ok: true as const, value: { team, inventory: inventory.value, placements: status.value.ledger.placements } } : inventory;
  }
  /** No ref: `usage <skill>` filters after the corpus scan, so a per-skill spawn costs a whole
   *  rescan and `cached()` would key a separate entry per skill. One read serves every skill page. */
  async function readUsage(options?:ReadOptions) {
    return cached(['usage','--json'],cliUsage,options);
  }
  async function readEvalReport(ref:string,team:string|undefined,options?:ReadOptions) {
    const lines:string[]=[];
    const report=await cached(['eval-report',...(team?['--team',team]:[]),'--',ref],cliEvalReport,options,lines);
    return {report,lines};
  }
  const backend: Backend = {
    async setWindowBackground(color) { try { await getCurrentWindow().setBackgroundColor(color); return { ok: true, value: undefined }; } catch (error) { return fail(error instanceof Error ? error.message : String(error)); } },
    async launchContext() {
      const launch = await state();
      actedLaunchAt = launch?.writtenAt ?? null;
      return launch ? { writtenAt: launch.writtenAt, ...(launch.target ? { target: launch.target } : {}), ...(launch.intent ? { intent: launch.intent } : {}) } : null;
    },
    async refreshLaunch() {
      await launchListenerReady;
      stateOnce = undefined;
      if (hello === null) { featuresOnce = undefined; hello = null; }
      generation++;
      markStale();
      const previous = actedLaunchAt;
      const next = await backend.launchContext();
      // A relaunch is a terminal action landing and must not hide behind the throttle. The coordinator calls this on
      // every window focus too, and a focus that re-reads an unchanged launch file is not a relaunch: resetting there
      // made the once-a-minute throttle a once-per-focus fetch. The evidence is the file's own write time.
      if ((next?.writtenAt ?? null) !== previous) refreshPolicy.reset();
      return next;
    },
    onLaunchRequest(listener) {
      let disposed = false;
      let unlisten: (() => void) | undefined;
      launchListenerReady = bridge.onLaunchRequest(() => { refreshPolicy.reset(); listener(); refreshPolicy.trigger(); }).then(stop => {
        if (disposed) stop(); else unlisten = stop;
      });
      return () => { disposed = true; unlisten?.(); };
    },
    onFileDrop(listener) {
      // The webview's own drag-drop stream (Tauri keeps `dragDropEnabled`, so the OS drop never reaches HTML5 handlers).
      let disposed = false;
      let unlisten: (() => void) | undefined;
      try {
        void getCurrentWebview().onDragDropEvent(({ payload }) => {
          if (disposed) return;
          if (payload.type === 'enter') listener({ kind: 'enter', paths: payload.paths });
          else if (payload.type === 'leave') listener({ kind: 'leave' });
          else if (payload.type === 'drop') listener({ kind: 'drop', paths: payload.paths });
        }).then(stop => { if (disposed) stop(); else unlisten = stop; }, () => { /* Outside the Tauri shell (browser dev, vitest) there is no webview event stream; a drop then simply never arrives, which is the mock's job to serve. */ });
      } catch { /* Same: getCurrentWebview() throws without the shell's IPC, and there is nothing to clean up. */ }
      return () => { disposed = true; unlisten?.(); };
    },
    async features(): Promise<Features> {
      if (!hello) await (featuresOnce ??= cached(['status'], z.unknown()).then(() => undefined));
      return Object.fromEntries(FEATURE_KEYS.map(key => [key, hello?.features[key] ?? false])) as Features;
    },
    async capabilities(): Promise<Capabilities> {
      const [platform, version, features] = await Promise.all([bridge.hostPlatform().catch(() => 'unknown'), bridge.hostOsVersion().catch(() => null), backend.features()]);
      const windowChrome = platform === 'macos' ? 'mac-overlay' : 'native';
      return { appVersion: import.meta.env.VITE_APP_VERSION, windowChrome, windowControlsEnd: windowChrome === 'mac-overlay' ? macWindowControlsEnd(version) : null, disablePerMachine: features.disablePerMachine, inboxEventLog: false, offtargetKind: false, machineRegistry: false, perCaseEvalTables: features.perCase, openInEditor: true, clipboard: true };
    },
    async surfaces(): Promise<Surfaces> {
      return { divergence: false, status: true, settings: true, onboarding: false, library: true, skill: true, receipts: true, inbox: false, catalog: true, roster: true, update: true, libraryProjects:true, appUpdate:true };
    },
    // Status and Settings are offline reads; the remaining surfaces retain their explicit gaps.
    status: (_, options) => readModels(options, (value, local, platform, home) => statusModel(value, local, platform, { localIdentity: hello?.features.localIdentity ?? false }, home)),
    async settings(_, options) {
      const models = await readModels(options, (value, local, platform, home) => settingsModel(value, local, statusModel(value, local, platform, { localIdentity: hello?.features.localIdentity ?? false }, home), home));
      // The background fetch has no board of its own; Settings ▸ Sync is where its last outcome is admitted to.
      if (models.value) models.value.lastAutomatic = refreshPolicy.last();
      const team = models.value?.TEAMS.length === 1 ? models.value.TEAMS[0] : undefined;
      if (!team || !models.value) return models;
      const inventory = await cached(['ls', '--team', team.key], cliLs, options);
      if (!inventory.ok) return result({ ok:false, error:[...(models.ok?[]:[models.error]),inventory.error].join('\n'), reason:models.ok?'unreadable':models.reason??'unreadable', value:models.value });
      // Some CLI versions omit skill summaries from ls --local; the team inventory still reports their names.
      models.value.TEAM_POLICY.projects = inventory.value.projects?.map(project => project.name) ?? null;
      return models;
    },
    onboarding: async () => gap('Onboarding data'),
    async library({ scope }, options) {
      const local = await cached(['ls', '--local'], cliLs, options);
      if (!local.ok) return fail(local.error);
      const section = sectionFor(local.value, scope);
      if (!section) return fail('No such project: '+(scope.kind==='checkout'?scope.root:'global')+' · Add it under Settings ▸ This machine ▸ Projects.');
      const directory = await home(), root = rootOf(section, directory);
      const skills:SkillCard[] = [], seen=new Set<string>();
      for (const row of section.rows) { if(seen.has(row.path))continue;seen.add(row.path);skills.push(localCard(row,section,directory)); }
      for (const entry of section.notOffered??[]) { if(seen.has(entry.path))continue;seen.add(entry.path);skills.push(notOfferedCard(entry,section,directory)); }
      const broken=skills.filter(card=>card.flags.includes('broken')).length;
      const value:Library={root,roots:(local.value.local??[]).map(section=>rootOf(section,directory)),scanned:scannedRoots(local.value,directory),skills,problems:section.problems.map(p=>({source:p.path,message:p.reason})),title:plural(skills.length,'skill'),
        // The Evaluated tile's number, meter and caption come from one derivation over the same
        // receipts (overview-counts.ts) — the meter was previously hard-zeroed and the caption
        // hard-set to the zero copy, so a library with evaluated skills read "2 · Nothing evaluated yet".
        overview:{skills:String(skills.length),skills_note:'',...evaluatedOverview(skills),...unpublishedOverview(skills),installs:'—',installs_note:'',attention:String(broken),attention_lines:broken?[`${broken} need attention`]:[],attention_link:'',zero:overviewCopy}};
      return {ok:true,value};
    },
    async localSkill({path},options) {
      const local=await cached(['ls','--local'], cliLs, options);
      if(!local.ok)return fail(local.error);
      const directory=await home();
      for(const section of local.value.local??[]) {
        const row=section.rows.find(row=>samePath(row.path,path));
        const entry=row?undefined:section.notOffered?.find(entry=>samePath(entry.path,path));
        if(!row&&!entry)continue;
        const card=row?localCard(row,section,directory):notOfferedCard(entry!,section,directory);
        const detail=localDetail(card,section,row?.path??entry!.path,directory);
        // Library folders retain their own content and receipt. Only attribution is joined by the recorded skill ID.
        const id=row?.placement?.id??(row?.knownToTeam?row.skillId:null);
        if(id){
          const selected=await inventoryTeam(row?.placement?.team,options);
          if(!selected.ok)return fail(selected.error);
          const inventory=await cached(['ls','--team',selected.value.team],cliLs,options);
          if(!inventory.ok)return fail(inventory.error);
          const published=inventory.value.skills.find(skill=>skill.id===id);
          if(published)detail.author=inventoryAuthor(published,inventory.value,selected.value);
        }
        const shown=row?libraryEval(row).receipt:null,own=row?.localEval??null,team=row?.teamEval??null;
        // §3.3: the same receipt the card shows. A team receipt is committed testimony (latest, 'ok'); an own run is an uncommitted local run.
        const report=shown?mapEvalReport({versions:{placed:row?.placement?.version??null,teamCurrent:null,evaluated:shown.version},
          latestState:shown===team?'ok':'none',latest:shown===team?team:null,
          history:team?[{version:team.version??'—',run_id:team.run_id,timestamp:team.provenance.timestamp,runner_handle:team.provenance.runner_handle,comparison:team.comparisons['candidate-vs-baseline']??null,verdict:team.verdict,execution_status:team.execution_status}]:[],
          localRuns:own?[{run_id:own.run_id,run_dir:own.path.replace(/[/\\]receipt.json$/,''),execution_status:own.execution_status,committed:false,receipt:own}]:[]}):{};
        return {ok:true,value:{...detail,...report}};
      }
      return {ok:false,error:abbreviateHome(path,directory)+' is not in any Library root (Global or a registered project).',reason:'not-in-library'};
    },
    skillFile:{
      move:({path,to})=>run(['skill','move','--to',to,'--',path],cliSkillFile,v=>v,['config']),
      copy:({path,to})=>run(['skill','copy','--to',to,'--',path],cliSkillFile,v=>v,['config']),
      rename:({path,to})=>run(['skill','rename','--to',to,'--',path],cliSkillFile,v=>v,['config']),
      delete:({path})=>run(['skill','delete','--',path],cliSkillFile,v=>v,['config','clone']),
      fix:({path})=>run(['skill','fix','--',path],cliSkillFile,v=>v,['config']),
      // Local-only, like fix: the CLI rewrites metadata.terum-category and publishes nothing, so no clone read is invalidated.
      category:({path,to})=>run(['skill','category','--to',to,'--',path],cliSkillFile,v=>v,['config']),
    },
    // skill enable|disable writes Claude Code's own skillOverrides for the folder's root; the Library re-reads `enabled` from the same files.
    setSkillEnabled:({path,enabled})=>enabled?run(['skill','enable','--',path],cliSkillToggle,v=>v,['config']):run(['skill','disable','--',path],cliSkillToggle,v=>v,['config']),
    projects:{add:path=>run(['project','add','--',path],cliProjectAdded,(value)=>({path:value.path,label:value.label,added:value.added,...(value.parent===undefined?{}:{parent:value.parent}),...(value.reconcile===undefined?{}:{reconcile:value.reconcile})}),['config']),remove:path=>run(['project','remove','--',path],cliProjectRemoved,v=>v,['config']),rename:({path,name})=>run(['project','rename','--to',name,'--',path],cliProjectRenamed,v=>v,['config'])},
    reconcile:{list:()=>read(run(['reconcile','--list'],cliReconcile,(value):ReconcileResult=>value,[])).then(result)},
    teamProjects:{create:({name,remote})=>run(['team','project','create',...(remote?['--remote',remote]:[]),'--',name],cliProjectCreated,v=>v,['clone'])},
    async skill({ ref, team, at }, options) {
      const parts = ref.split('/');
      const explicitTeam = team ?? (parts.length === 2 ? parts[0] : undefined);
      const name = parts.length === 2 ? parts[1]! : ref;
      // Keep the local scan's feature evidence before later reads replace the shared hello.
      const [selected, { local, features }] = await Promise.all([inventoryTeam(explicitTeam, options), cached(['ls', '--local'], cliLs, options).then(local => ({ local, features: { localIdentity: hello?.features.localIdentity ?? false } }))]);
      if (!selected.ok) return { ok: false, error: selected.error, reason: selected.reason ?? 'unreadable' };
      const inventory = await cached(['ls', '--team', selected.value.team], cliLs, options);
      if (!inventory.ok) return { ok: false, error: inventory.error, reason: 'unreadable' };
      const matches = inventory.value.skills.filter(row => row.name === name || row.id.startsWith(name));
      const row = inventory.value.skills.find(row => row.name === name) ?? (matches.length === 1 ? matches[0] : undefined);
      if (!local.ok) return { ok: false, error: local.error, reason: 'unreadable' };
      // A root the scan does not report (a stale bookmark, a forgotten checkout, a hand-typed URL)
      // is ignored rather than answered with a fabricated absence: the machine-wide answer is what
      // an unscoped URL gives today, and it never claims a root it did not resolve.
      const section = at === undefined ? undefined : sectionFor(local.value, at);
      const presence = section ? restrictLocal(local.value, section) : local.value;
      const owning = section ? owningRootOf(section) : null;
      if (!row) {
        // A bare name the team does not offer may still name a folder on this machine — one nobody
        // shared, or one whose frontmatter the CLI could not parse. Deep links and bookmarks arrive
        // as a bare name with no path, so the local roots answer before the name is reported
        // unknown. A scoped read searches only the root it names. An ambiguous team prefix is a
        // team-side ambiguity and is reported as such, with the count and the way out.
        const onThisMachine = matches.length === 0 ? localDetailByName(presence, name, await home()) : undefined;
        if (onThisMachine) return { ok: true, value: onThisMachine };
        if (matches.length === 0) return { ok: false, reason: 'not-found', error: `No skill named ${name} is shared in team ${selected.value.team}, and no readable folder of that name is in your Library roots.` };
        return { ok: false, reason: 'ambiguous-ref', error: `${matches.length} team skills in ${selected.value.team} have an ID starting with ${name}; open the one you want from the marketplace.` };
      }
      const [validation, report] = await Promise.all([backend.validate({ ref: row.name, team: selected.value.team }, options), backend.evalReport({ref:row.name,team:selected.value.team},options)]);
      // A hygiene failure has a parsed value; an unreadable/cancelled validation is a read failure.
      if (!validation.ok && validation.value === undefined) return { ok: false, error: validation.error, reason: 'unreadable' };
      const detail = inventoryDetail(row, presence, selected.value, selected.value.placements, validation, inventory.value, features, await home(), local.value, owning);
      const merged = report.ok ? {...detail, ...report.value} : {...detail, evalReportError: report.error};
      // The same captured snapshot inventoryDetail joined on: one skill() must not read localIdentity twice.
      // The version names the copy this page describes, so a scoped read reads the scoped placement.
      const placementVersion = onDisk(presence, selected.value.team, row.id, features).find(item => item.placement?.id === row.id && item.placement.team === selected.value.team)?.placement?.version;
      const version = placementVersion ?? merged.versions?.teamCurrent ?? detail.version_full;
      return {ok:true,value:{...merged,...detailVersionFields(detail.repo, row.name, version)}};
    },
    async evalReport({ref,team},options) {
      const {report,lines}=await readEvalReport(ref,team,options);
      return report.ok?{ok:true,value:mapEvalReport(report.value,lines)}:{ok:false,error:report.error};
    },
    async usage({ref},options) {
      const report=await readUsage(options);
      return report.ok?{ok:true as const,value:mapUsage(report.value,ref)}:{ok:false as const,error:report.error};
    },
    /** A one-shot spawn, NOT `cached()` and NOT the serve session. Both of those are read paths:
     *  `cached` would hand a second click a stale answer for a run the user just paid for, and the
     *  serve session is reads-only precisely so a long-lived process never owns agent children.
     *  `touches` is empty -- screening changes no local state, so nothing needs invalidating. */
    misses(q) {
      return run(['misses','--json',...(q?.since?['--since',q.since]:[]),...(q?.limit===undefined?[]:['--limit',String(q.limit)])],cliMisses,mapMisses,[]);
    },
    async receipts({skillId,version},options) {
      const {report,lines}=await readEvalReport(skillId,undefined,options);
      if(!report.ok)return {ok:false,error:report.error};
      return {ok:true,value:report.value.latestState==='ok'&&report.value.latest?.version===version?mapEvalReport(report.value,lines).receipt:null};
    },
    inbox: async () => gap('The Inbox'),
    async roster(_, options) {
      const data = await peopleInventory(options, true);
      if (!data.ok) return {ok:false,error:data.error,...(data.reason?{reason:data.reason}:{})};
      const { team, inventory } = data.value;
      return rosterModel(team, inventory);
    },
    async catalog(query, options) {
      const data = await peopleInventory(options);
      if (!data.ok) return {ok:false,error:data.error,...(data.reason?{reason:data.reason}:{})};
      const { team, inventory, placements } = data.value;
      const local = await cached(['ls', '--local'], cliLs, options);
      if (!local.ok) return fail(local.error);
      if (inventory.people === undefined && team.members.length) return fail(STALE_CLI_ROSTER);
      const model = rosterModel(team, inventory);
      if (!model.ok) return fail(model.error);
      const members = model.value.members;
      // §8.4: the per-member fan-out is deleted. `catalog()` spawned `status` + `ls --local` + N × `ls
      // member`; the team read now carries every member whole, so this is three processes regardless of
      // team size. A CLI that predates the `people[]` limb is REPORTED rather than silently drawn as a
      // team with no members — the only thing worse than a slow marketplace is a wrong one.
      const roster = new Map((inventory.people ?? []).map(person => [person.handle, person]));
      const people: Person[] = [];
      for (const member of members) {
        const detail = roster.get(member.handle);
        if (!detail) return fail(`No member data for ${member.handle}.`);
        // §8.4: the CLI resolved the authorship join, so this is an id lookup rather than a second
        // `normalizeAuthor` living on this side of the process boundary.
        const authoredIds = new Set(detail.authored);
        const authored = inventory.skills.filter(skill => authoredIds.has(skill.id));
        const names = authored.map(skill => skill.name);
        // §8.5 (amended 2026-09-13): the person page is one list — `profile[]`, what they stand behind
        // — so `installable` is that list too. It drives the count, the Install button's label and
        // `install member`, which reads the same field (`src/commands/install.ts`): one number, one
        // promise. `installed[]` is still read by the roster, just no longer drawn as a second bucket.
        const profileIds = new Set(detail.profile.map(entry => entry.id));
        const installable = inventory.skills.filter(skill => profileIds.has(skill.id));
        const latest = newestUpdated(authored);
        const lastPublish = latest ? `${relativeTime(latest.updated)} · ${latest.name}` : '—';
        const disk: Person['onDisk'] = [installable.filter(skill => onDisk(local.value, team.team, skill.id, { localIdentity: hello?.features.localIdentity ?? false }).length > 0).length, installable.length];
        people.push({ ...member, joined: member.joined ?? '—', role: detail.role, lastPublish, last_publish: lastPublish, organization: null, skills: names, installable: installable.map(skill => skill.name), adoption: authored.reduce((sum, skill) => sum + skill.installs, 0), publishLine: latest ? `Published ${latest.name} · ${relativeTime(latest.updated)}` : authored.length === 0 ? 'Nothing shared yet' : '—', teamsLine: member.projects.join(' · ') || 'On no project yet', buckets: [['On their profile', installable.map(skill => skill.name)]], profileVersions: Object.fromEntries(detail.profile.map(entry => [entry.name, entry.version])), placeNote: personPlaceNote(disk), onDisk: disk });
      }
      return { ok: true, value: catalogModel(team, inventory, local.value, placements, people, { localIdentity: hello?.features.localIdentity ?? false }, await home(), query?.q) };
    },
    search: (args: SearchArgs, options?: ReadOptions) => read(run(['search', '--', args.q], cliSearch, (hits): SearchHit[] => hits.map((hit) => ({ kind: 'skill', ref: hit.team === undefined ? hit.name : `${hit.team}/${hit.name}`, name: hit.name, description: hit.description, team: hit.team ?? null, category: hit.category ?? null, author: hit.author ?? null, installs: hit.installs ?? null, latest: hit.latest ?? null })), []), options).then(result),
    // Long verbs: one process each, questions become dialogs, the CLI's own decline messages come back as `ok:false`.
    setIdentity: (args) => {
      const pairs = [args.name === undefined ? [] : [`name=${args.name}`], args.email === undefined ? [] : [`email=${args.email}`], args.defaultHandle === undefined ? [] : [`default-handle=${args.defaultHandle}`]].flat();
      return run(['login', ...pairs.flatMap(pair => ['--set', pair])], cliLogin, (value): IdentityWrite => ({ updated: value.updated, notice: value.notice ?? null }), ['config']);
    },
    // install writes config pending/approvals/placements, places the folder, and safeWrites people/<handle>.json.
    install: (args: InstallArgs) => args.adopt !== undefined
      ? prepareRun(async (signal): Promise<Result<{ sections: readonly LocalSection[] }>> => {
        const local = await read(run(['ls', '--local'], cliLs, value => value, []), {signal});
        return local.ok ? {ok:true,value:{sections:local.value.local ?? []}} : fail(local.error);
      }, ({sections}) => run(['install', ...(args.team ? ['--team', args.team] : []), '--adopt', args.adopt!], cliAdopted, (item): InstalledResult[] => {
        const scope=scopeOfPath(sections,item.path);
        if(scope===null)throw new Error(`${item.path} is no longer reported under a Library root.`);
        return [{ id:item.id, name:basename(item.path), scope, path:item.path, version:item.version, profiled:item.profiled ?? false }];
      }, ['config','placed','clone']))
      : prepareRun(async (signal): Promise<Result<{ into: string | undefined; sections: readonly LocalSection[] }>> => {
      // 'Global' needs no lookup: `--into global` is both the destination and the truthful report. A named project
      // resolves its repoRoot for `--into`. A scope-less call omits `--into` so the CLI's own picker asks the user;
      // the same `ls --local` sections are then kept to read back which registered root the CLI actually placed each
      // skill in (scopeOfPath), because reporting the caller's absent scope as 'Global' would be a guess (review r1 HIGH).
      if (args.scope === 'Global') return {ok:true,value:{into:'global',sections:[]}};
      const local = await read(run(['ls', '--local'], cliLs, value => value, []), {signal});
      // A scope-less install could always run without this read; a failed read only degrades the report, never the install.
      if (!local.ok) return args.scope === undefined ? {ok:true,value:{into:undefined,sections:[]}} : {ok:false,error:local.error};
      const sections = local.value.local ?? [];
      if (args.scope === undefined) return {ok:true,value:{into:undefined,sections}};
      const matches = sections.filter(section => section.scope === 'project' && section.rootState !== 'absent' && section.label === args.scope);
      if (matches.length !== 1 || !matches[0]?.repoRoot) return {ok:false,error:`Unknown install destination ${args.scope}.`};
      return {ok:true,value:{into:matches[0].repoRoot,sections}};
    }, ({into, sections}) => run(['install', ...(args.yesProfile ? ['--yes-profile'] : []), ...(args.team ? ['--team', args.team] : []), ...(into === undefined ? [] : ['--into', into]), '--', ...(args.kind === 'member' && args.member ? ['member', args.member] : args.kind === 'project' && args.project ? ['project', args.project] : [args.ref!])], cliInstalled, (installed): InstalledResult[] => installed.map((item) => ({ id: item.id, name: item.id, scope: args.scope ?? scopeOfPath(sections, item.path) ?? 'Global', path: item.path ?? null, version: item.version ?? null, profiled: item.profiled ?? false })), ['config', 'placed', 'clone'])),
    // uninstall-skill drops config placements/pending, removes placed folders, and rewrites the clone's people file.
    uninstallSkill: (args: UninstallArgs) => run(['uninstall-skill', ...(args.team ? ['--team', args.team] : []), ...(args.from ? ['--from', args.from] : []), '--', ...(args.kind === 'member' && args.member ? ['member', args.member] : args.kind === 'project' && args.project ? ['project', args.project] : [args.ref])], cliUninstalled, (removed): UninstalledResult[] => removed.map((item) => ({ id: item.id, name: item.id })), ['config', 'placed', 'clone']),
    quit: () => bridge.quit(),
    uninstallMachine: () => run(['uninstall'], cliMachine, (value): MachineUninstallResult => ({ removed: value.teams, removedPlacements: value.removedPlacements, hookRemoved: value.hookRemoved, wrapperRemoved: value.wrapperRemoved, configRemoved: value.configRemoved, kept: value.kept, record: value.record, advice: value.advice })),
    // profile writes the clone's people file and, for --name, config.display_name.
    profile: args => run(['profile', ...(args.name === undefined ? [] : ['--name', args.name]), ...(args.bio === undefined ? [] : ['--bio', args.bio]), ...(args.role === undefined ? [] : ['--role', args.role]), ...(args.projects ?? []).flatMap(project => ['--project', project])], cliProfile, value => value, args.name === undefined ? ['clone'] : ['config', 'clone']),
    // publish writes clone team.json/PR branches and registers the current checkout in config.
    // Destructive and team-wide. `--yes` is safe here ONLY because the caller opened a confirm dialog
    // first: the CLI's typed-name prompt is the terminal's brake, and the dialog is the app's.
    unpublish: (args: UnpublishArgs) => run(['unpublish', ...(args.team ? ['--team', args.team] : []), '--yes', '--', args.ref], cliUnpublish, (value): UnpublishResult => ({ name: value.name, id: value.id, versions: value.versions, evalAssets: value.evalAssets, receipts: value.receipts, projects: value.projects, profiles: value.profiles }), ['clone', 'marketplace']),
    // Two or more refs is ONE CLI process: one refresh, one question per prompt, one push. The
    // result array is in the order the refs were given, so a row maps to its outcome by index.
    publishMany: (args: PublishManyArgs) => run(['publish', ...(args.team ? ['--team', args.team] : []), ...(args.project ? ['--project', args.project] : []), ...(args.category ? ['--category', args.category] : []), '--', ...args.refs], z.array(cliPublish), (value): PublishResult[] => value.map((entry) => ({ name: entry.name, project: entry.project, version: entry.version, created: entry.created, identicalTo: entry.identicalTo, attachedEvals: entry.attachedEvals, evalAssets: entry.evalAssets, profileAdded: entry.profileAdded, projectAdded: entry.projectAdded, refused: entry.refused ?? null })), ['config', 'clone']),
    publish: (args: PublishArgs) => run(['publish', ...(args.team ? ['--team', args.team] : []), ...(args.project ? ['--project', args.project] : []), ...(args.category ? ['--category', args.category] : []), '--', args.ref], cliPublish, (value): PublishResult => ({ name: value.name, project: value.project, version: value.version, created: value.created, identicalTo: value.identicalTo, attachedEvals: value.attachedEvals, evalAssets: value.evalAssets, profileAdded: value.profileAdded, projectAdded: value.projectAdded }), ['config', 'clone']),
    // Sync fetches team clones; it never changes the local Library or places a skill.
    sync: (args: SyncArgs) => run(['sync', ...(args.team ? ['--team', args.team] : [])], cliRefresh, (value): SyncResult => ({ notices:value.notices,changed:value.changed,teams:value.teams.map(team=>({team:team.team,state:team.state,...(team.detail===undefined?{}:{detail:team.detail}),...(team.missing?{missing:true as const,successors:(team.successors??[]).map(entry=>({ownerRepo:entry.ownerRepo,source:entry.source,teamName:entry.teamName??null,at:entry.at??null})),...(team.lookup===undefined?{}:{lookup:team.lookup}),...(team.summary===undefined?{}:{summary:team.summary})}:{})})) }), ['marketplace', 'stamp']),
    prune: () => run(['prune'], z.unknown(), () => undefined, ['placed']),
    invite: (args: InviteArgs) => run(['invite', ...(args.team ? ['--team', args.team] : []), ...(args.logins.length ? ['--', ...args.logins] : [])], cliInvite, (value): InviteResult => ({ invited: [...value.invited], already: [...value.already], failed: value.failed.map(f => ({ login: f.login, error: f.error })) }), ['clone']),
    team: (args: TeamArgs) => args.kind === 'move'
      ? run(teamArgv(args), cliTeamMove, (value): TeamResult => ({ name: value.to, kind: 'move', restored: value.restored, missing: value.missing, failed: value.failed }), ['config', 'clone', 'placed'])
      : run(teamArgv(args), cliTeam, (value): TeamResult => ({ name: value.team, kind: args.kind }), ['config', 'clone', 'placed']),
    setup: (args: SetupArgs) => run(['setup', ...(args.target ? ['--', args.target] : [])], cliSetup, (value): SetupResult => ({ team: value.team, role: value.role, steps: value.steps ?? null }), ['config', 'clone', 'placed']),
    // Settings ▸ Evals defaults reach every run as explicit flags ("the flags the app passes") through the one producer in eval-flags.ts; an unset pref (or the k '—' sentinel) passes nothing and the CLI falls back to its own defaults (k = 1, model sonnet).
    eval: (args: EvalArgs) => run(['eval', ...evalPrefFlags(prefs), ...(args.team ? ['--team', args.team] : []), ...(args.vs ? ['--vs', args.vs] : []), ...(args.brief ? ['--brief', args.brief] : []), '--', args.ref], cliEval, (value): EvalResult => ({ name:value.name,runDir:value.runDir,executionStatus:value.executionStatus,team:value.team,id:value.id,shareHint:value.shareHint===true }), ['config', 'placed']),
    // IE6 §3.1: derivation only — no arms run, so this spends one model call and nothing else.
    deriveBrief: (args: DeriveBriefArgs) => run(['eval', ...evalPrefFlags(prefs), ...(args.team ? ['--team', args.team] : []), '--vs', args.vs, '--derive-brief', '--', args.ref], cliDerivedBrief, (value): DerivedBrief => ({ brief:value.brief,briefPath:value.briefPath }), []),
    // Several at once: the same receipts land locally, so the same boards move. A request the CLI would refuse throws here, before any spawn.
    evalMany: (args: EvalManyArgs) => run(evalManyArgv(args, prefs), cliEvalMany, mapEvalMany, ['config', 'placed']),
    validate: (args: ValidateArgs, options?: ReadOptions) => args.ref || args.cwd ? cached<ValidateResult>(['validate', ...(args.cwd && args.ref ? ['--cwd', args.cwd] : []), ...(args.team ? ['--team', args.team] : []), '--', args.ref || args.cwd || ''], cliValidate, options).then(result) : fail('validate needs a skill name or a folder.'),
    update: (_args, options) => read(run(['update'], cliUpdate, (value): UpdateAdvice => ({ ...value, running: value.running ?? null, latest: value.latest ?? null }), []), options).then(result),
    appUpdate: createAppUpdate({ run, read, result, prefs, appVersion: import.meta.env.VITE_APP_VERSION }),
    diagnostics: () => run(['status'], z.unknown(), () => undefined, []),
    async windowAction(action) { try { const window = getCurrentWindow(); if (action === 'toggle-maximize') await window.toggleMaximize(); else await window.startDragging(); return { ok: true, value: undefined }; } catch (error) { return fail(error instanceof Error ? error.message : String(error)); } },
    async openUrl(url) { try { await openUrl(url); return { ok: true, value: undefined }; } catch (error) { return fail(error instanceof Error ? error.message : String(error)); } },
    async revealPath(path) { try { await revealItemInDir(await localPath(path)); return { ok: true, value: undefined }; } catch (error) { return fail(error instanceof Error ? error.message : String(error)); } },
    async pickFolder() { try { const chosen = await openDialog({ directory: true, multiple: false, title: 'Choose a project folder' }); return { ok: true, value: typeof chosen === 'string' ? chosen : null }; } catch (error) { return fail(error instanceof Error ? error.message : String(error)); } },
    async openInEditor(path) { try { await openPath(await localPath(path)); return { ok: true, value: undefined }; } catch (error) { return fail(error instanceof Error ? error.message : String(error)); } },
    async copyToClipboard(text) { try { await writeText(text); return { ok: true, value: undefined }; } catch (error) { return fail(error instanceof Error ? error.message : String(error)); } },
    canShareImage, shareImage, saveImage:saveNativeImage,
    async copyImage(png) { try { await writeImage(await Image.fromBytes(new Uint8Array(await png.arrayBuffer()))); return { ok: true, value: undefined }; } catch (error) { return fail(error instanceof Error ? error.message : String(error)); } },
    prefs,
    subscribe(listener): Subscription { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  registerEvalQueue(backend, createEvalQueue({ run, read, result, prefs }));
  return backend;
}

function teamArgv(args: TeamArgs): string[] {
  switch (args.kind) {
    case 'create': return ['team', 'create', ...(args.remote ? ['--remote', args.remote] : []), ...(args.name ? ['--', args.name] : [])];
    case 'join': return ['team', 'join', ...(args.remote && args.name ? ['--as', args.name] : []), '--', args.remote ?? args.name ?? ''];
    case 'remove': return ['team', 'remove', ...(args.team ? ['--team', args.team] : []), '--', args.handle ?? ''];
    case 'leave': return ['team', 'leave', '--', args.name ?? args.team ?? ''];
    case 'move': return ['team', 'move', ...(args.team ? ['--from', args.team] : []), '--yes', '--', args.remote ?? ''];
  }
}

/** Drive a read-only run without answering questions, retaining diagnostics and partial values. */
export async function read<T>(job: Run<T>, options?: ReadOptions, lines: string[] = []): Promise<Result<T>> {
  const signal = options?.signal;
  const cancel = () => { void job.cancel(); };
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  try {
    for await (const frame of job.frames) {
      if (frame.t === 'print') lines.push(frame.line);
      if (frame.t === 'ask') {
        await job.cancel();
        return { ok: false, error: `terum-skills asked "${frame.question}" during a read-only call; the desktop app never answers questions on your behalf.` };
      }
    }
    const result = await job.done;
    return result.ok || !lines.length ? result : { ...result, error: [result.error, ...lines].join('\n') };
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
}
