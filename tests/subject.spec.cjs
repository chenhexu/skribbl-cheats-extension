const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
async function upload(page){await page.goto('/');await page.getByLabel('Upload image',{exact:true}).setInputFiles(path.resolve('tests/fixtures/jet.svg'));await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();}
async function process(page){await page.getByRole('button',{name:'Process image',exact:true}).click();await expect(page.getByRole('button',{name:'Download plan JSON',exact:true})).toBeEnabled({timeout:90000});return page.evaluate(()=>studio.getPlan());}
async function mark(page){await page.getByRole('button',{name:'Mark subject',exact:true}).click();const b=await page.locator('canvas').boundingBox();for(const [x,y]of [[90,310],[205,270],[170,130],[220,120],[325,245],[545,215],[755,295],[655,335],[505,405],[260,410],[215,350],[90,340]])await page.mouse.click(b.x+x*b.width/800,b.y+y*b.height/600);await page.getByRole('button',{name:'Finish subject',exact:true}).click();await expect(page.getByRole('button',{name:'Crop to subject',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();}

test('manual subject selection draws the jet first, skips runway by default, and survives crop/session changes',async({page},info)=>{
  await upload(page);await page.getByLabel('Drawing speed',{exact:true}).selectOption('balanced');const full=await process(page);await mark(page);
  await expect(page.getByLabel('Subject and background',{exact:true})).toHaveValue('subject');await page.getByLabel('Drawing speed',{exact:true}).selectOption('fast');
  const focused=await process(page);expect(focused.focus.method).toBe('manual');expect(focused.strokes.every(s=>s.priority==='subject')).toBe(true);expect(focused.metrics.events).toBeLessThan(full.metrics.events*.5);
  await page.locator('canvas').screenshot({path:info.outputPath('subject-only.png')});await page.getByRole('tab',{name:'Main subject',exact:true}).click();await page.locator('canvas').screenshot({path:info.outputPath('selection.png')});
  await page.getByLabel('Subject and background',{exact:true}).selectOption('subject-background');const later=await process(page);
  expect(later.focus.backgroundOperations).toBeGreaterThan(0);const lastSubject=later.strokes.findLastIndex(s=>s.priority==='subject'),firstBackground=later.strokes.findIndex(s=>s.priority==='background');expect(firstBackground).toBe(lastSubject+1);expect(later.strokes.slice(0,firstBackground).some(s=>s.stage==='outline')).toBe(true);
  const foreground=await page.evaluate(plan=>{const c=document.createElement('canvas');c.width=800;c.height=600;SAGDrawingEngine.renderPlan(c.getContext('2d'),{...plan,strokes:plan.strokes.filter(s=>s.priority==='subject')});return [...c.getContext('2d').getImageData(400,320,1,1).data];},later);
  expect(await page.locator('canvas').evaluate(c=>[...c.getContext('2d').getImageData(400,320,1,1).data])).toEqual(foreground);
  await page.getByRole('tab',{name:'Drawing path',exact:true}).click();await page.getByLabel('Path position',{exact:true}).fill(String(Math.floor(1000*later.strokes.filter(s=>s.priority==='subject').reduce((n,s)=>n+Math.max(1,s.points?.length-1||s.contours.reduce((a,c)=>a+c.length-1,0)+s.seeds.length),0)/later.metrics.moves)));
  await page.locator('canvas').screenshot({path:info.outputPath('subject-before-background.png')});
  await page.getByRole('button',{name:'Crop to subject',exact:true}).click();expect((await page.evaluate(()=>studio.getSession())).crop.w).toBeLessThan(800);await process(page);
  await page.evaluate(async()=>{const el=document.createElement('div');el.id='compact-subject';el.style.width='320px';document.body.append(el);window.subjectPanel=SAGDrawerStudio.mount(el,{compact:true});await subjectPanel.loadSession(studio.getSession());});
  const compact=page.locator('#compact-subject');await expect(compact.getByLabel('Subject and background',{exact:true})).toHaveValue('subject-background');expect(await page.evaluate(()=>subjectPanel.getSession())).toEqual(await page.evaluate(()=>studio.getSession()));
  await compact.screenshot({path:info.outputPath('compact-subject.png')});expect(await compact.evaluate(el=>el.shadowRoot.querySelector('.studio').scrollWidth)).toBeLessThanOrEqual(320);
  await fs.writeFile(info.outputPath('measurements.json'),JSON.stringify({full:full.metrics,subject:focused.metrics,later:later.metrics},null,2));
});

test('real local foreground AI selects a subject and a service failure never silently becomes full-image drawing',async({page,request},info)=>{
  const health=await(await request.get('/health')).json();test.skip(!health.subject?.ready,'Install the optional subject checkpoint and restart the updated service');
  await upload(page);await page.getByLabel('Use main subject',{exact:true}).check();await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();const plan=await process(page);expect(plan.focus.method).toBe('ai');expect(plan.focus.backgroundOperations).toBe(0);expect(plan.focus.area).toBeGreaterThan(1000);expect(plan.crop).toBeNull();await page.locator('canvas').screenshot({path:info.outputPath('ai-subject.png')});
  await page.getByRole('tab',{name:'Main subject',exact:true}).click();await page.locator('canvas').screenshot({path:info.outputPath('ai-selection.png')});
  await page.getByRole('button',{name:'Clear subject',exact:true}).click();await page.route('**/api/subject',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Subject checkpoint missing (test)'})}));
  await page.getByLabel('Subject and background',{exact:true}).selectOption('subject');await page.getByRole('button',{name:'Process image',exact:true}).click();await expect(page.locator('.status')).toContainText('Subject checkpoint missing');await expect(page.getByRole('button',{name:'Download plan JSON',exact:true})).toBeDisabled();expect(await page.evaluate(()=>studio.getPlan())).toBeNull();
  await page.getByRole('button',{name:'Find main subject (AI)',exact:true}).click();await expect(page.locator('.status')).toContainText('Subject checkpoint missing');await expect(page.getByRole('button',{name:'Download plan JSON',exact:true})).toBeDisabled();
  await mark(page);expect((await process(page)).focus.method).toBe('manual');
});

test('Stop and a manual change invalidate an outstanding subject inference',async({page})=>{
  await upload(page);await page.route('**/api/subject',async route=>{await new Promise(resolve=>setTimeout(resolve,500));await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Late subject response'})}).catch(()=>{});});
  await page.getByRole('button',{name:'Find main subject (AI)',exact:true}).click();await expect(page.locator('.status')).toContainText('Finding main subject');await page.getByRole('button',{name:'Stop',exact:true}).click();await expect(page.locator('.status')).toHaveText('Stopped.');await expect(page.getByRole('button',{name:'Crop to subject',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Find main subject (AI)',exact:true}).click();await page.getByLabel('Color count',{exact:true}).fill('7');await expect(page.getByLabel('Auto settings',{exact:true})).not.toBeChecked();await expect(page.getByRole('button',{name:'Crop to subject',exact:true})).toBeDisabled();
});
