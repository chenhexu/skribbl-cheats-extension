(function(root){
  'use strict';
  const KEY='sagAIBackend.v1',MODES=['python','gpu','cpu'];
  class BrowserAIBridge {
    constructor(chrome){this.chrome=chrome;this.creating=null;this.changing=null;}
    async mode(){if(this.changing)await this.changing;const saved=await this.chrome.storage?.local.get(KEY);return MODES.includes(saved?.[KEY])?saved[KEY]:'python';}
    async configure(mode){
      if(!MODES.includes(mode))throw Error('Choose Python, Chrome GPU or Chrome CPU.');
      const previous=this.changing;
      const change=(async()=>{if(previous)await previous.catch(()=>{});await this.close();await this.chrome.storage.local.set({[KEY]:mode});return {mode};})();
      this.changing=change;
      try{return await change;}finally{if(this.changing===change)this.changing=null;}
    }
    async close(){
      if(this.creating)await this.creating.catch(()=>{});
      if(this.chrome.offscreen&&await this.chrome.offscreen.hasDocument())await this.chrome.offscreen.closeDocument();
    }
    async ensure(){
      if(this.creating)return this.creating;
      this.creating=(async()=>{
        if(!this.chrome.offscreen)throw Error('Reload the updated extension to enable in-Chrome AI.');
        if(!await this.chrome.offscreen.hasDocument())await this.chrome.offscreen.createDocument({url:'browser-ai/offscreen.html',reasons:['WORKERS'],justification:'Run packaged AI models in a dedicated worker, keeping image inference and live word search off the game UI thread.'});
      })();
      try{await this.creating;}finally{this.creating=null;}
    }
    async request(msg,mode,signal){
      await this.ensure();signal.throwIfAborted();
      const cancel=()=>this.chrome.runtime.sendMessage({target:'browser-ai-offscreen',id:msg.id,cancel:true}).catch(()=>{});
      signal.addEventListener('abort',cancel,{once:true});
      try{
        const response=await this.chrome.runtime.sendMessage({...msg,target:'browser-ai-offscreen',mode});signal.throwIfAborted();
        if(!response?.ok)throw Object.assign(Error(response?.error||'Browser AI did not respond'),{name:response?.cancelled?'AbortError':'Error'});
        return response;
      }finally{signal.removeEventListener('abort',cancel);}
    }
  }
  root.SAGBrowserAIBridge=BrowserAIBridge;
  if(typeof module==='object'&&module.exports)module.exports=BrowserAIBridge;
})(globalThis);
