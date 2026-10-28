const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../drawing-engine');
function image(w,h,pixel){const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(pixel(x,y),(y*w+x)*4);return {width:w,height:h,data};}
function blueprint(){return image(180,140,(x,y)=>{
  if(y<10||y>=130)return [0,0,0,0];
  if(x>=30&&x<=150&&(y===35||y===95)||y>=35&&y<=95&&(x===30||x===150)||y>=105&&y<=117&&(x===60||x===63))return [236,244,251,255];
  if(x>=30&&x<=150&&(y===34||y===36||y===94||y===96))return [130,163,192,255];
  if(x%12===0||y%12===0)return [18,104,170,255];
  return [0,86,158,255];
});}

test('Auto recognizes bright blueprint ink, not a broad white object on a dark field',async()=>{
  const suggestion=await E.suggestSettings(blueprint());assert.equal(suggestion.kind,'blueprint');assert.equal(suggestion.settings.treatment,'light-lines');assert.equal(suggestion.settings.colors,2);
  const solid=image(180,140,(x,y)=>Math.hypot(x-90,y-70)<25?[245,245,245,255]:[0,86,158,255]);
  assert.notEqual((await E.suggestSettings(solid)).settings.treatment,'light-lines');
});

test('blueprint uses a required blue background then single white centerlines, without gray/black layers or a faint grid',async()=>{
  const input=blueprint(),suggestion=await E.suggestSettings(input),a=await E.processRGBA(input,{...suggestion.settings,budget:60}),b=await E.processRGBA(input,{...suggestion.settings,budget:60,eventMs:80});
  const {plan,mask}=a,fill=plan.strokes.filter(s=>s.stage==='fill'),ink=plan.strokes.filter(s=>s.stage==='outline');
  assert.equal(fill.length,1);assert.equal(fill[0].colorId,15);assert.equal(fill[0].optional,false);assert.equal(fill[0].seeds.length,1);assert.ok(ink.length>0);
  assert.ok(ink.every(s=>s.colorId===0));assert.deepEqual([...new Set(plan.strokes.map(s=>s.colorId))],[15,0]);
  assert.ok(mask[35*180+80]);assert.equal(mask[24*180+10],0);assert.equal(mask[36*180+80],0);
  assert.equal(ink.filter(s=>s.points.every(p=>p.y===35)).length,0); // rectangle is one loop, not four doubled edges
  assert.ok(ink.some(s=>Math.hypot(s.points[0].x-s.points.at(-1).x,s.points[0].y-s.points.at(-1).y)<1));
  assert.equal(mask[110*180+61],0);assert.equal(mask[110*180+62],0); // close parallel strokes remain separate
  assert.ok(plan.metrics.estimatedMs<=60000);assert.deepEqual(plan.strokes,b.plan.strokes);assert.deepEqual(a.simplified,b.simplified);
  for(let x=0;x<180;x++)assert.equal(a.simplified.data[x*4+3],0);
  const standard=await E.processRGBA(input,{colors:3,budget:60});assert.ok(plan.metrics.events<standard.plan.metrics.events*.5);
});

test('light-lines treatment keeps AI explicit and filters ink components without creating edge pairs',async()=>{
  const input=blueprint(),opts={treatment:'light-lines',detector:'ai',closeGaps:0,budget:60};
  await assert.rejects(E.processRGBA(input,opts),/AI line image is missing/);
  const lineMask=new Uint8Array(180*140);lineMask[35*180+80]=255;
  const {plan,mask}=await E.processRGBA(input,opts,{lineMask});assert.ok(plan.strokes.some(s=>s.stage==='outline'));assert.ok(mask[35*180+80]);assert.equal(mask[110*180+60],0);
  assert.ok(plan.strokes.filter(s=>s.stage==='outline').every(s=>s.colorId===0));
  const controller=new AbortController();controller.abort();await assert.rejects(E.processRGBA(input,opts,{lineMask,signal:controller.signal}),{name:'AbortError'});
});

test('light ink can use the rest of the drawing budget without losing its background prerequisite',()=>{
  const fills=[{kind:'region',stage:'fill',colorId:15,brushSize:4,contours:[[{x:0,y:0},{x:99,y:0},{x:99,y:99},{x:0,y:99},{x:0,y:0}]],seeds:[{x:50,y:50}],optional:false}];
  const lines=Array.from({length:120},(_,y)=>({stage:'outline',colorId:0,brushSize:4,points:[{x:10,y},{x:90,y}],score:80}));
  const plan=E.budgetStrokes(fills,lines,E.settings({treatment:'light-lines',budget:10}));
  assert.equal(plan[0].stage,'fill');assert.equal(plan[0].optional,false);assert.equal(plan.length,121);assert.equal(E.metrics(plan).colorChanges,2);
});
