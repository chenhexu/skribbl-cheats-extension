const {test,expect}=require('@playwright/test');
test('upload and drop show a small original above the drawing, preserving aspect and transferred thumbnail',async({page},info)=>{
  await page.goto('/');
  const portrait=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="320"><rect width="160" height="320" fill="#00b2ff"/><circle cx="80" cy="80" r="35" fill="#ffe400"/></svg>');
  await page.getByLabel('Upload image',{exact:true}).setInputFiles({name:'portrait.svg',mimeType:'image/svg+xml',buffer:portrait});await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();
  const thumb=page.locator('#studio').getByAltText('Uploaded image thumbnail',{exact:true});await expect(thumb).toBeVisible();expect(await thumb.evaluate(img=>img.naturalWidth/img.naturalHeight)).toBe(.5);expect((await thumb.boundingBox()).height).toBeLessThanOrEqual(112);
  expect((await thumb.boundingBox()).y).toBeLessThan((await page.locator('.workflow').boundingBox()).y);await expect(page.locator('.preview-empty')).toBeVisible();await expect(page.getByRole('tab',{name:'Final drawing',exact:true})).toHaveAttribute('aria-selected','true');
  const original=await thumb.getAttribute('src');await page.evaluate(async()=>{const host=document.createElement('div');host.id='thumbnail-compact';host.style.width='320px';document.body.append(host);window.thumbnailPanel=SAGDrawerStudio.mount(host,{compact:true});await thumbnailPanel.loadSession(studio.getSession());});
  expect(await page.locator('#thumbnail-compact').getByAltText('Uploaded image thumbnail').getAttribute('src')).toBe(original);
  await page.evaluate(()=>{const payload=new DataTransfer();payload.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="400" height="160"><rect width="400" height="160" fill="red"/></svg>'],'wide.svg',{type:'image/svg+xml'}));document.querySelector('#studio').shadowRoot.querySelector('.drop').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:payload}));});
  await expect.poll(()=>thumb.evaluate(img=>img.naturalWidth/img.naturalHeight)).toBe(2.5);expect(await thumb.getAttribute('src')).not.toBe(original);await expect(page.locator('#studio .preview-empty')).toBeVisible();
  await page.locator('#studio').screenshot({path:info.outputPath('upload-thumbnail.png')});
});

test('compact workflow pins only one short row of drawing actions while settings scroll away',async({page},info)=>{
  await page.goto('/');await page.evaluate(()=>{
    document.querySelector('header').hidden=true;document.querySelector('main').hidden=true;
    const pane=document.createElement('div');pane.id='workflow-scroll';pane.style.cssText='height:640px;width:380px;overflow:auto;margin:20px;border:1px solid #bbb';const host=document.createElement('div');host.id='workflow-compact';pane.append(host);document.body.append(pane);window.workflowCalls=[];
    const original=SAGDrawingEngine.suggestSettings;SAGDrawingEngine.suggestSettings=(...args)=>{workflowCalls.push('auto');return original(...args);};
    window.workflowPanel=SAGDrawerStudio.mount(host,{compact:true,subjectAI:async()=>{workflowCalls.push('subject');const c=document.createElement('canvas');c.width=800;c.height=600;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(80,80,640,440);return c.toDataURL();},draw:async plan=>{workflowCalls.push('draw');window.executedWorkflowPlan=plan;},stop:async()=>{}});
  });
  const panel=page.locator('#workflow-compact');await panel.getByLabel('Upload image',{exact:true}).setInputFiles('tests/fixtures/precision.svg');await expect(panel.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();
  await expect(panel.locator('.more-settings')).not.toHaveAttribute('open','');await expect(panel.getByLabel('Outline detail',{exact:true})).toBeVisible();
  const subject=panel.getByRole('button',{name:'Find main subject (AI)',exact:true}),auto=panel.getByRole('button',{name:'Auto settings',exact:true}),process=panel.getByRole('button',{name:'Process image',exact:true}),draw=panel.getByRole('button',{name:'Start drawing',exact:true});
  expect((await subject.boundingBox()).x).toBeLessThan((await auto.boundingBox()).x);expect((await process.boundingBox()).x).toBeLessThan((await draw.boundingBox()).x);expect((await subject.boundingBox()).y).toBeLessThan((await process.boundingBox()).y);
  await page.evaluate(()=>workflowCalls.length=0);await subject.click();await expect(auto).toBeEnabled();await auto.click();await expect(process).toBeEnabled();await expect(panel.getByLabel('Auto settings',{exact:true})).toBeChecked();
  expect(Number(await panel.getByLabel('Outline detail',{exact:true}).inputValue())).toBe(55);await process.click();await expect(draw).toBeEnabled();await draw.click();await expect(panel.locator('.status')).toContainText('Drawing complete');
  const calls=await page.evaluate(()=>workflowCalls);expect(calls[0]).toBe('subject');expect(calls.at(-1)).toBe('draw');expect(calls.filter(call=>call==='auto').length).toBeGreaterThanOrEqual(1);
  await panel.getByLabel('Outline detail',{exact:true}).fill('90');await expect(panel.getByLabel('Auto settings',{exact:true})).not.toBeChecked();await expect(draw).toBeDisabled();await process.click();await expect(draw).toBeEnabled();expect(await page.evaluate(()=>workflowPanel.getPlan().settings.detail)).toBe(90);
  await page.locator('#workflow-scroll').evaluate(pane=>pane.scrollTop=pane.scrollHeight);const paneBox=await page.locator('#workflow-scroll').boundingBox(),barBox=await panel.locator('.run-bar').boundingBox();expect(barBox.y).toBeGreaterThanOrEqual(paneBox.y);expect(barBox.y).toBeLessThan(paneBox.y+4);expect(barBox.height).toBeLessThanOrEqual(44);await expect(panel.getByRole('button',{name:'Stop',exact:true})).toBeInViewport();await expect(panel.getByLabel('Outline detail',{exact:true})).not.toBeInViewport();await expect(subject).not.toBeInViewport();
  expect(await panel.evaluate(host=>host.shadowRoot.querySelector('.studio').scrollWidth)).toBeLessThanOrEqual(380);await page.locator('#workflow-scroll').screenshot({path:info.outputPath('sticky-workflow.png')});
  await page.locator('#workflow-scroll').evaluate(pane=>pane.scrollTop=0);await page.locator('#workflow-scroll').screenshot({path:info.outputPath('compact-workflow.png')});
});
