const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const Transport=require('../plan-transport');

test('plan executor uses real trusted CDP drags and stops when the drawing turn is lost',async({page},info)=>{
  await page.goto('/');
  const session=await page.context().newCDPSession(page);let attached=false;
  const transport=new Transport({attach:async()=>{attached=true;},detach:async()=>{attached=false;},command:async(_tab,method,params)=>session.send(method,params)});
  let bridgeTransport=transport;
  await page.exposeFunction('__planBridge',async msg=>{
    try{
      let value;
      if(msg.action==='planBegin')value=await bridgeTransport.begin(1,msg.runId);
      else if(msg.action==='planStroke')value=await bridgeTransport.stroke(1,msg.runId,msg.points);
      else if(msg.action==='planTool')value=await bridgeTransport.tool(1,msg.runId,msg.points);
      else if(msg.action==='planCancel')value=await bridgeTransport.cancel(1,msg.runId);
      return {ok:true,...value};
    }catch(e){return {ok:false,error:e.message,cancelled:e.name==='AbortError'};}
  });
  await page.evaluate(()=>{
    document.querySelector('header').hidden=true;document.querySelector('main').hidden=true;
    const fixture=document.createElement('section');fixture.id='game-wrapper';fixture.style.cssText='position:absolute;left:20px;top:20px;width:850px;background:white';
    fixture.innerHTML='<div id="game-word"><div class="word">test word</div></div><div id="game-canvas"><canvas width="800" height="600" style="display:block;border:0"></canvas><div class="reveal" style="display:none">The word was</div></div><div id="game-toolbar"><div class="toolbar-group-tools"><button class="tool">Brush</button><button class="tool">Fill</button></div><div class="colors"><div class="top"></div></div><div class="sizes"><div class="size-preview" style="width:50px;height:28px">Brush</div><div class="container" style="display:none"></div></div></div>';
    document.body.append(fixture);window.turnActive=true;window.inputEvents=[];window.currentColor='#000';window.currentBrush=4;
    const preview=document.createElementNS('http://www.w3.org/2000/svg','svg');preview.setAttribute('width','20');preview.setAttribute('height','20');preview.innerHTML='<rect id="color-preview-primary" width="20" height="20" style="fill:#000"/>';fixture.querySelector('#game-toolbar').prepend(preview);
    for(const [id,color]of SAGDrawingEngine.PALETTE.entries()){const el=document.createElement('div');el.className='color';el.style.cssText='display:inline-block;width:22px;height:22px;background:'+color;el.onpointerdown=()=>{window.currentColor=color;document.querySelector('#color-preview-primary').style.fill=color;};fixture.querySelector('.colors .top').append(el);}
    const sizeContainer=fixture.querySelector('.sizes .container');fixture.querySelector('.size-preview').onclick=()=>sizeContainer.style.display=sizeContainer.style.display==='none'?'block':'none';
    for(const size of [4,10,20,32,40]){const el=document.createElement('div');el.className='size clickable';el.style.cssText='display:inline-block;width:28px;height:28px;border:1px solid gray';el.textContent=size;el.onclick=()=>{window.currentBrush=size;sizeContainer.querySelectorAll('.size').forEach(choice=>choice.classList.toggle('selected',choice===el));sizeContainer.style.display='none';};sizeContainer.append(el);}
    window.currentTool=0;window.toolChanges=[];
    fixture.querySelectorAll('.tool').forEach((el,i)=>{el.dataset.tooltip=i?'Fill':'Brush';el.onclick=()=>{window.currentTool=i;window.toolChanges.push(i);fixture.querySelectorAll('.tool').forEach((t,j)=>t.classList.toggle('selected',i===j));};});
    const canvas=fixture.querySelector('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,800,600);ctx.lineCap=ctx.lineJoin='round';let pressed=false,lastMove=0;
    for(const [nativeType,type]of [['pointerdown','mousedown'],['pointermove','mousemove'],['pointerup','mouseup']])canvas.addEventListener(nativeType,event=>{inputEvents.push({type,buttons:event.buttons,trusted:event.isTrusted,tool:currentTool});const rect=canvas.getBoundingClientRect(),x=Math.floor((event.clientX-rect.left)*800/rect.width),y=Math.floor((event.clientY-rect.top)*600/rect.height);if(type==='mousedown'&&currentTool===1){const pixels=ctx.getImageData(0,0,800,600),color=[1,3,5].map(i=>parseInt(currentColor.slice(i,i+2),16));SAGDrawingEngine.floodRGBA(pixels.data,800,600,{x,y},color);ctx.putImageData(pixels,0,0);}else if(type==='mousedown'){pressed=true;canvas.setPointerCapture(event.pointerId);ctx.beginPath();ctx.moveTo(x,y);}else if(type==='mousemove'&&pressed&&event.buttons===1){const now=performance.now();if(now-lastMove<1000/90)return;lastMove=now;ctx.strokeStyle=currentColor;ctx.lineWidth=currentBrush;ctx.lineTo(x,y);ctx.stroke();}else if(type==='mouseup'){pressed=false;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);}});
    window.chrome={runtime:{id:'fixture',sendMessage:(msg,callback)=>window.__planBridge(msg).then(callback),connect:()=>({disconnect(){}})},storage:{local:{set:async()=>{}}}};
  });
  await page.addScriptTag({content:await fs.readFile('drawer.js','utf8')});
  const curve=Array.from({length:101},(_,i)=>({x:400+100*Math.cos(i/100*Math.PI*2),y:300+100*Math.sin(i/100*Math.PI*2)}));
  const plan={version:1,width:800,height:600,settings:{budget:60,eventMs:8},strokes:[
    {id:0,stage:'fill',colorId:4,brushSize:20,points:[{x:100,y:150},{x:600,y:150}]},
    {id:1,stage:'outline',colorId:1,brushSize:4,points:curve},
  ]};
  expect(await page.evaluate(()=>window.__skribblDrawer.isPlanDrawingTurn())).toBe(true);
  await page.evaluate(plan=>window.__skribblDrawer.startPlan(plan),plan);
  const events=await page.evaluate(()=>inputEvents);expect(events.filter(e=>e.type==='mousedown')).toHaveLength(2);expect(events.filter(e=>e.type==='mouseup')).toHaveLength(2);expect(events.every(e=>e.trusted)).toBe(true);expect(events.filter(e=>e.type==='mousemove'&&e.buttons===1).length).toBeGreaterThan(80);expect(attached).toBe(false);
  const pencilResult=await page.evaluate(async()=>{
    inputEvents=[];toolChanges=[];const canvas=document.querySelector('#game-canvas canvas'),ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,800,600);
    const data=new Uint8ClampedArray(800*600*4).fill(255);for(let y=230;y<=270;y++)for(let x=80;x<=650;x++){const closest=Math.max(100,Math.min(630,x));if(Math.hypot(x-closest,y-250)<=20)data.set([0,0,0,255],(y*800+x)*4);}
    const {plan}=await SAGDrawingEngine.processRGBA({width:800,height:600,data},{budget:60,colors:2,merge:0});
    const result=await window.__skribblDrawer.startPlan(plan);
    return {result,kind:plan.strokes[0].kind,brush:currentBrush,buckets:plan.metrics.buckets,tools:toolChanges,events:inputEvents,center:[...ctx.getImageData(350,250,1,1).data],edge:[...ctx.getImageData(350,265,1,1).data],outside:[...ctx.getImageData(350,280,1,1).data]};
  });
  expect(pencilResult.kind).toBe('pencil-region');expect(pencilResult.brush).toBe(40);expect(pencilResult.buckets).toBe(0);expect(pencilResult.tools).not.toContain(1);expect(pencilResult.events.every(event=>event.trusted)).toBe(true);expect(pencilResult.center).toEqual([0,0,0,255]);expect(pencilResult.edge).toEqual([0,0,0,255]);expect(pencilResult.outside).toEqual([255,255,255,255]);expect(attached).toBe(false);
  const rectangle=(x,y,r,b)=>[{x,y},{x:r,y},{x:r,y:b},{x,y:b},{x,y}];
  const outer=rectangle(100,100,600,500),hole=rectangle(250,220,400,360);
  const bucketPlan={...plan,version:2,palette:require('../drawing-engine').PALETTE,strokes:[
    {id:0,kind:'region',stage:'fill',colorId:4,brushSize:4,contours:[outer,hole],seeds:[{x:150,y:150}]},
    {id:1,stage:'outline',colorId:1,brushSize:4,points:outer},
    {id:2,stage:'outline',colorId:1,brushSize:4,points:hole},
  ]};
  await page.evaluate(()=>{inputEvents=[];toolChanges=[];const ctx=document.querySelector('#game-canvas canvas').getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,800,600);
    const fill=document.querySelectorAll('.tool')[1],r=fill.getBoundingClientRect(),overlay=document.createElement('div');overlay.id='tool-overlay';overlay.style.cssText=`position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:99999`;document.body.append(overlay);
  });
  const fastResult=await page.evaluate(plan=>window.__skribblDrawer.startPlan(plan),bucketPlan);
  const bucketResult=await page.evaluate(plan=>{
    const actual=document.querySelector('#game-canvas canvas').getContext('2d').getImageData(0,0,800,600).data,preview=document.createElement('canvas');preview.width=800;preview.height=600;SAGDrawingEngine.renderPlan(preview.getContext('2d'),plan);const expected=preview.getContext('2d').getImageData(0,0,800,600).data;
    let differences=0;for(let i=0;i<actual.length;i++)if(actual[i]!==expected[i])differences++;
    return {differences,events:inputEvents,tools:toolChanges,outside:[...actual.slice((50*800+50)*4,(50*800+50)*4+3)],hole:[...actual.slice((280*800+300)*4,(280*800+300)*4+3)],inside:[...actual.slice((150*800+150)*4,(150*800+150)*4+3)]};
  },bucketPlan);
  expect(bucketResult.outside).toEqual([255,255,255]);expect(bucketResult.hole).toEqual([255,255,255]);expect(bucketResult.inside).toEqual([239,19,11]);
  // Incremental canvas strokes can accumulate antialiasing at corners; the
  // executed coverage and preview must otherwise match (under 0.01% channels).
  expect(bucketResult.differences).toBeLessThan(192);
  expect(bucketResult.tools).toEqual([1,0]);
  expect(bucketResult.events.filter(e=>e.type==='mousedown').map(e=>e.tool)).toEqual([0,0,1,0,0]);
  expect(attached).toBe(false);
  await page.evaluate(()=>document.getElementById('tool-overlay').remove());
  // White centerlines need their blue background first, even past the normal
  // optional-fill reserve. Execute a plan from the shared blueprint pipeline.
  const blueprint=await fs.readFile('tests/fixtures/blueprint.svg','utf8');
  const lightPlan=await page.evaluate(async svg=>{const image=new Image();image.src='data:image/svg+xml;base64,'+btoa(svg);await image.decode();const input=SAGDrawingEngine.prepareImage(image).getContext('2d').getImageData(0,0,800,600),suggestion=await SAGDrawingEngine.suggestSettings(input);return (await SAGDrawingEngine.processRGBA(input,{...suggestion.settings,budget:60})).plan;},blueprint);
  const lightExecution=await page.evaluate(async plan=>{const ctx=document.querySelector('#game-canvas canvas').getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,800,600);inputEvents=[];toolChanges=[];const progress=[],result=await window.__skribblDrawer.startPlan(plan,{onProgress:p=>progress.push(p.stage)});return {result,progress,background:[...ctx.getImageData(48,48,1,1).data],ink:[...ctx.getImageData(220,235,1,1).data],tools:toolChanges};},lightPlan);
  expect(lightExecution.background).toEqual([0,86,158,255]);expect(lightExecution.ink).toEqual([255,255,255,255]);expect(lightExecution.tools).toEqual([1,0]);expect(lightExecution.progress).toContain('White line strokes');expect(lightExecution.result.skipped).toEqual([]);expect(attached).toBe(false);
  await fs.writeFile(info.outputPath('blueprint-execution.json'),JSON.stringify({elapsedMs:lightExecution.result.elapsedMs,metrics:lightPlan.metrics},null,2));
  await page.locator('#game-canvas canvas').screenshot({path:info.outputPath('blueprint-execution.png')});
  // Benchmark the actual input saved by focusing the plane, not just an estimate.
  const focusPlans=await page.evaluate(async()=>{
    const c=document.createElement('canvas');c.width=800;c.height=600;const ctx=c.getContext('2d');ctx.fillStyle='#c1c1c1';ctx.fillRect(0,0,800,600);ctx.fillStyle='#505050';ctx.fillRect(0,320,800,280);
    ctx.fillStyle='#c1c1c1';for(let y=340;y<580;y+=35)for(let x=20;x<780;x+=45)ctx.fillRect(x,y,4,5);
    const vertices=[[110,300],[240,270],[190,160],[230,150],[340,260],[620,260],[730,300],[620,325],[290,340],[110,320]];
    const drawPlane=context=>{context.beginPath();context.moveTo(...vertices[0]);for(const p of vertices.slice(1))context.lineTo(...p);context.closePath();context.fill();};ctx.fillStyle='#000';drawPlane(ctx);
    const maskCanvas=document.createElement('canvas');maskCanvas.width=800;maskCanvas.height=600;const mc=maskCanvas.getContext('2d');mc.fillStyle='#fff';drawPlane(mc);const pixels=mc.getImageData(0,0,800,600).data,mask=Uint8Array.from({length:800*600},(_,i)=>pixels[i*4+3]>=128?255:0),input=ctx.getImageData(0,0,800,600);
    return {full:(await SAGDrawingEngine.processRGBA(input,{budget:300,speed:'balanced',colors:3,merge:12})).plan,subject:(await SAGDrawingEngine.processRGBA(input,{budget:60,focus:'subject',speed:'fast',colors:3,merge:12},{subjectMask:mask})).plan};
  });
  const focusTimings={};for(const name of ['full','subject']){const result=await page.evaluate(async plan=>{const ctx=document.querySelector('#game-canvas canvas').getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,800,600);const result=await window.__skribblDrawer.startPlan(plan);return {...result,subject:[...ctx.getImageData(400,300,1,1).data],runway:[...ctx.getImageData(50,500,1,1).data]};},focusPlans[name]);focusTimings[name]={elapsedMs:result.elapsedMs,metrics:focusPlans[name].metrics};expect(result.subject).toEqual([0,0,0,255]);if(name==='subject')expect(result.runway).toEqual([255,255,255,255]);await page.locator('#game-canvas canvas').screenshot({path:info.outputPath('jet-'+name+'-execution.png')});}
  expect(focusTimings.subject.elapsedMs).toBeLessThan(focusTimings.full.elapsedMs);await fs.writeFile(info.outputPath('subject-speed.json'),JSON.stringify(focusTimings,null,2));
  // A late subject fill stays required; optional background cannot use its time.
  const limitedFocus={...focusPlans.subject,settings:{...focusPlans.subject.settings,budget:.001},strokes:focusPlans.subject.strokes.concat([{id:999,priority:'background',optional:true,stage:'fill',colorId:4,brushSize:4,points:[{x:40,y:500},{x:80,y:500}]}])};
  const limited=await page.evaluate(async plan=>{const ctx=document.querySelector('#game-canvas canvas').getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,800,600);const result=await window.__skribblDrawer.startPlan(plan);return {result,subject:[...ctx.getImageData(400,300,1,1).data],background:[...ctx.getImageData(50,500,1,1).data]};},limitedFocus);
  expect(limited.result.skipped).toEqual([999]);expect(limited.subject).toEqual([0,0,0,255]);expect(limited.background).toEqual([255,255,255,255]);expect(attached).toBe(false);
  // Reproduce a failed tool selection: never send the bucket click as a brush dot.
  await page.evaluate(()=>{inputEvents=[];const fill=document.querySelectorAll('.tool')[1];window.normalFillClick=fill.onclick;fill.onclick=()=>{};});
  expect(await page.evaluate(plan=>window.__skribblDrawer.startPlan(plan).then(()=>null,e=>e.message),bucketPlan)).toContain('Could not select the game Fill tool');
  expect(await page.evaluate(()=>inputEvents.filter(e=>e.type==='mousedown').map(e=>e.tool))).toEqual([0,0]);expect(attached).toBe(false);
  await page.evaluate(()=>document.querySelectorAll('.tool')[1].onclick=normalFillClick);
  // Optional local benchmark against the previous packaged executor/transport.
  // A clean checkout does not need an old ZIP to run the regression tests.
  try {
    await fs.access('dist/skribbl-auto-guesser-2.2.1.zip');
    const {execFileSync}=require('node:child_process'),vm=require('node:vm');
    const old=JSON.parse(execFileSync('python',['-c','import zipfile,json; z=zipfile.ZipFile("dist/skribbl-auto-guesser-2.2.1.zip"); print(json.dumps({p:z.read(p).decode("utf-8") for p in ["drawer.js","plan-transport.js"]}))'],{encoding:'utf8'}));
    const module={exports:{}};vm.runInNewContext(old['plan-transport.js'],{module,setTimeout,Date,Map});
    bridgeTransport=new module.exports({attach:async()=>{attached=true;},detach:async()=>{attached=false;},command:async(_tab,method,params)=>session.send(method,params)});
    await page.evaluate(()=>{window.fastDrawer=window.__skribblDrawer;const ctx=document.querySelector('#game-canvas canvas').getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,800,600);});
    await page.addScriptTag({content:old['drawer.js']});const baseline=await page.evaluate(plan=>window.__skribblDrawer.startPlan(plan),bucketPlan);
    await fs.writeFile(info.outputPath('cdp-timing.json'),JSON.stringify({baselineMs:baseline.elapsedMs,fastMs:fastResult.elapsedMs,speedup:baseline.elapsedMs/fastResult.elapsedMs},null,2));
    await page.evaluate(()=>window.__skribblDrawer=fastDrawer);bridgeTransport=transport;
  } catch(error) {if(error.code!=='ENOENT')throw error;}
  await page.evaluate(()=>{const canvas=document.querySelector('#game-canvas canvas');canvas.style.width='720px';canvas.style.height='540px';const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,800,600);});
  await page.evaluate(plan=>window.__skribblDrawer.startPlan(plan),bucketPlan);
  expect(await page.evaluate(()=>{const d=document.querySelector('#game-canvas canvas').getContext('2d').getImageData(0,0,800,600).data;return [[50,50],[300,280],[150,150]].map(([x,y])=>[...d.slice((y*800+x)*4,(y*800+x)*4+3)]);})).toEqual([[255,255,255],[255,255,255],[239,19,11]]);
  await page.locator('#game-canvas canvas').screenshot({path:info.outputPath('scaled-bucket-execution.png')});
  await page.evaluate(()=>{const canvas=document.querySelector('#game-canvas canvas');canvas.style.width='800px';canvas.style.height='600px';});
  await page.evaluate(()=>{inputEvents=[];const fill=document.querySelectorAll('.tool')[1];window.normalFillClick=fill.onclick;fill.onclick=()=>{normalFillClick();document.getElementById('game-wrapper').classList.add('toolbar-hidden');};});
  const interrupted=await page.evaluate(plan=>window.__skribblDrawer.startPlan(plan).then(()=>null,e=>e.name),bucketPlan);
  expect(interrupted).toBe('AbortError');expect(attached).toBe(false);
  const partial=await page.evaluate(()=>inputEvents);
  expect(partial.filter(e=>e.type==='mousedown').map(e=>e.tool)).toEqual([0,0]);
  expect(partial.at(-1).type).toBe('mouseup');
  await page.evaluate(()=>{document.getElementById('game-wrapper').classList.remove('toolbar-hidden');document.querySelectorAll('.tool')[1].onclick=normalFillClick;});
  const long={...plan,strokes:[{id:0,stage:'outline',colorId:1,brushSize:4,points:Array.from({length:10000},(_,i)=>({x:100+i%500,y:200+Math.floor(i/500)}))}]};
  await page.evaluate(plan=>{window.inputEvents=[];window.outcome=null;window.__skribblDrawer.startPlan(plan).then(()=>window.outcome='completed',e=>window.outcome=e.name);},long);
  await expect.poll(()=>page.evaluate(()=>inputEvents.filter(e=>e.type==='mousemove').length)).toBeGreaterThan(4);
  await page.evaluate(()=>document.getElementById('game-wrapper').classList.add('toolbar-hidden'));
  await expect.poll(()=>page.evaluate(()=>window.outcome)).toBe('AbortError');
  expect(attached).toBe(false);const cancelled=await page.evaluate(()=>inputEvents);expect(cancelled.at(-1).type).toBe('mouseup');expect(cancelled.length).toBeLessThan(10000);
});

test('compact studio fits a narrow drawer and cancels processing without stale completion',async({page},info)=>{
  await page.goto('/');await page.evaluate(()=>{
    document.querySelector('main').hidden=true;const host=document.createElement('div');host.id='compact';host.style.cssText='width:320px;margin:20px';document.body.append(host);window.compact=SAGDrawerStudio.mount(host,{compact:true,draw:async()=>{},stop:()=>{}});
  });
  const root=page.locator('#compact');await root.getByLabel('Upload image',{exact:true}).setInputFiles('tests/fixtures/sample-car.avif');await expect(root.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();
  await root.getByRole('button',{name:'Process image',exact:true}).click();await root.getByRole('button',{name:'Stop',exact:true}).click();await expect(root.locator('.status')).toHaveText('Stopped.');await expect(root.getByRole('button',{name:'Start drawing',exact:true})).toBeDisabled();
  await root.getByRole('button',{name:'Process image',exact:true}).click();await expect(root.getByRole('button',{name:'Start drawing',exact:true})).toBeEnabled({timeout:90000});await root.screenshot({path:info.outputPath('compact-preview.png')});
  expect(await root.evaluate(el=>el.shadowRoot.querySelector('.studio').scrollWidth)).toBeLessThanOrEqual(320);
});
