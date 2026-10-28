/* Shared preview UI: runs in a content script, extension page, or local viewer. */
(function(root){
  'use strict';
  const E=root.SAGDrawingEngine;
  const PREFERENCE_NAMES=['detector','budget','speed','focus','amplify'];
  const PREFERENCE_PREFIX='sagDrawerPreferences.v1.';
  let preferenceWrites=Promise.resolve();
  async function readPreferences(){
    await preferenceWrites;
    const keys=PREFERENCE_NAMES.map(name=>PREFERENCE_PREFIX+name);
    if(root.chrome?.runtime?.id)return chrome.storage.local.get(keys);
    return Object.fromEntries(keys.map(key=>[key,JSON.parse(localStorage.getItem(key)||'null')]));
  }
  function writePreference(name,value){
    const key=PREFERENCE_PREFIX+name;
    const write=preferenceWrites.catch(()=>{}).then(()=>{
      if(root.chrome?.runtime?.id)return chrome.storage.local.set({[key]:value});
      localStorage.setItem(key,JSON.stringify(value));
    });
    preferenceWrites=write.catch(()=>{});
    return write;
  }
  const STYLE=`
    :host{display:block;color:#1e293b;font:13px/1.45 system-ui,Arial,sans-serif;color-scheme:light}
    *{box-sizing:border-box}[hidden]{display:none!important}button,input,select{font:inherit;color:inherit}button,select,input[type=number]{border:1px solid #b8c6d6;border-radius:6px;padding:6px 9px;background:#fff}
    button{cursor:pointer}button:disabled{opacity:.45;cursor:default}button.primary{background:#2563eb;color:white;border-color:#2563eb}button.stop{background:#dc2626;color:white;border-color:#dc2626}
    .studio{background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:12px;min-width:0}.toolbar,.tabs,.playback{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
    .drop{border:1px dashed #94a3b8;padding:10px;border-radius:8px;margin-bottom:10px;background:white}.drop.over{background:#dbeafe}.drop input{max-width:100%;font-size:12px}
    .auto-row{margin:10px 0}.auto-toggle{display:flex;align-items:center;gap:6px;font-weight:600}.auto-note{font-size:12px;color:#475569;margin-top:4px;overflow-wrap:anywhere}
    .settings{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px;margin:10px 0}.settings label{display:flex;flex-direction:column;gap:3px;min-width:0}.settings select,.settings input{min-width:0;max-width:100%;box-sizing:border-box}.settings input[type=range]{width:100%;accent-color:#2563eb}.settings output{font-variant-numeric:tabular-nums;color:#2563eb}
    .tabs button[aria-selected=true]{background:#0f172a;color:white}.canvas-wrap{position:relative;background:white;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden}.canvas-wrap canvas{display:block;width:100%;height:auto;touch-action:none}.caption{font-size:12px;margin:5px 0 10px;color:#475569}.status{white-space:pre-line;min-height:2em;margin-top:8px}.error{color:#b91c1c}.stats{white-space:pre-line;font-variant-numeric:tabular-nums;background:#e2e8f0;padding:8px;border-radius:6px;margin:8px 0}.playback input[type=range]{flex:1;min-width:70px}
    .compact .settings{grid-template-columns:1fr 1fr}.compact{padding:8px;font-size:11px}.compact button,.compact select{font-size:11px;padding:4px 6px}.compact .tabs{gap:3px}.compact .stats{font-size:11px}.note{font-size:12px;color:#64748b}progress{width:100%;height:10px}summary{cursor:pointer;font-weight:600}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
    .part-editor{padding:10px;border:1px solid #7dd3fc;border-radius:8px;background:#f0f9ff;margin-bottom:8px}.part-editor[hidden]{display:none}.part-editor .toolbar{margin-bottom:6px}.part-editor label{display:flex;flex-wrap:wrap;align-items:center;gap:5px;min-width:0}.part-editor select{max-width:100%;min-width:0}.part-editor input[type=range]{width:125px;max-width:100%;accent-color:#0284c7}.part-editor .part-hint{overflow-wrap:anywhere}.canvas-wrap.editing canvas{cursor:crosshair}
    .source-row{display:flex;gap:12px;align-items:flex-start;margin-bottom:8px}.upload-preview{margin:0;flex:0 0 128px;text-align:center;font-size:11px;color:#64748b}.upload-preview img{display:block;width:128px;height:96px;object-fit:contain;border:1px solid #dbe3ee;border-radius:6px;background:repeating-conic-gradient(#f1f5f9 0% 25%,white 0% 50%) 50%/12px 12px}.upload-preview figcaption{margin-top:4px}.source-tools{flex:1;min-width:0}.source-tools .toolbar{margin-bottom:6px}.subject-note{margin-bottom:10px}
    .workflow{background:#f8fafc;border:1px solid #b8c6d6;border-radius:8px;padding:10px;margin:10px 0}.workflow-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.auto-control{display:flex;align-items:center;gap:6px;min-width:0;border:1px solid #b8c6d6;border-radius:6px;padding:0 8px;background:white}.auto-control.enabled{border-color:#93b4f8;background:#eff6ff}.auto-control input{margin:0;accent-color:#2563eb}.auto-control button{flex:1;min-width:0;border:0;background:none;padding:6px 0}.workflow-adjustments{display:flex;align-items:center;gap:12px;margin-top:8px}.workflow .quick-settings{flex:1;grid-template-columns:1fr;margin:0}.quick-settings label{display:grid;grid-template-columns:auto 1fr 26px;align-items:center;gap:8px}.quick-settings input{grid-column:2;grid-row:1}.quick-settings output{grid-column:3;grid-row:1;text-align:right}.workflow .auto-note{margin-top:6px}.more-settings{margin:8px 0 12px}.more-settings>summary{padding:6px 0;color:#475569}.preview-empty{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px;color:#64748b;background:#f8fafc;pointer-events:none}
    .run-bar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:6px;padding:6px;margin:8px 0;background:#f8fafc;border:1px solid #b8c6d6;border-radius:6px;box-shadow:0 2px 6px #0f172a0a}.run-bar button{min-width:0;white-space:nowrap}.compact .run-bar{gap:5px;padding:5px}.compact .run-bar .primary{flex:1}
    .compact .workflow{padding:8px}.compact .upload-preview{flex-basis:96px}.compact .upload-preview img{width:96px;height:80px}.compact .source-row{gap:8px}.compact .quick-settings{grid-template-columns:1fr}.compact .quick-settings label{grid-template-columns:auto 1fr 22px;gap:6px}
    .subject-control{display:flex;flex-direction:column;justify-content:center;gap:3px;min-width:0;padding:4px 6px;border:1px solid #b8c6d6;border-radius:6px;background:white}.subject-control.enabled{border-color:#93b4f8;background:#eff6ff}.subject-control label{display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px}.subject-control input{margin:0;accent-color:#2563eb}.subject-control button{min-width:0;border:0;background:none;padding:3px 0;white-space:normal}.workflow .focus-settings{grid-template-columns:1fr;margin:8px 0 0}.focus-settings label{flex-direction:row;align-items:center;gap:8px}.focus-settings select{flex:1}.focus-note{font-size:11px;color:#475569;margin-top:4px;overflow-wrap:anywhere}
    .workflow .amplify-controls{display:flex;align-items:center;gap:8px;margin:8px 0 0}.amplify-controls button{flex-shrink:0}.amplify-controls button[aria-pressed=true]{background:#dbeafe;border-color:#93b4f8;color:#1d4ed8}.amplify-controls label{display:grid;grid-template-columns:auto 1fr 24px;gap:6px;align-items:center;flex:1}.amplify-controls label input{grid-column:2;grid-row:1}.amplify-controls label output{grid-column:3;grid-row:1;text-align:right}
  `;
  function send(message){return new Promise((resolve,reject)=>{
    if(!root.chrome?.runtime?.id){reject(new Error('Extension context unavailable. Reload the game page.'));return;}
    chrome.runtime.sendMessage(message,r=>{if(chrome.runtime.lastError)reject(new Error(chrome.runtime.lastError.message));else if(!r?.ok)reject(new Error(r?.error||'No response from extension'));else resolve(r);});
  });}
  async function decode(url){const image=new Image();image.src=url;await image.decode();return image;}
  async function pngMask(url,signal){const image=await decode(url);if(signal?.aborted)throw new DOMException('Stopped','AbortError');const c=document.createElement('canvas');c.width=E.WIDTH;c.height=E.HEIGHT;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,c.width,c.height);const d=ctx.getImageData(0,0,c.width,c.height).data;return Uint8Array.from({length:c.width*c.height},(_,i)=>255-d[i*4]);}
  async function localImage(canvas,{signal,action='aiLineart'}={}){
    const id='ai-'+Date.now()+'-'+Math.random().toString(36).slice(2),request={action,id,image:canvas.toDataURL('image/png')};
    let response;
    if(root.chrome?.runtime?.id){
      const cancel=()=>{send({action:'aiCancel',id}).catch(()=>{});};
      signal?.addEventListener('abort',cancel,{once:true});
      try{response=await send(request);}finally{signal?.removeEventListener('abort',cancel);}
    }else{
      const timedSignal=AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(120000)]);
      const r=await fetch(action==='aiSubject'?'/api/subject':'/api/lineart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:request.image}),signal:timedSignal});
      if(r.status===404&&action==='aiSubject')throw new Error('Restart the updated local Python service to enable subject detection. Mark subject also works without AI.');
      if(!r.ok){const error=await r.json().catch(()=>({}));throw new Error(error.error||'Local AI service failed ('+r.status+')');}
      const blob=await r.blob();response={image:await new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result);f.onerror=reject;f.readAsDataURL(blob);})};
    }
    if(signal?.aborted)throw new DOMException('Stopped','AbortError');
    return response.image;
  }
  async function localAI(canvas,options={}){return pngMask(await localImage(canvas,options),options.signal);}
  function mount(host,options={}){
    const shadow=host.attachShadow({mode:'open'});
    shadow.innerHTML=`<style>${STYLE}</style><section class="studio ${options.compact?'compact':''}">
      <div class="toolbar"><strong>Colors + outlines</strong><button data-act="expand" ${options.compact?'':'hidden'}>Open large viewer</button><button data-act="setup">Local AI setup</button></div>
      <div class="drop"><label>Upload or drop an image <input aria-label="Upload image" type="file" accept="image/*"></label></div>
      <div class="source-row"><figure class="upload-preview" hidden><img alt="Uploaded image thumbnail"><figcaption>Original upload</figcaption></figure><div class="source-tools">
        <div class="toolbar"><button data-act="crop" disabled>Crop on original</button><button data-act="reset" disabled>Reset crop</button></div>
        <div class="toolbar"><button data-act="subject-parts" disabled>Edit subject parts</button><button data-act="subject-mark" disabled>Mark subject</button><button data-act="subject-crop" disabled>Crop to subject</button><button data-act="subject-clear" disabled>Clear subject</button></div>
      </div></div>
      <div class="subject-note note" aria-live="polite">Full image draws large color regions first. Use Find main subject (AI) or Mark subject to prioritize the object. AI needs the optional local foreground model.</div>
      <div class="workflow">
        <div class="workflow-actions"><div class="subject-control"><label><input aria-label="Use main subject" type="checkbox" name="useSubject">Use main subject</label><button data-act="subject-ai" title="Select a subject with local AI; enables Use main subject" disabled>Find main subject (AI)</button></div><div class="auto-control enabled"><input aria-label="Auto settings" type="checkbox" name="auto" checked><button data-act="auto" title="Choose settings for this image" disabled>Auto settings</button></div></div>
        <div class="settings focus-settings"><label>Draw<select name="focus" aria-label="Subject and background"><option value="none">Full image / scenery</option><option value="subject">Subject only (fastest)</option><option value="subject-background">Subject first + simplified background</option></select></label></div>
        <div class="focus-note" aria-live="polite">Full scenery keeps colors and outlines across the image. Subject selection is optional.</div>
        <div class="workflow-adjustments"><div class="settings quick-settings"><label>Outline detail <output aria-hidden="true" data-val="detail">55</output><input aria-label="Outline detail" name="detail" type="range" min="10" max="100" value="55"></label></div></div>
        <div class="settings amplify-controls"><button data-act="amplify" aria-pressed="false" title="Lift dark colors and retain their hue on the game palette; click again to turn off" disabled>Amplify colors</button><label class="amplify-strength" hidden>Strength <output aria-hidden="true" data-val="amplify">0</output><input aria-label="Color amplification" name="amplify" type="range" min="0" max="100" value="0"></label></div>
        <div class="auto-note" aria-live="polite">Choose settings from your image. Adjusting a setting switches to manual and keeps the suggestions.</div>
      </div>
      <div class="run-bar" role="group" aria-label="Drawing actions"><button class="primary" data-act="process" disabled>Process image</button><button class="primary" data-act="draw" ${options.draw?'':'hidden'} disabled>Start drawing</button><button class="stop" data-act="stop">Stop</button></div>
      <details class="more-settings" ${options.compact?'':'open'}><summary>More drawing settings</summary>
      <div class="settings">
        <label>Line detection<select name="detector" aria-label="Line detection"><option value="browser">Browser</option><option value="ai">Informative Drawings AI</option></select></label>
        <label>Drawing target (seconds)<input name="budget" type="number" min="10" max="300" value="60"></label>
        <label>Drawing speed<select name="speed" aria-label="Drawing speed"><option value="fast">Fast — fewer small details</option><option value="balanced">Balanced — retain more detail</option></select></label>
        <label>Drawing treatment<select name="treatment" aria-label="Drawing treatment"><option value="regions">Color regions + black borders</option><option value="light-lines">Light lines on dark background</option></select></label>
        <label>Color filling<select name="fillMode" aria-label="Color filling"><option value="bucket">Closed regions + bucket</option><option value="strokes">Brush strokes</option></select></label>
        <label>Close small gaps (pixels) <output aria-hidden="true" data-val="closeGaps">4</output><input aria-label="Close small gaps" name="closeGaps" type="range" min="0" max="8" value="4"></label>
        <label>Color count <output aria-hidden="true" data-val="colors">6</output><input aria-label="Color count" title="Maximum simplified colors per layer. Similar shades can merge; black outlines can add another drawing color." name="colors" type="range" min="2" max="24" value="6"></label>
        <label>Merge similar colors <output aria-hidden="true" data-val="merge">14</output><input aria-label="Merge similar colors" name="merge" type="range" min="0" max="40" value="14"></label>
        <label>Near-white removal <output aria-hidden="true" data-val="bgThreshold">0</output><input aria-label="Near-white removal" name="bgThreshold" type="range" min="0" max="120" value="0"></label>
      </div></details>
      <div class="tabs" role="tablist" aria-label="Image preview">
        ${[['original','Original'],['subject','Main subject'],['simplified','Simplified colors'],['lines','Detected lines'],['final','Final drawing'],['path','Drawing path']].map(([id,title])=>`<button role="tab" data-view="${id}" aria-selected="${id==='final'}">${title}</button>`).join('')}
      </div>
      <div class="part-editor" hidden>
        <div class="toolbar"><label>Selection action<select name="part-action" aria-label="Selection action"><option value="add">Add to subject</option><option value="remove">Remove from subject</option></select></label><label>Select by<select name="part-method" aria-label="Select by"><option value="region">Connected color part</option><option value="outline">Outline (polygon)</option></select></label></div>
        <div class="toolbar"><label>Part grouping <output data-val="part-similarity">18</output><input name="part-similarity" aria-label="Part grouping" type="range" min="4" max="40" value="18"></label><button data-act="part-apply" hidden disabled>Apply outline</button><button data-act="part-undo" disabled>Undo selection</button><button data-act="part-done">Done selecting</button></div>
        <div class="part-hint note">Hover a part to preview it, then click to add it. Green is selected. Edits use the full image; your crop is kept.</div>
      </div>
      <div class="canvas-wrap"><canvas width="800" height="600" aria-label="Drawing preview"></canvas><div class="preview-empty">Upload an image, then process it to see the drawing here.</div></div>
      <div class="caption">Upload an image, choose full scenery or a subject, then process.</div>
      <div class="playback"><button data-act="play" disabled>Play path</button><input aria-label="Path position" type="range" name="playhead" min="0" max="1000" value="1000"><label><input type="checkbox" name="travel"> Pen-up travel</label></div>
      <progress max="1" value="0" aria-label="Drawing progress"></progress>
      <div class="stats">No drawing plan yet.</div>
      <div class="toolbar"><button data-act="png" disabled>Download preview PNG</button><button data-act="json" disabled>Download plan JSON</button></div>
      <div class="status" role="status" aria-live="polite">Images stay on your device. Choose in-Chrome AI or the Python service in Local AI setup.</div>
      <details><summary>Local AI setup and timing</summary><p>Open Local AI setup to choose Chrome GPU, Chrome CPU, or the Python terminal service. Chrome modes include all three AI models and need no terminal or localhost access. The setup page shows model readiness, a speed test, and Python instructions when that engine is selected. Normal Browser line detection, Auto settings and Mark subject are local algorithms and work without loading AI.</p><p>Find or mark the subject, inspect the green selection, then Process image. Subject only omits the background. Subject first, background later completes the subject’s fills and outlines before optional simplified background strokes. Crop to subject is optional. Full image keeps the original large-region order. Fast merges more tiny color regions and removes more short lines; Balanced keeps more detail.</p><p>Bucket mode seals each color region, including holes, with the smallest brush before using the game’s Fill tool. Standard treatment adds black borders last within each subject layer. Light-lines treatment paints its base first and traces bright ink in white, without black borders or gray antialiasing regions. It suppresses faint grid lines; Outline detail controls how much weaker ink is kept. With AI selected, the model filters bright-ink components instead of adding dark edges. Small gaps joins only nearby line ends pointing toward each other.</p><p>The target is an estimate. Full-image standard fills receive two thirds of the budget and outlines one third. Subject-first planning reserves 80% for the subject; targets below 20 seconds omit background. During drawing, optional background stops starting when the target is exhausted. Light lines use the remaining budget after the required base. Processing and model time are separate. Measured speed updates the estimate without changing processed colors or paths. Full-image optional regions may be skipped to leave time for outlines.</p><p>Playback shows input order, not real-time game speed. Blue arrows indicate fills, blue circles bucket clicks, and red arrows outlines. Gray paths were skipped during execution.</p></details>
    </section>`;
    const $=s=>shadow.querySelector(s),button=act=>$(`[data-act="${act}"]`),canvas=$('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true}),auto=$('[name=auto]');
    let image=null,source=null,crop=null,prepared=null,result=null,preview=null,uploadedThumbnail=null,view='final',cropMode=false,drag=null,controller=null,frame=null,playing=false,generation=0,drawing=false,stopping=null,skipped=[],autoSuggestion=null,subjectFocus='subject';
    let subjectImage=null,subjectSource='manual',subjectModelMs=0,subjectArea=0,subjectMode=false,subjectPoints=[],maskCache=null;
    let partsMode=false,partsIndex=null,partsSimilarity=null,partsSource=null,partsController=null,partsHover=-1,partsOverlay=null,partsFrame=null,partsDirty=false,selectionLayer=null,selectionHistory=[];
    const values=()=>E.settings(Object.fromEntries([...shadow.querySelectorAll('.settings [name]')].map(el=>[el.name,el.value])));
    const editedPreferences=new Set();let destroyed=false;
    const preferencesReady=readPreferences().then(saved=>{
      if(destroyed)return;
      for(const name of PREFERENCE_NAMES){
        if(editedPreferences.has(name))continue;
        const value=saved?.[PREFERENCE_PREFIX+name],el=$(`[name="${name}"]`);
        if(name==='budget'||name==='amplify'){
          if(typeof value==='number'&&Number.isFinite(value))el.value=E.settings({[name]:value})[name];
        }else if([...el.options].some(option=>option.value===value))el.value=value;
      }
      if($('[name=focus]').value!=='none')$('.subject-note').textContent='Subject mode remembered. Process image will find the subject for this image if needed; a previous image’s selection is not reused.';
      updateValues();controls();
    }).catch(()=>{if(!destroyed)status('Could not restore drawer preferences. Current settings still work.',true);});
    function status(text,error=false){
      if(/extension context invalidated/i.test(text)){text='Extension connection expired. Refresh the Skribbl tab, or reopen the large extension viewer, to reconnect.';error=true;}
      $('.status').textContent=text;$('.status').classList.toggle('error',error);
    }
    function controls(){
      const focus=values().focus;
      if(focus!=='none')subjectFocus=focus;
      $('[name=useSubject]').checked=focus!=='none';
      $('.subject-control').classList.toggle('enabled',focus!=='none');
      $('.focus-note').textContent=focus==='none'?'Full scenery keeps colors and outlines across the image. No subject AI runs when processing.':focus==='subject'?'Process image finds the subject if needed, then processes it. Existing selections are kept. Cropping stays manual.':'Background is simplified to at most 3 colors and broad strokes, without outlines. Choose Full image / scenery to retain scene detail.';
      $('.auto-control').classList.toggle('enabled',auto.checked);
      const amplification=values().amplify;
      button('amplify').setAttribute('aria-pressed',String(amplification>0));$('.amplify-strength').hidden=!amplification;
      button('amplify').disabled=!image||!!controller||drawing||!!stopping||subjectMode||partsMode;
      button('auto').disabled=!image||!!controller||drawing||!!stopping||subjectMode||partsMode;
      button('process').disabled=!image||!!controller||drawing||!!stopping||subjectMode||partsMode||!!subjectImage&&!subjectArea&&values().focus!=='none';
      button('draw').disabled=!result||!!controller||drawing||!!stopping||subjectMode||partsMode;
      for(const act of ['crop','reset','subject-ai','subject-mark'])button(act).disabled=!image||drawing||!!controller||partsMode;
      for(const act of ['subject-crop','subject-clear'])button(act).disabled=!subjectImage||drawing||!!controller||partsMode;
      button('subject-crop').disabled||=!subjectArea;
      for(const act of ['png','json','play'])button(act).disabled=!result||partsMode;
      $('[name=playhead]').disabled=!result||partsMode;$('[name=travel]').disabled=!result||partsMode;
      button('subject-parts').disabled=!image||drawing||!!controller&&!partsMode;
      button('part-undo').disabled=!selectionHistory.length||!!controller;
      button('part-apply').disabled=subjectPoints.length<3||!!controller;button('part-apply').hidden=$('[name=part-method]').value!=='outline';
      $('[name=part-similarity]').disabled=$('[name=part-method]').value==='outline';$('.part-editor').setAttribute('aria-busy',String(!!partsController));
    }
    function subjectPixels(full=false){
      if(!subjectImage)return null;const key=full?'source':JSON.stringify(crop);
      if(maskCache?.image===subjectImage&&maskCache.key===key)return maskCache.pixels;
      // Binary masks use nearest-neighbor mapping: Canvas and decoded PNG
      // resampling otherwise disagree at some crop edges after session transfer.
      const c=E.prepareImage(subjectImage,full?null:crop,{smoothing:false}),data=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,800,600).data;
      const pixels=Uint8Array.from({length:800*600},(_,i)=>data[i*4+3]>=128&&data[i*4]>=128?255:0);maskCache={image:subjectImage,key,pixels};return pixels;
    }
    function stopPlayback(){playing=false;if(frame)cancelAnimationFrame(frame);frame=null;button('play').textContent='Play path';}
    function discardPreview(){preview?.dispose();preview=null;}
    function backgroundStop(){Promise.resolve().then(()=>options.stop?.()).catch(error=>status('Stop failed: '+error.message+'. Press Escape or cancel the Chrome debugger bar.',true));}
    function invalidate(){generation++;controller?.abort();controller=null;stopPlayback();if(drawing){backgroundStop();drawing=false;}discardPreview();result=null;skipped=[];$('.stats').textContent='Settings changed — process again.';$('.progress')?.removeAttribute('value');$('progress').value=0;controls();status(image?'Click Process image to apply changes.':'Upload an image to begin.');render();}
    function choose(next){if(next!=='path')stopPlayback();view=next;for(const tab of shadow.querySelectorAll('[data-view]'))tab.setAttribute('aria-selected',String(tab.dataset.view===view));render();}
    function render(){
      $('.preview-empty').hidden=!!result||['original','subject'].includes(view);
      $('.preview-empty').textContent=image?'Process image to see the drawing here.':'Upload an image, then process it to see the drawing here.';
      if(image&&result&&['final','path'].includes(view)){
        if(!preview||preview.plan!==result.plan||preview.strokes!==result.plan.strokes){discardPreview();preview=E.createPlanRenderer(result.plan,()=>document.createElement('canvas'));}
        preview.render(ctx,{fraction:view==='path'?+$('[name=playhead]').value/1000:1,travel:view==='path'&&$('[name=travel]').checked,directions:view==='path',skipped});return;
      }
      ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
      if(!image)return;
      if(view==='original'||view==='subject'){
        ctx.drawImage(cropMode||subjectMode||partsMode?source:(prepared||source),0,0);
        if(view==='subject'&&(subjectImage||partsMode)){
          const key=partsMode?'source':JSON.stringify(crop);
          if(!selectionLayer||selectionLayer.image!==subjectImage||selectionLayer.key!==key){const mask=subjectPixels(partsMode),overlay=ctx.createImageData(800,600);for(let i=0;i<800*600;i++)overlay.data.set(mask?.[i]?[0,200,110,80]:[15,23,42,150],i*4);const temp=document.createElement('canvas');temp.width=800;temp.height=600;temp.getContext('2d').putImageData(overlay,0,0);selectionLayer={image:subjectImage,key,canvas:temp};}
          ctx.drawImage(selectionLayer.canvas,0,0);if(partsMode&&partsOverlay)ctx.drawImage(partsOverlay,0,0);
        }
      }
      else if(result){const pixels=result[view];if(pixels){const temp=document.createElement('canvas');temp.width=pixels.width;temp.height=pixels.height;temp.getContext('2d').putImageData(new ImageData(pixels.data,pixels.width,pixels.height),0,0);ctx.drawImage(temp,0,0);}}
      if(cropMode&&(drag||crop)){const rect=drag?{x:Math.min(drag.a.x,drag.b.x),y:Math.min(drag.a.y,drag.b.y),w:Math.abs(drag.b.x-drag.a.x),h:Math.abs(drag.b.y-drag.a.y)}:crop;ctx.fillStyle='#0f172a55';ctx.fillRect(0,0,800,rect.y);ctx.fillRect(0,rect.y+rect.h,800,600-rect.y-rect.h);ctx.fillRect(0,rect.y,rect.x,rect.h);ctx.fillRect(rect.x+rect.w,rect.y,800-rect.x-rect.w,rect.h);ctx.strokeStyle='#2563eb';ctx.lineWidth=2;ctx.strokeRect(rect.x,rect.y,rect.w,rect.h);}
      if((subjectMode||partsMode)&&subjectPoints.length){ctx.strokeStyle=partsMode&&$('[name=part-action]').value==='remove'?'#ef4444':'#16a34a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(subjectPoints[0].x,subjectPoints[0].y);for(const p of subjectPoints.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();for(const p of subjectPoints){ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();}}
    }
    async function loadURL(url,session){
      endParts();partsIndex=null;partsSource=null;selectionLayer=null;selectionHistory=[];
      const id=++generation;controller?.abort();const own=new AbortController();controller=own;backgroundStop();drawing=false;stopPlayback();discardPreview();uploadedThumbnail=null;$('.upload-preview').hidden=true;$('.upload-preview img').removeAttribute('src');result=null;autoSuggestion=null;subjectMode=false;subjectPoints=[];subjectImage=null;subjectSource='manual';subjectModelMs=0;subjectArea=0;maskCache=null;button('subject-mark').textContent='Mark subject';controls();status('Loading image…');
      try{await preferencesReady;if(id!==generation)return;const decoded=await decode(url);if(id!==generation)return;source=E.prepareImage(decoded);image=await decode(source.toDataURL('image/png'));if(id!==generation)return;crop=session?.crop||null;prepared=E.prepareImage(image,crop);result=null;cropMode=false;
        if(typeof session?.thumbnail==='string'&&session.thumbnail.startsWith('data:image/png;base64,')&&session.thumbnail.length<128*1024)uploadedThumbnail=session.thumbnail;
        else{const thumb=document.createElement('canvas'),scale=Math.min(1,160/decoded.naturalWidth,112/decoded.naturalHeight);thumb.width=Math.max(1,Math.round(decoded.naturalWidth*scale));thumb.height=Math.max(1,Math.round(decoded.naturalHeight*scale));thumb.getContext('2d').drawImage(decoded,0,0,thumb.width,thumb.height);uploadedThumbnail=thumb.toDataURL('image/png');}
        $('.upload-preview img').src=uploadedThumbnail;$('.upload-preview').hidden=false;
        if(session?.settings)for(const el of shadow.querySelectorAll('.settings [name]')){if(session.settings[el.name]!==undefined)el.value=session.settings[el.name];}
        if(session?.editor)for(const key of ['action','method','similarity']){const el=$(`[name=part-${key}]`);if(session.editor[key]!==undefined)el.value=session.editor[key];}
        if(session?.subject?.image){subjectImage=await decode(session.subject.image);if(id!==generation)return;subjectSource=session.subject.method||'manual';subjectModelMs=session.subject.modelMs||0;subjectArea=subjectPixels(true).reduce((n,v)=>n+(v?1:0),0);$('.subject-note').textContent='Main subject restored. Inspect Main subject or adjust the selection.';}
        else $('.subject-note').textContent=$('[name=focus]').value!=='none'?'Subject mode remembered. Process image will find the subject for this image if needed; a previous image’s selection is not reused.':'Full image draws large color regions first. Use Find main subject (AI) or Mark subject to prioritize the object. AI needs the optional local foreground model.';
        auto.checked=session?.auto??(session?.settings?false:auto.checked);autoSuggestion=null;
        controller=null;updateValues();choose('final');$('.caption').textContent='The original upload is above. Choose full scenery or a subject, then Auto settings and Process image.';status('Image loaded. Adjust the crop/settings, then Process image.');controls();
        if(auto.checked)await recommend();else $('.auto-note').textContent='Manual settings. Your current values are kept.';
      }catch(error){if(id===generation)status('Cannot load image: '+error.message,true);}
      finally{if(id===generation&&controller===own){controller=null;controls();}}
    }
    async function loadFile(file){if(!file?.type.startsWith('image/')){status('Choose an image file.',true);return;}if(file.size>32*1024*1024){status('Please use an image smaller than 32 MB.',true);return;}const url=URL.createObjectURL(file);try{await loadURL(url);}finally{URL.revokeObjectURL(url);}}
    function updateValues(){for(const el of shadow.querySelectorAll('[data-val]'))el.textContent=$(`[name="${el.dataset.val}"]`).value;}
    function endSubjectMark(){subjectMode=false;subjectPoints=[];button('subject-mark').textContent='Mark subject';controls();}
    function endParts(){
      partsController?.abort();if(controller===partsController)controller=null;partsController=null;
      partsMode=false;partsDirty=false;partsHover=-1;partsOverlay=null;subjectPoints=[];if(partsFrame)cancelAnimationFrame(partsFrame);partsFrame=null;
      $('.part-editor').hidden=true;$('.canvas-wrap').classList.remove('editing');button('subject-parts').textContent='Edit subject parts';button('subject-parts').setAttribute('aria-expanded','false');controls();
    }
    function partHint(area=0){
      $('.part-hint').textContent=$('[name=part-method]').value==='outline'?'Click points around the part, then Apply outline (Enter). Escape clears the unfinished outline. The action adds to or removes from the existing selection.':
        (area?`${area.toLocaleString()} pixels (${(area/4800).toFixed(1)}% of the full image). Click to ${$('[name=part-action]').value==='remove'?'remove':'add'} this part. `:'Hover a part, then click to add or remove it. ')+
        'Green is selected; cyan previews Add and red previews Remove. Lower Part grouping for smaller groups. Use Outline if colors join the background. Edits use the full image; your crop is kept.';
    }
    async function prepareParts(){
      partsController?.abort();if(controller===partsController)controller=null;partsController=null;
      partsHover=-1;partsOverlay=null;render();partHint();
      if(!partsMode||$('[name=part-method]').value!=='region'){controls();if(partsMode)status('Outline a part, then Apply outline. Your existing selection is kept.');return;}
      const similarity=+$('[name=part-similarity]').value;
      if(partsIndex&&partsSource===source&&partsSimilarity===similarity){controls();status('Parts ready. Hover to inspect a group, then click to edit the subject.');return;}
      partsIndex=null;
      const own=new AbortController(),id=generation,original=source;controller=partsController=own;controls();status('Grouping connected image parts…');
      try{
        const index=await E.segmentParts(source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,800,600),{similarity},{signal:own.signal});
        if(!partsMode||id!==generation||own.signal.aborted||controller!==own)return;
        partsIndex=index;partsSource=original;partsSimilarity=similarity;status('Parts ready. Hover to inspect a group, then click to edit the subject.');
      }catch(error){if(partsMode&&controller===own)status(error.name==='AbortError'?'Part grouping stopped.':error.message,error.name!=='AbortError');}
      finally{if(partsController===own){if(controller===own)controller=null;partsController=null;controls();}}
    }
    function beginParts(){
      if(!image||drawing||controller)return;endSubjectMark();cropMode=false;partsMode=true;partsDirty=false;stopPlayback();
      $('.part-editor').hidden=false;$('.canvas-wrap').classList.add('editing');button('subject-parts').textContent='Close selection editor';button('subject-parts').setAttribute('aria-expanded','true');choose('subject');partHint();controls();prepareParts();
      $('.caption').textContent='Editing the full image selection. Green marks included areas. Done selecting keeps your crop; Process image applies the edited selection.';
    }
    function finishParts(){
      const dirty=partsDirty;endParts();choose('subject');
      if(subjectImage&&!subjectArea)status('Selection is empty. Edit subject parts to add areas, or Clear subject to draw the full image.',true);
      else if(dirty&&auto.checked)recommend();else status(dirty?'Selection updated. Click Process image to redraw it.':'Selection editor closed. Your selection is kept.');
    }
    function hoverPart(p){
      if(!partsMode||controller||$('[name=part-method]').value!=='region'||!partsIndex)return;
      const x=Math.min(799,Math.floor(p.x)),y=Math.min(599,Math.floor(p.y)),id=partsIndex.labels[y*800+x];
      if(id===partsHover)return;partsHover=id;partsOverlay=null;partHint(partsIndex.regions[id]?.area||0);
      if(id>=0){
        const region=partsIndex.regions[id],pixels=ctx.createImageData(800,600),remove=$('[name=part-action]').value==='remove';
        for(let n=region.offset;n<region.offset+region.area;n++){
          const i=partsIndex.pixels[n],x=i%800,y=(i/800)|0,edge=x===0||x===799||y===0||y===599||[i-1,i+1,i-800,i+800].some(q=>partsIndex.labels[q]!==id);
          pixels.data.set(remove?[239,68,68,edge?240:115]:[0,175,255,edge?240:115],i*4);
        }
        partsOverlay=document.createElement('canvas');partsOverlay.width=800;partsOverlay.height=600;partsOverlay.getContext('2d').putImageData(pixels,0,0);
      }
      if(!partsFrame)partsFrame=requestAnimationFrame(()=>{partsFrame=null;if(partsMode)render();});
    }
    function storeSelection(mask,method,modelMs){
      subjectArea=0;
      if(!mask)subjectImage=null;
      else{
        const c=document.createElement('canvas');c.width=800;c.height=600;const context=c.getContext('2d'),pixels=context.createImageData(800,600);
        for(let i=0;i<mask.length;i++){const value=mask[i]?255:0;subjectArea+=value?1:0;pixels.data.set([value,value,value,255],i*4);}context.putImageData(pixels,0,0);subjectImage=c;
      }
      subjectSource=method;subjectModelMs=modelMs;maskCache=null;selectionLayer=null;
    }
    function editSelection(indices){
      if(!partsMode||controller)return;const before=subjectPixels(true),next=before?before.slice():new Uint8Array(800*600),value=$('[name=part-action]').value==='remove'?0:255;let changed=0;
      for(const i of indices)if(next[i]!==value){next[i]=value;changed++;}
      subjectPoints=[];
      if(!changed){controls();render();status('That part already matches the selection.');return;}
      selectionHistory.push({mask:before,method:subjectSource,modelMs:subjectModelMs,focus:$('[name=focus]').value});if(selectionHistory.length>12)selectionHistory.shift();
      storeSelection(next,subjectSource.startsWith('ai')?'ai+manual':'manual-parts',subjectModelMs);
      if($('[name=focus]').value==='none')$('[name=focus]').value='subject';partsDirty=true;autoSuggestion=null;invalidate();
      $('.subject-note').textContent='Subject selection edited. Green marks the included parts. Finish selecting, then Process image. AI selection is preserved except where you add or remove.';
      status(`${changed.toLocaleString()} pixels ${value?'added to':'removed from'} the subject. Undo selection reverses the last edit.`);controls();render();
    }
    function applyPartOutline(){
      if(subjectPoints.length<3)return;const c=document.createElement('canvas');c.width=800;c.height=600;const context=c.getContext('2d');context.fillStyle='white';context.beginPath();context.moveTo(subjectPoints[0].x,subjectPoints[0].y);for(const p of subjectPoints.slice(1))context.lineTo(p.x,p.y);context.closePath();context.fill();
      const draft=context.getImageData(0,0,800,600).data,original=source.getContext('2d').getImageData(0,0,800,600).data,indices=[];
      for(let i=0;i<800*600;i++)if(draft[i*4+3]>=128&&original[i*4+3]>=128)indices.push(i);editSelection(indices);
    }
    async function applySubject(url,method,id,modelMs=0){
      const selected=await decode(url);if(id!==generation)throw new DOMException('Stopped','AbortError');
      if(selected.width!==800||selected.height!==600)throw new Error('Subject mask does not match the uploaded image. Detect or mark it again.');
      const c=document.createElement('canvas');c.width=800;c.height=600;const context=c.getContext('2d',{willReadFrequently:true});context.drawImage(selected,0,0);
      const pixels=context.getImageData(0,0,800,600),original=source.getContext('2d').getImageData(0,0,800,600).data;let area=0;
      for(let i=0;i<800*600;i++){const keep=pixels.data[i*4]>=128&&original[i*4+3]>=128;area+=keep?1:0;pixels.data.set(keep?[255,255,255,255]:[0,0,0,255],i*4);}
      if(area<16)throw new Error('No clear main subject found. Use Mark subject to outline it manually.');
      context.putImageData(pixels,0,0);const image=await decode(c.toDataURL('image/png'));if(id!==generation)throw new DOMException('Stopped','AbortError');
      selectionHistory=[];subjectImage=image;subjectSource=method;subjectModelMs=modelMs;subjectArea=area;maskCache=null;selectionLayer=null;endSubjectMark();if($('[name=focus]').value==='none')$('[name=focus]').value='subject';
      invalidate();autoSuggestion=null;choose('subject');$('.subject-note').textContent=(method==='ai'?'AI subject selected.':'Subject outlined.')+' Green marks the subject. Use Edit subject parts to add missed areas or remove unwanted ones, then Process image. Subject only skips the background; choose Subject first, background later to add it afterward.';
      if(auto.checked){if(!await recommend())return false;}else status('Main subject selected. Click Process image.');controls();return true;
    }
    async function detectSubject(){
      if(!image||drawing)return false;endSubjectMark();if(values().focus==='none')$('[name=focus]').value=subjectFocus;invalidate();const id=generation,own=new AbortController();controller=own;controls();status('Finding main subject with the local AI model…');
      try{const started=performance.now(),url=await(options.subjectAI||((canvas,opts)=>localImage(canvas,{...opts,action:'aiSubject'})))(source,{signal:own.signal}),modelMs=performance.now()-started;if(id!==generation||own.signal.aborted)return false;return await applySubject(url,'ai',id,modelMs);}
      catch(error){if(id===generation)status(error.name==='AbortError'?'Subject detection stopped.':error.message+' Use Mark subject without AI.',error.name!=='AbortError');return false;}
      finally{if(controller===own){controller=null;controls();}}
    }
    async function finishSubject(){
      if(subjectPoints.length<3){status('Click at least three points around the subject, then Finish subject.');return;}
      const c=document.createElement('canvas');c.width=800;c.height=600;const context=c.getContext('2d');context.fillStyle='black';context.fillRect(0,0,800,600);context.fillStyle='white';context.beginPath();context.moveTo(subjectPoints[0].x,subjectPoints[0].y);for(const p of subjectPoints.slice(1))context.lineTo(p.x,p.y);context.closePath();context.fill();
      const id=generation;try{await applySubject(c.toDataURL('image/png'),'manual',id);}catch(error){if(id===generation)status(error.message,true);}
    }
    async function recommend(){
      if(!image||!auto.checked)return false;
      invalidate();autoSuggestion=null;const id=generation,own=new AbortController();controller=own;controls();
      $('.auto-note').textContent='Choosing settings for this image…';status('Choosing image settings…');
      try{
        const pixels=prepared.getContext('2d',{willReadFrequently:true}).getImageData(0,0,800,600),mask=subjectPixels();
        if(mask&&values().focus!=='none')for(let i=0;i<mask.length;i++)if(!mask[i])pixels.data[i*4+3]=0;
        const suggestion=await E.suggestSettings(pixels,values(),{signal:own.signal});
        if(id!==generation||own.signal.aborted||!auto.checked)return false;
        for(const [key,value]of Object.entries(suggestion.settings)){const el=$(`.settings [name="${key}"]`);if(el)el.value=value;}
        autoSuggestion=suggestion;updateValues();$('.auto-note').textContent=suggestion.reason+' You can tweak any setting.';
        status('Auto settings ready. Click Process image.');return true;
      }catch(error){if(id===generation){$('.auto-note').textContent=error.name==='AbortError'?'Auto settings stopped.':error.message;status(error.name==='AbortError'?'Stopped.':error.message,error.name!=='AbortError');}return false;}
      finally{if(id===generation){controller=null;controls();}}
    }
    function summarize(){const p=result.plan,m=p.metrics;$('.stats').textContent=`Color target ${p.settings.colors} · ${p.sourceColors} simplified colors · ${m.colors} drawing colors\n${m.strokes} strokes · ${m.buckets} bucket clicks · ${m.moves} moves · ${m.colorChanges} color changes\nProcessing ${(p.processingMs/1000).toFixed(2)}s · line AI ${((p.modelMs||0)/1000).toFixed(2)}s · subject AI ${((p.subjectModelMs||0)/1000).toFixed(2)}s · drawing estimate ${((p.timing?.estimatedMs??m.estimatedMs)/1000).toFixed(1)}s\n${p.closedGaps} small line gaps closed. Budget omitted ${p.omitted.fills} fills and ${p.omitted.outlines} small outlines.${p.focus?'\nSubject first: '+p.focus.subjectOperations+' operations; optional background: '+p.focus.backgroundOperations+'.':''}`;}
    async function process(){
      if(!image||drawing||partsMode||subjectMode||controller||stopping)return;
      if(values().focus!=='none'&&!subjectImage&&!await detectSubject())return;
      if(auto.checked&&!autoSuggestion&&!await recommend())return;
      controller?.abort();const own=new AbortController();controller=own;const id=++generation;discardPreview();result=null;stopPlayback();controls();
      try{
        cropMode=false;prepared=E.prepareImage(image,crop);const opts=values();
        // Keep the processing plan identical in the panel and standalone viewer.
        // A previous slow draw must never silently remove colors on reprocess.
        let lineMask=null,modelMs=0;
        if(opts.detector==='ai'){status('Running local AI model…');const started=performance.now();lineMask=await(options.ai||localAI)(prepared,{signal:own.signal});modelMs=performance.now()-started;}
        const pixels=prepared.getContext('2d',{willReadFrequently:true}).getImageData(0,0,800,600);
        const next=await E.processRGBA(pixels,opts,{signal:own.signal,lineMask,subjectMask:subjectPixels(),subjectSource,onStage:stage=>{if(id===generation)status(stage+'…');}});
        if(root.chrome?.storage?.local){const stored=await chrome.storage.local.get('sagEventMs');if(stored.sagEventMs)next.plan.timing={eventMs:stored.sagEventMs,estimatedMs:E.metrics(next.plan.strokes,stored.sagEventMs).estimatedMs};}
        if(id!==generation||own.signal.aborted)return;
        result=next;result.plan.modelMs=modelMs;result.plan.subjectModelMs=opts.focus==='none'?0:subjectModelMs;result.plan.crop=crop;if(auto.checked&&autoSuggestion)result.plan.auto=autoSuggestion;skipped=[];summarize();choose('final');status(result.plan.strokes.length?'Ready. Inspect Drawing path or start drawing.':'No drawable strokes found. Try increasing outline detail, changing the crop, or switching detection.');
        $('.caption').textContent=result.plan.focus?'The subject’s fills and outlines come first. Background strokes stay outside the subject and run only if enabled and time remains.':result.plan.settings.treatment==='light-lines'?'Preview uses one background layer and continuous white strokes. Faint grid lines are suppressed; no black borders are added.':'Preview uses the planned boundaries, bucket clicks and brush widths. Black borders are drawn last.';
      }catch(error){if(id===generation)status(error.name==='AbortError'?'Processing stopped.':error.message+' Browser mode is available in Line detection.',error.name!=='AbortError');}
      finally{if(id===generation){controller=null;controls();button('draw').disabled=!result?.plan.strokes.length;}}
    }
    function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    function pointer(event){const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(800,(event.clientX-r.left)*800/r.width)),y:Math.max(0,Math.min(600,(event.clientY-r.top)*600/r.height))};}
    canvas.addEventListener('pointerdown',event=>{
      if(partsMode){
        event.preventDefault();event.stopPropagation();if(controller||event.button!==0)return;const p=pointer(event);
        if($('[name=part-method]').value==='outline'){
          if(subjectPoints.length>=3&&Math.hypot(p.x-subjectPoints[0].x,p.y-subjectPoints[0].y)<10){applyPartOutline();return;}
          subjectPoints.push(p);controls();render();
        }else if(partsIndex){hoverPart(p);const region=partsIndex.regions[partsHover];if(region)editSelection(partsIndex.pixels.subarray(region.offset,region.offset+region.area));}
        return;
      }
      if(subjectMode){event.preventDefault();event.stopPropagation();const p=pointer(event);if(subjectPoints.length>=3&&Math.hypot(p.x-subjectPoints[0].x,p.y-subjectPoints[0].y)<10){finishSubject();return;}subjectPoints.push(p);render();return;}
      if(!cropMode||!image)return;event.preventDefault();event.stopPropagation();const p=pointer(event);drag={a:p,b:p};canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove',event=>{if(partsMode){hoverPart(pointer(event));return;}if(!drag)return;drag.b=pointer(event);render();});
    canvas.addEventListener('pointerleave',()=>{if(partsMode){partsHover=-1;partsOverlay=null;partHint();render();}});
    canvas.addEventListener('pointerup',event=>{if(!drag)return;drag.b=pointer(event);const {a,b}=drag;drag=null;if(Math.abs(a.x-b.x)>=8&&Math.abs(a.y-b.y)>=8){crop={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)};cropMode=false;prepared=E.prepareImage(image,crop);if(auto.checked)recommend();else invalidate();$('.caption').textContent='Crop applied. Click Process image.';}else render();});
    canvas.addEventListener('pointercancel',()=>{drag=null;render();});
    $('input[type=file]').addEventListener('change',event=>loadFile(event.target.files[0]));
    const drop=$('.drop');for(const event of ['dragover','drop'])shadow.addEventListener(event,e=>{e.preventDefault();e.stopPropagation();drop.classList.toggle('over',event==='dragover');if(event==='drop')loadFile(e.dataTransfer.files[0]);});shadow.addEventListener('dragleave',()=>drop.classList.remove('over'));
    const colorRegionSettings={colors:'Color count',merge:'Merge similar colors',bgThreshold:'Near-white removal'};
    function savePreference(name){
      editedPreferences.add(name);
      writePreference(name,values()[name]).catch(error=>{if(!destroyed)status('Could not save drawer preferences: '+error.message,true);});
    }
    for(const el of shadow.querySelectorAll('.settings [name]'))el.addEventListener('input',()=>{
      if(PREFERENCE_NAMES.includes(el.name))savePreference(el.name);
      if(partsMode)endParts();
      const switchTreatment=$('[name=treatment]').value==='light-lines'&&Object.hasOwn(colorRegionSettings,el.name);
      if(switchTreatment)$('[name=treatment]').value='regions';
      auto.checked=false;
      $('.auto-note').textContent=switchTreatment?`Manual settings. ${colorRegionSettings[el.name]} uses color regions, so Drawing treatment changed to Color regions + black borders. Your other values are kept.`:autoSuggestion?'Manual settings. Auto suggestions are kept; only your edited value changed.':'Manual settings. Your current values are kept.';
      updateValues();invalidate();
    });
    $('[name=useSubject]').addEventListener('change',event=>{
      const enabled=event.currentTarget.checked;
      if(partsMode)endParts();endSubjectMark();cropMode=false;
      $('[name=focus]').value=enabled?subjectFocus:'none';savePreference('focus');autoSuggestion=null;
      if(auto.checked&&image)recommend();else invalidate();
      $('.subject-note').textContent=values().focus==='none'?'Full image / scenery selected. The subject mask is ignored; use Reset crop if you also want to remove an existing crop.':subjectImage?'Subject selection enabled. Inspect Main subject before processing.':'Subject selection enabled. Process image will find the subject automatically. You can also Mark subject without AI.';
      choose(subjectImage&&values().focus!=='none'?'subject':'final');
    });
    auto.addEventListener('change',()=>{if(partsMode)endParts();if(auto.checked&&image)recommend();else{invalidate();$('.auto-note').textContent=auto.checked?'Auto will choose settings when you upload an image.':'Manual settings. Your current values are kept.';}});
    button('auto').addEventListener('click',()=>{if(!image||drawing||controller)return;auto.checked=true;recommend();});
    button('amplify').addEventListener('click',()=>{const input=$('[name=amplify]');input.value=+input.value>0?0:70;input.dispatchEvent(new Event('input',{bubbles:true}));});
    for(const tab of shadow.querySelectorAll('[data-view]'))tab.addEventListener('click',()=>{endSubjectMark();if(partsMode)finishParts();cropMode=false;choose(tab.dataset.view);});
    button('process').addEventListener('click',process);
    button('subject-parts').addEventListener('click',()=>{if(partsMode)finishParts();else beginParts();});
    button('part-done').addEventListener('click',finishParts);
    button('part-apply').addEventListener('click',applyPartOutline);
    button('part-undo').addEventListener('click',()=>{
      if(!partsMode||controller)return;const previous=selectionHistory.pop();if(!previous)return;
      storeSelection(previous.mask,previous.method,previous.modelMs);$('[name=focus]').value=previous.focus;partsDirty=true;subjectPoints=[];autoSuggestion=null;invalidate();controls();partHint();status('Last selection edit undone. Finish selecting, then Process image.');
    });
    $('[name=part-similarity]').addEventListener('input',()=>{updateValues();if(partsMode)prepareParts();});
    $('[name=part-method]').addEventListener('change',()=>{subjectPoints=[];if(partsMode)prepareParts();});
    $('[name=part-action]').addEventListener('change',()=>{subjectPoints=[];partsHover=-1;partsOverlay=null;partHint();controls();render();});
    button('subject-ai').addEventListener('click',detectSubject);
    button('subject-mark').addEventListener('click',()=>{if(subjectMode){finishSubject();return;}invalidate();cropMode=false;subjectMode=true;subjectPoints=[];button('subject-mark').textContent='Finish subject';controls();choose('original');$('.caption').textContent='Click points around the main subject. Close the outline by clicking its first point, or click Finish subject. Escape cancels.';canvas.focus();});
    canvas.tabIndex=0;canvas.addEventListener('keydown',event=>{
      if(partsMode){
        if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();button('part-undo').click();}
        else if(event.key==='Escape'){event.preventDefault();if(subjectPoints.length){subjectPoints=[];controls();render();}else finishParts();}
        else if(event.key==='Enter'&&$('[name=part-method]').value==='outline'){event.preventDefault();applyPartOutline();}return;
      }
      if(!subjectMode)return;if(event.key==='Escape'){endSubjectMark();render();status('Subject outline cancelled.');}else if(event.key==='Enter')finishSubject();
    });
    button('subject-clear').addEventListener('click',()=>{subjectImage=null;subjectModelMs=0;subjectArea=0;maskCache=null;selectionLayer=null;selectionHistory=[];endSubjectMark();$('[name=focus]').value='none';$('.subject-note').textContent='Subject cleared. Full image uses the original area/color order.';if(auto.checked)recommend();else invalidate();choose('original');});
    button('subject-crop').addEventListener('click',()=>{
      const c=document.createElement('canvas');c.width=800;c.height=600;const context=c.getContext('2d');context.drawImage(subjectImage,0,0);const pixels=context.getImageData(0,0,800,600).data;let left=800,top=600,right=0,bottom=0;
      for(let i=0;i<800*600;i++)if(pixels[i*4]>=128){left=Math.min(left,i%800);top=Math.min(top,Math.floor(i/800));right=Math.max(right,i%800+1);bottom=Math.max(bottom,Math.floor(i/800)+1);}
      const margin=Math.max(12,Math.max(right-left,bottom-top)*.06),x=Math.max(0,left-margin),y=Math.max(0,top-margin);crop={x,y,w:Math.min(800,right+margin)-x,h:Math.min(600,bottom+margin)-y};endSubjectMark();cropMode=false;prepared=E.prepareImage(image,crop);if(auto.checked)recommend();else invalidate();choose('subject');
    });
    button('crop').addEventListener('click',()=>{endSubjectMark();cropMode=true;choose('original');$('.caption').textContent='Drag a rectangle over the subject. The crop keeps its aspect ratio.';});
    button('reset').addEventListener('click',()=>{endSubjectMark();crop=null;cropMode=false;prepared=E.prepareImage(image);if(auto.checked)recommend();else invalidate();choose('original');});
    function stop(){
      if(stopping)return stopping;
      const id=++generation,wasDrawing=drawing;
      controller?.abort();controller=null;endParts();endSubjectMark();stopPlayback();
      status(wasDrawing?'Stopping drawing…':'Stopped.');controls();render();
      // Keep Start disabled until release/detach is acknowledged. Surface errors
      // instead of saying Stopped while a background command is still running.
      let cleanup;try{cleanup=options.stop?.();}catch(e){cleanup=Promise.reject(e);}
      stopping=Promise.resolve(cleanup).then(()=>{if(id===generation)status('Stopped.');},e=>{if(id===generation)status('Stop failed: '+e.message+'. Press Escape or cancel the Chrome debugger bar.',true);}).finally(()=>{stopping=null;if(id===generation){drawing=false;controls();render();}});
      return stopping;
    }
    button('stop').title='Stop drawing (Escape)';
    button('stop').addEventListener('click',stop);
    // A held drawing drag can retarget user input to the game canvas. Detect
    // Stop by its visible coordinates in capture phase, before game handlers.
    const capturedStop=event=>{
      if(!drawing)return;
      const r=button('stop').getBoundingClientRect();
      if(!r.width||!r.height||event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)return;
      if(event.type==='pointermove'&&!(event.buttons&1))return;
      if(event.type!=='pointermove'&&event.button!==0)return;
      event.preventDefault();event.stopImmediatePropagation();stop();
    };
    const stopEvents=['pointerdown','mousedown','pointerup','mouseup','pointermove'];
    for(const type of stopEvents)document.addEventListener(type,capturedStop,true);
    button('play').addEventListener('click',()=>{
      if(playing){stopPlayback();return;}if(!result)return;const el=$('[name=playhead]');if(+el.value===1000)el.value=0;choose('path');playing=true;button('play').textContent='Pause path';
      // Retain fractional progress instead of rounding it through the range
      // control each frame. After a busy/background frame, resume gently rather
      // than jumping far ahead to catch up with wall-clock time.
      let last=performance.now(),position=+el.value;function tick(now){if(!playing)return;position=Math.min(1000,position+Math.min(now-last,50)/12);el.value=position;last=now;render();if(position>=1000)stopPlayback();else frame=requestAnimationFrame(tick);}frame=requestAnimationFrame(tick);
    });
    $('[name=playhead]').addEventListener('input',()=>{stopPlayback();choose('path');});$('[name=travel]').addEventListener('change',()=>choose('path'));
    button('png').addEventListener('click',()=>{if(!result)return;const c=document.createElement('canvas');c.width=800;c.height=600;E.renderPlan(c.getContext('2d'),result.plan);c.toBlob(blob=>download(blob,'drawing-preview.png'));});
    button('json').addEventListener('click',()=>{if(result)download(new Blob([JSON.stringify(result.plan,null,2)],{type:'application/json'}),'drawing-plan.json');});
    const session=()=>{let subject=null;if(subjectImage){const c=document.createElement('canvas');c.width=800;c.height=600;c.getContext('2d').drawImage(subjectImage,0,0);subject={image:c.toDataURL('image/png'),method:subjectSource,modelMs:subjectModelMs};}return {source:source?.toDataURL('image/png')||null,thumbnail:uploadedThumbnail,crop,settings:values(),auto:auto.checked,subject,editor:{action:$('[name=part-action]').value,method:$('[name=part-method]').value,similarity:+$('[name=part-similarity]').value}};};
    button('expand').addEventListener('click',()=>{send({action:'openStudio',session:session()}).catch(e=>status(e.message,true));});
    button('setup').addEventListener('click',async()=>{
      try{
        if(root.chrome?.runtime?.id)await send({action:'openStudio',session:session(),setup:true});else root.open('/ai-setup.html','_blank');
        status('AI setup opened. Choose in-Chrome GPU, in-Chrome CPU, or the Python terminal service there.');
      }catch(e){status('Could not open AI setup: '+e.message,true);}
    });
    button('draw').addEventListener('click',async()=>{
      if(!result||drawing||stopping||!options.draw)return;const plan=result.plan,id=++generation;drawing=true;stopPlayback();controls();status(plan.focus?'Drawing main subject first…':plan.settings.treatment==='light-lines'?'Drawing background, then white lines…':'Drawing color fills, then black outlines…');
      try{await options.draw(plan,progress=>{if(id!==generation)return;skipped=progress.skipped||[];$('progress').value=progress.fraction;$('[name=playhead]').value=Math.round((progress.previewFraction??progress.fraction)*1000);status(`${progress.stage} · ${progress.completed}/${plan.strokes.length} steps · ${skipped.length} skipped fills`);if(view==='path')render();});if(id===generation)status(`Drawing complete. ${skipped.length} optional fills skipped.`);}
      catch(e){if(id===generation)status(e.message,e.name!=='AbortError');}
      finally{if(id===generation){drawing=false;controls();render();}}
    });
    controls();render();
    return {ready:preferencesReady,loadFile,loadSession:async s=>{if(s?.source)await loadURL(s.source,s);},getSession:session,getPlan:()=>result?.plan||null,stop,destroy:()=>{destroyed=true;generation++;controller?.abort();endParts();stopPlayback();discardPreview();for(const type of stopEvents)document.removeEventListener(type,capturedStop,true);Promise.resolve(options.stop?.()).catch(()=>{});shadow.innerHTML='';}};
  }
  root.SAGDrawerStudio={mount,localAI,send};
})(globalThis);
