const {chromium,expect}=require('@playwright/test'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
  const root=path.resolve(__dirname,'..'),output=path.join(root,'screenshots/browser-ai');await fs.mkdir(output,{recursive:true});
  const extension=process.env.SAG_AI_EXTENSION||root;
  const cache=path.join(process.env.LOCALAPPDATA,'ms-playwright'),names=(await fs.readdir(cache)).filter(name=>/^chromium-\d+$/.test(name)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]));
  const executable=process.env.SAG_TEST_CHROMIUM||path.join(cache,names[0],'chrome-win64/chrome.exe');
  const profile=await fs.mkdtemp(path.join(os.tmpdir(),'sag-browser-ai-'));
  const context=await chromium.launchPersistentContext(profile,{executablePath:executable,channel:'chromium',headless:true,viewport:{width:1100,height:1500},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  try{
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
    const page=await context.newPage();page.on('pageerror',e=>console.log('PAGE ERROR:',e.message));page.on('console',msg=>{if(msg.type()==='error')console.log('CONSOLE:',msg.text().slice(0,400));});
    await page.goto(`chrome-extension://${id}/ai-setup.html`);await expect(page.locator('#backend')).toBeEnabled();
    const report={browser:await context.browser()?.version(),gpu:await page.locator('#gpu').textContent(),modes:{}};
    for(const mode of process.argv.includes('--gpu')?['gpu']:['cpu']){
      await page.selectOption('#backend',mode);await expect(page.locator('#status')).toContainText('Choice saved');
      const start=Date.now();await page.click('#prepare');
      await expect(page.locator('#prepare')).toBeEnabled({timeout:180000});
      report.modes[mode]={loadMs:Date.now()-start,status:await page.locator('#status').textContent(),features:await page.locator('tbody').allTextContents()};
      const result=await page.evaluate(async()=>chrome.runtime.sendMessage({action:'aiWordSearch',id:crypto.randomUUID(),query:'animal',candidates:['reindeer','chair','mantis','bear trap','tail']}));
      report.modes[mode].search=result;console.log(JSON.stringify(report,null,2));
      if(!result.ok)throw Error(result.error);
      if(result.device!==(mode==='gpu'?'webgpu':'wasm')||result.encodedWords!==0||result.matches.some(match=>!Number.isFinite(match.score)))throw Error('Unexpected word-search backend or invalid scores');
      await page.click('#benchmark');await expect(page.locator('#benchmark-result')).toContainText('median',{timeout:30000});report.modes[mode].benchmark=await page.locator('#benchmark-result').textContent();
      const input=await page.evaluate(async svg=>{
        const img=new Image();img.src='data:image/svg+xml;base64,'+svg;await img.decode();const c=document.createElement('canvas');c.width=800;c.height=600;const ctx=c.getContext('2d');ctx.drawImage(img,100,0,600,600);return c.toDataURL();
      },require('../tests/fixtures/colorful-art.cjs').wheel.toString('base64'));
      await fs.writeFile(path.join(output,'input.png'),Buffer.from(input.split(',')[1],'base64'));
      report.modes[mode].images={};
      for(const action of ['aiSubject','aiLineart']){
        const started=Date.now(),image=await page.evaluate(async({action,input})=>chrome.runtime.sendMessage({action,id:crypto.randomUUID(),image:input}),{action,input});
        report.modes[mode].images[action]={ok:image.ok,ms:Date.now()-started,device:image.device,error:image.error};
        console.log('Image inference:',mode,action,JSON.stringify(report.modes[mode].images[action]));
        if(image.ok)await fs.writeFile(path.join(output,mode+'-'+action+'.png'),Buffer.from(image.image.split(',')[1],'base64'));
      }
      report.gpu=await page.locator('#gpu').textContent();await page.screenshot({path:path.join(output,mode+'-setup.png'),fullPage:true});
      if(Object.values(report.modes[mode].images).some(result=>!result.ok))throw Error('An image model failed in '+mode+' mode');
    }
    await fs.writeFile(path.join(output,(process.argv.includes('--gpu')?'gpu':'cpu')+'-report.json'),JSON.stringify(report,null,2));
  }finally{await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
