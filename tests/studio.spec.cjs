const {test,expect}=require('@playwright/test');
const path=require('node:path');
const fs=require('node:fs/promises');
const flat=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#fff"/><path d="M160 380 Q120 120 400 100 Q650 120 640 380Z" fill="#ef453a" stroke="black" stroke-width="5"/><rect x="190" y="280" width="420" height="80" rx="8" fill="#ed4035"/><circle cx="230" cy="390" r="65" fill="#222"/><circle cx="570" cy="390" r="65" fill="#222"/><circle cx="230" cy="390" r="32" fill="white"/><circle cx="570" cy="390" r="32" fill="white"/></svg>`);
async function upload(page,buffer,name='flat.svg',mimeType='image/svg+xml'){await page.getByLabel('Upload image',{exact:true}).setInputFiles({name,mimeType,buffer});await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();}
async function process(page){await page.getByRole('button',{name:'Process image',exact:true}).click();await expect(page.getByRole('button',{name:'Download plan JSON',exact:true})).toBeEnabled({timeout:90000});}
async function readPlan(page){const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Download plan JSON',exact:true}).click();const file=await downloaded;return JSON.parse(await fs.readFile(await file.path(),'utf8'));}

test('Auto gives colorful shaded artwork more color slots and keeps its large wedges',async({page},info)=>{
  const {wheel,wedgeColors}=require('./fixtures/colorful-art.cjs');
  await page.goto('/');await page.getByLabel('Outline detail',{exact:true}).fill('91');await page.getByLabel('Auto settings',{exact:true}).check();await upload(page,wheel,'colorful-wheel.svg');
  await expect(page.getByLabel('Outline detail',{exact:true})).toHaveValue('91');
  const count=page.getByLabel('Color count',{exact:true});expect(Number(await count.inputValue())).toBeGreaterThan(10);
  await expect(page.locator('.auto-note')).toContainText('Large distinct color regions');
  await process(page);const plan=await readPlan(page);
  expect(plan.settings.colors).toBeGreaterThan(10);expect(plan.settings.colors).toBeLessThanOrEqual(24);expect(plan.settings.detail).toBe(91);
  await page.getByRole('tab',{name:'Simplified colors',exact:true}).click();
  const counts=await page.locator('canvas').evaluate(canvas=>{
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,counts={};
    for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>=128){const key=[pixels[i],pixels[i+1],pixels[i+2]].join(',');counts[key]=(counts[key]||0)+1;}
    return counts;
  });
  for(const hex of wedgeColors){const key=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',');expect(counts[key],hex+' wedge').toBeGreaterThan(3600);}
  await page.locator('#studio').screenshot({path:info.outputPath('colorful-auto-simplified.png')});
  await page.getByRole('tab',{name:'Final drawing',exact:true}).click();await page.locator('#studio').screenshot({path:info.outputPath('colorful-auto-final.png')});
  await fs.writeFile(info.outputPath('colorful-auto-plan.json'),JSON.stringify(plan,null,2));
});

