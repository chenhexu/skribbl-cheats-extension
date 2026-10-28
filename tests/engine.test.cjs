const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../drawing-engine');
function image(w,h,pixel){const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(pixel(x,y),4*(y*w+x));return {data,width:w,height:h};}

test('a flat mountain boundary survives when source shades map to the same game gray; faint texture stays suppressed',async()=>{
  const input=image(180,120,(x,y)=>y>=20+Math.abs(x-90)&&y<110?[140,140,140,255]:[180,161,127,255]);
  const {plan,simplified}=await E.processRGBA(input,{detail:62,colors:6,merge:12,budget:60});
  assert.equal(plan.sourceColors,1,'both source regions map to the same game swatch');
  assert.deepEqual([...simplified.data.slice((80*180+90)*4,(80*180+90)*4+3)],[193,193,193]);
  assert.ok(plan.strokes.some(s=>s.stage==='outline'&&s.points.some(p=>p.y<60)&&E.pathLength(s.points)>50),'mountain skyline remains a continuous outline');
  const textured=image(180,120,(x,y)=>{const v=170+(x*13+y*7)%9;return [v,v,v,255];}),soft=image(180,120,x=>{const v=140+Math.round(x/6);return [v,v,v,255];});
  for(const scene of [textured,soft])assert.equal((await E.processRGBA(scene,{detail:62,budget:60})).plan.strokes.filter(s=>s.stage==='outline').length,0);
});

test('off-grid lines and disconnected shapes survive tracing without bridges',async()=>{
  const w=80,h=80,mask=new Uint8Array(w*h);for(let y=10;y<65;y++){mask[y*w+10]=1;mask[y*w+40]=1;}
  const paths=await E.trace(mask,w,h);
  assert.equal(paths.length,2);
  for(const p of paths){assert.ok(p.length>50);assert.equal(new Set(p.map(v=>v.x)).size,1);const fitted=E.curvePath(p);assert.ok(fitted.every(v=>Math.abs(v.x-p[0].x)<.01));}
});

test('thinning two-pixel diagonals preserves their full extent and separate continuous paths',async()=>{
  const w=120,h=100,mask=new Uint8Array(w*h);
  for(let y=10;y<80;y++)for(const offset of [90,110]){mask[y*w+offset-y]=1;mask[y*w+offset-y-1]=1;}
  const skeleton=await E.thin(mask,w,h),paths=await E.trace(skeleton,w,h);
  assert.equal(paths.length,2);for(const path of paths){assert.ok(E.pathLength(path)>90);assert.ok(Math.min(...path.map(p=>p.y))<=11);assert.ok(Math.max(...path.map(p=>p.y))>=78);}
});
test('a closed ring is one continuous path; branches split',async()=>{
  const w=50,h=50,mask=new Uint8Array(w*h);
  for(let n=10;n<=30;n++){mask[10*w+n]=mask[30*w+n]=mask[n*w+10]=mask[n*w+30]=1;}
  const [loop,...other]=await E.trace(mask,w,h);assert.equal(other.length,0);assert.deepEqual(loop[0],loop.at(-1));
  const cross=new Uint8Array(w*h);for(let n=10;n<=30;n++){cross[n*w+20]=1;cross[20*w+n]=1;}
  const paths=await E.trace(cross,w,h);assert.equal(paths.length,4);
});
test('spline fitting preserves a right-angle corner and no arbitrary 24-point cuts',async()=>{
  const p=[];for(let x=0;x<=100;x++)p.push({x,y:10});for(let y=11;y<=100;y++)p.push({x:100,y});
  const curve=E.curvePath(p,1.5);assert.ok(curve.some(p=>p.x===100&&p.y===10));assert.ok(curve.length<10);assert.ok(curve.every(p=>Math.min(Math.abs(p.y-10),Math.abs(p.x-100))<=1.5));
  const circle=E.curvePath(Array.from({length:361},(_,n)=>({x:200+100*Math.cos(n*Math.PI/180),y:200+100*Math.sin(n*Math.PI/180)})));
  assert.ok(circle.length>24);assert.ok(Math.hypot(circle[0].x-circle.at(-1).x,circle[0].y-circle.at(-1).y)<.01);
});
test('similar shades merge, strong red/blue differences remain, stages are ordered',async()=>{
  const input=image(140,100,(x,y)=>x<65?[225+(x%2)*3,30,30,255]:[25,35,225,255]);
  const {plan}=await E.processRGBA(input,{colors:6,merge:20,budget:300});
  const fillColors=new Set(plan.strokes.filter(s=>s.stage==='fill').map(s=>s.colorId));assert.equal(fillColors.size,2);assert.ok(fillColors.has(4));assert.ok(fillColors.has(16));
  let outlines=false;for(const s of plan.strokes){if(s.stage==='outline')outlines=true;else assert.equal(outlines,false);}
  assert.ok(plan.strokes.length>0);assert.ok(plan.metrics.estimatedMs<=300000);
});
test('round fill footprints do not cross transparent holes or another color',async()=>{
  const w=100,h=100,input=image(w,h,(x,y)=>Math.hypot(x-50,y-50)<15?[0,0,0,0]:[230,25,25,255]);
  const {plan}=await E.processRGBA(input,{budget:300,merge:10,fillMode:'strokes'});
  for(const s of plan.strokes.filter(s=>s.stage==='fill'))for(let k=0;k<=40;k++){
    const a=s.points[0],b=s.points.at(-1),x=a.x+(b.x-a.x)*k/40,y=a.y;
    assert.ok(Math.hypot(x-50,y-50)>=15+s.brushSize/2-1,`unsafe fill at ${x},${y}, size ${s.brushSize}`);
  }
});
test('24 representative colors survive processing and palette mapping',async()=>{
  const colors=E.PALETTE.slice(0,24).map(hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)));
  const input=image(240,160,(x,y)=>[...colors[Math.floor(y/40)*6+Math.floor(x/40)],255]);
  const result=await E.processRGBA(input,{colors:24,merge:0,budget:300,skipWhite:false});
  assert.equal(result.plan.settings.colors,24);assert.equal(result.plan.sourceColors,24);
  const actual=new Set();for(let i=0;i<result.simplified.data.length;i+=4)actual.add([...result.simplified.data.slice(i,i+3)].join(','));
  assert.equal(actual.size,24);assert.equal(new Set(result.plan.strokes.filter(s=>s.stage==='fill').map(s=>s.colorId)).size,24);
});

