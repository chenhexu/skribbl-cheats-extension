const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
function plan(stress=false){
  const strokes=[],cols=stress?15:3,rows=stress?10:2;
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const a=15+x*49,b=15+y*49,contours=[[{x:a,y:b},{x:a+36,y:b},{x:a+36,y:b+36},{x:a,y:b+36},{x:a,y:b}]];
    if(!x&&!y)contours.push([{x:a+12,y:b+12},{x:a+24,y:b+12},{x:a+24,y:b+24},{x:a+12,y:b+24},{x:a+12,y:b+12}]);
    strokes.push({id:strokes.length,stage:'fill',kind:'region',colorId:4+(x+y)%12,brushSize:4,contours,seeds:[{x:a+6,y:b+6}]});
  }
  for(let j=0;j<(stress?500:12);j++)strokes.push({id:strokes.length,stage:'outline',colorId:1,brushSize:4,points:Array.from({length:16},(_,i)=>({x:50+i*35,y:530+Math.sin(i*.6+j)*15+j%3}))});
  return {version:2,width:800,height:600,settings:{budget:60,eventMs:8},strokes};
}
async function upload(page){await page.goto('/');await page.getByLabel('Upload image',{exact:true}).setInputFiles({name:'simple.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect x="100" y="100" width="200" height="200" fill="red"/></svg>')});await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Process image',exact:true}).click();await expect(page.getByRole('button',{name:'Download plan JSON',exact:true})).toBeEnabled();}

test('cached preview matches reference strokes, holes, rewind, overlays and changed skipped work',async({page},info)=>{
  await page.goto('/');
  const result=await page.evaluate(plan=>{
    const make=()=>{const c=document.createElement('canvas');c.width=800;c.height=600;return c;},expected=make(),actual=make(),reference=expected.getContext('2d',{willReadFrequently:true}),ctx=actual.getContext('2d',{willReadFrequently:true}),cache=SAGDrawingEngine.createPlanRenderer(plan,make),checks=[];let comparison;
    for(const options of [{fraction:0},{fraction:.01},{fraction:.03},{fraction:.1},{fraction:.3},{fraction:.7},{fraction:1},{fraction:.75},{fraction:.05},{fraction:1},{fraction:.5,directions:true},{fraction:.7,directions:true,travel:true},{fraction:1,directions:true,travel:true},{fraction:.2,directions:true},{fraction:1,skipped:[1,3,9],directions:true,travel:true},{fraction:.4,skipped:[1,3,9]},{fraction:1}]){
      SAGDrawingEngine.renderPlan(reference,plan,options);cache.render(ctx,options);const a=ctx.getImageData(0,0,800,600).data,b=reference.getImageData(0,0,800,600).data;let max=0,changed=0;
      for(let i=0;i<a.length;i++){const delta=Math.abs(a[i]-b[i]);max=Math.max(max,delta);if(delta>3)changed++;}
      checks.push({options,max,changed});if(options.fraction===.5&&options.directions)comparison={expected:expected.toDataURL(),actual:actual.toDataURL()};
    }
    const hole=[...ctx.getImageData(33,33,1,1).data],png=actual.toDataURL();cache.dispose();return {checks,hole,png,comparison};
  },plan());
  for(const [name,png]of Object.entries(result.comparison))await fs.writeFile(info.outputPath(name+'.png'),Buffer.from(png.split(',')[1],'base64'));
  // A transparent annotation cache can round overlapping antialiasing values
  // by a few levels. The underlying drawing, including holes, must be exact.
  for(const check of result.checks)expect(check.max,JSON.stringify(check)).toBeLessThanOrEqual(check.options.directions||check.options.travel||check.options.skipped?.length?4:0);
  expect(result.hole).toEqual([255,255,255,255]);await fs.writeFile(info.outputPath('cached-final.png'),Buffer.from(result.png.split(',')[1],'base64'));
});

