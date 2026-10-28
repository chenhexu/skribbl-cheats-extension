const {chromium,expect}=require('@playwright/test'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
  const root=path.resolve(__dirname,'..'),output=path.join(root,'screenshots/browser-ai');await fs.mkdir(output,{recursive:true});
  let extension=process.env.SAG_AI_EXTENSION||root;
  if(process.env.SAG_NO_GPU){
    if(!process.env.SAG_AI_EXTENSION)throw Error('Use an extracted ZIP for the GPU-unavailable negative control.');
    const negative=await fs.mkdtemp(path.join(os.tmpdir(),'sag-no-gpu-extension-'));
    assert.ok(path.relative(extension,negative).startsWith('..')||path.isAbsolute(path.relative(extension,negative)));
    await fs.cp(extension,negative,{recursive:true});
    const entry=path.join(negative,'browser-ai/worker.js');await fs.writeFile(entry,"Object.defineProperty(self.navigator,'gpu',{value:undefined,configurable:true});\n"+await fs.readFile(entry,'utf8'));extension=negative;
  }
  const cache=path.join(process.env.LOCALAPPDATA,'ms-playwright'),names=(await fs.readdir(cache)).filter(n=>/^chromium-\d+$/.test(n)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]));
  const executable=process.env.SAG_TEST_CHROMIUM||path.join(cache,names[0],'chrome-win64/chrome.exe'),profile=await fs.mkdtemp(path.join(os.tmpdir(),'sag-ai-integration-'));
  const launch=()=>chromium.launchPersistentContext(profile,{executablePath:executable,channel:'chromium',headless:true,viewport:{width:1200,height:1500},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  let context=await launch();const report={externalRequests:[]};
  try{
    context.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith('https://skribbl.io/'))report.externalRequests.push(request.url());});
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
    const source=await fs.readFile(path.join(root,'content.js'),'utf8'),words=JSON.parse(source.split('const BUNDLED_WORDS = ')[1].split('];')[0]+']');
    await context.addInitScript(({words,version})=>{if(location.origin==='https://skribbl.io')localStorage.setItem('skribblAutoGuesserWordCache_v1',JSON.stringify({version:'2',bundleVersion:'v'+version,words,removedWords:[]}));},{words,version:require('../manifest.json').version_name});
    const setup=await context.newPage();await setup.goto(`chrome-extension://${id}/ai-setup.html`);await expect(setup.locator('#backend')).toBeEnabled();
    report.initialPermissions=await worker.evaluate(()=>chrome.permissions.getAll());assert.ok(!report.initialPermissions.permissions.includes('offscreen'));assert.deepEqual(report.initialPermissions.origins,['https://skribbl.io/*']);
    if(process.env.SAG_NO_GPU){
      await setup.selectOption('#backend','gpu');await expect(setup.locator('#status')).toContainText('Choice saved');await setup.click('#prepare');await expect(setup.locator('#prepare')).toBeEnabled({timeout:30000});await expect(setup.locator('#words-state')).toContainText('cannot access a GPU');report.explicitCPURecovery=true;
    }
    await setup.selectOption('#backend','cpu');await expect(setup.locator('#status')).toContainText('Choice saved');await setup.click('#prepare');await expect(setup.locator('#prepare')).toBeEnabled({timeout:120000});await expect(setup.locator('#status')).toContainText('All three AI features are ready');
    assert.equal(await worker.evaluate(()=>chrome.permissions.contains({permissions:['offscreen']})),true);report.offscreenGrantedOnChoice=true;
    const offscreenBefore=await worker.evaluate(()=>chrome.offscreen.hasDocument());assert.equal(offscreenBefore,true);
    await context.route('https://skribbl.io/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><section id="game-wrapper" style="margin-left:500px"><div id="game-players"><div class="player-name">test (You)</div></div><div id="currentWord">______</div><div id="game-chat" class="chat"><div class="chat-content"></div><form><input placeholder="Type your guess here..."><button>Send</button></form></div></section></body></html>'}));
    const game=await context.newPage();await game.goto('https://skribbl.io/');await expect(game.locator('#sag-search-input')).toBeVisible({timeout:15000});
    await game.locator('#sag-related-words').check();await game.locator('#sag-search-input').fill('music');
    await expect(game.locator('#sag-search-status')).toContainText('Local AI ready',{timeout:30000});
    const guitar=game.locator('#sag-candidate-top button').filter({hasText:/^guitar$/});await expect(guitar).toBeVisible();assert.match(await guitar.getAttribute('data-match'),/local AI/);
    report.gameSearch=await game.locator('#sag-candidate-top button').allTextContents();assert.ok(report.gameSearch.every(word=>word.length===6));
    await game.locator('#skribbl-auto-guesser-panel').screenshot({path:path.join(output,'real-extension-word-search.png')});
    // Close the real offscreen document during a cold semantic request. The
    // broker must recreate it and complete the same typed query automatically.
    await worker.evaluate(()=>browserAI.close());
    await game.locator('#sag-search-input').fill('instrument');
    await expect.poll(()=>worker.evaluate(async()=>aiRequests.size>0&&await chrome.offscreen.hasDocument()),{timeout:15000,intervals:[20]}).toBe(true);
    await worker.evaluate(()=>chrome.offscreen.closeDocument());
    await expect(game.locator('#sag-search-status')).toContainText('Local AI ready',{timeout:35000});
    await expect(guitar).toBeVisible();assert.match(await guitar.getAttribute('data-match'),/local AI/);report.offscreenReconnect=true;
    // Also terminate the background service worker while it owns a pending
    // cold request. This closes the content-script response channel itself.
    const cdp=await context.newCDPSession(setup),versions=new Map();
    cdp.on('ServiceWorker.workerVersionUpdated',({versions:updates})=>{for(const version of updates)versions.set(version.versionId,version);});
    await cdp.send('ServiceWorker.enable');
    await worker.evaluate(()=>browserAI.close());
    await game.locator('#sag-search-input').fill('musical');
    await expect.poll(()=>worker.evaluate(()=>aiRequests.size>0),{timeout:15000,intervals:[20]}).toBe(true);
    await expect.poll(()=>[...versions.values()].some(version=>version.scriptURL===worker.url()&&version.runningStatus==='running'),{timeout:5000}).toBe(true);
    const version=[...versions.values()].find(version=>version.scriptURL===worker.url()&&version.runningStatus==='running');
    await cdp.send('ServiceWorker.stopWorker',{versionId:version.versionId});
    await expect(game.locator('#sag-search-status')).toContainText('Local AI ready',{timeout:35000});
    await expect(guitar).toBeVisible();assert.match(await guitar.getAttribute('data-match'),/local AI/);report.backgroundReconnect=true;
    const activeWorker=context.serviceWorkers().find(value=>value.url()===worker.url());assert.ok(activeWorker);await cdp.detach();
    const viewer=await context.newPage();await viewer.goto(`chrome-extension://${id}/dev-line-art/studio.html`);await viewer.getByLabel('Upload image',{exact:true}).setInputFiles({name:'wheel.svg',mimeType:'image/svg+xml',buffer:require('../tests/fixtures/colorful-art.cjs').wheel});
    await expect(viewer.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();await viewer.getByLabel('Use main subject',{exact:true}).check();
    await viewer.getByRole('button',{name:'Find main subject (AI)',exact:true}).click();await expect(viewer.getByRole('button',{name:'Process image',exact:true})).toBeEnabled({timeout:30000});
    report.subject=await viewer.evaluate(()=>({method:studio.getSession().subject?.method,modelMs:studio.getSession().subject?.modelMs}));assert.equal(report.subject.method,'ai');
    await viewer.getByLabel('Use main subject',{exact:true}).uncheck();await viewer.getByLabel('Line detection',{exact:true}).selectOption('ai');await viewer.getByRole('button',{name:'Process image',exact:true}).click();await expect(viewer.getByRole('button',{name:'Download plan JSON',exact:true})).toBeEnabled({timeout:90000});
    report.linePlan=await viewer.evaluate(()=>({modelMs:studio.getPlan().modelMs,strokes:studio.getPlan().strokes.length,detector:studio.getPlan().settings.detector}));assert.equal(report.linePlan.detector,'ai');assert.ok(report.linePlan.modelMs>0);
    await viewer.locator('#studio').screenshot({path:path.join(output,'real-extension-image-ai.png')});
    // Session transfer through the dedicated setup tab retains the uploaded image.
    const setupTab=context.waitForEvent('page');await viewer.getByRole('button',{name:'Local AI setup',exact:true}).click();const transferred=await setupTab;await transferred.waitForURL('**/ai-setup.html?session=*');const viewerTab=context.waitForEvent('page');await transferred.locator('#viewer').click({modifiers:['Control']});const restored=await viewerTab;await expect(restored.getByRole('button',{name:'Process image',exact:true})).toBeEnabled({timeout:15000});assert.equal(await restored.evaluate(()=>!!studio.getSession().source),true);
    // Backend changes free the worker, and invalid/unauthorized configuration is rejected.
    await setup.bringToFront();await setup.selectOption('#backend','python');await expect(setup.locator('#status')).toContainText('Choice saved');assert.equal(await activeWorker.evaluate(()=>chrome.offscreen.hasDocument()),false);await expect(setup.locator('#terminal-help')).toBeVisible();
    await setup.selectOption('#backend','cpu');await expect(setup.locator('#status')).toContainText('Choice saved');
    assert.deepEqual(report.externalRequests,[]);
    await context.close();context=await launch();const resumed=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),newId=new URL(resumed.url()).host,page=await context.newPage();await page.goto(`chrome-extension://${newId}/ai-setup.html`);await expect(page.locator('#backend')).toHaveValue('cpu');report.preferenceSurvivesRestart=true;
    await fs.writeFile(path.join(output,'integration-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
