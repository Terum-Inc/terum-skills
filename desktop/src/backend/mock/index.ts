import { canShareImage, shareImage, saveBrowserImage } from '../image-sharing';
import { isUnderRoot, normalizeSeparators } from '../../lib/skill-path';
import { z } from 'zod';
import { browserPrefs } from '../prefs';
import { FEATURE_KEYS } from '../types';
import type { Settings, SyncResult, ChangeSource, Features, Identity, Project, Root, LibraryScope, SkillDetail, TeamResult, ReconcileResult } from '../types';
import { decodeText } from '../../lib/fixture-text';
import { overviewCopy } from '../../lib/overview-copy';
import { unpublishedOverview } from '../../lib/overview-counts';
import { abbreviateHome } from '../paths';
import type { Backend } from '../Backend';
import type { EvalManyResult, FileDropEvent, InviteResult, Result, Roster, Run, SearchHit, SetupResult, SkillCard, Subscription } from '../types';
import type { EvalQueueItem } from '../eval-queue';
import { design, inboxItems, skillByRef, cardOf, detailOf, catalogData, remoteSlugsOf, MOCK_ORIGIN } from './data';
import { cli, roster_by_adoption, statusLines } from './derive';
import { onboardingData, replaySetupEvals } from './onboarding';
import { readScenario } from './scenario';
import { RAW_MD } from './raw-md';
import { statusCounts } from './status-counts';
import { createRun } from './run';
import type { RunContext } from './run';
export const MOCK_REMOVE_DETAIL = [
 'terum-skills will be removed from this machine.',
 ...design.TEAMS.map(t=>`  Team: ${t.key} (${t.remote}, handle ${t.handle})`),
 `  Placed skills (${design.PLACEMENTS_N}): ${design.PLACEMENTS.map(p=>p[0]).join(', ')}`,
 `  Local clones (1): ${design.TEAMS.map(t=>t.clone).join(', ')}`,
 '    (a clone holding uncommitted or unpushed work is moved to ~/.terum/skills/quarantine instead)',
 '  Version cache and run files for these teams',
 '  Session-start hook in ~/.claude/settings.json',
 '  /terum-skills Claude Code skill at ~/.claude/skills/terum-skills',
 '  Downloaded desktop app bundle at ~/.terum/skills/app (all versions)',
 '  Desktop launch state in ~/.terum/skills/run (app.json, latest-version.json)',
 '  ~/.terum/skills/config.json',
 'Kept: ~/.terum/skills/backups (settings backups and a record of this uninstall)',
 'Your membership and installed-skill records in the team repo are unchanged. Rejoining does not re-place skills; `npx -y terum-skills@latest install member <handle>` does.',
 'The package itself is not removed by this command; the last line tells you how.',
];
export const MOCK_REMOVE_ADVICE = [
 'This copy of terum-skills runs from ~/.npm/_npx/terum-skills/node_modules/terum-skills/dist/index.js.',
 'It is an npx cache copy, so there is nothing to uninstall for it. If you also installed the package globally or in a project, remove that with the tool you used, e.g. npm uninstall -g terum-skills.',
 'The desktop app was deleted from ~/.terum/skills/app. A copy that is running keeps running until you quit it; it cannot be reopened from the Dock. `npx -y terum-skills@latest app` downloads it again (needs gh and the release).',
 "This app's own preferences (theme, layout) are kept by the app and were not touched.",
];
const updateAdvice=['Cache request recorded as: terum-skills@latest',"To request the registry's latest release, run:",'  npx -y terum-skills@latest <command>','This does not update other local or global installations.'];
const removed = new Set<string>();
/** Restore the mock fixture between independent test cases; runs retain state until reset. */
export function resetMockRemovals():void { removed.clear(); }
const cancelled=(error:string):Result<never>=>({ok:false,error,cancelled:true});
const fatal=decodeText(design.ONBOARD_FETCH_ERROR);
const errors={status:"Could not read ~/.terum/skills/config.json.",library:"EACCES: permission denied, scandir '~/.terum/skills'",settings:"Invalid ~/.terum/skills/config.json: Expected property name or '}' in JSON at position 412 (line 14 column 3)",inbox:fatal,marketplace:"fatal: unable to access 'https://github.com/terum/team-skills.git/': Could not resolve host: github.com",share:"ENOENT: no such file or directory, scandir '~/.terum/skills/teams/terum/people'",skill:(ref:string)=>`ENOENT: no such file or directory, open '~/.claude/skills/${ref}/SKILL.md'`,onboarding:design.ONBOARD_FETCH_ERROR.replaceAll("&#39;", "'")};
const ok=<T>(value:T):Result<T>=>({ok:true,value});
/** The paths an HTML5 drop carries: one per non-empty `text/plain` line. A browser never exposes a dropped folder's real path, so a folder dropped from the OS yields none. */
export function dropPathsFrom(data:Pick<DataTransfer,'getData'>|null):string[]{
 if(!data)return [];
 try{return data.getData('text/plain').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);}catch{return [];/* getData throws for a protected store; that is the same as carrying nothing. */}
}
/** HTML5 drag events on the window, folded to the seam's three kinds; `dragover` is cancelled so the drop reaches the page. */
function listenHtmlDrops(listener:(event:FileDropEvent)=>void):Subscription{
 if(typeof window==='undefined')return ()=>{};
 let inside=false;
 const enter=(event:DragEvent)=>{event.preventDefault();if(!inside){inside=true;listener({kind:'enter',paths:[]});}};
 const over=(event:DragEvent)=>{event.preventDefault();};
 const leave=(event:DragEvent)=>{if(event.relatedTarget===null&&inside){inside=false;listener({kind:'leave'});}};
 const drop=(event:DragEvent)=>{event.preventDefault();inside=false;listener({kind:'drop',paths:dropPathsFrom(event.dataTransfer)});};
 window.addEventListener('dragenter',enter);window.addEventListener('dragover',over);window.addEventListener('dragleave',leave);window.addEventListener('drop',drop);
 return ()=>{window.removeEventListener('dragenter',enter);window.removeEventListener('dragover',over);window.removeEventListener('dragleave',leave);window.removeEventListener('drop',drop);};
}
const fail=(error:string):Result<never>=>({ok:false,error:abbreviateHome(decodeText(error),'')});
const zeroCopy=overviewCopy;
const zeroOverview={skills:'0',skills_note:zeroCopy.skills,evaluated:'—',meter:{pass_:0,neutral:0,fail:0,total:0},meter_text:zeroCopy.evaluated,installs:'0',installs_note:zeroCopy.installs,unpublished:'0',unpublished_note:'',attention:'0',attention_lines:[zeroCopy.attention],attention_link:design.LIBRARY_OVERVIEW.attention_link,zero:zeroCopy};
const reconcileFixture=():ReconcileResult=>({
 identical:[{path:'~/.claude/skills/deploy-check',name:'deploy-check',team:design.TEAMS[0]!.key,skillId:'mock-deploy-check',version:'v5'}],
 differing:[
  {path:'~/.claude/skills/release-notes',name:'release-notes',team:design.TEAMS[0]!.key,skillId:'mock-release-notes',teamVersion:'v2',nextVersion:'v3',sameId:true,teamAuthor:'teddy'},
  {path:'~/.claude/skills/pr-review',name:'pr-review',team:design.TEAMS[0]!.key,skillId:null,teamVersion:'v4',nextVersion:'v5',sameId:false,teamAuthor:'ajayw36'},
 ],renamed:[],adopted:[],published:[],
});
function removalState<T extends SkillCard>(skill:T):T { return removed.has(skill.name)?{...skill,installed:'absent',placed:false,onDiskOnly:false,paths:[]}:skill; }
export function createMockBackend(opts:{latencyMs?:number}={}):Backend & {readonly quitRequested:boolean;readonly appUpdateCalls:readonly (readonly ['armOnClose',string] | readonly ['disarmOnClose'])[]} {
 const identity:Identity=structuredClone({...design.ME,initials:'TZ',footerLabel:design.MACHINE.gh_login});
 const listeners=new Set<(source:ChangeSource)=>void>();
 const latency=opts.latencyMs??0;
 if(!Number.isFinite(latency)||latency<0)throw new Error('latencyMs must be a finite nonnegative number.');
 async function read<T>(family:keyof typeof errors,get:(scenario:ReturnType<typeof readScenario>)=>Result<T>,ref=''):Promise<Result<T>>{
  const scenario=readScenario();
  if(scenario==='loading')return new Promise<Result<T>>(()=>{ /* Deliberately pending: the loading board has no completion. */ });
  const delay=scenario==='slow'?2000:latency;
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  if(scenario==='error')return fail(typeof errors[family]==='function'?errors[family](ref):errors[family]);
  const result=get(scenario);
  return structuredClone(result.ok?result:{...result,error:abbreviateHome(decodeText(result.error),'')});
 }
 function long<T>(family:Exclude<keyof typeof errors,'skill'>,script:(ctx:RunContext)=>Promise<Result<T>>):Run<T>{
  const scenario=readScenario();
  return createRun(async ctx=>{if(scenario==='error')return fail(errors[family]);if(scenario==='loading'){while(true)await ctx.sleep(60_000);}if(scenario==='slow'||latency)await ctx.sleep(scenario==='slow'?2000:latency);return structuredClone(await script(ctx));});
 }
 const fileChanges=new Map<string,{path:string|null;name:string;original:string}>();
 /** The CLI's `eval` takes a skill, never a URL segment: a by-path ref names the folder, whose name is the skill's unless this session moved or renamed it. */
 const localName=(ref:string)=>[...fileChanges.values()].find(change=>change.path===ref)?.original??ref.split(/[\\/]/).filter(Boolean).at(-1)??ref;
 function folderOf(root:Root):string{return root.kind==='global'?'~/.claude/skills':root.root+'/.claude/skills';}
 /** The fixture skills natively under a root: Global holds every SKILLS entry, a checkout the ones LIST_OF puts there. */
 function fixtureSkillsAt(root:Root){const scopes:Record<string,readonly string[]>=design.LIST_OF,canonical=fixtureKeyOf(root);return canonical==='Global'?design.SKILLS:design.SKILLS.filter(skill=>skill.project!=='local'&&scopes[skill.name]?.includes(canonical));}
 /** Whether a Library card sits at `path` right now: a fixture skill not moved away (its change is keyed by its native path), or a moved/renamed one that landed there. */
 function occupied(path:string):boolean{const folder=path.slice(0,path.lastIndexOf('/')),name=path.slice(folder.length+1),root=mockRoots().find(r=>folderOf(r)===folder);return (root!==undefined&&fixtureSkillsAt(root).some(s=>s.name===name)&&!fileChanges.has(path))||[...fileChanges.values()].some(change=>change.path===path);}
 /** §3.1 states 1–5 for the `overlays` scenario, applied by position to the Library's fixture cards. State 1 carries a teammate's receipt for its bytes (the `run by ajayw36 · v3` line). */
 const LIBRARY_OVERLAY_STATES:((card:SkillCard)=>Partial<SkillCard>)[]=[
  card=>({installedVersion:'v3',localMatch:'identical',placed:true,installed:'placed',onDiskOnly:false,edited:false,knownToTeam:true,localEval:card.summary?{...card.summary,runnerHandle:'ajayw36',version:'v3'}:card.localEval}),
  ()=>({installedVersion:'v3',localMatch:'differs',placed:true,installed:'placed',onDiskOnly:false,edited:true,knownToTeam:true,localEval:null,localEvalStale:true}),
  ()=>({installedVersion:null,localMatch:'differs',placed:true,installed:'placed',onDiskOnly:false,edited:true,knownToTeam:true,localEval:null}),
  ()=>({installedVersion:null,localMatch:'differs',placed:false,installed:'placed',onDiskOnly:true,edited:false,knownToTeam:true,localEval:null}),
  ()=>({installedVersion:null,localMatch:'none',placed:false,installed:'placed',onDiskOnly:true,edited:false,knownToTeam:false}),
 ];
 function localProjection<T extends SkillCard>(card:T):T {return {...card,teamed:false,installs:'—',installsN:0,teamState:'unknown',latestVersion:null,installedVersion:null,localMatch:card.flags.includes('local')?'none':null,knownToTeam:!card.flags.includes('local'),evalVersion:null,evalStale:false,latestEvalState:null,profileVersion:null,edited:card.flags.includes('local'),flags:card.flags.filter(flag=>flag!=='update'),localEval:card.summary?{...card.summary,runnerHandle:null,version:null}:null};}
 function fileRun(kind:'move'|'copy'|'rename'|'delete',path:string,to?:string){return long('library',async ctx=>{
  const name=path.split('/').at(-1)!;
  // Only `delete` asks, as the CLI does since 2026-09-14 (src/commands/skill.ts): the other three are
  // reversible by a second run and the typed name bought friction, not safety.
  if(kind==='delete'&&await ctx.ask('text',`Type ${name} to ${kind} this folder`)!==name)return cancelled('The name did not match; nothing changed.');
  const destination=kind==='delete'?null:kind==='rename'?path.slice(0,path.lastIndexOf('/')+1)+to:(to==='global'?'~':to)+'/.claude/skills/'+name;
  const notices:string[]=[];
  // §7.5 / §9.1.1 (hybrid review r1, high): this used to evict whatever card already sat at the destination,
  // silently. The CLI (src/commands/skill.ts) refuses the same folder, refuses a rename onto an occupied
  // name, and on a move keeps the resident at <root>/.claude/old-skills/<name> and says so — old-skills is a
  // sibling of the skills root, so it is hidden from the Library by construction, never by a filter.
  if(destination===path)return fail('The source and destination are the same folder.');
  if(destination!==null&&occupied(destination)){
   if(kind==='rename')return fail(destination+' already exists; choose another name.');
   const kept=destination.slice(0,destination.lastIndexOf('/.claude/skills/'))+'/.claude/old-skills/'+name,resident=[...fileChanges.entries()].find(([,change])=>change.path===destination);
   fileChanges.set(resident?.[0]??destination,{path:kept,name:resident?.[1].name??name,original:resident?.[1].original??name});
   notices.push('Your previous copy is kept at '+kept+'.');
  }
  const prior=[...fileChanges.entries()].find(([,change])=>change.path===path),original=prior?.[1].original??name;
  // A copy adds a second card and leaves the source's entry untouched; every other kind relocates the one card.
  if(kind==='copy')fileChanges.set(destination!,{path:destination,name,original});
  else fileChanges.set(prior?.[0]??path,{path:destination,name:kind==='rename'?to!:name,original});
  for(const listener of listeners)listener('config');
  notices.push(kind==='delete'?'Moved to quarantine.':`${kind==='rename'?'Renamed':kind==='copy'?'Copied':'Moved'} ${path} to ${destination}.`);
  return ok({kind,path,destination,quarantined:kind==='delete'?'~/.terum/skills/quarantine/'+name:null,installed:false,notices});
 });}

 const profileValues: {name?:string;bio?:string;role?:string;projects?:string[]} = {};
 // A successful mock install flips the fixture's installed state, so the UI updates like the real adapter's.
 const installedRefs = new Set<string>();
 const withInstall = <T extends SkillCard>(card:T):T => installedRefs.has(card.name)?{...card,installed:'placed',placed:true,onDiskOnly:false}:card;
 /** Projects created in this session, shown alongside the fixture's own so the Add flow is exercisable in mock mode. */
 const created: {name:string;remote:string|null}[] = [];
 /** Endorsements this session opened, so a project's card reflects what the picker did. */
 const endorsed: {project:string;name:string}[] = [];
 const asProject=(q:{name:string;remote:string|null}):Project=>({name:q.name,key:q.name,ico:'folder',desc:'',skills:0,members:0,remote:q.remote??'—',remoteSlugs:remoteSlugsOf(q.remote),installed:false,favorites:null,updated:null,path:null,admin:null,evaluated:null,memberHandles:[],memberInitials:[],skillsIn:[]});
 // `skillsTotal` is null on the mock: the canvas fixture records who authored a skill and how many installs
 // it has team-wide, but never how many skills a member's own machine holds, so there is no honest number to
 // draw. The real adapter reads each member's self-report from their people file; the column shows '—' here
 // until the canvas gains the field.
 const roster=():Roster=>({members:design.ROSTER.map(q=>({...q,...(q.handle===design.ME.handle?profileValues:{}),skillsTotal:null,lastPublish:q.last_publish,status:design.MEMBER[q.handle]?.[0]??'',projects:q.handle===design.ME.handle?profileValues.projects??design.MEMBER[q.handle]?.[1]??[]:design.MEMBER[q.handle]?.[1]??[],lastSeen:design.MEMBER[q.handle]?.[2]??''})),byAdoption:roster_by_adoption().map(q=>q.handle),invited:design.INVITED,member:Object.fromEntries(Object.entries(design.MEMBER).map(([handle,[status,projects,lastSeen]])=>[handle,{status,projects:handle===design.ME.handle?profileValues.projects??projects:projects,lastSeen}]))});
 const appUpdateCalls: (readonly ['armOnClose',string] | readonly ['disarmOnClose'])[]=[];
 let quitRequested=false;
 const backend:Backend & {readonly quitRequested:boolean;readonly appUpdateCalls:readonly (readonly ['armOnClose',string] | readonly ['disarmOnClose'])[]} = {
  get appUpdateCalls(){return appUpdateCalls.slice();},
  get quitRequested(){return quitRequested;},
  async quit(){quitRequested=true;try{window.close();}catch{ /* jsdom / Playwright: no-op */ }},
  async setWindowBackground(){return ok(undefined);},
  async launchContext(){return null;},
  async refreshLaunch(){return null;},
  onLaunchRequest(){return ()=>{};},
  onFileDrop(listener){return listenHtmlDrops(listener);},
  async features(){return Object.fromEntries(FEATURE_KEYS.map(key=>[key,true])) as Features;},
  async windowAction(){return ok(undefined);},
  async openUrl(url){try{window.open(url,'_blank','noopener');return ok(undefined);}catch(error){return fail(error instanceof Error?error.message:String(error));}},
  async revealPath(){return ok(undefined);},
  async pickFolder(){return ok('/Users/you/code/new-project');},
  async capabilities(){return {appVersion:design.APP_VERSION,windowChrome:'cosmetic',windowControlsEnd:null,disablePerMachine:true,inboxEventLog:true,offtargetKind:true,machineRegistry:true,perCaseEvalTables:true,openInEditor:true,clipboard:true};},
  async surfaces(){return {divergence:true,status:true,settings:true,onboarding:true,library:true,skill:true,receipts:true,inbox:true,catalog:true,roster:true,update:true,libraryProjects:false,appUpdate:false};},
  async status(){return structuredClone(ok({machine:{...design.MACHINE,hostname:design.MACHINE.name},me:identity,teams:readScenario()==='no-team'?[]:mockTeams(),tools:{git:true,gh:true},roots:mockRoots(),counts:statusCounts(location.hash,readScenario())}));},
  settings:async()=>{const result=await read<Settings>('settings',()=>ok({INVITE_TIP:design.INVITE_TIP,JOIN_BLOCK_NOTE:design.JOIN_BLOCK_NOTE,INVITEE:design.INVITEE,K:design.K,MACHINE:{...design.MACHINE,hostname:design.MACHINE.name},ME:identity,TEAMS:mockTeams(),TEAM_POLICY:{...design.TEAM_POLICY,categories:design.CATEGORIES.map(([name])=>name),projects:design.PROJECTS.map(project=>project.name),categoriesNote:'From SKILL.md frontmatter; the list is admin-extendable.'},tools:{git:true,gh:true},syncNote:null,lastAutomatic:null,PLACEMENTS:design.PLACEMENTS,PLACEMENTS_N:design.PLACEMENTS_N,PINNED_N:design.PINNED_N,APPROVALS:design.APPROVALS,QUARANTINE:design.QUARANTINE,HOOK:design.HOOK,APP_VERSION:design.APP_VERSION,AGENT_CLI:design.AGENT_CLI,AGENT_CLI_AUTH:'signed-in',COMMUNITY:design.COMMUNITY,STORAGE:design.STORAGE,SETTINGS_NAV:design.SETTINGS_NAV,SHORTCUTS:design.SHORTCUTS,INBOX_KIND_TEXT:design.INBOX_KIND_TEXT,THEME_OPTIONS:design.THEME_OPTIONS,CLI_VERSION:design.CLI_VERSION,CLI_LATEST:design.CLI_LATEST,FOLLOWING:design.FOLLOWING,SHARED_SPECIMEN:design.SHARED_SPECIMEN}));return result.ok?result:{...result,reason:result.error.includes('Invalid')&&result.error.includes('config.json')?'invalid-config':'unreadable'};},
  onboarding:async()=>{const result=await read('onboarding',()=>ok(onboardingData()));return result.ok?result:{...result,value:onboardingData()};},
  library:({scope})=>read('library',scenario=>{
   const roots=mockRoots(),root=roots.find(r=>scope.kind==='global'?r.kind==='global':r.id===scope.root);
   if(!root)return fail('No such project: '+(scope.kind==='checkout'?scope.root:'global'));
   const canonical=root.label,folder=folderOf(root);
   const source=scenario==='empty'?[]:fixtureSkillsAt(root);
   const cardFor=(s:typeof design.SKILLS[number],path:string,name=s.name)=>localProjection(removalState(withInstall({...cardOf(s),name,path,project:canonical,enabled:backend.prefs.get('enabled:'+name,s.enabled??true),favorite:backend.prefs.get('favorite:'+name,s.favorite??false),...(scenario==='on-disk-only'&&name==='deploy-check'?{installed:'placed' as const,placed:false,onDiskOnly:true,paths:[[path,'global']] as [string,string][]}:{})})));
   const skills=source.filter(s=>!fileChanges.has(folder+'/'+s.name)).map(s=>cardFor(s,folder+'/'+s.name));
   // Cross-mirror overlays spec §5 M1.7: `?__mock=overlays` puts the first five Library cards, in fixture order, into §3.1
   // states 1–5 so a board and a test can point at each state by position.
   if(scenario==='overlays')LIBRARY_OVERLAY_STATES.forEach((state,index)=>{const card=skills[index];if(card)Object.assign(card,state(card));});
   for(const change of fileChanges.values())if(change.path?.slice(0,change.path.lastIndexOf('/'))===folder){
    const original=design.SKILLS.find(s=>s.name===change.original);if(!original)continue;
    const card=cardFor(original,change.path,change.name);if(change.name!==change.original)Object.assign(card,{edited:true,summary:null,localEval:null,localEvalStale:card.localEval!==null});skills.push(card);
   }
   const overview=scenario==='empty'?zeroOverview:(Object.hasOwn(design.OVERVIEW_BY_SCOPE,canonical)?(design.OVERVIEW_BY_SCOPE as Record<string,typeof design.LIBRARY_OVERVIEW>)[canonical]!:zeroOverview);
   // The fixture's overview predates the Unpublished tile, so its two strings and its zero caption
   // are derived from the cards this scope actually draws rather than read from design.json.
   return ok({roots,scanned:null,root,skills,overview:{...overview,skills:String(skills.length),installs:'—',...unpublishedOverview(skills),zero:{...overview.zero,unpublished:overviewCopy.unpublished}},title:`${skills.length} skill${skills.length===1?'':'s'}`});
  }),
  localSkill:({path})=>read('skill',()=>{const change=[...fileChanges.values()].find(change=>change.path===path),name=path.split(/[\\/]/).filter(Boolean).at(-1)??'';
   // A card that landed here (a move onto the evicted resident's path) wins; only a path nothing occupies any more is gone.
   if(change===undefined&&fileChanges.has(path))return {ok:false,error:path+' is no longer in the Library.',reason:'not-in-library'};const detail=skillByRef(change?.original??name);return detail.ok?ok({...localProjection(detail.value),name,enabled:backend.prefs.get('enabled:'+name,detail.value.enabled),team:null,repo:null,installs_n:0,used_by:[],users:[],versions:null,version:'—',version_full:null,history:[],activity:[],...(change&&name!==change.original?{edited:true,localEval:null,summary:null,receipt:null,reportNumbers:null,skillMd:{...detail.value.skillMd,frontmatter:detail.value.skillMd.frontmatter.replace(/^name: .*$/m,'name: '+name)}}:{}),skillRef:'local:'+path,path,pathLabel:path,repoPath:path,owningRoot:mockOwningRoot(path)}):{ok:false,error:path+' is not in any Library root.',reason:'not-in-library'};}),
  skillFile:{
   move:({path,to})=>fileRun('move',path,to),copy:({path,to})=>fileRun('copy',path,to),rename:({path,to})=>fileRun('rename',path,to),delete:({path})=>fileRun('delete',path),
   // No fixture folder is broken, so the mock has nothing to rewrite: it answers as the CLI does for a file that already parses.
   fix:({path})=>long('library',async ctx=>{const line=path.split('/').at(-1)+': SKILL.md frontmatter is already valid YAML; nothing changed.';ctx.print(line);return ok({kind:'fix' as const,path,destination:null,quarantined:null,installed:false,notices:[line]});}),
   // No bytes to rewrite here either, so the mock answers the CLI's own shape: its two refusals (an empty
   // name and the one the file already declares) and the change line. It stops there — the CLI's remaining
   // notices name the version the team still shows, and every fixture skill carries a pre-versioning hash
   // rather than a `v<N>` ordinal, so there is no version number here to name and the mock invents none.
   category:({path,to})=>long('library',async ctx=>{
    const change=[...fileChanges.values()].find(change=>change.path===path),name=path.split('/').at(-1)??path;
    const detail=skillByRef(change?.original??name),wanted=to.trim(),current=detail.ok?detail.value.category:'misc';
    if(!wanted)return fail('--to must be a non-empty category name.');
    if(wanted===current)return fail(`${name} already declares ${current}; nothing to change.`);
    const line=`Changed ${name} from ${current} to ${wanted}.`;ctx.print(line);
    return ok({kind:'category' as const,path,destination:null,quarantined:null,installed:false,notices:[line]});
   }),
  },
  // Same shape as the CLI verb: the mock keeps the state in its preferences so every card and rail reads it back, as the real adapter reads skillOverrides.
  setSkillEnabled:({path,enabled}:{path:string;enabled:boolean})=>long('library',async ctx=>{const name=path.split(/[\\/]/).filter(Boolean).at(-1)??path;backend.prefs.set('enabled:'+name,enabled);for(const listener of listeners)listener('config');const line=enabled?`Enabled ${name}: Claude Code loads it again on this machine (skillOverrides in ~/.claude/settings.json).`:`Disabled ${name}: Claude Code no longer loads it on this machine (skillOverrides in ~/.claude/settings.json).`;ctx.print(line);return ok({kind:enabled?'enable' as const:'disable' as const,path,name,enabled,settingsFile:'~/.claude/settings.json',changed:true,notices:[]});}),
  projects:{add:(path:string)=>long('settings',async ctx=>{ctx.print('Added '+path+' to your library.');for(const listener of listeners)listener('config');return ok({path,label:path.split(/[\\/]/).filter(Boolean).at(-1)??path,added:true,reconcile:reconcileFixture()});}),remove:(path:string)=>long('settings',async ctx=>{ctx.print('Removed '+path+' from your library.');for(const listener of listeners)listener('config');return ok({path,placementsRemaining:0});}),
   rename:({path,name}:{path:string;name:string})=>long('settings',async ctx=>{const root=mockRoots().find(r=>r.kind==='checkout'&&r.id===path);if(!root)return fail(path+' is not in your library.');const label=name.trim();if(!label||label.length>64||label.toLowerCase()==='global')return fail('a project name is 1-64 characters and is not Global');const clash=mockRoots().find(r=>r.id!==path&&renamedRoots.has(r.id)&&r.label.toLowerCase()===label.toLowerCase());if(clash)return fail(`Another project is already named ${clash.label} (${clash.root}).`);const previous=root.label;renamedRoots.set(path,label);ctx.print(`Renamed ${previous} to ${label}; the folder ${path} is unchanged.`);for(const listener of listeners)listener('config');return ok({path,label,previous});})},
  reconcile:{list:async()=>ok(reconcileFixture())},
  teamProjects:{create:({name,remote}:{name:string;remote?:string})=>long('marketplace',async ctx=>{if(catalogData().projects.some(p=>p.name.toLowerCase()===name.toLowerCase())||created.some(p=>p.name.toLowerCase()===name.toLowerCase()))return fail(`team already has a project named ${name}.`);created.push({name,remote:remote??null});ctx.print('Created project '+name);for(const listener of listeners)listener('clone');return ok({team:'team',name,remotes:remote?[remote]:[],skills:0});})},
  skill:({ref,at})=>read('skill',scenario=>{if(scenario==='not-installed'&&ref==='deploy-check')return ok(scopedDetail(removalState(detailOf(design.DETAIL_NOT_INSTALLED)),at));const result=skillByRef(ref);
   if(result.ok&&scenario==='invalid-newest')Object.assign(result.value,{latestState:'invalid',receipt:null,summary:null,reportNumbers:null,invalidReceiptFile:`evals/deploy-check/${design.DETAIL.version_full}/20260829T221500Z.json`});
   if(result.ok&&scenario==='version-mismatch')result.value.versions={placed:'a1b2c3d4'+'0'.repeat(32),teamCurrent:'5f0e12ab9c3d'+'0'.repeat(28),evaluated:'5f0e12ab9c3d'+'0'.repeat(28)};
   if(result.ok&&scenario==='raw-md'){
    const frontmatter=/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(RAW_MD);
    if(!frontmatter)throw new Error('RAW_MD must begin with fenced frontmatter.');
    result.value.skillMd={frontmatter:frontmatter[0].replace(/\r?\n$/,''),body:[],markdown:RAW_MD.slice(frontmatter[0].length)};
   }
   return result.ok?ok(scopedDetail(removalState(withInstall({...result.value,...(scenario==='not-installed'?{installed:'absent' as const,placed:false,onDiskOnly:false,root:'Marketplace' as const,flags:[]}:{}),...(scenario==='on-disk-only'&&ref==='deploy-check'?{installed:'placed' as const,placed:false,onDiskOnly:true,path:'~/.claude/skills/deploy-check',pathLabel:'~/.claude/skills/deploy-check',paths:[['~/.claude/skills/deploy-check','global']] as [string,string][]}:{}),enabled:scenario==='disabled'?false:backend.prefs.get('enabled:'+ref,result.value.enabled),favorite:backend.prefs.get('favorite:'+ref,result.value.favorite)})),at)):result;},ref),
  /** Fixture firings. `deploy-check` is the case the feature exists for — reached for by hand, never
   *  chosen by the model. `pr-review` is placed and silent. `incident-triage` fired but Terum never
   *  placed it, the case that wrongly read "not installed" before. A skill in neither map has
   *  nothing recorded, which is not a claim about whether it is installed. */
  /** Screening is an ACTION that spends model calls, so the mock returns a `Run` like `eval` does,
   *  not a resolved read. `deploy-check` is the interesting fixture: 0 autonomous / 4 explicit in
   *  `usage`, so it is the skill a reader would actually screen. `pr-review` is the 0/0 row -- the
   *  ambiguous one this whole feature exists to disambiguate -- and it comes back empty, which is a
   *  real answer, not a failure. */
  misses:()=>long('library',async()=>{
   return ok({groups:[
    {skill:'deploy-check',candidates:[
     {prompt:'ship the new build to staging and make sure nothing is broken',ts:'2026-09-12T09:14:00.000Z',noPriorContext:false},
     {prompt:'ok do that before we cut the release',ts:'2026-09-10T16:02:00.000Z',noPriorContext:true},
    ]},
    {skill:'incident-triage',candidates:[{prompt:'prod is throwing 500s on checkout, where do I start',ts:'2026-09-13T22:41:00.000Z',noPriorContext:false}]},
   ],screened:340,calls:34,truncated:false,unjudged:0,
    since:'2026-09-08T00:00:00.000Z',until:'2026-09-15T00:00:00.000Z',
    caveats:['Counts are candidates for review, not measured misses; the judge sees a trimmed window, not the session.','Skills with no recorded placement date were left out of the catalogue and cannot appear here.']});
  }),
  usage:async({ref})=>{
   const name=ref.replace(/^local:/,'').split('/').pop()??ref;
   const placed:Record<string,{d1:number;d2:number}>={'deploy-check':{d1:0,d2:4},'release-notes':{d1:3,d2:1},'pr-review':{d1:0,d2:0}};
   const loose:Record<string,{d1:number;d2:number}>={'incident-triage':{d1:1,d2:3}};
   const hit=placed[name]??loose[name],isPlaced=placed[name]!==undefined;
   const ratio=(c:{d1:number;d2:number})=>c.d1+c.d2===0?null:c.d1/(c.d1+c.d2);
   return ok({firings:hit===undefined?null:{...hit,autonomy:ratio(hit),availability:isPlaced?'full' as const:'unknown' as const,placed:isPlaced},
    since:'2026-08-16T00:00:00.000Z',until:'2026-09-15T00:00:00.000Z',
    caveats:['Counts are invocations, not outcome-changing uses; reopenings are not deduped.','30-day window: Claude Code prunes transcripts, so earlier use is visible only where this machine has already archived it.']});
  },
  evalReport:async({ref})=>{const detail=await backend.skill({ref});if(!detail.ok)return detail;const {receipt,summary,incumbentLift,reportNumbers,history,versions,latestState,invalidReceiptFile,localRuns,evalEstimate,evalEstimateText,evalEstimateTip,scoreFractions,wlt}=detail.value;return ok({receipt,summary,incumbentLift,reportNumbers,history,versions,latestState,invalidReceiptFile,localRuns,evalEstimate,evalEstimateText,evalEstimateTip,scoreFractions,wlt});},
  receipts:({skillId,version})=>read('library',()=>{const detail=skillByRef(skillId);if(!detail.ok)return fail(detail.error);return ok(detail.value.version===version?detail.value.receipt??null:null);}),
  inbox:()=>read('inbox',scenario=>ok(scenario==='empty'?[]:inboxItems())),
  catalog:(query)=>read('marketplace',scenario=>{const catalog=catalogData();catalog.projects=[...catalog.projects,...created.map(asProject)];catalog.projects=catalog.projects.map(project=>{const added=endorsed.filter(row=>row.project===project.key).map(row=>row.name).filter(name=>!project.skillsIn.includes(name));return added.length?{...project,skills:project.skills+added.length,skillsIn:[...project.skillsIn,...added]}:project;});catalog.projectsByMembers=[...catalog.projectsByMembers,...created.map(q=>q.name)];if(scenario==='on-disk-only')catalog.skills=catalog.skills.map(skill=>skill.name==='deploy-check'?{...skill,installed:'placed' as const,placed:false,onDiskOnly:true,paths:[['~/.claude/skills/deploy-check','global']] as [string,string][],path:'~/.claude/skills/deploy-check',latestVersion:'v5',installedVersion:null,localMatch:'differs' as const}:skill);catalog.skills=catalog.skills.map(skill=>removalState(withInstall(skill)));catalog.extras=catalog.extras.map(skill=>removalState(withInstall(skill)));
   // D65 (2026-09-13 ledger): the stale-eval overlay reads `placed` only after this session's installs and removals are applied above, so "v5 · you have v2" follows a mid-session install or removal instead of the page-load fixture flag.
   if(scenario==='stale-eval')catalog.skills=catalog.skills.map(skill=>({...skill,latestVersion:'v5',installedVersion:skill.placed?'v2':null,evalVersion:skill.summary?3:null,evalStale:skill.summary!==null,latestEvalState:'invalid'}));
   // §5 M1.7: under `overlays` the Marketplace's placed cards are §3.2 state 3, except the first placed card in fixture order (state 3b, an edited install) and the second (state 2, on the latest); unplaced cards are state 1.
   if(scenario==='overlays'){let placedSeen=0;catalog.skills=catalog.skills.map(skill=>{if(!skill.placed)return {...skill,latestVersion:'v5',installedVersion:null,localMatch:null};const index=placedSeen++;return {...skill,latestVersion:'v5',installedVersion:index===1?'v5':'v2',localMatch:index===0?'differs':'identical'};});}
   catalog.people=catalog.people.map(person=>person.handle===design.ME.handle?{...person,...profileValues,teamsLine:profileValues.projects?.join(' · ')??person.teamsLine}:person);return ok({...catalog,skills:catalog.skills.filter(s=>!query?.q||(s.name+' '+s.desc).toLowerCase().includes(query.q.toLowerCase()))});}),
  roster:()=>read('share',scenario=>{const all=roster();return ok(scenario==='empty'?{byAdoption:all.byAdoption.filter(h=>h===design.ME.handle),members:all.members.filter(m=>m.handle===design.ME.handle),invited:[],member:Object.fromEntries(Object.entries(all.member).filter(([h])=>h===design.ME.handle))}:all);}),
  search:args=>read('marketplace',()=>{const hits:SearchHit[]=[...design.CATALOG.map(s=>({kind:'skill' as const,ref:s.name,name:s.name,description:s.desc})),...design.PEOPLE.map(p=>({kind:'member' as const,ref:p.handle,name:p.name,description:p.role})),...design.PROJECTS.map(p=>({kind:'project' as const,ref:p.key,name:p.name,description:p.desc}))].map(hit=>({...hit,team:null,category:null,author:null,installs:null,latest:null}));return ok(hits.filter(h=>(!args.kinds||args.kinds.includes(h.kind))&&(h.name+' '+h.description).toLowerCase().includes(args.q.toLowerCase())));}),
  install:args=>long('library',async ctx=>{const ref=args.adopt??args.ref;if(!ref?.trim())return fail('A ref or adopt path is required.');const name=localName(ref),detail=skillByRef(name);ctx.print(args.adopt?`Recording ${name} as installed…`:`Installing ${ref}…`);if((args.kind??'skill')==='skill'&&!detail.ok)return fail(detail.error);if(!await ctx.ask('confirm',`Approve these tools for ${name}?`))return cancelled('Install was declined.');ctx.progress(1,1,'Installed');if((args.kind??'skill')==='skill'){installedRefs.add(name);removed.delete(name);for(const listener of listeners)listener('placed');}const root=args.adopt?mockOwningRoot(args.adopt):null;return ok([{id:name,name,scope:args.scope??root?.label??'Global',path:args.adopt??(detail.ok?detail.value.path:null),version:detail.ok?detail.value.latestVersion:null,profiled:!args.adopt}]);}),
  uninstallSkill:args=>long('library',async ctx=>{
   const catalog=catalogData(),cards=[...catalog.skills,...catalog.extras];
   let names:string[],question:string;
   if(args.kind==='project'&&args.project){
    const project=catalog.projects.find(p=>p.key===args.project);
    if(!project)return fail(`Unknown project ${args.project}.`);
    names=project.skillsIn.filter(name=>!removed.has(name)&&cards.some(card=>card.name===name&&card.placed));
    question=`Remove ${args.project}'s ${names.length} skills from this machine?`;
   }else if(args.kind==='member'&&args.member){
    const person=catalog.people.find(p=>p.handle===args.member);
    if(!person)return fail(`Unknown member ${args.member}.`);
    names=person.installable.filter(name=>!removed.has(name));
    question=args.member===design.ME.handle?`Remove the ${names.length} skills on your profile from this machine?`:`Remove ${args.member}'s ${names.length} skills from this machine?`;
   }else{
    const skill=skillByRef(args.ref);
    if(!skill.ok)return fail(skill.error);
    names=[args.ref];question=`Remove ${skill.value.name}?`;
   }
   if(!names.length)return ok([]);
   const paths=names.flatMap(name=>cards.find(card=>card.name===name)?.paths??[]);
   const detail=[`Folders removed (${paths.length}):`,...paths.map(([path,scope])=>`  ${path}  ·  ${scope==='global'?'Global':`project ${scope}`}`),
    'Local changes are moved to ~/.terum/skills/quarantine, never deleted.',
    `Install records dropped from your people file (${names.length}): ${names.join(', ')}`,
    ...(args.kind==='member'?[`Targets are ${args.member}'s current profile list, not what you installed from them.`]:args.kind==='project'?['Copies installed to Global stay.']:[])];
   if(!await ctx.ask('confirm',question,{detail}))return cancelled('Remove was declined.');
   for(const name of names)removed.add(name);
   for(const listener of listeners){listener('placed');listener('config');}
   return ok(names.map(name=>({id:name,name})));
  }),
  setIdentity:args=>long('settings',async ctx=>{
   const fields=[['name','name',args.name,z.string().min(1)],['email','email',args.email,z.email()],['default-handle','default_handle',args.defaultHandle,z.string().transform(value=>value.trim().toLowerCase()).pipe(z.string().min(1).max(39).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))]] as const;
   const next={...identity};const updated:{key:string;value:string}[]=[];
   for(const [key,field,value,schema] of fields){if(value===undefined)continue;const parsed=schema.safeParse(value);if(!parsed.success)return fail(`Invalid ${key}: ${parsed.error.issues.map(issue=>issue.message).join('; ')}`);next[field]=parsed.data;updated.push({key,value:parsed.data});}
   if(!updated.length)return fail('Use --set <key>=<value>. Accepted keys: name, email, default-handle.');
   const notice=`This changes the author line (${next.name} <${next.email}>) that the next sync writes into the skills you have connected on this machine; skills you authored elsewhere keep their recorded author.`;
   ctx.print(notice);Object.assign(identity,next);for(const listener of listeners)listener('config');return ok({updated,notice});
  }),
  uninstallMachine:()=>long('settings',async ctx=>{
   const detail=[...MOCK_REMOVE_DETAIL];
   if(!await ctx.ask('confirm','Remove terum-skills from this machine?',{detail}))return cancelled('Uninstall was cancelled.');
   ctx.print("Wrote a record of this machine's terum-skills state to ~/.terum/skills/backups/uninstall.2026-09-09T12-00-00-000Z.json.");
   for(const t of design.TEAMS){ctx.print(`Leaving ${t.key}…`);ctx.print(`Left ${t.key}.`);}
   return ok({removed:design.TEAMS.map(t=>t.key),removedPlacements:design.PLACEMENTS_N,hookRemoved:true,wrapperRemoved:true,configRemoved:true,kept:['~/.terum/skills/backups'],record:'~/.terum/skills/backups/uninstall.2026-09-09T12-00-00-000Z.json',advice:[...MOCK_REMOVE_ADVICE]});
  }),
  profile:args=>long('share',async()=>{
    if(args.role!==undefined&&args.role.length>32)return fail('Role must be at most 32 characters.');
    if(args.name==='')return fail('Name must not be empty.');
    for(const project of args.projects??[])if(!design.PROJECTS.some(row=>row.key===project||row.name===project))return fail(`Unknown project ${project}.`);
    const current:Record<string,unknown>={name:design.ME.name,bio:'',role:design.ROSTER.find(person=>person.handle===design.ME.handle)?.role??'',projects:design.MEMBER[design.ME.handle]?.[1]??[],...profileValues};
    const changed=Object.entries(args).filter(([key,value])=>value!==undefined&&JSON.stringify(value)!==JSON.stringify(current[key])).map(([key])=>key==='name'?'display_name':key);
    Object.assign(profileValues,args);return ok({handle:design.ME.handle,changed});
  }),
  // §5.3: publish commits straight to the clone, so PublishResult has no PR/compare/branch field and the mock mints no
  // URL (B3 review high #1, D72). `endorsed` stays: catalog() reads it for the project cards, only its length-as-PR-number went.
  // The mock's retraction: it reports what a real one would have removed for the named skill, so a
  // dialog and its result line can be exercised without a team repo. Nothing in the mock is deleted.
  unpublish:args=>long('share',async ctx=>{const skill=skillByRef(args.ref);if(!skill.ok)return fail(skill.error);ctx.print(`Unpublishing ${args.ref}…`);const listed=endorsed.filter(entry=>entry.name===args.ref).map(entry=>entry.project);for(let i=endorsed.length-1;i>=0;i-=1)if(endorsed[i]!.name===args.ref)endorsed.splice(i,1);for(const listener of listeners)listener('clone');const n=Number(String(skill.value.version??'v1').replace(/^v/,''))||1;return ok({name:args.ref,id:'00000000-0000-4000-8000-000000000000',versions:Array.from({length:n},(_,i)=>`v${n-i}`),evalAssets:0,receipts:0,projects:listed,profiles:0});}),
  publish:args=>long('share',async ctx=>{const name=args.ref.split(/[\\/]/).filter(Boolean).at(-1)??args.ref;const skill=skillByRef([...fileChanges.values()].find(change=>change.path===args.ref)?.original??name);if(!skill.ok)return fail(skill.error);ctx.print(`Publishing ${args.ref}…`);if(args.project){endorsed.push({project:args.project,name:args.ref});for(const listener of listeners)listener('clone');}return ok({name:args.ref,project:args.project??null,version:skill.value.version??design.DETAIL.version,created:true,identicalTo:null,attachedEvals:0,evalAssets:0,profileAdded:false,projectAdded:Boolean(args.project)});}),
  // The batched verb the CLI grew: one run for the whole selection, one progress rung per skill so
  // a row can light up, and one result per ref in the order they were given.
  publishMany:args=>long('share',async ctx=>{const results=[];for(const [index,ref] of args.refs.entries()){const name=ref.split(/[\\/]/).filter(Boolean).at(-1)??ref;const skill=skillByRef([...fileChanges.values()].find(change=>change.path===ref)?.original??name);if(!skill.ok)return fail(skill.error);ctx.progress(index+1,args.refs.length,`Publishing ${name}`,ref);ctx.print(`Publishing ${ref}…`);if(args.project){endorsed.push({project:args.project,name:ref});}results.push({name:ref,project:args.project??null,version:skill.value.version??design.DETAIL.version,created:true,identicalTo:null,attachedEvals:0,evalAssets:0,profileAdded:true,projectAdded:Boolean(args.project)});}if(args.project)for(const listener of listeners)listener('clone');return ok(results);}),
  sync:args=>long<SyncResult>('onboarding',async ctx=>{ctx.print('Fetching team clones…');return ok({notices:[],changed:true,teams:[{team:args.team??design.TEAMS[0]!.key,state:'refreshed'}]});}),
  prune:()=>long('settings',async ctx=>{const names=design.QUARANTINE.map(q=>q[1]??'');if(!await ctx.ask('confirm',`Delete ${names.length} quarantined item(s)?`)){ctx.print('Prune cancelled; nothing deleted.');return cancelled('Prune was cancelled.');}return ok(undefined);}),
  invite:args=>long<InviteResult>('share',async ctx=>{if(!args.logins.length||args.logins.some(login=>!login.trim()))return fail('At least one GitHub login is required.');ctx.print(`Inviting ${args.logins.join(', ')}…`);if(readScenario()==='partial'){const [first,...rest]=args.logins;const failed=rest.map(login=>({login,error:`Could not invite @${login} (GitHub status 422). gh: Validation Failed (HTTP 422)`}));return {ok:false,error:failed.map(f=>f.error).join('\n'),value:{invited:first?[first]:[],already:[],failed}};}return ok({invited:[...args.logins],already:[],failed:[]});}),
  team:args=>long<TeamResult>('share',async ctx=>{const name=args.team??args.name??design.TEAMS[0]?.name??'Terum';ctx.print(`${args.kind}: ${name}`);if(args.kind==='leave'&&!await ctx.ask('confirm',`Leave ${name}? This removes ${design.PLACEMENTS_N} placed skill(s) from this machine.`))return cancelled('Leave was declined.');if(args.kind==='move'){const to=(args.remote??'').split('/').at(-1)??'';if(!to)return fail('A target <org>/<repo> is required.');ctx.print(`Moved to ${to}: ${design.PLACEMENTS_N} skill(s) placed again.`);return ok({name:to,kind:'move' as const,restored:design.PLACEMENTS.map(row=>String(row[1])).slice(0,design.PLACEMENTS_N),missing:[],failed:[]});}return ok({name,kind:args.kind});}),
  setup:args=>long('share',async ctx=>{ctx.print('Setting up terum-skills…');const choice=await ctx.ask('select','Create a team or join one?',{choices:['Create a new team','Join an existing team'],descriptions:['Creates a private GitHub repository under your account.','Uses an invitation from the team owner.']});const role=choice==='Create a new team'?'creator' as const:'joiner' as const;const team=args.target??design.TEAM_REPO;const steps:NonNullable<SetupResult['steps']>={role:'done',team:'done'};ctx.print('Looking for skill folders on this machine…');if(await ctx.ask('confirm','Add a project?')){const folder=await ctx.ask('path','Which folder?',{default:'~/code/terum'});ctx.print('Added '+folder+' to your library.');steps.projects='done';}else steps.projects='skipped';ctx.print('Checking your library against the team…');ctx.print("1 of your skills match the team's exactly; 2 share a name with a team skill but differ.");steps.existing='printed';steps.evals=await replaySetupEvals(ctx);return ok({team,role,steps});}),
  // IE6 §3.1: the mock derives a plausible neutral brief so the review dialog can be driven
  // without a model. It names neither skill, which is the one rule the real check enforces.
  deriveBrief:args=>long('library',async ctx=>{const detail=skillByRef(localName(args.ref));if(!detail.ok)return fail(detail.error);const rival=skillByRef(localName(args.vs));if(!rival.ok)return fail(rival.error);ctx.print('Deriving a shared task brief…');ctx.progress(1,1,'Complete');return ok({brief:'Take a change that is ready to go out and get it live without surprising anyone: check what is about to change, say so plainly, and leave a way back if it goes wrong.',briefPath:`~/.terum/skills/evals/local/${'0'.repeat(64)}/20260906T120000Z/brief.md`});}),
  eval:args=>long('library',async ctx=>{const detail=skillByRef(localName(args.ref));if(!detail.ok)return fail(detail.error);ctx.print(`Evaluating ${args.ref}…`);ctx.progress(1,1,'Complete');return ok({name:args.ref,runDir:`~/.terum/skills/evals/local/${'0'.repeat(64)}/20260906T120000Z`,executionStatus:'complete' as const,team:detail.value.team??null,id:null,shareHint:true});}),
  // Several skills in one run, the CLI's `eval <skill>… [--batch n] [--window w] [--pending]`: every ref is resolved before
  // any paid work, batches are separated by the CLI's own question, and a declined batch queues the rest for later.
  // The two requests the CLI refuses on sight throw before a run exists, exactly as the real adapter does.
  evalMany:args=>{
   if(args.refs.length===0&&!args.pending)throw new Error('Provide at least one skill, or --pending.');
   if(args.mode==='batches'&&(!Number.isSafeInteger(args.batch)||(args.batch??0)<1))throw new Error('--batch must be a positive integer.');
   return long('library',async ctx=>{
    const team=args.team??(readScenario()==='no-team'?null:design.TEAMS[0]?.key??null);
    if(args.pending&&team===null)return fail('--pending needs a team; this machine has none.');
    const skills:{ref:string;name:string}[]=[];
    const add=(ref:string,name:string)=>{if(!skills.some(skill=>skill.name===name))skills.push({ref,name});};
    for(const ref of args.refs){const detail=skillByRef(localName(ref));if(!detail.ok)return fail(`No local skill folder named \`${ref}\` in your library; install it from the marketplace first, or pass the folder's path.`);add(ref,detail.value.name);}
    if(args.pending){const pending=catalogData().skills.filter(skill=>skill.summary===null);for(const skill of pending)add(skill.name,skill.name);if(pending.length===0)ctx.print('Every shared skill already has an eval receipt for its current version.');}
    const names=skills.map(skill=>skill.name);
    const queue=(refs:readonly string[],window:'overnight'|'later'):EvalQueueItem[]=>{
     const items=refs.map(ref=>({skill:ref,path:`~/.claude/skills/${ref}`,contentHash:`sha256:${'0'.repeat(64)}`,requestedAt:new Date().toISOString(),window,...(team===null?{}:{team})}));
     const count=`${items.length} eval${items.length===1?'':'s'}`,drain='`npx -y terum-skills@latest eval --drain`';
     ctx.print(window==='overnight'?`Queued ${count} for overnight: the app runs them in parallel between 01:00 and 05:00 while it is open and idle. Run them now with ${drain}.`:`Queued ${count} for later. Run ${items.length===1?'it':'them'} with ${drain}.`);
     return items;
    };
    if(args.mode==='overnight'||args.mode==='later')return ok<EvalManyResult>({mode:'queued',team,skills:names,ok:0,failed:0,queued:queue(names,args.mode)});
    if(skills.length===0)return ok<EvalManyResult>({mode:'ran',team,skills:[],ok:0,failed:0,queued:[]});
    const width=args.mode==='batches'?args.batch??skills.length:skills.length,parallel=Math.min(4,width);
    ctx.print(`Evaluating ${skills.length} skill${skills.length===1?'':'s'}, ${parallel} at a time…`);
    let done=0,queued:EvalQueueItem[]=[],stoppedAfter:number|undefined;
    for(let offset=0;offset<skills.length;offset+=width){
     if(offset>0){const remaining=skills.length-offset;if(!await ctx.ask('confirm',`Continue with the next ${Math.min(width,remaining)}? (${offset} of ${skills.length} done, ${remaining} left)`)){queued=queue(names.slice(offset),'later');stoppedAfter=offset;break;}}
     for(const skill of skills.slice(offset,offset+width)){ctx.print(`Evaluating ${skill.name}…`);done++;ctx.progress(done,skills.length,'evaluated');}
    }
    ctx.print(`Evaluated ${done} of ${skills.length}; 0 failed.`);
    return ok<EvalManyResult>({mode:'ran',team,skills:names,ok:done,failed:0,queued,...(stoppedAfter===undefined?{}:{stoppedAfter})});
   });
  },
  // A folder path names the skill by its last segment, as publish does above: the Fix dialog validates by path.
  validate:args=>read('library',()=>{const name=args.ref?.split(/[\\/]/).filter(Boolean).at(-1)??design.DETAIL.name;const detail=skillByRef(name);return detail.ok?ok({name,findings:0,warnings:0,repairable:0,repairs:[]}):fail(detail.error);}),
  update:()=>read('settings',()=>ok({running:design.CLI_VERSION,latest:design.CLI_LATEST,observation:'newer',launch:'npx',description:`${design.CLI_VERSION} installed · ${design.CLI_LATEST} available`,advice:updateAdvice,lines:[`terum-skills ${design.CLI_VERSION}`,`Latest advertised release: ${design.CLI_LATEST}`,...updateAdvice]})),
  appUpdate:{
   check:()=>read('settings',()=>ok({appVersion:design.APP_VERSION,supported:false,cliVersion:design.CLI_VERSION,latest:design.CLI_LATEST,latestAt:null,probe:'skipped' as const,probeError:null,staged:null,installed:[],lastApply:null,newer:false,ppid:0,platform:'unsupported'})),
   stage:()=>long('settings',async()=>fail('The mock backend does not download or install anything.')),
   apply:async()=>fail('The mock backend does not download or install anything.'),
   armOnClose:async version=>{appUpdateCalls.push(['armOnClose',version]);return ok(undefined);},
   disarmOnClose:async()=>{appUpdateCalls.push(['disarmOnClose']);return ok(undefined);},
  },
  diagnostics:()=>long('status',async ctx=>{for(const line of statusLines(design))ctx.print(line);return ok(undefined);}),
  async openInEditor(path){return (path==='~'||path.startsWith('~/')||path.startsWith('/'))?ok(undefined):fail('An editor path is required.');},
  async copyToClipboard(text){try{if(!navigator.clipboard?.writeText)return fail('Clipboard unavailable.');await navigator.clipboard.writeText(text);return ok(undefined);}catch(error){return fail(error instanceof Error?error.message:'Clipboard unavailable.');}},
  canShareImage, shareImage, saveImage:saveBrowserImage,
  async copyImage(png){try{if(png.type!=='image/png')return fail('Expected a PNG image.');if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')return fail('Clipboard unavailable.');await navigator.clipboard.write([new ClipboardItem({'image/png':png})]);return ok(undefined);}catch(error){return fail(error instanceof Error?error.message:'Clipboard unavailable.');}},
  prefs:browserPrefs(),
  subscribe:listener=>{listeners.add(listener);return ()=>{listeners.delete(listener);};}
 };
 return backend;
}

/** `project rename` in mock mode: the names chosen this session, by root id. The fixture keys stay the boards' names (`fixtureKeyOf`), so a renamed row still finds its skills. */
const renamedRoots=new Map<string,string>();
const MOCK_ROOT_NAMES=['Terum','SSM','MRF'] as const;
function fixtureKeyOf(root:Root):string{return root.kind==='global'?'Global':MOCK_ROOT_NAMES.find(name=>root.id==='/Users/you/code/'+name.toLowerCase())??root.label;}
function mockRoots():Root[]{const scenario=readScenario();const global:Root={id:'global',kind:'global',label:'Global',root:'~/.claude/skills',rootState:'scanned',registered:false,count:design.COUNTS.Global,remote:null};
 if(scenario==='no-projects')return [global];
 return [global,...MOCK_ROOT_NAMES.map((name):Root=>({id:'/Users/you/code/'+name.toLowerCase(),kind:'checkout',label:renamedRoots.get('/Users/you/code/'+name.toLowerCase())??name,root:'/Users/you/code/'+name.toLowerCase(),rootState:scenario==='missing-root'&&name==='SSM'?'absent':'scanned',registered:true,count:scenario==='missing-root'&&name==='SSM'?undefined:design.COUNTS[name],remote:MOCK_ORIGIN[name]===null?null:{url:'https://github.com/'+MOCK_ORIGIN[name],slug:MOCK_ORIGIN[name]!}}))];}
/** Which mock Library root holds this folder — the longest match, so a checkout nested inside
 *  another names the inner one, exactly as the CLI's own section assignment would. Null when the
 *  path is under no mock root, and the page then falls back to `root` as it does today. */
function mockOwningRoot(path:string):{id:string;label:string}|null{
 const root=mockRoots().filter(r=>isUnderRoot(path,r.root)).sort((a,b)=>normalizeSeparators(b.root).length-normalizeSeparators(a.root).length)[0];
 return root?{id:root.kind==='global'?'Global':root.id,label:root.label}:null;
}
/** A scoped read names the root the reader clicked, as the real adapter does, so the crumb, the
 *  sidebar, the Remove destination and #131's dialog wording agree with the URL. `installScopes`
 *  is deliberately untouched: destinations come from the whole machine on both backends. */
function scopedDetail(detail:SkillDetail,at:LibraryScope|undefined):SkillDetail{
 if(at===undefined)return detail;
 const root=mockRoots().find(r=>at.kind==='global'?r.kind==='global':r.id===at.root);
 if(!root)return detail;
 const path=root.kind==='global'?'~/.claude/skills/'+detail.name:root.root+'/.claude/skills/'+detail.name;
 return {...detail,owningRoot:{id:root.kind==='global'?'Global':root.id,label:root.label},scope:root.label,path,pathLabel:path,installScopePaths:Object.fromEntries(mockRoots().flatMap(r=>r.kind==='checkout'?[[r.label,r.root]]:[]))};
}
function mockTeams(){return design.TEAMS.map(team=>({...team,policy:design.TEAM_POLICY,categories:design.CATEGORIES.map(([name])=>name),pending:[],joinCommand:cli(`setup ${design.TEAM_REPO}`),joinBlock:['Send this to your teammate:', '```', 'npm install -g terum-skills', `npx -y terum-skills@latest setup ${design.TEAM_REPO}`, '', `Bare equivalent: npx -y terum-skills@latest team join ${design.TEAM_REPO}`, '```', 'If you have a pending GitHub invitation, setup tries to accept it using your logged-in gh account; without gh authentication, it asks you to accept it in your browser. Git must also have access to this repository.']}));}
