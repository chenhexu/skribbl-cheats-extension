const {test,expect}=require('@playwright/test');
const prefix='sagDrawerPreferences.v1.';
const flat=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="white"/><circle cx="400" cy="300" r="160" fill="red"/></svg>');
const preferences=page=>page.evaluate(()=>{const {detector,budget,speed,focus}=studio.getSession().settings;return {detector,budget,speed,focus};});
async function ready(page){await page.goto('/');await page.evaluate(()=>studio.ready);}

test('local viewer remembers user preferences across reload and Auto still chooses settings for each image',async({page},info)=>{
  await ready(page);
  await page.getByLabel('Drawing speed',{exact:true}).selectOption('balanced');
  await page.getByLabel('Subject and background',{exact:true}).selectOption('subject-background');
  await page.getByLabel('Line detection',{exact:true}).selectOption('ai');
  await page.locator('[name=budget]').fill('90');
  await page.getByLabel('Color count',{exact:true}).fill('24');
  await page.getByLabel('Outline detail',{exact:true}).fill('99');
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),prefix+'budget')).toBe(90);
  await page.reload();await page.evaluate(()=>studio.ready);
  const expected={detector:'ai',budget:90,speed:'balanced',focus:'subject-background'};
  expect(await preferences(page)).toEqual(expected);
  await expect(page.getByLabel('Auto settings',{exact:true})).toBeChecked();
  await expect(page.getByLabel('Color count',{exact:true})).toHaveValue('6');
  await expect(page.getByLabel('Outline detail',{exact:true})).toHaveValue('55');
  await page.getByLabel('Upload image',{exact:true}).setInputFiles({name:'art.svg',mimeType:'image/svg+xml',buffer:flat});
  await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();
  expect(await preferences(page)).toEqual(expected);
  expect(await page.getByLabel('Color count',{exact:true}).inputValue()).not.toBe('24');
  expect(await page.evaluate(()=>studio.getSession().subject)).toBeNull();
  await expect(page.locator('.subject-note')).toContainText('this image');
  await page.getByLabel('Upload image',{exact:true}).setInputFiles({name:'next.svg',mimeType:'image/svg+xml',buffer:flat});
  await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();expect(await preferences(page)).toEqual(expected);
  expect(await page.evaluate(prefix=>Object.keys(localStorage).filter(key=>key.startsWith(prefix)).sort(),prefix)).toEqual(['budget','detector','focus','speed'].map(name=>prefix+name).sort());
  await page.locator('#studio').screenshot({path:info.outputPath('remembered-preferences.png')});
});

test('extension storage shares preferences with new viewers and compact panels; explicit image sessions take precedence',async({page,context})=>{
  const saved={};await context.exposeFunction('__readDrawerPrefs',keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).filter(key=>key in saved).map(key=>[key,saved[key]])));
  await context.exposeFunction('__writeDrawerPrefs',patch=>Object.assign(saved,patch));
  await context.addInitScript(()=>{window.chrome={runtime:{id:'fixture'},storage:{local:{get:keys=>__readDrawerPrefs(keys),set:patch=>__writeDrawerPrefs(patch)}}};});
  await ready(page);await page.getByLabel('Drawing speed',{exact:true}).selectOption('balanced');await page.getByLabel('Subject and background',{exact:true}).selectOption('subject');await page.locator('[name=budget]').fill('90');
  await page.getByLabel('Upload image',{exact:true}).setInputFiles({name:'art.svg',mimeType:'image/svg+xml',buffer:flat});await expect(page.getByRole('button',{name:'Amplify colors',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Amplify colors',exact:true}).click();await expect.poll(()=>saved[prefix+'amplify']).toBe(70);
  await expect.poll(()=>saved[prefix+'budget']).toBe(90);
  const viewer=await context.newPage();await ready(viewer);expect(await preferences(viewer)).toEqual({detector:'browser',budget:90,speed:'balanced',focus:'subject'});
  await expect(viewer.getByLabel('Color amplification',{exact:true})).toHaveValue('70');
  // A stale viewer changing its target must not overwrite another view's speed.
  await page.getByLabel('Drawing speed',{exact:true}).selectOption('fast');await viewer.locator('[name=budget]').fill('120');
  await expect.poll(()=>saved[prefix+'budget']).toBe(120);await expect.poll(()=>saved[prefix+'speed']).toBe('fast');
  await viewer.evaluate(async()=>{const host=document.createElement('div');host.id='preferences-compact';host.style.width='320px';document.body.append(host);window.preferencePanel=SAGDrawerStudio.mount(host,{compact:true});await preferencePanel.ready;});
  expect(await viewer.evaluate(()=>{const {detector,budget,speed,focus}=preferencePanel.getSession().settings;return {detector,budget,speed,focus};})).toEqual({detector:'browser',budget:120,speed:'fast',focus:'subject'});
  await viewer.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;await preferencePanel.loadSession({source:canvas.toDataURL(),auto:false,settings:{detector:'ai',budget:30,speed:'balanced',focus:'none',amplify:20}});});
  expect(await viewer.evaluate(()=>{const {detector,budget,speed,focus}=preferencePanel.getSession().settings;return {detector,budget,speed,focus};})).toEqual({detector:'ai',budget:30,speed:'balanced',focus:'none'});
  expect(await viewer.evaluate(()=>preferencePanel.getSession().settings.amplify)).toBe(20);expect(saved).toEqual({[prefix+'budget']:120,[prefix+'speed']:'fast',[prefix+'focus']:'subject',[prefix+'amplify']:70});
  await viewer.close();
});

test('a delayed preference restore cannot overwrite controls already edited by the user',async({page})=>{
  await page.addInitScript(()=>{window.chrome={runtime:{id:'fixture'},storage:{local:{get:()=>new Promise(resolve=>{window.releasePreferences=resolve;}),set:async()=>{}}}};});
  await page.goto('/');await expect.poll(()=>page.evaluate(()=>typeof window.releasePreferences)).toBe('function');
  await page.getByLabel('Drawing speed',{exact:true}).selectOption('balanced');await page.locator('[name=budget]').fill('80');
  await page.evaluate(prefix=>releasePreferences({[prefix+'speed']:'fast',[prefix+'budget']:200,[prefix+'focus']:'subject-background',[prefix+'detector']:'invalid'}),prefix);
  await page.evaluate(()=>studio.ready);
  expect(await preferences(page)).toEqual({detector:'browser',budget:80,speed:'balanced',focus:'subject-background'});
  // Unavailable storage still leaves a usable drawer and reports save failure.
  await page.evaluate(()=>{chrome.storage.local.set=async()=>{throw new Error('Storage unavailable');};});
  await page.getByLabel('Drawing speed',{exact:true}).selectOption('fast');await expect(page.locator('.status')).toContainText('Could not save drawer preferences');
  await expect(page.getByLabel('Drawing speed',{exact:true})).toHaveValue('fast');
});
