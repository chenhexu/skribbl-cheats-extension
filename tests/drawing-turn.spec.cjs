const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const Transport=require('../plan-transport');
const shortPlan={version:2,width:800,height:600,settings:{budget:60,eventMs:8},strokes:[{id:0,stage:'outline',colorId:1,brushSize:4,points:[{x:100,y:100},{x:300,y:220},{x:450,y:120}]}]};

async function setup(page,{onAttach}={}){
  await page.goto('/');const session=await page.context().newCDPSession(page),commands=[];let attached=false;
  const transport=new Transport({attach:async()=>{attached=true;await onAttach?.();},detach:async()=>{attached=false;},command:async(_tab,method,params)=>{commands.push(params);return session.send(method,params);}});
  await page.exposeFunction('__turnBridge',async msg=>{try{let value;if(msg.action==='planBegin')value=await transport.begin(1,msg.runId);else if(msg.action==='planStroke')value=await transport.stroke(1,msg.runId,msg.points);else if(msg.action==='planTool')value=await transport.tool(1,msg.runId,msg.points);else if(msg.action==='planCancel')value=await transport.cancel(1,msg.runId);return {ok:true,...value};}catch(e){return {ok:false,error:e.message,cancelled:e.name==='AbortError'};}});
  await page.evaluate(()=>{
    document.querySelector('header').hidden=true;document.querySelector('main').hidden=true;
    const style=document.createElement('style');style.textContent='#game-canvas{position:relative;overflow:hidden;width:800px;height:600px}#game-canvas .overlay{position:absolute;inset:0;background:#222;opacity:0;pointer-events:none}#game-canvas .overlay.show{opacity:.5;pointer-events:auto}#game-canvas .overlay-content{position:absolute;top:-100%;width:100%;height:100%}#game-canvas .reveal{display:grid;place-items:center;width:100%;height:100%;font:24px sans-serif}#game-wrapper.toolbar-hidden #game-toolbar{display:none}';document.head.append(style);
    const wrapper=document.createElement('section');wrapper.id='game-wrapper';wrapper.style.cssText='position:absolute;left:20px;top:20px;width:850px';wrapper.innerHTML='<div id="game-word"><div class="word">test word</div></div><div id="game-canvas"><canvas width="800" height="600" style="display:block"></canvas><div class="overlay"></div><div class="overlay-content"><div class="reveal show">The word was: previous word</div></div></div><div id="game-toolbar"><div class="toolbar-group-tools"><button class="tool selected">Brush</button><button class="tool">Fill</button></div><div class="colors"><div class="top"></div></div><div class="sizes"><div class="size">4</div></div></div>';document.body.append(wrapper);
    const sizes=wrapper.querySelector('.size');sizes.style.cssText='width:30px;height:25px';sizes.onclick=()=>sizes.classList.add('selected');
    const preview=document.createElementNS('http://www.w3.org/2000/svg','svg');preview.setAttribute('width','20');preview.setAttribute('height','20');preview.innerHTML='<rect id="color-preview-primary" width="20" height="20" style="fill:#000"/>';wrapper.querySelector('#game-toolbar').prepend(preview);
    for(const color of SAGDrawingEngine.PALETTE){const el=document.createElement('div');el.className='color';el.style.cssText='display:inline-block;width:22px;height:22px;background:'+color;el.onpointerdown=()=>document.querySelector('#color-preview-primary').style.fill=color;wrapper.querySelector('.colors .top').append(el);}
    wrapper.querySelectorAll('.tool').forEach((el,index)=>{el.dataset.tooltip=index?'Fill':'Brush';el.onclick=()=>wrapper.querySelectorAll('.tool').forEach((tool,i)=>tool.classList.toggle('selected',i===index));});
    const canvas=wrapper.querySelector('canvas'),ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,800,600);window.inputEvents=[];let pressed=false;
    canvas.addEventListener('pointerdown',event=>{pressed=true;canvas.setPointerCapture(event.pointerId);const r=canvas.getBoundingClientRect();ctx.beginPath();ctx.moveTo((event.clientX-r.left)*800/r.width,(event.clientY-r.top)*600/r.height);inputEvents.push({type:'down',trusted:event.isTrusted,buttons:event.buttons});});
    canvas.addEventListener('pointermove',event=>{inputEvents.push({type:'move',trusted:event.isTrusted,buttons:event.buttons});if(pressed&&event.buttons===1){const r=canvas.getBoundingClientRect();ctx.lineWidth=4;ctx.lineTo((event.clientX-r.left)*800/r.width,(event.clientY-r.top)*600/r.height);ctx.stroke();}});
    canvas.addEventListener('pointerup',event=>{pressed=false;inputEvents.push({type:'up',trusted:event.isTrusted,buttons:event.buttons});if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);});
    window.showOverlay=active=>{wrapper.querySelector('.overlay').classList.toggle('show',active);wrapper.querySelector('.overlay-content').style.top=active?'0':'-100%';};
    window.chrome={runtime:{id:'fixture',sendMessage:(msg,callback)=>__turnBridge(msg).then(callback),connect:()=>({disconnect(){}})},storage:{local:{set:async()=>{},get:async()=>({})}}};
  });
  await page.addScriptTag({content:await fs.readFile('drawer.js','utf8')});
  return {commands,isAttached:()=>attached};
}

