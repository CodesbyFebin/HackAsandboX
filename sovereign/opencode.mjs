import { Fault } from './core.mjs';
// Called only inside an operator-managed workspace. No provider is contacted here
// unless the operator explicitly invokes run() against an already running server.
export class OpenCodeAdapter {
  constructor({url,password,providerID,modelID,fetcher=fetch}) {
    const u=new URL(url);
    if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!u.port||u.pathname!=='/'||u.search||u.hash||u.username||u.password)throw new Fault(400,'A loopback OpenCode endpoint is required');
    if(!password||!providerID||!modelID)throw new Fault(400,'Server password and explicit local provider/model required');
    this.url=u.origin;this.password=password;this.model={providerID,modelID};this.fetcher=fetcher;
  }
  async request(path,body,timeout=10000) {
    const r=await this.fetcher(this.url+path,{method:body?'POST':'GET',headers:{Authorization:'Basic '+Buffer.from('opencode:'+this.password).toString('base64'),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(timeout)});
    if(!r.ok)throw new Fault(502,'OpenCode request failed');
    const chunks=[];let length=0;for await(const c of r.body){length+=c.length;if(length>500000)throw new Fault(502,'OpenCode response limit exceeded');chunks.push(c);}
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  async run(prompt,{deadline,localOnlyConfirmed}={}) {
    if(localOnlyConfirmed!==true)throw new Fault(409,'Operator must verify server provider configuration and outbound enforcement');
    const remaining=deadline-Date.now();if(!Number.isFinite(remaining)||remaining<=0||remaining>3600000||typeof prompt!=='string'||!prompt.trim()||prompt.length>8000)throw new Fault(400,'Bounded prompt and unexpired deadline required');
    const session=await this.request('/session',{title:'HackaSandbox scoped mission'},Math.min(remaining,10000));
    if(!/^[A-Za-z0-9_-]+$/.test(session.id))throw new Fault(502,'Invalid OpenCode session');
    const timeout=deadline-Date.now();if(timeout<=0)throw new Fault(409,'Task deadline elapsed');
    return {sessionId:session.id,response:await this.request('/session/'+session.id+'/message',{model:this.model,parts:[{type:'text',text:prompt}]},timeout)};
  }
}
