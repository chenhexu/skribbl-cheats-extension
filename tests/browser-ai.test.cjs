const {test}=require('node:test'),assert=require('node:assert/strict'),Bridge=require('../browser-ai/bridge');
function fixture(){
  let saved={},exists=false,created=0,closed=0,release;const calls=[];
  const chrome={storage:{local:{get:async()=>saved,set:async patch=>Object.assign(saved,patch)}},offscreen:{hasDocument:async()=>exists,createDocument:async request=>{created++;calls.push(request);await new Promise(resolve=>release=resolve);exists=true;},closeDocument:async()=>{closed++;exists=false;}},runtime:{sendMessage:async msg=>{calls.push(msg);return {ok:true,matches:[]};}}};
  return {bridge:new Bridge(chrome),chrome,calls,release:()=>release(),counts:()=>({created,closed}),saved:()=>saved};
}
test('browser engine choice is validated, saved, and leaves Python as the legacy default',async()=>{
  const f=fixture();assert.equal(await f.bridge.mode(),'python');await assert.rejects(f.bridge.configure('remote'),/Choose/);
  assert.deepEqual(f.saved(),{});await f.bridge.configure('gpu');assert.equal(await f.bridge.mode(),'gpu');assert.equal(f.saved()['sagAIBackend.v1'],'gpu');
});
test('concurrent browser requests create one offscreen worker document and use fixed packaged assets',async()=>{
  const f=fixture(),signal=new AbortController().signal;
  const a=f.bridge.request({action:'aiWordSearch',id:'one'},'cpu',signal),b=f.bridge.request({action:'aiHealth',id:'two'},'cpu',signal);
  await new Promise(setImmediate);assert.equal(f.counts().created,1);f.release();await Promise.all([a,b]);
  assert.equal(f.calls[0].url,'browser-ai/offscreen.html');assert.deepEqual(f.calls[0].reasons,['WORKERS']);
  assert.ok(f.calls.slice(1).every(msg=>msg.target==='browser-ai-offscreen'&&msg.mode==='cpu'));
  await f.bridge.configure('python');assert.equal(f.counts().closed,1);
});
test('cancellation before document creation ends cannot launch an inference',async()=>{
  const f=fixture(),controller=new AbortController(),pending=f.bridge.request({action:'aiSubject',id:'old'},'gpu',controller.signal);
  await new Promise(setImmediate);controller.abort();f.release();await assert.rejects(pending,{name:'AbortError'});assert.equal(f.calls.length,1);
});
test('active cancellation reaches the worker and a late successful response is ignored',async()=>{
  const f=fixture();let finish;f.chrome.runtime.sendMessage=msg=>{f.calls.push(msg);return msg.cancel?Promise.resolve({ok:true}):new Promise(resolve=>finish=resolve);};
  const controller=new AbortController(),pending=f.bridge.request({action:'aiWordSearch',id:'stale'},'cpu',controller.signal);
  await new Promise(setImmediate);f.release();await new Promise(setImmediate);controller.abort();finish({ok:true,matches:[{word:'late',score:1}]});await assert.rejects(pending,{name:'AbortError'});
  assert.ok(f.calls.some(msg=>msg.cancel&&msg.id==='stale'));
});
