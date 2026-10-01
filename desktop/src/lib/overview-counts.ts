import type { SkillCard } from '../backend/types';
import { overviewCopy } from './overview-copy';

/** The Library overview's Evaluated tile: the big number, the meter and the caption under it are all
 *  read off the SAME receipts, so the tile can never claim "Nothing evaluated yet" over a nonzero
 *  count. One skill contributes one verdict; a skill with no receipt is simply not evaluated, and
 *  shows up as the meter's unevaluated remainder (`total` is every skill, never only the scored
 *  ones — the design's `13 of 15` meter spends its fourth segment on that remainder). */
export function evaluatedOverview(skills:readonly SkillCard[]):{evaluated:string;meter:{pass_:number;neutral:number;fail:number;total:number};meter_text:string} {
 const verdicts=skills.map(skill=>skill.localEval?.verdict??null);
 const pass_=verdicts.filter(v=>v==='PASS').length,neutral=verdicts.filter(v=>v==='NEUTRAL').length,fail=verdicts.filter(v=>v==='FAIL').length;
 const evaluated=pass_+neutral+fail;
 return {evaluated:String(evaluated),meter:{pass_,neutral,fail,total:skills.length},meter_text:evaluated?`${pass_} pass · ${neutral} neutral · ${fail} fail`:overviewCopy.evaluated};
}

/** How many Library folders have never been published to the team marketplace, and how many the CLI
 *  could not place either way. Publish state is the byte-level overlay `localMatch` (types.ts): 'none'
 *  is a folder tied to no team skill at all — never published; 'identical' and 'differs' are both
 *  published skills (unedited, or edited since); null is an UNKNOWN — a CLI too old to report the
 *  overlay, or a folder the CLI could not offer at all (an unparseable one; `notOfferedCard` in the
 *  Tauri adapter builds its card with no overlay key). An unknown is reported as its own figure and
 *  never counted as unpublished: until 2026-09-15 a SINGLE unknown row turned the whole tile into a
 *  dash, and since every machine carries at least one not-offered folder the tile read '—' forever.
 *  Bundled folders are out of the reckoning entirely — the manual setup places can never become a
 *  team skill (BUNDLED_NOTE), so it is neither unpublished nor an unknown, just not publishable.
 *  This is the same predicate `libraryVersionLabel` (components/domain/presentation.ts) uses to label
 *  a card 'Unpublished', including its "say nothing rather than guess" rule for null — the caption and
 *  the cards it counts must not disagree about what unpublished means.
 *  NOTE: this counts NEVER-PUBLISHED only. Locally-modified-since-publish ('differs') is a distinct
 *  state and is deliberately excluded — see the PR description. */
export function unpublishedCount(skills:readonly SkillCard[]):{count:number;unknown:number;total:number} {
 const publishable=skills.filter(skill=>!skill.flags.includes('bundled'));
 return {count:publishable.filter(skill=>skill.localMatch==='none').length,unknown:publishable.filter(skill=>skill.localMatch===null).length,total:publishable.length};
}

/** The publish-state caption under the Skills tile, from one count (until 2026-09-21 this was the
 *  fourth tile's number, which the Activation tile now occupies). One line, and a line that never
 *  contradicts the count it is read from: a nonzero count names itself, a zero over unplaced folders
 *  names the unknowns instead of claiming a clean sheet, and when NOTHING is known — every folder
 *  unknown, or no folder at all — the line is empty rather than a fabricated number or a hedge with
 *  nothing behind it. "All published" is earned only by a library with no unknowns left. The word is
 *  the cards' own — `libraryVersionLabel` writes 'Unpublished' on each such card — so the caption and
 *  the grid under it say the same thing. */
export function unpublishedLine(skills:readonly SkillCard[]):string {
 const {count,unknown,total}=unpublishedCount(skills);
 if(total===0||unknown===total)return '';
 const unknownNote=unknown===0?'':`${unknown} with an unknown publish state`;
 if(count>0)return `${count} unpublished`+(unknownNote?' · '+unknownNote:'');
 return unknownNote||'All published to the marketplace';
}