test('upload, crop, browser processing, exact path playback and stale settings',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await upload(page,flat);await process(page);
  const plan=await readPlan(page);expect(plan.version).toBe(2);expect(plan.strokes.length).toBeGreaterThan(0);expect(plan.strokes.some(s=>s.stage==='outline')).toBe(true);expect(plan.strokes.some(s=>s.kind==='region')).toBe(true);expect(plan.metrics.buckets).toBeGreaterThan(0);
  await page.locator('#studio').screenshot({path:info.outputPath('flat-final.png')});
  await page.getByRole('tab',{name:'Drawing path',exact:true}).click();await page.getByLabel('Pen-up travel',{exact:true}).check();await page.getByRole('button',{name:'Play path',exact:true}).click();await expect(page.getByRole('button',{name:'Pause path',exact:true})).toBeVisible();await page.getByRole('button',{name:'Pause path',exact:true}).click();
  await page.getByLabel('Path position',{exact:true}).fill('500');await page.locator('#studio').screenshot({path:info.outputPath('flat-path.png')});
  await page.getByRole('button',{name:'Crop on original',exact:true}).click();const box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+box.width*.15,box.y+box.height*.12);await page.mouse.down();await page.mouse.move(box.x+box.width*.85,box.y+box.height*.82,{steps:5});await page.mouse.up();
  await expect(page.getByRole('button',{name:'Download plan JSON',exact:true})).toBeDisabled();await process(page);const cropped=await readPlan(page);expect(cropped.crop.w).toBeLessThan(800);expect(cropped.crop.h).toBeLessThan(600);
  await page.locator('[name=colors]').fill('4');await expect(page.getByRole('button',{name:'Download plan JSON',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Reset crop',exact:true}).click();await process(page);expect((await readPlan(page)).crop).toBeNull();expect(errors).toEqual([]);
});
test('real local model, service failure and explicit browser recovery',async({page,request},info)=>{
  const health=await(await request.get('/health')).json();test.skip(!health.ready,'Install author checkpoint for real inference');
  await page.goto('/');await upload(page,flat);await page.getByLabel('Line detection',{exact:true}).selectOption('ai');await process(page);const plan=await readPlan(page);expect(plan.settings.detector).toBe('ai');expect(plan.modelMs).toBeGreaterThan(0);expect(plan.strokes.some(s=>s.stage==='outline')).toBe(true);
  await page.locator('#studio').screenshot({path:info.outputPath('flat-ai.png')});
  await page.route('**/api/lineart',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Checkpoint missing (test)'})}));
  await page.getByRole('button',{name:'Process image',exact:true}).click();await expect(page.locator('.status')).toContainText('Checkpoint missing');await expect(page.getByRole('button',{name:'Download plan JSON',exact:true})).toBeDisabled();
  await page.getByLabel('Line detection',{exact:true}).selectOption('browser');await process(page);expect((await readPlan(page)).settings.detector).toBe('browser');
});

test('mountain color coverage meets its border and bucket mode reduces fill input',async({page},info)=>{
  const mountain=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#c1c1c1"/><path d="M30 370L440 40L770 370Z" fill="#505050"/><path d="M440 40L520 370L770 370Z" fill="#777"/><path d="M100 400L135 190L170 400ZM280 400L310 220L350 400ZM640 400L675 165L710 400Z" fill="#004619"/><circle cx="420" cy="280" r="25" fill="white"/></svg>`);
  await page.goto('/');await upload(page,mountain,'mountain.svg');await page.locator('[name=budget]').fill('300');await process(page);
  const bucket=await readPlan(page);expect(bucket.metrics.buckets).toBeGreaterThan(0);
  expect(bucket.strokes.filter(s=>s.kind==='region').length).toBeLessThan(20); // No separate regions for antialias speckles.
  await fs.writeFile(info.outputPath('mountain-plan.json'),JSON.stringify(bucket,null,2));
  await page.locator('canvas').screenshot({path:info.outputPath('mountain-final.png')});
  const pixels=await page.evaluate(()=>{const c=document.querySelector('#studio').shadowRoot.querySelector('canvas'),ctx=c.getContext('2d');const read=(x,y)=>[...ctx.getImageData(x,y,1,1).data].slice(0,3);return {inside:read(400,240),sky:read(100,220),hole:read(420,380)};});
  expect(pixels.inside).toEqual([80,80,80]);expect(pixels.sky).toEqual([193,193,193]);expect(pixels.hole).toEqual([255,255,255]);
  await page.getByRole('tab',{name:'Drawing path',exact:true}).click();await page.getByLabel('Pen-up travel',{exact:true}).check();await page.locator('canvas').screenshot({path:info.outputPath('mountain-path.png')});
  await page.getByLabel('Color filling',{exact:true}).selectOption('strokes');await process(page);const brush=await readPlan(page);
  const E=require('../drawing-engine'),fillCost=p=>p.strokes.filter(s=>s.stage==='fill').reduce((n,s)=>n+E.strokeCost(s),0);
  expect(fillCost(bucket)).toBeLessThan(fillCost(brush));
  await fs.writeFile(info.outputPath('fill-comparison.json'),JSON.stringify({bucket:{...bucket.metrics,fillMs:fillCost(bucket),processingMs:bucket.processingMs},brush:{...brush.metrics,fillMs:fillCost(brush),processingMs:brush.processingMs}},null,2));
});

test('same image and settings give identical panel/viewer colors after a slow draw',async({page})=>{
  await page.goto('/');await upload(page,flat);await process(page);const first=await readPlan(page);
  const before=await page.evaluate(()=>document.querySelector('#studio').shadowRoot.querySelector('canvas').toDataURL());
  await page.evaluate(()=>{window.chrome.storage={local:{get:async()=>({sagEventMs:80})}};});
  await process(page);const repeated=await readPlan(page);
  expect(repeated.strokes).toEqual(first.strokes);expect(repeated.omitted).toEqual(first.omitted);expect(repeated.timing.estimatedMs).toBeGreaterThan(first.metrics.estimatedMs);
  expect(await page.evaluate(()=>document.querySelector('#studio').shadowRoot.querySelector('canvas').toDataURL())).toBe(before);
  await page.evaluate(async()=>{const host=document.createElement('div');host.id='repeat-compact';host.style.width='360px';document.body.append(host);const panel=SAGDrawerStudio.mount(host,{compact:true});const file=document.querySelector('#studio').shadowRoot.querySelector('input[type=file]').files[0];await panel.loadFile(file);window.repeatPanel=panel;});
  const compact=page.locator('#repeat-compact');await compact.getByRole('button',{name:'Process image',exact:true}).click();await expect(compact.getByRole('button',{name:'Download plan JSON',exact:true})).toBeEnabled({timeout:90000});
  expect(await page.evaluate(()=>repeatPanel.getPlan().strokes)).toEqual(first.strokes);
});

test('auto suggests image settings, manual edits keep every other suggestion, and re-enable restores them',async({page},info)=>{
  await page.goto('/');await expect(page.getByLabel('Auto settings',{exact:true})).toBeChecked();await upload(page,flat);
  await expect(page.locator('.auto-note')).not.toContainText('Choosing');
  const values=()=>page.evaluate(()=>Object.fromEntries([...document.querySelector('#studio').shadowRoot.querySelectorAll('.settings [name]')].map(el=>[el.name,el.value])));
  const suggested=await values();await process(page);expect((await readPlan(page)).auto.version).toBe(1);
  await page.getByLabel('Path position',{exact:true}).fill('500');await expect(page.getByLabel('Auto settings',{exact:true})).toBeChecked();
  const edited=String(+suggested.colors+1);await page.getByLabel('Color count',{exact:true}).fill(edited);
  await expect(page.getByLabel('Auto settings',{exact:true})).not.toBeChecked();expect(await values()).toEqual({...suggested,colors:edited});
  await expect(page.getByRole('button',{name:'Download plan JSON',exact:true})).toBeDisabled();await process(page);expect((await readPlan(page)).auto).toBeUndefined();
  // Merely switching Auto off also leaves all slider values in place.
  await page.getByLabel('Auto settings',{exact:true}).check();await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();expect(await values()).toEqual(suggested);
  await page.getByLabel('Auto settings',{exact:true}).uncheck();expect(await values()).toEqual(suggested);
  // Keep the user's detector/time constraints when opting back into Auto.
  await page.getByLabel('Line detection',{exact:true}).selectOption('ai');await page.locator('[name=budget]').fill('30');await page.getByLabel('Auto settings',{exact:true}).check();
  await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();expect((await values()).detector).toBe('ai');expect((await values()).budget).toBe('30');
  await page.locator('#studio').screenshot({path:info.outputPath('auto-settings.png')});
});

test('a delayed auto suggestion cannot overwrite a manual slider adjustment',async({page})=>{
  await page.goto('/');await page.evaluate(()=>{const original=SAGDrawingEngine.suggestSettings;SAGDrawingEngine.suggestSettings=async(...args)=>{const suggestion=await original(...args);await new Promise(resolve=>window.releaseAutoSuggestion=resolve);return suggestion;};});
  await page.getByLabel('Upload image',{exact:true}).setInputFiles({name:'flat.svg',mimeType:'image/svg+xml',buffer:flat});
  await expect.poll(()=>page.evaluate(()=>typeof window.releaseAutoSuggestion)).toBe('function');await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeDisabled();
  await page.getByLabel('Merge similar colors',{exact:true}).fill('29');await expect(page.getByLabel('Auto settings',{exact:true})).not.toBeChecked();
  const manual=await page.evaluate(()=>studio.getSession().settings);await page.evaluate(()=>releaseAutoSuggestion());
  await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();expect(await page.evaluate(()=>studio.getSession().settings)).toEqual(manual);expect(manual.merge).toBe(29);await expect(page.locator('.auto-note')).toContainText('Manual settings');
});

test('auto follows a crop and round-trips Auto/manual settings into the compact viewer',async({page},info)=>{
  const mixed=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><pattern id="texture" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#1644bc"/><rect width="3" height="3" fill="#de8824"/><rect x="3" y="3" width="3" height="3" fill="#fa3467"/></pattern></defs><rect width="400" height="600" fill="#ef130b"/><rect x="400" width="400" height="600" fill="url(#texture)"/></svg>`);
  await page.goto('/');await page.getByLabel('Outline detail',{exact:true}).fill('83');await page.getByLabel('Auto settings',{exact:true}).check();await upload(page,mixed,'mixed.svg');const before=await page.evaluate(()=>studio.getSession());
  await page.getByRole('button',{name:'Crop on original',exact:true}).click();const box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+box.width*.01,box.y+box.height*.01);await page.mouse.down();await page.mouse.move(box.x+box.width*.45,box.y+box.height*.98,{steps:5});await page.mouse.up();
  await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();await expect(page.getByLabel('Auto settings',{exact:true})).toBeChecked();
  const cropped=await page.evaluate(()=>studio.getSession());expect(cropped.settings.colors).toBe(2);expect(cropped.settings.detail).toBe(before.settings.detail);expect(cropped.settings.detail).toBe(83);
  await page.evaluate(async()=>{const host=document.createElement('div');host.id='session-compact';host.style.width='320px';document.body.append(host);window.autoPanel=SAGDrawerStudio.mount(host,{compact:true});await autoPanel.loadSession(studio.getSession());});
  const compact=page.locator('#session-compact');await expect(compact.getByLabel('Auto settings',{exact:true})).toBeChecked();expect(await page.evaluate(()=>autoPanel.getSession())).toEqual(cropped);
  await page.getByLabel('Outline detail',{exact:true}).first().fill('46');const manual=await page.evaluate(()=>studio.getSession());expect(manual.auto).toBe(false);
  await page.evaluate(async()=>autoPanel.loadSession(studio.getSession()));expect(await page.evaluate(()=>autoPanel.getSession())).toEqual(manual);await expect(compact.getByLabel('Auto settings',{exact:true})).not.toBeChecked();
  await compact.screenshot({path:info.outputPath('auto-manual-compact.png')});expect(await compact.evaluate(el=>el.shadowRoot.querySelector('.studio').scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole('button',{name:'Reset crop',exact:true}).first().click();expect((await page.evaluate(()=>studio.getSession())).settings.detail).toBe(46);
  await page.getByLabel('Auto settings',{exact:true}).first().check();await expect(page.getByRole('button',{name:'Process image',exact:true}).first()).toBeEnabled();expect((await page.evaluate(()=>studio.getSession())).settings.detail).toBe(46);
  await upload(page.locator('#studio'),flat);await expect(page.getByLabel('Outline detail',{exact:true}).first()).toHaveValue('46');
});
test('existing line drawing and photograph process in both modes',async({page,request},info)=>{
  const health=await(await request.get('/health')).json(),results=[];
  await page.goto('/');
  await page.addScriptTag({content:await fs.readFile('drawer.js','utf8')});
  for(const file of ['lvl1.jpg','lvl2.avif']){
    await page.getByLabel('Upload image',{exact:true}).setInputFiles(path.resolve(file));await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();
    const data=await fs.readFile(file),mime=file.endsWith('avif')?'image/avif':'image/jpeg';
    const legacy=await page.evaluate(async url=>{const img=new Image();img.src=url;await img.decode();const started=performance.now();const result=window.__skribblDrawer.processImage(img,{density:3,bgThreshold:0,useWhite:true,skipDrawWhite:true,maxPoints:0,style:'realistic'});return {processingMs:performance.now()-started,points:result.points.length,legacyEstimateMs:window.__skribblDrawer.estimateTime(result.points.length,80,10)*1000};},`data:${mime};base64,${data.toString('base64')}`);
    results.push({file,detector:'legacy-realistic',...legacy});
    for(const detector of health.ready?['browser','ai']:['browser']){
      await page.getByLabel('Line detection',{exact:true}).selectOption(detector);await process(page);const plan=await readPlan(page);
      results.push({file,detector,...plan.metrics,processingMs:plan.processingMs,modelMs:plan.modelMs,omitted:plan.omitted});
      await page.locator('canvas').screenshot({path:info.outputPath(file+'-'+detector+'.png')});
    }
  }
  await fs.writeFile(info.outputPath('measurements.json'),JSON.stringify(results,null,2));
});
