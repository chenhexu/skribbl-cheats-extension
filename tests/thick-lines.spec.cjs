const {test,expect}=require('@playwright/test');
test('wide pencil regions render and replay without filling holes or losing thickness',async({page},info)=>{
  await page.goto('/');
  const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="white"/><path d="M80 90H710" stroke="black" stroke-width="40" stroke-linecap="round"/><path d="M80 180L710 290" stroke="black" stroke-width="20" stroke-linecap="round"/><circle cx="380" cy="440" r="90" fill="none" stroke="black" stroke-width="32"/></svg>');
  await page.getByLabel('Upload image',{exact:true}).setInputFiles({name:'thick-lines.svg',mimeType:'image/svg+xml',buffer:svg});await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Process image',exact:true}).click();await expect(page.getByRole('button',{name:'Download plan JSON',exact:true})).toBeEnabled({timeout:90000});
  const result=await page.evaluate(()=>{
    const plan=studio.getPlan(),make=()=>{const c=document.createElement('canvas');c.width=800;c.height=600;return c;},reference=make(),actual=make(),ctx=reference.getContext('2d',{willReadFrequently:true}),other=actual.getContext('2d',{willReadFrequently:true}),renderer=SAGDrawingEngine.createPlanRenderer(plan,make),differences=[];
    for(const fraction of [.1,.5,1,.2,1]){SAGDrawingEngine.renderPlan(ctx,plan,{fraction});renderer.render(other,{fraction});const a=ctx.getImageData(0,0,800,600).data,b=other.getImageData(0,0,800,600).data;let changed=0,max=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i]){changed++;max=Math.max(max,Math.abs(a[i]-b[i]));}differences.push({fraction,changed,max});}
    const pixel=(x,y)=>[...other.getImageData(x,y,1,1).data];renderer.dispose();return {metrics:plan.metrics,sizes:plan.strokes.filter(s=>s.kind==='pencil-region').map(s=>s.brushSize).sort((a,b)=>a-b),differences,thick:pixel(400,105),outside:pixel(400,120),ring:pixel(380,350),hole:pixel(380,440)};
  });
  expect(result.sizes).toEqual([20,32,40]);expect(result.metrics.buckets).toBe(0);expect(result.differences.map(d=>d.changed)).toEqual([0,0,0,0,0]);expect(result.thick).toEqual([0,0,0,255]);expect(result.ring).toEqual([0,0,0,255]);expect(result.outside).toEqual([255,255,255,255]);expect(result.hole).toEqual([255,255,255,255]);
  await page.locator('#studio').screenshot({path:info.outputPath('wide-pencil-preview.png')});await require('node:fs/promises').writeFile(info.outputPath('wide-pencil-metrics.json'),JSON.stringify(result,null,2));
});
