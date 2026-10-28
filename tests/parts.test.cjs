const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../drawing-engine');
function image(w,h,color=[255,255,255,255]){const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++)data.set(color,i*4);return {width:w,height:h,data};}
function rect(input,x,y,w,h,color){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)input.data.set(color,(yy*input.width+xx)*4);}
const at=(index,x,y)=>index.labels[y*index.width+x];

test('parts keep disconnected same-color shapes separate, preserve thin lines and exclude transparent holes',async()=>{
  const input=image(41,31);rect(input,3,5,9,12,[150,25,15,255]);rect(input,22,5,9,12,[150,25,15,255]);rect(input,12,5,8,12,[0,180,30,255]);rect(input,17,20,1,10,[0,0,0,255]);rect(input,6,9,1,1,[150,25,15,0]);
  const index=await E.segmentParts(input);
  assert.equal(at(index,6,9),-1);assert.equal(at(index,4,6),at(index,10,15));assert.notEqual(at(index,4,6),at(index,24,6));assert.notEqual(at(index,4,6),at(index,13,6));
  assert.equal(at(index,17,20),at(index,17,29));assert.notEqual(at(index,17,25),at(index,18,25));assert.equal(index.regions[at(index,4,6)].area,107);
  const selected=index.regions[at(index,17,25)];assert.equal(selected.area,10);for(const i of index.pixels.subarray(selected.offset,selected.offset+selected.area))assert.equal(i%41,17);
});

test('Part grouping merges adjacent similar shades while remaining deterministic',async()=>{
  const input=image(40,20,[150,150,150,255]);rect(input,20,0,20,20,[169,169,169,255]);
  const low=await E.segmentParts(input,{similarity:4}),high=await E.segmentParts(input,{similarity:18}),again=await E.segmentParts(input,{similarity:18});
  assert.notEqual(at(low,5,10),at(low,30,10));assert.equal(at(high,5,10),at(high,30,10));assert.deepEqual(high.labels,again.labels);assert.deepEqual(high.regions,again.regions);
});

test('connected parts respect enclosed holes and do not drift across a whole gradient',async()=>{
  const input=image(40,40);rect(input,8,8,24,24,[200,0,0,255]);rect(input,12,12,16,16,[255,255,255,255]);const ring=await E.segmentParts(input);
  assert.notEqual(at(ring,0,0),at(ring,20,20));assert.equal(ring.regions[at(ring,20,20)].area,256);
  const gradient=image(256,8);for(let y=0;y<8;y++)for(let x=0;x<256;x++)gradient.data.set([x,x,x,255],(y*256+x)*4);
  const groups=await E.segmentParts(gradient,{similarity:18});assert.notEqual(at(groups,0,0),at(groups,255,0));assert.ok(groups.regions.length>=4);
});

test('part grouping validates dimensions, yields and cancels without returning stale labels',async()=>{
  await assert.rejects(E.segmentParts({width:800,height:601,data:[]}),/Invalid parts image/);
  const controller=new AbortController(),pending=E.segmentParts(image(800,600),{},{signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});
  const blank=image(20,20,[0,0,0,0]),index=await E.segmentParts(blank);assert.equal(index.regions.length,0);assert.ok(index.labels.every(v=>v===-1));
});
