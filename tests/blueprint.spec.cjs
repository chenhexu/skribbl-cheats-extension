const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
async function process(page){await page.getByRole('button',{name:'Process image',exact:true}).click();await expect(page.getByRole('button',{name:'Download plan JSON',exact:true})).toBeEnabled({timeout:90000});return page.evaluate(()=>studio.getPlan());}
async function plan(page){const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download plan JSON',exact:true}).click();return JSON.parse(await fs.readFile(await(await pending).path(),'utf8'));}

test('blueprint Auto uses one background and white strokes, reduces overdraw, and preserves manual treatment/session',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
  await page.getByLabel('Upload image',{exact:true}).setInputFiles(path.resolve('tests/fixtures/blueprint.svg'));
  await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();
  await expect(page.getByLabel('Drawing treatment',{exact:true})).toHaveValue('light-lines');await expect(page.getByLabel('Color count',{exact:true})).toBeEnabled();
  await process(page);const light=await plan(page);
  expect(light.auto.kind).toBe('blueprint');expect(light.strokes.filter(s=>s.stage==='fill')).toHaveLength(1);expect(light.metrics.buckets).toBe(1);expect(light.metrics.colorChanges).toBe(2);
  expect([...new Set(light.strokes.map(s=>s.colorId))]).toEqual([15,0]);expect(light.strokes.filter(s=>s.stage==='fill').every(s=>s.optional===false)).toBe(true);
  await page.locator('canvas').screenshot({path:info.outputPath('light-lines-final.png')});
  const pixels=await page.evaluate(()=>{const ctx=document.querySelector('#studio').shadowRoot.querySelector('canvas').getContext('2d'),p=ctx.getImageData(0,0,800,600).data;let dark=0;for(let i=0;i<p.length;i+=4)if(Math.max(p[i],p[i+1],p[i+2])<195&&Math.max(p[i],p[i+1],p[i+2])-Math.min(p[i],p[i+1],p[i+2])<5)dark++;return {dark,background:[...ctx.getImageData(48,48,1,1).data]};});
  expect(pixels.dark).toBe(0);expect(pixels.background).toEqual([0,86,158,255]);
  await page.getByLabel('Drawing treatment',{exact:true}).selectOption('regions');await page.getByLabel('Color count',{exact:true}).fill('3');await page.getByLabel('Drawing speed',{exact:true}).selectOption('balanced');
  await expect(page.getByLabel('Auto settings',{exact:true})).not.toBeChecked();await process(page);const standard=await plan(page);
  await page.locator('canvas').screenshot({path:info.outputPath('standard-final.png')});expect(light.metrics.events).toBeLessThan(standard.metrics.events*.5);expect(light.metrics.strokes).toBeLessThan(standard.metrics.strokes*.5);
  await fs.writeFile(info.outputPath('measurements.json'),JSON.stringify({light:light.metrics,standard:standard.metrics},null,2));
  await page.getByLabel('Auto settings',{exact:true}).check();await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();await expect(page.getByLabel('Drawing treatment',{exact:true})).toHaveValue('light-lines');
  await page.getByLabel('Outline detail',{exact:true}).fill('65');await expect(page.getByLabel('Auto settings',{exact:true})).not.toBeChecked();
  await page.evaluate(async()=>{const host=document.createElement('div');host.id='compact-blueprint';host.style.width='320px';document.body.append(host);window.compactBlueprint=SAGDrawerStudio.mount(host,{compact:true});await compactBlueprint.loadSession(studio.getSession());});
  const compact=page.locator('#compact-blueprint');await expect(compact.getByLabel('Drawing treatment',{exact:true})).toHaveValue('light-lines');await expect(compact.getByLabel('Outline detail',{exact:true})).toHaveValue('65');await expect(compact.getByLabel('Auto settings',{exact:true})).not.toBeChecked();expect(errors).toEqual([]);
});

