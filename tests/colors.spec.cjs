const {test,expect}=require('@playwright/test');
const {PALETTE}=require('../drawing-engine');

test('24 colors process and round-trip between expanded and compact viewers',async({page},info)=>{
  const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">${PALETTE.slice(0,24).map((c,i)=>`<rect x="${16+i%6*128}" y="${12+Math.floor(i/6)*144}" width="128" height="144" fill="${c}"/>`).join('')}</svg>`);
  await page.goto('/');await page.getByLabel('Upload image',{exact:true}).setInputFiles({name:'24-colors.svg',mimeType:'image/svg+xml',buffer:svg});
  await expect(page.getByRole('button',{name:'Process image',exact:true})).toBeEnabled();await expect(page.getByLabel('Color count',{exact:true})).toHaveAttribute('max','24');
  await page.getByLabel('Color count',{exact:true}).fill('24');await page.getByLabel('Merge similar colors',{exact:true}).fill('0');
  await expect(page.getByLabel('Auto settings',{exact:true})).not.toBeChecked();await page.getByRole('button',{name:'Process image',exact:true}).click();await expect(page.getByRole('button',{name:'Download plan JSON',exact:true})).toBeEnabled({timeout:90000});
  const drawing=await page.evaluate(()=>studio.getPlan());expect(drawing.settings.colors).toBe(24);expect(drawing.sourceColors).toBe(24);
  await page.locator('#studio').screenshot({path:info.outputPath('24-colors.png')});
  await page.evaluate(async()=>{const host=document.createElement('div');host.id='compact-colors';host.style.width='320px';document.body.append(host);window.compactColors=SAGDrawerStudio.mount(host,{compact:true});await compactColors.loadSession(studio.getSession());});
  const compact=page.locator('#compact-colors');await expect(compact.getByLabel('Color count',{exact:true})).toHaveAttribute('max','24');await expect(compact.getByLabel('Color count',{exact:true})).toHaveValue('24');
  expect(await page.evaluate(()=>compactColors.getSession().settings)).toEqual(drawing.settings);
});
