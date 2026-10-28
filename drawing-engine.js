/* Shared, deterministic Colors + outlines engine. No network or game dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SAGDrawingEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const WIDTH = 800, HEIGHT = 600;
  // Current public game palette: 26 colors. Legacy modes retain their own mapping.
  const PALETTE = ['#ffffff','#000000','#c1c1c1','#505050','#ef130b','#740b07','#ff7100','#c23800','#ffe400','#e8a200','#00cc00','#004619','#00ff91','#00785d','#00b2ff','#00569e','#231fd3','#0e0865','#a300ba','#550069','#df69a7','#873554','#ffac8e','#cc774d','#a0522d','#63300d'];
  const rgb = hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
  function lab(r,g,b) {
    const linear = v => { v/=255; return v<=.04045?v/12.92:((v+.055)/1.055)**2.4; };
    [r,g,b]=[r,g,b].map(linear);
    const f = v => v>.008856?Math.cbrt(v):7.787*v+16/116;
    const x=f((.4124564*r+.3575761*g+.1804375*b)/.95047), y=f(.2126729*r+.7151522*g+.072175*b), z=f((.0193339*r+.119192*g+.9503041*b)/1.08883);
    return [116*y-16,500*(x-y),200*(y-z)];
  }
  const paletteLab = PALETTE.map(c => lab(...rgb(c)));
  const dist2 = (a,b) => a.reduce((s,v,i)=>s+(v-b[i])**2,0);
  const paletteDistances=paletteLab.map(a=>paletteLab.map(b=>dist2(a,b)));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const abort = signal => { if (signal?.aborted) throw new DOMException('Processing stopped','AbortError'); };
  async function checkpoint(signal) { abort(signal); await new Promise(r=>setTimeout(r,0)); abort(signal); }
  function settings(input={}) {
    const number=(key,def,min,max)=>clamp(Number.isFinite(+input[key])?+input[key]:def,min,max);
    return { detector:input.detector==='ai'?'ai':'browser', colors:Math.round(number('colors',6,2,24)), merge:number('merge',14,0,40),
      detail:number('detail',55,10,100), budget:number('budget',60,10,300), bgThreshold:number('bgThreshold',0,0,120),amplify:number('amplify',0,0,100),
      tolerance:number('tolerance',1.5,.25,4), closeGaps:number('closeGaps',4,0,8), fillMode:input.fillMode==='strokes'?'strokes':'bucket',
      treatment:input.treatment==='light-lines'?'light-lines':'regions',
      focus:['subject','subject-background'].includes(input.focus)?input.focus:'none',speed:input.speed==='fast'?'fast':'balanced',
      eventMs:number('eventMs',8,1,100), skipWhite:input.skipWhite!==false };
  }
  function prepareImage(image,crop=null,{smoothing=true}={}) {
    const sw=image.naturalWidth||image.width, sh=image.naturalHeight||image.height;
    if (!sw||!sh) throw new Error('Image has no dimensions');
    const c=crop||{x:0,y:0,w:sw,h:sh};
    const x=clamp(c.x,0,sw-1), y=clamp(c.y,0,sh-1), w=clamp(c.w,1,sw-x), h=clamp(c.h,1,sh-y);
    const canvas=document.createElement('canvas'); canvas.width=WIDTH; canvas.height=HEIGHT;
    const ctx=canvas.getContext('2d',{willReadFrequently:true}), scale=Math.min(WIDTH/w,HEIGHT/h);
    ctx.imageSmoothingEnabled=smoothing;
    ctx.drawImage(image,x,y,w,h,(WIDTH-w*scale)/2,(HEIGHT-h*scale)/2,w*scale,h*scale);
    return canvas;
  }
  // Local, connected color groups for correcting a foreground mask. This does
  // not claim to recognize objects. Keep full-resolution labels so thin parts,
  // transparent holes and disconnected areas remain individually selectable.
  async function segmentParts(input,{similarity=18}={},context={}) {
    const {width:w,height:h,data}=input,signal=context.signal,start=Date.now();
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>WIDTH*HEIGHT||data.length!==w*h*4)throw new Error('Invalid parts image');
    const limit=clamp(Number.isFinite(+similarity)?+similarity:18,4,40)**2,n=w*h,colors=new Float32Array(n*3),labels=new Int32Array(n).fill(-1),pixels=new Int32Array(n),regions=[],memo=new Map();
    abort(signal);
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const i=y*w+x,j=i*4;if(data[j+3]<128)continue;
        // Average only close shades. A thin dark line against light pixels is
        // preserved rather than blurred into the background.
        let r=0,g=0,b=0,count=0;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
          const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const k=(ny*w+nx)*4;
          if(data[k+3]<128||Math.max(Math.abs(data[k]-data[j]),Math.abs(data[k+1]-data[j+1]),Math.abs(data[k+2]-data[j+2]))>24)continue;
          r+=data[k];g+=data[k+1];b+=data[k+2];count++;
        }
        r=Math.round(r/count);g=Math.round(g/count);b=Math.round(b/count);const key=r*65536+g*256+b;
        let color=memo.get(key);if(!color){color=lab(r,g,b);if(memo.size>=16384)memo.clear();memo.set(key,color);}colors.set(color,i*3);
      }
      if(y%24===0)await checkpoint(signal);
    }
    let used=0;
    for(let seed=0;seed<n;seed++){
      if(seed%8192===0)await checkpoint(signal);
      if(data[seed*4+3]<128||labels[seed]>=0)continue;
      const id=regions.length,offset=used,seedL=colors[seed*3],seedA=colors[seed*3+1],seedB=colors[seed*3+2];
      let head=used,tail=used+1;pixels[used]=seed;labels[seed]=id;
      while(head<tail){
        const i=pixels[head++],x=i%w,y=(i/w)|0;
        for(const q of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1]){
          if(q<0||labels[q]>=0||data[q*4+3]<128)continue;
          // Compare with the region's fixed seed, not a drifting running color;
          // otherwise a smooth gradient can walk into the whole background.
          const l=colors[q*3]-seedL,a=colors[q*3+1]-seedA,b=colors[q*3+2]-seedB;
          if(l*l+a*a+b*b<=limit){labels[q]=id;pixels[tail++]=q;}
        }
        if(head%8192===0)await checkpoint(signal);
      }
      used=tail;regions.push({offset,area:tail-offset});
    }
    return {width:w,height:h,labels,pixels,regions,processingMs:Date.now()-start};
  }
  const luminance=(r,g,b)=>.2126*r+.7152*g+.0722*b;
  // A dominant dark field with sparse bright ink needs centerlines, rather
  // than black edges on both sides of every white/antialiased color region.
  async function lightLineProfile(input,signal) {
    const {data,width:w,height:h}=input,step=Math.max(1,Math.floor(Math.sqrt(w*h/40000))),bins=new Map();let samples=0;
    for(let y=0;y<h;y+=step){for(let x=((y/step)|0)%step;x<w;x+=step){const i=(y*w+x)*4;if(data[i+3]<128)continue;
      const key=((data[i]>>4)<<8)|((data[i+1]>>4)<<4)|(data[i+2]>>4);let bin=bins.get(key);
      if(!bin){bin={count:0,sum:[0,0,0]};bins.set(key,bin);}bin.count++;samples++;for(let c=0;c<3;c++)bin.sum[c]+=data[i+c];
    }if(y%(step*50)===0)await checkpoint(signal);}
    if(!samples)return {eligible:false,background:[0,0,0],backgroundL:0,peak:255};
    const ranked=[...bins.values()].sort((a,b)=>b.count-a.count),dominant=ranked[0],base=dominant.sum.map(v=>v/dominant.count),baseLab=lab(...base);
    let field=0,ink=0;const bg=[0,0,0],bright=[];
    for(const bin of ranked){const color=bin.sum.map(v=>v/bin.count),l=luminance(...color);
      if(dist2(lab(...color),baseLab)<18**2){field+=bin.count;for(let c=0;c<3;c++)bg[c]+=bin.sum[c];}
      if(l>luminance(...base)+50&&l>140){ink+=bin.count;bright.push({l,count:bin.count});}
    }
    const background=field?bg.map(v=>v/field):base,backgroundL=luminance(...background);
    bright.sort((a,b)=>a.l-b.l);let accumulated=0,peak=255;
    for(const b of bright){accumulated+=b.count;if(accumulated>=ink*.8){peak=b.l;break;}}
    const threshold=backgroundL+Math.max(30,(peak-backgroundL)*.65),radius=Math.max(2,Math.round(Math.min(w,h)*.01));let foreground=0,interior=0;
    const brightAt=(x,y)=>{if(x<0||x>=w||y<0||y>=h)return false;const i=(y*w+x)*4;return data[i+3]>=128&&luminance(data[i],data[i+1],data[i+2])>=threshold;};
    for(let y=0;y<h;y+=step){for(let x=((y/step)|0)%step;x<w;x+=step)if(brightAt(x,y)){foreground++;if(brightAt(x-radius,y)&&brightAt(x+radius,y)&&brightAt(x,y-radius)&&brightAt(x,y+radius))interior++;}if(y%(step*50)===0)await checkpoint(signal);}
    return {eligible:backgroundL<145&&field/samples>.58&&ink/samples>.003&&ink/samples<.3&&foreground>0&&interior/foreground<.45,
      background,backgroundL,peak,fieldFraction:field/samples,inkFraction:ink/samples};
  }
  // Image-dependent starting settings, shared by both viewers. This is a local
  // heuristic, not a model call or a search over expensive processing plans.
  async function suggestSettings(input,preferences={},context={}) {
    const {width:w,height:h,data}=input,signal=context.signal;
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>WIDTH*HEIGHT||data.length!==w*h*4)throw new Error('Invalid analysis image');
    abort(signal);
    const step=Math.max(1,Math.floor(Math.sqrt(w*h/40000))),bins=new Map(),coherentBins=new Map();
    let samples=0,sites=0,flat=0,texture=0,pairs=0,white=0,dark=0,neutral=0,thinInk=0;
    const inkRadius=Math.max(2,Math.round(Math.min(w,h)*.006));
    for(let y=0;y<h;y+=step) {
      // Vary the sampling offset so off-grid thin lines are represented too.
      for(let x=((y/step)|0)%step;x<w;x+=step) {
        sites++;const i=(y*w+x)*4;if(data[i+3]<128)continue;
        const r=data[i],g=data[i+1],b=data[i+2],key=((r>>4)<<8)|((g>>4)<<4)|(b>>4);
        bins.set(key,(bins.get(key)||0)+1);samples++;
        if(Math.min(r,g,b)>=235)white++;
        const maximum=Math.max(r,g,b);
        if(maximum<=85){
          dark++;
          for(const [nx,ny]of [[x-inkRadius,y],[x+inkRadius,y],[x,y-inkRadius],[x,y+inkRadius]]){
            if(nx<0||nx>=w||ny<0||ny>=h)continue;const j=(ny*w+nx)*4;
            if(data[j+3]>=128&&Math.max(data[j],data[j+1],data[j+2])>Math.max(100,maximum+35)){thinInk++;break;}
          }
        }
        if(Math.max(r,g,b)-Math.min(r,g,b)<=18)neutral++;
        let neighbours=0,coherentNeighbours=0;
        for(const [nx,ny]of [[x+step,y],[x,y+step]]) {
          if(nx>=w||ny>=h)continue;const j=(ny*w+nx)*4;if(data[j+3]<128)continue;
          const difference=Math.max(Math.abs(r-data[j]),Math.abs(g-data[j+1]),Math.abs(b-data[j+2]));
          neighbours++;if(difference<=24)coherentNeighbours++;
          pairs++;if(difference<=12)flat++;else if(difference<90)texture++;
        }
        if(neighbours && coherentNeighbours===neighbours)coherentBins.set(key,(coherentBins.get(key)||0)+1);
      }
      if(y%(step*50)===0)await checkpoint(signal);
    }
    const ratio=n=>samples?n/samples:0,flatness=pairs?flat/pairs:1,textured=pairs?texture/pairs:0;
    const groups=[];
    for(const [key,count]of [...bins].sort((a,b)=>b[1]-a[1]||a[0]-b[0])) {
      if(count<Math.max(2,samples*.0005))continue;
      const color=lab(((key>>8)&15)*16+8,((key>>4)&15)*16+8,(key&15)*16+8);
      let nearest=null,distance=Infinity;
      for(const group of groups){const d=dist2(color,group.color);if(d<distance){distance=d;nearest=group;}}
      if(distance<14**2||groups.length>=32)nearest.count+=count;
      else groups.push({color,count});
    }
    const shades=groups.filter(g=>g.count>=Math.max(2,samples*.005)).length;
    // Count useful game colors supported by sizeable, locally smooth regions.
    // Raw RGB variety alone would mistake photographic noise for extra colors.
    const coverage=new Float64Array(PALETTE.length),coherentCoverage=new Float64Array(PALETTE.length);
    for(const [key,count]of bins){
      const color=lab(((key>>8)&15)*16+8,((key>>4)&15)*16+8,(key&15)*16+8);
      const id=paletteColor(color,0);coverage[id]+=count;coherentCoverage[id]+=coherentBins.get(key)||0;
    }
    const largeColors=[],hues=new Set();let chromaticColors=0;
    coverage.forEach((count,id)=>{
      if(count<Math.max(2,samples*.01)||coherentCoverage[id]<Math.max(2,samples*.006))return;
      largeColors.push(id);
      const color=paletteLab[id];
      if(Math.hypot(color[1],color[2])>=18){chromaticColors++;hues.add(Math.floor((Math.atan2(color[2],color[1])+Math.PI)/(Math.PI/4))%8);}
    });
    const lightLines=await lightLineProfile(input,signal);
    let kind,colors,merge,closeGaps,reason;
    if(!samples||ratio(white)>.9995){kind='blank';colors=2;merge=18;closeGaps=0;reason='Mostly empty or white; keep the plan simple.';}
    else if(lightLines.eligible){kind='blueprint';colors=2;merge=30;closeGaps=1;reason='Light-on-dark line drawing; paint the background once, trace bright ink in white, and suppress the faint grid. No added black borders.';}
    else if(ratio(neutral)>.92&&((ratio(white)>.6&&ratio(white+dark)>.88)||(samples/sites<.35&&ratio(dark)>.9))){kind='line-art';colors=2;merge=22;closeGaps=2;reason='Mostly monochrome line art; use two colors.';}
    else if(flatness>=.8&&textured<.16){kind='flat-artwork';colors=clamp(shades,2,10);merge=12;closeGaps=3;reason='Flat artwork; retain distinct colors and clean boundaries.';}
    else if(flatness<.62||textured>.24){kind='photograph';colors=6;merge=24;closeGaps=3;reason='Textured image; merge shades to reduce fill complexity.';}
    else{kind='illustration';colors=clamp(shades,3,7);merge=18;closeGaps=3;reason='Mixed detail; balance color coverage and region complexity.';}
    const colorfulArtwork=['flat-artwork','illustration'].includes(kind)&&flatness>=.7&&textured<.22&&chromaticColors>=5&&hues.size>=4;
    if(colorfulArtwork){colors=clamp(Math.max(colors,shades,largeColors.length+2),8,24);merge=Math.min(merge,10);reason+=' Large distinct color regions: keep more colors and merge fewer shades.';}
    // K-means may spend two centers on a large shaded area and absorb a small
    // white highlight/hole. Leave headroom for that high-contrast accent.
    const whiteAccent=(kind==='flat-artwork'||kind==='illustration')&&ratio(white)>.002&&ratio(white)<.2;
    const preciseLines=['line-art','flat-artwork','illustration'].includes(kind)&&flatness>=.72&&textured<=.18&&thinInk>=Math.max(6,samples*.001)&&thinInk/Math.max(1,dark)>=.22;
    if(preciseLines)reason+=' Fine linework detected. Outline detail stays at your chosen value.';
    const budget=settings(preferences).budget;
    if(budget<40){colors=Math.min(colors,colorfulArtwork?Math.min(largeColors.length+(budget<20?0:1),budget<20?10:16):budget<20?4:5);merge=Math.min(32,merge+4);reason+=' Short drawing target: fewer colors and stronger shade merging.';}
    if(whiteAccent)colors=Math.min(colorfulArtwork?24:10,colors+1);
    // Outline detail belongs to the user, like detector and drawing target.
    // Omitting it also preserves a slider changed during asynchronous analysis.
    return {version:1,kind,reason,settings:{colors,merge,closeGaps,bgThreshold:0,fillMode:'bucket',treatment:kind==='blueprint'?'light-lines':'regions'},
      features:{shades,flatness:+flatness.toFixed(3),texture:+textured.toFixed(3),samples,preciseLines,thinInkFraction:+(thinInk/Math.max(1,dark)).toFixed(3),colorfulArtwork,largeColors:largeColors.length,chromaticColors}};
  }
  async function limitPalette(bins,mapping,limit,signal) {
    const groups=new Map();let total=0;
    for(const bin of bins){const id=mapping.get(bin.key),group=groups.get(id)||{id,count:0,chroma:0};group.count+=bin.count;group.chroma+=Math.hypot(bin.lab[1],bin.lab[2])*bin.count;groups.set(id,group);total+=bin.count;}
    const remaining=[...groups.keys()].sort((a,b)=>a-b);
    if(remaining.length<=limit)return;
    const colored=new Set();
    for(const group of groups.values()){
      const chroma=group.chroma/group.count;
      // Sublinear area weighting retains smaller recognizable hues instead of
      // spending every low-count slot on large gray background/shadow bands.
      group.weight=group.count**.7*(1+Math.min(2,chroma/40));
      if(group.count>=Math.max(16,total*.005)&&chroma>=18&&Math.hypot(paletteLab[group.id][1],paletteLab[group.id][2])>=18)colored.add(group.id);
    }
    while(remaining.length>limit){
      const coloredLeft=remaining.filter(id=>colored.has(id)).length;let remove=-1,best=Infinity;
      for(const candidate of remaining){
        if(coloredLeft===1&&colored.has(candidate))continue;
        let error=0;
        for(const group of groups.values()){let distance=Infinity;for(const id of remaining)if(id!==candidate)distance=Math.min(distance,paletteDistances[group.id][id]);error+=group.weight*distance;}
        if(error<best){best=error;remove=candidate;}
      }
      remaining.splice(remaining.indexOf(remove),1);await checkpoint(signal);
    }
    const replacement=new Map();
    for(const id of groups.keys()){let best=id,distance=Infinity;for(const candidate of remaining){const d=paletteDistances[id][candidate];if(d<distance){distance=d;best=candidate;}}replacement.set(id,best);}
    for(const [key,id]of mapping)mapping.set(key,replacement.get(id));
  }
  function amplifyLab(color,amount){
    if(!amount)return color;
    const strength=amount/100,l=color[0],shadow=1-l/100,gain=1+strength*.8*shadow;
    // Lift shadows gently, rather than stretching the moon/highlights or
    // assigning a blue tint to a source that contains no color.
    return [l+strength*6*shadow*shadow*Math.min(1,l/8),color[1]*gain,color[2]*gain];
  }
  function paletteColor(color,amount,allowWhite=true){
    const strength=amount/100,chroma=Math.hypot(color[1],color[2]);let id=allowWhite?0:1,best=Infinity;
    paletteLab.forEach((p,k)=>{
      if(!allowWhite&&k===0)return;
      const targetChroma=Math.hypot(p[1],p[2]);
      if(amount&&chroma<8&&targetChroma>=8)return;
      let score=dist2(p,color);
      if(amount){score+=5*strength*(p[0]-color[0])**2;if(chroma>12&&color[0]>=12&&targetChroma<chroma*.4)score+=strength*(chroma+20)**2;}
      if(score<best){best=score;id=k;}
    });
    return id;
  }
  async function quantize(data,w,h,opts,signal) {
    const histogram=new Map(), keys=new Int32Array(w*h); keys.fill(-1);
    const visible=new Uint8Array(w*h);
    // Smooth texture without modifying the source used for outlines. Alpha is never stretched.
    for(let y=0;y<h;y++) {
      for(let x=0;x<w;x++) {
        const i=y*w+x,j=i*4;
        if(data[j+3]<128) continue;
        const white=(255-data[j])**2+(255-data[j+1])**2+(255-data[j+2])**2;
        if(opts.bgThreshold>0 && white<opts.bgThreshold**2*3) continue;
        visible[i]=1;
        let r=0,g=0,b=0,n=0;
        for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
          const nx=x+dx,ny=y+dy;
          if(nx<0||ny<0||nx>=w||ny>=h) continue;
          const q=(ny*w+nx)*4;
          if(data[q+3]<128) continue;
          // Do not blur across a strong color boundary.
          if(Math.abs(data[q]-data[j])+Math.abs(data[q+1]-data[j+1])+Math.abs(data[q+2]-data[j+2])>100) continue;
          r+=data[q];g+=data[q+1];b+=data[q+2];n++;
        }
        const rr=Math.round(r/n),gg=Math.round(g/n),bb=Math.round(b/n),key=((rr>>3)<<10)|((gg>>3)<<5)|(bb>>3);
        keys[i]=key;
        const entry=histogram.get(key);
        if(entry) entry.count++;
        else histogram.set(key,{key,count:1,lab:amplifyLab(lab(rr,gg,bb),opts.amplify)});
      }
      if(y%40===0) await checkpoint(signal);
    }
    const bins=[...histogram.values()].sort((a,b)=>b.count-a.count||a.key-b.key);
    if(!bins.length) return {labels:new Int16Array(w*h).fill(-1),visible,colors:[]};
    let centers=[bins[0].lab.slice()];
    // Analyze a stable, detailed candidate set first. Applying the user's limit
    // to source clusters spent slots on shades which later mapped to the same
    // gray and could absorb the only colored region into a neutral average.
    while(centers.length<PALETTE.length && centers.length<bins.length) {
      let best=null,score=-1;
      for(const bin of bins) {
        const d=Math.min(...centers.map(c=>dist2(c,bin.lab))),s=d*Math.sqrt(bin.count);
        if(s>score){score=s;best=bin;}
      }
      if(score<1e-6) break;
      centers.push(best.lab.slice());
      if(centers.length%4===0)await checkpoint(signal);
    }
    for(let iteration=0;iteration<7;iteration++) {
      const sums=centers.map(()=>[0,0,0,0]);
      for(const bin of bins) {
        let best=0,d=Infinity;
        centers.forEach((c,k)=>{const q=dist2(c,bin.lab);if(q<d){d=q;best=k;}});
        const sum=sums[best];sum[3]+=bin.count;bin.lab.forEach((v,k)=>sum[k]+=v*bin.count);
      }
      centers=centers.map((c,i)=>sums[i][3]?sums[i].slice(0,3).map(v=>v/sums[i][3]):c);
      await checkpoint(signal);
    }
    // Merge representative shades before selecting actual game colors.
    const merged=[];
    for(const c of centers) if(!merged.some(m=>dist2(m,c)<=opts.merge**2)) merged.push(c);
    const mapping=new Map();
    for(const bin of bins) {
      let nearest=merged[0],best=Infinity;
      for(const c of merged){const d=dist2(c,bin.lab);if(d<best){best=d;nearest=c;}}
      mapping.set(bin.key,paletteColor(nearest,opts.amplify));
    }
    await limitPalette(bins,mapping,opts.colors,signal);
    const labels=new Int16Array(w*h); labels.fill(-1);
    for(let i=0;i<labels.length;i++) if(visible[i]) labels[i]=mapping.get(keys[i]);
    return {labels,visible,colors:[...new Set(mapping.values())]};
  }
  async function detectEdges(data,w,h,labels,visible,opts,signal) {
    const channels=[new Float32Array(w*h),new Float32Array(w*h),new Float32Array(w*h)];
    // RGB gradients retain chromatic boundaries with similar luminance.
    for(let y=0;y<h;y++) {
      for(let x=0;x<w;x++) {
        const i=y*w+x;
        for(let c=0;c<3;c++) {
          let sum=0,weight=0;
          for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
            const nx=clamp(x+dx,0,w-1),ny=clamp(y+dy,0,h-1),q=ny*w+nx,k=(dx===0?2:1)*(dy===0?2:1);
            sum+=(visible[q]?data[q*4+c]:255)*k;weight+=k;
          }
          channels[c][i]=sum/weight;
        }
      }
      if(y%40===0) await checkpoint(signal);
    }
    const mag=new Float32Array(w*h),direction=new Float32Array(w*h);
    const sx=[-1,0,1,-2,0,2,-1,0,1],sy=[-1,-2,-1,0,0,0,1,2,1];
    for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++) {
      const i=y*w+x;if(!visible[i])continue;
      let strongest=0,gxBest=0,gyBest=0;
      for(const ch of channels) {
        let gx=0,gy=0,k=0;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++,k++){const v=ch[(y+dy)*w+x+dx];gx+=v*sx[k];gy+=v*sy[k];}
        const m=Math.hypot(gx,gy)/4;
        if(m>strongest){strongest=m;gxBest=gx;gyBest=gy;}
      }
      mag[i]=strongest;direction[i]=(Math.atan2(gyBest,gxBest)*180/Math.PI+180)%180;
    }
    const high=120-opts.detail,low=high*.45,mask=new Uint8Array(w*h),queue=[];
    // A low-poly mountain and its sky can both map to the same game gray.
    // Retain a sharp, perceptually distinct boundary in the source even when
    // neither side creates a palette-label boundary. Two flat samples on each
    // side reject gradual shading and most texture; do not promote every weak
    // gradient merely because the simplified labels collide.
    const sourceLabs=new Map(),sourceLab=i=>{const j=i*4,key=data[j]*65536+data[j+1]*256+data[j+2];let value=sourceLabs.get(key);if(!value){value=lab(data[j],data[j+1],data[j+2]);if(sourceLabs.size>=4096)sourceLabs.clear();sourceLabs.set(key,value);}return value;};
    function flatSourceBoundary(x,y,dx,dy,m){
      if(m<6||x-5*Math.abs(dx)<0||x+5*Math.abs(dx)>=w||y-5*Math.abs(dy)<0||y+5*Math.abs(dy)>=h)return false;
      const a=(y-3*dy)*w+x-3*dx,b=(y+3*dy)*w+x+3*dx,aa=(y-5*dy)*w+x-5*dx,bb=(y+5*dy)*w+x+5*dx;
      if(!visible[a]||!visible[b]||!visible[aa]||!visible[bb])return false;
      let contrast=0;
      for(let c=0;c<3;c++){if(Math.abs(data[a*4+c]-data[aa*4+c])>8||Math.abs(data[b*4+c]-data[bb*4+c])>8)return false;contrast=Math.max(contrast,Math.abs(data[a*4+c]-data[b*4+c]));}
      return contrast>=18&&m>=contrast*.3&&dist2(sourceLab(a),sourceLab(b))>=Math.max(7,20-opts.detail*.13)**2;
    }
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++) {
      const i=y*w+x,m=mag[i],a=direction[i];
      const [dx,dy]=a<22.5||a>=157.5?[1,0]:a<67.5?[1,1]:a<112.5?[0,1]:[1,-1],u=i-dy*w-dx,v=i+dy*w+dx;
      if(m<6||m<mag[u]||m<mag[v])continue;
      const sourceBoundary=m<high&&flatSourceBoundary(x,y,dx,dy,m);
      if(m<low&&!sourceBoundary)continue;
      // Strong source gradients survive; simplified region boundaries can promote weak chromatic edges.
      const boundary=labels[i]>=0&&[i-1,i+1,i-w,i+w].some(q=>labels[q]>=0&&labels[q]!==labels[i]);
      mask[i]=m>=high||sourceBoundary||(boundary&&m>=high*.7)?2:1;
      if(mask[i]===2)queue.push(i);
    }
    for(let head=0;head<queue.length;head++) {
      const i=queue[head],x=i%w,y=(i/w)|0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
        if(x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;
        const q=i+dy*w+dx;if(mask[q]===1){mask[q]=2;queue.push(q);}
      }
      if(head%20000===0)await checkpoint(signal);
    }
    return Uint8Array.from(mask,v=>v===2?1:0);
  }
  async function thin(mask,w,h,signal) {
    const out=Uint8Array.from(mask,v=>v?1:0);
    let changed=true;
    while(changed) {
      changed=false;
      for(let phase=0;phase<2;phase++) {
        const remove=[];
        for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++) {
          const i=y*w+x;if(!out[i])continue;
          const p=[out[i-w],out[i-w+1],out[i+1],out[i+w+1],out[i+w],out[i+w-1],out[i-1],out[i-w-1]];
          // Guo–Hall connectivity tests retain diagonal strokes. The previous
          // thinning could peel a two-pixel diagonal all the way down to a dot.
          let connections=0,pairsA=0,pairsB=0;
          for(let k=0;k<8;k+=2){connections+=!p[k]&&(p[(k+1)%8]||p[(k+2)%8])?1:0;pairsA+=p[(k+7)%8]||p[k];pairsB+=p[k]||p[k+1];}
          const neighbors=Math.min(pairsA,pairsB),blocked=phase===0?(p[4]||p[5]||!p[7])&&p[6]:(p[0]||p[1]||!p[3])&&p[2];
          if(connections===1&&neighbors>=2&&neighbors<=3&&!blocked)remove.push(i);
        }
        if(remove.length){changed=true;for(const i of remove)out[i]=0;}
        await checkpoint(signal);
      }
    }
    return out;
  }
  function neighbors(mask,i,w,h) {
    const result=[],x=i%w,y=(i/w)|0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
      if((!dx&&!dy)||x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;
      const q=i+dy*w+dx;if(!mask[q])continue;
      // Avoid diagonal triangles when an orthogonal connection exists.
      if(dx&&dy&&(mask[i+dx]||mask[i+dy*w]))continue;
      result.push(q);
    }
    return result;
  }
  async function trace(mask,w,h,signal) {
    const visited=new Uint8Array(w*h),paths=[];
    const bit=(a,b)=>{const dx=b%w-a%w,dy=((b/w)|0)-((a/w)|0);return 1<<([[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]].findIndex(d=>d[0]===dx&&d[1]===dy));};
    function walk(start,next) {
      const path=[start];let a=start,b=next;
      while(true) {
        visited[a]|=bit(a,b);visited[b]|=bit(b,a);path.push(b);
        const near=neighbors(mask,b,w,h);
        if(b===start||near.length!==2)break;
        const c=near.find(q=>q!==a);if(visited[b]&bit(b,c))break;
        a=b;b=c;
      }
      paths.push(path.map(i=>({x:i%w,y:(i/w)|0})));
    }
    for(let pass=0;pass<2;pass++)for(let i=0;i<mask.length;i++) {
      if(!mask[i])continue;
      const near=neighbors(mask,i,w,h);
      if(pass===0&&near.length===2)continue;
      for(const q of near)if(!(visited[i]&bit(i,q)))walk(i,q);
      if(i%8192===0)await checkpoint(signal);
    }
    return paths;
  }
  function segmentDistance(p,a,b) {
    const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
    return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
  }
  function simplify(points,tolerance) {
    if(points.length<=2)return points.slice();
    const keep=new Set([0,points.length-1]),stack=[[0,points.length-1]];
    while(stack.length){const [a,b]=stack.pop();let best=tolerance,k=-1;for(let i=a+1;i<b;i++){const d=segmentDistance(points[i],points[a],points[b]);if(d>best){best=d;k=i;}}if(k>=0){keep.add(k);stack.push([a,k],[k,b]);}}
    return [...keep].sort((a,b)=>a-b).map(i=>({...points[i],sourceIndex:i}));
  }
  function cubic(a,b,c,d,t) {const u=1-t;return {x:u**3*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t**3*d.x,y:u**3*a.y+3*u*u*t*b.y+3*u*t*t*c.y+t**3*d.y};}
  function curvePath(points,tolerance=1.5) {
    if(points.length<3)return points.slice();
    const nodes=simplify(points,tolerance*.8),out=[{x:points[0].x,y:points[0].y}];
    function sharp(i){if(i<=0||i>=nodes.length-1)return false;const a=nodes[i-1],b=nodes[i],c=nodes[i+1];return ((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y))/(Math.hypot(b.x-a.x,b.y-a.y)*Math.hypot(c.x-b.x,c.y-b.y)||1)<.65;}
    for(let k=0;k<nodes.length-1;k++) {
      const a=nodes[k],d=nodes[k+1],prev=nodes[k-1]||a,next=nodes[k+2]||d;
      const b=sharp(k)?{x:a.x+(d.x-a.x)/3,y:a.y+(d.y-a.y)/3}:{x:a.x+(d.x-prev.x)/6,y:a.y+(d.y-prev.y)/6};
      const c=sharp(k+1)?{x:d.x-(d.x-a.x)/3,y:d.y-(d.y-a.y)/3}:{x:d.x-(next.x-a.x)/6,y:d.y-(next.y-a.y)/6};
      const sampled=[];
      function flatten(t0,t1,p0,p1,depth) {
        const tm=(t0+t1)/2,pm=cubic(a,b,c,d,tm),q1=cubic(a,b,c,d,(t0+tm)/2),q3=cubic(a,b,c,d,(tm+t1)/2);
        // The game interpolates each mouse segment. Only curvature requires
        // extra moves; long straight lines do not need one event every 6px.
        if(depth<14&&Math.max(segmentDistance(pm,p0,p1),segmentDistance(q1,p0,p1),segmentDistance(q3,p0,p1))>.25){flatten(t0,tm,p0,pm,depth+1);flatten(tm,t1,pm,p1,depth+1);}else sampled.push({x:p1.x,y:p1.y});
      }
      flatten(0,1,a,d,0);
      const source=points.slice(a.sourceIndex,d.sourceIndex+1);
      const fitted=[a,...sampled];
      const safe=sampled.every((p,i)=>{const prev=i?sampled[i-1]:a;for(let k=0;k<=4;k++){const q={x:prev.x+(p.x-prev.x)*k/4,y:prev.y+(p.y-prev.y)*k/4};let min=Infinity;for(let j=1;j<source.length;j++)min=Math.min(min,segmentDistance(q,source[j-1],source[j]));if(min>tolerance)return false;}return true;})&&source.every(p=>{let min=Infinity;for(let j=1;j<fitted.length;j++)min=Math.min(min,segmentDistance(p,fitted[j-1],fitted[j]));return min<=tolerance;});
      // A rejected spline falls back to a bounded polyline, not every raster
      // pixel. Both alternatives retain sharp corners and the error bound.
      out.push(...(safe?sampled:simplify(source,tolerance*.8).slice(1).map(({x,y})=>({x,y}))));
    }
    return out;
  }
  function pathLength(points){let sum=0;for(let i=1;i<points.length;i++)sum+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);return sum;}
  // Join only nearby endpoints pointing toward one another. Parallel lines must
  // remain separate; a general morphological close would join those as well.
  async function closeGaps(mask,w,h,radius,signal) {
    const out=mask.slice(),ends=[];let closed=0;
    if(!radius)return {mask:out,closed};
    for(let i=0;i<mask.length;i++)if(mask[i]) {
      const near=neighbors(mask,i,w,h);if(near.length!==1)continue;
      let previous=i,current=near[0];
      for(let k=0;k<4;k++){const next=neighbors(mask,current,w,h).filter(q=>q!==previous);if(next.length!==1)break;previous=current;current=next[0];}
      const x=i%w,y=(i/w)|0,dx=x-current%w,dy=y-((current/w)|0),length=Math.hypot(dx,dy);
      if(length>=2)ends.push({i,x,y,dx:dx/length,dy:dy/length});
      if(i%8192===0)await checkpoint(signal);
    }
    const candidates=[];
    // Spatial buckets bound the work for busy photographs.
    const cells=new Map(),cell=radius+1,key=(x,y)=>Math.floor(x/cell)+','+Math.floor(y/cell);
    for(const a of ends){const k=key(a.x,a.y);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(a);}
    for(const a of ends)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)for(const b of cells.get(key(a.x+dx*cell,a.y+dy*cell))||[]) {
      if(b.i<=a.i)continue;const vx=b.x-a.x,vy=b.y-a.y,d=Math.hypot(vx,vy);
      if(d>radius+1||d<2)continue;
      if((a.dx*vx+a.dy*vy)/d<.85||-(b.dx*vx+b.dy*vy)/d<.85)continue;
      candidates.push({a,b,d});
    }
    const used=new Set();
    for(const {a,b,d}of candidates.sort((a,b)=>a.d-b.d)) {
      if(used.has(a.i)||used.has(b.i))continue;
      for(let n=0;n<=Math.ceil(d*2);n++){const t=n/Math.ceil(d*2);out[Math.round(a.y+(b.y-a.y)*t)*w+Math.round(a.x+(b.x-a.x)*t)]=1;}
      used.add(a.i);used.add(b.i);closed++;
    }
    return {mask:out,closed};
  }
  async function colorRegions(labels,w,h,signal) {
    const ids=new Int32Array(labels.length).fill(-1),regions=[],queue=new Int32Array(labels.length);
    for(let start=0;start<labels.length;start++) {
      if(labels[start]<0||ids[start]>=0)continue;
      const id=regions.length,colorId=labels[start],region={id,colorId,area:0,x:w,y:h,right:0,bottom:0};
      let head=0,tail=1;queue[0]=start;ids[start]=id;
      while(head<tail){const i=queue[head++],x=i%w,y=(i/w)|0;region.area++;region.x=Math.min(region.x,x);region.y=Math.min(region.y,y);region.right=Math.max(region.right,x+1);region.bottom=Math.max(region.bottom,y+1);
        for(const q of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(q>=0&&ids[q]<0&&labels[q]===colorId){ids[q]=id;queue[tail++]=q;}
        if(head%20000===0)await checkpoint(signal);
      }
      regions.push(region);if(start%4096===0)await checkpoint(signal);
    }
    return {ids,regions};
  }
  async function mergeSpeckles(labels,w,h,signal,minArea=12) {
    const {ids,regions}=await colorRegions(labels,w,h,signal);
    for(const r of regions) {
      if(r.area>=minArea)continue;
      const contacts=new Map(),pixels=[];
      for(let y=r.y;y<r.bottom;y++)for(let x=r.x;x<r.right;x++) {
        const i=y*w+x;if(ids[i]!==r.id)continue;pixels.push(i);
        for(const q of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1]) {
          if(q<0||ids[q]<0||ids[q]===r.id||regions[ids[q]].area<minArea)continue;
          const color=regions[ids[q]].colorId;contacts.set(color,(contacts.get(color)||0)+1);
        }
      }
      const candidates=[...contacts.keys()].sort((a,b)=>dist2(paletteLab[a],paletteLab[r.colorId])-dist2(paletteLab[b],paletteLab[r.colorId])||contacts.get(b)-contacts.get(a));
      if(candidates.length)for(const i of pixels)labels[i]=candidates[0];
      if(r.id%128===0)await checkpoint(signal);
    }
  }
  // Directed pixel-cell edges have the region on their right. Taking the right
  // turn first keeps diagonally touching loops and interior holes separate.
  async function regionContours(ids,regions,w,h,signal) {
    const edges=regions.map(()=>new Map()),stride=w+1;
    const add=(id,x,y,d)=>{const map=edges[id],v=y*stride+x;map.set(v,(map.get(v)||0)|(1<<d));};
    for(let y=0;y<h;y++) {
      for(let x=0;x<w;x++){const i=y*w+x,id=ids[i];if(id<0)continue;
        if(!y||ids[i-w]!==id)add(id,x,y,0);
        if(x===w-1||ids[i+1]!==id)add(id,x+1,y,1);
        if(y===h-1||ids[i+w]!==id)add(id,x+1,y+1,2);
        if(!x||ids[i-1]!==id)add(id,x,y+1,3);
      }
      if(y%40===0)await checkpoint(signal);
    }
    const delta=[1,stride,-1,-stride];
    for(const r of regions) {
      const map=edges[r.id],contours=[];
      while(map.size) {
        const start=map.keys().next().value;let v=start,d=[0,1,2,3].find(d=>map.get(v)&(1<<d));const loop=[];
        do{loop.push({x:Math.min(w-1,v%stride),y:Math.min(h-1,(v/stride)|0)});const bits=map.get(v)&~(1<<d);if(bits)map.set(v,bits);else map.delete(v);v+=delta[d];if(v===start)break;const next=map.get(v)||0;d=[(d+1)%4,d,(d+3)%4,(d+2)%4].find(n=>next&(1<<n));if(d===undefined)throw new Error('Color boundary is not closed');}while(true);
        loop.push({...loop[0]});
        // Subpixel simplification removes raster stair steps, within the 2px
        // sealing radius. Enclosure is verified after rasterizing the result.
        let points=simplify(loop,1.25).map(({x,y})=>({x,y}));
        if(points.length<4)points=simplify(loop,.5).map(({x,y})=>({x,y}));
        if(points.length>=3)contours.push(points);
      }
      r.contours=contours;if(r.id%32===0)await checkpoint(signal);
    }
  }
  function rasterContours(contours,w,h,ox=0,oy=0,brushSize=4) {
    const mask=new Uint8Array(w*h),radius=brushSize/2;
    function dot(x,y){for(let py=Math.max(0,Math.floor(y-radius));py<=Math.min(h-1,Math.ceil(y+radius));py++)for(let px=Math.max(0,Math.floor(x-radius));px<=Math.min(w-1,Math.ceil(x+radius));px++)if((px-x)**2+(py-y)**2<=radius**2)mask[py*w+px]=1;}
    for(const points of contours)for(let j=1;j<points.length;j++){const a=points[j-1],b=points[j],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*2));for(let k=0;k<=n;k++)dot(a.x+(b.x-a.x)*k/n-ox,a.y+(b.y-a.y)*k/n-oy);}
    return mask;
  }
  // Long, nearly uniform-width regions can be drawn along their medial axis
  // with a real game pencil size. Verify the painted footprint before replacing
  // a sealed contour + bucket; irregular shapes keep the existing fill path.
  async function pencilRegion(r,ids,w,opts,signal) {
    const perimeter=r.contours.reduce((n,p)=>n+pathLength(p),0),width=2*r.area/(perimeter||1);
    if(width<2||width>45||r.area<24)return null;
    const sizes=[4,10,20,32,40].filter(size=>Math.abs(size-width)<=Math.max(4,width*.35));
    if(!sizes.length)return null;
    const boxWidth=r.right-r.x,boxHeight=r.bottom-r.y;
    if(r.area/(boxWidth*boxHeight)>.6&&Math.min(boxWidth,boxHeight)>Math.max(...sizes)*1.15)return null;
    const rw=r.right-r.x+4,rh=r.bottom-r.y+4,ox=r.x-2,oy=r.y-2,target=new Uint8Array(rw*rh);
    for(let y=2;y<rh-2;y++)for(let x=2;x<rw-2;x++)target[y*rw+x]=ids[(y+oy)*w+x+ox]===r.id?1:0;
    // Reject broad interiors before iterative thinning. Area/perimeter alone
    // can mistake a large wedge or busy silhouette for a narrow ink stroke.
    const distance=Uint16Array.from(target,v=>v?10000:0);
    for(let y=1;y<rh-1;y++)for(let x=1;x<rw-1;x++){const i=y*rw+x;if(distance[i])distance[i]=Math.min(distance[i],distance[i-1]+1,distance[i-rw]+1,distance[i-rw-1]+1,distance[i-rw+1]+1);}
    let deepest=0;
    for(let y=rh-2;y>0;y--)for(let x=rw-2;x>0;x--){const i=y*rw+x;if(distance[i]){distance[i]=Math.min(distance[i],distance[i+1]+1,distance[i+rw]+1,distance[i+rw-1]+1,distance[i+rw+1]+1);deepest=Math.max(deepest,distance[i]);}}
    if(deepest>Math.max(...sizes)*1.5+2)return null;
    const skeleton=await thin(target,rw,rh,signal),raw=await trace(skeleton,rw,rh,signal);
    if(!raw.length||raw.length>128)return null;
    const at=(x,y)=>{x=Math.round(x);y=Math.round(y);return x>=0&&y>=0&&x<rw&&y<rh&&target[y*rw+x];};
    // Pair the two boundaries across the local normal. Parallel here means
    // their smoothed tangent directions agree (cosine >= .9), not that their
    // curvature values happen to match at a single raster pixel.
    let parallel=0,compared=0;
    const ribbons=raw.map(points=>{
      const loop=points.length>3&&points[0].x===points.at(-1).x&&points[0].y===points.at(-1).y,n=points.length-(loop?1:0),reach=Math.max(7,Math.min(14,Math.round(width))),index=i=>loop?(i%n+n)%n:clamp(i,0,n-1);
      const sections=points.map((p,i)=>{
        const a=points[index(i-reach)],b=points[index(i+reach)],length=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length;
        const side=direction=>{let d=0;while(d<44&&at(p.x+nx*(d+.5)*direction,p.y+ny*(d+.5)*direction))d+=.5;return d+.25;},left=side(1),right=side(-1);
        return {x:p.x+nx*(left-right)/2,y:p.y+ny*(left-right)/2,nx,ny,width:left+right,left:{x:p.x+nx*left,y:p.y+ny*left},right:{x:p.x-nx*right,y:p.y-ny*right}};
      });
      for(let i=loop?0:reach;i<(loop?n:n-reach);i+=2){
        const a=sections[index(i-reach)],b=sections[index(i+reach)],lx=b.left.x-a.left.x,ly=b.left.y-a.left.y,rx=b.right.x-a.right.x,ry=b.right.y-a.right.y,den=Math.hypot(lx,ly)*Math.hypot(rx,ry);
        if(den>1){compared++;if((lx*rx+ly*ry)/den>=.9)parallel++;}
      }
      return sections;
    });
    const parallelScore=compared?parallel/compared:0;
    const paths=raw.map(p=>curvePath(p,opts.tolerance)),length=paths.reduce((n,p)=>n+pathLength(p),0);
    if(length<Math.min(...sizes)*2)return null;
    const allowance=new Uint8Array(rw*rh);
    for(let y=0;y<rh;y++)for(let x=0;x<rw;x++)if(target[y*rw+x])for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<rw&&y+dy>=0&&y+dy<rh)allowance[(y+dy)*rw+x+dx]=1;
    const holes=[];
    if(r.contours.length>1){const visited=new Uint8Array(rw*rh),queue=new Int32Array(rw*rh);for(let i=0;i<target.length;i++){if(target[i]||visited[i])continue;let head=0,tail=1,exterior=false;queue[0]=i;visited[i]=1;while(head<tail){const p=queue[head++],x=p%rw,y=(p/rw)|0;if(!x||!y||x===rw-1||y===rh-1)exterior=true;for(const q of [x?p-1:-1,x<rw-1?p+1:-1,y?p-rw:-1,y<rh-1?p+rw:-1])if(q>=0&&!target[q]&&!visited[q]){visited[q]=1;queue[tail++]=q;}}if(!exterior)holes.push(queue.slice(0,tail));}}
    const onCanvas=(x,y)=>x+ox>=0&&x+ox<w&&y+oy>=0&&y+oy<ids.length/w;
    const safeDot=(x,y,size)=>{const radius=size/2;for(let py=Math.floor(y-radius);py<=Math.ceil(y+radius);py++)for(let px=Math.floor(x-radius);px<=Math.ceil(x+radius);px++)if((px-x)**2+(py-y)**2<=radius**2&&onCanvas(px,py)&&(px<0||py<0||px>=rw||py>=rh||!allowance[py*rw+px]))return false;return true;};
    const safeSegment=(a,b,size)=>{const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*2));for(let i=0;i<=steps;i++)if(!safeDot(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,size))return false;return true;};
    const smooth=points=>{const loop=points.length>3&&points[0].x===points.at(-1).x&&points[0].y===points.at(-1).y,n=points.length-(loop?1:0);return points.map((p,i)=>{if(!loop&&(i<2||i>=n-2))return p;let x=0,y=0;for(let j=-2;j<=2;j++){const q=points[loop?(i+j+n)%n:clamp(i+j,0,n-1)];x+=q.x;y+=q.y;}return {x:x/5,y:y/5};});};
    function constrained(lines,size){
      const result=[];
      for(const line of lines){let run=[];
        const flush=()=>{if(run.length>1){const rounded=curvePath(smooth(run),Math.min(1,opts.tolerance));if(rounded.every((p,i)=>!i||safeSegment(rounded[i-1],p,size)))result.push(rounded);else{const nodes=simplify(run,.6),fit=[{x:nodes[0].x,y:nodes[0].y}];for(let i=1;i<nodes.length;i++){const a=nodes[i-1],b=nodes[i];fit.push(...(safeSegment(a,b,size)?[{x:b.x,y:b.y}]:run.slice(a.sourceIndex+1,b.sourceIndex+1)));}result.push(fit);}}run=[];};
        for(const p of line){let bestPoint=null,bestDistance=Infinity;const x=Math.round(p.x),y=Math.round(p.y);
          for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const q={x:x+dx,y:y+dy},d=(q.x-p.x)**2+(q.y-p.y)**2;if(d<bestDistance&&safeDot(q.x,q.y,size)){bestDistance=d;bestPoint=q;}}
          if(!bestPoint){flush();continue;}
          const previous=run.at(-1);if(previous&&(Math.hypot(previous.x-bestPoint.x,previous.y-bestPoint.y)>3||!safeSegment(previous,bestPoint,size)))flush();
          if(!run.length||run.at(-1).x!==bestPoint.x||run.at(-1).y!==bestPoint.y)run.push(bestPoint);
        }
        flush();
      }
      return result;
    }
    function repaired(lines,size){
      const result=lines.slice(),painted=rasterContours(lines,rw,rh,0,0,size===4?3.5:size),near=new Uint8Array(rw*rh),radius=size/2;
      const mark=(x,y)=>{for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<rw&&y+dy>=0&&y+dy<rh)near[(y+dy)*rw+x+dx]=1;};
      for(let y=0;y<rh;y++)for(let x=0;x<rw;x++)if(painted[y*rw+x])mark(x,y);
      let repairs=0;
      for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){
        const i=y*rw+x;if(!target[i]||near[i]||repairs>=256)continue;
        let bestPoint=null,bestAdded=0;
        for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(dx*dx+dy*dy<=radius*radius){const px=x+dx,py=y+dy;if(!safeDot(px,py,size))continue;let added=0;for(let qy=Math.max(0,py-radius);qy<=Math.min(rh-1,py+radius);qy++)for(let qx=Math.max(0,px-radius);qx<=Math.min(rw-1,px+radius);qx++)if((qx-px)**2+(qy-py)**2<=radius**2&&target[qy*rw+qx]&&!near[qy*rw+qx])added++;if(added>bestAdded){bestAdded=added;bestPoint={x:px,y:py};}}
        if(!bestPoint)continue;
        let end=null;for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const q={x:bestPoint.x+dx,y:bestPoint.y+dy};if(safeSegment(bestPoint,q,size)){end=q;break;}}
        if(!end)continue;
        const patch=[bestPoint,end],left=Math.max(0,Math.min(bestPoint.x,end.x)-radius),top=Math.max(0,Math.min(bestPoint.y,end.y)-radius),right=Math.min(rw,Math.max(bestPoint.x,end.x)+radius+1),bottom=Math.min(rh,Math.max(bestPoint.y,end.y)+radius+1),pw=right-left,ph=bottom-top,mask=rasterContours([patch],pw,ph,left,top,size===4?3.5:size);
        for(let py=0;py<ph;py++)for(let px=0;px<pw;px++)if(mask[py*pw+px]){painted[(py+top)*rw+px+left]=1;mark(px+left,py+top);}
        result.push(patch);repairs++;
      }
      return result;
    }
    let best=null;
    for(const brushSize of sizes) {
      // A hard disk at integer pixel centers otherwise counts both edges of
      // a 4px pencil as fully black (five raster rows). Reserve its AA fringe.
      const rasterSize=brushSize===4?3.5:brushSize;
      const alternatives=[brushSize===4?raw.map(p=>curvePath(p,Math.min(.4,opts.tolerance))):paths];
      if(parallelScore>=.9){
        const centers=ribbons.map(p=>curvePath(p.map(q=>({x:q.x,y:q.y})),Math.min(brushSize===4?.4:1,opts.tolerance)));
        alternatives.push(centers);
        // A 6px line has no exact game pencil size. A few offset pencil
        // sweeps preserve its width without sealing and bucket-clicking it.
        if(width>brushSize*.95)alternatives.push(ribbons.flatMap(p=>[-1,0,1].map(side=>curvePath(p.map(q=>{const offset=Math.max(0,(q.width-brushSize)/2)*side;return {x:q.x+q.nx*offset,y:q.y+q.ny*offset};}),Math.min(brushSize===4?.3:.6,opts.tolerance)))));
        if(brushSize===4&&width>brushSize*.95)alternatives.push(ribbons.flatMap(p=>[-1,0,1].map(side=>curvePath(smooth(p.map(q=>{const offset=Math.max(0,(q.width-brushSize)/2)*side;return {x:q.x+q.nx*offset,y:q.y+q.ny*offset};})),Math.min(1,opts.tolerance)))));
        if(brushSize===4){
          const safePaths=constrained(raw,brushSize);alternatives.push(safePaths,repaired(safePaths,brushSize));
          alternatives.push(constrained(ribbons.flatMap(p=>[-1,0,1].map(side=>p.map(q=>{const offset=Math.max(0,(q.width-brushSize)/2)*side;return {x:q.x+q.nx*offset,y:q.y+q.ny*offset};}))),brushSize));
        }
      }
      for(const candidatePaths of alternatives){
      if(!candidatePaths.length)continue;
      // Offset passes can duplicate a center pass or tiny junction fragments.
      // Keep paths only when they add source coverage, before costing the plan.
      let selectedPaths=candidatePaths;
      if(candidatePaths.length>raw.length){const coverage=new Uint8Array(rw*rh);selectedPaths=[];for(const path of candidatePaths.slice().sort((a,b)=>pathLength(b)-pathLength(a))){const left=Math.max(0,Math.floor(Math.min(...path.map(p=>p.x))-brushSize/2)),top=Math.max(0,Math.floor(Math.min(...path.map(p=>p.y))-brushSize/2)),right=Math.min(rw,Math.ceil(Math.max(...path.map(p=>p.x))+brushSize/2)+1),bottom=Math.min(rh,Math.ceil(Math.max(...path.map(p=>p.y))+brushSize/2)+1),pw=right-left,ph=bottom-top,mask=rasterContours([path],pw,ph,left,top,rasterSize);let added=0;for(let y=0;y<ph;y++)for(let x=0;x<pw;x++){const i=(y+top)*rw+x+left;if(mask[y*pw+x]&&target[i]&&!coverage[i])added++;}if(!added)continue;selectedPaths.push(path);for(let y=0;y<ph;y++)for(let x=0;x<pw;x++)if(mask[y*pw+x])coverage[(y+top)*rw+x+left]=1;}}
      const painted=rasterContours(selectedPaths,rw,rh,0,0,rasterSize);let covered=0,spill=0,unsafe=false,missed=0;
      for(let y=0;y<rh;y++)for(let x=0;x<rw;x++) {
        const i=y*rw+x;
        if(!onCanvas(x,y))continue;
        if(target[i]&&!painted[i]){let near=false;for(let dy=-1;dy<=1&&!near;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<rw&&y+dy>=0&&y+dy<rh&&painted[i+dy*rw+dx]){near=true;break;}if(!near)missed++;}
        if(!painted[i])continue;
        if(target[i]){covered++;continue;}spill++;
        // Allow only one pixel of raster/center rounding, never a shortcut
        // across another feature, transparent hole or neighboring color.
        let near=false;for(let dy=-1;dy<=1&&!near;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<rw&&y+dy>=0&&y+dy<rh&&target[i+dy*rw+dx]){near=true;break;}
        if(!near)unsafe=true;
      }
      const overlap=covered/(r.area+spill);
      const exact=covered>=r.area*.93&&spill<=(covered+spill)*.04&&overlap>=.9;
      const parallelFit=parallelScore>=.9&&covered>=r.area*.9&&missed<=r.area*.02;
      if(unsafe||!exact&&!parallelFit||holes.some(hole=>hole.every(i=>painted[i])))continue;
      const candidate={kind:'pencil-region',stage:'fill',colorId:r.colorId,brushSize,paths:selectedPaths.map(p=>p.map(q=>({x:q.x+ox,y:q.y+oy}))),area:r.area,optional:true,score:r.area,overlap,parallelScore};
      if(!best||strokeCost(candidate)<strokeCost(best))best=candidate;
      await checkpoint(signal);
      }
      await checkpoint(signal);
    }
    return best;
  }
  async function bucketRegions(labels,w,h,opts,signal,onStage) {
    const {ids,regions}=await colorRegions(labels,w,h,signal);
    onStage?.('Closing '+regions.length+' color regions');
    await regionContours(ids,regions,w,h,signal);
    onStage?.('Checking enclosed bucket fills');
    const fills=[],counts=new Map(),pencilBlack=new Uint8Array(w*h);for(const r of regions)counts.set(r.colorId,(counts.get(r.colorId)||0)+r.area);
    for(const r of regions) {
      if(opts.skipWhite&&r.colorId===0)continue;
      if(!r.contours.length)continue;
      const pencil=await pencilRegion(r,ids,w,opts,signal);
      const boundaryCost=r.contours.reduce((cost,p)=>cost+(p.length+1)*8+2,0);
      const addPencil=()=>{
        fills.push(pencil);
        if(r.colorId===1)for(let y=r.y;y<r.bottom;y++)for(let x=r.x;x<r.right;x++)if(ids[y*w+x]===r.id)for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h)pencilBlack[(y+dy)*w+x+dx]=1;
      };
      if(pencil&&(pencil.parallelScore>=.9||strokeCost(pencil)+32<boundaryCost*(r.colorId===1?2:1)+50)) {
        addPencil();
        await checkpoint(signal);continue;
      }
      const ox=Math.max(0,r.x-4),oy=Math.max(0,r.y-4),rw=Math.min(w,r.right+4)-ox,rh=Math.min(h,r.bottom+4)-oy;
      const barriers=rasterContours(r.contours,rw,rh,ox,oy),visited=new Uint8Array(rw*rh),queue=new Int32Array(rw*rh),seeds=[],distance=Uint16Array.from(barriers,v=>v?0:10000);
      for(let y=1;y<rh;y++)for(let x=1;x<rw;x++){const i=y*rw+x;distance[i]=Math.min(distance[i],distance[i-1]+1,distance[i-rw]+1);}
      for(let y=rh-2;y>=0;y--)for(let x=rw-2;x>=0;x--){const i=y*rw+x;distance[i]=Math.min(distance[i],distance[i+1]+1,distance[i+rw]+1);}
      let safe=true;
      // Every interior compartment gets a seed, including regions pinched by
      // the brush width. Verify against the original labels before using Fill.
      for(let y=r.y;y<r.bottom;y++)for(let x=r.x;x<r.right;x++) {
        const local=(y-oy)*rw+x-ox;if(ids[y*w+x]!==r.id||barriers[local]||visited[local])continue;
        let head=0,tail=1,best=local;queue[0]=local;visited[local]=1;
        while(head<tail){const p=queue[head++],px=p%rw,py=(p/rw)|0;
          if(distance[p]>distance[best])best=p;
          if(ids[(py+oy)*w+px+ox]!==r.id)safe=false;
          for(const q of [px?p-1:-1,px<rw-1?p+1:-1,py?p-rw:-1,py<rh-1?p+rw:-1])if(q>=0&&!barriers[q]&&!visited[q]){visited[q]=1;queue[tail++]=q;}
          if(head%20000===0)await checkpoint(signal);
        }
        seeds.push({x:best%rw+ox,y:((best/rw)|0)+oy});
      }
      if(!safe)throw new Error('A color boundary could not be safely sealed. Select Brush strokes and process again.');
      const region={kind:'region',stage:'fill',colorId:r.colorId,brushSize:4,contours:r.contours,seeds,area:r.area,optional:true,score:r.area};
      if(pencil&&strokeCost(pencil)+32<strokeCost(region)+(r.colorId===1?boundaryCost:0)+32)addPencil();else fills.push(region);
      if(r.id%32===0){onStage?.('Checking color region '+(r.id+1)+' of '+regions.length);await checkpoint(signal);}
    }
    fills.sort((a,b)=>Number(a.kind==='pencil-region'&&a.colorId===1)-Number(b.kind==='pencil-region'&&b.colorId===1)||counts.get(b.colorId)-counts.get(a.colorId)||a.colorId-b.colorId||b.area-a.area);
    Object.defineProperty(fills,'pencilBlack',{value:pencilBlack});
    return fills;
  }
  // Borders are derived from the SAME labels as the fills. Keep strong source
  // detail away from these borders instead of drawing a second, offset border.
  async function alignedBorders(source,labels,visible,w,h,signal,keepBounds=false) {
    const border=new Uint8Array(w*h);let left=w,top=h,right=-1,bottom=-1;
    for(let i=0;i<visible.length;i++)if(visible[i]){left=Math.min(left,i%w);right=Math.max(right,i%w);top=Math.min(top,(i/w)|0);bottom=Math.max(bottom,(i/w)|0);}
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=y*w+x;if(labels[i]<0)continue;
      // Ignore the rectangular image/letterbox frame, but keep subject alpha edges.
      if(!keepBounds&&(x<=left+1||x>=right-1||y<=top+1||y>=bottom-1))continue;
      if([i-1,i+1,i-w,i+w].some(q=>labels[q]!==labels[i]))border[i]=1;
    }
    const result=border.slice();
    for(let y=1;y<h-1;y++) {
      for(let x=1;x<w-1;x++) {
        const i=y*w+x;if(!source[i]||!keepBounds&&(x<=left+1||x>=right-1||y<=top+1||y>=bottom-1))continue;
        let nearby=false;for(let dy=-3;dy<=3&&!nearby;dy++)for(let dx=-3;dx<=3;dx++)if(x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h&&border[i+dy*w+dx]){nearby=true;break;}
        if(!nearby)result[i]=1;
      }
      if(y%40===0)await checkpoint(signal);
    }
    return thin(result,w,h,signal);
  }
  async function fillStrokes(labels,w,h,opts,signal) {
    const distance=new Uint16Array(w*h),counts=new Map();
    for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
      const i=y*w+x,id=labels[i];if(id<0)continue;
      counts.set(id,(counts.get(id)||0)+1);
      distance[i]=(x===0||y===0||x===w-1||y===h-1||[i-1,i+1,i-w,i+w].some(q=>labels[q]!==id))?0:10000;
    }
    for(let y=1;y<h;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(distance[i])distance[i]=Math.min(distance[i],distance[i-1]+1,distance[i-w]+1,distance[i-w-1]+1,distance[i-w+1]+1);}
    for(let y=h-2;y>=0;y--)for(let x=w-2;x>0;x--){const i=y*w+x;if(distance[i])distance[i]=Math.min(distance[i],distance[i+1]+1,distance[i+w]+1,distance[i+w+1]+1,distance[i+w-1]+1);}
    const strokes=[];
    const colors=[...counts.keys()].filter(id=>!(opts.skipWhite&&id===0)).sort((a,b)=>counts.get(b)-counts.get(a)||a-b);
    for(const colorId of colors) {
      for(const [brushSize,step,min,max] of [[20,14,11,Infinity],[10,7,6,11],[4,3,3,6]]) {
        for(let y=0;y<h;y+=step) {
          let x=0;
          while(x<w) {
            while(x<w&&(labels[y*w+x]!==colorId||distance[y*w+x]<min||distance[y*w+x]>=max))x++;
            const start=x;
            while(x<w&&labels[y*w+x]===colorId&&distance[y*w+x]>=min&&distance[y*w+x]<max)x++;
            if(x-start<2)continue;
            const points=y/step%2<1?[{x:start,y},{x:x-1,y}]:[{x:x-1,y},{x:start,y}];
            strokes.push({stage:'fill',colorId,brushSize,points,optional:true,score:(x-start)*brushSize});
          }
        }
      }
      await checkpoint(signal);
    }
    return strokes;
  }
  function strokeParts(stroke) {return stroke.kind==='region'?[...stroke.contours.map(points=>({points})),...stroke.seeds.map(p=>({points:[p],bucket:true}))]:stroke.kind==='pencil-region'?stroke.paths.map(points=>({points})):[{points:stroke.points}];}
  function strokeMoves(stroke){return strokeParts(stroke).reduce((n,p)=>n+Math.max(1,p.points.length-1),0);}
  function strokeCost(stroke,eventMs=8){return strokeParts(stroke).reduce((ms,p)=>ms+(p.bucket?2:p.points.length+1)*eventMs+2,0);}
  function metrics(strokes,eventMs=8) {
    let color=-1,brush=-1,changes=0,brushChanges=0,events=0,ms=0,drags=0,buckets=0;
    for(const s of strokes){if(s.colorId!==color){changes++;color=s.colorId;ms+=eventMs*2;}if(s.brushSize!==brush){brushChanges++;brush=s.brushSize;ms+=eventMs*4;}for(const p of strokeParts(s)){events+=p.bucket?2:p.points.length+1;if(p.bucket)buckets++;else drags++;}ms+=strokeCost(s,eventMs);}
    return {colors:new Set(strokes.map(s=>s.colorId)).size,operations:strokes.length,strokes:drags,buckets,moves:strokes.reduce((n,s)=>n+strokeMoves(s),0),events,colorChanges:changes,brushChanges,estimatedMs:Math.round(ms)};
  }
  function budgetStrokes(fills,outlines,opts) {
    // Geometry/coverage must not depend on a hidden latency value left by the
    // last draw. Observed latency affects estimates and runtime reporting only.
    opts={...opts,eventMs:8};
    function select(list,budget){let cost=0;return list.filter(s=>{const c=strokeCost(s,opts.eventMs)+4; if(cost+c>budget)return false;cost+=c;return true;});}
    if(opts.treatment==='light-lines') {
      // Background is a prerequisite for white ink. Give the remaining budget
      // to lines instead of leaving two thirds reserved for nonexistent fills.
      const backgroundCost=metrics(fills,opts.eventMs).estimatedMs;
      if(backgroundCost>opts.budget*1000)return [];
      const chosen=fills.concat(select(outlines,Math.max(0,opts.budget*1000-backgroundCost-500)));
      while(chosen.length>fills.length&&metrics(chosen,opts.eventMs).estimatedMs>opts.budget*1000)chosen.pop();
      return chosen.map((s,i)=>({...s,id:i}));
    }
    const outlineBudget=opts.budget*1000/3,fillBudget=opts.budget*1000*2/3;
    const lines=select(outlines,Math.max(0,outlineBudget-500));
    const bestFills=select(fills.slice().sort((a,b)=>b.score/strokeCost(b,opts.eventMs)-a.score/strokeCost(a,opts.eventMs)),Math.max(0,fillBudget-2000));
    // Keep original grouping/order after selecting the most useful fills.
    const selected=new Set(bestFills),chosen=fills.filter(s=>selected.has(s)).concat(lines);
    // Account for actual tool switches as well as input events.
    while(chosen.length&&metrics(chosen,opts.eventMs).estimatedMs>opts.budget*1000){const i=chosen.findLastIndex(s=>s.stage==='fill');chosen.splice(i<0?chosen.length-1:i,1);}
    return chosen.map((s,i)=>({...s,id:i}));
  }
  async function processRGBA(input,options={},context={}) {
    const {width:w,height:h}=input,data=input.data,opts=settings(options),signal=context.signal,start=Date.now();
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>WIDTH*HEIGHT||data.length!==w*h*4)throw new Error('Invalid processing image');
    if(opts.detector==='ai'&&(!context.lineMask||context.lineMask.length!==w*h))throw new Error('AI line image is missing or misaligned. Start the local service or switch to Browser.');
    if(opts.focus!=='none')return processFocused(input,opts,context,start);
    if(opts.treatment==='light-lines')return processLightLines(input,opts,context,start);
    context.onStage?.('Simplifying colors');
    const {labels,visible}=await quantize(data,w,h,opts,signal);
    if(opts.fillMode==='bucket'){context.onStage?.('Merging tiny color speckles');await mergeSpeckles(labels,w,h,signal,opts.speed==='fast'?64:12);}
    context.onStage?.('Detecting lines');
    let mask;
    if(context.omitOutlines)mask=new Uint8Array(w*h);
    else if(opts.detector==='ai') {
      if(!context.lineMask||context.lineMask.length!==w*h)throw new Error('AI line image is missing or misaligned. Start the local service or switch to Browser.');
      mask=Uint8Array.from(context.lineMask,(v,i)=>visible[i]&&v>(180-opts.detail)?1:0);
    } else mask=await detectEdges(data,w,h,labels,visible,opts,signal);
    context.onStage?.('Closing small line gaps');
    mask=await thin(mask,w,h,signal);
    const closed=await closeGaps(mask,w,h,opts.closeGaps,signal);mask=closed.mask;
    if(opts.fillMode==='bucket')mask=await alignedBorders(mask,labels,visible,w,h,signal,context.subjectLayer===true);
    context.onStage?.('Planning color fills');
    const fills=opts.fillMode==='bucket'?await bucketRegions(labels,w,h,opts,signal,context.onStage):await fillStrokes(labels,w,h,opts,signal);
    // The wide black pencil already supplies these edges. Retracing both sides
    // in a thin pencil would undo the time saved and thicken the source line.
    if(fills.pencilBlack)for(let i=0;i<mask.length;i++)if(fills.pencilBlack[i])mask[i]=0;
    context.onStage?.('Tracing continuous outlines');
    const paths=await trace(mask,w,h,signal),outlines=[];
    for(let i=0;i<paths.length;i++) {
      const points=paths[i],length=pathLength(points);
      if(length>=(opts.speed==='fast'?Math.max(10,34-opts.detail*.18):Math.max(5,22-opts.detail*.16)))outlines.push({stage:'outline',colorId:1,brushSize:4,points:curvePath(points,opts.tolerance),optional:false,score:length});
      if(i%80===0)await checkpoint(signal);
    }
    outlines.sort((a,b)=>b.score-a.score);
    const strokes=budgetStrokes(fills,outlines,opts);
    const simplified=new Uint8ClampedArray(w*h*4),lines=new Uint8ClampedArray(w*h*4),colors=new Set();
    for(let i=0;i<w*h;i++){const id=labels[i];if(id>=0){colors.add(id);simplified.set([...rgb(PALETTE[id]),255],i*4);}lines.set([mask[i]?0:255,mask[i]?0:255,mask[i]?0:255,255],i*4);}
    const plan={version:2,width:w,height:h,palette:PALETTE.slice(),settings:opts,strokes,metrics:metrics(strokes,opts.eventMs),processingMs:Date.now()-start,
      omitted:{fills:fills.length-strokes.filter(s=>s.stage==='fill').length,outlines:outlines.length-strokes.filter(s=>s.stage==='outline').length},sourceColors:colors.size,closedGaps:closed.closed};
    return {plan,simplified:{data:simplified,width:w,height:h},lines:{data:lines,width:w,height:h},mask};
  }
  async function processLightLines(input,opts,context,start) {
    const {width:w,height:h,data}=input,signal=context.signal;
    context.onStage?.('Separating bright ink from the background');
    const profile=await lightLineProfile(input,signal),backgroundLab=amplifyLab(lab(...profile.background),opts.amplify);
    const backgroundId=paletteColor(backgroundLab,opts.amplify,false);
    const visible=new Uint8Array(w*h),labels=new Int16Array(w*h).fill(-1);
    // Raising detail admits weaker lines, while the faint background grid stays
    // below the normal threshold. Antialiased ink is collapsed to one white.
    const threshold=profile.backgroundL+Math.max(30,(profile.peak-profile.backgroundL)*clamp(.82-opts.detail*.003,.48,.8));
    let mask=new Uint8Array(w*h);
    for(let y=0;y<h;y++){for(let x=0;x<w;x++){const i=y*w+x,j=i*4;if(data[j+3]<128)continue;
      visible[i]=1;labels[i]=backgroundId;if(luminance(data[j],data[j+1],data[j+2])>=threshold)mask[i]=1;
    }if(y%50===0)await checkpoint(signal);}
    if(opts.detector==='ai') {
      context.onStage?.('Checking bright ink against AI lines');
      // Retain entire bright-ink components supported by the model. Intersecting
      // edge pixels directly would hollow out each stroke into a double border.
      const seen=new Uint8Array(w*h),queue=new Int32Array(w*h),lineMask=context.lineMask;
      for(let start=0;start<mask.length;start++){if(!mask[start]||seen[start])continue;let head=0,tail=1,supported=false;queue[0]=start;seen[start]=1;
        while(head<tail){const i=queue[head++],x=i%w,y=(i/w)|0;
          for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const nx=x+dx,ny=y+dy;if(nx>=0&&nx<w&&ny>=0&&ny<h&&lineMask[ny*w+nx]>180-opts.detail)supported=true;}
          for(const q of neighbors(mask,i,w,h))if(!seen[q]){seen[q]=1;queue[tail++]=q;}
          if(head%10000===0)await checkpoint(signal);
        }
        if(!supported)for(let n=0;n<tail;n++)mask[queue[n]]=0;
        if(start%4096===0)await checkpoint(signal);
      }
    }
    context.onStage?.('Tracing single light strokes');
    if(context.omitOutlines)mask.fill(0);
    mask=await thin(mask,w,h,signal);const closed=await closeGaps(mask,w,h,opts.closeGaps,signal);mask=closed.mask;
    const paths=await trace(mask,w,h,signal),outlines=[];
    for(let i=0;i<paths.length;i++){const length=pathLength(paths[i]);if(length>=Math.max(4,14-opts.detail*.12))outlines.push({stage:'outline',colorId:0,brushSize:4,points:curvePath(paths[i],opts.tolerance),optional:false,score:length});if(i%80===0)await checkpoint(signal);}
    outlines.sort((a,b)=>b.score-a.score);
    context.onStage?.('Planning one background layer');
    const backgroundFills=opts.fillMode==='bucket'?await bucketRegions(labels,w,h,opts,signal,context.onStage):await fillStrokes(labels,w,h,opts,signal);
    const fills=backgroundFills.map(s=>({...s,optional:false,role:'background'})),strokes=budgetStrokes(fills,outlines,opts);
    const simplified=new Uint8ClampedArray(w*h*4),lines=new Uint8ClampedArray(w*h*4),background=rgb(PALETTE[backgroundId]);
    for(let i=0;i<w*h;i++){if(visible[i])simplified.set(mask[i]?[255,255,255,255]:[...background,255],i*4);lines.set(mask[i]?[0,0,0,255]:[255,255,255,255],i*4);}
    const plan={version:2,width:w,height:h,palette:PALETTE.slice(),settings:opts,strokes,metrics:metrics(strokes,opts.eventMs),processingMs:Date.now()-start,
      omitted:{fills:fills.length-strokes.filter(s=>s.stage==='fill').length,outlines:outlines.length-strokes.filter(s=>s.stage==='outline').length},sourceColors:visible.some(Boolean)?2:0,closedGaps:closed.closed};
    return {plan,simplified:{data:simplified,width:w,height:h},lines:{data:lines,width:w,height:h},mask};
  }
  async function processFocused(input,opts,context,start) {
    const {width:w,height:h,data}=input,signal=context.signal;
    if(!context.subjectMask||context.subjectMask.length!==w*h)throw new Error('Select a main subject first: use Find main subject (AI) or Mark subject, then Process image.');
    context.onStage?.('Separating subject from background');
    const mask=Uint8Array.from(context.subjectMask,(v,i)=>v>=128&&data[i*4+3]>=128?1:0),distance=Uint16Array.from(mask,v=>v?0:10000);
    let area=0,left=w,top=h,right=0,bottom=0;
    for(let i=0;i<mask.length;i++)if(mask[i]){area++;const x=i%w,y=(i/w)|0;left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
    if(area<4)throw new Error('No subject remains inside this crop. Reset the crop or select the subject again.');
    for(let y=0;y<h;y++){for(let x=0;x<w;x++){const i=y*w+x;if(x)distance[i]=Math.min(distance[i],distance[i-1]+1);if(y)distance[i]=Math.min(distance[i],distance[i-w]+1,x?distance[i-w-1]+1:10000,x<w-1?distance[i-w+1]+1:10000);}if(y%50===0)await checkpoint(signal);}
    for(let y=h-1;y>=0;y--){for(let x=w-1;x>=0;x--){const i=y*w+x;if(x<w-1)distance[i]=Math.min(distance[i],distance[i+1]+1);if(y<h-1)distance[i]=Math.min(distance[i],distance[i+w]+1,x?distance[i+w-1]+1:10000,x<w-1?distance[i+w+1]+1:10000);}if(y%50===0)await checkpoint(signal);}
    const subjectData=new Uint8ClampedArray(data),backgroundData=new Uint8ClampedArray(data);
    // Six pixels keep a later background brush (radius 2, fitting error 1.5)
    // outside the finished subject, including holes and disconnected parts.
    for(let i=0;i<mask.length;i++){if(!mask[i])subjectData[i*4+3]=0;if(distance[i]<=6)backgroundData[i*4+3]=0;}
    const includeBackground=opts.focus==='subject-background'&&opts.budget>=20,subjectBudget=includeBackground?opts.budget*.8:opts.budget;
    const subject=await processRGBA({width:w,height:h,data:subjectData},{...opts,focus:'none',budget:subjectBudget},{...context,subjectLayer:true,onStage:s=>context.onStage?.('Subject: '+s)});
    let background=null;
    if(includeBackground)background=await processRGBA({width:w,height:h,data:backgroundData},{...opts,focus:'none',speed:'fast',colors:Math.min(3,opts.colors),merge:Math.max(26,opts.merge),fillMode:'strokes',budget:opts.budget-subjectBudget},{...context,subjectLayer:false,omitOutlines:true,onStage:s=>context.onStage?.('Optional background: '+s)});
    const subjectStrokes=subject.plan.strokes.map(s=>({...s,priority:'subject',optional:false})),backgroundStrokes=(background?.plan.strokes||[]).map(s=>({...s,priority:'background',optional:true}));
    let trimmed=0;while(backgroundStrokes.length&&metrics(subjectStrokes.concat(backgroundStrokes),8).estimatedMs>opts.budget*1000){backgroundStrokes.pop();trimmed++;}
    const strokes=subjectStrokes.concat(backgroundStrokes).map((s,id)=>({...s,id}));
    const simplified=new Uint8ClampedArray(subject.simplified.data),simplifiedColors=new Set();
    for(let i=0;i<mask.length;i++){
      if(background&&!mask[i]&&background.simplified.data[i*4+3])simplified.set(background.simplified.data.subarray(i*4,i*4+4),i*4);
      if(simplified[i*4+3])simplifiedColors.add((simplified[i*4]<<16)|(simplified[i*4+1]<<8)|simplified[i*4+2]);
    }
    const plan={version:2,width:w,height:h,palette:PALETTE.slice(),settings:opts,strokes,metrics:metrics(strokes,opts.eventMs),processingMs:Date.now()-start,
      focus:{mode:opts.focus,method:context.subjectSource||'manual',bounds:{x:left,y:top,w:right-left,h:bottom-top},area,guardPixels:6,subjectOperations:subjectStrokes.length,backgroundOperations:backgroundStrokes.length},
      omitted:{fills:subject.plan.omitted.fills+(background?.plan.omitted.fills||0)+trimmed,outlines:subject.plan.omitted.outlines+(background?.plan.omitted.outlines||0)},sourceColors:simplifiedColors.size,closedGaps:subject.plan.closedGaps};
    return {plan,simplified:{width:w,height:h,data:simplified},lines:subject.lines,mask:subject.mask,subjectMask:mask};
  }
  // The public game's bucket uses 4-connected pixels within <3 RGB values of
  // the seed. Simulate that same operation, rather than painting a polygon that
  // might look closed while the actual game fill leaks.
  function floodRGBA(data,w,h,seed,color) {
    const x=clamp(Math.floor(seed.x),0,w-1),y=clamp(Math.floor(seed.y),0,h-1),start=y*w+x,k=start*4,target=data.slice(k,k+3);
    if(color.every((c,i)=>c===target[i]))return 0;
    const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);queue[0]=start;seen[start]=1;let head=0,tail=1;
    const matches=i=>color.some((c,n)=>data[i*4+n]!==c)&&target.every((c,n)=>Math.abs(data[i*4+n]-c)<3);
    while(head<tail){const i=queue[head++],px=i%w,py=(i/w)|0;data.set([...color,255],i*4);
      for(const q of [px?i-1:-1,px<w-1?i+1:-1,py?i-w:-1,py<h-1?i+w:-1])if(q>=0&&!seen[q]&&matches(q)){seen[q]=1;queue[tail++]=q;}
    }
    return tail;
  }
  function renderPlan(ctx,plan,{fraction=1,travel=false,directions=false,skipped=[]}={}) {
    ctx.clearRect(0,0,plan.width,plan.height);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,plan.width,plan.height);
    ctx.lineCap='round';ctx.lineJoin='round';
    const total=plan.strokes.reduce((n,s)=>n+strokeMoves(s),0),limit=Math.floor(clamp(fraction,0,1)*total),skip=new Set(skipped),overlays=[];let done=0,previous=null;
    for(const s of plan.strokes) {
      if(done>=limit)break;
      for(const part of strokeParts(s)) {
        if(done>=limit)break;
        const p=part.points,count=Math.min(Math.max(1,p.length-1),limit-done),color=(plan.palette||PALETTE)[s.colorId];
        if(travel&&previous)overlays.push({travel:[previous,p[0]]});
        if(!skip.has(s.id)) {
          if(part.bucket){const pixels=ctx.getImageData(0,0,plan.width,plan.height);floodRGBA(pixels.data,plan.width,plan.height,p[0],rgb(color));ctx.putImageData(pixels,0,0);}
          else{ctx.strokeStyle=color;ctx.lineWidth=s.brushSize;ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<=count;i++)ctx.lineTo(p[i].x,p[i].y);ctx.stroke();}
        }
        if(directions||skip.has(s.id))overlays.push({p:p.slice(0,part.bucket?1:count+1),bucket:part.bucket,stage:s.stage,skip:skip.has(s.id)});
        done+=count;previous=p[part.bucket?0:count];
      }
    }
    // Overlay arrows/travel after all buckets so annotations never seal a fill.
    for(const o of overlays){ctx.save();ctx.lineWidth=1.5;
      if(o.travel){ctx.strokeStyle='#94a3b8';ctx.lineWidth=1;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(o.travel[0].x,o.travel[0].y);ctx.lineTo(o.travel[1].x,o.travel[1].y);ctx.stroke();}
      else{const a=o.p[0];ctx.strokeStyle=o.skip?'#94a3b8':o.stage==='fill'?'#0284c7':'#dc2626';if(o.bucket){ctx.beginPath();ctx.arc(a.x,a.y,4,0,Math.PI*2);ctx.moveTo(a.x-6,a.y);ctx.lineTo(a.x+6,a.y);ctx.moveTo(a.x,a.y-6);ctx.lineTo(a.x,a.y+6);ctx.stroke();}
        else if(o.skip){ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(a.x,a.y);for(const p of o.p.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();}
        else{const b=o.p[Math.min(o.p.length-1,2)];ctx.translate(a.x,a.y);ctx.rotate(Math.atan2(b.y-a.y,b.x-a.x));ctx.beginPath();ctx.moveTo(-4,-4);ctx.lineTo(3,0);ctx.lineTo(-4,4);ctx.stroke();}}
      ctx.restore();}
  }
  // Playback keeps clean completed input separate from annotations: drawing an
  // arrow onto the bucket surface could change which pixels a later fill reaches.
  // A partial stroke is painted over that surface, then committed only once in
  // full, preserving round joins and antialiasing without repeatedly overpainting.
  function createPlanRenderer(plan,createCanvas) {
    const surface=()=>{const c=createCanvas();c.width=plan.width;c.height=plan.height;return c;};
    const base=surface(),annotations=surface(),baseCtx=base.getContext('2d',{willReadFrequently:true}),annotationCtx=annotations.getContext('2d',{willReadFrequently:true});
    const entries=[];let total=0;
    for(const stroke of plan.strokes)for(const part of strokeParts(stroke)){const moves=Math.max(1,part.points.length-1);entries.push({stroke,part,start:total,end:total+moves});total+=moves;}
    const checkpoints=[],stride=Math.max(32,Math.ceil(entries.length/6));
    let completed=0,annotationCount=0,mode='',skip=new Set(),partial=null,disposed=false;
    function clear(){baseCtx.clearRect(0,0,plan.width,plan.height);baseCtx.fillStyle='#ffffff';baseCtx.fillRect(0,0,plan.width,plan.height);completed=0;partial=null;}
    function clearAnnotations(){annotationCtx.clearRect(0,0,plan.width,plan.height);annotationCount=0;}
    function pathFor(entry,count){
      const points=entry.part.points;
      if(typeof Path2D!=='function')return null;
      if(partial?.entry!==entry||partial.count>count){const path=new Path2D();path.moveTo(points[0].x,points[0].y);partial={entry,path,count:0};}
      while(partial.count<count){const p=points[++partial.count];partial.path.lineTo(p.x,p.y);}
      return partial.path;
    }
    function paint(ctx,entry,count){
      const {stroke,part}=entry,p=part.points,color=(plan.palette||PALETTE)[stroke.colorId];
      if(skip.has(stroke.id))return;
      if(part.bucket){const pixels=ctx.getImageData(0,0,plan.width,plan.height);floodRGBA(pixels.data,plan.width,plan.height,p[0],rgb(color));ctx.putImageData(pixels,0,0);}
      else{ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=color;ctx.lineWidth=stroke.brushSize;const path=pathFor(entry,count);
        if(path)ctx.stroke(path);else{ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<=count;i++)ctx.lineTo(p[i].x,p[i].y);ctx.stroke();}}
    }
    function annotate(ctx,index,count,{travel,directions}){
      const {stroke,part}=entries[index],p=part.points,a=p[0],omitted=skip.has(stroke.id);
      ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
      if(travel&&index){const previous=entries[index-1].part.points;ctx.strokeStyle='#94a3b8';ctx.lineWidth=1;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(previous.at(-1).x,previous.at(-1).y);ctx.lineTo(a.x,a.y);ctx.stroke();ctx.setLineDash([]);}
      if(directions||omitted){ctx.lineWidth=1.5;ctx.strokeStyle=omitted?'#94a3b8':stroke.stage==='fill'?'#0284c7':'#dc2626';
        if(part.bucket){ctx.beginPath();ctx.arc(a.x,a.y,4,0,Math.PI*2);ctx.moveTo(a.x-6,a.y);ctx.lineTo(a.x+6,a.y);ctx.moveTo(a.x,a.y-6);ctx.lineTo(a.x,a.y+6);ctx.stroke();}
        else if(omitted){ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(a.x,a.y);for(let i=1;i<=count;i++)ctx.lineTo(p[i].x,p[i].y);ctx.stroke();}
        else{const b=p[Math.min(count,2)];ctx.translate(a.x,a.y);ctx.rotate(Math.atan2(b.y-a.y,b.x-a.x));ctx.beginPath();ctx.moveTo(-4,-4);ctx.lineTo(3,0);ctx.lineTo(-4,4);ctx.stroke();}}
      ctx.restore();
    }
    clear();
    function render(ctx,{fraction=1,travel=false,directions=false,skipped=[]}={}){
      if(disposed)throw new Error('Preview renderer was disposed');
      const limit=Math.floor(clamp(fraction,0,1)*total),nextSkip=new Set(skipped);
      const changed=new Set([...skip,...nextSkip].filter(id=>skip.has(id)!==nextSkip.has(id)));
      if(changed.size){
        if(entries.slice(0,completed).some(entry=>changed.has(entry.stroke.id))){clear();clearAnnotations();}
        // Checkpoints may contain a skipped stroke even if not in today's prefix.
        for(const checkpoint of checkpoints)checkpoint.canvas.width=checkpoint.canvas.height=0;
        checkpoints.length=0;skip=nextSkip;
      }
      if(completed&&entries[completed-1].end>limit){
        clear();clearAnnotations();
        const saved=checkpoints.filter(checkpoint=>checkpoint.end<=limit).at(-1);
        if(saved){baseCtx.drawImage(saved.canvas,0,0);completed=saved.index;}
      }
      const nextMode=String(travel)+String(directions);
      if(mode!==nextMode){mode=nextMode;clearAnnotations();}
      while(completed<entries.length&&entries[completed].end<=limit){
        const entry=entries[completed];paint(baseCtx,entry,entry.end-entry.start);completed++;partial=null;
        if(completed%stride===0&&!checkpoints.some(checkpoint=>checkpoint.index===completed)&&checkpoints.length<6){const canvas=surface();canvas.getContext('2d').drawImage(base,0,0);checkpoints.push({index:completed,end:entry.end,canvas});checkpoints.sort((a,b)=>a.index-b.index);}
      }
      for(;annotationCount<completed;annotationCount++){const entry=entries[annotationCount];annotate(annotationCtx,annotationCount,entry.end-entry.start,{travel,directions});}
      ctx.clearRect(0,0,plan.width,plan.height);ctx.drawImage(base,0,0);
      const current=entries[completed],count=current?limit-current.start:0;
      if(count>0)paint(ctx,current,count);
      ctx.drawImage(annotations,0,0);
      if(count>0)annotate(ctx,completed,count,{travel,directions});
    }
    return {plan,strokes:plan.strokes,render,dispose(){disposed=true;for(const c of [base,annotations,...checkpoints.map(checkpoint=>checkpoint.canvas)])c.width=c.height=0;checkpoints.length=0;partial=null;}};
  }
  return {WIDTH,HEIGHT,PALETTE,settings,prepareImage,segmentParts,suggestSettings,processRGBA,renderPlan,createPlanRenderer,metrics,strokeCost,strokeParts,strokeMoves,floodRGBA,lab,thin,trace,curvePath,pathLength,budgetStrokes,closeGaps,bucketRegions,rasterContours};
});
