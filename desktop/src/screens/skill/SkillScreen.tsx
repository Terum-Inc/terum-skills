import { cardActions, localActionReason } from '../../components/domain/skill-card-actions';
import type { CardAction } from '../../components/domain/skill-card-actions';
import { SkillFileDialog } from './SkillFileDialog';
import { SkillFixDialog } from './SkillFixDialog';
import { SkillCategoryDialog } from './SkillCategoryDialog';
import { useWorkflow } from '../../components/domain/useWorkflow';
import { plural } from '../marketplace/market-data';
// §3.2: the version vocabulary exists ONCE. This leaf imports nothing at all, which is the only
// shape `cli-tree-imports.test.ts` admits across the tree boundary.
import { parseVersionFolder, versionLabel } from '../../../../src/lib/versions.js';
import { stripLeadingSkillHeading } from './skill-markdown';
import { RunEvalDialog } from './RunEvalDialog';
import { HeadToHeadDialog } from './HeadToHeadDialog';
import { useEvalRun } from '../../app/eval-run-context';
import { usePublishRun } from '../../app/publish-run-context';
import { token, installedVersionBehind, versionText } from '../../components/domain/presentation';
import { dayLabel, dayRangeLabel, daysAgoLabel, fullDayLabel, history, historyDays, localDay, parseDay, parseWindow, shortDayLabel, skillActivity, skillNote, skillUsage, windowPhrase, yearCalendar } from '../../lib/activation';
import type { SkillActivity } from '../../lib/activation';
import { WindowPicker, YearHeatmap } from '../../components/domain/Activation';
import { useMissScreening } from '../../components/domain/useMissScreening';
import type { MissesModel, UsageWindow } from '../../backend/types';
import { Fragment,useContext,useEffect,useRef,useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate,useParams,useSearchParams } from 'react-router';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { useBackend,useFeatures,useCapabilities,driveRun,PrintContext,PromptContext } from '../../backend';
import type { Features,Run,SkillDetail,Result,ValidateResult } from '../../backend/types';
import { useUiStore } from '../../app/store';
import { useUrlState } from '../../app/url-state';
import { Shell } from '../../components/domain/Shell';
import { ScreenFrame } from '../../components/domain/ScreenFrame';
import { AlertText,Avatar,BoardSkeleton,CenteredState,ErrorLine,Facepile,IconButton,RichText,SectionLabel,ShareBlock,Small,TerminalHint } from '../../components/domain/Primitives';
import { ScoreRow } from '../../components/domain/ScoreRow';
import { ShareSkillButton } from '../../components/domain/skill-share/ShareSkillButton';
import { EvaluationReport,HistoryRail } from '../../components/domain/EvaluationReport';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Icon } from '../../components/ui/Icon';
import { Switch } from '../../components/ui/Switch';
import { Dialog,DialogPopup,DialogTitle,DialogDescription } from '../../components/ui/Dialog';
import { Menu,MenuTrigger,MenuPopup,MenuItem } from '../../components/ui/Menu';
import { RadioGroup,RadioRow } from '../../components/ui/RadioGroup';
import { SkillMarkdown } from './SkillMarkdown';
import { PublishOptions } from './PublishOptions';
import { publishFlags, usePublishDefaults } from './publish-defaults';
import { CopyValue } from '../../components/domain/ContextMenu';
import { useContextMenu, useCopy, useHostReveal } from '../../components/domain/context-menu';
import type { ContextMenuItem } from '../../components/domain/context-menu';
import './skill.css';
import './activity.css';
const tabs=[['skill','SKILL.md','book-open'],['evals','Evals','chart'],['quality','Quality','check-circle'],['activity','Activity','eye']] as const;
function Author({skill:s,inline=false}:{skill:SkillDetail;inline?:boolean}){return <div className={'detail-author'+(inline?' inline':'')}><Avatar initials={s.author.initials} size={inline?20:28}/><div><span>{s.author.name}</span><span>{[s.author.role,s.author.handle].filter(Boolean).join(' · ')}</span></div></div>;}
// The rail switch shows for any folder on this machine (installed==='placed'), not only a ledger placement: skillOverrides governs whoever put the folder there (2026-09-15). `off` folds that into the on-disk-only and bundled captions.
function DetailRail({skill:s,onEnable,toggleError,manageActions,onAction}:{skill:SkillDetail;onEnable:(value:boolean)=>void;toggleError:string|null;manageActions:CardAction[];onAction:(action:CardAction)=>void}){const rc=s.receipt,backend=useBackend(),capabilities=useCapabilities(),off=capabilities?.disablePerMachine===true&&!s.enabled,[error,setError]=useState<string|null>(null),repoUrl=s.repo?s.repo.includes('://')?s.repo:'https://github.com/'+s.repo:null,url=repoUrl&&(s.latestVersion??s.versions?.teamCurrent)?`${repoUrl}/tree/main/skills/${s.name}/${s.latestVersion??s.versions?.teamCurrent}`:repoUrl?`${repoUrl}/tree/main/skills/${s.name}`:null;return <aside className="detail-rail"><div className="detail-status"><div><Small>Status</Small><span>{s.installed!=='placed'?(s.unidentifiedLocal?'Install state unknown':s.installed==='recorded'?'Installed · not on this machine':'Not installed'):s.onDiskOnly?(off?'Disabled':'Installed · on this machine'):s.flags.includes('broken')?'Installed · needs attention':!capabilities?.disablePerMachine?'Installed':s.enabled?'Enabled':'Disabled'}</span><Small>{s.installed!=='placed'?(s.unidentifiedLocal?`A folder named ${s.name} sits in ${s.unidentifiedLocal.pathLabel}, and this terum-skills version cannot tell whether it is this team skill. Relaunch the app with \`npx -y terum-skills@latest app\` to check.`:s.installed==='recorded'?'In your people file · reinstall to place it here':'Install to load it in sessions'):s.flags.includes('bundled')?`${off?'Not loaded · ':''}Placed by terum-skills setup · ${s.pathLabel}`:s.onDiskOnly?`${off?'Not loaded · ':''}This copy is yours, not placed by Terum · ${s.pathLabel}`:s.flags.includes('broken')?s.flagText.broken??s.indicators.broken.text:!capabilities?.disablePerMachine||s.enabled?'Loaded in every session':'On disk, not loaded'}</Small></div>{s.installed==='placed'&&capabilities?.disablePerMachine?<Switch aria-label="Enable skill" checked={s.enabled} onCheckedChange={onEnable}/>:null}</div>{toggleError?<span role="alert">{toggleError}</span>:null}{s.installed==='placed'&&s.path!==null&&s.onDiskOnly&&manageActions.length?<Menu><MenuTrigger render={<Button/>}>Manage with Terum…<Icon name="chevron-down" size={12}/></MenuTrigger><MenuPopup>{manageActions.map(action=><MenuItem key={action.key} disabled={action.to===null} title={action.reason??undefined} onClick={()=>onAction(action)}>{action.label}{action.reason?<span className="menu-item-reason">{action.reason}</span>:null}</MenuItem>)}</MenuPopup></Menu>:null}<div className="board-column" style={{gap:4}}><SectionLabel>Details</SectionLabel><div>{[['Scope',s.scope??'—'],['Version',s.version],['Files',s.files===null?'—':String(s.files.length)],['Size',s.size_bytes],['Context',s.size],['Installs',String(s.installs_n)]].map(([label,value])=><div className="detail-row" key={label}><span>{label}</span>{label==='Version'?<CopyValue what="version" className="board-mono">{value}</CopyValue>:<span>{value}</span>}</div>)}</div></div><div className="board-column" style={{gap:6}}><SectionLabel>Repo</SectionLabel><div className="board-column detail-repo">{url?<a href={url} onClick={event=>{event.preventDefault();void backend.openUrl(url).then(result=>{if(!result.ok)setError(result.error);},reason=>setError(String(reason)));}}>{s.repo}</a>:null}{error?<span role="alert">{error}</span>:null}<span>{s.repoPath}</span></div></div><div className="board-column" style={{gap:8}}><SectionLabel>Author</SectionLabel><Author skill={s}/></div><div className="board-column" style={{gap:4}}><SectionLabel>Evaluated</SectionLabel><span style={{fontSize:13}}>{rc?`${rc.when} · by ${rc.runner}`:'Never'}</span>{rc?<Small>{rc.model} · agent CLI {rc.cc} · k={rc.k}</Small>:null}</div><div style={{flexGrow:1}}/><ShareBlock command={s.shareCommand}/></aside>;}
/** True when the viewer is one of the installers listed on this skill. */
function viewerInstalled(s:Pick<SkillDetail,'viewerHandle'|'users'>):boolean{return s.viewerHandle!==null&&s.users.some(([handle])=>handle===s.viewerHandle);}
/** One string for the facepile label and the popover header. `installs_n` counts people and
 *  includes the viewer, so the viewer is named rather than counted among the teammates; the
 *  team-wide number itself is unchanged, since the marketplace compares it across viewers. */
