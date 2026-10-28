const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const Transport=require('../plan-transport');
const E=require('../drawing-engine');
const rectangle=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h},{x,y}];
const body=rectangle(320,250,100,230),face=rectangle(320,130,100,105),bag=rectangle(180,315,110,110),hat=rectangle(300,100,140,26);
const plan={version:2,width:800,height:600,palette:E.PALETTE,settings:{budget:60,eventMs:8},strokes:[
  ...[[14,body,{x:350,y:300}],[14,hat,{x:350,y:110}],[22,face,{x:350,y:170}],[24,bag,{x:220,y:350}]].map(([colorId,contour,seed],id)=>({id,kind:'region',stage:'fill',colorId,brushSize:4,contours:[contour],seeds:[seed],optional:false})),
  ...[body,hat,face,bag].map((points,i)=>({id:4+i,stage:'outline',colorId:1,brushSize:4,points})),
  {id:8,stage:'outline',colorId:1,brushSize:4,points:[{x:342,y:157},{x:342,y:168}]},
  {id:9,stage:'outline',colorId:1,brushSize:4,points:[{x:395,y:157},{x:395,y:168}]},
  {id:10,stage:'outline',colorId:1,brushSize:4,points:[{x:345,y:195},{x:370,y:210},{x:395,y:195}]},
]};
async function setup(page,{cover=false,trustedOnly=false,reject=false,mobile=false,changeDuring=false}={}){
  await page.goto('/');const session=await page.context().newCDPSession(page);let attached=false;
  const transport=new Transport({attach:async()=>{attached=true;},detach:async()=>{attached=false;},command:async(_tab,method,params)=>session.send(method,params)});
  await page.exposeFunction('__colorBridge',async msg=>{try{let value;if(msg.action==='planBegin')value=await transport.begin(1,msg.runId);else if(msg.action==='planStroke')value=await transport.stroke(1,msg.runId,msg.points);else if(msg.action==='planTool')value=await transport.tool(1,msg.runId,msg.points);else if(msg.action==='planCancel')value=await transport.cancel(1,msg.runId);return {ok:true,...value};}catch(error){return {ok:false,error:error.message,cancelled:error.name==='AbortError'};}});
  await page.evaluate(({palette,cover,trustedOnly,reject,mobile,changeDuring})=>{
    document.querySelector('header').hidden=true;document.querySelector('main').hidden=true;
    const fixture=document.createElement('section');fixture.id='game-wrapper';fixture.style.cssText='position:absolute;left:20px;top:20px;width:850px;background:#fff';
    fixture.innerHTML='<div id="game-word"><div class="word">mailman</div></div><div id="game-canvas"><canvas width="800" height="600" style="display:block"></canvas></div><div id="game-toolbar"><div class="toolbar-group-tools"><button class="tool selected" data-tooltip="Brush">Brush</button><button class="tool" data-tooltip="Fill">Fill</button></div><svg width="44" height="44"><rect id="color-preview-primary" width="22" height="44"/><rect id="color-preview-secondary" x="22" width="22" height="44"/></svg><button class="color-preview-mobile" style="width:44px;height:44px">Colors</button><div class="colors"><div class="top" style="display:flex"></div><div class="bottom" style="display:flex"></div></div><div class="sizes"><div class="size selected" style="width:30px;height:30px">4</div></div></div>';
    document.body.append(fixture);window.currentColor=palette[14];window.secondaryColor=palette[24];window.currentTool=0;window.canvasEvents=[];window.paletteEvents=[];
    const primary=document.querySelector('#color-preview-primary'),secondary=document.querySelector('#color-preview-secondary'),mobileControl=fixture.querySelector('.color-preview-mobile');
    window.setPrimary=color=>{currentColor=color;primary.style.fill=color;mobileControl.style.backgroundColor=color;};setPrimary(currentColor);secondary.style.fill=secondaryColor;
    for(const [i,color]of palette.entries()){
      const el=document.createElement('div');el.className='color';el.style.cssText='width:22px;height:22px;background:'+color;el.dataset.color=color;
      el.addEventListener('pointerdown',event=>{paletteEvents.push({color,button:event.button,alt:event.altKey,trusted:event.isTrusted});if(reject||trustedOnly&&!event.isTrusted)return;if(event.button===0&&!event.altKey)setPrimary(color);else{secondaryColor=color;secondary.style.fill=color;}});
      fixture.querySelector(i%2?'.colors .bottom':'.colors .top').append(el);
    }
    if(mobile){primary.remove();const style=document.createElement('style');style.textContent='#game-toolbar .colors{display:none}#game-toolbar .colors.open{display:block}';document.head.append(style);mobileControl.onclick=()=>fixture.querySelector('.colors').classList.toggle('open');}
    fixture.querySelector('.size').onclick=event=>event.currentTarget.classList.add('selected');fixture.querySelectorAll('.tool').forEach((el,i)=>el.onclick=()=>{currentTool=i;fixture.querySelectorAll('.tool').forEach((tool,j)=>tool.classList.toggle('selected',i===j));});
    if(cover){const colors=fixture.querySelectorAll('.colors .top .color'),a=colors[11].getBoundingClientRect(),b=fixture.querySelector('.colors .bottom').getBoundingClientRect(),overlay=document.createElement('div');overlay.id='palette-cover';overlay.style.cssText=`position:fixed;left:${a.left}px;top:${a.top}px;width:44px;height:${b.bottom-a.top}px;z-index:999999;background:#dbeafe`;overlay.textContent='Panel';document.body.append(overlay);}
    const c=fixture.querySelector('canvas'),ctx=c.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,800,600);ctx.lineCap=ctx.lineJoin='round';let pressed=false,lastMove=0,changed=false;
    for(const type of ['pointerdown','pointermove','pointerup'])c.addEventListener(type,event=>{
      const r=c.getBoundingClientRect(),x=Math.floor((event.clientX-r.left)*800/r.width),y=Math.floor((event.clientY-r.top)*600/r.height);canvasEvents.push({type,color:currentColor,trusted:event.isTrusted,buttons:event.buttons,tool:currentTool});
      if(type==='pointerdown'&&currentTool===1){const pixels=ctx.getImageData(0,0,800,600);SAGDrawingEngine.floodRGBA(pixels.data,800,600,{x,y},[1,3,5].map(i=>parseInt(currentColor.slice(i,i+2),16)));ctx.putImageData(pixels,0,0);}
      else if(type==='pointerdown'){pressed=true;c.setPointerCapture(event.pointerId);ctx.beginPath();ctx.moveTo(x,y);}
      else if(type==='pointermove'&&pressed&&event.buttons===1){const now=performance.now();if(now-lastMove<1000/90)return;lastMove=now;ctx.strokeStyle=currentColor;ctx.lineWidth=4;ctx.lineTo(x,y);ctx.stroke();}
      else if(type==='pointerup'){pressed=false;if(c.hasPointerCapture(event.pointerId))c.releasePointerCapture(event.pointerId);if(changeDuring&&!changed){changed=true;setPrimary(palette[14]);}}
    });
    window.chrome={runtime:{id:'fixture',sendMessage:(msg,callback)=>__colorBridge(msg).then(callback),connect:()=>({disconnect(){}})},storage:{local:{set:async()=>{}}}};
  },{palette:E.PALETTE,cover,trustedOnly,reject,mobile,changeDuring});
  await page.addScriptTag({content:await fs.readFile('drawer.js','utf8')});return {isAttached:()=>attached};
}
const readPixels=page=>page.evaluate(()=>{const ctx=document.querySelector('#game-canvas canvas').getContext('2d');return {uniform:[...ctx.getImageData(350,300,1,1).data],face:[...ctx.getImageData(350,170,1,1).data],bag:[...ctx.getImageData(220,350,1,1).data],outside:[...ctx.getImageData(50,50,1,1).data]};});

