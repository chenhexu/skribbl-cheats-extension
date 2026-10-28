const {test,expect}=require('@playwright/test');
async function setup(page){
  await page.goto('/');await page.evaluate(()=>{
    document.querySelector('main').hidden=true;document.querySelector('header').hidden=true;const host=document.createElement('div');host.id='subject-process';host.style.cssText='max-width:850px;margin:20px';document.body.append(host);
    const c=document.createElement('canvas');c.width=800;c.height=600;const ctx=c.getContext('2d');ctx.fillStyle='black';ctx.fillRect(0,0,800,600);ctx.fillStyle='white';ctx.fillRect(70,70,660,460);const mask=c.toDataURL();
    window.subjectCalls=0;window.colorCalls=0;const process=SAGDrawingEngine.processRGBA;SAGDrawingEngine.processRGBA=(...args)=>{colorCalls++;return process(...args);};
    window.subjectProcessPanel=SAGDrawerStudio.mount(host,{subjectAI:async()=>{subjectCalls++;if(window.failSubject)throw new Error('Extension context invalidated.');if(window.holdSubject)await new Promise(resolve=>window.releaseSubject=resolve);return mask;}});
  });
  const panel=page.locator('#subject-process');await panel.getByLabel('Upload image',{exact:true}).setInputFiles('tests/fixtures/precision.svg');await expect(panel.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();await panel.getByLabel('Use main subject',{exact:true}).check();await expect(panel.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();return panel;
}
async function process(page,panel){await panel.getByRole('button',{name:'Process image',exact:true}).click();await expect(panel.getByRole('button',{name:'Download plan JSON',exact:true})).toBeEnabled();return page.evaluate(()=>subjectProcessPanel.getPlan());}

test('Process finds a checked subject once, reuses AI/manual selections and leaves unchecked full images alone',async({page},info)=>{
  const panel=await setup(page),first=await process(page,panel);expect(first.focus.method).toBe('ai');expect(first.crop).toBeNull();expect(await page.evaluate(()=>subjectCalls)).toBe(1);await panel.screenshot({path:info.outputPath('automatic-subject-process.png')});
  expect((await process(page,panel)).strokes).toEqual(first.strokes);expect(await page.evaluate(()=>subjectCalls)).toBe(1);
  await page.evaluate(async()=>{const session=subjectProcessPanel.getSession();await subjectProcessPanel.loadSession({...session,subject:{...session.subject,method:'manual'}});});expect((await process(page,panel)).focus.method).toBe('manual');expect(await page.evaluate(()=>subjectCalls)).toBe(1);
  await panel.getByLabel('Use main subject',{exact:true}).uncheck();await expect(panel.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();expect((await process(page,panel)).focus).toBeUndefined();expect(await page.evaluate(()=>subjectCalls)).toBe(1);
  await panel.getByLabel('Upload image',{exact:true}).setInputFiles('tests/fixtures/subject-parts.svg');await expect(panel.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();await panel.getByLabel('Use main subject',{exact:true}).check();await expect(panel.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();expect((await process(page,panel)).focus.method).toBe('ai');expect(await page.evaluate(()=>subjectCalls)).toBe(2);
});

test('Stop during automatic inference or following Auto analysis cannot resume processing from a late result',async({page})=>{
  const panel=await setup(page);await page.evaluate(()=>window.holdSubject=true);await panel.getByRole('button',{name:'Process image',exact:true}).click();await expect.poll(()=>page.evaluate(()=>typeof releaseSubject)).toBe('function');await panel.getByRole('button',{name:'Stop',exact:true}).click();await expect(panel.locator('.status')).toHaveText('Stopped.');
  await page.evaluate(async()=>{releaseSubject();await new Promise(requestAnimationFrame);});expect(await page.evaluate(()=>subjectProcessPanel.getPlan())).toBeNull();expect(await page.evaluate(()=>subjectProcessPanel.getSession().subject)).toBeNull();expect(await page.evaluate(()=>colorCalls)).toBe(0);
  await page.evaluate(()=>{window.holdSubject=false;const suggest=SAGDrawingEngine.suggestSettings;window.originalSuggest=suggest;SAGDrawingEngine.suggestSettings=async(...args)=>{const next=await suggest(...args);await new Promise(resolve=>window.releaseSubjectAuto=resolve);return next;};});
  await panel.getByRole('button',{name:'Process image',exact:true}).click();await expect.poll(()=>page.evaluate(()=>typeof releaseSubjectAuto)).toBe('function');await panel.getByRole('button',{name:'Stop',exact:true}).click();await expect(panel.locator('.status')).toHaveText('Stopped.');await page.evaluate(async()=>{releaseSubjectAuto();await new Promise(requestAnimationFrame);});
  expect(await page.evaluate(()=>subjectProcessPanel.getPlan())).toBeNull();expect(await page.evaluate(()=>colorCalls)).toBe(0);await expect(panel.locator('.status')).toHaveText('Stopped.');
  await page.evaluate(()=>SAGDrawingEngine.suggestSettings=originalSuggest);expect((await process(page,panel)).focus.method).toBe('ai');expect(await page.evaluate(()=>subjectCalls)).toBe(2);expect(await page.evaluate(()=>colorCalls)).toBe(1);
});

test('expired extension context gives reconnect guidance during processing and automatic AI, without a Browser-mode hint',async({page})=>{
  for(const stage of ['processing','subject']){
    const panel=await setup(page);
    if(stage==='processing'){await panel.getByLabel('Use main subject',{exact:true}).uncheck();await expect(panel.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();await page.evaluate(()=>window.chrome={storage:{local:{get:async()=>{throw new Error('Extension context invalidated.');}}}});}
    else await page.evaluate(()=>window.failSubject=true);
    await panel.getByRole('button',{name:'Process image',exact:true}).click();await expect(panel.locator('.status')).toContainText('Refresh the Skribbl tab');await expect(panel.locator('.status')).not.toContainText('Browser mode');await expect(panel.getByRole('button',{name:'Download plan JSON',exact:true})).toBeDisabled();expect(await page.evaluate(()=>subjectProcessPanel.getPlan())).toBeNull();
  }
});