function installedByLabel(installsN:number,you:boolean):string{
 if(installsN===0)return 'Nobody has installed this yet';
 const others=you?installsN-1:installsN,teammates=`${others} teammate${others===1?'':'s'}`;
 return you?others?`Installed by you and ${teammates}`:'Installed by you':`Installed by ${teammates}`;
}
function UsesPopover({skill:s}:{skill:SkillDetail}){return <div className="uses-popover"><span>{installedByLabel(s.installs_n,viewerInstalled(s))}</span>{s.users.map(([handle,ini,scope],i)=><div key={handle+':'+i}><Avatar initials={ini??''} size={20}/><span>{handle===s.viewerHandle?'you':handle}</span><Small>{scope}</Small></div>)}{s.installs_n>s.users.length?<span className="uses-foot">and {s.installs_n-s.users.length} more</span>:null}</div>;}
function SkillMd({skill:s,onEdit}:{skill:SkillDetail;onEdit:()=>void}){return <div className="skill-md-tab"><div className="skill-md-meta"><Small>{s.files===null?'SKILL.md':s.files[0]}{s.lines===null?'':` · ${s.lines} lines`}{s.size==='—'?null:<> · {s.size}</>} · read from {s.skillMd.markdown!==undefined?(s.installed==='placed'?s.pathLabel:`the team repo clone · ${s.repo??'—'}`):s.installed==='placed'?`~/.claude/skills/${s.name}`:`the team repo clone · ${s.repo??'—'}`}</Small>{s.installed==='placed'&&s.path!==null?<Button kind="ghost" icon="arrow-up-right" height={24} onClick={onEdit}>Open in editor</Button>:null}</div><div className="skill-md-blocks" role="region" aria-label="SKILL.md" tabIndex={0}><>{s.skillMd.frontmatter?<div className="md-code md-frontmatter" data-testid="frontmatter">{s.skillMd.frontmatter}</div>:null}{s.skillMd.markdown!==undefined&&s.skillMd.markdown!==null?<SkillMarkdown markdown={stripLeadingSkillHeading(s.skillMd.markdown,s.name)}/>:null}</>{s.skillMd.body.map((block,i)=>block.kind==='ol'?<div key={i} className="md-list">{(Array.isArray(block.content)?block.content:[block.content]).map((text,n)=><div key={n}><span>{n+1}.</span><span><RichText text={text}/></span></div>)}</div>:<div key={i} className={'md-'+block.kind}><RichText text={Array.isArray(block.content)?block.content.join('\n'):block.content}/></div>)}</div></div>;}
function Quality({skill:s,onValidate,onFix,fixing=false,validation}:{skill:SkillDetail;onValidate:()=>void;onFix?:(()=>void)|undefined;fixing?:boolean;validation:Result<ValidateResult>|null}){return <div className="quality-tab" role="region" aria-label="Quality" tabIndex={0}><div className="tab-head"><span>{s.hygieneCaption??(s.hygieneStatus===null?'Hygiene checks · not run yet':`Hygiene checks · ${s.hygieneStatus==='pass'?'passed':'failed'} on connect${s.hygieneWhen?', '+s.hygieneWhen:''} · free, no model calls`)}</span><Button icon="check" onClick={onValidate}>Validate</Button></div>{validation?(validation.value?<Small>{validation.ok?`hygiene passed${validation.value.warnings?' · '+plural(validation.value.warnings,'warning'):''}`:`${plural(validation.value.findings,'finding')} · ${plural(validation.value.warnings,'warning')}`}{onFix&&!validation.ok&&validation.value.repairable>0?<> · <Button icon="sparkle" height={22} disabled={fixing} title="Review the repairs with one right answer, then apply them; the rest are listed for you" onClick={onFix}>Fix {plural(validation.value.repairable,'finding')}</Button></>:null}</Small>:!validation.ok?<ErrorLine>{validation.error}</ErrorLine>:null):null}<div className="board-column">{s.hygiene.length===0?<Small>Per-check results are not reported by this terum-skills version.</Small>:null}{s.hygiene.map(([name,detail,status])=><div key={name} className="hygiene-row"><Icon name={status==='pass'?'check-circle':'alert'} size={16} stroke="1.75" color={token(status==='pass'?'good':status==='warn'?'warn':'bad')}/><span>{name}</span><span>{detail}</span><span style={{color:token(status==='pass'?'text3':status==='warn'?'warn':'bad')}}>{status==='pass'?'passed':status==='warn'?'warning':'failed'}</span></div>)}</div><div className="board-column" style={{gap:8}}><SectionLabel>Tool grants</SectionLabel><div style={{display:'flex',alignItems:'center',gap:12}}><div style={{display:'flex',gap:6}}>{(s.grants??[]).map(g=><Chip key={g}>{g}</Chip>)}</div>{s.grants?.length===0?<Small>No tool grants requested</Small>:<Small>{s.grants_approved}</Small>}</div></div><TerminalHint command={'npx -y terum-skills@latest validate '+s.name} prefix="Runs on connect, publish, sync and in CI"/></div>;}
/** The Activity tab (build spec §6, decision D6 2026-09-15; redrawn 2026-09-27 around a year of days).
 *
 *  It draws live firings and ONLY those. The activity feed the canvas draws — "kai installed
 *  to Terum · 7 days ago" — is not built and its data path does not exist; `s.activity` has been an
 *  empty array on every backend since the tab was added. Shipping firings here rather than the feed
 *  is ajay's call, recorded as D6, and FIDELITY.md carries the canvas deviation.
 *
 *  It reads the machine's `usage` window (the Library's Activation tile reads the same query) and the
 *  longer read behind it (lib/activation.ts `historyDays`, shared with every skill page and the
 *  Library popup), and draws, in order: four figures for the window; the one note the firings raise,
 *  if any; the year as GitHub draws one, the window bracketed under it; what happened since
 *  placement beside the prompts it should have caught; and the CLI's caveats verbatim. The note is a
 *  ladder (`skillNote`), so these outcomes can never collapse into one "no data" line:
 *    firings === null      nothing observed and no ledger row: NOT a claim that it is uninstalled
 *    d1 + d2 === 0         placed here and never fired -- the interesting case
 *    d1 === 0              used, but the model never chose it -- the reason this feature exists */
