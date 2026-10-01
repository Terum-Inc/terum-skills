import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { design } from '../../backend/mock/data';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Providers } from '../../app/providers';
import { BackendContext } from '../../backend';
import { createMockBackend } from '../../backend/mock';
import { ACTIVATION_UNSUPPORTED, Analytics, AnalyticsSkeleton } from './Analytics';
import { overviewCopy } from '../../lib/overview-copy';
import type { LibraryOverview, SkillCard } from '../../backend/types';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

/** design.json predates the Activation tile and the Skills tile's publish-state line (AGENTS.md invariant 3
 *  forbids hand-editing it), so the fixture overview is lifted into the app shape here exactly as the backends lift it. */
const overviewOf=(over:Partial<LibraryOverview>={}):LibraryOverview=>
 ({...design.LIBRARY_OVERVIEW,unpublished_line:'',...over,zero:{...design.LIBRARY_OVERVIEW.zero,activation:overviewCopy.activation,...over.zero}});
/** Only the two fields the Activation tile reads off a card. */
const card=(name:string,flags:SkillCard['flags']=[]):SkillCard=>({name,flags}) as unknown as SkillCard;
/** The mock's fixture report: deploy-check 0/4, release-notes 3/1, test-writer 2/0 (mid-window), pr-review 0/0, env-audit 0/0; incident-triage 1/3 unplaced. */
const GLOBAL=design.SKILLS.map(s=>card(s.name));

/** The row under the mock backend, with the usage feature and read optionally overridden. */
function renderRow(props:{overview?:LibraryOverview;skills?:SkillCard[];zero?:boolean;provenance?:string;onActivation?:()=>void}={},options:{usage?:boolean;usageError?:string}={}){
 const backend=createMockBackend();
 if(options.usage===false){const features=backend.features;vi.spyOn(backend,'features').mockImplementation(async()=>({...await features(),usage:false}));}
 if(options.usageError!==undefined)vi.spyOn(backend,'usage').mockResolvedValue({ok:false,error:options.usageError});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const view=(p:typeof props)=><BackendContext value={backend}><QueryClientProvider client={client}><Analytics overview={p.overview??overviewOf()} skills={p.skills??GLOBAL} {...(p.zero===undefined?{}:{zero:p.zero})} {...(p.provenance===undefined?{}:{provenance:p.provenance})} {...(p.onActivation===undefined?{}:{onActivation:p.onActivation})}/></QueryClientProvider></BackendContext>;
 const result=render(view(props));
 return {...result,backend,rerender:(next:typeof props)=>result.rerender(view(next))};
}
const tile=(label:string)=>screen.getByText(label,{selector:'.stat-label'}).closest('.stat-tile') as HTMLElement;

it('renders the meter and provenance when populated, then only the supplied copy when empty (B1)',async()=>{
 const overview=overviewOf({meter:{pass_:1,neutral:1,fail:1,total:4}}),provenance='test-model · test-cli · k=3';
 const {container,rerender}=render(<Providers><Analytics overview={overview} skills={GLOBAL} provenance={provenance}/></Providers>);
 expect(tile('Evaluated').querySelectorAll('.analytics-meter span')).toHaveLength(4);
 expect(screen.getByText(overview.meter_text)).toBeVisible();expect(screen.getByText(provenance)).toBeVisible();
 // A zero count reads '0'; the row-wide `zero` prop is what draws the '—' glyph (and is covered below).
 const empty=overviewOf({evaluated:'0',meter:{pass_:0,neutral:0,fail:0,total:0},meter_text:overviewCopy.evaluated});
 rerender(<Providers><Analytics overview={empty} skills={GLOBAL} provenance={provenance}/></Providers>);
 expect(screen.getByText('Nothing evaluated yet')).toBeVisible();
 expect(tile('Evaluated').querySelector('.analytics-meter')).toBeNull();expect(screen.queryByText(provenance)).not.toBeInTheDocument();
 rerender(<Providers><Analytics overview={{...empty,meter_text:''}} skills={GLOBAL} provenance={provenance}/></Providers>);
 expect(screen.queryByText('Nothing evaluated yet')).not.toBeInTheDocument();
 expect(tile('Evaluated').querySelector('.analytics-meter')).toBeNull();expect(screen.queryByText(provenance)).not.toBeInTheDocument();
 expect(container.querySelectorAll('.stat-tile')).toHaveLength(4);
});

// The bug: the Evaluated tile drew its count from the eval receipts and its caption from the meter,
// so a backend that reported a count with an unfilled meter rendered "2" over "Nothing evaluated yet".
// The count is the tile's own authority for its empty state now, whatever the meter says.
it.each(['2','13 of 15','1,024'])('never shows the zero caption over a nonzero count (%s)',value=>{
 renderRow({overview:overviewOf({evaluated:value,meter:{pass_:0,neutral:0,fail:0,total:0},meter_text:overviewCopy.evaluated})});
 expect(tile('Evaluated')).toHaveTextContent(value);
 expect(tile('Evaluated')).not.toHaveTextContent('Nothing evaluated yet');
});

