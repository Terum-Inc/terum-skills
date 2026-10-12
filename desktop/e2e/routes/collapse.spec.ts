import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { prepare } from '../fidelity/determinism';

test.describe.configure({mode:'parallel'});

async function openLibrary(page:Page,route:string){
 const errors:string[]=[];
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{if(response.status()>=400)errors.push(response.status()+' '+response.url());});
 page.on('requestfailed',request=>errors.push(request.failure()?.errorText+' '+request.url()));
 await prepare(page,{name:'Library collapse',route,klass:'screen',width:1440,height:900});
 return errors;
}

test('sidebar hides, reopens and persists across a bare-route reload',async({page})=>{
 const errors=await openLibrary(page,'#/library/global');
 const left=page.locator('.topbar-left');
 await expect(left).toHaveCSS('width','240px');
 await page.getByRole('button',{name:'Hide sidebar'}).click();
 await expect(page.locator('.sidebar')).toHaveCount(0);
 const show=page.getByRole('button',{name:'Show sidebar'});
 await expect(show).toBeVisible();await expect(show).toHaveAttribute('aria-expanded','false');
 await expect(show).toHaveCSS('width','20px');await expect(show).toHaveCSS('height','20px');
 await expect(show.locator('svg')).toHaveAttribute('width','14');
 await expect(left).toHaveCSS('width','240px');
 await expect(page.locator('.panel')).toHaveCSS('margin','0px 8px 8px');
 await show.click();await expect(page.locator('.sidebar')).toBeVisible();
 await expect(page.getByRole('button',{name:'Show sidebar'})).toHaveCount(0);
 await page.getByRole('button',{name:'Hide sidebar'}).click();
 await page.goto('/#/library/global');await page.reload();
 await expect(page.locator('.sidebar')).toHaveCount(0);await expect(show).toBeVisible();
 await show.click();await page.reload();
 await expect(page.locator('.sidebar')).toBeVisible();
 expect(errors).toEqual([]);
});

for(const {section,label,rows,route} of [
 {section:'projects',label:'Projects',rows:['Terum','SSM','MRF'],route:null},
 {section:'inbox',label:'Inbox',rows:['Pushes','Updates','Alerts'],route:'#/inbox'},
] as {section:string;label:string;rows:string[];route:string|null}[]){
 test(`${label} collapses and restores`,async({page})=>{
  const errors=await openLibrary(page,'#/library/global');
  const nav=page.getByRole('navigation',{name:'Main navigation'});
  const collapse=nav.getByRole('button',{name:'Collapse '+label});
  await expect(collapse).toHaveAttribute('aria-expanded','true');
  for(const row of rows)await expect(nav.getByRole('link',{name:new RegExp('^'+row+' ')})).toBeVisible();
  await collapse.click();
  await expect(page).toHaveURL(new RegExp('#/library/global\\?'+section+'=collapsed$'));
  const expand=nav.getByRole('button',{name:'Expand '+label});
  await expect(expand).toHaveAttribute('aria-expanded','false');
  await expect(expand.locator('.nav-chevron svg')).toHaveAttribute('width','12');
  // The same drawn chevron-right path as the Forward control, at the section's 12px size.
  expect(await expand.locator('.nav-chevron svg').innerHTML()).toBe(await page.getByRole('button',{name:'Forward'}).locator('svg').innerHTML());
  for(const row of rows)await expect(nav.getByRole('link',{name:new RegExp('^'+row+' ')})).toHaveCount(0);
  await expand.click();for(const row of rows)await expect(nav.getByRole('link',{name:new RegExp('^'+row+' ')})).toBeVisible();
  await collapse.click();
  if(route===null){
   // Projects owns no page: the row toggles and the URL keeps only the collapsed flag.
   await expect(nav.locator('a[href="#/marketplace/projects"]')).toHaveCount(0);
   await expect(page).toHaveURL(new RegExp('#/library/global\\?'+section+'=collapsed$'));
  }else{
   await nav.locator('a[href="'+route+'"]').locator('span').first().click();
   await expect(page).toHaveURL(new RegExp(route+'$'));
  }
  await expect(nav.getByRole('button',{name:'Expand '+label})).toBeVisible();
  expect(errors).toEqual([]);
 });
}

for(const {query,hidden,button,rows} of [
 {query:'sidebar=hidden',hidden:true,button:'Show sidebar',rows:[]},
 {query:'projects=collapsed',hidden:false,button:'Expand Projects',rows:['Terum','SSM','MRF']},
 {query:'inbox=collapsed',hidden:false,button:'Expand Inbox',rows:['Pushes','Updates','Alerts']},
]){
 test(`fresh URL ${query} applies without saving a preference`,async({page})=>{
  const errors=await openLibrary(page,'#/library/global?'+query);
  await expect(page.getByRole('button',{name:button})).toBeVisible();
  await expect(page.locator('.sidebar')).toHaveCount(hidden?0:1);
  for(const row of rows)await expect(page.locator('.sidebar').getByRole('link',{name:new RegExp('^'+row+' ')})).toHaveCount(0);
  // Hash navigation also proves the override was not retained in the live store.
  await page.evaluate(()=>{location.hash='#/library/global';});
  await expect(page.locator('.sidebar')).toBeVisible();
  await expect(page.getByRole('button',{name:'Hide sidebar'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Collapse Projects'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Collapse Inbox'})).toBeVisible();
  for(const row of ['Terum','SSM','MRF','Pushes','Updates','Alerts'])await expect(page.locator('.sidebar').getByRole('link',{name:new RegExp('^'+row+' ')})).toBeVisible();
  await page.reload();await expect(page.getByRole('button',{name:'Hide sidebar'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Collapse Projects'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Collapse Inbox'})).toBeVisible();
  expect(errors).toEqual([]);
 });
}

// The third tile is Activation (2026-09-21): the mock's whole-machine firings joined to each root's cards
// by name (lib/activation.ts) — 4 of Global's 15 fired, 3 of the Terum checkout's 8. The publish-state
// count it replaced rides under Skills: Global has one never-published folder, every Terum folder is unknown.
for(const {route,title,values,note} of [
 {route:'#/library/checkout?root=%2FUsers%2Fyou%2Fcode%2Fterum',title:'8 skills',values:['8','7 of 8','3 of 8','5'],note:'6 also on Global'},
 {route:'#/library/global',title:'15 skills',values:['15','13 of 15','4 of 15','6'],note:'7 endorsed to Global'},
]){
 test(`${route} shows only its scoped statistics`,async({page})=>{
  const errors=await openLibrary(page,route);
  await expect(page.locator('.board-view-header').getByText(title,{exact:true})).toBeVisible();
  await expect(page.getByPlaceholder('Search '+title)).toBeVisible();
  await expect(page.locator('.analytics-row .stat-value')).toHaveText(values);
  await expect(page.locator('.analytics-row .stat-label')).toHaveText(['Skills','Evaluated','Activation','Needs attention']);
  await expect(page.locator('.analytics-row').getByText(note,{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
 });
}