function Activity({skill:s,window:days,onWindow}:{skill:SkillDetail;window:UsageWindow;onWindow:(days:UsageWindow)=>void}){
 const backend=useBackend(),features=useFeatures(),supported=features?.usage===true,misses=useMissScreening();
 const read=(span:number)=>async({signal}:{signal:AbortSignal})=>{const r=await backend.usage({days:span},{signal});if(!r.ok)throw new Error(r.error);return r.value;};
 const current=useQuery({queryKey:['usage',days],enabled:supported,queryFn:read(days)});
 const older=useQuery({queryKey:['usage',historyDays(days)],enabled:supported,queryFn:read(historyDays(days))});
 const phrase=windowPhrase(days),mine=misses.model?.groups.find(g=>g.skill===s.name)?.candidates??[];
 const body=():React.ReactNode=>{
  if(!supported)return <Small>This terum-skills version cannot report skill firings. Update it to see them here.</Small>;
  if(current.isPending||older.isPending)return <div className="board-column" style={{gap:12}}><BoardSkeleton width="100%" height={88} radius={8}/><BoardSkeleton width="100%" height={150} radius={6}/></div>;
  const failure=current.error??older.error;
  if(failure||current.data===undefined||older.data===undefined)return <ErrorLine>{failure instanceof Error?failure.message:String(failure??'Could not read skill firings.')}</ErrorLine>;
  const report=current.data,h=history(report,older.data);
  // A CLI that predates per-day buckets still counts: the figures draw, the calendar says why it cannot.
  if(h===null){const firings=skillUsage(report,s.name).firings;return <><div className="activity-stats"><Figure label="Firings" value={firings===null?'—':firings.d1+firings.d2}>{firings!==null?<Small>{firings.d1} by the model · {firings.d2} by name</Small>:null}</Figure></div><Small>Per-day firings need terum-skills 0.24 or newer. Update it to see the calendar; the counts above still come from this version.</Small><div className="activity-caveats">{report.caveats.map(line=><Small key={line}>{line}</Small>)}</div></>;}
  const a=skillActivity(h,report,s.name),calendar=yearCalendar(h,report,s.name);
  const windowStart=h.days[h.start]!,inWindow=misses.model===null?null:mine.filter(c=>localDay(c.ts)>=windowStart).length;
  const note=skillNote(a,s.summary,days,inWindow),delta=a.previous===null?null:a.total-a.previous;
  return <>
   <div className="activity-stats">
    <Figure label="Firings" value={<>{a.firings===null?'—':a.total}{delta!==null&&a.firings!==null?<span className="activity-delta" data-trend={delta>0?'up':delta<0?'down':'flat'} title={`${a.total} in ${phrase.current} · ${a.previous} in ${phrase.previous}`}>{delta>0?`↑${delta}`:delta<0?`↓${-delta}`:'same'}</span>:null}</>}>
     <div className="activity-meter" role="img" aria-label={`${a.d1} chosen by the model, ${a.d2} by name`}>{a.total>0?<><span style={{flexGrow:a.d1,background:'var(--tk-accent)'}}/><span style={{flexGrow:a.d2,background:'color-mix(in srgb,var(--tk-accent) 45%,var(--tk-bg4))'}}/></>:<span style={{flexGrow:1,background:'var(--tk-bg4)'}}/>}</div>
     <Small>{a.d1} by the model · {a.d2} by name</Small>
    </Figure>
    <Figure label="Active days" value={<>{a.activeDays}<small>of {a.days}</small></>}><Small>Days with at least one firing</Small></Figure>
    <Figure label="Longest streak" value={a.streak===null?'—':<>{a.streak.length}<small>{a.streak.length===1?'day':'days'}</small></>}><Small>{a.streak===null?`No firing in ${phrase.current}`:dayRangeLabel(a.streak.from,a.streak.to)}</Small></Figure>
    <Figure label="Last fired" value={a.lastFired===null?'—':capitalise(daysAgoLabel(report.until,a.lastFired))}><Small>{a.lastFired===null?`None on record since ${fullDayLabel(a.recordFrom)}`:dayLabel(a.lastFired)+(a.lastFired<windowStart?' · before this window':'')}</Small></Figure>
   </div>
   {note!==null?<div className="activity-note" data-tone={note.tone} role="status"><i aria-hidden="true"/><div><b>{note.title}</b>{note.body?<span>{note.body}</span>:null}</div></div>:null}
   <div className="activity-block">
    <SectionLabel trailing={<Small>Each square is a day</Small>}>{calendar.total>0?`${plural(calendar.total,'firing')} in the last year`:'No firings in the last year'}</SectionLabel>
    <YearHeatmap model={calendar} skill={s.name} bracket={days===365?null:`${capitalise(phrase.current)} · ${plural(a.total,'firing')}`}/>
   </div>
   <div className="activity-pair">
    <SincePlacement activity={a} until={report.until}/>
    <Misses skill={s} screening={misses} candidates={mine}/>
   </div>
   <div className="activity-caveats">{report.caveats.map(line=><Small key={line}>{line}</Small>)}</div>
  </>;
 };
 return <div className="activity-tab" role="region" aria-label="Activity" tabIndex={0}>
  <SectionLabel trailing={<WindowPicker value={days} onChange={onWindow}/>}>Activation</SectionLabel>
  {body()}
  {/* The screening stands on its own when the firings cannot be read: it answers a different question. */}
  {supported&&(current.isError||older.isError)?<Misses skill={s} screening={misses} candidates={mine}/>:null}
 </div>;
}
const capitalise=(text:string):string=>text.replace(/^./,c=>c.toUpperCase());
/** One of the tab's four figures: a label, the number, and what qualifies it. */
function Figure({label,value,children}:{label:string;value:ReactNode;children?:ReactNode}){return <div className="activity-stat"><span>{label}</span><span className="activity-stat-value">{value}</span>{children}</div>;}
/**
 * What happened from the day Terum placed the skill, as far back as the record reaches: the
 * placement (ledger evidence, never guessed — a copy Terum did not place has no date), the first and
 * last firing, and the busiest week. When the placement predates the record, the earliest firing is
 * named as the earliest on record rather than as the first.
 */
function SincePlacement({activity:a,until}:{activity:SkillActivity;until:string}){
 const withinRecord=a.placedAt!==null&&a.placedAt>a.recordFrom;
 const rows:[string,ReactNode,string][]=[];
 if(a.firings!==null&&!a.firings.placed)rows.push(['Placement','Not placed by Terum','Terum did not place this copy, so how long it has been available is unknown']);
 else if(a.firings===null&&a.placedAt===null)rows.push(['Placement','—','No Terum placement recorded']);
 else if(a.placedAt===null)rows.push(['Placed','Undated','Placed by Terum; the ledger records no placement date']);
 else rows.push(['Placed',fullDayLabel(a.placedAt),capitalise(daysAgoLabel(until,a.placedAt))]);
 if(a.firstFired!==null){const after=withinRecord?Math.round((parseDay(a.firstFired).getTime()-parseDay(a.placedAt!).getTime())/86_400_000):null;rows.push(['First fired',fullDayLabel(a.firstFired),after===null?`Earliest on record, since ${fullDayLabel(a.recordFrom)}`:after===0?'The day it was placed':`${plural(after,'day')} after placing`]);}
 else rows.push(['First fired',withinRecord?'Not yet':'—',withinRecord?`${capitalise(daysAgoLabel(until,a.placedAt!).replace(' ago',''))} since placing`:`None on record since ${fullDayLabel(a.recordFrom)}`]);
 if(a.busiestWeek!==null)rows.push(['Busiest week',plural(a.busiestWeek.total,'firing'),dayRangeLabel(a.busiestWeek.from,a.busiestWeek.to)]);
 if(a.lastFired!==null)rows.push(['Last fired',fullDayLabel(a.lastFired),`${capitalise(daysAgoLabel(until,a.lastFired))} · ${plural(a.onRecord,'firing')} ${withinRecord?'since placing':'on record'}`]);
 return <div className="activity-block" role="region" aria-label="Since placement">
  <SectionLabel trailing={<Small>{withinRecord?'All time':`On record since ${fullDayLabel(a.recordFrom)}`}</Small>}>Since placement</SectionLabel>
  <div className="activity-list">{rows.map(([label,value,sub])=><div key={label}><span>{label}</span><span>{value}</span><span>{sub}</span></div>)}</div>
 </div>;
}

/**
 * Misfires -- the question the figures above cannot answer.
 *
 * A 0/0 skill is ambiguous: nobody needed it, or it was needed and passed over. Screening asks a
 * model which skills *should* have been selected for prompts that really happened.
 *
 * **This deliberately does not use `useQuery`.** Every other panel on this tab reads on mount;
 * this one SPENDS MODEL CALLS (about one per ten prompts), so it runs only from the button, and
 * `misses.test.tsx` pins that it makes no call until clicked. The backend types it as `Run`, not
 * `Promise<Result>`, so it cannot be dropped into a query by accident. The screening itself lives in
 * one hook shared with the Library's Activation popup, so a run started on either surface draws
 * both, and neither can start one on mount.
 */
function Misses({skill:s,screening:{supported,model,busy,error,screen},candidates}:{skill:SkillDetail;screening:{supported:boolean;model:MissesModel|null;busy:boolean;error:string|null;screen:()=>Promise<void>};candidates:MissesModel['groups'][number]['candidates']}){
 if(!supported)return null;
 const shown=[...candidates].sort((a,b)=>b.ts.localeCompare(a.ts)).slice(0,4);
 return <div className="activity-block" role="region" aria-label="Misfires">
  <SectionLabel trailing={<Small>{model===null?'Not screened yet':`${plural(candidates.length,'prompt')} · screened ${dayRangeLabel(localDay(model.since),localDay(model.until))}`}</Small>}>Misfires</SectionLabel>
  {model===null&&!busy&&error===null?<Small>Ask a model which recent prompts {s.name} should have fired on and did not. Screens every skill at once — about one model call per ten prompts — and the result serves every skill page.</Small>:null}
  {error!==null?<ErrorLine>{error}</ErrorLine>:null}
  {model!==null?(candidates.length===0
   ?<Small>Nothing worth reviewing — no screened prompt looked like it needed this skill.</Small>
   :<div className="activity-misfire-list">
     {shown.map(c=><div key={c.ts+c.prompt} className="activity-misfire"><span>{shortDayLabel(localDay(c.ts))}</span><span>“{c.prompt}”</span>{c.noPriorContext?<Chip>No prior context</Chip>:<span/>}</div>)}
     {candidates.length>shown.length?<div className="activity-misfire"><span/><span className="board-small">{plural(candidates.length-shown.length,'more prompt')}</span><span/></div>:null}
    </div>):null}
  <div className="activity-misfires-foot">
   <div>{model!==null?<>{model.caveats.map(line=><Small key={line}>{line}</Small>)}{model.truncated?<Small>More candidates were found than shown.</Small>:null}{model.unjudged>0?<Small>{plural(model.unjudged,'prompt')} could not be judged; they count in neither direction.</Small>:null}</>:null}</div>
   <Button icon="sparkle" disabled={busy} title="Spends about one model call per ten prompts" onClick={()=>void screen()}>{busy?'Screening…':model===null?'Screen for misses':'Screen again'}</Button>
  </div>
 </div>;
}
// 2026-09-14: Quality and Activity were hidden together behind one constant. D6 (2026-09-15) split
// them: Activity ships with live firing counts, Quality stays hidden because its readiness is not
// this feature's call to make — the 12 tests skipped for it stay skipped and stay pointed here.
const ACTIVITY_SHIPPED=true;
const QUALITY_SHIPPED=false;
/** The placeholder both unshipped tabs render. Keeps each pane's class, name and tabIndex so the tab
    is still the focusable named region `pane-focus.test.tsx` pins. */