it('shows the zero caption when the count is genuinely zero',()=>{
 renderRow({overview:overviewOf({evaluated:'0',meter:{pass_:0,neutral:0,fail:0,total:9},meter_text:overviewCopy.evaluated})});
 expect(tile('Evaluated')).toHaveTextContent('Nothing evaluated yet');
 expect(tile('Evaluated').querySelector('.analytics-meter')).toBeNull();
});

// A dash is what a backend draws when it cannot support a number. It is an unknown, not a zero, so no
// tile may pair it with its zero caption — the same contradiction as "2 · Nothing evaluated yet".
it.each(['—','','unknown'])('never pairs an unknown count with a zero caption (%s)',value=>{
 renderRow({overview:overviewOf({evaluated:value,meter:{pass_:0,neutral:0,fail:0,total:0},meter_text:overviewCopy.evaluated})});
 expect(tile('Evaluated')).not.toHaveTextContent('Nothing evaluated yet');
});

it('draws the count with no zero claim when the number is an unknown, not a zero',()=>{
 renderRow({overview:overviewOf({evaluated:'unknown',meter:{pass_:0,neutral:0,fail:0,total:0},meter_text:''})});
 expect(tile('Evaluated')).toHaveTextContent('unknown');
 expect(tile('Evaluated')).not.toHaveTextContent('Nothing evaluated yet');
});

// Loading is a third state, never a zero: LibraryScreen draws the skeleton while the read is pending,
// so no tile can assert "nothing yet" about data it does not have.
it('keeps loading distinct from zero — the skeleton asserts no counts or captions',()=>{
 const {container}=render(<AnalyticsSkeleton/>);
 expect(container.querySelectorAll('.stat-tile')).toHaveLength(4);
 expect(container).toHaveTextContent('');
 for(const note of Object.values(overviewCopy))expect(screen.queryByText(note)).not.toBeInTheDocument();
 expect(screen.queryByText('Evaluated')).not.toBeInTheDocument();
});

// ---- The Activation tile (2026-09-21): the fourth tile reads `usage` itself and joins it to this root's cards.

it('counts the skills on this board that fired, in three buckets, over one 30-day window',async()=>{
 renderRow();
 const activation=tile('Activation');
 // Global: deploy-check (by name only), release-notes, test-writer, incident-triage (unplaced, still evidence) fired.
 expect(await screen.findByText('4 of 15',{selector:'.stat-value'})).toBeVisible();
 expect(activation).toHaveTextContent('3 chosen by the model · 1 by name only · 11 never fired');
 expect(activation).toHaveTextContent('last 30 days · 1 placed mid-window');
 const segments=activation.querySelectorAll('.analytics-meter span');
 expect(segments).toHaveLength(3);
 expect([...segments].map(s=>(s as HTMLElement).style.flexGrow)).toEqual(['3','1','11']);
 expect(screen.queryByText('Unpublished')).not.toBeInTheDocument();
 expect(screen.queryByText('Team installs')).not.toBeInTheDocument();
});

it('reckons only the cards it was given, so a project root reads its own count',async()=>{
 renderRow({skills:['deploy-check','pr-review','incident-triage','test-writer','onboarding-tour','silent-failure-hunt','env-audit','adr-writer'].map(name=>card(name))});
 expect(await screen.findByText('3 of 8',{selector:'.stat-value'})).toBeVisible();
 expect(tile('Activation')).toHaveTextContent('2 chosen by the model · 1 by name only · 5 never fired');
});

