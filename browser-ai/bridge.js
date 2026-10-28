(function(root){
  'use strict';
  const KEY='sagAIBackend.v1',MODES=['python','gpu','cpu'];
  class BrowserAIBridge {
    constructor(chrome){this.chrome=chrome;this.creating=null;this.changing=null;this.generation=0;}
    async mode(){if(this.changing)await this.changing;const saved=await this.chrome.storage?.local.get(KEY);return MODES.includes(saved?.[KEY])?saved[KEY]:'python';}
    async configure(mode){
      if(!MODES.includes(mode))throw Error('Choose Python, Chrome GPU or Chrome CPU.');
      const previous=this.changing;
      const change=(async()=>{if(previous)await previous.catch(()=>{});await this.close();await this.chrome.storage.local.set({[KEY]:mode});return {mode};})();
      this.changing=change;
      try{return await change;}finally{if(this.changing===change)this.changing=null;}
    }
    async close(){
      this.generation++;
      if(this.creating)await this.creating.catch(()=>{});
      if(this.chrome.offscreen&&await this.chrome.offscreen.hasDocument())await this.chrome.offscreen.closeDocument();
    }
    async ensure(){
      if(this.creating)return this.creating;
      this.creating=(async()=>{
        if(!this.chrome.offscreen)throw Error('Enable in-Chrome AI access in AI setup, then load its models.');
        if(!await this.chrome.offscreen.hasDocument())await this.chrome.offscreen.createDocument({url:'browser-ai/offscreen.html',reasons:['WORKERS'],justification:'Run packaged AI models in a dedicated worker, keeping image inference and live word search off the game UI thread.'});
      })();
      try{await this.creating;}finally{this.creating=null;}
    }
    async request(msg,mode,signal){
      const generation=this.generation;
      const check=()=>{signal.throwIfAborted();if(generation!==this.generation)throw new DOMException('AI backend changed','AbortError');};
      let interrupted,sent=false;
      const stopped=new Promise((_,reject)=>interrupted=reject);
      const cancel=()=>{if(sent)this.chrome.runtime.sendMessage({target:'browser-ai-offscreen',id:msg.id,cancel:true}).catch(()=>{});interrupted(signal.reason);};
      check();
      signal.addEventListener('abort',cancel,{once:true});
      try{
        for(let attempt=0;attempt<2;attempt++){
          try{
            await Promise.race([this.ensure(),stopped]);check();
            sent=true;
            const response=await Promise.race([this.chrome.runtime.sendMessage({...msg,target:'browser-ai-offscreen',mode}),stopped]);check();
            if(!response?.ok)throw Object.assign(Error(response?.error||'Browser AI did not respond'),{name:response?.cancelled?'AbortError':'Error',retryable:response?.retryable||!response});
            return response;
          }catch(error){
            check();
            const disconnected=error.retryable||/message channel closed|message port closed|receiving end does not exist|could not establish connection|offscreen document closed before fully loading/i.test(error.message);
            if(!disconnected)throw error;
            if(attempt)throw Object.assign(Error('AI connection was interrupted. Try searching again.'),{code:'AI_CONNECTION_LOST'});
          }
        }
      }finally{signal.removeEventListener('abort',cancel);}
    }
  }
  root.SAGBrowserAIBridge=BrowserAIBridge;
  if(typeof module==='object'&&module.exports)module.exports=BrowserAIBridge;
})(globalThis);
