'use strict';
let worker=null;
const pending=new Map();
function ensureWorker(){
  if(worker)return worker;
  const current=new Worker(chrome.runtime.getURL('browser-ai/worker.js'),{type:'module'});worker=current;
  current.onmessage=({data})=>{if(worker!==current)return;const reply=pending.get(data.id);if(reply){pending.delete(data.id);reply(data);}};
  const failed=event=>{
    if(worker!==current)return;
    current.terminate();worker=null;
    const replies=[...pending.values()];pending.clear();
    for(const reply of replies)reply({ok:false,error:'Browser AI worker interrupted: '+(event.message||'Could not read its response'),retryable:true});
  };
  current.onerror=failed;current.onmessageerror=failed;
  return current;
}
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
  if(msg?.target!=='browser-ai-offscreen'||sender.id!==chrome.runtime.id||sender.tab)return false;
  if(msg.cancel){worker?.postMessage(msg);const reply=pending.get(msg.id);if(reply){pending.delete(msg.id);reply({ok:false,error:'AI request stopped',cancelled:true});}respond({ok:true});return false;}
  try{ensureWorker().postMessage(msg);pending.set(msg.id,respond);return true;}
  catch(error){respond({ok:false,error:'Could not start browser AI: '+error.message,retryable:true});return false;}
});
