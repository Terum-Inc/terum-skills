import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor,within } from '@testing-library/react';
import { App } from '../../app/App';
import { Providers } from '../../app/providers';
import { PublishRunProvider } from '../../app/PublishRunProvider';
import { useUiStore } from '../../app/store';
import { BackendContext } from '../../backend';
import { createMockBackend } from '../../backend/mock';
import { createRun } from '../../backend/mock/run';
import type { Backend } from '../../backend/Backend';
import { design } from '../../backend/mock/data';
function open(route:string){location.hash=route;return render(<Providers><App/></Providers>);}
beforeEach(()=>{localStorage.clear();useUiStore.setState({railOpen:true,overviewHidden:false,theme:'dark'});});
afterEach(()=>{cleanup();location.hash='';vi.restoreAllMocks();vi.unstubAllGlobals();});
it('renders the Global title and 15 cards without a team-update flag',async()=>{open('#/library/global');expect(await screen.findByText('15 skills')).toBeInTheDocument();expect(screen.getAllByTestId(/^skill-card-/)).toHaveLength(15);expect(screen.getByTestId('skill-card-'+design.SKILLS[design.HOVER_INDEX]!.name).querySelector('[data-flag="update"]')).toBeNull();});
it('renders the no-results query and clears it',async()=>{open('#/library/global?q=deploy%20prod');expect(await screen.findByText('No skills match “deploy prod”')).toBeInTheDocument();fireEvent.click(screen.getAllByRole('button',{name:'Clear search'}).at(-1)!);expect(await screen.findByTestId('skill-card-deploy-check')).toBeInTheDocument();});
it('renders the default SKILL.md with four tabs and frontmatter',async()=>{open('#/skill/deploy-check');expect(await screen.findByRole('heading',{name:'deploy-check'})).toBeInTheDocument();expect(screen.getAllByRole('tab')).toHaveLength(4);expect(screen.getByTestId('frontmatter')).toHaveTextContent('name: deploy-check');expect(screen.getByTestId('frontmatter')).toHaveTextContent('<ajay@terum.ai>');});
it('renders the eval report',async()=>{const backend=createMockBackend(),detail=await backend.skill({ref:'deploy-check'});if(!detail.ok)throw new Error(detail.error);vi.spyOn(backend,'skill').mockResolvedValue({ok:true,value:{...detail.value,versions:{placed:'v3',teamCurrent:'v3',evaluated:'v3'}}});openWith('#/skill/deploy-check?tab=evals',backend);expect(await screen.findByText(/Evaluation of deploy-check/)).toHaveTextContent('Evaluation of deploy-check, Version 3');});
it('renders all four install scope rows and keeps the Marketplace root after install',async()=>{open('#/skill/deploy-check?__mock=not-installed&dialog=install');const dialog=await screen.findByRole('dialog');expect(within(dialog).getAllByRole('radio')).toHaveLength(4);fireEvent.click(within(dialog).getByRole('button',{name:'Install'}));const approval=await screen.findByRole('dialog',{name:'Approve these tools for deploy-check?'});fireEvent.click(within(approval).getByRole('button',{name:'Yes'}));await waitFor(()=>expect(location.hash).toBe('#/skill/deploy-check?root=marketplace'));expect(await screen.findByText('Enabled')).toBeInTheDocument();await waitFor(()=>expect(document.querySelector('.detail-crumbs')).toHaveTextContent('Marketplace'));});
it('renders the partial banner',async()=>{open('#/skill/migration-guard?tab=evals');expect(await screen.findByText('Partial run · 7 of 9 rounds scored · the verdict is greyed until a complete run lands')).toBeInTheDocument();});
it('renders the no-receipt eval state',async()=>{open('#/skill/onboarding-tour?tab=evals');expect(await screen.findByText('Not evaluated', {selector:'.state-title'})).toBeInTheDocument();expect(screen.getByText('Never')).toBeInTheDocument();});
async function openMove(backend:Backend,path='~/.claude/skills/deploy-check'){
 openWith('#/skill/local?path='+encodeURIComponent(path)+'&dialog=file-move',backend);
 const dialog=await screen.findByRole('dialog',{name:'Move deploy-check'});
 await within(dialog).findByRole('option',{name:'SSM'});
 fireEvent.change(within(dialog).getByLabelText('Move to'),{target:{value:'/Users/you/code/ssm'}});
 // No typed confirmation on move/copy/rename since 2026-09-14 — the picker alone arms the action.
 expect(within(dialog).queryByLabelText('Skill name to confirm')).toBeNull();
 return dialog;
}
it('moves the local folder through skillFile.move without install or uninstall',async()=>{
 const backend=createMockBackend(),move=vi.spyOn(backend.skillFile,'move'),install=vi.spyOn(backend,'install'),uninstall=vi.spyOn(backend,'uninstallSkill');
 const dialog=await openMove(backend);fireEvent.click(within(dialog).getByRole('button',{name:'Move'}));
 await within(dialog).findByRole('button',{name:'Done'});
 expect(move).toHaveBeenCalledWith({path:'~/.claude/skills/deploy-check',to:'/Users/you/code/ssm'});expect(install).not.toHaveBeenCalled();expect(uninstall).not.toHaveBeenCalled();
});
// The picker opens on a destination, never on a "Choose destination" row, and never offers the root the
// folder is already in — the CLI refuses that one as the same folder (Ryan, 2026-09-14).
it('opens the move picker on the first other root, omits the root the folder sits in, and moves without a second choice',async()=>{
 const backend=createMockBackend(),move=vi.spyOn(backend.skillFile,'move');
 openWith('#/skill/local?path='+encodeURIComponent('~/.claude/skills/deploy-check')+'&dialog=file-move',backend);
 const dialog=await screen.findByRole('dialog',{name:'Move deploy-check'});
 await within(dialog).findByRole('option',{name:'SSM'});
 const picker=within(dialog).getByLabelText<HTMLSelectElement>('Move to');
 expect([...picker.options].map(option=>option.text)).toEqual(['Terum','SSM','MRF']);
 expect(picker.value).toBe('/Users/you/code/terum');
 const action=within(dialog).getByRole('button',{name:'Move'});expect(action).toBeEnabled();
 fireEvent.click(action);await within(dialog).findByRole('button',{name:'Done'});
 expect(move).toHaveBeenCalledWith({path:'~/.claude/skills/deploy-check',to:'/Users/you/code/terum'});
});
it('offers Global to a folder that sits in a checkout',async()=>{
 const backend=createMockBackend(),path='/Users/you/code/ssm/.claude/skills/';
 const card=(await backend.library({scope:{kind:'checkout',root:'/Users/you/code/ssm'}})).value!.skills[0]!.name;
 openWith('#/skill/local?path='+encodeURIComponent(path+card)+'&dialog=file-copy',backend);
 const dialog=await screen.findByRole('dialog',{name:'Copy '+card});
 const picker=await within(dialog).findByLabelText<HTMLSelectElement>('Copy to');
 expect([...picker.options].map(option=>option.text)).toEqual(['Global','Terum','MRF']);
 expect(picker.value).toBe('global');
});
it('says there is nowhere to move a folder when Global is the only root, and keeps Move disabled',async()=>{
 openWith('#/skill/local?path='+encodeURIComponent('~/.claude/skills/deploy-check')+'&dialog=file-move&__mock=no-projects',createMockBackend());
 const dialog=await screen.findByRole('dialog',{name:'Move deploy-check'});
 expect(await within(dialog).findByText(/Global is the only Library root on this machine/)).toBeVisible();
 expect(within(dialog).queryByLabelText('Move to')).toBeNull();
 expect(within(dialog).getByRole('button',{name:'Move'})).toBeDisabled();
});
it('copies the local folder into the other root through skillFile.copy, leaves the source listed, and returns to the Library',async()=>{
 const backend=createMockBackend(),copy=vi.spyOn(backend.skillFile,'copy'),install=vi.spyOn(backend,'install'),uninstall=vi.spyOn(backend,'uninstallSkill');
 openWith('#/skill/local?path='+encodeURIComponent('~/.claude/skills/deploy-check')+'&dialog=file-copy',backend);
 const dialog=await screen.findByRole('dialog',{name:'Copy deploy-check'});
 await within(dialog).findByRole('option',{name:'SSM'});
 fireEvent.change(within(dialog).getByLabelText('Copy to'),{target:{value:'/Users/you/code/ssm'}});
 expect(within(dialog).queryByLabelText('Skill name to confirm')).toBeNull();
 fireEvent.click(within(dialog).getByRole('button',{name:'Copy'}));
 expect(await within(dialog).findByText('Copied ~/.claude/skills/deploy-check to /Users/you/code/ssm/.claude/skills/deploy-check.')).toBeVisible();
 expect(copy).toHaveBeenCalledWith({path:'~/.claude/skills/deploy-check',to:'/Users/you/code/ssm'});
 expect(install).not.toHaveBeenCalled();expect(uninstall).not.toHaveBeenCalled();
 fireEvent.click(within(dialog).getByRole('button',{name:'Done'}));
 await waitFor(()=>expect(location.hash).toBe('#/library/global'));
 // The source is still a card in the root it was copied from: a copy takes nothing away.
 expect(await screen.findByTestId('skill-card-deploy-check')).toBeInTheDocument();
});
it('shows a failed local move without running install or uninstall',async()=>{
 const backend=createMockBackend();vi.spyOn(backend.skillFile,'move').mockImplementation(()=>createRun(async()=>({ok:false,error:'Destination unavailable.'})));
 const uninstall=vi.spyOn(backend,'uninstallSkill'),dialog=await openMove(backend);fireEvent.click(within(dialog).getByRole('button',{name:'Move'}));
 expect(await screen.findByText('Destination unavailable.')).toBeVisible();expect(uninstall).not.toHaveBeenCalled();
});

