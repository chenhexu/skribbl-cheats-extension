const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../drawing-engine');
function image(w,h,pixel){const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(pixel(x,y),(y*w+x)*4);return {width:w,height:h,data};}

test('auto distinguishes flat colors from texture and chooses a faster photo starting point',async()=>{
  const art=image(180,120,(x,y)=>[[239,19,11,255],[0,204,0,255],[0,178,255,255],[255,228,0,255]][(x>=90?1:0)+(y>=60?2:0)]);
  const photo=image(180,120,(x,y)=>[(x*17+y*43)%256,(x*37+y*13)%256,(x*23+y*31)%256,255]);
  const a=await E.suggestSettings(art),p=await E.suggestSettings(photo);
  assert.equal(a.kind,'flat-artwork');assert.equal(a.settings.colors,4);
  assert.equal(p.kind,'photograph');assert.ok(p.settings.merge>a.settings.merge);assert.ok(p.settings.colors<=6);
  assert.equal(p.settings.fillMode,'bucket');assert.equal(p.settings.bgThreshold,0);
});

test('auto retains large colorful regions in shaded artwork instead of the old ten-color ceiling',async()=>{
  const sharp=require('sharp'),{wheel,wedgeColors}=require('./fixtures/colorful-art.cjs');
  const {data,info}=await sharp(wheel).resize(240,240).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const input={width:info.width,height:info.height,data};
  const normal=await E.suggestSettings(input),short=await E.suggestSettings(input,{budget:15});
  assert.equal(normal.features.colorfulArtwork,true);assert.ok(normal.settings.colors>=12 && normal.settings.colors<=24);assert.ok(normal.settings.merge<=12);
  assert.ok(short.settings.colors>=8 && short.settings.colors<normal.settings.colors);
  const {simplified}=await E.processRGBA(input,{...normal.settings,budget:300});
  const counts=new Map();for(let i=0;i<simplified.data.length;i+=4)if(simplified.data[i+3]>=128){const key=[...simplified.data.slice(i,i+3)].join(',');counts.set(key,(counts.get(key)||0)+1);}
  for(const hex of wedgeColors){const key=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',');assert.ok(counts.get(key)>input.width*input.height*.01,'retains a substantial '+hex+' wedge');}
});

test('auto can use 24 colors for broad swatches while colorful pixel noise stays conservative',async()=>{
  const palette=E.PALETTE.slice(0,24).map(hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).concat(255));
  const swatches=image(240,160,(x,y)=>palette[Math.floor(x/40)+Math.floor(y/40)*6]);
  const noise=image(240,160,(x,y)=>palette[(x*13+y*7)%palette.length]);
  const a=await E.suggestSettings(swatches),b=await E.suggestSettings(noise);
  assert.equal(a.features.colorfulArtwork,true);assert.equal(a.settings.colors,24);
  assert.equal(b.features.colorfulArtwork,false);assert.ok(b.settings.colors<=6);
});

test('auto retains thin monochrome lines and ignores transparent letterboxing',async()=>{
  const drawing=image(160,100,(x,y)=>x===13||y===37?[0,0,0,255]:[255,255,255,255]);
  const padded=image(160,160,(x,y)=>y<30||y>=130?[255,0,0,0]:x===13||y===67?[0,0,0,255]:[255,255,255,255]);
  const a=await E.suggestSettings(drawing),b=await E.suggestSettings(padded);
  assert.equal(a.kind,'line-art');assert.equal(a.settings.colors,2);assert.equal('detail' in a.settings,false);assert.deepEqual(a.settings,b.settings);
  const ink=image(160,100,(x,y)=>x===13||y===37?[0,0,0,255]:[0,0,0,0]);assert.equal((await E.suggestSettings(ink)).kind,'line-art');
});

test('auto is repeatable, respects the drawing target and leaves detector/time to the user',async()=>{
  const input=image(180,120,(x,y)=>[(x*17+y*43)%256,(x*37+y*13)%256,(x*23+y*31)%256,255]);
  const normal=await E.suggestSettings(input),short=await E.suggestSettings(input,{budget:15}),repeat=await E.suggestSettings(input,{eventMs:80,detector:'ai'});
  assert.deepEqual(normal,repeat);assert.ok(short.settings.colors<normal.settings.colors);assert.equal('detail' in short.settings,false);
  assert.equal('detector' in normal.settings,false);assert.equal('budget' in normal.settings,false);
});

test('auto leaves palette room for a small white feature among large shaded regions',async()=>{
  const input=image(180,120,(x,y)=>x>=85&&x<95&&y>=50&&y<65?[255,255,255,255]:x<70?[193,193,193,255]:x<110?[80,80,80,255]:x<150?[119,119,119,255]:[0,70,25,255]);
  const suggested=await E.suggestSettings(input);assert.ok(suggested.settings.colors>=5);
  assert.ok((await E.suggestSettings(input,{budget:15})).settings.colors>=5);
  const {simplified}=await E.processRGBA(input,{...suggested.settings,budget:60});
  assert.deepEqual([...simplified.data.slice((55*180+90)*4,(55*180+90)*4+3)],[255,255,255]);
});

test('auto handles empty images and can be cancelled during analysis',async()=>{
  for(const color of [[0,0,0,0],[255,255,255,255]])assert.equal((await E.suggestSettings(image(40,40,()=>color))).kind,'blank');
  const controller=new AbortController(),pending=E.suggestSettings(image(800,600,()=>[100,50,20,255]),{},{signal:controller.signal});controller.abort();
  await assert.rejects(pending,{name:'AbortError'});
});

test('auto identifies fine linework while outline detail stays entirely manual for every target',async()=>{
  const fine=image(180,120,(x,y)=>x===100&&y>=10&&y<=110||x===170&&y>=10&&y<=110||y===10&&x>=100&&x<=170||y===110&&x>=100&&x<=170?[0,0,0,255]:x>=46&&x<=47?[195,195,195,255]:[255,255,255,255]);
  const suggestion=await E.suggestSettings(fine);assert.equal(suggestion.features.preciseLines,true);
  for(const budget of [15,60,120,300])for(const detail of [10,55,96])assert.equal('detail' in (await E.suggestSettings(fine,{budget,detail})).settings,false);
  const precise=await E.processRGBA(fine,{...suggestion.settings,detail:96,fillMode:'strokes',budget:300}),old=await E.processRGBA(fine,{...suggestion.settings,detail:72,fillMode:'strokes',budget:300});
  const retained=mask=>{let n=0;for(let y=30;y<90;y++)for(let x=43;x<51;x++)n+=mask[y*180+x];return n;};assert.ok(retained(precise.mask)>retained(old.mask),'faint internal line is retained by the higher detail');
  const blocks=image(180,120,x=>x<90?[0,0,0,255]:[239,19,11,255]),photo=image(180,120,(x,y)=>[(x*17+y*43)%256,(x*37+y*13)%256,(x*23+y*31)%256,255]);
  assert.equal((await E.suggestSettings(blocks)).features.preciseLines,false);const noisy=await E.suggestSettings(photo);assert.equal(noisy.features.preciseLines,false);assert.equal('detail' in noisy.settings,false);
});
