import { describe, expect, it } from 'vitest';
import { evaluatedOverview, unpublishedCount, unpublishedLine } from '../overview-counts';
import { overviewCopy } from '../overview-copy';
import type { SkillCard } from '../../backend/types';

type Verdict = NonNullable<SkillCard['localEval']>['verdict'];
/** Only the three fields these counters read; the rest of the card is irrelevant to them. */
const card=(verdict:Verdict|null,localMatch:SkillCard['localMatch']='none',flags:SkillCard['flags']=[]):SkillCard=>
 ({localEval:verdict===null?null:{verdict,w:1,l:0,t:0,n:1,lift:0,partial:null,signP:'0.500',runnerHandle:null,version:null},localMatch,flags}) as unknown as SkillCard;

describe('evaluatedOverview',()=>{
 it('reports the zero caption only when nothing is evaluated',()=>{
  expect(evaluatedOverview([])).toEqual({evaluated:'0',meter:{pass_:0,neutral:0,fail:0,total:0},meter_text:overviewCopy.evaluated});
  expect(evaluatedOverview([card(null),card(null)])).toEqual({evaluated:'0',meter:{pass_:0,neutral:0,fail:0,total:2},meter_text:overviewCopy.evaluated});
 });
 it('captions a nonzero count with its own verdicts, never the zero copy (the 2 · "Nothing evaluated yet" bug)',()=>{
  const overview=evaluatedOverview([card('PASS'),card('FAIL'),card(null)]);
  expect(overview).toEqual({evaluated:'2',meter:{pass_:1,neutral:0,fail:1,total:3},meter_text:'1 pass · 0 neutral · 1 fail'});
  expect(overview.meter_text).not.toBe(overviewCopy.evaluated);
 });
 it('counts every skill in the meter total so the unevaluated remainder is its own segment',()=>{
  const {meter}=evaluatedOverview([card('PASS'),card('NEUTRAL'),card(null),card(null)]);
  expect(meter).toEqual({pass_:1,neutral:1,fail:0,total:4});
  expect(meter.total-meter.pass_-meter.neutral-meter.fail).toBe(2);
 });
});

describe('unpublishedCount',()=>{
 it('counts only folders tied to no team skill',()=>{
  expect(unpublishedCount([card(null,'none'),card(null,'identical'),card(null,'differs')])).toEqual({count:1,unknown:0,total:3});
  expect(unpublishedCount([])).toEqual({count:0,unknown:0,total:0});
 });
 // Until 2026-09-15 one unknown row dashed the whole tile, and since every machine carries a folder the
 // CLI cannot offer (`notOfferedCard` builds its card with no overlay key), the tile never showed a number.
 it('keeps counting what it knows and reports the unknowns beside it',()=>{
  expect(unpublishedCount([card(null,'none'),card(null,null)])).toEqual({count:1,unknown:1,total:2});
  expect(unpublishedLine([card(null,'none'),card(null,null)])).toBe('1 unpublished · 1 with an unknown publish state');
  expect(unpublishedLine([card(null,'none'),card(null,'none'),card(null,null),card(null,null)])).toBe('2 unpublished · 2 with an unknown publish state');
 });
 // The line lives under the Skills tile now (2026-09-21), so an unknown is silence, not a dash: a dash
 // beside "15" would read as a second, broken number.
 it('says nothing rather than a number when nothing at all is known',()=>{
  expect(unpublishedLine([card(null,null),card(null,null)])).toBe('');
  expect(unpublishedLine([])).toBe('');
 });
 it('never claims everything is published while a folder is unaccounted for',()=>{
  expect(unpublishedLine([card(null,'identical'),card(null,null)])).toBe('1 with an unknown publish state');
 });
 // The bundled manual setup places can never become a team skill, so it is neither unpublished nor an
 // unknown: a library of published skills plus the manual still reads a clean sheet.
 it('leaves bundled folders out of the reckoning entirely',()=>{
  expect(unpublishedCount([card(null,'identical'),card(null,null,['bundled'])])).toEqual({count:0,unknown:0,total:1});
  expect(unpublishedLine([card(null,'identical'),card(null,null,['bundled'])])).toBe('All published to the marketplace');
  expect(unpublishedLine([card(null,'none'),card(null,null,['bundled'])])).toBe('1 unpublished');
 });
 it('earns the clean sheet only with no unknowns left, and names a count above zero',()=>{
  expect(unpublishedLine([card(null,'identical'),card(null,'differs')])).toBe('All published to the marketplace');
  expect(unpublishedLine([card(null,'none')])).toBe('1 unpublished');
 });
});
