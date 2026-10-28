const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../drawing-engine');
function fixture(){const w=240,h=180,data=new Uint8ClampedArray(w*h*4),mask=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const plane=x>=40&&x<=205&&y>=65&&y<=100||x>=55&&x<=80&&y>=30&&y<65;mask[y*w+x]=plane?255:0;const texture=y>110&&((x%17<4&&y%19<5)||(x%31<7&&y%13<3));data.set(plane?[0,0,0,255]:y>110?(texture?[193,193,193,255]:[80,80,80,255]):[193,193,193,255],(y*w+x)*4);}return {input:{width:w,height:h,data},mask};}

test('subject fills and outlines finish before optional runway work; background brushes cannot touch it',async()=>{
  const {input,mask}=fixture();
  // A large hole and a detached part must get the same background protection.
  for(let y=72;y<94;y++)for(let x=110;x<155;x++)mask[y*240+x]=0;
  for(let y=125;y<138;y++)for(let x=155;x<180;x++){mask[y*240+x]=255;input.data.set([0,0,0,255],(y*240+x)*4);}
  const {plan}=await E.processRGBA(input,{focus:'subject-background',speed:'fast',budget:60},{subjectMask:mask,subjectSource:'manual'});
  const subject=plan.strokes.filter(s=>s.priority==='subject'),background=plan.strokes.filter(s=>s.priority==='background');assert.ok(subject.length>0);assert.ok(subject.some(s=>s.stage==='outline'));assert.ok(background.length>0);
  assert.ok(plan.strokes.slice(0,subject.length).every(s=>s.priority==='subject'));assert.ok(subject.every(s=>s.optional===false));assert.ok(background.every(s=>s.optional===true));assert.ok(plan.metrics.estimatedMs<=60000);
  for(const stroke of background)for(const part of E.strokeParts(stroke))for(let n=1;n<part.points.length;n++){const a=part.points[n-1],b=part.points[n],steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y));for(let t=0;t<=steps;t++){const x=Math.round(a.x+(b.x-a.x)*t/steps),y=Math.round(a.y+(b.y-a.y)*t/steps),radius=Math.ceil(stroke.brushSize/2)+2;for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(x+dx>=0&&x+dx<240&&y+dy>=0&&y+dy<180)assert.equal(mask[(y+dy)*240+x+dx],0);}}
  assert.equal(plan.focus.method,'manual');assert.equal(plan.focus.subjectOperations,subject.length);
});

test('subject-only avoids runway colors, takes fewer events, and remains deterministic',async()=>{
  const {input,mask}=fixture(),full=await E.processRGBA(input,{budget:60}),a=await E.processRGBA(input,{focus:'subject',speed:'fast',budget:60},{subjectMask:mask}),b=await E.processRGBA(input,{focus:'subject',speed:'fast',budget:60,eventMs:80},{subjectMask:mask});
  assert.ok(a.plan.strokes.every(s=>s.priority==='subject'));assert.ok(a.plan.strokes.every(s=>s.colorId===1));assert.equal(a.plan.focus.backgroundOperations,0);assert.ok(a.plan.metrics.events<full.plan.metrics.events*.5);assert.deepEqual(a.plan.strokes,b.plan.strokes);
});

test('subject selection is required, aligned and cancellable; an empty crop cannot silently draw the background',async()=>{
  const {input,mask}=fixture();await assert.rejects(E.processRGBA(input,{focus:'subject'}),/Select a main subject/);
  await assert.rejects(E.processRGBA(input,{focus:'subject'},{subjectMask:new Uint8Array(4)}),/Select a main subject/);
  await assert.rejects(E.processRGBA(input,{focus:'subject'},{subjectMask:new Uint8Array(mask.length)}),/No subject remains/);
  const controller=new AbortController();controller.abort();await assert.rejects(E.processRGBA(input,{focus:'subject'},{subjectMask:mask,signal:controller.signal}),{name:'AbortError'});
});

test('Fast mode reduces speckled color regions without changing the main silhouette',async()=>{
  const {input}=fixture(),balanced=await E.processRGBA(input,{speed:'balanced',budget:300}),fast=await E.processRGBA(input,{speed:'fast',budget:300});
  assert.ok(fast.plan.metrics.events<balanced.plan.metrics.events);assert.ok(fast.plan.metrics.buckets<balanced.plan.metrics.buckets);
  const center=(80*240+100)*4;assert.deepEqual([...fast.simplified.data.slice(center,center+3)],[0,0,0]);
});