test('blueprint manual handoff keeps values and every setting editable in both viewers',async({page},info)=>{
  await page.goto('/');await page.getByLabel('Upload image',{exact:true}).setInputFiles(path.resolve('tests/fixtures/blueprint.svg'));
  await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();await process(page);
  const suggested=await page.evaluate(()=>studio.getSession().settings);
  await page.getByLabel('Auto settings',{exact:true}).uncheck();
  expect(await page.evaluate(()=>studio.getSession().settings)).toEqual(suggested);
  await expect(page.getByRole('button',{name:'Download plan JSON',exact:true})).toBeDisabled();
  expect(await page.locator('.settings [name]:disabled').count()).toBe(0);
  await page.evaluate(async()=>{const host=document.createElement('div');host.id='manual-blueprint';host.style.width='320px';document.body.append(host);window.manualBlueprint=SAGDrawerStudio.mount(host,{compact:true});await manualBlueprint.loadSession(studio.getSession());});
  const compact=page.locator('#manual-blueprint');await expect(compact.getByLabel('Auto settings',{exact:true})).not.toBeChecked();expect(await compact.locator('.settings [name]:disabled').count()).toBe(0);
  expect(await page.evaluate(()=>manualBlueprint.getSession().settings)).toEqual(suggested);
  await compact.screenshot({path:info.outputPath('manual-controls.png')});
  await compact.getByText('More drawing settings',{exact:true}).click();await compact.getByLabel('Merge similar colors',{exact:true}).fill('18');
  expect(await page.evaluate(()=>manualBlueprint.getSession().settings)).toEqual({...suggested,merge:18,treatment:'regions'});
  await compact.screenshot({path:info.outputPath('manual-color-region-controls.png')});
  for(const [name,label,value]of [['colors','Color count',4],['merge','Merge similar colors',18],['bgThreshold','Near-white removal',40]]){
    // Each color-region control is editable directly from Auto as well as manual.
    await page.getByLabel('Auto settings',{exact:true}).first().check();await expect(page.getByRole('button',{name:'Process image',exact:true}).first()).toBeEnabled();
    if(name!=='colors')await page.getByLabel('Auto settings',{exact:true}).first().uncheck();
    await page.getByLabel(label,{exact:true}).first().fill(String(value));
    await expect(page.getByLabel('Auto settings',{exact:true}).first()).not.toBeChecked();await expect(page.getByLabel('Drawing treatment',{exact:true}).first()).toHaveValue('regions');
    expect(await page.evaluate(()=>studio.getSession().settings)).toEqual({...suggested,[name]:value,treatment:'regions'});
    await expect(page.locator('#studio').locator('.auto-note')).toContainText('Drawing treatment changed');
  }
  await page.locator('#studio').getByRole('button',{name:'Process image',exact:true}).click();await expect(page.locator('#studio').getByRole('button',{name:'Download plan JSON',exact:true})).toBeEnabled();
  const result=await page.evaluate(()=>studio.getPlan());expect(result.settings.bgThreshold).toBe(40);expect(result.settings.treatment).toBe('regions');expect(result.auto).toBeUndefined();
});

test('local AI comparison retains white ink without black or gray overpainting',async({page,request},info)=>{
  const health=await(await request.get('/health')).json();test.skip(!health.ready,'Optional local checkpoint unavailable');
  await page.goto('/');await page.getByLabel('Upload image',{exact:true}).setInputFiles(path.resolve('tests/fixtures/blueprint.svg'));await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();
  await page.getByLabel('Line detection',{exact:true}).selectOption('ai');await process(page);const drawing=await plan(page);
  expect(drawing.settings.treatment).toBe('light-lines');expect(drawing.modelMs).toBeGreaterThan(0);expect(drawing.strokes.some(s=>s.stage==='outline')).toBe(true);expect([...new Set(drawing.strokes.map(s=>s.colorId))]).toEqual([15,0]);
  await page.locator('canvas').screenshot({path:info.outputPath('ai-light-lines.png')});await fs.writeFile(info.outputPath('measurements.json'),JSON.stringify({...drawing.metrics,modelMs:drawing.modelMs,processingMs:drawing.processingMs},null,2));
});
