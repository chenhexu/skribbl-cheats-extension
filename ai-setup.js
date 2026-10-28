'use strict';
const $=selector=>document.querySelector(selector),extension=!!globalThis.chrome?.runtime?.id;
let mode='python',generation=0,pollTimer=null,activeId=null;
$('#backend').value=mode;$('#backend').disabled=true;$('#prepare').disabled=true;
const deviceName=device=>({wasm:'Chrome CPU',webgpu:'Chrome GPU',cpu:'CPU',cuda:'CUDA GPU'})[device]||device||'local';
const descriptions={gpu:'Chrome runs the AI models on your GPU. No terminal or Python service is needed. GPU support depends on your browser and graphics driver.',cpu:'Chrome runs the AI models on your CPU. No terminal or Python service is needed. This also works when Chrome cannot access a GPU.',python:'The extension connects to your existing local Python service. Keep its terminal running while using AI.'};
async function send(message){
  if(!extension){if(['aiHealth','aiPrepare'].includes(message.action)){const response=await fetch('/health');if(!response.ok)throw Error('The Python service did not respond');return {ok:true,health:await response.json()};}throw Error('Open AI setup from the installed extension to choose an in-Chrome engine.');}
  const response=await chrome.runtime.sendMessage(message);if(!response?.ok)throw Error(response?.error||'The extension did not respond');return response;
}
async function allowBrowserAI(){
  if(extension&&!await chrome.permissions.request({permissions:['offscreen']}))throw Error('In-Chrome AI access was not granted. Allow it here to load browser models, or choose Python service.');
}
function status(message,error=false){$('#status').textContent=message;$('#status').classList.toggle('error',error);}
function selection(){
  $('#description').textContent=descriptions[mode];$('#terminal-help').hidden=mode!=='python';$('#browser-help').hidden=mode==='python';
  $('#prepare').textContent=mode==='python'?'Check terminal service':'Load AI models';$('#unload').hidden=mode==='python';$('#benchmark').disabled=true;$('#benchmark-result').textContent='';
  for(const id of ['words','subject','lines'])$('#'+id+'-state').textContent='Not loaded / checked';
}
function featureState(value){return value?.ready?'Ready · '+deviceName(value.device):value?.warming?'Loading…':value?.error?'Unavailable: '+value.error:'Not loaded';}
function render(health){
  $('#words-state').textContent=featureState(health.wordSearch);$('#subject-state').textContent=featureState(health.subject);$('#lines-state').textContent=featureState({ready:health.ready,device:health.device,error:health.error,warming:health.lines?.warming});$('#benchmark').disabled=!health.wordSearch?.ready;
}
async function check(id=generation){const response=await send({action:'aiHealth',id:crypto.randomUUID()});if(id===generation)render(response.health);return response.health;}
$('#backend').addEventListener('change',async()=>{
  const requested=$('#backend').value,id=++generation;clearTimeout(pollTimer);
  $('#backend').disabled=true;$('#prepare').disabled=true;$('#benchmark').disabled=true;
  try{if(requested!=='python')await allowBrowserAI();await send({action:'aiConfigure',mode:requested});if(id!==generation)return;mode=requested;selection();status('Choice saved. '+(mode==='python'?'Start the terminal service, then check its connection.':'Click Load AI models to prepare this engine.'));}
  catch(error){$('#backend').value=mode;status(error.message,true);}
  finally{if(id===generation){$('#backend').disabled=!extension;$('#prepare').disabled=false;}}
});
$('#prepare').addEventListener('click',async()=>{
  const id=++generation;activeId=crypto.randomUUID();$('#prepare').disabled=true;$('#backend').disabled=true;
  try{
    if(mode!=='python')await allowBrowserAI();
    if(mode==='python'&&extension&&!await chrome.permissions.request({origins:['http://127.0.0.1:8765/*']}))throw Error('Python service access was not granted. In-Chrome modes do not need this permission.');
    status(mode==='python'?'Checking the terminal service…':'Loading packaged AI models. You can see each model’s progress below…');
    const poll=async()=>{try{await check(id);}catch{}if(id===generation)pollTimer=setTimeout(poll,700);};
    if(mode!=='python')poll();
    const response=await send({action:'aiPrepare',id:activeId});if(id!==generation)return;clearTimeout(pollTimer);render(response.health);
    const health=response.health,all=health.wordSearch?.ready&&health.subject?.ready&&health.ready;
    status(all?'All three AI features are ready. Return to Skribbl to use them.':mode==='python'?'Connected. Check the model states below; install missing models and restart the service.':'Check the model states below. If a GPU model is unavailable, choose Chrome CPU or Python service.',!all);
  }catch(error){if(id===generation)status(mode==='python'&&/failed to fetch|networkerror|did not respond/i.test(error.message)?'Cannot connect to the Python service at 127.0.0.1:8765. Start it with the command above, or choose an in-Chrome engine.':error.message,true);}
  finally{if(id===generation){clearTimeout(pollTimer);activeId=null;$('#prepare').disabled=false;$('#backend').disabled=!extension;}}
});
$('#unload').addEventListener('click',async()=>{
  generation++;clearTimeout(pollTimer);try{if(activeId)await send({action:'aiCancel',id:activeId});await send({action:'aiUnload'});activeId=null;selection();$('#prepare').disabled=false;$('#backend').disabled=!extension;status('Browser models unloaded. Load them again before using AI.');}catch(error){status(error.message,true);}
});
$('#benchmark').addEventListener('click',async()=>{
  $('#benchmark').disabled=true;const id=generation;
  try{
    const candidates=['apple','bread','pizza','chair','animal','reindeer','mantis','dolphin','fish','tail','bear trap','machine gun','spotify','redstone','flower','car','airplane'];
    const times=[];let device='';for(const query of ['food','animal','ocean']){const start=performance.now(),result=await send({action:'aiWordSearch',id:crypto.randomUUID(),query,candidates});if(id!==generation)return;times.push(performance.now()-start);device=result.device||'local';}
    $('#benchmark-result').textContent='Warm word search: '+Math.round(times.sort((a,b)=>a-b)[1])+' ms median across 3 queries, including extension messaging ('+deviceName(device)+'). Actual typing also uses a 200 ms debounce.';
  }catch(error){if(id===generation)$('#benchmark-result').textContent=error.message;}
  finally{if(id===generation)$('#benchmark').disabled=false;}
});
$('#copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#command').textContent);$('#copy').textContent='Copied';}catch{const range=document.createRange();range.selectNodeContents($('#command'));getSelection().removeAllRanges();getSelection().addRange(range);$('#copy').textContent='Press Ctrl+C';}});
(async()=>{
  const session=new URLSearchParams(location.search).get('session');if(session)$('#viewer').href+='?session='+encodeURIComponent(session);
  try{if(extension)mode=(await send({action:'aiConfiguration'})).mode;$('#backend').value=mode;selection();$('#backend').disabled=!extension;$('#prepare').disabled=false;status(extension?'Choose an engine, then load or check its models.':'This is the local development viewer. Open AI setup from the installed extension for in-Chrome AI; this page can check the terminal service.');
    if(extension&&mode!=='python'){const id=generation,refresh=async()=>{try{const health=await check(id);if(id===generation&&health.wordSearch?.warming)pollTimer=setTimeout(refresh,700);}catch{}};refresh();}
  }
  catch(error){status(error.message,true);}
  try{const adapter=await navigator.gpu?.requestAdapter();$('#gpu').textContent=adapter?'Chrome GPU access is available. Use the speed test to measure performance on this device.':'Chrome GPU access is unavailable. Choose Chrome CPU or the Python service.';}
  catch{$('#gpu').textContent='Could not check Chrome GPU support. Chrome CPU and Python service remain available.';}
})();
window.addEventListener('pagehide',()=>{generation++;clearTimeout(pollTimer);if(activeId&&extension)chrome.runtime.sendMessage({action:'aiCancel',id:activeId}).catch(()=>{});});
