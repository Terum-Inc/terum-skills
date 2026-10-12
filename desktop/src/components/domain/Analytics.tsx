import { useQuery } from '@tanstack/react-query';
import { useBackend,useFeatures } from '../../backend';
import type { PropsWithChildren,ReactNode } from 'react';
import type { Library,SkillCard,UsageWindow } from '../../backend/types';
import { activationOverview } from '../../lib/activation';
import { BoardSkeleton,ErrorLine,Small } from './Primitives';
import { Icon } from '../ui/Icon';
import './Analytics.css';
/** A tile, or with `onOpen` a tile that opens its own detail: the same box, as a button that says it opens a dialog. */
export function StatTile({label,value,grow=1,onOpen,children}:{label:string;value:ReactNode;grow?:number;onOpen?:()=>void}&PropsWithChildren){
 const body=<><span className="stat-label">{label}{onOpen?<span className="stat-open"><Icon name="chevron-right" size={14}/></span>:null}</span><span className="stat-value">{value}</span>{children}</>;
 return onOpen?<button type="button" className="stat-tile stat-tile-button" aria-haspopup="dialog" style={{flexGrow:grow}} onClick={onOpen}>{body}</button>:<div className="stat-tile" style={{flexGrow:grow}}>{body}</div>;
}
/** A tile's big number is the authority for its own empty state: a leading digit run is the real count
 *  ('13 of 15' counts 13), and anything else — the '—' a backend draws when it cannot support a number,
 *  a blank — is an UNKNOWN the tile must never turn into a "nothing yet" claim. A genuine zero arrives
 *  as '0', or as the row-wide `zero` prop. Loading is a third state that never reaches here:
 *  LibraryScreen draws <AnalyticsSkeleton/> while the read is pending. */
function tileCount(value:string):number|null{const digits=/^\d[\d,]*/.exec(value.trim());return digits?Number(digits[0].replaceAll(',','')):null;}
/** The unsupported line is the Activity tab's own, so the two surfaces degrade with one sentence. */
export const ACTIVATION_UNSUPPORTED='This terum-skills version cannot report skill firings. Update it to see them here.';
/**
 * The Activation tile reads `usage` ITSELF rather than through the Library overview: the read is a
 * transcript scan (seconds on a busy machine), so awaiting it inside `library()` would hold every card
 * back, and a failed scan must cost one tile, not the board. The query key is the one the Activity tab
 * uses, so opening a skill page never spawns a second scan, and `affects('placed')` invalidates it.
 *
 * Its states, in order of precedence: the row-wide `zero` (an empty library: '0' and the zero caption,
 * whatever the CLI can do); features not yet known, or the read pending (a skeleton, never a number);
 * a CLI that cannot report firings ('—' and the sentence, never a zero claim); a failed read ('—' and
 * the CLI's error, copyable); then the count, the meter and its two captions. Only that last state
 * opens the Activation popup (`?dialog=activation`): the others have nothing behind them to show.
 */