function ComingSoon({label}:{label:'Quality'|'Activity'}){return <div className={label==='Quality'?'quality-tab':'activity-tab'} role="region" aria-label={label} tabIndex={0}><CenteredState icon="info" title="Coming soon" body={label==='Quality'?'Hygiene checks and tool grants for this skill will land on this tab.':'Installs, publishes and eval runs for this skill will land on this tab.'}/></div>;}
function SkeletonLine({width,height=10,box=16}:{width:number|string;height?:number;box?:number}){return <div style={{height:box,display:'flex',alignItems:'center'}}><BoardSkeleton width={width} height={height}/></div>;}
/** Rev 20: the Quality group is a count plus pips (ScoreRow's CaseRunGroup, width 290), not a second bar group. */
function CaseRunGroupSkeleton(){return <div className="score-bar-group" style={{width:290}}><SkeletonLine width={190} height={12} box={18}/>{[0,1].map(i=><div key={i} style={{display:'flex',alignItems:'center',gap:10,height:18}}><div style={{width:62,flexShrink:0}}><BoardSkeleton width={40} height={10}/></div><BoardSkeleton width={96} height={12}/><div style={{display:'flex',justifyContent:'flex-end',flexGrow:1}}><BoardSkeleton width={44} height={6} radius={2}/></div></div>)}</div>;}
function BarGroupSkeleton(){return <div className="score-bar-group" style={{width:240}}><SkeletonLine width={160} height={12} box={18}/>{[0,1].map(i=><div key={i} style={{display:'flex',alignItems:'center',gap:10,height:18}}><div style={{width:62,flexShrink:0}}><BoardSkeleton width={40} height={10}/></div><div style={{width:84}}><BoardSkeleton width="100%" height={6} radius={3}/></div><div style={{display:'flex',justifyContent:'flex-end',width:74}}><BoardSkeleton width={48} height={10}/></div></div>)}</div>;}
function DetailRailSkeleton(){return <aside className="detail-rail"><div className="detail-status"><div style={{gap:6}}><BoardSkeleton width={40} height={10}/><BoardSkeleton width={64} height={14}/></div><BoardSkeleton width={26} height={16} radius={8}/></div><div className="board-column" style={{gap:4}}><SectionLabel><BoardSkeleton width={44} height={10}/></SectionLabel><div>{Array.from({length:6},(_,i)=><div className="detail-row" key={i}><BoardSkeleton width={48} height={10}/><BoardSkeleton width={64} height={12}/></div>)}</div></div><div className="board-column" style={{gap:6}}><SectionLabel><BoardSkeleton width={30} height={10}/></SectionLabel><div className="board-column" style={{gap:2}}><SkeletonLine width={120}/><SkeletonLine width={150}/></div></div><div className="board-column" style={{gap:8}}><SectionLabel><BoardSkeleton width={42} height={10}/></SectionLabel><div style={{display:'flex',alignItems:'center',gap:10}}><BoardSkeleton width={28} height={28} radius={14}/><div className="board-column" style={{gap:5}}><BoardSkeleton width={80} height={12}/><BoardSkeleton width={110} height={10}/></div></div></div><div className="board-column" style={{gap:4}}><SectionLabel><BoardSkeleton width={58} height={10}/></SectionLabel><SkeletonLine width={140} height={12} box={18}/><SkeletonLine width={180}/></div><div style={{flexGrow:1}}/><div className="board-column" style={{gap:6}}><SectionLabel><BoardSkeleton width={84} height={10}/></SectionLabel><BoardSkeleton width="100%" height={32} radius={6}/></div></aside>;}
function DetailSkeleton(){return <div className="detail-body"><div className="detail-main"><div className="detail-head"><div className="detail-ident"><SkeletonLine width={220} height={28} box={30}/><div>{[560,600,480].map(w=><SkeletonLine key={w} width={w} height={12} box={20}/>)}</div></div><div className="detail-actions">{[56,68,28].map(w=><BoardSkeleton key={w} width={w} height={28} radius={6}/>)}</div></div><div className="score-row"><div className="board-column" style={{width:104,gap:6}}><BoardSkeleton width={72} height={34}/><BoardSkeleton width={48} height={20}/></div><BarGroupSkeleton/><CaseRunGroupSkeleton/><div className="score-bar-group" style={{width:170}}>{[104,150,120].map((w,i)=><SkeletonLine key={w} width={w} height={i===2?10:12} box={18}/>)}</div></div><div className="skill-tabs">{[97,57,71,76].map(w=><BoardSkeleton key={w} width={w} height={12}/>)}</div><div className="board-column" style={{gap:10,paddingTop:12}}><BoardSkeleton width={680} height={96} radius={6}/><BoardSkeleton width={120} height={14}/><BoardSkeleton width={620} height={12}/><BoardSkeleton width={560} height={12}/></div></div><DetailRailSkeleton/></div>;}
/** Where a placed copy can move to: every install scope except the one it already sits in. */
/** The uninstall argument naming the scope a placed copy is removed from. A read the backend
 *  anchored to one root already knows the absolute destination, so its id is used verbatim: the
 *  label map deliberately drops a label two checkouts share (tauri/index.ts:195), which would leave
 *  the CLI asking which copy to delete (src/commands/uninstall.ts:107-110). `--from` takes exactly
 *  `global` or an absolute checkout root (src/commands/uninstall.ts:96). */
function removeFrom(s:SkillDetail):{from?:string}{if(s.owningRoot)return {from:s.owningRoot.id==='Global'?'global':s.owningRoot.id};if(s.scope==='Global')return {from:'global'};const path=s.scope?s.installScopePaths?.[s.scope]:undefined;return path?{from:path}:{};}
/** The Library list this page belongs to: the root the backend resolved, else the root the URL
 *  named, else Global. Every back-link on the page uses it, so an error board returns the reader to
 *  the list they came from instead of dropping them in Global. */
function libraryPath(id:string|null|undefined):string{return !id||id==='Global'||id==='global'?'/library/global':'/library/checkout?root='+encodeURIComponent(id);}
/** The header trail, with the crumb that carries the category marked. That crumb is this page's way
 *  into `skill category`: it is where the category is already shown, and only a folder the team has
 *  never seen may be rewritten here — a published category lives inside an immutable version. */