// §5.2: there is no pull request any more. What the notice has to distinguish is the three things a
// publish can actually have done — minted a version, matched one that already existed, or only added
// the skill to a project — because they are not the same news. `project` is null for the ordinary
// publish, which targets the marketplace and lists the skill under no project at all.
it.each([
  [{version:'v3',created:true,identicalTo:null,projectAdded:false,project:null},'deploy-check was published to the marketplace as Version 3.'],
  [{version:'v3',created:true,identicalTo:null,projectAdded:true,project:'Payments'},'deploy-check was published to the marketplace and Payments as Version 3.'],
  [{version:null,created:false,identicalTo:'v2',projectAdded:true,project:'Payments'},'deploy-check was added to Payments; its bytes are identical to Version 2.'],
  [{version:null,created:false,identicalTo:'v2',projectAdded:false,attachedEvals:2,project:null},'Attached 2 eval run(s) to Version 2 in the marketplace; identical skill bytes minted no version.'],
  [{version:null,created:false,identicalTo:'v2',projectAdded:false,project:null},'deploy-check is already Version 2 in the marketplace; nothing to publish.'],
])('names what the publish actually did: %j',async(outcome,text)=>{
 const backend=createMockBackend();
 const detail=await backend.skill({ref:'deploy-check'});
 if(!detail.ok)throw new Error('fixture detail unavailable');
 vi.spyOn(backend,'skill').mockResolvedValue({ok:true,value:{...detail.value,teamState:'shared'}});
 const publish=vi.spyOn(backend,'publish').mockImplementation(()=>createRun(async()=>({ok:true,value:{name:'deploy-check',attachedEvals:0,profileAdded:false,...outcome}})) as never);
 openWith('#/skill/deploy-check?dialog=publish',backend);
 fireEvent.click(within(await screen.findByRole('dialog',{name:'Publish deploy-check to the team?'})).getByRole('button',{name:'Publish'}));
 await waitFor(()=>expect(publish).toHaveBeenCalledWith(expect.objectContaining({ref:'deploy-check'})));
 expect(await screen.findByRole('status')).toHaveTextContent(text);
});

// §8.6: `publishAction` loses all three `teamState` branches -- the gate is the local folder alone.
// A skill the team already has IS publishable: that is how its next version ships (§5.1 step 9 mints
// highest+1, and identical bytes mint nothing). The old endorsement-era refusal is gone with §12.
it('opens the publish dialog for a skill the team already has, gating on the local folder',async()=>{
 openWith('#/skill/deploy-check?dialog=publish',createMockBackend());
 expect(await screen.findByRole('dialog',{name:'Publish deploy-check to the team?'})).toBeInTheDocument();
});

it('refuses the publish dialog for a skill with no folder on this machine',async()=>{
 const backend=createMockBackend();
 const detail=await backend.skill({ref:'deploy-check'});
 if(!detail.ok)throw new Error('fixture detail unavailable');
 vi.spyOn(backend,'skill').mockResolvedValue({ok:true,value:{...detail.value,path:null}});
 openWith('#/skill/deploy-check?dialog=publish',backend);
 expect(await screen.findByRole('heading',{name:'deploy-check'})).toBeInTheDocument();
 expect(screen.queryByRole('dialog')).toBeNull();
});

