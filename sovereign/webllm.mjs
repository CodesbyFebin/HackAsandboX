export function localModelConfig(config,origin) {
  if(!config||typeof config.model_id!=='string'||!config.model_id||config.model_id.length>200)throw Error('Local WebLLM model configuration required');
  const local=path=>{if(typeof path!=='string'||!path.startsWith('/local-model/')||path.includes('..')||/[?#\\]/.test(path))throw Error('Only mirrored local-model assets allowed');const u=new URL(path,origin);if(u.origin!==origin)throw Error('External model assets prohibited');return u.href;};
  return {model_id:config.model_id,model:local(config.model),model_lib:local(config.model_lib)};
}
export async function loadBrowserModel(config,{origin=location.origin,createEngine}={}) {
  if(!globalThis.navigator?.gpu)throw Error('WebGPU is unavailable on this device');
  const record=localModelConfig(config,origin);
  if(!createEngine){const runtime=await import('/local-model/webllm.mjs');createEngine=runtime.CreateMLCEngine;}
  return createEngine(record.model_id,{appConfig:{model_list:[record],useIndexedDBCache:true}});
}