function ActivationTile({skills,zero,zeroCopy,days,onOpen}:{skills:readonly SkillCard[];zero:boolean;zeroCopy:string;days:UsageWindow;onOpen?:(()=>void)|undefined}){
 const backend=useBackend(),features=useFeatures(),supported=features?.usage===true;
 const usage=useQuery({queryKey:['usage',days],enabled:supported&&!zero,queryFn:async({signal})=>{const r=await backend.usage({days},{signal});if(!r.ok)throw new Error(r.error);return r.value;}});
 if(zero)return <StatTile label="Activation" value="0" grow={2}><Small>{zeroCopy}</Small></StatTile>;
 if(features===undefined||(supported&&usage.isPending))return <StatTile label="Activation" value={<BoardSkeleton width={84} height={20}/>} grow={2}><BoardSkeleton width="70%" height={10}/></StatTile>;
 if(!supported)return <StatTile label="Activation" value="—" grow={2}><Small>{ACTIVATION_UNSUPPORTED}</Small></StatTile>;
 if(usage.error||usage.data===undefined)return <StatTile label="Activation" value="—" grow={2}><ErrorLine>{usage.error instanceof Error?usage.error.message:String(usage.error??'Could not read skill firings.')}</ErrorLine></StatTile>;
 const a=activationOverview(usage.data,skills),m=a.meter;
 // The count opens the popup (?dialog=activation): what fired over time, per skill, and what stands out.
 return <StatTile label="Activation" value={a.value} grow={2} {...(onOpen&&m.total>0?{onOpen}:{})}>
  {m.total===0?<Small>{zeroCopy}</Small>:<>
   <span className="analytics-meter" aria-label={a.meter_text}>{/* The popup's own pair: the model's choices in the accent, a person's in its pale mix, silence in bg4. */}{([[m.chosen,'var(--tk-accent)'],[m.byName,'color-mix(in srgb,var(--tk-accent) 45%,var(--tk-bg4))'],[m.silent,'var(--tk-bg4)']] as const).map(([n,background],i)=><span key={i} style={{flexGrow:n,background}}/>)}</span>
   <Small>{a.meter_text}</Small>
   {a.note?<Small>{a.note}</Small>:null}
  </>}
 </StatTile>;
}
export function Analytics({overview:o,skills,zero=false,provenance='sonnet · agent CLI 2.34.0 · k=3',window:days=30,onActivation}:{overview:Library['overview'];skills:readonly SkillCard[];zero?:boolean;provenance?:string;/** The firings window in days; the Activation popup shares it, so the tile and the popup read one report. */window?:UsageWindow;/** Opens the Activation popup; absent, the tile is not a button. */onActivation?:()=>void}){
 const backend=useBackend(),surfaces=useQuery({queryKey:['surfaces'],queryFn:()=>backend.surfaces()});
 const m=o.meter,evaluated=zero?0:tileCount(o.evaluated);
 // Belt and braces for the tile that had the bug: the zero caption is this row's own copy, so the
 // tile can refuse to draw it over a nonzero count even if a backend hands it down anyway.
 const meterText=evaluated===0||o.meter_text!==o.zero.evaluated?o.meter_text:'';
 return <div className="analytics-row">
  {/* The publish-state line rides under Skills since 2026-09-21 (overview-counts.ts); it is '' when nothing is known, so an unknown never reads as a claim. */}
  <StatTile label="Skills" value={zero?'0':o.skills}>{zero?<Small>{o.zero.skills}</Small>:<>{o.skills_note?<Small>{o.skills_note}</Small>:null}{o.unpublished_line?<Small>{o.unpublished_line}</Small>:null}</>}</StatTile>
  <StatTile label="Evaluated" value={zero?'—':o.evaluated}>{zero?<Small>{o.zero.evaluated}</Small>:evaluated===0?
   // Genuinely nothing evaluated: the zero caption alone, no meter and no provenance to attach it to.
   (meterText?<Small>{meterText}</Small>:null)
   :<>{m.total>0?<div className="analytics-meter">{[[m.pass_,'good'],[m.neutral,'text3'],[m.fail,'bad'],[m.total-m.pass_-m.neutral-m.fail,'bg4']].map(([n,color],i)=><span key={i} style={{flexGrow:Number(n),background:`var(--tk-${color})`}}/>)}</div>:null}{meterText?<Small>{meterText}</Small>:null}{provenance?<Small>{provenance}</Small>:null}</>}</StatTile>
  <ActivationTile skills={skills} zero={zero} zeroCopy={o.zero.activation} days={days} onOpen={onActivation}/>
  <StatTile label="Needs attention" value={zero?'0':o.attention}>{zero?<Small>{o.zero.attention}</Small>:<><div className="board-column">{o.attention_lines.map(line=><Small key={line}>{line}</Small>)}</div>{o.attention_link&&surfaces.data?.inbox===true?<a href="#/inbox?filter=alerts" style={{fontSize:12}}>{o.attention_link}</a>:null}</>}</StatTile>
 </div>;
}
export function AnalyticsSkeleton(){return <div className="analytics-row">{[1,1,2,1].map((grow,i)=><div key={i} className="stat-tile" style={{flexGrow:grow,gap:10}}><BoardSkeleton width={56} height={10}/><BoardSkeleton width={84} height={20}/><BoardSkeleton width="70%" height={10}/></div>)}</div>;}
export function AnalyticsDivider(){return <div className="analytics-divider"><div/></div>;}
