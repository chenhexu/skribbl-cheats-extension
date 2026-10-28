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

test('an interrupted offscreen message retries once without changing the selected engine',async()=>{
  const f=fixture();let attempts=0;
  f.chrome.runtime.sendMessage=async msg=>{f.calls.push(msg);if(++attempts===1)throw Error('A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received');return {ok:true,matches:[{word:'guitar',score:.8}]};};
  const pending=f.bridge.request({action:'aiWordSearch',id:'retry'},'cpu',new AbortController().signal);await new Promise(setImmediate);f.release();
  assert.equal((await pending).matches[0].word,'guitar');assert.equal(attempts,2);assert.ok(f.calls.slice(1).every(msg=>msg.mode==='cpu'));
});

test('a failed worker is retried once, while model errors never trigger a retry',async()=>{
  const f=fixture();let attempts=0;
  f.chrome.runtime.sendMessage=async()=>{attempts++;return {ok:false,error:'Worker interrupted',retryable:true};};
  const pending=f.bridge.request({action:'aiWordSearch',id:'worker'},'cpu',new AbortController().signal);await new Promise(setImmediate);f.release();
  await assert.rejects(pending,{code:'AI_CONNECTION_LOST'});assert.equal(attempts,2);
  attempts=0;f.chrome.runtime.sendMessage=async()=>{attempts++;return {ok:false,error:'GPU memory exhausted'};};
  await assert.rejects(f.bridge.request({action:'aiWordSearch',id:'model'},'gpu',new AbortController().signal),/GPU memory/);assert.equal(attempts,1);
});

test('closing an offscreen document during its creation retries the cold request',async()=>{
  const f=fixture();let creates=0;
  f.chrome.offscreen.createDocument=async()=>{if(++creates===1)throw Error('Offscreen document closed before fully loading.');};
  const response=await f.bridge.request({action:'aiWordSearch',id:'cold'},'cpu',new AbortController().signal);
  assert.equal(response.ok,true);assert.equal(creates,2);
});

test('cancelling an unresponsive worker settles the request immediately',async()=>{
  const f=fixture();f.chrome.runtime.sendMessage=msg=>msg.cancel?Promise.resolve({ok:true}):new Promise(()=>{});
  const controller=new AbortController(),pending=f.bridge.request({action:'aiWordSearch',id:'hang'},'cpu',controller.signal);
  await new Promise(setImmediate);f.release();await new Promise(setImmediate);controller.abort();await assert.rejects(pending,{name:'AbortError'});
});

test('offscreen worker failure answers pending callers and replaces the worker on the next request',()=>{
  const vm=require('node:vm'),fs=require('node:fs'),workers=[];let listener;
  class Worker{constructor(){this.messages=[];workers.push(this);}postMessage(msg){this.messages.push(msg);}terminate(){this.terminated=true;}}
  vm.runInNewContext(fs.readFileSync('browser-ai/offscreen.js','utf8'),{Worker,chrome:{runtime:{id:'test',getURL:p=>p,onMessage:{addListener:fn=>listener=fn}}}});
  const sender={id:'test'},replies=[];
  assert.equal(listener({target:'browser-ai-offscreen',id:'one'},sender,r=>replies.push(r)),true);
  workers[0].onerror({message:'crash'});assert.equal(workers[0].terminated,true);assert.equal(replies[0].retryable,true);
  listener({target:'browser-ai-offscreen',id:'two'},sender,r=>replies.push(r));assert.equal(workers.length,2);
  workers[0].onmessage({data:{id:'two',ok:false}});assert.equal(replies.length,1);
  workers[1].onmessage({data:{id:'two',ok:true,matches:[]}});assert.equal(replies[1].ok,true);
});