test('covered skin/brown swatches keep their planned colors instead of the previous uniform blue',async({page},info)=>{
  const {isAttached}=await setup(page,{cover:true});await page.evaluate(plan=>__skribblDrawer.startPlan(plan),plan);
  const pixels=await readPixels(page);await page.locator('#game-canvas canvas').screenshot({path:info.outputPath('mailman-actual.png')});
  expect(pixels).toEqual({uniform:[0,178,255,255],face:[255,172,142,255],bag:[160,82,45,255],outside:[255,255,255,255]});
  expect(await page.evaluate(()=>canvasEvents.every(e=>e.trusted))).toBe(true);expect(isAttached()).toBe(false);
  expect(await page.evaluate(()=>paletteEvents.every(e=>e.button===0&&!e.alt))).toBe(true);expect(await page.evaluate(()=>secondaryColor)).toBe(E.PALETTE[24]);
  const matches=await page.evaluate(plan=>{const c=document.createElement('canvas');c.width=800;c.height=600;SAGDrawingEngine.renderPlan(c.getContext('2d'),plan);return [c.getContext('2d').getImageData(350,170,1,1).data[0],c.getContext('2d').getImageData(220,350,1,1).data[0]];},plan);expect(matches).toEqual([255,160]);
});

test('palette rejection stops before painting the next region in the old color',async({page})=>{
  const {isAttached}=await setup(page,{reject:true});const skinOnly={...plan,strokes:[plan.strokes[2]]};
  expect(await page.evaluate(plan=>__skribblDrawer.startPlan(plan).then(()=>null,e=>e.message),skinOnly)).toContain('Could not select the game color');
  expect(await page.evaluate(()=>canvasEvents)).toEqual([]);expect(isAttached()).toBe(false);
});