test('debugger startup waits for a delayed viewport resize and animated canvas before measuring input',async({page},info)=>{
  await page.exposeFunction('__bannerResize',()=>page.setViewportSize({width:1100,height:950}));
  const {commands,isAttached}=await setup(page,{onAttach:()=>page.evaluate(()=>{
    window.firstPaintAt=0;window.layoutSettledAt=0;
    const wrapper=document.querySelector('#game-wrapper'),canvas=document.querySelector('#game-canvas canvas');
    canvas.style.width='800px';canvas.style.height='600px';canvas.getBoundingClientRect();
    wrapper.style.transition='top 180ms linear';canvas.style.transition='width 180ms linear,height 180ms linear';
    canvas.addEventListener('transitionend',event=>{if(event.propertyName==='height')layoutSettledAt=performance.now();});
    canvas.addEventListener('pointerdown',()=>{firstPaintAt=performance.now();},{once:true});
    setTimeout(async()=>{await __bannerResize();wrapper.style.top='72px';canvas.style.width='740px';canvas.style.height='555px';},60);
  })});
  await page.evaluate(plan=>__skribblDrawer.startPlan(plan),shortPlan);
  const layout=await page.evaluate(()=>{const canvas=document.querySelector('#game-canvas canvas'),r=canvas.getBoundingClientRect(),ctx=canvas.getContext('2d');return {x:r.left,y:r.top,width:r.width,height:r.height,firstPaintAt,layoutSettledAt,ink:[...ctx.getImageData(300,220,1,1).data],outside:[...ctx.getImageData(140,260,1,1).data]};});
  expect(layout.layoutSettledAt).toBeGreaterThan(0);expect(layout.firstPaintAt-layout.layoutSettledAt).toBeGreaterThan(150);
  const down=commands.find(command=>command.type==='mousePressed');expect(down.x).toBeCloseTo(layout.x+100.5*layout.width/800,4);expect(down.y).toBeCloseTo(layout.y+100.5*layout.height/600,4);
  expect(commands.filter(command=>command.type==='mousePressed')).toHaveLength(1);expect(commands.at(-1)).toMatchObject({type:'mouseReleased',buttons:0});expect(isAttached()).toBe(false);
  expect(layout.ink).toEqual([0,0,0,255]);expect(layout.outside).toEqual([255,255,255,255]);
  await page.locator('#game-canvas canvas').screenshot({path:info.outputPath('settled-debugger-layout.png')});
});

test('debugger startup delays the first press even when the canvas coordinates do not change',async({page})=>{
  const {commands,isAttached}=await setup(page,{onAttach:()=>page.evaluate(()=>{
    window.attachedAt=performance.now();window.firstPaintAt=0;
    document.querySelector('#game-canvas canvas').addEventListener('pointerdown',()=>{firstPaintAt=performance.now();},{once:true});
  })});
  await page.evaluate(plan=>__skribblDrawer.startPlan(plan),shortPlan);
  expect(await page.evaluate(()=>firstPaintAt-attachedAt)).toBeGreaterThanOrEqual(400);
  expect(commands.filter(command=>command.type==='mousePressed')).toHaveLength(1);
  expect(commands.at(-1)).toMatchObject({type:'mouseReleased',buttons:0});expect(isAttached()).toBe(false);
});

