import { expect, it } from 'vitest';
import { createTauriBackend } from '../index';
import { overviewCopy } from '../../../lib/overview-copy';
import { chromeLibraryReplay, underHome } from './chrome-library-fixture';

const global = {scope:{kind:'global'} as const};
// The re-recorded hello advertises `refresh` and `serve`: the first hello triggers one background `sync`
// (index.ts onHello), and every read after it goes over one `serve` child as a request, not a spawn
// (session.ts) — so `ls --team acme` is in `f.requests`, and the spawn list ends `sync`, `serve`.

it.each(['update-available','both'])('counts only available attention data with a second %s row (B1)',async health=>{
 const f=chromeLibraryReplay({local:value=>{
  const section=value.local[0]!,row=section.rows[0]!;
  section.rows=[{...row,health:'update-available'},{...row,path:row.path+'-second',health},{...row,path:row.path+'-broken',health:'unknown',problem:'Could not inspect placed copy.'},{...row,health:'update-available'}];
 }});
 const result=await createTauriBackend(f.bridge).library(global);
 expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.error);
 expect(result.value.skills).toHaveLength(3);
 expect(result.value.overview).toMatchObject({attention:'1',attention_lines:['1 need attention'],attention_link:''});
 expect(f.spawns.map(s=>s.args)).toEqual([['ls','--local'],['sync']]);expect(f.requests).toEqual([]);
});
it('reports zero attention without placeholder notes or fabricated eval counters (B1)',async()=>{
 const result=await createTauriBackend(chromeLibraryReplay().bridge).library(global);
 expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.error);
 const {evaluated,...overview}=result.value.overview;
 expect(overview).toMatchObject({attention:'0',attention_lines:[],attention_link:'',installs_note:''});
 // The unknown eval aggregate is the one dash §3 explicitly preserves.
 expect(evaluated).toBe('0');expect(overview.installs).toBe('—');
});
it.each(['joined','unreadable','unjoined'])('describes only a readable team join when %s (B1)',async state=>{
 const f=chromeLibraryReplay(state==='unreadable'?{statusError:'Unreadable team clone.'}:state==='unjoined'?{local:value=>{value.local[0]!.rows=[];}}:{});
 const result=await createTauriBackend(f.bridge).library(global);
 expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.error);
 expect(result.value.overview.skills_note).toBe('');
 expect(result.value).not.toHaveProperty('team');
});
it('uses the designed empty eval copy without requesting per-skill reports (B1)',async()=>{
 const f=chromeLibraryReplay(),result=await createTauriBackend(f.bridge).library(global);
 expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.error);
 // `total` is every skill, so the meter can spend its fourth segment on the unevaluated remainder;
 // the caption stays the zero copy only because the count really is 0.
 expect(result.value.overview).toMatchObject({evaluated:'0',meter:{pass_:0,neutral:0,fail:0,total:1},meter_text:'Nothing evaluated yet',zero:overviewCopy});
 expect(f.spawns.map(s=>s.args)).toEqual([['ls','--local'],['sync']]);expect(f.requests).toEqual([]);
});

/** A receipt in the shape `ls --local` records one, reduced to the fields a card summary reads. */
const receipt=(verdict:'PASS'|'NEUTRAL'|'FAIL',run:string)=>({path:'evals/'+run+'.json',version:null,run_id:run,verdict,execution_status:'complete',expected_rows:3,scored_rows:3,attribution:'local',
 comparisons:{'candidate-vs-baseline':{win:2,loss:0,tie:1,net_lift:0.22,sign_p:0.25}},arm_scores:{candidate:0.8,baseline:0.6},triggers:null,efficiency:{},
 provenance:{timestamp:'2026-09-12T00:00:00Z',runner_handle:'ajay',model:'sonnet',judge_model:'opus',cc_version:'2.34.0',engine_version:'1',engine_commit:'abc',k:3,cases:['a']}});
