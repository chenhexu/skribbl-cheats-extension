const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const main='#skribbl-auto-guesser-panel',floating='#sag-drawer-float';
async function setup(page,{restore=false}={}){
  await page.goto('/');
  await page.evaluate(({restore,version})=>{
    document.querySelector('header').hidden=true;document.querySelector('main').hidden=true;
    if(!restore)localStorage.setItem('skribblAutoGuesserSettings_v1',JSON.stringify({panelX:20,panelY:20,panelWidth:360,panelHeight:600,detailsCollapsed:true}));
    localStorage.setItem('skribblAutoGuesserWordCache_v1',JSON.stringify({version:'2',bundleVersion:'v'+version,words:['cat','dog']}));
    const game=document.createElement('section');game.id='game-wrapper';game.innerHTML='<div id="currentWord">___</div><div class="chat-content"></div><input placeholder="Type your guess here...">';document.body.append(game);
  },{restore,version:require('../manifest.json').version_name});
  for(const file of ['guess-delivery.js','word-search.js','content.js'])await page.addScriptTag({content:await fs.readFile(file,'utf8')});
  await expect(page.locator('#sag-status')).toHaveText('Ready');
}
async function drag(page,selector,x,y){
  const r=await page.locator(selector).boundingBox();await page.mouse.move(r.x+Math.min(20,r.width/2),r.y+r.height/2);await page.mouse.down();await page.mouse.move(x,y,{steps:5});await page.mouse.up();
}
async function undock(page){
  await drag(page,'.sag-drawer-block-header',820,100);await expect(page.locator(floating)).toBeVisible();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function rect(page,selector){return page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};});}

test('floating drawer resizes from all eight directions without moving the opposite edge',async({page},info)=>{
  await page.setViewportSize({width:1200,height:900});await setup(page);await undock(page);
  for(const dir of ['n','s','e','w','ne','nw','se','sw']){
    await page.locator(floating).evaluate(el=>Object.assign(el.style,{left:'600px',top:'160px',width:'360px',height:'480px'}));
    const before=await rect(page,floating),handle=await page.locator('#sag-float-resize-'+dir).boundingBox();
    await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();
    await page.mouse.move(handle.x+handle.width/2+(dir.includes('w')?-20:dir.includes('e')?20:0),handle.y+handle.height/2+(dir.includes('n')?-20:dir.includes('s')?20:0),{steps:3});await page.mouse.up();
    const after=await rect(page,floating);
    expect(after.width).toBe(before.width+(/[ew]/.test(dir)?20:0));expect(after.height).toBe(before.height+(/[ns]/.test(dir)?20:0));
    expect(dir.includes('w')?after.right:after.x).toBe(dir.includes('w')?before.right:before.x);
    expect(dir.includes('n')?after.bottom:after.y).toBe(dir.includes('n')?before.bottom:before.y);
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('skribblAutoGuesserSettings_v1')));expect(saved.drawerFloatWidth).toBe(after.width);expect(saved.drawerFloatHeight).toBe(after.height);
  }
  await page.locator(floating).screenshot({path:info.outputPath('all-edge-resize.png')});
});

test('both panels drag and resize flush to viewport edges and stay reachable after window shrink',async({page},info)=>{
  await page.setViewportSize({width:1200,height:900});await setup(page);await undock(page);
  for(const [selector,header,prefix] of [[main,'#sag-header','#sag-resize-'],[floating,'.sag-drawer-block-header','#sag-float-resize-']]){
    if(selector===main)await page.locator(floating).evaluate(el=>el.style.display='none');else await page.locator(floating).evaluate(el=>el.style.display='flex');
    await drag(page,header,1199,899);let r=await rect(page,selector);expect(r.right).toBe(1200);expect(r.bottom).toBe(900);
    await drag(page,header,0,0);r=await rect(page,selector);expect(r.x).toBe(0);expect(r.y).toBe(0);
    await drag(page,prefix+'s',100,899);r=await rect(page,selector);expect(r.bottom).toBe(900);expect(r.y).toBe(0);
    await drag(page,prefix+'e',1199,300);r=await rect(page,selector);expect(r.x).toBe(0);expect(r.width).toBe(1200);
    // Leave the panels on opposite sides before changing the browser size.
    await drag(page,header,selector===main?0:1199,0);
    // Keep the guesser away from the drawer's drop points: dropping its header
    // on the guesser is intentionally the existing dock gesture.
    if(selector===main)await page.locator(main).evaluate(el=>Object.assign(el.style,{left:'400px',top:'100px',width:'360px',height:'400px'}));
  }
  await page.setViewportSize({width:390,height:500});
  for(const selector of [main,floating])await expect.poll(async()=>{const r=await rect(page,selector);return r.x>=0&&r.y>=0&&r.right<=390&&r.bottom<=500;}).toBe(true);
  await page.screenshot({path:info.outputPath('panels-at-window-edges.png')});
  await setup(page,{restore:true});const restored=await rect(page,main);expect(restored.right).toBeLessThanOrEqual(390);expect(restored.bottom).toBeLessThanOrEqual(500);
});
