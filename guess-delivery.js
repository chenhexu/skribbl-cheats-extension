/* Chat acknowledgements for guesses. Submitting input is not server acceptance. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SAGGuessDelivery=api;})(globalThis,function(){
  'use strict';
  const normalize=value=>String(value||'').toLowerCase().trim().replace(/\s+/g,' ');
  const signature=row=>JSON.stringify([normalize(row.author),normalize(row.text),!!row.system]);
  class Tracker {
    constructor({timeoutMs=2500,setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id),onConfirm=()=>{},onReject=()=>{}}={}) {
      Object.assign(this,{timeoutMs,setTimer,clearTimer,onConfirm,onReject});
      this.pending=null;this.confirmed=new Set();this.unconfirmed=new Map();this.seen=new Map();this.previous=[];this.serial=0;
    }
    seed(rows){this.seen=new Map(rows.map(r=>[r.node,signature(r)]));this.previous=rows.map(signature);}
    begin(attempt) {
      if(this.pending||this.confirmed.has(normalize(attempt.out)))return null;
      const pending={...attempt,id:++this.serial,wire:normalize(attempt.out),author:normalize(attempt.author)};
      this.pending=pending;this.unconfirmed.set(pending.wire,pending);
      pending.timer=this.setTimer(()=>{if(this.pending===pending)this.reject('timeout');},this.timeoutMs);
      return pending;
    }
    cancel(){const pending=this.pending;if(pending)this.clearTimer(pending.timer);this.pending=null;return pending;}
    reset(){this.cancel();this.unconfirmed.clear();this.confirmed.clear();this.serial++;}
    reject(reason){const pending=this.cancel();if(pending)this.onReject(pending,reason);return pending;}
    accept(attempt,row) {
      if(this.confirmed.has(attempt.wire))return;
      if(this.pending?.wire===attempt.wire)this.cancel();
      this.confirmed.add(attempt.wire);this.unconfirmed.delete(attempt.wire);this.onConfirm(attempt,row);
    }
    observe(row,selfName='') {
      const text=normalize(row.text),author=normalize(row.author);
      if(row.system&&/^spam detected!|^spam erkannt!|^spam detected\b|^you're sending messages too quickly/.test(text)){this.reject('spam');return;}
      const attempts=[...this.unconfirmed.values()];
      for(const attempt of attempts) {
        const own=attempt.author||normalize(selfName);
        const echo=!row.system&&own&&author===own&&text===attempt.wire;
        const close=row.system&&text===attempt.wire+' is close!';
        const solved=row.system&&this.pending===attempt&&(text==='you guessed the word!'||(own&&text===own+' guessed the word!'));
        if(echo||close||solved){this.accept(attempt,row);if(solved)break;}
      }
    }
    scan(rows,{appended=new Set(),selfName='',onMessage=()=>{}}={}) {
      // Node identity survives quota pruning (unlike text length). If a whole
      // chat is rebuilt, existing message copies are history, not new replies.
      const replaced=this.seen.size&&rows.every(r=>!this.seen.has(r.node)),oldCounts=new Map();
      if(replaced)for(const sig of this.previous)oldCounts.set(sig,(oldCounts.get(sig)||0)+1);
      const fresh=[];
      for(const row of rows) {
        const sig=signature(row);
        if(replaced&&!appended.has(row.node)&&(oldCounts.get(sig)||0)>0){oldCounts.set(sig,oldCounts.get(sig)-1);continue;}
        if(this.seen.get(row.node)!==sig)fresh.push(row);
      }
      this.seed(rows);
      for(const row of fresh){this.observe(row,selfName);onMessage(row);}
      return fresh;
    }
  }
  return {Tracker,normalize};
});
