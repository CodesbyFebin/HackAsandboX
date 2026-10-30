import {Fault} from './core.mjs';
export class PrivateInference {
  constructor({url,models=[],fetcher=fetch}={}){
    this.models=models;this.fetcher=fetcher;this.url=null;
    if(url){const u=new URL(url);if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!u.port||u.pathname!=='/'||u.username||u.password||u.search||u.hash)throw new Fault(400,'Loopback inference endpoint required');this.url=u.origin;}
    if(!Array.isArray(models)||models.some(m=>typeof m!=='string'||!m||m.length>120||/cloud/i.test(m)))throw new Fault(400,'Approved local model identifiers required');
    this.busy=false;
  }
  get configured(){return Boolean(this.url&&this.models.length);}
  async request(path,body){if(!this.configured)throw new Fault(503,'Local inference is not configured');const response=await this.fetcher(this.url+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Fault(502,'Local model request failed; no fallback attempted');let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>250000)throw new Fault(502,'Local model response too large');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  async generate(input){if(!this.models.includes(input.model)||typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>8000)throw new Fault(400,'Approved model and bounded prompt required');if(this.busy)throw new Fault(429,'Local inference is busy');this.busy=true;try{const info=await this.request('/api/show',{model:input.model});if(info.remote_host||info.remote_model)throw new Fault(403,'Remote-backed models are prohibited');const out=await this.request('/api/generate',{model:input.model,prompt:input.prompt,stream:false,keep_alive:0,options:{num_predict:512,num_ctx:4096}});if(typeof out.response!=='string')throw new Fault(502,'Local model returned no text');return {model:input.model,text:out.response,provider:'operator-local-ollama',fallback:false};}finally{this.busy=false;}}
}
