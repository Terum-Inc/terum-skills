import { useLocation,useSearchParams,useNavigate } from 'react-router';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { useCallback,useContext,useEffect,useRef,useState } from 'react';
import type { FileDropEvent, LibraryScope, ReconcileResult, Root, SkillCard as Card } from '../../backend/types';
import { plural } from '../marketplace/market-data';
import type { ReactNode } from 'react';
import { driveRun,PrintContext,PromptContext,useBackend,useFeatures } from '../../backend';
import { useUiStore } from '../../app/store';
import { useUrlState } from '../../app/url-state';
import { Shell } from '../../components/domain/Shell';
import { ScreenFrame } from '../../components/domain/ScreenFrame';
import { Analytics,AnalyticsDivider,AnalyticsSkeleton } from '../../components/domain/Analytics';
import { ActivationDialog } from './ActivationDialog';
import { parseWindow } from '../../lib/activation';
import { SkillCard,SkillCardSkeleton } from '../../components/domain/SkillCard';
import { CenteredState,ErrorLine,SearchRow,TerminalHint,ViewHeader } from '../../components/domain/Primitives';
import { ReconcileDialog } from '../../components/domain/ReconcileDialog';
import { fetchNote,reconcileHasRows } from '../../components/domain/reconcile';
import { useAddLibraryProject } from '../../components/domain/useAddLibraryProject';
import { Button } from '../../components/ui/Button';
import { LibrarySelectionBar } from './LibrarySelectionBar';
import { BulkPublishDialog } from './BulkPublishDialog';
import type { BulkPublishSummary } from './bulk-publish';
import { usePublishRun } from '../../app/publish-run-context';
import { bulkEvalHandoff, bulkEvalSearch } from './bulk-eval-handoff';
import { LeftOutNote } from './LeftOutNote';
import { libraryQueryMatches } from './library-query';
import { parseSort,sortCards,SORT_OPTIONS } from './library-sort';
import './library.css';
/** The header's "which folder is this, and does it have a GitHub home" line (Ryan, 2026-09-09). Global is a folder with no repository. */
function rootMeta(root:Root|undefined):ReactNode{
 if(root===undefined)return undefined;
 if(root.kind==='global')return <span>{root.root}</span>;
 const remote=root.remote??null;
 const connected=remote!==null&&remote.slug!==null;
 return <><span>{root.root}</span><span aria-hidden="true">·</span><span {...(remote!==null&&remote.slug===null?{title:'origin is '+remote.url}:{})}>{connected?'GitHub: '+remote.slug:'GitHub: not connected'}</span></>;
}
const EMPTY_KEYS:ReadonlySet<string>=new Set();
const cardKey=(card:Card):string=>card.path??card.name;
// The Library reads the global skills folder and only the projects the user explicitly added.
/** Library publish runs already reported by `finishBulk`, by `startedAt` (unique per run). Module scope: the screen remounts, the run does not. */
const reportedPublishes=new Set<number>();
export function LibraryScreen(){const location=useLocation(),state=useUrlState(),backend=useBackend(),ask=useContext(PromptContext),print=useContext(PrintContext),features=useFeatures(),projectAdd=useAddLibraryProject(),navigate=useNavigate(),[search,setSearch]=useSearchParams(),[actionError,setActionError]=useState<string|null>(null),[checking,setChecking]=useState(false),[reconcile,setReconcile]=useState<{result:ReconcileResult;note:string|null}|null>(null),queryClient=useQueryClient(),publishRun=usePublishRun();const root=search.get('root')??'',scope:LibraryScope=location.pathname==='/library/checkout'?{kind:'checkout',root}:{kind:'global'},missing=scope.kind==='checkout'&&!root,scopeKey=scope.kind==='global'?'global':scope.root;
 // Selection mode (batch E, 2026-09-13) is a URL state (`?select=1`) so it is a link; the selected SET is
 // component state keyed by the scope — never in the URL, a link should not carry a half-made selection —
 // dropped by Done, Escape and a scope change, and kept across a query or sort change so the bar can count
 // it against the current draw. Keying by scope instead of resetting in an effect keeps the hooks rules happy.
 const selecting=search.get('select')==='1';const [selection,setSelection]=useState<{scopeKey:string;keys:ReadonlySet<string>}>({scopeKey,keys:EMPTY_KEYS}),[notice,setNotice]=useState<{scopeKey:string;text:string}|null>(null);const selectedKeys=selecting&&selection.scopeKey===scopeKey?selection.keys:EMPTY_KEYS;
 const query=useQuery({queryKey:['library',scope.kind==='global'?'global':scope.root,state.mock],enabled:!missing,queryFn:({signal})=>backend.library({scope},{signal})});const data=query.data?.ok?query.data.value:undefined,title=data?.root.label??(scope.kind==='global'?'Global':root.split(/[\\/]/).filter(Boolean).at(-1)??''),selected=scope.kind==='global'?'Global':data?.root.id??root,error=query.data?.ok===false?query.data.error:query.isError?query.error.message:null,loading=query.isPending&&!error&&!missing,empty=data?.skills.length===0;
 // The order lives in the URL (`sort` is absent for the default order), so a Library view is a link. The facet
 // popover that stood beside it left with #212 (2026-09-14, every facet out of the search rows): the row only
 // searches and sorts, and a leftover `?filters=`/`?verdicts=` in a pasted link narrows nothing.
 const sort=parseSort(search);
 const filtered=sortCards((data?.skills??[]).filter(s=>libraryQueryMatches(s,state.q??'')),sort);
 // `N of M` and the publish set are the selected cards among those DRAWN: a card hidden by the query
 // stays selected but is neither counted nor sent, so the button never promises more than the grid shows.
 const drawnSelected=filtered.filter(card=>selectedKeys.has(cardKey(card)));
 // "Evaluate N…" counts only the drawn selection the ⋯ menu could evaluate; the rest is named under the bar. The
 // question itself is the app-wide bulk-eval dialog, reached by URL like every other dialog here (a push, so Back closes it).
 // Nothing is computed for a control the CLI does not offer: with `runEvalInApp` off, the button AND the line that
 // explains it stay out of the tree (invariant 2 — a hidden control leaves no trace).
 const evalHandoff=features?.runEvalInApp?bulkEvalHandoff(drawnSelected):null;
 function openBulkEval(){if(evalHandoff!==null)setSearch(bulkEvalSearch(search,evalHandoff.refs));}
 const setKeys=useCallback((keys:ReadonlySet<string>)=>{setSelection({scopeKey,keys});},[scopeKey,setSelection]);
 function toggleCard(key:string){const next=new Set(selectedKeys);if(next.has(key))next.delete(key);else next.add(key);setKeys(next);}
 // `replace` is for the search field: `q` used to PUSH a history entry per keystroke, so Back walked
 // back through every character. TYPING always replaces — including the backspace that empties the field,
 // which used to push and left Back returning to a one-character query the user never meant to visit
 // (review 2026-09-13). Everything else here (sort, and the ✕ that clears the query in one
 // gesture) is a navigation the user should be able to undo with Back, so it still pushes.
 function param(key:string,value:string|null,replace=false){const next=new URLSearchParams(search);if(value)next.set(key,value);else next.delete(key);setSearch(next,{replace});}
 function toggleSelecting(){if(selecting){setKeys(EMPTY_KEYS);const next=new URLSearchParams(search);next.delete('select');next.delete('dialog');setSearch(next);}else{setNotice(null);param('select','1');}}
 /** Done in the bulk dialog: the clone changed, so every Library read and skill page refetches; the selection and the mode end; the Library's one status line reports the count. The URL write REPLACES so Back does not reopen the dialog. */
 const finishBulk=useCallback((summary:BulkPublishSummary)=>{void queryClient.invalidateQueries({queryKey:['library']});void queryClient.invalidateQueries({queryKey:['skill']});setKeys(EMPTY_KEYS);setNotice({scopeKey,text:`Published ${summary.published} of ${plural(summary.attempted,'skill')}`+(summary.failed>0?` · ${summary.failed} failed`:'')});const next=new URLSearchParams(search);next.delete('dialog');next.delete('select');setSearch(next,{replace:true});},[queryClient,scopeKey,search,setKeys,setNotice,setSearch]);
 // The run outlives this screen (its chip stays until ✕): the report is made from the provider's settle callback — a
 // settled run is replayed to a late subscriber, so the Library hears about a run that finished during a detour — and
 // the acknowledgement lives at module scope (`reportedPublishes`, by `startedAt`), not in a ref a remount would reset.
 // A run started in another Library scope is left for that Library to report when the person returns to it.
 useEffect(()=>publishRun.subscribe(final=>{
  if(final.origin!=='library'||final.scope!==scopeKey||final.summary===undefined||reportedPublishes.has(final.startedAt))return;
  reportedPublishes.add(final.startedAt);
  finishBulk(final.summary);
 }),[finishBulk,publishRun,scopeKey]);
 // Escape leaves selection mode, but yields to any open dialog and to a field the user is typing in. No dependency list: the listener closes over this
 // render's state and is cheap to re-attach.
 useEffect(()=>{
  if(!selecting||state.dialog||publishRun.dialogOpen)return undefined;
  const onKey=(event:KeyboardEvent)=>{if(event.key!=='Escape'||event.defaultPrevented)return;const target=event.target;if(target instanceof HTMLElement&&(target.matches('input,textarea,select')||target.isContentEditable))return;event.preventDefault();toggleSelecting();};
  document.addEventListener('keydown',onKey);return ()=>document.removeEventListener('keydown',onKey);
 });
 // Done unmounts the dialog and the bar in one write, so the button focus would return to is gone and focus lands on
 // <body> (the next Tab restarting at the top of the page). The status line takes it — unless focus already sits
 // somewhere real, as SearchRow does for its popover. The notice is keyed by scope, like the selection: the two
 // Library routes share one component instance, and a Global count must not sit above a checkout's grid.
 const noticeRef=useRef<HTMLDivElement>(null);
 // Deferred a tick: the dialog's own focus return (a microtask after its unmount) targets a button that no longer
 // exists, which some engines resolve to <body>; the status line takes focus only once that has settled.
 // The run board may still be open when the notice mounts (the host reports a settled run at once), so the effect also
 // re-runs when that board closes: its focus return targets a button Done removed, which resolves to <body> too.
 useEffect(()=>{if(notice===null||publishRun.dialogOpen)return undefined;const timer=setTimeout(()=>{const focused=document.activeElement;if(focused!==null&&focused!==document.body&&document.contains(focused))return;noticeRef.current?.focus();},0);return ()=>clearTimeout(timer);},[notice,publishRun.dialogOpen]);
 // The empty-state primary is the sidebar's Add project flow (native chooser + `project add`, PR #102);
 // it needs the CLI's libraryProjects feature, so an older CLI degrades to the marketplace link.
 const canAddProject=features?.libraryProjects===true;
 // Drop a folder anywhere on the Library to add it as a project (2026-09-14). The overlay
 // draws only while a drag hovers, so no board moves; the handler lives in a ref so the subscription is made once.
 const [dropping,setDropping]=useState(false),onDrop=useRef<(paths:string[])=>void>(()=>{});
 useEffect(()=>{
  if(!canAddProject)return undefined;
  return backend.onFileDrop((event:FileDropEvent)=>{if(event.kind==='enter')setDropping(true);else if(event.kind==='leave')setDropping(false);else{setDropping(false);onDrop.current(event.paths);}});
 },[backend,canAddProject]);
 /** One `project add` per dropped folder, in order; the Library's status line counts what landed and the error line names the first refusal. */
 async function addDropped(paths:string[]){
  if(projectAdd.busy)return;
  setActionError(null);
  if(paths.length===0){setActionError('Nothing to add: the drop carried no folder path.');return;}
  let added=0;
  // M2 (#220) made `useAddLibraryProject` the one project-add coordinator, so a drop goes through it too and
  // gets the same reconcile dialog every other Add project surface gets. `onAdded` fires only on success, and
  // the coordinator holds the refusal text itself — the screen's error line reads it below.
  for(const path of paths){let ok=false;await projectAdd.add(path,()=>{ok=true;});if(ok)added+=1;}
  const failed=paths.length-added;
  setNotice({scopeKey,text:`Added ${plural(added,'project')}`+(failed?` · ${failed} failed`:'')});
 }
 useEffect(()=>{onDrop.current=paths=>{void addDropped(paths);};});
 async function addProject(){
  await projectAdd.add();
 }
 // The Library's Sync (Ryan, 2026-09-14): the fetch-only `sync` verb first, so the comparison is against the team as it
 // is now rather than as it was at the last background fetch, then `reconcile --list`. Same verbs as Settings ▸ Sync now
 // plus the reconcile read; a fetch that fails or skips a team still yields a comparison, said as such in the dialog.
 // Both runs are uncached: `reconcile --list` goes through run(), not the shared read cache.
 async function syncWithTeam(){
  if(checking)return;setChecking(true);setActionError(null);
  try{
   const fetched=await driveRun(backend.sync({}),{},ask,print);
   const note=fetchNote(fetched);
   const result=await backend.reconcile.list();
   if(!result.ok)setActionError(result.error);
   else if(reconcileHasRows(result.value))setReconcile({result:result.value,note});
   else setNotice({scopeKey,text:'Nothing to reconcile: none of your skills match a team skill by bytes or by name.'+(note===null?'':' '+note)});
  }
  catch(reason){setActionError(reason instanceof Error?reason.message:String(reason));}finally{setChecking(false);}
 }
 return <Shell counts={loading||error?null:undefined} selected={selected}><ScreenFrame ready={missing||!query.isPending||state.mock==='loading'}><ViewHeader title={title} {...(data&&!error?{subtitle:data.title,meta:rootMeta(data.root)}:{})} {...(!error?{overview:state.overviewHidden?'show' as const:'hide' as const,onOverview:()=>{useUiStore.getState().setOverviewHidden(!state.overviewHidden);param('overview',state.overviewHidden?null:'0');}}:{})}>{features?.reconcile===true?<Button kind="ghost" icon="refresh" disabled={checking} onClick={()=>void syncWithTeam()}>{checking?'Syncing…':'Sync'}</Button>:null}</ViewHeader>{actionError??projectAdd.error?<ErrorLine>{actionError??projectAdd.error}</ErrorLine>:null}{dropping?<div className="library-drop" role="status">Drop a folder to add it as a project</div>:null}{notice!==null&&notice.scopeKey===scopeKey?<div role="status" className="library-notice" tabIndex={-1} ref={noticeRef}>{notice.text}</div>:null}{missing?<CenteredState alert icon="alert" title="Couldn't read your library" body="Select a checkout from your Library."><ErrorLine>No checkout selected.</ErrorLine></CenteredState>:error?<CenteredState alert icon="alert" title="Couldn't read your library" body="terum-skills could not read ~/.terum/skills. Check the folder still exists and is readable, then try again." primary="Try again" secondary="Show in Finder" onPrimary={()=>{setActionError(null);void query.refetch();}} onSecondary={()=>void backend.revealPath('~/.terum/skills').then(result=>{if(!result.ok)setActionError(result.error);},e=>setActionError(e instanceof Error?e.message:'Could not open folder.'))}><ErrorLine>{error}</ErrorLine></CenteredState>:<>{!state.overviewHidden?<>{loading?<AnalyticsSkeleton/>:data?<Analytics overview={data.overview} skills={data.skills} zero={empty} provenance="" window={parseWindow(search.get('window')??undefined)} onActivation={()=>param('dialog','activation')}/>:null}<AnalyticsDivider/></>:null}<SearchRow query={state.q??''} placeholder={loading||empty?'Search skills':'Search '+plural(data?.skills.length??0,'skill')} onChange={q=>param('q',q||null,true)} onClear={()=>param('q',null)} sortOptions={SORT_OPTIONS} sortValue={sort} onSort={value=>param('sort',value==='updated'?null:value)} trailing={data&&!empty?<Button kind="ghost" icon="check-circle" className="search-select-trigger" aria-pressed={selecting} onClick={toggleSelecting}>{selecting?'Done':'Select'}</Button>:undefined}></SearchRow>{selecting&&data&&!empty?<><LibrarySelectionBar selected={drawnSelected.length} drawn={filtered.length} held={selectedKeys.size} onSelectAll={()=>setKeys(new Set([...selectedKeys,...filtered.map(cardKey)]))} onClear={()=>setKeys(EMPTY_KEYS)} onPublish={()=>param('dialog','publish')}>{evalHandoff!==null?<Button disabled={evalHandoff.refs.length===0} state={state.dialog==='bulk-eval'?'pressed':'default'} onClick={openBulkEval}>{evalHandoff.refs.length===0?'Evaluate…':`Evaluate ${plural(evalHandoff.refs.length,'skill')}…`}</Button>:null}</LibrarySelectionBar>{evalHandoff!==null?<LeftOutNote leftOut={evalHandoff.leftOut} selected={drawnSelected.length}/>:null}</>:null}{loading?<div className="library-grid" aria-label="Loading skills">{Array.from({length:9},(_,i)=><SkillCardSkeleton key={i}/>)}</div>:empty?<CenteredState icon="box" title={scope.kind==='global'?'No skills in your global library':`No skills in ${title}`}  body="Skills in ~/.claude/skills and in the projects you add show up here." primary={canAddProject?'Add project':'Open marketplace'} {...(canAddProject?{secondary:'Open marketplace',onSecondary:()=>navigate('/marketplace')}:{})} onPrimary={canAddProject?()=>void addProject():()=>navigate('/marketplace')}><TerminalHint command="npx -y terum-skills@latest install &lt;ref&gt;" prefix="From the terminal"/>{projectAdd.error&&<ErrorLine>{projectAdd.error}</ErrorLine>}</CenteredState>:!filtered.length?<CenteredState icon="search" title={state.q?`No skills match “${state.q}”`:'No skills match'} body="Try a shorter query, or search your team's marketplace for it." primary="Clear search" secondary="Search marketplace" onPrimary={()=>param('q',null)} onSecondary={()=>navigate('/marketplace?q='+encodeURIComponent(state.q??''))}/>:<div className="library-grid">{filtered.map(skill=><SkillCard key={cardKey(skill)} skill={skill} selectable={selecting} selected={selectedKeys.has(cardKey(skill))} onToggle={()=>toggleCard(cardKey(skill))}/>)}</div>}{/* The Activation popup (2026-09-27) is a URL state like every dialog here, so it is a link and Back closes it. */}{state.dialog==='activation'&&data&&!empty?<ActivationDialog skills={data.skills} window={parseWindow(search.get('window')??undefined)} origin={scope.kind==='checkout'&&root?'root='+encodeURIComponent(root):''} onWindow={days=>param('window',days===30?null:String(days),true)} onClose={()=>param('dialog',null,true)}/>:null}{selecting&&state.dialog==='publish'?<BulkPublishDialog cards={drawnSelected} scope={scopeKey} onClose={()=>param('dialog',null,true)}/>:null}</>}</ScreenFrame>{projectAdd.dialog}{reconcile?<ReconcileDialog result={reconcile.result} note={reconcile.note} title="Sync" onClose={()=>setReconcile(null)} onFinished={()=>void query.refetch()}/>:null}</Shell>;
}