it('draws a skeleton while the firings read is pending, never a number or a zero claim',()=>{
 renderRow();
 const activation=tile('Activation');
 expect(activation.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
 expect(activation).not.toHaveTextContent(/\d/);
 expect(activation).not.toHaveTextContent(overviewCopy.activation);
});

it('reads a dash and the unsupported sentence when the CLI cannot report firings — never a zero',async()=>{
 renderRow({},{usage:false});
 const activation=tile('Activation');
 expect(await screen.findByText(ACTIVATION_UNSUPPORTED)).toBeVisible();
 expect(activation).toHaveTextContent('—');
 expect(activation).not.toHaveTextContent(overviewCopy.activation);
 expect(activation).not.toHaveTextContent(/\d of \d/);
});

it('reads a dash and the CLI error, copyable, when the firings read fails',async()=>{
 renderRow({},{usageError:'could not read transcripts'});
 const activation=tile('Activation');
 expect(await screen.findByText('could not read transcripts')).toBeVisible();
 expect(activation.querySelector('.board-error-line')).not.toBeNull();
 expect(activation).toHaveTextContent('—');
 expect(activation).not.toHaveTextContent(overviewCopy.activation);
});

it('draws the zero caption for an empty library without spending a firings read',async()=>{
 const {backend}=renderRow({zero:true});
 const spy=vi.spyOn(backend,'usage');
 expect(tile('Activation')).toHaveTextContent('0');
 expect(tile('Activation')).toHaveTextContent(overviewCopy.activation);
 await Promise.resolve();
 expect(spy).not.toHaveBeenCalled();
});

it('leaves the bundled manual out of the reckoning and captions an all-bundled board as nothing to fire',async()=>{
 renderRow({skills:[card('terum-skills',['bundled'])]});
 const activation=tile('Activation');
 await screen.findByText(overviewCopy.activation);
 expect(activation).toHaveTextContent('0');
 expect(activation.querySelector('.analytics-meter')).toBeNull();
});

it('reads 0 of N with an all-silent meter when nothing on the board fired, not the empty caption',async()=>{
 renderRow({skills:[card('commit-msg'),card('pr-review')]});
 expect(await screen.findByText('0 of 2',{selector:'.stat-value'})).toBeVisible();
 expect(tile('Activation')).toHaveTextContent('0 chosen by the model · 0 by name only · 2 never fired');
 expect(tile('Activation')).not.toHaveTextContent(overviewCopy.activation);
});

// ---- The Activation popup (2026-09-27): the count opens it; nothing else on the tile does.

it('opens the Activation popup from the count, as a button that says it opens a dialog',async()=>{
 const onActivation=vi.fn();
 renderRow({onActivation});
 await screen.findByText('4 of 15',{selector:'.stat-value'});
 const activation=tile('Activation');
 expect(activation.tagName).toBe('BUTTON');
 expect(activation).toHaveAttribute('aria-haspopup','dialog');
 activation.click();
 expect(onActivation).toHaveBeenCalledTimes(1);
});

it('is no button while there is nothing behind it: loading, unsupported, failed, empty, or with nowhere to open',async()=>{
 const onActivation=vi.fn();
 const {unmount}=renderRow({onActivation});
 expect(tile('Activation').tagName).toBe('DIV');
 unmount();
 for(const [props,options] of [[{onActivation},{usage:false}],[{onActivation},{usageError:'nope'}],[{onActivation,zero:true},{}],[{onActivation,skills:[card('terum-skills',['bundled'])]},{}],[{},{}]] as [NonNullable<Parameters<typeof renderRow>[0]>,NonNullable<Parameters<typeof renderRow>[1]>][]){
  const view=renderRow(props,options);
  // Settled: the tile's number is drawn, not its skeleton.
  await waitFor(()=>expect(tile('Activation').querySelector('.stat-value')?.textContent).toMatch(/—|\d/));
  expect(tile('Activation').tagName).toBe('DIV');
  view.unmount();
 }
 expect(onActivation).not.toHaveBeenCalled();
});

// ---- The publish-state line moved under Skills; it is one line and never a claim over an unknown.

it('captions the Skills tile with the publish-state line beside the fixture note, and drops it when empty',()=>{
 const {rerender}=renderRow({overview:overviewOf({unpublished_line:'3 unpublished'})});
 expect(tile('Skills')).toHaveTextContent('7 endorsed to Global');
 expect(tile('Skills')).toHaveTextContent('3 unpublished');
 rerender({overview:overviewOf({unpublished_line:''})});
 expect(tile('Skills')).toHaveTextContent('7 endorsed to Global');
 expect(tile('Skills')).not.toHaveTextContent('unpublished');
});

it('renders population notes without a sparkline or delta arrows (RM-16)', async () => {
  const { container } = renderRow({overview:overviewOf({unpublished_line:'2 unpublished'})});
  await screen.findByText('4 of 15',{selector:'.stat-value'});
  expect(screen.getByText('7 endorsed to Global')).toBeInTheDocument();
  expect(screen.getByText('2 unpublished')).toBeInTheDocument();
  expect(container.querySelectorAll('svg, .analytics-delta')).toHaveLength(0);
  expect(container).not.toHaveTextContent('this month');
  expect(container).not.toHaveTextContent('this week');
  // Activation is counts and a window, never a rate: no percentage anywhere on the row.
  expect(container.textContent ?? '').not.toMatch(/\d%/);
});

it('keeps the zero-state notes (RM-16)', () => {
  const overview=overviewOf();
  renderRow({overview,zero:true});
  for (const note of [overview.zero.skills,overview.zero.evaluated,overview.zero.activation,overview.zero.attention]) expect(screen.getByText(note)).toBeInTheDocument();
  expect(screen.queryByText(design.LIBRARY_OVERVIEW.skills_note)).not.toBeInTheDocument();
});

it.each([true,false])('omits an empty attention anchor when inbox=%s without dropping attention lines',inbox=>{
 const client=new QueryClient({defaultOptions:{queries:{staleTime:Infinity}}});client.setQueryData(['surfaces'],{inbox});
 const {container}=render(<QueryClientProvider client={client}><Analytics overview={overviewOf({attention_link:''})} skills={GLOBAL}/></QueryClientProvider>);
 expect(container.querySelector('a')).toBeNull();
 for(const line of design.LIBRARY_OVERVIEW.attention_lines)expect(screen.getByText(line)).toBeVisible();
});
