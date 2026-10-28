/* Serialized, cancellable CDP input. Injectable dependencies allow lifecycle tests. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SAGPlanTransport=api;})(globalThis,function(){
  'use strict';
  const stopped=()=>Object.assign(new Error('Drawing stopped or superseded'),{name:'AbortError'});
  class PlanTransport {
    constructor({attach,detach,command,moveIntervalMs=12,commandTimeoutMs=3000}){this.attach=attach;this.detach=detach;this.command=command;this.moveIntervalMs=moveIntervalMs;this.commandTimeoutMs=commandTimeoutMs;this.sessions=new Map();this.queues=new Map();this.cancelledRuns=new Map();}
    queue(tab,fn){const previous=this.queues.get(tab)||Promise.resolve();const job=previous.catch(()=>{}).then(fn);this.queues.set(tab,job);job.finally(()=>{if(this.queues.get(tab)===job)this.queues.delete(tab);}).catch(()=>{});return job;}
    check(tab,s){if(!s||s.cancelled||this.sessions.get(tab)!==s)throw stopped();}
    halt(s){if(s){s.cancelled=true;for(const reject of s.waiters)reject(stopped());s.waiters.clear();}}
    remember(tab,id){if(!id)return;const ids=this.cancelledRuns.get(tab)||new Set();ids.add(id);if(ids.size>256)ids.delete(ids.values().next().value);this.cancelledRuns.set(tab,ids);}
    async bounded(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Drawing input timed out; stopped to avoid queuing more input.')),this.commandTimeoutMs);})]);}finally{clearTimeout(timer);}}
    async input(tab,s,params){let interrupted;try{await this.bounded(Promise.race([this.command(tab,'Input.dispatchMouseEvent',params),new Promise((_,reject)=>{interrupted=reject;s.waiters.add(reject);if(s.cancelled)reject(stopped());})]));}finally{s.waiters.delete(interrupted);}}
    async release(tab,s){if(!s?.pressed)return;s.pressed=false;try{await this.bounded(this.command(tab,'Input.dispatchMouseEvent',{type:'mouseReleased',x:s.last.x,y:s.last.y,button:'left',buttons:0,clickCount:1}));}catch(_){/* Detach is the final input cleanup if CDP has failed. */}}
    async emit(tab,s,type,p){this.check(tab,s);
      // The game drops pointer moves above 90Hz. Only wait when CDP itself is
      // faster than that limit; never remove curve vertices by flooding input.
      if(type==='mouseMoved'&&s.pressed){const delay=this.moveIntervalMs-(Date.now()-(s.moveAt||0));if(delay>0)await new Promise(r=>setTimeout(r,delay));this.check(tab,s);}
      s.last=p;
      // Mark a press before awaiting its acknowledgement: Stop must release even
      // when Chrome dispatched it but its response is delayed. Cancellation can
      // interrupt that wait; no further drawing events are submitted afterwards.
      if(type==='mousePressed')s.pressed=true;
      await this.input(tab,s,{type,x:p.x,y:p.y,button:type==='mouseMoved'?'none':'left',buttons:type==='mouseReleased'?0:type==='mouseMoved'?(s.pressed?1:0):1,...(type==='mouseMoved'?{}:{clickCount:1})});
      if(type==='mouseMoved'&&s.pressed)s.moveAt=Date.now();if(type==='mouseReleased')s.pressed=false;this.check(tab,s);}
    begin(tab,id){
      if(typeof id!=='string'||id.length>100)throw new Error('Invalid drawing run');
      if(this.cancelledRuns.get(tab)?.has(id))return Promise.reject(stopped());
      const old=this.sessions.get(tab);this.halt(old);
      const s={id,cancelled:false,ready:false,pressed:false,last:{x:0,y:0},waiters:new Set()};this.sessions.set(tab,s);
      return this.queue(tab,async()=>{await this.release(tab,old);if(old){await this.detach(tab);await new Promise(r=>setTimeout(r,0));}this.check(tab,s);await this.attach(tab);this.check(tab,s);s.ready=true;});
    }
    stroke(tab,id,points){
      const s=this.sessions.get(tab);
      if(!s||s.id!==id)return Promise.reject(stopped());
      if(!Array.isArray(points)||points.length<2||points.length>50000||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>100000||p.y>100000))return Promise.reject(new Error('Invalid stroke coordinates'));
      return this.queue(tab,async()=>{const started=Date.now();this.check(tab,s);try{await this.emit(tab,s,'mousePressed',points[0]);for(let i=1;i<points.length;i++)await this.emit(tab,s,'mouseMoved',points[i]);await this.emit(tab,s,'mouseReleased',points[points.length-1]);return {elapsedMs:Date.now()-started,events:points.length+1};}catch(error){this.halt(s);throw error;}finally{await this.release(tab,s);}});
    }
    tool(tab,id,points){const s=this.sessions.get(tab);if(!s||s.id!==id)return Promise.reject(stopped());if(!Array.isArray(points)||points.length>2)return Promise.reject(new Error('Invalid tool selection'));return this.queue(tab,async()=>{const started=Date.now();try{for(const p of points){if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new Error('Invalid tool coordinate');await this.emit(tab,s,'mousePressed',p);await this.emit(tab,s,'mouseReleased',p);}this.check(tab,s);return {elapsedMs:Date.now()-started,events:points.length*2};}catch(error){this.halt(s);throw error;}finally{await this.release(tab,s);}});}
    cancel(tab,id){this.remember(tab,id);const s=this.sessions.get(tab);if(!s||(id&&s.id!==id))return Promise.resolve();this.remember(tab,s.id);this.halt(s);return this.queue(tab,async()=>{await this.release(tab,s);if(this.sessions.get(tab)===s){await this.detach(tab);this.sessions.delete(tab);}});}
    disconnected(tab){const s=this.sessions.get(tab);if(s?.ready){this.halt(s);s.pressed=false;}}
  }
  return PlanTransport;
});
