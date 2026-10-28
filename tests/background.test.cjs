const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const Transport=require('../plan-transport');
function fixture({searchTimeoutMs}={}){
  const hooks={},events=[];let disconnected,allowed=false,fetchURL=null,fetchOptions=null,fetchHandler=null;
  const chrome={runtime:{id:'fixture',onMessage:{addListener:fn=>hooks.message=fn},onConnect:{addListener:fn=>hooks.connect=fn},getURL:p=>'chrome-extension://fixture/'+p},
    permissions:{contains:async request=>{assert.deepEqual(Array.from(request.origins),['http://127.0.0.1:8765/*']);return allowed;}},tabs:{onRemoved:{addListener:fn=>hooks.remove=fn},create:async()=>{}},
    debugger:{attach:(_t,_v,cb)=>cb(),detach:(_t,cb)=>cb(),onDetach:{addListener:fn=>hooks.detach=fn},sendCommand:(_t,_m,p,cb)=>{events.push(p);if(p.type==='mouseMoved'&&p.buttons===1&&events.length>5)disconnected?.();queueMicrotask(()=>cb({}));}}};
  const context={chrome,SAGPlanTransport:Transport,SAGBrowserAIBridge:require('../browser-ai/bridge'),importScripts:()=>{},Map,Uint8Array,AbortController,crypto:require('node:crypto').webcrypto,setTimeout:(fn,ms)=>setTimeout(fn,ms===30000?(searchTimeoutMs??ms):ms),clearTimeout,btoa,fetch:async (url,options)=>{fetchURL=url;fetchOptions=options;if(fetchHandler)return fetchHandler(url,options);return {ok:true,json:async()=>({ready:true,device:'cpu'}),arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};}};
  vm.runInNewContext(fs.readFileSync('background.js','utf8'),context);
  const sender={id:'fixture',tab:{id:1,url:'https://skribbl.io/'},url:'https://skribbl.io/',frameId:0};
  function message(msg,who=sender){return new Promise(resolve=>{const async=hooks.message(msg,who,resolve);if(!async)resolve(undefined);});}
  return {chrome,hooks,events,message,sender,allow:()=>allowed=true,url:()=>fetchURL,options:()=>fetchOptions,fetch:fn=>fetchHandler=fn,port:runId=>hooks.connect({name:'planKeepAlive:'+runId,sender,onDisconnect:{addListener:fn=>disconnected=fn}})};
}
test('page unload port disconnection cancels a background curve and releases input',async()=>{
  const f=fixture();assert.equal((await f.message({action:'planBegin',runId:'one'})).ok,true);f.port('one');
  const r=await f.message({action:'planStroke',runId:'one',points:Array.from({length:100},(_,i)=>({x:i,y:30}))});
  assert.equal(r.cancelled,true);assert.equal(f.events.at(-1).type,'mouseReleased');assert.ok(f.events.length<100);
});

test('word search uses the fixed JSON endpoint, validates inputs and cancels superseded requests',async()=>{
  const f=fixture();
  assert.equal((await f.message({action:'aiWordSearch',id:'denied',query:'fish',candidates:['shark']})).ok,false);
  f.allow();f.fetch(async()=>({ok:true,json:async()=>({matches:[{word:'shark',score:.7}]})}));
  const result=await f.message({action:'aiWordSearch',id:'one',query:'fish',candidates:['shark'],url:'https://example.com/'});
  assert.equal(result.ok,true);assert.equal(result.matches[0].word,'shark');assert.equal(f.url(),'http://127.0.0.1:8765/api/word-search');
  assert.deepEqual(JSON.parse(f.options().body),{query:'fish',candidates:['shark']});
  assert.equal((await f.message({action:'aiWordSearch',id:'bad',query:'fish',candidates:[42]})).ok,false);
  f.fetch(async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true})));
  const pending=f.message({action:'aiWordSearch',id:'two',query:'fish',candidates:['shark']});await new Promise(setImmediate);
  await f.message({action:'aiCancel',id:'two'});assert.equal((await pending).ok,false);assert.equal(f.options().signal.aborted,true);
  // Cancel before the awaited permission check returns, as can happen during fast typing.
  let check;f.chrome.permissions.contains=()=>new Promise(resolve=>check=resolve);
  const early=f.message({action:'aiWordSearch',id:'early',query:'food',candidates:['bread']});
  await new Promise(setImmediate);
  await f.message({action:'aiCancel',id:'early'});check(true);assert.equal((await early).ok,false);
});
test('background rejects other origins and requires permission for fixed local AI endpoint',async()=>{
  const f=fixture();assert.equal(await f.message({action:'planBegin',runId:'bad'},{...f.sender,url:'https://example.com/'}),undefined);
  const denied=await f.message({action:'aiHealth'});assert.equal(denied.ok,false);assert.match(denied.error,/Enable local AI access/);
  f.allow();const response=await f.message({action:'aiHealth',url:'https://example.com/'});assert.equal(response.ok,true);assert.equal(f.url(),'http://127.0.0.1:8765/health');
  const subject=await f.message({action:'aiSubject',image:'data:image/png;base64,AQID',url:'https://example.com/'});assert.equal(subject.ok,true);assert.equal(f.url(),'http://127.0.0.1:8765/api/subject');
  assert.equal((await f.message({action:'aiSubject',image:'https://example.com/'})).ok,false);
  assert.equal(await f.message({action:'aiConfigure',mode:'gpu'}),undefined);
  assert.equal(await f.message({action:'aiUnload'}),undefined);
});

test('a stalled semantic search times out and reports failure instead of hanging the UI',async()=>{
  const f=fixture({searchTimeoutMs:10});f.allow();
  f.fetch(async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true})));
  const response=await f.message({action:'aiWordSearch',id:'stalled',query:'fish',candidates:['shark']});
  assert.equal(response.ok,false);assert.match(response.error,/timed out/);assert.equal(f.options().signal.aborted,true);
});
