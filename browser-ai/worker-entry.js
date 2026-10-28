import {BrowserAI} from './engine.js';
let engine=null,mode=null,queue=Promise.resolve();
const requests=new Map();
self.onmessage=({data:msg})=>{
  if(msg.cancel){requests.get(msg.id)?.abort();return;}
  if(!['cpu','gpu'].includes(msg.mode)){self.postMessage({id:msg.id,ok:false,error:'Invalid browser AI mode'});return;}
  if(!engine){mode=msg.mode;engine=new BrowserAI(mode);}
  if(mode!==msg.mode){self.postMessage({id:msg.id,ok:false,error:'AI backend changed; retry the request.'});return;}
  if(msg.action==='aiHealth'){
    if(!engine.states.words.ready&&!engine.states.words.warming&&!engine.states.words.error)engine.model('words').catch(()=>{});
    self.postMessage({id:msg.id,ok:true,health:engine.health()});return;
  }
  const controller=new AbortController();requests.set(msg.id,controller);
  const work=async()=>{
    try{
      controller.signal.throwIfAborted();
      const result=msg.action==='aiPrepare'?await engine.prepare(controller.signal):msg.action==='aiWordSearch'?await engine.search(msg.query,msg.candidates,controller.signal):await engine.image(msg.action==='aiSubject'?'subject':'lines',msg.image,controller.signal);
      controller.signal.throwIfAborted();self.postMessage({id:msg.id,ok:true,...result});
    }catch(error){self.postMessage({id:msg.id,ok:false,error:error.message,cancelled:error.name==='AbortError'});}
    finally{requests.delete(msg.id);}
  };
  queue=queue.then(work,work);
};
