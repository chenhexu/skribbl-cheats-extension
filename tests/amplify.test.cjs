const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../drawing-engine');
function image(w,h,pixel){const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(pixel(x,y),(y*w+x)*4);return {width:w,height:h,data};}
function color(result,x,y){const i=(y*result.simplified.width+x)*4;return [...result.simplified.data.slice(i,i+4)];}
const night=()=>image(180,120,(x,y)=>y>90?[2,5,7,255]:x>130&&y<40?[220,220,218,255]:y>55&&y<75?[9,17,32,255]:[24,39,73,255]);

test('amplification retains the night sky as dark blue, deepest shadows as black and a neutral bright moon',async()=>{
  const input=night(),original=input.data.slice(),off=await E.processRGBA(input,{colors:6,merge:12,budget:300}),on=await E.processRGBA(input,{colors:6,merge:12,budget:300,amplify:70});
  assert.deepEqual(color(off,40,25),[0,0,0,255]);assert.deepEqual(color(on,40,25),[14,8,101,255]);
  assert.deepEqual(color(on,40,105),[0,0,0,255]);const moon=color(on,155,20);assert.ok(moon[0]>=190);assert.equal(moon[0],moon[1]);assert.equal(moon[1],moon[2]);
  assert.ok(on.plan.strokes.some(s=>s.stage==='fill'&&s.colorId===17));assert.ok(on.plan.sourceColors<=6);assert.deepEqual(input.data,original,'source pixels used by Original, AI and edge detection are untouched');
});

test('neutral images, pure black and transparency do not acquire invented hues',async()=>{
  const input=image(180,120,(x,y)=>y>100?[20,40,70,0]:Array(3).fill(Math.round(x*255/179)).concat(255));
  for(const amplify of [1,70,100]){const result=await E.processRGBA(input,{colors:6,amplify,budget:300});for(let i=0;i<result.simplified.data.length;i+=4){const [r,g,b,a]=result.simplified.data.slice(i,i+4);if(a){assert.equal(r,g);assert.equal(g,b);}else assert.equal(input.data[i+3],0);}assert.deepEqual(color(result,0,30),[0,0,0,255]);}
  const white=await E.processRGBA(image(30,30,()=>[255,255,255,255]),{amplify:100});assert.equal(white.plan.strokes.length,0);
});

test('amplification preserves warm shadows and repeats deterministically within the requested color limit',async()=>{
  const input=image(120,90,x=>x<40?[60,25,15,255]:x<80?[24,39,73,255]:[205,205,205,255]),opts={colors:3,amplify:70,merge:12,budget:300};
  const a=await E.processRGBA(input,opts),b=await E.processRGBA(input,opts);assert.deepEqual(a.simplified.data,b.simplified.data);assert.deepEqual(a.plan.strokes,b.plan.strokes);assert.ok(a.plan.sourceColors<=3);
  const warm=color(a,20,45);assert.ok(warm[0]>warm[2]*2);assert.deepEqual(color(a,60,45),[14,8,101,255]);
  assert.equal(E.settings({amplify:200}).amplify,100);assert.equal(E.settings({amplify:-10}).amplify,0);assert.equal(E.settings().amplify,0);
});

test('Auto leaves amplification to the user and light-lines keeps its white ink',async()=>{
  const input=night();assert.deepEqual(await E.suggestSettings(input,{amplify:0}),await E.suggestSettings(input,{amplify:100}));
  const blueprint=image(120,90,(x,y)=>x===40||y===45?[255,255,255,255]:[24,39,73,255]);
  const result=await E.processRGBA(blueprint,{treatment:'light-lines',amplify:70,budget:300});assert.deepEqual(color(result,10,10),[14,8,101,255]);assert.ok(result.plan.strokes.some(s=>s.stage==='outline'&&s.colorId===0));
});