for(const resizeEvent of [true,false])test('a '+(resizeEvent?'viewport resize':'one-pixel canvas shift')+' during a boundary releases input and never bucket-fills the unclosed shape',async({page})=>{
  const {commands,isAttached}=await setup(page);
  await page.evaluate(resizeEvent=>{
    let moves=0;document.querySelector('#game-canvas canvas').addEventListener('pointermove',event=>{
      if(event.buttons!==1||++moves!==3)return;
      document.querySelector('#game-wrapper').style.left=resizeEvent?'44px':'21px';
      if(resizeEvent)window.dispatchEvent(new Event('resize'));
    });
  },resizeEvent);
  const points=Array.from({length:201},(_,i)=>({x:300+100*Math.cos(i/200*Math.PI*2),y:250+100*Math.sin(i/200*Math.PI*2)}));
  const region={...shortPlan,strokes:[{id:0,kind:'region',stage:'fill',colorId:1,brushSize:4,contours:[points],seeds:[{x:300,y:250}]}]};
  expect(await page.evaluate(plan=>__skribblDrawer.startPlan(plan).then(()=> 'completed',e=>e.name),region)).toBe('AbortError');
  expect(commands.filter(command=>command.type==='mousePressed')).toHaveLength(1);expect(commands.filter(command=>command.type==='mouseMoved').length).toBeLessThan(8);
  expect(commands.at(-1)).toMatchObject({type:'mouseReleased',buttons:0});expect(isAttached()).toBe(false);
  expect(await page.evaluate(()=>document.querySelector('#game-toolbar .tool[data-tooltip="Fill"]').classList.contains('selected'))).toBe(false);
});

test('Stop during debugger layout settling cannot begin drawing later',async({page})=>{
  const {commands,isAttached}=await setup(page);
  await page.evaluate(plan=>{window.outcome=null;__skribblDrawer.startPlan(plan).then(()=>outcome='completed',e=>outcome=e.name);},shortPlan);
  await expect.poll(isAttached,{intervals:[10]}).toBe(true);await page.evaluate(()=>__skribblDrawer.stopPlan());
  await expect.poll(()=>page.evaluate(()=>outcome)).toBe('AbortError');await page.waitForTimeout(450);expect(commands).toHaveLength(0);expect(isAttached()).toBe(false);
});

test('retained reveal after a round does not reject the next drawing turn',async({page},info)=>{
  const {commands,isAttached}=await setup(page);
  expect(await page.evaluate(()=>{const r=document.querySelector('.reveal').getBoundingClientRect();return r.width>0&&r.height>0;})).toBe(true);
  expect(await page.evaluate(()=>__skribblDrawer.isPlanDrawingTurn())).toBe(true);
  await page.evaluate(plan=>__skribblDrawer.startPlan(plan),shortPlan);expect(commands.filter(p=>p.type==='mousePressed')).toHaveLength(1); // verified black is already selected; only the curve needs native input
  const events=await page.evaluate(()=>inputEvents);expect(events.filter(e=>e.type==='down')).toHaveLength(1);expect(events.at(-1)).toMatchObject({type:'up',buttons:0,trusted:true});expect(isAttached()).toBe(false);
  await page.locator('#game-wrapper').screenshot({path:info.outputPath('accepted-turn.png')});
  const count=commands.length;await page.evaluate(()=>showOverlay(true));expect(await page.evaluate(()=>__skribblDrawer.isPlanDrawingTurn())).toBe(false);
  expect(await page.evaluate(plan=>__skribblDrawer.startPlan(plan).catch(e=>e.message),shortPlan)).toContain('overlay is still covering');expect(commands.length).toBe(count);
  await page.evaluate(()=>{showOverlay(false);document.querySelector('.word').textContent='';});expect(await page.evaluate(plan=>__skribblDrawer.startPlan(plan).catch(e=>e.message),shortPlan)).toContain('Drawing word is not ready');
  await page.evaluate(()=>{document.querySelector('.word').textContent='test word';document.querySelector('#game-wrapper').classList.add('toolbar-hidden');});expect(await page.evaluate(()=>__skribblDrawer.isPlanDrawingTurn())).toBe(false);
  expect(await page.evaluate(plan=>__skribblDrawer.startPlan(plan).catch(e=>e.message),shortPlan)).toContain('your own drawing turn');expect(commands.length).toBe(count);
});

