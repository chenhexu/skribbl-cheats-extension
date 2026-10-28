const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
async function upload(page){await page.getByLabel('Upload image',{exact:true}).setInputFiles('tests/fixtures/subject-parts.svg');await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();}
async function process(page){await page.getByRole('button',{name:'Process image',exact:true}).click();await expect(page.getByRole('button',{name:'Download plan JSON',exact:true})).toBeEnabled();return page.evaluate(()=>studio.getPlan());}

test('checked subject mode attempts AI and reports failure; unchecked mode processes and remembers full scenery',async({page})=>{
  let requests=0;page.on('request',request=>{if(request.url().includes('/api/subject'))requests++;});
  await page.addInitScript(()=>{if(!sessionStorage.getItem('initial-focus')){localStorage.setItem('sagDrawerPreferences.v1.focus',JSON.stringify('subject-background'));sessionStorage.setItem('initial-focus','set');}});
  await page.goto('/');await upload(page);await expect(page.getByLabel('Use main subject',{exact:true})).toBeChecked();
  await page.route('**/api/subject',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Subject model unavailable (test)'})}));
  await page.getByRole('button',{name:'Process image',exact:true}).click();await expect(page.locator('.status')).toContainText('Subject model unavailable');expect(requests).toBe(1);expect(await page.evaluate(()=>studio.getPlan())).toBeNull();
  await page.getByLabel('Use main subject',{exact:true}).uncheck();await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();await expect(page.getByLabel('Subject and background',{exact:true})).toHaveValue('none');
  const plan=await process(page);expect(plan.focus).toBeUndefined();expect(plan.crop).toBeNull();expect(requests).toBe(1);
  expect(plan.strokes.some(s=>s.stage==='outline'&&s.points.some(p=>p.x>400&&p.y<400))).toBe(true);
  await page.reload();await page.evaluate(()=>studio.ready);await expect(page.getByLabel('Use main subject',{exact:true})).not.toBeChecked();await upload(page);expect((await process(page)).focus).toBeUndefined();expect(requests).toBe(1);
});

test('full scenery restores mountain outlines without changing color/detail settings, selection or crop',async({page},info)=>{
  await page.goto('/');await upload(page);
  await page.evaluate(async()=>{
    const session=studio.getSession(),c=document.createElement('canvas');c.width=800;c.height=600;const ctx=c.getContext('2d'),im=new Image();im.src=session.source;await im.decode();ctx.drawImage(im,0,0);const pixels=ctx.getImageData(0,0,800,600);
    for(let i=0;i<800*600;i++){const j=i*4,r=pixels.data[j],g=pixels.data[j+1],b=pixels.data[j+2],v=r>g*1.4&&g>b*1.2||g>r*1.4?255:0;pixels.data.set([v,v,v,255],j);}ctx.putImageData(pixels,0,0);
    await studio.loadSession({...session,auto:false,settings:{...session.settings,focus:'subject-background',budget:60,colors:24,merge:12,detail:100},subject:{image:c.toDataURL(),method:'ai',modelMs:100}});
  });
  const before=await process(page),session=await page.evaluate(()=>studio.getSession());await page.locator('canvas').screenshot({path:info.outputPath('simplified-background.png')});
  expect(before.strokes.filter(s=>s.priority==='background').every(s=>s.stage==='fill')).toBe(true);await expect(page.locator('.focus-note')).toContainText('without outlines');
  await page.getByLabel('Use main subject',{exact:true}).uncheck();await expect(page.getByRole('button',{name:'Download plan JSON',exact:true})).toBeDisabled();const after=await process(page);
  expect(after.settings).toEqual({...before.settings,focus:'none'});expect(after.focus).toBeUndefined();expect(after.crop).toEqual(session.crop);expect((await page.evaluate(()=>studio.getSession())).subject).toEqual(session.subject);
  const mountain=after.strokes.filter(s=>s.stage==='outline'&&s.points.some(p=>p.x>400&&p.x<780&&p.y<400));expect(mountain.length).toBeGreaterThan(0);expect(after.strokes.some(s=>s.stage==='fill'&&s.colorId===25)).toBe(true);
  await page.locator('canvas').screenshot({path:info.outputPath('full-scenery.png')});await page.locator('#studio').screenshot({path:info.outputPath('scenery-controls.png')});
  await page.getByLabel('Use main subject',{exact:true}).check();await expect(page.getByLabel('Subject and background',{exact:true})).toHaveValue('subject-background');expect((await process(page)).strokes).toEqual(before.strokes);
  await fs.writeFile(info.outputPath('scenery-comparison.json'),JSON.stringify({before:before.metrics,after:after.metrics,mountainOutlinePaths:mountain.length},null,2));
});

test('turning off subject selection cancels pending AI and a late result cannot cut the next plan',async({page},info)=>{
  await page.goto('/');await page.evaluate(()=>{
    document.querySelector('main').hidden=true;document.querySelector('header').hidden=true;const host=document.createElement('div');host.id='scene-compact';host.style.cssText='width:320px;margin:20px';document.body.append(host);
    window.scenePanel=SAGDrawerStudio.mount(host,{compact:true,subjectAI:async(canvas,{signal})=>{window.subjectSignal=signal;return new Promise(resolve=>{window.finishSubject=()=>{const c=document.createElement('canvas');c.width=800;c.height=600;c.getContext('2d').fillRect(0,0,800,600);resolve(c.toDataURL());};});}});
  });
  const panel=page.locator('#scene-compact');await panel.getByLabel('Upload image',{exact:true}).setInputFiles('tests/fixtures/subject-parts.svg');await expect(panel.getByRole('button',{name:'Find main subject (AI)',exact:true})).toBeEnabled();
  await panel.getByRole('button',{name:'Find main subject (AI)',exact:true}).click();await expect(panel.getByLabel('Use main subject',{exact:true})).toBeChecked();await expect(panel.locator('.status')).toContainText('Finding main subject');
  await panel.getByLabel('Use main subject',{exact:true}).uncheck();await page.evaluate(()=>finishSubject());expect(await page.evaluate(()=>subjectSignal.aborted)).toBe(true);await expect(panel.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();
  await panel.getByRole('button',{name:'Process image',exact:true}).click();await expect(panel.getByRole('button',{name:'Download plan JSON',exact:true})).toBeEnabled();const session=await page.evaluate(()=>scenePanel.getSession());expect(session.subject).toBeNull();expect(session.crop).toBeNull();expect(await page.evaluate(()=>scenePanel.getPlan().focus)).toBeUndefined();
  expect(await panel.evaluate(el=>el.shadowRoot.querySelector('.studio').scrollWidth)).toBeLessThanOrEqual(320);await panel.screenshot({path:info.outputPath('scenery-compact.png')});
  await panel.getByLabel('Drawing preview',{exact:true}).screenshot({path:info.outputPath('auto-full-scenery.png')});
});