// The Evaluated tile used to draw its number from the receipts and its meter and caption from nothing
// at all — a hard-zeroed meter and the zero copy — so two evaluated skills rendered "2" over
// "Nothing evaluated yet". Number, meter and caption are one derivation over one set of receipts now.
it('derives the eval meter and caption from the same receipts as the count (B1)',async()=>{
 const f=chromeLibraryReplay({local:value=>{
  const section=value.local[0]!,row=section.rows[0]!;
  section.rows=[{...row,localEval:receipt('PASS','20260912T000000Z')},{...row,path:row.path+'-second',localEval:receipt('FAIL','20260912T000001Z')},{...row,path:row.path+'-third'}];
 }});
 const result=await createTauriBackend(f.bridge).library(global);
 expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.error);
 expect(result.value.overview).toMatchObject({evaluated:'2',meter:{pass_:1,neutral:0,fail:1,total:3},meter_text:'1 pass · 0 neutral · 1 fail'});
 expect(result.value.overview.meter_text).not.toBe(overviewCopy.evaluated);
});
// §4.3: 'none' is a folder tied to no team skill — never published. A CLI too old to report the
// overlay leaves the count unknowable, and the Skills tile's line says nothing over a fabricated zero.
it('counts never-published folders, and says nothing when the overlay is absent (B1)',async()=>{
 const withMatch=(matchedVersion:string|null,knownToTeam:boolean)=>({matchedVersion,knownToTeam,placement:null});
 const f=chromeLibraryReplay({local:value=>{
  const section=value.local[0]!,row=section.rows[0]!;
  section.rows=[{...row,...withMatch(null,false)},{...row,path:row.path+'-second',...withMatch(null,false)},{...row,path:row.path+'-third',...withMatch('v1',true)}];
 }});
 const counted=await createTauriBackend(f.bridge).library(global);
 expect(counted.ok).toBe(true);if(!counted.ok)throw new Error(counted.error);
 expect(counted.value.overview).toMatchObject({unpublished_line:'2 unpublished'});
 const unknown=await createTauriBackend(chromeLibraryReplay().bridge).library(global);
 expect(unknown.ok).toBe(true);if(!unknown.ok)throw new Error(unknown.error);
 expect(unknown.value.overview).toMatchObject({unpublished_line:''});
});

// A dash used to be the ONLY thing the old tile ever drew on a real machine: a not-offered folder gets its
// card from `notOfferedCard`, which carries no overlay key at all, and one such card sank the whole count.
// Every machine has at least one — setup places the bundled manual — so the line now names its unknowns
// beside a real number, and the manual itself is out of the reckoning (it can never become a team skill).
it('counts around the folders the CLI could not offer instead of going silent (B1)',async()=>{
 const notOffered=(name:string,reason:string)=>({skillId:null,name,path:'/Users/teddy/.claude/skills/'+name,reason,detail:reason==='invalid-yaml'?'SKILL.md frontmatter is not valid YAML.':'',description:null,frontmatter:null,body:null,category:null,characters:null});
 const f=chromeLibraryReplay({local:value=>{
  const section=value.local[0]!,row=section.rows[0]!;
  section.rows=[{...row,matchedVersion:null,knownToTeam:false,placement:null},{...row,path:row.path+'-second',matchedVersion:'v1',knownToTeam:true,placement:null}];
  section.notOffered=[notOffered('broken-skill','invalid-yaml'),notOffered('terum-skills','managed-wrapper')];
 }});
 const result=await createTauriBackend(f.bridge).library(global);
 expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.error);
 expect(result.value.skills).toHaveLength(4);
 expect(result.value.overview).toMatchObject({unpublished_line:'1 unpublished · 1 with an unknown publish state'});
});
// A library whose every publishable folder is known needs no hedge, and the bundled manual must not add one.
it('reads a clean zero when only the bundled manual is unplaceable (B1)',async()=>{
 const f=chromeLibraryReplay({local:value=>{
  const section=value.local[0]!,row=section.rows[0]!;
  section.rows=[{...row,matchedVersion:'v1',knownToTeam:true,placement:null}];
  section.notOffered=[{skillId:null,name:'terum-skills',path:'/Users/teddy/.claude/skills/terum-skills',reason:'managed-wrapper',detail:'',description:null,frontmatter:null,body:null,category:null,characters:null}];
 }});
 const result=await createTauriBackend(f.bridge).library(global);
 expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.error);
 expect(result.value.overview).toMatchObject({unpublished_line:'All published to the marketplace'});
});

