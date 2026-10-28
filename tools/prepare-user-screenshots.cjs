// Crop the user's original captures without changing their text, UI or artwork.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'..');
const captures=[
  {source:'exemple_screenshot_new5.png',folder:'screenshots',output:'01-swordfish-1280x800.png',crop:{left:548,top:40,width:1744,height:1090},width:1280,height:800},
  {source:'exemple_screenshot_new.png',folder:'screenshots',output:'02-cola-1280x800.png',crop:{left:0,top:0,width:1696,height:1060},width:1280,height:800},
  {source:'exemple_screenshot_new3.png',folder:'screenshots',output:'03-main-subject-640x400.png',crop:{left:0,top:25,width:480,height:300},width:640,height:400},
  {source:'exemple_screenshot_new4.png',folder:'screenshots',output:'04-truck-drawing-640x400.png',crop:{left:0,top:25,width:472,height:295},width:640,height:400},
  {source:'exemple_screenshot_new7.png',folder:'screenshots',output:'05-related-words-640x400.png',crop:{left:5,top:12,width:496,height:310},width:640,height:400},
  {source:'exemple_screenshot_new1.png',folder:'screenshot-alternates',output:'gladiator-1280x800.png',crop:{left:530,top:0,width:1744,height:1090},width:1280,height:800},
  {source:'exemple_screenshot_new2.png',folder:'screenshot-alternates',output:'yo-yo-1280x800.png',crop:{left:542,top:0,width:1744,height:1090},width:1280,height:800},
  {source:'exemple_screenshot_new6.png',folder:'screenshot-alternates',output:'hint-filtering-1280x800.png',crop:{left:0,top:60,width:1664,height:1040},width:1280,height:800},
];
(async()=>{
  const references=path.join(root,'store/references');await fs.mkdir(references,{recursive:true});
  const records=[];
  for(const capture of captures){
    const reference=path.join(references,capture.source);
    // Keep byte-for-byte originals in the kit. Rebuilding also works without
    // the user's loose files at the repository root.
    try{await fs.access(reference);}catch{await fs.copyFile(path.join(root,capture.source),reference);}
    const source=await fs.readFile(reference),meta=await sharp(source).metadata();
    const {crop,width,height}=capture;
    if(crop.width*height!==crop.height*width)throw Error('Crop would stretch the capture: '+capture.source);
    const destination=path.join(root,'store',capture.folder,capture.output);await fs.mkdir(path.dirname(destination),{recursive:true});
    await sharp(source).extract(crop).resize(width,height,{kernel:'lanczos3'}).toColourspace('srgb').removeAlpha().png().toFile(destination);
    const result=await sharp(destination).metadata();
    if(result.width!==width||result.height!==height||result.channels!==3)throw Error('Invalid screenshot output: '+destination);
    records.push({...capture,sourceWidth:meta.width,sourceHeight:meta.height,sourceSHA256:crypto.createHash('sha256').update(source).digest('hex')});
    console.log(path.relative(root,destination)+' ('+width+' x '+height+', RGB PNG)');
  }
  await fs.writeFile(path.join(root,'store/screenshot-crops.json'),JSON.stringify(records,null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