function simplifiedColors(result){const colors=new Set();for(let i=0;i<result.simplified.data.length;i+=4)if(result.simplified.data[i+3])colors.add([...result.simplified.data.slice(i,i+3)].join(','));return colors;}
test('a three-color mapped picture is identical at limits 3 and 24, including its small warm region',async()=>{
  const input=image(160,120,(x,y)=>x>=65&&x<77&&y>=45&&y<57?[169,130,100,255]:Array(3).fill(Math.round(70+120*x/159)).concat(255));
  const high=await E.processRGBA(input,{colors:24,merge:14,budget:300}),low=await E.processRGBA(input,{colors:3,merge:14,budget:300});
  assert.equal(high.plan.sourceColors,3);assert.deepEqual(low.simplified.data,high.simplified.data);assert.equal(low.plan.sourceColors,3);
  assert.ok([...simplifiedColors(low)].some(color=>{const c=color.split(',').map(Number);return Math.max(...c)-Math.min(...c)>20;}));
});
test('low color limits retain a meaningful colored accent among large neutral bands',async()=>{
  const input=image(160,120,(x,y)=>x>=65&&x<77&&y>=45&&y<57?[196,94,50,255]:Array(3).fill(x<55?245:x<110?145:15).concat(255));
  const palettes=[];
  for(const colors of [2,3,6,24]){const result=await E.processRGBA(input,{colors,merge:14,budget:300}),palette=simplifiedColors(result);assert.ok(palette.size<=colors);assert.equal(result.plan.sourceColors,palette.size);assert.ok([...palette].some(color=>{const c=color.split(',').map(Number);return Math.max(...c)-Math.min(...c)>20;}));palettes.push(palette);}
  for(let i=1;i<palettes.length;i++)for(const color of palettes[i-1])assert.ok(palettes[i].has(color),'lower limits use surviving actual colors, not new averaged grays');
});
test('reducing distinct hues chooses existing game colors instead of inventing a gray average',async()=>{
  const input=image(150,100,x=>x<75?[239,19,11,255]:x<120?[0,204,0,255]:[35,31,211,255]);
  const result=await E.processRGBA(input,{colors:2,merge:0,budget:300});assert.equal(result.plan.sourceColors,2);
  for(const color of simplifiedColors(result))assert.ok(['239,19,11','0,204,0','35,31,211'].includes(color));
});
test('a grayscale source stays grayscale instead of receiving a forced accent color',async()=>{
  const input=image(160,100,x=>Array(3).fill(Math.round(x*255/159)).concat(255)),result=await E.processRGBA(input,{colors:3,merge:14,budget:300});
  assert.ok(result.plan.sourceColors<=3);for(const color of simplifiedColors(result)){const c=color.split(',').map(Number);assert.equal(c[0],c[1]);assert.equal(c[1],c[2]);}
});
test('blank and transparent inputs have no drawing commands',async()=>{
  for(const pixel of [[255,255,255,255],[0,0,0,0]]){
    const {plan}=await E.processRGBA(image(50,50,()=>pixel));assert.equal(plan.strokes.length,0);assert.equal(plan.metrics.estimatedMs,0);
  }
});
test('AI never silently falls back, uses aligned masks and supports cancellation',async()=>{
  const input=image(50,50,()=>[255,255,255,255]);
  await assert.rejects(E.processRGBA(input,{detector:'ai'}),/AI line image is missing/);
  const mask=new Uint8Array(2500);for(let y=5;y<40;y++)mask[y*50+13]=255;
  const {plan}=await E.processRGBA(input,{detector:'ai'},{lineMask:mask});assert.ok(plan.strokes.some(s=>s.stage==='outline'));assert.ok(plan.strokes.every(s=>s.points.every(p=>Math.abs(p.x-13)<1)));
  const controller=new AbortController();controller.abort();await assert.rejects(E.processRGBA(input,{}, {signal:controller.signal}),{name:'AbortError'});
});
test('thinning preserves topology and finishes on thick input',async()=>{
  const w=50,h=50,mask=new Uint8Array(w*h);for(let y=5;y<45;y++)for(let x=15;x<22;x++)mask[y*w+x]=1;
  const thin=await E.thin(mask,w,h);assert.ok(thin.reduce((a,b)=>a+b,0)<50);const paths=await E.trace(thin,w,h);assert.equal(paths.length,1);
});

