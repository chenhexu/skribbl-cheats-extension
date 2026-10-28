'use strict';
const worker=new Worker(chrome.runtime.getURL('browser-ai/worker.js'),{type:'module'}),pending=new Map();
worker.onmessage=({data})=>{const reply=pending.get(data.id);if(reply){pending.delete(data.id);reply(data);}};
worker.onerror=event=>{for(const reply of pending.values())reply({ok:false,error:'Browser AI worker failed: '+event.message});pending.clear();};
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
  if(msg?.target!=='browser-ai-offscreen'||sender.id!==chrome.runtime.id||sender.tab)return false;
  if(msg.cancel){worker.postMessage(msg);const reply=pending.get(msg.id);if(reply){pending.delete(msg.id);reply({ok:false,error:'AI request stopped',cancelled:true});}respond({ok:true});return false;}
  pending.set(msg.id,respond);worker.postMessage(msg);return true;
});