it('removes a skill through the run and returns to Library',async()=>{open('#/skill/deploy-check?dialog=remove');const dialog=await screen.findByRole('dialog');fireEvent.click(within(dialog).getByRole('button',{name:'Remove'}));await waitFor(()=>expect(location.hash).toBe('#/library/global'));});
it('closes eval dialog after a successful run',async()=>{open('#/skill/deploy-check?tab=evals&dialog=run-eval');const dialog=await screen.findByRole('dialog');fireEvent.click(within(dialog).getByRole('button',{name:'Run eval'}));await waitFor(()=>expect(location.hash).toBe('#/skill/deploy-check?tab=evals'));});
it('persists favorites',async()=>{open('#/library/global');const card=await screen.findByTestId('skill-card-deploy-check');fireEvent.click(within(card).getByRole('button',{name:'Favorite deploy-check'}));expect(localStorage.getItem('terum-skills-app:pref:favorite:deploy-check')).toBe('false');});
it('renders unknown skill errors with a settled readiness marker',async()=>{open('#/skill/unknown-skill');expect(await screen.findByRole('alert')).toHaveTextContent('No skill named unknown-skill.');await waitFor(()=>expect(document.documentElement.dataset.appReady).toBe('true'));});
it('uses the default tab for unknown values',async()=>{open('#/skill/deploy-check?tab=unexpected');expect(await screen.findByTestId('frontmatter')).toBeInTheDocument();expect(screen.getByRole('tab',{name:'SKILL.md'})).toHaveAttribute('aria-selected','true');});
it('renders disabled status without opacity fading',async()=>{open('#/skill/deploy-check?__mock=disabled');expect(await screen.findByText('Disabled')).toBeInTheDocument();expect(screen.getByText('On disk, not loaded')).toBeInTheDocument();expect(screen.getByRole('switch')).toHaveAttribute('aria-checked','false');});
it('commits the loading skeleton and readiness without waiting on a pending query',async()=>{open('#/skill/deploy-check?__mock=loading');await waitFor(()=>expect(document.documentElement.dataset.appReady).toBe('true'));expect(screen.queryByText(/S1b builds this/)).toBeNull();expect(screen.queryByRole('heading')).toBeNull();});
it('cancels install without running it',async()=>{open('#/skill/deploy-check?__mock=not-installed&dialog=install');const dialog=await screen.findByRole('dialog');fireEvent.click(within(dialog).getByRole('button',{name:'Cancel'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(location.hash).toBe('#/skill/deploy-check?__mock=not-installed');expect(screen.getByText('Not installed')).toBeInTheDocument();});
it('dismisses a dialog with Escape',async()=>{open('#/skill/deploy-check?dialog=remove');await screen.findByRole('dialog');fireEvent.keyDown(document.activeElement??document.body,{key:'Escape'});await waitFor(()=>expect(location.hash).toBe('#/skill/deploy-check'));});
it('surfaces a failed switch write on the card and puts the switch back',async()=>{const backend=createMockBackend();vi.spyOn(backend,'setSkillEnabled').mockReturnValue(createRun(async()=>({ok:false,error:'Cannot edit ~/.claude/settings.json: it is not valid JSON. Fix it by hand or move it aside, then re-run.'})));openWith('#/library/global',backend);const card=await screen.findByTestId('skill-card-deploy-check');fireEvent.click(within(card).getByRole('switch'));expect(await within(card).findByRole('alert')).toHaveTextContent('Cannot edit ~/.claude/settings.json: it is not valid JSON. Fix it by hand or move it aside, then re-run.');expect(within(card).getByRole('switch')).toHaveAttribute('aria-checked','true');});
it('copies the exact share command and expires its confirmation',async()=>{const writeText=vi.fn().mockResolvedValue(undefined);vi.stubGlobal('navigator',Object.assign(Object.create(navigator),{clipboard:{writeText}}));open('#/skill/deploy-check');await screen.findByRole('heading',{name:'deploy-check'});fireEvent.click(screen.getByRole('button',{name:'Copy command'}));expect(await screen.findByRole('tooltip')).toHaveTextContent('Copied');expect(writeText).toHaveBeenCalledWith('npx -y terum-skills@latest install terum/team-skills/deploy-check@5f0e12ab9c3d');await waitFor(()=>expect(screen.queryByRole('tooltip')).toBeNull(),{timeout:2000});vi.unstubAllGlobals();});
it.each([
 ['#/library/global?__mock=empty','No skills in your global library'],
 ['#/library/global?__mock=error',"Couldn't read your library"],
 ['#/skill/deploy-check?__mock=error',"Couldn't read deploy-check"],
 ['#/skill/deploy-check?tab=quality','Coming soon'],
 ['#/skill/deploy-check?tab=activity','Since placement'],
 ['#/skill/deploy-check?menu=files','3 files'],
 ['#/skill/deploy-check?tab=evals&rail=closed&full=1','Coverage and provenance'],
])('reaches the real board content at %s',async(route,text)=>{open(route);expect(await screen.findByText(text)).toBeInTheDocument();expect(screen.queryByText(/S1b builds this/)).toBeNull();await waitFor(()=>expect(document.documentElement.dataset.appReady).toBe('true'));});
it('can reopen persisted collapsed overview and rail',async()=>{useUiStore.setState({overviewHidden:true});open('#/library/global');await screen.findByText('15 skills');fireEvent.click(screen.getByRole('button',{name:'Show overview'}));expect(await screen.findByText('Activation',{selector:'.stat-label'})).toBeInTheDocument();cleanup();useUiStore.setState({railOpen:false});open('#/skill/deploy-check');await screen.findByRole('heading',{name:'deploy-check'});fireEvent.click(screen.getByRole('button',{name:'Open details rail'}));expect(await screen.findByText('Status')).toBeInTheDocument();});
it('binds the inbox placeholder to the share selection and clears unknown ids',async()=>{const view=open('#/inbox');await waitFor(()=>expect(view.container.querySelector('[data-selected-id="share-secret-scan"]')).not.toBeNull());cleanup();const unknown=open('#/inbox/unknown');await waitFor(()=>expect(document.documentElement.dataset.appReady).toBe('true'));expect(unknown.container.querySelector('[data-selected-id]')).toBeNull();});

it('keeps the Library usable with no team',async()=>{open('#/library/global?__mock=no-team');expect(await screen.findByTestId('skill-card-deploy-check')).toBeVisible();expect(screen.queryByText('No team on this machine')).toBeNull();});
it('keeps the skill title as the only link without making the article interactive',async()=>{
 open('#/library/global');
 const card=await screen.findByTestId('skill-card-deploy-check');
 expect(within(card).getAllByRole('link')).toHaveLength(1);
 expect(within(card).getByRole('link',{name:'deploy-check'})).toHaveAttribute('href','#/skill/local?path='+encodeURIComponent('~/.claude/skills/deploy-check'));
 expect(card.tagName).toBe('ARTICLE');
 expect(card).not.toHaveAttribute('role');
 expect(card).not.toHaveAttribute('tabindex');
});
it('keeps switch and favorite clicks on the library route',async()=>{
 open('#/library/global');
 const card=await screen.findByTestId('skill-card-deploy-check');
 const toggle=within(card).getByRole('switch');
 expect(toggle.closest('a')).toBeNull();
 fireEvent.click(toggle);
 expect(toggle).toHaveAttribute('aria-checked','false');
 expect(location.hash).toBe('#/library/global');
 const favorite=within(card).getByRole('button',{name:'Favorite deploy-check'});
 expect(favorite.tagName).toBe('BUTTON');
 expect(favorite.closest('a')).toBeNull();
 fireEvent.click(favorite);
 expect(favorite).toHaveAttribute('aria-pressed','false');
 expect(location.hash).toBe('#/library/global');
});
it('keeps the marketplace skill link and install button destinations distinct',async()=>{
 open('#/marketplace/people/lena');
 const card=await screen.findByTestId('skill-card-a11y-audit');
 expect(within(card).getAllByRole('link')).toHaveLength(1);
 expect(within(card).getByRole('link',{name:'a11y-audit'})).toHaveAttribute('href','#/skill/a11y-audit?root=marketplace');
 fireEvent.click(within(card).getByRole('button',{name:'More actions for a11y-audit'}));
 fireEvent.click(await screen.findByRole('menuitem',{name:'Install…'})); // No `__mock=not-installed`: scenarios are a fixture affordance and must never ride along on a real navigation.
 await waitFor(()=>expect(location.hash).toBe('#/skill/a11y-audit?dialog=install&root=marketplace'));
 expect(await screen.findByRole('dialog',{name:'Install a11y-audit'})).toBeVisible();
});
it('stretches the card title link over the card so a body click opens the SKILL.md detail',async()=>{
 open('#/library/global');
 const card=await screen.findByTestId('skill-card-deploy-check');
 const link=within(card).getByRole('link',{name:'deploy-check'});
 expect(link).toHaveAttribute('href','#/skill/local?path='+encodeURIComponent('~/.claude/skills/deploy-check'));
 fireEvent.click(link);
 await waitFor(()=>expect(location.hash).toBe('#/skill/local?path='+encodeURIComponent('~/.claude/skills/deploy-check')));
 expect(await screen.findByTestId('frontmatter')).toBeInTheDocument();
 expect(screen.getByRole('tab',{name:'SKILL.md'})).toHaveAttribute('aria-selected','true');
});
it('shows the truthful recorded state as Reinstall, never plain Install',async()=>{
 const backend=createMockBackend();const library=await backend.library({scope:{kind:'global'}});if(!library.ok)throw new Error(library.error);
 vi.spyOn(backend,'library').mockResolvedValue({...library,value:{...library.value,skills:library.value.skills.map(s=>s.name==='deploy-check'?{...s,teamed:true,installed:'recorded' as const,placed:false,onDiskOnly:false}:s)}});
 const detail=await backend.skill({ref:'deploy-check'});if(!detail.ok)throw new Error(detail.error);
 vi.spyOn(backend,'skill').mockResolvedValue({...detail,value:{...detail.value,installed:'recorded' as const,placed:false,onDiskOnly:false}});
 openWith('#/library/global',backend);
 const card=await screen.findByTestId('skill-card-deploy-check');
 // #131 moved install out of the card footer into the ⋯ menu, so the recorded state states itself there.
 expect(within(card).queryByRole('switch')).toBeNull();
 expect(within(card).queryByText('Install')).toBeNull();
 fireEvent.click(within(card).getByRole('button',{name:'More actions for deploy-check'}));
 const row=await screen.findByRole('menuitem',{name:/^Reinstall…/});
 expect(row).toHaveAttribute('title','Installed · not on this machine.');
 expect(row).toHaveTextContent('Installed · not on this machine.');
 fireEvent.click(row);
 await waitFor(()=>expect(location.hash).toBe('#/skill/deploy-check?dialog=install'));
 expect(await screen.findByRole('dialog')).toBeInTheDocument();
});

it('keeps install and uninstall in the card menu alone, with no button of their own',async()=>{
 open('#/marketplace/people/lena');
 const card=await screen.findByTestId('skill-card-a11y-audit');
 expect(within(card).queryByRole('button',{name:'Install'})).toBeNull();
 expect(document.querySelector('.market-card-install')).toBeNull();
 expect(document.querySelector('.card-install')).toBeNull();
});

// The publish run lives in `Providers`, above this backend override, so a nearer `PublishRunProvider` keeps the run on the mock (see publishing.test.tsx).
function openWith(route:string,backend:Backend){location.hash=route;return render(<Providers><BackendContext value={backend}><PublishRunProvider><App/></PublishRunProvider></BackendContext></Providers>);}
it('preserves checkout root and URL state across search and overview changes',async()=>{
 const root='/Users/you/code/mrf';open('#/library/checkout?root='+encodeURIComponent(root)+'&q=migration&overview=0&__mock=missing-root&theme=light');
 expect(await screen.findByRole('link',{name:'MRF 2'})).toHaveAttribute('aria-current','page');
 await screen.findByText('2 skills');
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'csv'}});
 fireEvent.click(screen.getByRole('button',{name:'Show overview'}));
 await waitFor(()=>{const params=new URLSearchParams(location.hash.split('?')[1]);expect(params.get('root')).toBe(root);expect(params.get('q')).toBe('csv');expect(params.get('overview')).toBeNull();expect(params.get('__mock')).toBe('missing-root');expect(params.get('theme')).toBe('light');});
 fireEvent.click(screen.getByRole('button',{name:'Hide overview'}));
 await waitFor(()=>expect(new URLSearchParams(location.hash.split('?')[1]).get('overview')).toBe('0'));
});
it('requires a checkout root before calling library',async()=>{
 const backend=createMockBackend(),library=vi.spyOn(backend,'library');openWith('#/library/checkout',backend);
 expect(await screen.findByRole('alert')).toHaveTextContent('No checkout selected.');expect(library).not.toHaveBeenCalled();
 await waitFor(()=>expect(document.documentElement.dataset.appReady).toBe('true'));
});
// `project` carries the root a folder lives in ('Global', or a checkout's basename) and says
// nothing about team membership, so these fixtures keep a realistic root label: a card that
// routes by path only because the test typed the word 'local' into `project` would pass even
// after the adapter stopped emitting it, which is how the route broke in the first place.
it('opens a local card by folder path — the title link, with no Open row left in the menu',async()=>{
 const backend=createMockBackend(),result=await backend.library({scope:{kind:'global'}});if(!result.ok)throw new Error(result.error);
 const path='/a folder/.claude/skills/deploy-check';result.value.skills=[{...result.value.skills[0]!,name:'deploy-check',project:'Global',teamed:false,path}];
 vi.spyOn(backend,'library').mockResolvedValue(result);openWith('#/library/global',backend);
 const card=await screen.findByTestId('skill-card-deploy-check');expect(within(card).getByRole('link')).toHaveAttribute('href','#/skill/local?path='+encodeURIComponent(path));
 fireEvent.click(within(card).getByRole('button',{name:'More actions for deploy-check'}));
 expect(await screen.findByRole('menuitem',{name:'Move to…'})).toBeInTheDocument();
 expect(screen.queryByRole('menuitem',{name:'Open'})).toBeNull();
});
it.each([['Run eval','&tab=evals&dialog=run-eval'],['Delete…','&dialog=file-delete'],['Move to…','&dialog=file-move'],['Copy to…','&dialog=file-copy']])('routes %s on a local card by path, not by name',async(item,query)=>{
 const backend=createMockBackend(),result=await backend.library({scope:{kind:'global'}});if(!result.ok)throw new Error(result.error);
 const path='/a folder/.claude/skills/deploy-check';
 result.value.skills=[{...result.value.skills[0]!,name:'deploy-check',project:'Global',teamed:false,placed:true,path}];
 vi.spyOn(backend,'library').mockResolvedValue(result);openWith('#/library/global',backend);
 const card=await screen.findByTestId('skill-card-deploy-check');
 fireEvent.click(within(card).getByRole('button',{name:'More actions for deploy-check'}));
 fireEvent.click(await screen.findByRole('menuitem',{name:item}));
 await waitFor(()=>expect(location.hash).toBe('#/skill/local?path='+encodeURIComponent(path)+query));
});
it('sends a team card by name and keeps the marketplace origin',async()=>{
 const backend=createMockBackend();openWith('#/marketplace',backend);
 const card=await screen.findByTestId('skill-card-deploy-check');
 expect(within(card).getByRole('link')).toHaveAttribute('href','#/skill/deploy-check?root=marketplace');
});
// The old screen answered every name-route failure with "listed in your people file but its
// folder is missing", and offered Sync and Remove. A name the team does not share is now reported
// as not-found, where both halves of that sentence would be false and both buttons wrong, so
// neither may come back on this branch.
it('never claims a missing folder or offers Sync/Remove when a name is not in the team',async()=>{
 const backend=createMockBackend(),error='No unambiguous skill diagnose in team acme.';
 vi.spyOn(backend,'skill').mockResolvedValue({ok:false,error,reason:'not-found' as const});
 openWith('#/skill/diagnose',backend);
 expect(await screen.findByText("Couldn't find diagnose")).toBeVisible();
 expect(screen.getByRole('alert')).toHaveTextContent(error);
 expect(screen.queryByText(/listed in your people file/)).toBeNull();
 expect(screen.queryByText(/folder is missing from this machine/)).toBeNull();
 expect(screen.queryByRole('button',{name:'Sync now'})).toBeNull();
 expect(screen.queryByRole('button',{name:/^Remove/})).toBeNull();
 const panel=document.querySelector('.centered-state')!;
 expect(within(panel as HTMLElement).getByRole('button',{name:'Back to library'})).toBeVisible();
 expect(within(panel as HTMLElement).getByRole('button',{name:'Search the marketplace'})).toBeVisible();
 expect(within(panel as HTMLElement).queryByRole('button',{name:'Open marketplace'})).toBeNull();
});
it('reports an unreadable name-route failure with the CLI message and can retry',async()=>{
 const backend=createMockBackend(),error='fatal: could not read the team clone';
 vi.spyOn(backend,'skill').mockResolvedValue({ok:false,error,reason:'unreadable' as const});
 openWith('#/skill/deploy-check',backend);
 expect(await screen.findByText("Couldn't read deploy-check")).toBeVisible();
 expect(screen.getByRole('alert')).toHaveTextContent(error);
 expect(screen.queryByText(/listed in your people file/)).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Try again'}));
 await waitFor(()=>expect(backend.skill).toHaveBeenCalledTimes(2));
});
it.each([true,false])('keeps a local error honest and never offers project removal (typed=%s)',async typed=>{
 const backend=createMockBackend(),error='Raw CLI failure for /tmp/a';
 vi.spyOn(backend,'localSkill').mockResolvedValue({ok:false,error,...(typed?{reason:'not-in-library' as const}:{})});
 const remove=vi.spyOn(backend.projects,'remove');openWith('#/skill/local?path=%2Ftmp%2Fa',backend);
 expect(await screen.findByText(typed?'Not in your library':"Couldn't read a")).toBeVisible();
 expect(screen.getByRole('alert')).toHaveTextContent(error);
 expect(screen.queryByRole('button',{name:/Remove|Forget/i})).toBeNull();expect(remove).not.toHaveBeenCalled();
 const board=document.querySelector('.centered-state')??screen.getByText(typed?'Not in your library':"Couldn't read a").parentElement!;
 expect(within(board as HTMLElement).getByRole('button',{name:'Back to library'})).toBeVisible();
 expect(screen.queryByRole('button',{name:'Try again'})!==null).toBe(!typed);
 if(!typed){fireEvent.click(screen.getByRole('button',{name:'Try again'}));await waitFor(()=>expect(backend.localSkill).toHaveBeenCalledTimes(2));}
});
it('names the checkout a local folder was resolved in, from the backend',async()=>{
 const backend=createMockBackend();
 openWith('#/skill/local?path='+encodeURIComponent('/Users/you/code/ssm/.claude/skills/deploy-check'),backend);
 await screen.findByRole('heading',{name:'deploy-check'});
 expect(screen.getByRole('link',{name:/^SSM/})).toHaveAttribute('aria-current','page');
 expect(screen.getByRole('link',{name:/^Global/})).not.toHaveAttribute('aria-current');
 expect(document.querySelector('.detail-crumbs')).toHaveTextContent('SSM');
});