test('small aligned gaps close without joining nearby parallel lines',async()=>{
  const w=70,h=50,mask=new Uint8Array(w*h);
  for(let x=5;x<=20;x++)mask[10*w+x]=1;for(let x=24;x<=50;x++)mask[10*w+x]=1;
  for(let y=20;y<=40;y++){mask[y*w+15]=1;mask[y*w+18]=1;}
  const {mask:closed,closed:count}=await E.closeGaps(mask,w,h,4);
  assert.equal(count,1);for(let x=20;x<=24;x++)assert.equal(closed[10*w+x],1);
  assert.equal(closed[30*w+16],0);assert.equal(closed[30*w+17],0);
  assert.equal((await E.trace(closed,w,h)).length,3);
  assert.deepEqual((await E.closeGaps(mask,w,h,0)).mask,mask);
});

test('bucket regions seal holes and disconnected shapes before using safe interior seeds',async()=>{
  const w=120,h=100,labels=new Int16Array(w*h).fill(-1);
  for(let y=10;y<90;y++)for(let x=10;x<100;x++)if(!(x>=40&&x<65&&y>=35&&y<65))labels[y*w+x]=4;
  for(let y=30;y<60;y++)for(let x=108;x<114;x++)labels[y*w+x]=4;
  const regions=await E.bucketRegions(labels,w,h,E.settings(),undefined);
  assert.equal(regions.length,2);assert.equal(regions[0].contours.length,2);
  const white=new Uint8ClampedArray(w*h*4).fill(255);
  for(const r of regions){for(const loop of r.contours)assert.deepEqual(loop[0],loop.at(-1));
    const barrier=E.rasterContours(r.contours,w,h);
    for(let i=0;i<barrier.length;i++)if(barrier[i])white.set([239,19,11,255],i*4);
    for(const seed of r.seeds)E.floodRGBA(white,w,h,seed,[239,19,11]);
  }
  assert.deepEqual([...white.slice((50*w+50)*4,(50*w+50)*4+3)],[255,255,255]);
  assert.deepEqual([...white.slice((5*w+5)*4,(5*w+5)*4+3)],[255,255,255]);
  for(let y=15;y<85;y++)for(let x=15;x<95;x++)if(labels[y*w+x]===4)assert.equal(white[(y*w+x)*4],239);
});

test('a bucket fill covers the mountain up to its thin aligned border',async()=>{
  const w=180,h=120,input=image(w,h,(x,y)=>y>=100-x*.55&&y>=x*.65-20?[90,90,90,255]:[255,255,255,255]);
  const {plan,mask}=await E.processRGBA(input,{budget:60,colors:2});
  assert.equal(plan.version,2);assert.equal(plan.metrics.buckets,1);
  const fill=plan.strokes.find(s=>s.kind==='region');assert.ok(fill);assert.equal(fill.contours.length,1);
  // Every boundary loop is present in its entirety, never partially budgeted.
  assert.deepEqual(fill.contours[0][0],fill.contours[0].at(-1));
  assert.ok(mask[71*w+50]||mask[72*w+50]||mask[73*w+50]);
  assert.ok(plan.strokes.filter(s=>s.stage==='outline').every(s=>s.brushSize===4));
  const low=E.budgetStrokes([fill],[],E.settings({budget:10,eventMs:100}));
  assert.ok(low.length===0||low[0].contours.length===fill.contours.length);
});

test('processing coverage and colors repeat exactly despite previous drawing latency',async()=>{
  const input=image(180,120,(x,y)=>x<90?[230,30+y%20,20,255]:[20,70,200+y%30,255]);
  const a=await E.processRGBA(input,{budget:10,eventMs:8});
  const b=await E.processRGBA(input,{budget:10,eventMs:80});
  const c=await E.processRGBA(input,{budget:10,eventMs:8});
  assert.deepEqual(a.simplified,b.simplified);assert.deepEqual(a.plan.strokes,b.plan.strokes);assert.deepEqual(a.plan.strokes,c.plan.strokes);assert.deepEqual(a.plan.omitted,b.plan.omitted);
  assert.ok(b.plan.metrics.estimatedMs>a.plan.metrics.estimatedMs); // Only the estimate may change.
});
