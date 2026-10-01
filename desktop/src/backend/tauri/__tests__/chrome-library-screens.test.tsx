import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BackendContext } from '../../index';
import type { Backend } from '../../Backend';
import { createMockBackend } from '../../mock';
import { App } from '../../../app/App';
import { Providers } from '../../../app/providers';
import { useUiStore } from '../../../app/store';
import { overviewCopy } from '../../../lib/overview-copy';
import { createTauriBackend } from '../index';
import { chromeLibraryReplay, seedCheckout, underHome } from './chrome-library-fixture';
import type { ReplayOptions } from './chrome-library-fixture';

afterEach(()=>{cleanup();location.hash='';localStorage.clear();vi.restoreAllMocks();});
function mount(route:string,backend:Backend){
 useUiStore.setState({railOpen:true,overviewHidden:false});location.hash=route;
 render(<Providers><BackendContext value={backend}><App/></BackendContext></Providers>);
}
function open(options:ReplayOptions={},route='#/library/global'){
 const fake=chromeLibraryReplay(options),backend=createTauriBackend(fake.bridge);mount(route,backend);
 return {fake,backend};
}

it('draws no scan-coverage row, a count-based search label, no empty anchor and no evaluation meter on the real adapter (L2, L3, L8)',async()=>{
 open({local:underHome});await screen.findByTestId('skill-card-deploy-check');
 expect(screen.getByRole('textbox',{name:'Search 1 skill'})).toHaveAttribute('placeholder','Search 1 skill');
 expect(screen.queryByText(/^Scanned: /)).toBeNull();
 for(const link of document.querySelectorAll('.analytics-row a'))expect(link.textContent?.trim()).not.toBe('');
 for(const link of document.querySelectorAll('a'))expect(link).toHaveAccessibleName();
 expect(screen.queryByRole('link',{name:'Open alerts'})).toBeNull();
 expect(document.querySelector('.analytics-meter')).toBeNull();
 const tile=screen.getByText('Evaluated').closest('.stat-tile');
 expect(tile).toHaveTextContent('Evaluated0');expect(tile).toHaveTextContent(overviewCopy.evaluated);expect(tile?.children).toHaveLength(3);
});
it('renders the four zero captions for an empty recording (L7)',async()=>{
 open({local:value=>{const global=value.local[0]!;global.rows=[];global.counts={skillFolders:0,connectable:0};}});
 await screen.findByText('No skills in your global library');
 // `installs` is no longer one of the four: the Activation tile stands where Team installs did.
 for(const caption of [overviewCopy.skills,overviewCopy.evaluated,overviewCopy.activation,overviewCopy.attention])expect(screen.getByText(caption)).toBeVisible();
 expect(screen.queryByText(overviewCopy.installs)).toBeNull();
 expect(screen.queryByRole('alert')).toBeNull();
});
it('keeps the card grid and draws no chrome alert when only the status read fails (C6)',async()=>{
 open({statusError:'Status unavailable.'});
 await screen.findByTestId('skill-card-deploy-check');
 expect(screen.queryByRole('alert')).toBeNull();
 expect(screen.queryByText('Status unavailable.')).toBeNull();
});
it('renders exactly one alert, the screen board, when the library read fails (C6)',async()=>{
 open({localError:'Library unavailable.'});
 expect(await screen.findByRole('alert')).toHaveTextContent('Library unavailable.');
 expect(screen.getAllByRole('alert')).toHaveLength(1);
});
it('renders exactly one alert on the mock error scenario (C6)',async()=>{
 mount('#/library/global?__mock=error',createMockBackend());
 expect(await screen.findByRole('alert')).toHaveTextContent("EACCES: permission denied, scandir '~/.terum/skills'");
 expect(screen.getAllByRole('alert')).toHaveLength(1);
});
it('keeps a reveal failure under the header without replacing the query error (L13)',async()=>{
 const {backend}=open({localError:'Library unavailable.'});
 vi.spyOn(backend,'revealPath').mockResolvedValue({ok:false,error:'Finder unavailable.'});
 await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'Show in Finder'}));
 expect(await screen.findByText('Finder unavailable.')).toBeVisible();
 expect(screen.getByRole('alert')).toHaveTextContent('Library unavailable.');
 fireEvent.click(screen.getByRole('button',{name:'Try again'}));
 await waitFor(()=>expect(screen.queryByText('Finder unavailable.')).toBeNull());
});
it.each([true,false])('keeps the mock meter and gates its attention link on inbox=%s (L4)',async inbox=>{
 const backend=createMockBackend(),surfaces=await backend.surfaces();vi.spyOn(backend,'surfaces').mockResolvedValue({...surfaces,inbox});
 mount('#/library/global',backend);await screen.findByTestId('skill-card-deploy-check');
 expect(document.querySelector('.analytics-meter')).not.toBeNull();
 if(inbox)expect(await screen.findByRole('link',{name:'Open alerts'})).toBeVisible();else await waitFor(()=>expect(screen.queryByRole('link',{name:'Open alerts'})).toBeNull());
 expect(screen.getByRole('textbox',{name:'Search 15 skills'})).toBeVisible();
});

