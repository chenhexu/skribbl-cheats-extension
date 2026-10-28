import * as ort from 'onnxruntime-web/webgpu';
import { AutoTokenizer } from '../node_modules/@huggingface/transformers/src/tokenizers.js';
import { env } from '../node_modules/@huggingface/transformers/src/env.js';

const base=new URL('./',import.meta.url),asset=name=>new URL(name,base).href;
env.allowRemoteModels=false;env.allowLocalModels=true;env.localModelPath=asset('models/');env.useBrowserCache=false;
ort.env.wasm.wasmPaths=asset('runtime/');ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
const normalize=word=>String(word).normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ');
const abort=signal=>{if(signal?.aborted)throw new DOMException('AI request stopped','AbortError');};
const bytesToURL=async blob=>{const data=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));return 'data:image/png;base64,'+btoa(binary);};

export class BrowserAI {
  constructor(mode){this.mode=mode;this.device=mode==='gpu'?'webgpu':'wasm';this.models={};this.states={words:{},subject:{},lines:{}};this.vectors=new Map();this.queries=new Map();}
  async adapter(){
    if(this.device!=='webgpu')return;
    if(!navigator.gpu || !await navigator.gpu.requestAdapter())throw Error('Chrome cannot access a GPU. Choose In Chrome — CPU or Python service in AI setup.');
  }
  async model(kind){
    if(this.models[kind])return this.models[kind];
    const state=this.states[kind];state.warming=true;state.error=null;
    const pending=(async()=>{
      await this.adapter();
      const session=await ort.InferenceSession.create(asset('models/'+kind+'.onnx'),{executionProviders:[this.device],graphOptimizationLevel:'all'});
      if(kind==='words'){
        this.tokenizer=await AutoTokenizer.from_pretrained('word-search',{local_files_only:true});
        const [words,buffer]=await Promise.all([fetch(asset('models/public-words.json')).then(r=>{if(!r.ok)throw Error('Public word bank missing');return r.json();}),fetch(asset('models/public-vectors.bin')).then(r=>{if(!r.ok)throw Error('Public word vectors missing');return r.arrayBuffer();})]);
        const vectors=new Float32Array(buffer);
        if(vectors.length!==words.length*384)throw Error('Invalid public word vectors');
        this.publicWords=new Set(words);
        for(let i=0;i<words.length;i++)this.vectors.set(words[i],vectors.subarray(i*384,(i+1)*384));
        await this.encode(['ready'],null,session);
      }else{const size=kind==='subject'?320:256;await session.run({image:new ort.Tensor('float32',new Float32Array(3*size*size),[1,3,size,size])});}
      state.ready=true;state.warming=false;return session;
    })().catch(error=>{state.warming=false;state.ready=false;state.error=error.message;delete this.models[kind];throw error;});
    this.models[kind]=pending;return pending;
  }
  health(){
    const feature=kind=>({...this.states[kind],device:this.device,installed:true});
    const wordSearch={...feature('words'),model:'all-MiniLM-L6-v2',preloadState:this.states.words.ready?'ready':this.states.words.warming?'loading':'idle',preloadedWords:this.publicWords?.size||0,totalWords:3708};
    return {mode:this.mode,ready:!!this.states.lines.ready,device:this.device,error:this.states.lines.error||null,lines:feature('lines'),subject:feature('subject'),wordSearch};
  }
  async prepare(signal){
    const errors=[];
    for(const kind of ['words','subject','lines']){abort(signal);try{await this.model(kind);}catch(error){errors.push(kind+': '+error.message);}}
    abort(signal);return {health:this.health(),errors};
  }
  async encode(texts,signal,loadedSession=null){
    const session=loadedSession||await this.model('words');abort(signal);
    const tokens=await this.tokenizer(texts,{padding:true,truncation:true,max_length:64});
    const inputs={};for(const key of session.inputNames){const token=tokens[key];if(!token)throw Error('Tokenizer output missing '+key);inputs[key]=new ort.Tensor('int64',token.data,token.dims);}
    const outputs=await session.run(inputs);abort(signal);
    const output=outputs[session.outputNames[0]],[,length,dimension]=output.dims,mask=tokens.attention_mask.data;
    if(dimension!==384)throw Error('Unexpected embedding size');
    return texts.map((_,batch)=>{
      const vector=new Float32Array(dimension);let count=0;
      for(let token=0;token<length;token++)if(mask[batch*length+token]){count++;for(let c=0;c<dimension;c++)vector[c]+=output.data[(batch*length+token)*dimension+c];}
      let norm=0;for(let c=0;c<dimension;c++){vector[c]/=Math.max(1,count);norm+=vector[c]**2;}norm=Math.sqrt(norm)||1;
      for(let c=0;c<dimension;c++)vector[c]/=norm;return vector;
    });
  }
  async search(query,candidates,signal){
    const start=performance.now(),q=normalize(query);await this.model('words');abort(signal);
    const missing=[...new Set(candidates.map(normalize))].filter(word=>!this.vectors.has(word));
    for(let offset=0;offset<missing.length;offset+=16){abort(signal);const batch=missing.slice(offset,offset+16),vectors=await this.encode(batch,signal);batch.forEach((word,i)=>this.vectors.set(word,vectors[i]));await new Promise(resolve=>setTimeout(resolve,0));}
    if(!this.queries.has(q))this.queries.set(q,(await this.encode([q],signal))[0]);
    const queryVector=this.queries.get(q);if(this.queries.size>128)this.queries.delete(this.queries.keys().next().value);
    const matches=candidates.map(word=>{const vector=this.vectors.get(normalize(word));let score=0;for(let i=0;i<384;i++)score+=vector[i]*queryVector[i];return {word,score};});
    // Keep public vectors; custom terms and queries are memory-only and bounded.
    if(this.vectors.size>20000)for(const key of this.vectors.keys()){if(!this.publicWords.has(key))this.vectors.delete(key);if(this.vectors.size<=20000)break;}
    return {matches,model:'sentence-transformers/all-MiniLM-L6-v2',device:this.device,processingMs:Math.round((performance.now()-start)*10)/10,encodedWords:missing.length};
  }
  async image(kind,url,signal){
    const session=await this.model(kind);abort(signal);
    const bytes=Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0));
    const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
    try{
    const width=bitmap.width,height=bitmap.height;
    if(width*height>800*600)throw Error('AI image exceeds 800 × 600');
    const size=kind==='subject'?320:256,canvas=new OffscreenCanvas(size,size),ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.fillStyle='white';ctx.fillRect(0,0,size,size);
    const scale=Math.min(size/width,size/height),sw=kind==='subject'?size:Math.max(1,Math.round(width*scale)),sh=kind==='subject'?size:Math.max(1,Math.round(height*scale)),left=(size-sw)>>1,top=(size-sh)>>1;
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,left,top,sw,sh);
    const input=ctx.getImageData(0,0,size,size).data,tensor=new Float32Array(3*size*size),mean=[.485,.456,.406],std=[.229,.224,.225];
    let maximum=255;if(kind==='subject'){maximum=1;for(let i=0;i<input.length;i+=4)maximum=Math.max(maximum,input[i],input[i+1],input[i+2]);}
    for(let i=0;i<size*size;i++)for(let c=0;c<3;c++)tensor[c*size*size+i]=kind==='subject'?(input[i*4+c]/maximum-mean[c])/std[c]:input[i*4+c]/255;
    const outputs=await session.run({image:new ort.Tensor('float32',tensor,[1,3,size,size])});abort(signal);
    const values=outputs[session.outputNames[0]].data,mask=ctx.createImageData(size,size);let low=0,range=1;
    if(kind==='subject'){low=Infinity;let high=-Infinity;for(const value of values){low=Math.min(low,value);high=Math.max(high,value);}range=Math.max(1e-6,high-low);}
    for(let i=0;i<size*size;i++){const value=Math.floor(Math.max(0,Math.min(1,(values[i]-low)/range))*255);mask.data.set([value,value,value,255],i*4);}ctx.putImageData(mask,0,0);
    const output=new OffscreenCanvas(width,height),outputCtx=output.getContext('2d',{willReadFrequently:true});outputCtx.imageSmoothingQuality='high';outputCtx.drawImage(canvas,left,top,sw,sh,0,0,width,height);
    if(kind==='subject'){
      const original=new OffscreenCanvas(width,height),originalCtx=original.getContext('2d',{willReadFrequently:true});originalCtx.drawImage(bitmap,0,0);
      const alpha=originalCtx.getImageData(0,0,width,height).data,result=outputCtx.getImageData(0,0,width,height);
      for(let i=0;i<width*height;i++){const value=Math.floor(result.data[i*4]*alpha[i*4+3]/255);result.data.set([value,value,value,255],i*4);}outputCtx.putImageData(result,0,0);
    }
    abort(signal);return {image:await bytesToURL(await output.convertToBlob({type:'image/png'})),device:this.device};
    }finally{bitmap.close();}
  }
}