// disablePerMachine (2026-09-14): `enabled` is read off the CLI row, which read it off Claude Code's skillOverrides; a CLI too old to send the key reads as enabled, never as off.
it('carries each row\'s enabled onto its card and treats a missing key as enabled',async()=>{
 const f=chromeLibraryReplay({local:value=>{
  const section=value.local[0]!,row=section.rows[0]!;
  const withoutKey:Omit<typeof row,'enabled'>&{enabled?:boolean}={...row};delete withoutKey.enabled;
  section.rows=[{...row,enabled:false},{...row,path:row.path+'-second',enabled:true},{...withoutKey,path:row.path+'-third'}];
 }});
 const result=await createTauriBackend(f.bridge).library(global);
 expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.error);
 const byPath=new Map(result.value.skills.map(card=>[card.path,card.enabled]));
 const first=[...byPath.keys()].find(path=>path!==null&&!path.endsWith('-second')&&!path.endsWith('-third'))!;
 expect(byPath.get(first)).toBe(false);
 expect(byPath.get(first+'-second')).toBe(true);
 expect(byPath.get(first+'-third')).toBe(true);
});

it('serves the recorded scan coverage abbreviated from the real roots, never a literal (L5)',async()=>{
 const backend=createTauriBackend(chromeLibraryReplay({local:underHome}).bridge);
 const result=await backend.library(global);
 expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.error);
 expect(result.value.scanned).toEqual(['~/.claude/skills','~/code/seed']);
});
it('leaves a root outside the home directory unabbreviated',async()=>{
 const backend=createTauriBackend(chromeLibraryReplay().bridge);
 const result=await backend.library(global);
 expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.error);
 // §7.2: the re-recorded scan lists the Global root alone — the fixture registers no checkout.
 expect(result.value.scanned).toHaveLength(1);
 for(const root of result.value.scanned??[])expect(root).not.toContain('~');
 expect(result.value.scanned?.[0]).toMatch(/\/\.claude\/skills$/);
});
it('drops an absent root from the scanned line but keeps unreadable ones (L6)',async()=>{
 const absent=createTauriBackend(chromeLibraryReplay({local:value=>underHome(value,'absent')}).bridge);
 expect((await absent.library(global)).value?.scanned).toEqual(['~/.claude/skills']);
 const unreadable=createTauriBackend(chromeLibraryReplay({local:value=>underHome(value,'unreadable')}).bridge);
 expect((await unreadable.library(global)).value?.scanned).toEqual(['~/.claude/skills','~/code/seed']);
});
it('serves the four zero captions as app copy and grammatical install counts (L7, L9)',async()=>{
 const backend=createTauriBackend(chromeLibraryReplay().bridge);
 const result=await backend.library(global);
 expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.error);
 expect(result.value.overview.zero).toEqual(overviewCopy);
 expect(result.value.skills.map(card=>card.name)).toEqual(['deploy-check']);
 for(const card of result.value.skills)expect(card.installs).toBe('—');
});
it('shares the same scan coverage with Marketplace (M23)',async()=>{
 const backend=createTauriBackend(chromeLibraryReplay({local:value=>underHome(value,'absent')}).bridge);
 const catalog=await backend.catalog();
 expect(catalog.ok).toBe(true);if(!catalog.ok)throw new Error(catalog.error);
 expect(catalog.value.scanned).toEqual(['~/.claude/skills']);
 expect(catalog.value.scanned).toEqual((await backend.library(global)).value?.scanned);
});