test('trusted palette fallback and a mobile color preview both confirm the actual primary color',async({page})=>{
  const {isAttached}=await setup(page,{trustedOnly:true,mobile:true});await page.evaluate(plan=>__skribblDrawer.startPlan(plan),plan);
  const pixels=await readPixels(page);expect(pixels.face).toEqual([255,172,142,255]);expect(pixels.bag).toEqual([160,82,45,255]);expect(await page.evaluate(()=>paletteEvents.some(e=>e.trusted))).toBe(true);expect(isAttached()).toBe(false);
});

test('a changed primary color between sealing and bucket input is restored before filling',async({page})=>{
  const {isAttached}=await setup(page,{changeDuring:true});await page.evaluate(plan=>__skribblDrawer.startPlan(plan),{...plan,strokes:[plan.strokes[2]]});
  expect((await readPixels(page)).face).toEqual([255,172,142,255]);expect(await page.evaluate(()=>canvasEvents.filter(e=>e.type==='pointerdown').every(e=>e.color==='#ffac8e'))).toBe(true);expect(isAttached()).toBe(false);
});

test('a covered swatch requiring trusted input fails without clicking the covering panel or drawing',async({page})=>{
  const {isAttached}=await setup(page,{cover:true,trustedOnly:true});await page.evaluate(()=>{window.coverClicks=0;document.querySelector('#palette-cover').onpointerdown=()=>coverClicks++;});
  const error=await page.evaluate(plan=>__skribblDrawer.startPlan(plan).then(()=>null,e=>e.message),{...plan,strokes:[plan.strokes[2]]});expect(error).toContain('Could not select the game color');
  expect(await page.evaluate(()=>coverClicks)).toBe(0);expect(await page.evaluate(()=>canvasEvents)).toEqual([]);expect(isAttached()).toBe(false);
});

test('missing primary-color feedback fails explicitly before any canvas input',async({page})=>{
  const {isAttached}=await setup(page);await page.evaluate(()=>{document.querySelector('#color-preview-primary').remove();document.querySelector('.color-preview-mobile').remove();});
  expect(await page.evaluate(plan=>__skribblDrawer.startPlan(plan).then(()=>null,e=>e.message),plan)).toContain('primary-color preview not found');
  expect(await page.evaluate(()=>canvasEvents)).toEqual([]);expect(isAttached()).toBe(false);
});
