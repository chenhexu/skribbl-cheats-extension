const fs=require('node:fs/promises'),path=require('node:path'),esbuild=require('esbuild');
(async()=>{
  const root=path.resolve(__dirname,'..'),runtime=path.join(root,'browser-ai/runtime');await fs.mkdir(runtime,{recursive:true});
  const ort=path.join(root,'node_modules/onnxruntime-web/dist/ort.webgpu.min.mjs');
  await esbuild.build({entryPoints:[path.join(root,'browser-ai/worker-entry.js')],outfile:path.join(root,'browser-ai/worker.js'),bundle:true,format:'esm',platform:'browser',target:'chrome116',minify:true,legalComments:'eof',
    plugins:[{name:'local-only-browser-runtime',setup(build){
      build.onResolve({filter:/^onnxruntime-web(?:\/.*)?$/},()=>({path:ort}));
      build.onResolve({filter:/^(?:node:|onnxruntime-node$|sharp$)/},args=>({path:args.path,namespace:'empty-node'}));
      build.onLoad({filter:/.*/,namespace:'empty-node'},()=>({contents:'export default {};',loader:'js'}));
    }}]});
  for(const name of ['ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm'])await fs.copyFile(path.join(root,'node_modules/onnxruntime-web/dist',name),path.join(runtime,name));
  await fs.copyFile(path.join(root,'browser-ai/LICENSE.onnxruntime'),path.join(runtime,'LICENSE.onnxruntime'));
  await fs.copyFile(path.join(root,'node_modules/@huggingface/transformers/LICENSE'),path.join(runtime,'LICENSE.transformers'));
  console.log('Built packaged browser AI runtime.');
})().catch(error=>{console.error(error);process.exitCode=1;});