test('an overlay arriving during a held curve cancels input and allows a clean next turn',async({page})=>{
  const {commands,isAttached}=await setup(page),long={...shortPlan,strokes:[{...shortPlan.strokes[0],points:Array.from({length:1000},(_,i)=>({x:100+i%500,y:200+Math.floor(i/500)*50}))}]};
  await page.evaluate(plan=>{window.outcome=null;__skribblDrawer.startPlan(plan).then(()=>outcome='completed',e=>outcome=e.name);},long);
  await expect.poll(()=>page.evaluate(()=>inputEvents.filter(e=>e.type==='move'&&e.buttons===1).length)).toBeGreaterThan(4);
  await page.evaluate(()=>showOverlay(true));await expect.poll(()=>page.evaluate(()=>outcome)).toBe('AbortError');expect(isAttached()).toBe(false);expect(commands.at(-1)).toMatchObject({type:'mouseReleased',buttons:0});
  const stopped=commands.length;await page.evaluate(()=>showOverlay(false));expect(await page.evaluate(()=>__skribblDrawer.isPlanDrawingTurn())).toBe(true);expect(commands.length).toBe(stopped);
  await page.evaluate(plan=>__skribblDrawer.startPlan(plan),shortPlan);expect(isAttached()).toBe(false);expect(commands.at(-1)).toMatchObject({type:'mouseReleased',buttons:0});
});

test('older overlay markup respects off-canvas placement and hidden ancestors',async({page})=>{
  await setup(page);await page.evaluate(()=>document.querySelector('#game-canvas .overlay').remove());
  expect(await page.evaluate(()=>__skribblDrawer.isPlanDrawingTurn())).toBe(true);
  await page.evaluate(()=>{document.querySelector('.overlay-content').style.top='0';});expect(await page.evaluate(()=>__skribblDrawer.isPlanDrawingTurn())).toBe(false);
  for(const css of ['opacity:0','visibility:hidden','display:none']){await page.evaluate(css=>{document.querySelector('.overlay-content').style.cssText='top:0;'+css;},css);expect(await page.evaluate(()=>__skribblDrawer.isPlanDrawingTurn())).toBe(true);}
});

async function nativePicker(page,{delay=0,blocked=false,never=false,broken=false}={}){
  await page.evaluate(({delay,blocked,never,broken})=>{
    const group=document.querySelector('#game-toolbar .sizes');
    group.style.cssText='position:relative;width:44px;height:44px';group.innerHTML='<div class="size-preview" style="width:44px;height:44px;background:#ddd">Size</div><div class="container"></div>';
    const style=document.createElement('style');style.textContent='#game-toolbar .sizes .container{display:none;position:absolute;bottom:100%;width:44px}#game-toolbar .sizes .container.open{display:flex;flex-direction:column}#game-toolbar .sizes .size{width:44px;height:44px;background:#ccc}';document.head.append(style);
    const container=group.querySelector('.container');window.selectedSizes=[];window.pickerOpens=0;
    const populate=()=>{if(container.children.length)return;for(const size of [4,10,20,32,40]){const choice=document.createElement('div');choice.className='size';choice.textContent=size;choice.onclick=()=>{if(broken)return;selectedSizes.push(size);container.querySelectorAll('.size').forEach(el=>el.classList.toggle('selected',el===choice));container.classList.remove('open');};container.append(choice);}};
    if(!delay&&!never)populate();
    group.querySelector('.size-preview').onclick=()=>{pickerOpens++;container.classList.toggle('open');if(delay&&!never)setTimeout(populate,delay);};
    document.addEventListener('pointerdown',event=>{if(!group.contains(event.target))container.classList.remove('open');});
    if(blocked){const r=group.querySelector('.size-preview').getBoundingClientRect(),cover=document.createElement('div');cover.id='picker-cover';cover.style.cssText=`position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:999999`;document.body.append(cover);}
  },{delay,blocked,never,broken});
}

