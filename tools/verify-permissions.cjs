/* Run against an extracted release ZIP, using real Chromium extension APIs. */
const {chromium,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');

const project=path.resolve(__dirname,'..');
const extension=process.argv[2]&&path.resolve(process.argv[2]);
const output=path.join(project,'screenshots','store-permission-audit');
const prefix='sagDrawerPreferences.v1.';
async function binary(){
  if(process.env.SAG_AUDIT_CHROMIUM)return process.env.SAG_AUDIT_CHROMIUM;
  try{await fs.access(chromium.executablePath());return chromium.executablePath();}catch{}
  const cache=path.join(process.env.LOCALAPPDATA,'ms-playwright');
  const names=(await fs.readdir(cache)).filter(name=>/^chromium-\d+$/.test(name)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]));
  for(const name of names){const candidate=path.join(cache,name,'chrome-win64','chrome.exe');try{await fs.access(candidate);return candidate;}catch{}}
  throw Error('Install Playwright Chromium or set SAG_AUDIT_CHROMIUM to a Chromium executable.');
}
async function launch(directory,profile){
  const context=await chromium.launchPersistentContext(profile,{channel:'chromium',executablePath:await binary(),headless:true,viewport:{width:1100,height:1400},
    args:[`--disable-extensions-except=${directory}`,`--load-extension=${directory}`]});
  try{
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:15000});
    const id=new URL(worker.url()).host;
    const page=await context.newPage();
    await page.goto(`chrome-extension://${id}/dev-line-art/studio.html`);
    await page.evaluate(()=>studio.ready);
    return {context,worker,page,id};
  }catch(error){await context.close();throw error;}
}
async function values(page){return page.evaluate(()=>{const s=studio.getSession().settings;return {speed:s.speed,focus:s.focus,budget:s.budget,detector:s.detector,amplify:s.amplify};});}

(async()=>{
  assert(extension,'Usage: node tools/verify-permissions.cjs <extracted-extension-directory>');
  const manifest=JSON.parse(await fs.readFile(path.join(extension,'manifest.json'),'utf8'));
  assert.deepEqual([...manifest.permissions].sort(),['debugger','storage']);
  assert.deepEqual(manifest.optional_permissions,['offscreen']);
  assert.deepEqual(manifest.optional_host_permissions,['http://127.0.0.1:8765/*']);
  assert(manifest.content_scripts.every(entry=>entry.matches.length===1 && entry.matches[0]==='https://skribbl.io/*'));
  await fs.mkdir(output,{recursive:true});
  await fs.mkdir(path.join(project,'test-results'),{recursive:true});
  const scratch=await fs.mkdtemp(path.join(project,'test-results','permission-audit-'));
  const relative=path.relative(extension,scratch);
  assert(relative.startsWith('..')||path.isAbsolute(relative),'Use an extracted ZIP directory, not a directory containing the test profiles.');
  const profile=path.join(scratch,'positive-profile');
  let current;
  const report={version:manifest.version,requiredPermissions:manifest.permissions,optionalPermissions:manifest.optional_permissions,optionalOrigins:manifest.optional_host_permissions,browser:await binary()};
  try{
    current=await launch(extension,profile);
    report.extensionId=current.id;
    report.grantedPermissions=await current.worker.evaluate(()=>chrome.permissions.getAll());
    assert.equal(await current.worker.evaluate(()=>chrome.permissions.contains({permissions:['offscreen']})),false);
    assert.equal(await current.worker.evaluate(()=>chrome.permissions.contains({origins:['http://127.0.0.1:8765/*']})),false);
    assert.equal(await current.worker.evaluate(()=>chrome.permissions.contains({permissions:['storage']})),true);
    await current.page.getByLabel('Upload image',{exact:true}).setInputFiles({name:'permission-test.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="white"/><circle cx="400" cy="300" r="150" fill="red"/></svg>')});
    await expect(current.page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();
    await current.page.getByLabel('Drawing speed',{exact:true}).selectOption('balanced');
    await current.page.getByLabel('Subject and background',{exact:true}).selectOption('subject-background');
    await current.page.locator('[name=budget]').fill('90');
    await current.page.getByLabel('Line detection',{exact:true}).selectOption('ai');
    await current.page.getByRole('button',{name:'Amplify colors',exact:true}).click();
    const expected={speed:'balanced',focus:'subject-background',budget:90,detector:'ai',amplify:70};
    const stored=Object.fromEntries(Object.entries(expected).map(([key,value])=>[prefix+key,value]));
    await expect.poll(()=>current.worker.evaluate(()=>chrome.storage.local.get(null))).toEqual(stored);
    report.actualChromeStorage=await current.worker.evaluate(()=>chrome.storage.local.get(null));
    const second=await current.context.newPage();
    await second.goto(`chrome-extension://${current.id}/dev-line-art/studio.html`);await second.evaluate(()=>studio.ready);
    assert.deepEqual(await values(second),expected);
    report.sharedAcrossViewerTabs=true;
    await current.context.close();current=null;
    current=await launch(extension,profile);
    assert.equal(current.id,report.extensionId);
    assert.deepEqual(await values(current.page),expected);
    report.persistedAfterBrowserRestart=true;
    await current.page.locator('#studio').screenshot({path:path.join(output,'real-storage-restored.png')});
    await current.context.close();current=null;

    // Negative control: the same released code without the storage permission.
    const without=path.join(scratch,'without-storage');await fs.cp(extension,without,{recursive:true});
    await fs.writeFile(path.join(without,'manifest.json'),JSON.stringify({...manifest,permissions:manifest.permissions.filter(p=>p!=='storage')},null,2));
    current=await launch(without,path.join(scratch,'negative-profile'));
    assert.equal(await current.worker.evaluate(()=>chrome.permissions.contains({permissions:['storage']})),false);
    await expect(current.page.locator('.status')).toContainText('Could not restore drawer preferences');
    await current.page.getByLabel('Drawing speed',{exact:true}).selectOption('balanced');
    await expect(current.page.locator('.status')).toContainText('Could not save drawer preferences');
    report.withoutStoragePermission={restoreFailed:true,saveFailed:true};
    await current.page.locator('#studio').screenshot({path:path.join(output,'without-storage-permission.png')});
    await current.context.close();current=null;

    // Grant the declared origin at install in a test-only clone, then verify its
    // port boundary using Chrome's actual permission matcher, without any network I/O.
    const scoped=path.join(scratch,'scoped-origin');await fs.cp(extension,scoped,{recursive:true});
    await fs.writeFile(path.join(scoped,'manifest.json'),JSON.stringify({...manifest,host_permissions:[...manifest.optional_host_permissions],optional_host_permissions:[]},null,2));
    current=await launch(scoped,path.join(scratch,'scoped-profile'));
    report.loopbackScope=await current.worker.evaluate(async()=>({
      intendedPort:await chrome.permissions.contains({origins:['http://127.0.0.1:8765/*']}),
      otherPort:await chrome.permissions.contains({origins:['http://127.0.0.1:8766/*']}),
      wholeHost:await chrome.permissions.contains({origins:['http://127.0.0.1/*']})
    }));
    assert.deepEqual(report.loopbackScope,{intendedPort:true,otherPort:false,wholeHost:false});
    await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  }finally{await current?.context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