test('late preview frames reuse bucket results instead of replaying all previous fills',async({page},info)=>{
  await page.goto('/');
  const result=await page.evaluate(plan=>{
    const allocated=[];let reads=0;
    const make=()=>{const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;allocated.push(canvas);const ctx=canvas.getContext('2d',{willReadFrequently:true}),read=ctx.getImageData.bind(ctx);ctx.getImageData=(...args)=>{reads++;return read(...args);};return canvas;};
    const output=make().getContext('2d'),cache=SAGDrawingEngine.createPlanRenderer(plan,make),reference=document.createElement('canvas');reference.width=800;reference.height=600;const baselineCtx=reference.getContext('2d',{willReadFrequently:true});
    cache.render(output,{fraction:.5,directions:true,travel:true});const before=reads,cached=[],baseline=[];
    for(let i=0;i<12;i++){const options={fraction:.55+i*.04,directions:true,travel:true};let t=performance.now();cache.render(output,options);cached.push(performance.now()-t);t=performance.now();SAGDrawingEngine.renderPlan(baselineCtx,plan,options);baseline.push(performance.now()-t);}
    const lateReads=reads-before,liveCanvases=allocated.filter(canvas=>canvas.width>0).length;cache.dispose();
    return {cached,baseline,lateReads,liveCanvases};
  },plan(true));
  const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];result.cachedMedianMs=median(result.cached);result.baselineMedianMs=median(result.baseline);result.speedup=result.baselineMedianMs/Math.max(.01,result.cachedMedianMs);
  expect(result.lateReads).toBe(0);expect(result.liveCanvases).toBeLessThanOrEqual(9);expect(result.speedup).toBeGreaterThan(3);
  await fs.writeFile(info.outputPath('preview-timing.json'),JSON.stringify(result,null,2));
});

test('real path playback stays responsive late in a busy plan, pauses, and stops when leaving Path',async({page},info)=>{
  await upload(page);await page.evaluate(plan=>{
    Object.assign(studio.getPlan(),plan);const create=SAGDrawingEngine.createPlanRenderer;window.previewFrameTimes=[];
    SAGDrawingEngine.createPlanRenderer=(...args)=>{const cache=create(...args),render=cache.render.bind(cache);cache.render=(...args)=>{const t=performance.now();render(...args);previewFrameTimes.push(performance.now()-t);};return cache;};
  },plan(true));
  await page.getByLabel('Path position',{exact:true}).fill('700');await page.getByRole('button',{name:'Play path',exact:true}).click();
  await expect.poll(()=>page.getByLabel('Path position',{exact:true}).inputValue().then(Number)).toBeGreaterThanOrEqual(820);
  await page.getByRole('button',{name:'Pause path',exact:true}).click();const stopped=await page.getByLabel('Path position',{exact:true}).inputValue();await page.waitForTimeout(120);expect(await page.getByLabel('Path position',{exact:true}).inputValue()).toBe(stopped);
  const timings=await page.evaluate(()=>previewFrameTimes.slice(2)),sorted=[...timings].sort((a,b)=>a-b),p95=sorted[Math.floor(sorted.length*.95)];expect(timings.length).toBeGreaterThan(20);expect(p95).toBeLessThan(50);
  await page.locator('canvas').screenshot({path:info.outputPath('late-path.png')});
  await page.getByRole('button',{name:'Play path',exact:true}).click();await page.getByRole('tab',{name:'Original',exact:true}).click();await expect(page.getByRole('button',{name:'Play path',exact:true})).toBeVisible();
  await fs.writeFile(info.outputPath('ui-frame-times.json'),JSON.stringify({frames:timings.length,p95Ms:p95,timings},null,2));
});

test('playback retains fractional progress at different refresh rates and caps catch-up after a stall',async({page})=>{
  await upload(page);
  const result=await page.evaluate(()=>{
    const pending=new Map(),native=requestAnimationFrame,nativeCancel=cancelAnimationFrame;let serial=-1,clock;
    window.requestAnimationFrame=callback=>{clock??=performance.now();pending.set(serial,callback);return serial--;};window.cancelAnimationFrame=id=>{if(id<0)pending.delete(id);else nativeCancel(id);};
    const shadow=document.querySelector('#studio').shadowRoot,range=shadow.querySelector('[name=playhead]'),play=shadow.querySelector('[data-act=play]');
    const tick=delta=>{clock+=delta;const batch=[...pending.values()];pending.clear();for(const callback of batch)callback(clock);};
    const simulate=(frames,delta)=>{range.value=0;clock=undefined;play.click();for(let i=0;i<frames;i++)tick(delta);play.click();return +range.value;};
    const hz60=simulate(60,1000/60),hz120=simulate(120,1000/120);range.value=0;clock=undefined;play.click();tick(1000);const afterStall=+range.value;play.click();window.requestAnimationFrame=native;window.cancelAnimationFrame=nativeCancel;return {hz60,hz120,afterStall};
  });
  expect(result.hz60).toBeGreaterThanOrEqual(82);expect(result.hz60).toBeLessThanOrEqual(85);expect(Math.abs(result.hz120-result.hz60)).toBeLessThanOrEqual(1);expect(result.afterStall).toBeLessThanOrEqual(5);
});
