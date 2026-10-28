const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../drawing-engine');
function labelsFor(w,h,pixel){return Int16Array.from({length:w*h},(_,i)=>pixel(i%w,(i/w)|0)?1:-1);}
function capsule(x,y,ax,ay,bx,by,r){const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));return Math.hypot(x-ax-t*dx,y-ay-t*dy)<=r;}

test('thick round-ended lines use the matching game pencil, without contour or bucket operations',async()=>{
  for(const brushSize of [10,20,32,40])for(const diagonal of [false,true]){
    const w=260,h=170,labels=labelsFor(w,h,(x,y)=>capsule(x,y,35,45,220,diagonal?125:45,brushSize/2));
    const fills=await E.bucketRegions(labels,w,h,E.settings(),undefined);
    assert.equal(fills.length,1);assert.equal(fills[0].kind,'pencil-region',`size ${brushSize}, diagonal ${diagonal}`);assert.equal(fills[0].brushSize,brushSize);
    const parts=E.strokeParts(fills[0]);assert.ok(parts.every(part=>!part.bucket));assert.ok(parts.reduce((n,p)=>n+p.points.length,0)<35);
    const painted=E.rasterContours(parts.map(p=>p.points),w,h,0,0,brushSize);let hit=0,total=0,spill=0;
    for(let i=0;i<labels.length;i++){if(labels[i]===1){total++;if(painted[i])hit++;}else if(painted[i])spill++;}
    assert.ok(hit/total>=.93);assert.ok(spill/(hit+spill)<=.04);
  }
});

test('wide pencil follows a curved ring and preserves its hole and nearby line',async()=>{
  const w=240,h=190,labels=labelsFor(w,h,(x,y)=>Math.abs(Math.hypot(x-90,y-95)-55)<=10||capsule(x,y,175,30,175,160,10));
  const fills=await E.bucketRegions(labels,w,h,E.settings(),undefined);
  assert.equal(fills.length,2);assert.ok(fills.every(s=>s.kind==='pencil-region'&&s.brushSize===20));
  const painted=new Uint8Array(w*h);for(const fill of fills){const layer=E.rasterContours(E.strokeParts(fill).map(p=>p.points),w,h,0,0,fill.brushSize);for(let i=0;i<painted.length;i++)painted[i]|=layer[i];}
  assert.equal(painted[95*w+90],0);assert.equal(painted[95*w+160],0);assert.equal(painted[95*w+175],1);
});

test('filled shapes and strongly varying line widths keep their safe bucket plan',async()=>{
  const w=220,h=140;
  for(const pixel of [(x,y)=>Math.hypot(x-100,y-70)<45,(x,y)=>capsule(x,y,25,60,180,60,5+x/9)]){
    const fills=await E.bucketRegions(labelsFor(w,h,pixel),w,h,E.settings(),undefined);
    assert.ok(fills.every(s=>s.kind==='region'));assert.ok(fills.some(s=>s.seeds.length));
  }
});

test('full processing avoids redundant black edge tracing and keeps pencil paths atomic under budgeting',async()=>{
  const w=260,h=140,data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=capsule(x,y,35,60,220,60,10)?0:255;data.set([v,v,v,255],(y*w+x)*4);}
  const {plan}=await E.processRGBA({width:w,height:h,data},{colors:2,merge:0,budget:60});
  assert.equal(plan.metrics.buckets,0);assert.equal(plan.strokes.length,1);assert.equal(plan.strokes[0].kind,'pencil-region');assert.equal(plan.strokes[0].brushSize,20);assert.ok(plan.metrics.moves<=2);
  const json=JSON.parse(JSON.stringify(plan));assert.deepEqual(E.strokeParts(json.strokes[0]),E.strokeParts(plan.strokes[0]));
  assert.deepEqual(E.budgetStrokes(plan.strokes,[],E.settings({budget:10}))[0].paths,plan.strokes[0].paths);
});

test('four-to-five-pixel curved ink uses center pencils instead of many tiny bucket compartments',async()=>{
  const w=260,h=210;
  for(const width of [4,5]){
    const labels=labelsFor(w,h,(x,y)=>Math.abs(Math.hypot(x-110,y-105)-65)<=width/2&&x<150);
    const fills=await E.bucketRegions(labels,w,h,E.settings({speed:'balanced'}));
    assert.equal(fills.length,1);assert.equal(fills[0].kind,'pencil-region',`width ${width}`);assert.equal(fills[0].brushSize,4);assert.ok(fills[0].parallelScore>=.9);assert.equal(E.metrics(fills).buckets,0);
    const painted=E.rasterContours(E.strokeParts(fills[0]).map(p=>p.points),w,h,0,0,4);assert.equal(painted[105*w+110],0);
  }
});

test('a connected group with more than twelve branches keeps pencil planning and clipped canvas ends',async()=>{
  for(const radius of [2.5,3]){
  const w=360,h=260,labels=labelsFor(w,h,(x,y)=>capsule(x,y,60,0,60,250,radius)||Array.from({length:10},(_,i)=>30+i*22).some(row=>capsule(x,y,60,row,340,row+9,radius)));
  const fills=await E.bucketRegions(labels,w,h,E.settings({speed:'balanced'}));
  assert.equal(fills.length,1);assert.equal(fills[0].kind,'pencil-region');assert.ok(fills[0].parallelScore>=.9);assert.equal(E.metrics(fills).buckets,0);assert.ok(fills[0].paths.length>12);
  }
});

test('parallel narrow loops preserve small interior holes',async()=>{
  const w=90,h=90,labels=labelsFor(w,h,(x,y)=>Math.abs(Math.hypot(x-45,y-45)-12)<=2.5);
  const fills=await E.bucketRegions(labels,w,h,E.settings());
  assert.equal(fills[0].kind,'pencil-region');const painted=E.rasterContours(E.strokeParts(fills[0]).map(p=>p.points),w,h,0,0,4);assert.equal(painted[45*w+45],0);
});
