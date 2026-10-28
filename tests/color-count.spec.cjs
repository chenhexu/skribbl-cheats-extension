const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
async function process(page,count){await page.getByLabel('Color count',{exact:true}).fill(String(count));await page.getByRole('button',{name:'Process image',exact:true}).click();await expect(page.getByRole('button',{name:'Download plan JSON',exact:true})).toBeEnabled({timeout:90000});await page.getByRole('tab',{name:'Simplified colors',exact:true}).click();return page.evaluate(()=>{const c=document.querySelector('#studio').shadowRoot.querySelector('canvas'),data=c.getContext('2d').getImageData(0,0,800,600).data,colors=new Set();let chromatic=0;for(let i=0;i<data.length;i+=4){const rgb=[...data.slice(i,i+3)];colors.add(rgb.join(','));if(Math.max(...rgb)-Math.min(...rgb)>20)chromatic++;}return {colors:[...colors],chromatic,png:c.toDataURL(),plan:studio.getPlan()};});}

test('three mapped colors stay colored at Color count 3 instead of collapsing into grays',async({page},info)=>{
  await page.goto('/');await page.getByLabel('Upload image',{exact:true}).setInputFiles('tests/fixtures/color-count.svg');await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();await page.getByLabel('Merge similar colors',{exact:true}).fill('14');await page.locator('[name=budget]').fill('300');
  const high=await process(page,24);await fs.writeFile(info.outputPath('24-simplified.png'),Buffer.from(high.png.split(',')[1],'base64'));
  const low=await process(page,3);await fs.writeFile(info.outputPath('3-simplified.png'),Buffer.from(low.png.split(',')[1],'base64'));
  await fs.writeFile(info.outputPath('color-count.json'),JSON.stringify({high:{colors:high.colors,chromatic:high.chromatic},low:{colors:low.colors,chromatic:low.chromatic}},null,2));
  expect(high.colors).toHaveLength(3);expect(high.chromatic).toBeGreaterThan(1000);expect(low.colors).toEqual(high.colors);expect(low.png).toBe(high.png);
  await expect(page.locator('.stats')).toContainText('Color target 3 · 3 simplified colors');expect(low.plan.sourceColors).toBe(3);expect(low.plan.strokes.some(stroke=>stroke.stage==='fill'&&stroke.colorId===23)).toBe(true);
  await page.locator('#studio').screenshot({path:info.outputPath('3-color-panel.png')});
  await page.getByRole('tab',{name:'Final drawing',exact:true}).click();expect(await page.locator('canvas').evaluate(canvas=>[...canvas.getContext('2d').getImageData(350,250,1,1).data])).toEqual([204,119,77,255]);
  await page.evaluate(async()=>{const host=document.createElement('div');host.id='color-count-compact';host.style.width='320px';document.body.append(host);window.colorCountPanel=SAGDrawerStudio.mount(host,{compact:true});await colorCountPanel.loadSession(studio.getSession());});
  const panel=page.locator('#color-count-compact');await panel.getByRole('button',{name:'Process image',exact:true}).click();await expect(panel.getByRole('button',{name:'Download plan JSON',exact:true})).toBeEnabled({timeout:90000});
  expect(await page.evaluate(()=>colorCountPanel.getPlan().strokes)).toEqual(low.plan.strokes);
});