function crumbs(rootLabel:string,s:SkillDetail|undefined,fallback:string):{text:string;category:boolean}[]{
 const group=s?.team??s?.project;
 return [{text:rootLabel,category:false},{text:group===rootLabel?null:group,category:false},{text:s?.category,category:true},{text:s?.name??fallback,category:false}]
  .filter((part):part is {text:string;category:boolean}=>!!part.text&&part.text!=='—');
}
/** Every dialog's wording in one place, so the card menu and the detail page cannot drift. */
function dialogCopy(kind:string,s:SkillDetail,{installScope}:{installScope:boolean}):{title:string;description:string;command:string;confirm:string;danger:boolean}{
 const latest = s.latestVersion === null ? null : parseVersionFolder(s.latestVersion);
 if(kind==='install')return {title:`Install ${s.name}`,description:`Copies the team's current version (${latest===null?s.version:versionLabel(latest)}) into ${installScope&&s.installScopes.length?'the scope you pick below':'Global'} and records the install in your people file. If a copy already exists there, replacement asks first and keeps it in that root's .claude/old-skills folder. Your profile changes only if you say yes.`,command:`npx -y terum-skills@latest install ${s.skillRef}`,confirm:'Install',danger:false};

 if(kind==='publish')return {title:`Publish ${s.name} to the team?`,description:'Copies this folder into the team repository as its next immutable version, so teammates can install it. An existing version is never changed; publishing identical bytes mints nothing.',command:`npx -y terum-skills@latest publish ${s.name}`,confirm:'Publish',danger:false};
 if(kind==='unpublish')return {title:`Unpublish ${s.name} from the team?`,description:`Removes every version of ${s.name} from the team marketplace, along with the eval assets and receipts attached to them, and drops it from every project list and member profile. Anyone in the team can do this and it cannot be undone from the app. Teammates keep any copy they already installed until they sync, which then reports it as removed from the team.`,command:`npx -y terum-skills@latest unpublish ${s.name}`,confirm:'Unpublish',danger:true};
 return {title:`Remove ${s.name}?`,description:`${s.skillMd.markdown!==undefined?`${s.scope==='Global'?'':`Remove from ${s.scope}. `}Its files leave ${s.pathLabel}`:s.scope==='Global'?'Its files leave ~/.claude/skills':`Remove from ${s.scope}. Its files leave ${s.pathLabel}`} on this machine and your people file stops listing it. Your profile is unchanged.`,command:`npx -y terum-skills@latest uninstall-skill ${s.skillRef}`,confirm:'Remove',danger:true};
}
function SkillPage(){const evalRun=useEvalRun(),publishRun=usePublishRun(),queryClient=useQueryClient();
 // The D6 file dialogs' workflow lives here so a cancelled/refused outcome outlives the dialog (SkillFileDialog.tsx). The page is keyed per skill, so it resets on navigation.
 const fileAction=useWorkflow(),toggle=useWorkflow();const [validation,setValidation]=useState<Result<ValidateResult>|null>(null);const {ref=''}=useParams(),state=useUrlState(),backend=useBackend(),features=useFeatures(),navigate=useNavigate(),[params,setParams]=useSearchParams(),print=useContext(PrintContext),unexpected=useContext(PromptContext);const [actionError,setActionError]=useState<string|null>(null),[publishError,setPublishError]=useState<string|null>(null),[ownRun,setOwnRun]=useState<number|null>(null),[busy,setBusy]=useState(false),[progressLabel,setProgressLabel]=useState<string|null>(null),[scope,setScope]=useState('Global'),[targetChoice,setTargetChoice]=useState<string|null>(null),[categoryChoice,setCategoryChoice]=useState(''),publishDefaults=usePublishDefaults(),[notice,setNotice]=useState<{text:string;url:string|null}|null>(null),[preferences,setPreferences]=useState<{enabled?:boolean;favorite?:boolean}>({}),[toggleError,setToggleError]=useState<string|null>(null);const activeRun=useRef<Run<unknown>|null>(null),alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;const run=activeRun.current;activeRun.current=null;void run?.cancel();};},[]);
 // react-router's setter (even its functional form) reads the params of the render that made it, so a continuation that
 // fires seconds later must use the newest one or it would put back the URL as it was when the run started.
 const latestSetParams=useRef(setParams);useEffect(()=>{latestSetParams.current=setParams;});
 const localPath=ref==='local'?params.get('path'):null;
 // ?root= carries the origin: the literal 'marketplace', or the checkout root the sidebar and the
 // Library already use (routes.tsx:21-22). Root membership itself is the backend's answer, never a
 // prefix test in this screen — that test was POSIX-only and reported Global on every Windows path.
 const originRoot=params.get('root'),scopeRoot=originRoot!==null&&originRoot!=='marketplace'?originRoot:null;
 const at=scopeRoot===null?undefined:scopeRoot==='global'?{kind:'global' as const}:{kind:'checkout' as const,root:scopeRoot};
 const query=useQuery({queryKey:['skill',localPath!==null?'local:'+localPath:ref,scopeRoot??'',state.mock],queryFn:({signal})=>localPath!==null?backend.localSkill({path:localPath},{signal}):backend.skill({ref,...(at?{at}:{})},{signal})});const raw=query.data?.ok?query.data.value:undefined,s=raw?{...raw,...preferences}:undefined,readError=query.data?.ok===false?query.data.error:query.isError?query.error.message:null,loading=query.isPending&&!readError,tab=tabs.some(t=>t[0]===state.tab)?state.tab:'skill',dialog=['install','remove','run-eval','head-to-head','file-move','file-copy','file-rename','file-delete','publish','unpublish','fix','category'].includes(state.dialog??'')?(!raw?.teamed&&state.dialog==='remove'?'file-delete':state.dialog):null,rail=state.railOpen&&!readError;
 // Right-click the name (2026-09-14): copy it, its folder path or the install command; reveal or open the folder.
 const clipboard=useCopy(),reveal=useHostReveal(),pageCapabilities=useCapabilities(),titleMenu=useContextMenu(()=>{if(!s)return [];const rows:ContextMenuItem[]=[{key:'name',label:'Copy name',icon:'copy',onSelect:()=>void clipboard(s.name,'name')},{key:'cmd',label:'Copy install command',icon:'terminal',onSelect:()=>void clipboard(s.shareCommand,'command')}];if(s.path){const path=s.path;rows.push({key:'sep',kind:'separator'},{key:'path',label:'Copy path',icon:'copy',onSelect:()=>void clipboard(path,'path')},{key:'reveal',label:reveal,icon:'folder',onSelect:()=>void backend.revealPath(path).then(result=>{if(!result.ok)setActionError(result.error);},reason=>setActionError(String(reason)))});if(pageCapabilities?.openInEditor)rows.push({key:'editor',label:'Open in editor',icon:'arrow-up-right',onSelect:()=>void edit()});}return rows;});const marketplace=originRoot==='marketplace'||s?.root==='Marketplace';const rootLabel=marketplace?'Marketplace':s?.owningRoot?.label??s?.root??'Global';const selected=marketplace?undefined:s?.owningRoot?.id??(scopeRoot==='global'?'Global':scopeRoot)??(localPath!==null?'Global':undefined);const backTo=marketplace?'/marketplace':libraryPath(s?.owningRoot?.id??scopeRoot);
 function param(key:string,value:string|null){const next=new URLSearchParams(params);if(value)next.set(key,value);else next.delete(key);setParams(next);}
 // EV-20 (amended 2026-09-14, Ryan): `?run=<run-id>` opens that History row's own receipt, so a prior
 // run can be read instead of only seen. An id no row carries a receipt for is ignored rather than
 // reported — a stale link falls back to the latest run for this version, which is what the page
 // shows on its own. Clicking the open row again closes it.
 const openRun=s?.history.find(h=>h.runId!==undefined&&h.runId===state.run&&h.report!==undefined)??null;
 function selectRun(runId:string){param('run',openRun?.runId===runId?null:runId);}
 function savePref(key:'favorite',value:boolean){try{backend.prefs.set(key+':'+(s?.name??ref),value);setPreferences(p=>({...p,[key]:value}));}catch(e){setActionError(e instanceof Error?e.message:'Could not save preference.');}}
 // The rail switch IS Claude Code's skillOverrides (skill enable|disable); the optimistic value holds until the refetch brings the CLI's answer back.
 function setSkillEnabled(value:boolean){const path=s?.path;if(!path){setToggleError('This skill has no folder on this machine to switch.');return;}setToggleError(null);setPreferences(p=>({...p,enabled:value}));void toggle.run(()=>backend.setSkillEnabled({path,enabled:value}),{},()=>{void Promise.all([queryClient.invalidateQueries({queryKey:['skill']}),queryClient.invalidateQueries({queryKey:['library']})]).then(()=>setPreferences(p=>{const next={...p};delete next.enabled;return next;}));}).then(result=>{if(!result||!result.ok)setPreferences(p=>{const next={...p};delete next.enabled;return next;});});}
 async function edit(){if(!s||s.path===null)return;try{const result=await backend.openInEditor(s.path);if(!result.ok)setActionError(result.error);}catch(e){setActionError(e instanceof Error?e.message:'Could not open editor.');}}
 // The by-path page is about a folder, and the CLI validates a folder given an absolute path
 // (src/commands/validate.ts:30-35). The name route keeps validating the team's copy — s.path is
 // non-null for an installed team skill too, and switching that would silently disagree with the
 // hygiene caption and the TerminalHint on the same tab. Invalidate the key PREFIX so every ?root=
 // variant of this skill refreshes, including the by-path key the old call could never reach.
 async function validate(){const target=localPath!==null?(s?.path??ref):(s?.name??ref);try{const result=await backend.validate({ref:target,...(s?.team?{team:s.team}:{})});setValidation(result);if(result.ok)void queryClient.invalidateQueries({queryKey:['skill',localPath!==null?'local:'+localPath:ref]});}catch(e){setValidation({ok:false,error:e instanceof Error?e.message:'Validation failed.'});}}
 function closeDialog(){void activeRun.current?.cancel();activeRun.current=null;setBusy(false);setProgressLabel(null);param('dialog',null);}
 function publish(){
  if(!s)return;
  if(publishError!==null)setPublishError(null);setActionError(null);setNotice(null);
  // D4: this dialog IS the board while the page is up, so the run starts without raising the app-level
  // one and the dialog stays open, showing the CLI step exactly as install and remove do.
  try{
   const started=publishRun.start({cards:[s],origin:'skill',flags:publishFlags(publishTarget,categoryChoice),...(s.team===null?{}:{team:s.team}),openBoard:false});
   setOwnRun(started.startedAt);
   // The same continuation the page ran after `driveRun` before the host existed: the outcome sentence or the CLI's
   // failure on the page's own boards, and the dialog (publish, or fix-and-republish) standing down. Only while this
   // page instance is still up — a page the person left keeps nothing, the chip carries the run (§2.5).
   void started.settled.then(final=>{
    if(!alive.current)return;
    publishRun.acknowledge(final.startedAt);
    const row=final.rows[0];
    if(row?.state.kind==='done')setNotice({text:row.state.text,url:null});
    else if(row?.state.kind==='failed')setActionError(row.state.error);
    latestSetParams.current(previous=>{const next=new URLSearchParams(previous);if(next.get('dialog')==='publish'||next.get('dialog')==='fix')next.delete('dialog');return next;});
   });
  }
  catch(error){setPublishError(error instanceof Error?error.message:String(error));}
 }
 async function execute(kind:string){if(kind==='publish'){publish();return;}if(busy||activeRun.current)return;setBusy(true);setProgressLabel(null);try{const run=kind==='install'?backend.install({ref,scope:features?.installScope?scope:'Global',...(s?.team?{team:s.team}:{})}):kind==='unpublish'?backend.unpublish({ref:s!.name,...(s?.team?{team:s.team}:{})}):kind==='remove'?backend.uninstallSkill({ref:localPath!==null?s!.name:ref,...(s?.team?{team:s.team}:{}),...(localPath!==null?{}:removeFrom(s!))}):backend.sync({... (s?.team?{team:s.team}:{})});activeRun.current=run;const result=await driveRun<unknown>(run,{[`Remove ${localPath!==null?s!.name:ref}?`]:true},unexpected,print,frame=>setProgressLabel(frame.label??null));if(activeRun.current!==run)return;activeRun.current=null;setBusy(false);setProgressLabel(null);if(!result.ok){setActionError(result.error);param('dialog',null);return;}if(kind==='remove'||kind==='unpublish')navigate(backTo);else if(kind==='install')navigate('/skill/'+encodeURIComponent(ref)+(marketplace?'?root=marketplace':scopeRoot!==null?'?root='+encodeURIComponent(scopeRoot):''));else if(kind==='sync'){setActionError(null);void query.refetch();}else param('dialog',null);}catch(e){activeRun.current=null;setBusy(false);setProgressLabel(null);setActionError(e instanceof Error?e.message:'Operation failed.');param('dialog',null);}}
 // D4: the single publish this page started, while it is this page's skill. Install and remove keep their
 // confirmation open while the CLI runs; publish does the same, reading the provider instead of page state.
 // Everything a settled run says is DERIVED, never copied into page state by an effect: the outcome
 // sentence, the failure on the page's own error board, and the dialog standing down. A setState in an
 // effect has to dodge either the cascading-render rule or the no-timer-driven-refetch invariant
 // (refresh-policy.test.tsx) — deriving dodges neither because it needs neither. The refetch is not needed
 // either: the provider invalidates every clone-backed read when a version lands, and 'skill' is one
 // (invalidation.ts:6).
 const publishHere=s!==undefined&&publishRun.current!==null&&publishRun.current.rows.length===1&&publishRun.current.rows[0]?.key===(s.path??s.name)?publishRun.current:null;
 const publishBusy=publishHere!==null&&(publishHere.state==='running'||publishHere.state==='stopping');
 const publishSettled=publishHere!==null&&!publishBusy?publishHere.rows[0]:undefined;
 // A run this page started and saw settle stands its dialog down at once; the URL follows a tick later (publish()).
 // `ownRun` is forgotten from the URL, not from the continuation: once no dialog is named, the next `?dialog=publish`
 // is a new request and must open — resetting it before the URL caught up would flash the confirmation back open.
 const publishStoodDown=publishSettled!==undefined&&publishHere!==null&&publishHere.startedAt===ownRun;
 if(ownRun!==null&&dialog!=='publish'&&dialog!=='fix')setOwnRun(null);
 // The finished sentence survives the person leaving and coming back (the run is still on the provider); a failure
 // does not — it lands on the page's error board only while the page is up, exactly as install and remove do.
 const publishDone=publishSettled?.state.kind==='done'&&publishHere!==null&&!publishHere.reported?publishSettled.state.text:null;
 const error=readError;
 const failureReason=query.data?.ok===false?query.data.reason:undefined;
 const copy=dialog&&s?dialogCopy(dialog,s,{installScope:features?.installScope??false}):null;
 const [unpublishTyped,setUnpublishTyped]=useState(''); const publishTarget=targetChoice??publishDefaults.target,publishFlagsNow=publishFlags(publishTarget,categoryChoice),publishCommand=s?`npx -y terum-skills@latest publish ${s.name}${publishFlagsNow.project?` --project ${publishFlagsNow.project}`:''}${publishFlagsNow.category?` --category ${publishFlagsNow.category}`:''}`:'';
 // The rail's “Manage with Terum…” opens the card's own ⋯ menu, so a folder Terum did not place has one
 // list of everything it can do — the page used to offer publish alone (Ryan, 2026-09-14). `open` is
 // dropped: this IS the page it opens.
 // #216 filtered the `open` row out here because the detail page IS that link; the row no longer
 // exists at all (`cardActions`), so there is nothing left to filter.
 const manageActions=s?cardActions(s,{origin:originRoot?'root='+encodeURIComponent(originRoot):'',runEvalInApp:features?.runEvalInApp??false}):[];
 // Every row targets this very page with a dialog (and sometimes a tab) set, so its params are MERGED
 // onto the ones the URL already carries — a bare navigate would drop ?root, ?rail, ?theme and ?__mock.
 function runCardAction(action:CardAction){if(!action.to)return;const [path='',query='']=action.to.split('?');const next=new URLSearchParams(params);for(const [key,value] of new URLSearchParams(query))next.set(key,value);const search=next.toString();navigate(search?path+'?'+search:path);}
 // Every D6 file operation ends where the reader started, delete included (Ajay, 2026-09-14). Move,
 // copy and rename used to follow `destination` to `/skill/local?path=…`, but that page is a by-path
 // read: it answers only once `ls --local` lists the folder again under a registered root, so a
 // successful move could land on "Not in your library" — an error board for work that worked. `backTo`
 // is the list this page was opened from (Library, Marketplace or a project view) and is true of all four.
 function fileActionDone(){navigate(backTo);}
 const actions=s?<div className="detail-actions"><ShareSkillButton key={s.path??s.skillRef} skill={s} {...(at?{scope:at}:{})}/>{features?.favorites&&s.favorites!==null?<Button aria-label="Favorite skill" aria-pressed={s.favorite} onClick={()=>savePref('favorite',!s.favorite)} style={{paddingLeft:8,fontVariantNumeric:'tabular-nums'}}><Icon name="heart" size={14} color={s.favorite?token('bad'):'currentColor'} filled={s.favorite}/>{s.favorites}</Button>:null}{s.installed==='placed'?<>{s.path!==null?<Button icon="pencil" onClick={()=>void edit()}>Edit</Button>:null}{s.placed?<Button icon="trash" iconOnly aria-label={`Remove from ${s.scope}`} state={dialog==='remove'?'pressed':'default'} onClick={()=>param('dialog',s.teamed?'remove':'file-delete')}/>:null}</>:s.unidentifiedLocal?null:<Button kind="primary" icon="arrow-down-to-line" state={dialog==='install'?'pressed':'default'} onClick={()=>param('dialog','install')}>Install</Button>}</div>:null;
 return <Shell counts={loading?null:undefined} selected={selected??rootLabel}><ScreenFrame ready={!query.isPending||state.mock==='loading'}><div className="detail-header"><div><IconButton icon="arrow-left" size={28} label="Back to library" onClick={()=>navigate(backTo)}/>{!loading?<div className="detail-crumbs">{crumbs(rootLabel,s,ref).map((part,i)=><Fragment key={i}>{i?<span className="crumb-separator">/</span>:null}{part.category&&s&&!s.teamed&&s.path?<button type="button" className="crumb-edit" aria-label={`Change category (${part.text})`} title="Change this folder's terum-category in SKILL.md" onClick={()=>param('dialog','category')}>{part.text}</button>:<span>{part.text}</span>}</Fragment>)}</div>:null}</div><IconButton icon="panel-right" size={28} label={rail?'Close details rail':'Open details rail'} onClick={()=>{useUiStore.getState().setRailOpen(!rail);param('rail',rail?'closed':null);}}/></div>{error&&localPath!==null?<div className="detail-body">{query.data?.ok===false&&query.data.reason==='not-in-library'?<CenteredState alert icon="alert" title="Not in your library" body="This folder is not in ~/.claude/skills or a registered checkout, or it no longer holds a SKILL.md. Nothing was deleted; a checkout is forgotten under Settings ▸ This machine ▸ Checkouts." primary="Back to library" onPrimary={()=>navigate(backTo)}><ErrorLine>{error}</ErrorLine></CenteredState>:<CenteredState alert icon="alert" title={"Couldn't read "+(localPath.split(/[\\/]/).filter(Boolean).at(-1)??'')} body="terum-skills could not read this folder. The message below is the CLI's own." primary="Try again" onPrimary={()=>{setActionError(null);void query.refetch();}} secondary="Back to library" onSecondary={()=>navigate(backTo)}><ErrorLine>{error}</ErrorLine></CenteredState>}</div>:error?<div className="detail-body">{failureReason==='no-team'?<CenteredState icon="box" title="No team on this machine" body="Create a team or join the one you were invited to. Setup runs here in the app." primary="Start setup" secondary="Back to library" onPrimary={()=>navigate('/onboarding/boot?start=1')} onSecondary={()=>navigate(backTo)}><TerminalHint command="npx -y terum-skills@latest setup" prefix="From the terminal"/></CenteredState>
 :failureReason==='ambiguous-team'?<CenteredState alert icon="alert" title="Choose a team" body="This machine is configured for more than one team; skills are read one team at a time. Keep the team you want in Settings ▸ Team." primary="Open settings" secondary="Back to library" onPrimary={()=>navigate('/settings/teams')} onSecondary={()=>navigate(backTo)}><ErrorLine>{error}</ErrorLine></CenteredState>
 :failureReason==='ambiguous-ref'?<CenteredState alert icon="alert" title="More than one skill matches" body="This reference is the start of more than one skill ID in your team. Open the one you want from the marketplace, where each skill has its own page." primary="Open marketplace" secondary="Back to library" onPrimary={()=>navigate('/marketplace')} onSecondary={()=>navigate(backTo)}><ErrorLine>{error}</ErrorLine></CenteredState>
 :<CenteredState alert icon="alert" title={(failureReason==='not-found'?"Couldn't find ":"Couldn't read ")+ref} body={failureReason==='not-found'?'No team skill and no folder terum-skills can open carry this name. It may have been renamed, be a symlink, or live in a checkout that is not registered.':failureReason==='unreadable'?'terum-skills could not read the team clone or the skills folder. Check the path in Settings, then try again.':'The skill is listed in your people file but its folder is missing from this machine. Sync to place it again, or remove it from Global.'} primary={failureReason==='not-found'?'Back to library':failureReason==='unreadable'?'Try again':'Sync now'} secondary={failureReason==='not-found'?'Search the marketplace':failureReason==='unreadable'?'Open settings':'Remove from Global'} onPrimary={()=>{if(failureReason==='not-found')navigate(backTo);else if(failureReason==='unreadable')void query.refetch();else void execute('sync');}} onSecondary={()=>{if(failureReason==='not-found')navigate('/marketplace?q='+encodeURIComponent(ref));else if(failureReason==='unreadable')navigate('/settings/account');else void execute('remove');}}><ErrorLine>{error}</ErrorLine></CenteredState>}</div>:loading?<DetailSkeleton/>:s?<div className={'detail-body'+(state.full?' full':'')}><div className="detail-main">{actionError?<AlertText className="board-error-line">{actionError}</AlertText>:null}<div className="detail-head"><div className="detail-ident"><div className="detail-title" ref={titleMenu}><h1 style={{color:token(s.enabled?'text1':'text3')}}>{s.name}</h1><Facepile initials={s.used_by} total={s.installs_n} label={installedByLabel(s.installs_n,viewerInstalled(s))} testId="uses-facepile"><UsesPopover skill={s}/></Facepile></div>{!rail?<Author skill={s} inline/>:null}<span className="detail-description"><RichText text={s.desc_long}/></span>{s.unidentifiedLocal?<div className="detail-flags"><div><Icon name="alert" size={15} color={token('warn')}/><span>Install state unknown · a folder named {s.name} sits in {s.unidentifiedLocal.pathLabel}, and this terum-skills version cannot tell whether it is this team skill.</span></div></div>:null}{fileAction.notice?<div className="detail-flags" role="status"><div><Icon name="alert" size={15} color={token('warn')}/><span>{fileAction.notice}</span></div></div>:null}{notice??publishDone!==null?<div className="detail-flags" role="status"><div><Icon name="check-circle" size={15} color={token('good')}/><span>{notice?.text??publishDone}</span>{notice?.url?<a href={notice.url} onClick={event=>{event.preventDefault();void backend.openUrl(notice!.url!).then(result=>{if(!result.ok)setActionError(result.error);},reason=>setActionError(String(reason)));}}>Open pull request</a>:null}</div></div>:null}{s.flags.length?<div className="detail-flags">{s.flags.map(flag=><div key={flag}><Icon name={flag==='update'?'arrow-up-circle':flag==='local'?'pencil':flag==='bundled'?'box':'alert'} size={15} color={token(s.indicators[flag].token)}/><RichText text={s.flagText[flag]??s.indicators[flag].text}/>{flag==='broken'&&s.fixable&&s.path!==null?<Button icon="sparkle" disabled={fileAction.busy} title="Review what fix will change, then apply it; the text stays the same" state={dialog==='fix'?'pressed':'default'} onClick={()=>param('dialog','fix')}>Fix</Button>:null}</div>)}</div>:null}{!rail?<div style={{paddingTop:6}}><ScoreRow skill={s}/></div>:null}</div>{rail?actions:<div className="detail-head-right">{actions}<ShareBlock command={s.shareCommand} width={400}/></div>}</div>{rail?<ScoreRow skill={s}/>:null}<div className="skill-tabs" role="tablist" aria-label="Skill sections">{tabs.map(([key,label,icon])=><div className="skill-tab-wrap" key={key}><button type="button" role="tab" aria-selected={tab===key} className="tab" data-active={tab===key||undefined} onClick={()=>param('tab',key==='skill'?null:key)}><Icon name={icon} size={15}/>{label}</button>{key==='skill'&&s.files!==null&&s.files.length>1?<button className="files-toggle" aria-label="Show files" aria-expanded={state.menu==='files'} onClick={()=>param('menu',state.menu==='files'?null:'files')}><Icon name="chevron-down" size={12} stroke="2"/></button>:null}{key==='skill'&&state.menu==='files'&&s.files!==null&&s.files.length>1?<div className="file-menu" role="menu"><span>{plural(s.files.length,'file')}</span>{s.files.map((file,i)=><button key={file} role="menuitem" data-current={i===0||undefined} onClick={()=>{param('menu',null);if(i!==0&&s.path!==null)void backend.openInEditor(s.path+'/'+file).then(result=>{if(!result.ok)setActionError(result.error);},e=>setActionError(e instanceof Error?e.message:'Could not open editor.'));}}><Icon name="file" size={14}/><span>{file}</span>{i===0?<Icon name="check" size={14}/>:null}</button>)}</div>:null}</div>)}</div>{tab==='skill'?<SkillMd skill={s} onEdit={()=>void edit()}/>:tab==='quality'?(QUALITY_SHIPPED?<Quality skill={s} validation={validation} onValidate={()=>void validate()} onFix={localPath!==null&&s.path!==null?()=>param('dialog','fix'):undefined} fixing={fileAction.busy}/>:<ComingSoon label="Quality"/>):tab==='activity'?(ACTIVITY_SHIPPED?<Activity skill={s} window={parseWindow(params.get('window')??undefined)} onWindow={days=>param('window',days===30?null:String(days))}/>:<ComingSoon label="Activity"/>):<EvalsTab skill={s} features={features} dialog={dialog} onParam={param} open={openRun} onSelect={selectRun}/>}</div>{rail?<DetailRail skill={s} manageActions={manageActions} onAction={runCardAction} onEnable={setSkillEnabled} toggleError={toggleError??toggle.error}/>:null}</div>:null}{s&&features?.runEvalInApp&&dialog==='run-eval'&&!(evalRun.current?.name===s.name&&(evalRun.current.team??null)===s.team)?<RunEvalDialog skill={s} open onClose={()=>param('dialog',null)}/>:null}{s&&features?.runEvalInApp&&dialog==='head-to-head'?<HeadToHeadDialog skill={s} onClose={()=>param('dialog',null)}/>:null}{s&&!s.teamed&&s.path&&dialog==='fix'?<SkillFixDialog skill={s} workflow={fileAction} validation={validation} publishing={publishBusy} progressLabel={publishHere?.progress?.label??null} publishOptions={<PublishOptions defaults={publishDefaults} target={publishTarget} onTarget={setTargetChoice} category={categoryChoice} onCategory={setCategoryChoice}/>} onClose={()=>param('dialog',null)} onDone={(_value,republish)=>{void queryClient.invalidateQueries({queryKey:['skill',localPath!==null?'local:'+localPath:ref]});if(validation!==null)void validate();if(republish)void publish();else param('dialog',null);}}/>:null}{s&&!s.teamed&&s.path&&dialog==='category'?<SkillCategoryDialog skill={s} categories={publishDefaults.categories} workflow={fileAction} onClose={()=>param('dialog',null)} onDone={()=>{void queryClient.invalidateQueries({queryKey:['skill',localPath!==null?'local:'+localPath:ref]});param('dialog',null);}}/>:null}{s&&!s.teamed&&s.path&&dialog?.startsWith('file-')?<SkillFileDialog kind={dialog.slice(5) as 'move'|'copy'|'rename'|'delete'} skill={s} workflow={fileAction} onClose={()=>param('dialog',null)} onDone={fileActionDone}/>:null}{dialog&&dialog!=='run-eval'&&dialog!=='head-to-head'&&dialog!=='fix'&&dialog!=='category'&&!dialog.startsWith('file-')&&!(dialog==='publish'&&publishStoodDown)&&s&&(dialog!=='remove'||s.placed)&&(dialog!=='install'||((s.installed!=='placed'||installedVersionBehind(s))&&!s.unidentifiedLocal))&&(dialog!=='publish'||s.path!==null)&&(dialog!=='unpublish'||s.teamed)&&copy?<Dialog open onOpenChange={(open,details)=>{if(!open){if(publishBusy&&dialog==='publish'){param('dialog',null);publishRun.show();return;}if(busy&&(details.reason==='outside-press'||details.reason==='focus-out')){details.cancel();return;}closeDialog();}}}><DialogPopup><DialogTitle>{copy.title}</DialogTitle><DialogDescription>{copy.description}</DialogDescription>{dialog==='publish'&&localActionReason(s,'publish')?<Small>{localActionReason(s,'publish')}</Small>:null}{dialog==='publish'?<PublishOptions defaults={publishDefaults} target={publishTarget} onTarget={setTargetChoice} category={categoryChoice} onCategory={setCategoryChoice}/>:null}{dialog==='unpublish'?<label>Type {s.name} to confirm<input aria-label="Skill name to confirm" value={unpublishTyped} onChange={event=>setUnpublishTyped(event.target.value)}/></label>:null}{dialog==='install'?<><div className="board-column" style={{gap:6}}><SectionLabel>Install to</SectionLabel>{features?.installScope&&s.installScopes.length?<RadioGroup className="skill-install-scopes" value={scope} onValueChange={value=>setScope(String(value))}>{s.installScopes.map(([label,caption])=><RadioRow key={label} value={label??''} label={label??''} caption={caption??''}/>)}</RadioGroup>:<div className="skill-install-scopes" style={{height:123}}>Global</div>}</div><div className="board-column" style={{gap:6}}><SectionLabel>Tool grants to approve</SectionLabel><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{(s.grants??[]).map(g=><Chip key={g}>{g}</Chip>)}</div>{s.grants?.length?<Small>Approved once per machine; a changed grant set asks again.</Small>:null}</div></>:null}{features?.progress&&(dialog==='publish'?publishBusy&&(publishHere?.state==='stopping'||publishHere?.progress?.label):busy&&progressLabel)?<div role="status" className="skill-dialog-progress">{dialog==='publish'?publishHere?.state==='stopping'?'Stopping… press Cancel again to stop waiting':publishHere?.progress?.label:progressLabel}</div>:null}{publishError?<div role="alert" style={{fontSize:12,color:'var(--tk-bad)'}}>{publishError}</div>:null}<TerminalHint command={dialog==='publish'?publishCommand:copy.command}/><div className="skill-dialog-actions"><Button onClick={()=>{if(publishBusy&&dialog==='publish'){void publishRun.stop();return;}closeDialog();}}>Cancel</Button><Button disabled={busy||publishBusy||(dialog==='publish'&&localActionReason(s,'publish')!==null)||(dialog==='unpublish'&&unpublishTyped!==s.name)} title={dialog==='publish'?localActionReason(s,'publish')??undefined:undefined} kind={copy.danger?'danger':'primary'} onClick={()=>void execute(dialog)}>{copy.confirm}</Button></div></DialogPopup></Dialog>:null}</ScreenFrame></Shell>;}