it.each(['none-with-skills','none-empty','unreadable'] as const)('shows the appropriate Library board for %s',async mode=>{
 const backend=createMockBackend(),result=await backend.library({scope:{kind:'global'}});if(!result.ok)throw new Error(result.error);
 vi.spyOn(backend,'catalog').mockResolvedValue({ok:false,error:'clone denied'});
 if(mode==='none-empty')result.value.skills=[];
 vi.spyOn(backend,'library').mockResolvedValue(result);openWith('#/library/global',backend);
 if(mode==='none-empty'){expect(await screen.findByText('Skills in ~/.claude/skills and in the projects you add show up here.')).toBeVisible();}
 else {expect(await screen.findByTestId('skill-card-deploy-check')).toBeVisible();expect(screen.queryByText('No team on this machine')).toBeNull();}
 expect(screen.queryByText(/Team unreadable/)).toBeNull();
});
it('removes a placed local detail through D6, including an old remove bookmark',async()=>{
 const backend=createMockBackend(),remove=vi.spyOn(backend.skillFile,'delete');
 openWith('#/skill/local?path=%2Ftmp%2Fdeploy-check&dialog=remove',backend);
 const dialog=await screen.findByRole('dialog');
 fireEvent.change(within(dialog).getByLabelText('Skill name to confirm'),{target:{value:'deploy-check'}});
 fireEvent.click(within(dialog).getByRole('button',{name:'Delete'}));
 await waitFor(()=>expect(remove).toHaveBeenCalledWith({path:'/tmp/deploy-check'}));
 fireEvent.click(await screen.findByRole('button',{name:'Done'}));
 await waitFor(()=>expect(location.hash).toBe('#/library/global'));
});
it('resets a local action error when navigating to another path',async()=>{
 const backend=createMockBackend();vi.spyOn(backend,'openInEditor').mockResolvedValue({ok:false,error:'Editor refused first folder'});
 openWith('#/skill/local?path=%2Ffirst%2Fdeploy-check',backend);
 fireEvent.click(await screen.findByRole('button',{name:'Edit'}));expect(await screen.findByRole('alert')).toHaveTextContent('Editor refused first folder');
 location.hash='#/skill/local?path=%2Fsecond%2Fdeploy-check';fireEvent(window,new HashChangeEvent('hashchange'));
 // The failed action leaves the first page (and its heading) up, so wait for the second page itself before
 // asserting the error is gone; otherwise the check runs against the page being navigated away from.
 await waitFor(()=>expect(document.querySelector('.detail-repo')).toHaveTextContent('/second/deploy-check'));
 expect(screen.getByRole('heading',{name:'deploy-check'})).toBeVisible();expect(screen.queryByRole('alert')).toBeNull();
});
// The Library Connect CTA was removed on 2026-09-10 (ratified override): global skills
// auto-share at sync by ID check, and the
// empty state's primary is the manual project path — the sidebar's native Add project flow (#102).
it('the empty library offers Add project as its primary and drives the chooser into project add',async()=>{
 const backend=createMockBackend();const pick=vi.spyOn(backend,'pickFolder');const add=vi.spyOn(backend.projects,'add');
 openWith('#/library/global?__mock=empty',backend);
 await screen.findByText('No skills in your global library');
 expect(screen.queryByRole('button',{name:'Connect'})).toBeNull();
 fireEvent.click(screen.getAllByRole('button',{name:'Add project'}).at(-1)!);
 await waitFor(()=>expect(add).toHaveBeenCalledWith('/Users/you/code/new-project'));
 expect(pick).toHaveBeenCalledOnce();
});
it('the empty library degrades its primary to the marketplace link when the CLI has no project add',async()=>{
 const backend=createMockBackend();const features=await backend.features();
 vi.spyOn(backend,'features').mockResolvedValue({...features,libraryProjects:false});
 openWith('#/library/global?__mock=empty',backend);
 await screen.findByText('No skills in your global library');
 expect(screen.queryByRole('button',{name:'Add project'})).toBeNull();
 fireEvent.click(screen.getAllByRole('button',{name:'Open marketplace'}).at(-1)!);
 await waitFor(()=>expect(location.hash).toBe('#/marketplace'));
});