test('first-round brush picker opens through an intercepted preview and delayed choices, then confirms each width',async({page},info)=>{
  const {commands,isAttached}=await setup(page);await nativePicker(page,{delay:80,blocked:true});
  const plan={...shortPlan,strokes:[{...shortPlan.strokes[0],brushSize:40},{...shortPlan.strokes[0],id:1,brushSize:4}]};
  await page.evaluate(plan=>__skribblDrawer.startPlan(plan),plan);
  expect(await page.evaluate(()=>selectedSizes)).toEqual([40,4]);expect(await page.evaluate(()=>pickerOpens)).toBe(2);
  expect(await page.evaluate(()=>inputEvents.filter(e=>e.type==='down').length)).toBe(2);expect(commands.at(-1)).toMatchObject({type:'mouseReleased',buttons:0});expect(isAttached()).toBe(false);
  await page.locator('#game-wrapper').screenshot({path:info.outputPath('first-round-picker.png')});
});

test('Stop during first-round picker initialization cancels before any canvas input and restart works',async({page})=>{
  const {commands,isAttached}=await setup(page);await nativePicker(page,{delay:400});
  await page.evaluate(plan=>{window.outcome=null;__skribblDrawer.startPlan(plan).then(()=>outcome='completed',e=>outcome=e.name);},shortPlan);
  await expect.poll(()=>page.evaluate(()=>pickerOpens),{intervals:[10]}).toBe(1);await page.evaluate(()=>__skribblDrawer.stopPlan());
  await expect.poll(()=>page.evaluate(()=>outcome)).toBe('AbortError');expect(await page.evaluate(()=>inputEvents)).toEqual([]);expect(isAttached()).toBe(false);
  await expect(page.locator('#game-toolbar .sizes .container')).not.toHaveClass(/open/);
  await expect(page.locator('#game-toolbar .sizes .size')).toHaveCount(5);
  expect(await page.evaluate(()=>selectedSizes)).toEqual([]);await page.evaluate(plan=>__skribblDrawer.startPlan(plan),shortPlan);
  expect(await page.evaluate(()=>selectedSizes)).toEqual([4]);expect(commands.at(-1)).toMatchObject({type:'mouseReleased',buttons:0});expect(isAttached()).toBe(false);
});

test('unready or rejected brush selection fails without drawing, and turn loss cancels the readiness wait',async({page})=>{
  const {isAttached}=await setup(page);await nativePicker(page,{never:true});
  expect(await page.evaluate(plan=>__skribblDrawer.startPlan(plan).catch(e=>e.message),shortPlan)).toContain('brush-size picker did not become ready');
  expect(await page.evaluate(()=>inputEvents)).toEqual([]);expect(isAttached()).toBe(false);
  await nativePicker(page,{broken:true});expect(await page.evaluate(plan=>__skribblDrawer.startPlan(plan).catch(e=>e.message),shortPlan)).toContain('Could not select the game brush size');
  expect(await page.evaluate(()=>inputEvents)).toEqual([]);expect(isAttached()).toBe(false);
  await nativePicker(page,{never:true});await page.evaluate(plan=>{window.outcome=null;__skribblDrawer.startPlan(plan).then(()=>outcome='completed',e=>outcome=e.name);},shortPlan);
  await expect.poll(()=>page.evaluate(()=>pickerOpens)).toBe(1);await page.evaluate(()=>showOverlay(true));await expect.poll(()=>page.evaluate(()=>outcome)).toBe('AbortError');expect(isAttached()).toBe(false);
  expect(await page.evaluate(()=>inputEvents)).toEqual([]);
});