export function SkillScreen(){const {ref}=useParams();const {mock}=useUrlState();const [params]=useSearchParams();return <SkillPage key={(ref??'')+':'+mock+':'+(params.get('path')??'')+':'+(params.get('root')??'')}/>;}
/** The Evals tab. Exactly one receipt is on the surface at a time (eval-engine §12:503): the latest
 *  run for this version, or — since EV-20 was amended (Ryan, 2026-09-14) — the run the reader opened
 *  from the History rail. An opened run is rendered from its OWN receipt and carries its own version
 *  in the title, so the page never claims an older run belongs to this version, and no number here is
 *  derived across runs (AGENTS invariant 6). */
function EvalsTab({skill:s,features,dialog,onParam,open,onSelect}:{skill:SkillDetail;features:Features|undefined;dialog:string|null|undefined;onParam:(key:string,value:string|null)=>void;open:SkillDetail['history'][number]|null;onSelect:(runId:string)=>void}){
 const rail=(showing:boolean)=><HistoryRail history={s.history} showing={showing} selectedRunId={open?.runId??null} onSelect={onSelect}/>;
 const latest=s.receipt&&s.summary&&s.reportNumbers?{receipt:s.receipt,summary:s.summary,numbers:s.reportNumbers,incumbentLift:s.incumbentLift,version:versionText(s.versions?.evaluated,s.version)}:null;
 const shown=open?.report?{...open.report,version:open.version}:latest;
 // The opened run is "older" whenever it is not the run the page would show on its own — including
 // the case where this version has no receipt at all and the rail's runs are all for earlier ones.
 const older=open?.report!==undefined&&open.runId!==s.receipt?.run_id;
 const reason=localActionReason(s,'eval');
 return <>{s.evalReportError?<ErrorLine>{s.evalReportError}</ErrorLine>:null}{shown===null?s.latestState==='invalid'?<div className="evals-body"><CenteredState icon="alert" title="The newest receipt for this version is invalid" body={`${s.invalidReceiptFile??'The receipt file'} could not be read as a receipt. Older receipts are listed in History; none is shown in its place.`} {...(features?.runEvalInApp?{primary:'Run eval',primaryDisabled:reason!==null,primaryReason:reason??undefined}:{})} onPrimary={()=>onParam('dialog','run-eval')}/>{s.history.length?rail(true):null}</div>:<EvalsEmpty skill={s} features={features} rail={rail(false)} onRunEval={()=>onParam('dialog','run-eval')} onHow={()=>onParam('tab','skill')}/>:<div className="evals-tab"><div className="tab-head"><span>{older?`Opened run · ${shown.receipt.when} · ${shown.version}`:`Latest receipt for this version · ${shown.receipt.when}${s.history.length>1?' · older runs in History':''}`}</span>{features?.runEvalInApp?<Button disabled={reason!==null} title={reason??undefined} icon="play" state={dialog==='run-eval'?'pressed':'default'} onClick={()=>onParam('dialog','run-eval')}>Run eval</Button>:null}{features?.runEvalInApp&&reason?<Small>{reason}</Small>:null}</div><div className="evals-body"><div className="evals-main" role="region" aria-label="Evaluation report" tabIndex={0}>{older?<div className="partial-banner"><Icon name="alert" size={14} color={token('warn')} stroke="1.75"/><span>Opened from History · run {shown.receipt.run_id} by {shown.receipt.runner}, version {shown.version}{latest===null?' · this version has no receipt of its own':''} · shown on its own, never compared or merged with another run</span><Button kind="ghost" height={24} style={{marginLeft:'auto',flexShrink:0}} onClick={()=>onParam('run',null)}>{latest===null?'Back to this version':'Show latest run'}</Button></div>:null}{!older&&s.latestState==='none'?<div className="partial-banner"><Icon name="alert"/><span>Local run, not committed · {shown.receipt.run_id}</span></div>:null}{!older&&s.versions?.placed&&s.versions.teamCurrent&&s.versions.placed!==s.versions.teamCurrent?<div className="partial-banner"><Icon name="alert"/><span>Your installed copy is {versionText(s.versions.placed,s.versions.placed)}; the team's current version is {versionText(s.versions.teamCurrent,s.versions.teamCurrent)}. The receipt below is for the team's version.</span></div>:null}{shown.summary.partial?<div className="partial-banner"><Icon name="alert" size={14} color={token('warn')} stroke="1.75"/><span>Partial run · {shown.summary.partial[0]} of {shown.summary.partial[1]} rounds scored · the verdict is greyed until a complete run lands</span></div>:null}<EvaluationReport name={s.name} version={shown.version} receipt={shown.receipt} summary={shown.summary} incumbentLift={shown.incumbentLift} numbers={shown.numbers}/></div>{rail(true)}</div></div>}</>;
}
/** The Evals tab with no receipt for this version. When teammates' runs exist for EARLIER versions, "Not
 *  evaluated" is an over-claim about data the page holds, so History is shown beside a truthful empty state —
 *  and only then: with no history the markup is exactly what it was, which is what the locked
 *  SkillDetailNoReceipt board draws (FIDELITY.md row SkillDetailNoReceipt, DETAIL_NO_RECEIPT has history []). */
function EvalsEmpty({skill:s,features,rail,onRunEval,onHow}:{skill:SkillDetail;features:Features|undefined;rail:ReactNode;onRunEval:()=>void;onHow:()=>void}){
 const empty=<CenteredState icon="chart" title={s.history.length?"No receipt for this version":"Not evaluated"} body={s.history.length?"This version has not been evaluated. Older runs for earlier versions are listed in History; they are never compared or merged with this version.":s.cases===undefined?"Run an eval to score this skill against a baseline with no skill.":"Run an eval to score this skill against a baseline with no skill. Three cases, three reps each, on this machine."} {...(features?.runEvalInApp?{primary:'Run eval',primaryDisabled:localActionReason(s,'eval')!==null,primaryReason:localActionReason(s,'eval')??undefined}:{})} secondary="How evals work" onPrimary={onRunEval} onSecondary={onHow}><TerminalHint command={s.evalCommand}/></CenteredState>;
 return s.history.length?<div className="evals-body">{empty}{rail}</div>:empty;
}