it('preserves the mock breadcrumb',async()=>{
 open('#/skill/deploy-check');
 await screen.findByRole('heading',{name:'deploy-check'});
 expect(document.querySelector('.detail-crumbs')?.textContent).toBe('Global/terum/infra/deploy-check');
});
// Skipped 2026-09-14: the Quality panel is behind QUALITY_ACTIVITY_SHIPPED (SkillScreen.tsx), so the
// fixture's hygiene caption has nowhere to render. Un-skip when the tab ships.
it.skip('shows the fixture hygiene caption on Quality',async()=>{
 open('#/skill/deploy-check');
 await screen.findByRole('heading',{name:'deploy-check'});
 fireEvent.click(screen.getByRole('tab',{name:'Quality'}));
 expect(screen.getByText('Hygiene checks · passed on connect, 12 days ago · free, no model calls')).toBeVisible();
});

const terumOrigin='root=%2FUsers%2Fyou%2Fcode%2Fterum';
it.each([['Run eval','tab=evals&dialog=run-eval'],['Delete…','dialog=file-delete'],['Move to…','dialog=file-move'],['Copy to…','dialog=file-copy']])('carries the checkout root from a project card into its %s menu row',async(label,query)=>{
 open('#/library/checkout?'+terumOrigin);
 const card=await screen.findByTestId('skill-card-deploy-check');
 expect(within(card).getAllByRole('link')).toHaveLength(1);
 expect(within(card).getByRole('link')).toHaveAttribute('href','#/skill/local?path='+encodeURIComponent('/Users/you/code/terum/.claude/skills/deploy-check'));
 fireEvent.click(within(card).getByRole('button',{name:'More actions for deploy-check'}));
 fireEvent.click(await screen.findByRole('menuitem',{name:label}));
 await waitFor(()=>expect(location.hash).toBe('#/skill/local?path='+encodeURIComponent('/Users/you/code/terum/.claude/skills/deploy-check')+(query?'&'+query:'')));
});
it('keeps Global-library and marketplace card links exactly as they were',async()=>{
 open('#/library/global');
 expect(within(await screen.findByTestId('skill-card-deploy-check')).getByRole('link')).toHaveAttribute('href','#/skill/local?path='+encodeURIComponent('~/.claude/skills/deploy-check'));
 cleanup();open('#/marketplace/people/lena');
 expect(within(await screen.findByTestId('skill-card-a11y-audit')).getByRole('link')).toHaveAttribute('href','#/skill/a11y-audit?root=marketplace');
});
it('names the project in the crumb, the sidebar and the back arrow of a scoped page',async()=>{
 open('#/skill/deploy-check?'+terumOrigin);
 await screen.findByRole('heading',{name:'deploy-check'});
 expect(document.querySelector('.detail-crumbs')?.textContent).toMatch(/^Terum\//);
 expect(screen.getByRole('link',{name:/^Terum/})).toHaveAttribute('aria-current','page');
 expect(screen.getByRole('link',{name:/^Global/})).not.toHaveAttribute('aria-current');
 fireEvent.click(screen.getByRole('button',{name:'Back to library'}));
 await waitFor(()=>expect(location.hash).toBe('#/library/checkout?'+terumOrigin));
});
it('says Remove from the project, not from Global, on a scoped page',async()=>{
 open('#/skill/deploy-check?'+terumOrigin+'&dialog=remove');
 const dialog=await screen.findByRole('dialog',{name:'Remove deploy-check?'});
 expect(dialog).toHaveTextContent('Remove from Terum.');
 expect(screen.getByRole('button',{name:'Remove from Terum',hidden:true})).toBeInTheDocument();
});
it('keeps the Marketplace crumb and back arrow on the not-installed board',async()=>{
 open('#/skill/deploy-check?__mock=not-installed');
 await screen.findByRole('heading',{name:'deploy-check'});
 expect(document.querySelector('.detail-crumbs')?.textContent).toMatch(/^Marketplace\//);
 expect(screen.getByRole('link',{name:/^Marketplace/})).toHaveAttribute('aria-current','page');
 fireEvent.click(screen.getByRole('button',{name:'Back to library'}));
 await waitFor(()=>expect(location.hash).toBe('#/marketplace'));
});
it.each(['','&'+terumOrigin])('preselects Global in the install dialog whatever the origin (%s)',async origin=>{
 open('#/skill/deploy-check?__mock=not-installed&dialog=install'+origin);
 const dialog=await screen.findByRole('dialog');
 expect(within(dialog).getAllByRole('radio')).toHaveLength(4);
 expect(within(dialog).getByRole('radio',{name:/Global.*every session.*~\/.claude\/skills/})).toBeChecked();
});
// 2026-09-14 (Ajay): a finished move returns to the list it was started from, whichever root that was —
// the same place delete already went. Following `destination` to /skill/local?path=… made a by-path read
// the landing page, which answers "Not in your library" until the moved folder is scanned again.
it.each([true,false])('returns to the Library root the move was started from (project %s)',async project=>{
 const backend=createMockBackend(),dialog=await openMove(backend,project?'/Users/you/code/terum/.claude/skills/deploy-check':'~/.claude/skills/deploy-check');
 fireEvent.click(within(dialog).getByRole('button',{name:'Move'}));fireEvent.click(await within(dialog).findByRole('button',{name:'Done'}));
 await waitFor(()=>expect(location.hash).toBe(project?'#/library/checkout?'+terumOrigin:'#/library/global'));
 // The board that greets the reader is the Library, never a detail page that cannot find the folder it
 // just moved; the card is gone from this root because the folder is, which is the truthful answer.
 expect(await screen.findByText(/^\d+ skills?$/)).toBeVisible();
 expect(screen.queryByTestId('skill-card-deploy-check')).toBeNull();
 expect(screen.queryByText('Not in your library')).toBeNull();
 expect(screen.queryByText(/^Couldn['’]t (find|read)/)).toBeNull();
});
// hybrid review r1 (high): after a successful move the dialog showed Done, but Escape or an outside
// click fired onClose, so the page stayed on ?path=<old> and reported the moved folder as not in the
// Library. Any dismissal of a finished dialog is Done.
it('hands a finished file operation on when the dialog is dismissed with Escape',async()=>{
 const backend=createMockBackend(),dialog=await openMove(backend);fireEvent.click(within(dialog).getByRole('button',{name:'Move'}));
 await within(dialog).findByRole('button',{name:'Done'});
 fireEvent.keyDown(document.activeElement??document.body,{key:'Escape'});
 await waitFor(()=>expect(location.hash).toBe('#/library/global'));
});
// A cancelled or refused CLI result lands in useWorkflow.notice and closes the dialog; the dialog owned
// the workflow, so the notice unmounted with it and the user saw nothing (AGENTS.md: a Result.ok===false
// renders the board's error state). The page owns the workflow now and renders the notice.
it('shows the CLI notice when a file operation is cancelled or refused',async()=>{
 const backend=createMockBackend();vi.spyOn(backend.skillFile,'delete').mockImplementation(()=>createRun(async()=>({ok:false,cancelled:true,error:'The name did not match; nothing changed.'})));
 openWith('#/skill/local?path='+encodeURIComponent('~/.claude/skills/deploy-check')+'&dialog=file-delete',backend);
 const dialog=await screen.findByRole('dialog');fireEvent.change(within(dialog).getByLabelText('Skill name to confirm'),{target:{value:'deploy-check'}});fireEvent.click(within(dialog).getByRole('button',{name:'Delete'}));
 expect(await screen.findByText('The name did not match; nothing changed.')).toBeVisible();
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
});
it('cancels a move before it starts and stays on the source page',async()=>{
 const backend=createMockBackend(),move=vi.spyOn(backend.skillFile,'move'),dialog=await openMove(backend);
 fireEvent.click(within(dialog).getByRole('button',{name:'Cancel'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(move).not.toHaveBeenCalled();expect(new URLSearchParams(location.hash.split('?')[1]).get('path')).toBe('~/.claude/skills/deploy-check');
});

it('switches a skill through the CLI verb on its folder path, never through an app preference',async()=>{
 const backend=createMockBackend();const toggled=vi.spyOn(backend,'setSkillEnabled');
 openWith('#/skill/local?path='+encodeURIComponent('/Users/you/code/ssm/.claude/skills/deploy-check'),backend);
 fireEvent.click(await screen.findByRole('switch',{name:'Enable skill'}));
 await waitFor(()=>expect(toggled).toHaveBeenCalledWith({path:'/Users/you/code/ssm/.claude/skills/deploy-check',enabled:false}));
 // Nothing is keyed on the route segment, and the value is not the app's to remember: the mock's own verb stores it, as the CLI writes skillOverrides.
 expect(localStorage.getItem('terum-skills-app:pref:enabled:local')).toBeNull();
 await waitFor(()=>expect(screen.getByRole('switch',{name:'Enable skill'})).toHaveAttribute('aria-checked','false'));
});
it('surfaces a failed switch write in the detail rail without leaving the page, and puts the switch back',async()=>{
 const backend=createMockBackend();vi.spyOn(backend,'setSkillEnabled').mockReturnValue(createRun(async()=>({ok:false,error:'Cannot edit ~/.claude/settings.json: it is not valid JSON. Fix it by hand or move it aside, then re-run.'})));
 openWith('#/skill/local?path='+encodeURIComponent('/Users/you/code/ssm/.claude/skills/deploy-check'),backend);
 fireEvent.click(await screen.findByRole('switch',{name:'Enable skill'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Cannot edit ~/.claude/settings.json: it is not valid JSON. Fix it by hand or move it aside, then re-run.');
 expect(screen.getByRole('switch',{name:'Enable skill'})).toHaveAttribute('aria-checked','true');
 expect(screen.getByRole('heading',{name:'deploy-check'})).toBeInTheDocument();
});
it('the Library card switch calls the same verb with the card\'s folder path',async()=>{
 const backend=createMockBackend();const toggled=vi.spyOn(backend,'setSkillEnabled');
 openWith('#/library/global',backend);
 fireEvent.click(await screen.findByRole('switch',{name:'Enable deploy-check'}));
 await waitFor(()=>expect(toggled).toHaveBeenCalledWith({path:expect.stringMatching(/deploy-check$/),enabled:false}));
 await waitFor(()=>expect(screen.getByRole('switch',{name:'Enable deploy-check'})).toHaveAttribute('aria-checked','false'));
});
it('keeps checkout selection and back navigation on a scoped page whose read failed',async()=>{
 const backend=createMockBackend();
 vi.spyOn(backend,'skill').mockResolvedValue({ok:false,error:"EACCES: permission denied, scandir '~/.terum/skills'",reason:'unreadable'});
 openWith('#/skill/deploy-check?'+terumOrigin,backend);
 await screen.findByText("Couldn't read deploy-check");
 // §4.8(e)'s exact expression falls back to Global without a detail; §7.4 test 43's Terum crumb conflicts with it.
 expect(document.querySelector('.detail-crumbs')?.textContent).toBe('Global/deploy-check');
 expect(screen.getByRole('link',{name:/^Terum/})).toHaveAttribute('aria-current','page');
 fireEvent.click(screen.getByRole('button',{name:'Back to library'}));
 await waitFor(()=>expect(location.hash).toBe('#/library/checkout?'+terumOrigin));
});
it('resets an action error when navigating to another origin of the same skill',async()=>{
 const backend=createMockBackend();vi.spyOn(backend,'openInEditor').mockResolvedValue({ok:false,error:'Editor refused first root'});
 openWith('#/skill/deploy-check?'+terumOrigin,backend);
 fireEvent.click(await screen.findByRole('button',{name:'Edit'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Editor refused first root');
 location.hash='#/skill/deploy-check?root=%2FUsers%2Fyou%2Fcode%2Fssm';fireEvent(window,new HashChangeEvent('hashchange'));
 // As above: wait for the other origin's page, not the heading both pages share.
 await waitFor(()=>expect(document.querySelector('.detail-crumbs')?.textContent).toMatch(/^SSM\//));
 expect(screen.getByRole('heading',{name:'deploy-check'})).toBeVisible();
 expect(screen.queryByRole('alert')).toBeNull();
});
it('maps the reachable global root URL to a global scope',async()=>{
 const backend=createMockBackend(),skill=vi.spyOn(backend,'skill');
 openWith('#/skill/deploy-check?root=global',backend);
 await screen.findByRole('heading',{name:'deploy-check'});
 expect(skill).toHaveBeenCalledWith({ref:'deploy-check',at:{kind:'global'}},expect.objectContaining({signal:expect.any(AbortSignal)}));
 expect(screen.getByRole('link',{name:/^Global/})).toHaveAttribute('aria-current','page');
});

it.each([true,false])('locks the Move confirmation while the file operation is in flight (%s)',async progress=>{
 const backend=createMockBackend();const features=await backend.features();vi.spyOn(backend,'features').mockResolvedValue({...features,progress});
 let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
 vi.spyOn(backend.skillFile,'move').mockImplementation(()=>createRun(async()=>{await held;return {ok:true,value:{kind:'move',path:'~/.claude/skills/deploy-check',destination:'/new/deploy-check',quarantined:null,installed:false,notices:['Moved local files.']}};}));
 const dialog=await openMove(backend);fireEvent.click(within(dialog).getByRole('button',{name:'Move'}));await waitFor(()=>expect(within(dialog).getByRole('button',{name:'Move'})).toBeDisabled());release();expect(await within(dialog).findByRole('status')).toHaveTextContent('Moved local files.');
});

it.each(['report','empty'] as const)('keeps the Evals %s Run eval control disabled with the path reason',async state=>{
 const backend=createMockBackend(),result=await backend.skill({ref:'deploy-check'});if(!result.ok)throw new Error(result.error);
 vi.spyOn(backend,'skill').mockResolvedValue({ok:true,value:{...result.value,path:null,...(state==='empty'?{receipt:null,summary:null}:{} )}});
 openWith('#/skill/deploy-check?tab=evals',backend);const button=await screen.findByRole('button',{name:'Run eval'});expect(button).toBeDisabled();expect(screen.getByText('Install it first — evals run against the copy on your machine.')).toBeVisible();
});
// Rename asks for the new name and nothing else; delete keeps the CLI's typed-name confirmation, which
// is the one D6 mode that is not undone by running the same verb again (Ryan, 2026-09-14).
it.each(['rename','delete'] as const)('the file %s dialog explains consequences, arms on its own field, and calls only its seam',async kind=>{
 const backend=createMockBackend(),method=vi.spyOn(backend.skillFile,kind);
 openWith('#/skill/local?path='+encodeURIComponent('~/.claude/skills/deploy-check')+'&dialog=file-'+kind,backend);
 const dialog=await screen.findByRole('dialog'),action=within(dialog).getByRole('button',{name:kind==='rename'?'Rename':'Delete'});expect(action).toBeDisabled();
 if(kind==='rename'){expect(dialog).toHaveTextContent('invocation name');expect(dialog).toHaveTextContent('Version 1');expect(within(dialog).queryByLabelText('Skill name to confirm')).toBeNull();fireEvent.change(within(dialog).getByLabelText('New name'),{target:{value:'new-name'}});}
 else {expect(dialog).toHaveTextContent('removes it from your installs');fireEvent.change(within(dialog).getByLabelText('Skill name to confirm'),{target:{value:'deploy-check'}});}
 expect(action).toBeEnabled();fireEvent.click(action);await within(dialog).findByRole('button',{name:'Done'});expect(method).toHaveBeenCalledWith({path:'~/.claude/skills/deploy-check',...(kind==='rename'?{to:'new-name'}:{})});
});

it.each([false,true])('shows local receipt attribution or the stale-score explanation on the card (edited %s)',async edited=>{
 const backend=createMockBackend(),library=await backend.library({scope:{kind:'global'}}),detail=await backend.skill({ref:'deploy-check'});
 if(!library.ok||!detail.ok||!detail.value.summary)throw new Error('Missing receipt fixture');
 const card={...library.value.skills[0]!,name:'deploy-check',teamed:false,edited,summary:edited?null:detail.value.summary,localEval:edited?null:{...detail.value.summary,runnerHandle:'mira',version:'v4'},localEvalStale:edited};
 vi.spyOn(backend,'library').mockResolvedValue({ok:true,value:{...library.value,skills:[card]}});openWith('#/library/global',backend);
 const face=await screen.findByTestId('skill-card-deploy-check');
 expect(face).toHaveTextContent(edited?'Evaluated before your last edit':'run by mira · v4');
 // 2026-09-14: the stale note no longer opens with "Not evaluated" — it contradicted its own second half, and the
 // lift figure's verdict is where "Not evaluated" belongs, so the words appear once on the card, not twice.
 if(edited){expect(within(face).getByText('Edited')).toBeVisible();expect(within(face).queryAllByText('Not evaluated')).toHaveLength(1);expect(within(face).getByText('Not evaluated')).toHaveClass('no-verdict');}
});
it.each(['evals','run-eval','publish'])('excludes an inspected-invalid local folder from %s while keeping its reason visible',async entry=>{
 const backend=createMockBackend(),result=await backend.localSkill({path:'~/.claude/skills/deploy-check'});if(!result.ok)throw new Error(result.error);
 vi.spyOn(backend,'localSkill').mockResolvedValue({ok:true,value:{...result.value,flags:['broken'],flagText:{broken:'Invalid YAML'},teamed:false}});
 openWith('#/skill/local?path='+encodeURIComponent('~/.claude/skills/deploy-check')+(entry==='evals'?'&tab=evals':'&dialog='+entry),backend);
 await screen.findByRole('heading',{name:'deploy-check'});
 if(entry==='run-eval'){const dialog=await screen.findByRole('dialog');expect(dialog).toHaveTextContent('Invalid YAML');expect(within(dialog).queryByRole('button',{name:'Run eval'})).toBeNull();}
 else if(entry==='publish'){const dialog=await screen.findByRole('dialog');expect(dialog).toHaveTextContent('Invalid YAML');expect(within(dialog).getByRole('button',{name:'Publish'})).toBeDisabled();}
 else expect(screen.getByRole('button',{name:'Run eval'})).toBeDisabled();
});