function uncCheckout(){
 const UNC=String.raw`\\wsl.localhost\Ubuntu\home\teniroo`;
 const SKILLS=UNC+String.raw`\.claude\skills`;
 const row=(name:string)=>({name,path:SKILLS+'\\'+name,state:'untracked locally',tracked:false,placement:null,health:'untracked'});
 const fake=chromeLibraryReplay({local:value=>{
  const project=seedCheckout(value,'scanned');
  // A checkout the test shapes itself: no recorded label, so the title is labelOf's own fallback — the root's last segment.
  delete project.label;
  project.root=SKILLS;project.repoRoot=UNC;
  project.rows=[row('alpha'),row('beta')];
  project.notOffered=[{name:'gamma',path:SKILLS+'\\gamma',reason:'name-mismatch',detail:'SKILL.md name not-gamma does not equal folder gamma'}];
 }});
 const backend=createTauriBackend({...fake.bridge,homeDirectory:async()=>String.raw`C:\Users\teddy`,hostPlatform:async()=>'windows'});
 return {UNC,backend};
}
it('prints the count alone beside a UNC checkout title, and keeps the path and GitHub state in the meta slot (W-07)',async()=>{
 const {UNC,backend}=uncCheckout();
 mount('#/library/checkout?root='+encodeURIComponent(UNC),backend);
 await screen.findByTestId('skill-card-alpha');
 const group=document.querySelector('.board-view-header > div') as HTMLElement;
 const spans=[...group.children].filter(el=>el.tagName==='SPAN').map(el=>el.textContent);
 expect(spans[0]).toBe('teniroo');
 expect(spans[1]).toBe('3 skills');
 expect(spans[1]).not.toContain(spans[0]!);
 expect(spans[2]).toBe(UNC+'·GitHub: not connected');
 expect(screen.getByRole('textbox',{name:'Search 3 skills'})).toBeVisible();
 expect(screen.queryByText(/^Scanned: /)).toBeNull();
});
it('resolves a UNC checkout route with a trailing backslash',async()=>{
 const {UNC,backend}=uncCheckout();
 mount('#/library/checkout?root='+encodeURIComponent(UNC+'\\'),backend);
 await screen.findByTestId('skill-card-alpha');
 const spans=[...(document.querySelector('.board-view-header > div') as HTMLElement).children].filter(el=>el.tagName==='SPAN').map(el=>el.textContent);
 expect(spans).toHaveLength(3);
 expect(spans[0]).toBe('teniroo');
 expect(spans[1]).toBe('3 skills');
 expect(screen.queryByRole('alert')).toBeNull();
});
it('draws neither subtitle nor meta while the library read is failing',async()=>{
 open({localError:"EACCES: permission denied, scandir '\\\\wsl.localhost\\Ubuntu\\home\\teniroo'"});
 await screen.findByRole('alert');
 expect(document.querySelector('.board-view-meta')).toBeNull();
 const spans=[...(document.querySelector('.board-view-header > div') as HTMLElement).children].filter(el=>el.tagName==='SPAN');
 expect(spans).toHaveLength(1);
 expect(spans[0]).toHaveTextContent('Global');
});