test('a real Stop click interrupts a held curve, acknowledges cleanup, and permits restart',async({page},info)=>{
  test.setTimeout(20000);
  const {commands,isAttached}=await setup(page);
  const long={...shortPlan,strokes:[{...shortPlan.strokes[0],points:Array.from({length:10000},(_,i)=>({x:100+i%400,y:200+Math.floor(i/400)}))}]};
  await page.evaluate(async()=>{
    const host=document.createElement('div');host.id='stop-studio';host.style.cssText='position:absolute;left:890px;top:20px;width:300px';document.body.append(host);
    window.stopStudio=SAGDrawerStudio.mount(host,{compact:true,draw:plan=>__skribblDrawer.startPlan(plan),stop:async()=>{await __skribblDrawer.stopPlan();await new Promise(resolve=>setTimeout(resolve,250));}});
    const image=document.createElement('canvas');image.width=800;image.height=600;const ctx=image.getContext('2d');ctx.fillStyle='#ef130b';ctx.fillRect(100,100,200,200);
    await stopStudio.loadSession({source:image.toDataURL(),auto:false});
  });
  const host=page.locator('#stop-studio'),start=host.getByRole('button',{name:'Start drawing',exact:true});
  await host.getByRole('button',{name:'Process image',exact:true}).click();await expect(start).toBeEnabled();
  await page.evaluate(plan=>Object.assign(stopStudio.getPlan(),plan),long);await start.click();
  await expect.poll(()=>page.evaluate(()=>inputEvents.filter(e=>e.type==='move'&&e.buttons===1).length)).toBeGreaterThan(4);
  const box=await host.getByRole('button',{name:'Stop',exact:true}).boundingBox();
  const began=Date.now();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await expect(host.locator('.status')).toHaveText('Stopping drawing…');await expect(start).toBeDisabled();
  await expect(host.locator('.status')).toHaveText('Stopped.');expect(Date.now()-began).toBeLessThan(1500);
  expect(isAttached()).toBe(false);expect(commands.at(-1)).toMatchObject({type:'mouseReleased',buttons:0});
  const count=commands.length;await expect(start).toBeEnabled();await page.waitForTimeout(180);expect(commands).toHaveLength(count);
  await host.screenshot({path:info.outputPath('stop-acknowledged.png')});
  // Retargeted input models a pointer-captured user click whose target remains
  // the canvas even though its screen coordinates are inside Stop.
  await start.click();await expect.poll(()=>page.evaluate(()=>inputEvents.filter(e=>e.type==='down').length)).toBeGreaterThan(1);
  await page.evaluate(()=>{const rect=document.querySelector('#stop-studio').shadowRoot.querySelector('[data-act=stop]').getBoundingClientRect();document.querySelector('#game-canvas canvas').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,buttons:1,clientX:rect.x+rect.width/2,clientY:rect.y+rect.height/2}));});
  await expect(host.locator('.status')).toHaveText('Stopped.');expect(isAttached()).toBe(false);
  await page.evaluate(plan=>Object.assign(stopStudio.getPlan(),plan),shortPlan);await start.click();await expect(host.locator('.status')).toContainText('Drawing complete');expect(isAttached()).toBe(false);
});

test('Escape cancels a held curve and Stop invalidates a start before its first await completes',async({page})=>{
  const {commands,isAttached}=await setup(page);
  expect(await page.evaluate(async plan=>{const job=__skribblDrawer.startPlan(plan).then(()=> 'completed',e=>e.name);await __skribblDrawer.stopPlan();return job;},shortPlan)).toBe('AbortError');
  expect(commands).toHaveLength(0);
  const long={...shortPlan,strokes:[{...shortPlan.strokes[0],points:Array.from({length:10000},(_,i)=>({x:100+i%400,y:250}))}]};
  await page.evaluate(plan=>{window.outcome=null;__skribblDrawer.startPlan(plan).then(()=>outcome='completed',e=>outcome=e.name);},long);
  await expect.poll(()=>page.evaluate(()=>inputEvents.filter(e=>e.type==='move'&&e.buttons===1).length)).toBeGreaterThan(4);
  await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>outcome)).toBe('AbortError');expect(isAttached()).toBe(false);
  expect(commands.at(-1)).toMatchObject({type:'mouseReleased',buttons:0});const count=commands.length;await page.waitForTimeout(100);expect(commands).toHaveLength(count);
  await page.evaluate(plan=>__skribblDrawer.startPlan(plan),shortPlan);expect(isAttached()).toBe(false);
});
