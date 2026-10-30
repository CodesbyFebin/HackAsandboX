import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { Control, Fault } from './core.mjs';
import { serveAsset } from './local-assets.mjs';
import { BusinessLedger } from './business.mjs';
import {randomUUID} from 'node:crypto';
import {previewDocument} from './preview.mjs';
import {Workspaces,templates,specialists} from './workspaces.mjs';
import {PaymentVerification} from './verification.mjs';
import {PrivateInference} from './inference.mjs';
import { reviewSource } from './security.mjs';
export function server(control, { operatorToken, workerToken, webllmAssets = null, webllmConfig = null, inference = new PrivateInference(), paymentVerification = new PaymentVerification() }) {
  if (![operatorToken,workerToken].every(t=>typeof t==='string'&&t.length>=32)||operatorToken===workerToken) throw Error('Distinct operator and worker tokens of at least 32 characters required');
  const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
  const business=new BusinessLedger(control),workspaces=new Workspaces(control);
  const previews=new Map();
  const html=readFileSync(new URL('./console.html',import.meta.url));
  return createServer(async(req,res)=>{
    const send=(status,data,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'"});res.end(type==='application/json'?JSON.stringify(data):data);};
    try {
      if(req.headers.host!==`127.0.0.1:${req.socket.localPort}`)throw new Fault(403,'Use the loopback endpoint');
      const origin='http://'+req.headers.host;
      if(req.headers.origin && req.headers.origin!==origin)throw new Fault(403,'Cross-origin request rejected');
      const path=new URL(req.url,origin).pathname;
      if(req.method==='GET'&&path==='/health')return send(200,{status:'ready',schema:'hackasandbox.sovereign.v1'});
      if(req.method==='GET'&&path.startsWith('/preview/')){const entry=previews.get(path.slice(9));if(!entry||entry.expires<=Date.now())throw new Fault(404,'Preview expired; open a fresh preview');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'",'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});return res.end(entry.html);}
      if(req.method==='GET'&&path==='/builder')return send(200,readFileSync(new URL('./builder.html',import.meta.url)),'text/html; charset=utf-8');
      if(req.method==='GET'&&path==='/builder.mjs')return send(200,readFileSync(new URL('./builder.mjs',import.meta.url)),'text/javascript');
      if(req.method==='GET'&&path==='/builder.css')return send(200,readFileSync(new URL('./builder.css',import.meta.url)),'text/css');
      if(req.method==='GET'&&path==='/')return send(200,html,'text/html; charset=utf-8');
      if(req.method==='GET'&&path.startsWith('/local-model/'))return await serveAsset(webllmAssets,path,req,res);
      if(req.method==='GET'&&path==='/webllm.mjs')return send(200,readFileSync(new URL('./webllm.mjs',import.meta.url)),'text/javascript');
      if(req.method==='GET'&&path==='/console.mjs')return send(200,readFileSync(new URL('./console.mjs',import.meta.url)),'text/javascript');
      const auth=req.headers.authorization??'';
      const role=equal(auth,'Bearer '+operatorToken)?'operator':equal(auth,'Bearer '+workerToken)?'worker':null;
      if(!role)throw new Fault(401,'Authentication required');
      const isWorker=path.startsWith('/v1/worker/');if((role==='worker')!==isWorker)throw new Fault(403,'Role is not permitted');
      let input={};
      if(req.method==='POST') {
        if(req.headers['content-type']?.split(';')[0]!=='application/json')throw new Fault(415,'JSON required');
        let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>700000)throw new Fault(413,'Body too large');chunks.push(c);}
        try{input=JSON.parse(Buffer.concat(chunks));}catch{throw new Fault(400,'Invalid JSON');}
        if(!input||typeof input!=='object'||Array.isArray(input))throw new Fault(400,'JSON object required');
      }
      if(req.method==='GET'&&path==='/v1/status')return send(200,{name:'HackaSandbox Sovereign OS',brand:'CodesByFebin',execution:'offline_worker_available; operator_configuration_required',inference:inference.configured?'local_endpoint_configured; live_model_unverified':'not_configured',localModels:inference.models,zkProof:'not_connected',integrations:{opencode:'adapter_contract',metabos:'local_invoice_stock_ledger; upstream_not_connected',metapen:'local_source_review; upstream_not_connected',webllm:webllmAssets&&webllmConfig?'local_assets_configured; device_unverified':'assets_not_configured'},webllmConfig,tasks:control.list(),publicKey:control.publicKey});
      if(req.method==='GET'&&path==='/v1/integrations')return send(200,{builder:{status:'implemented',route:'/builder'},localInference:{configured:inference.configured,models:inference.models,assurance:'configuration_only; model_not_probed'},browserInference:{configured:Boolean(webllmAssets&&webllmConfig),assurance:'device_unverified'},paymentVerification:{configured:paymentVerification.configured,networks:paymentVerification.networks,settlementEnabled:false},security:{sourceReview:'implemented',remoteScans:'not_connected'},evidence:{signedManifests:true,artifactByteVerification:true,zkProof:'not_generated'}});
      if(req.method==='POST'&&path==='/v1/payments/verify')return send(200,await paymentVerification.verify(input));
      if(req.method==='GET'&&path==='/v1/workspaces')return send(200,{workspaces:workspaces.list(),templates:templates.map(({id,name,description})=>({id,name,description})),specialists:Object.keys(specialists),models:inference.models});
      if(req.method==='POST'&&path==='/v1/workspaces')return send(201,workspaces.create(input));
      const workspaceRoute=path.match(/^\/v1\/workspaces\/([0-9a-f-]{36})(?:\/(save|chat|apply|preview|reject))?$/);
      if(workspaceRoute){const [,id,action]=workspaceRoute;if(req.method==='GET'&&!action)return send(200,workspaces.get(id));if(req.method==='POST'){if(action==='preview'){for(const [key,entry]of previews)if(entry.expires<=Date.now())previews.delete(key);if(previews.size>=100)throw new Fault(429,'Preview limit reached; wait one minute');const cap=randomUUID();previews.set(cap,{html:previewDocument(workspaces.row(id).files),expires:Date.now()+60000});return send(200,{url:'/preview/'+cap,expiresIn:60});}if(action==='save')return send(200,workspaces.save(id,input));if(action==='reject')return send(200,workspaces.reject(id,input));if(action==='apply')return send(200,workspaces.apply(id,input));if(action==='chat')return send(200,await workspaces.chat(id,input,inference));}}
      if(req.method==='POST'&&path==='/v1/inference')return send(200,await inference.generate(input));
      if(req.method==='GET'&&path==='/v1/business')return send(200,business.list());
      if(req.method==='POST'&&path==='/v1/business/stock')return send(200,business.stock(input));
      if(req.method==='POST'&&path==='/v1/business/invoices')return send(201,business.draft(input));
      if(req.method==='POST'&&path==='/v1/security/review')return send(200,reviewSource(input));
      const invoice=path.match(/^\/v1\/business\/invoices\/([0-9a-f-]{36})\/(approve|commit|reset-approval)$/);
      if(invoice&&req.method==='POST'){const [,id,action]=invoice;return send(200,action==='approve'?business.approve(id,input):action==='commit'?business.commit(id,input):business.resetApproval(id));}
      if(req.method==='GET'&&path==='/v1/audit')return send(200,control.audit());
      if(req.method==='POST'&&path==='/v1/tasks')return send(201,control.create(input));
      if(req.method==='POST'&&path==='/v1/worker/claim')return send(200,control.claim(input.modules,input.modes));
      const m=path.match(/^\/v1\/(worker\/)?tasks\/([0-9a-f-]{36})(?:\/(heartbeat|finish|approve|export|cancel|artifacts))?$/);
      if(m){const [,worker,id,action]=m;
        if(!worker&&action==='artifacts'&&req.method==='GET')return send(200,control.artifacts(id));
        if(!worker&&!action&&req.method==='GET')return send(200,control.get(id));
        if(req.method==='POST'){
          if(worker&&action==='heartbeat')return send(200,control.heartbeat(id,input.lease));
          if(worker&&action==='finish')return send(200,control.finish(id,input.lease,input));
          if(!worker&&action==='cancel')return send(200,control.cancel(id));
          if(!worker&&action==='approve')return send(200,control.approve(id,input));
          if(!worker&&action==='export')return send(200,control.consume(id,input));
        }
      }
      throw new Fault(404,'Not found');
    }catch(e){if(res.headersSent){res.destroy();return;}send(e.status??500,{error:e instanceof Fault?e.message:'Internal error'});}
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.SOVEREIGN_PORT??8788);
  const control=new Control(process.env.SOVEREIGN_DATA??'sovereign/data');
  const app=server(control,{operatorToken:process.env.SOVEREIGN_OPERATOR_TOKEN,workerToken:process.env.SOVEREIGN_WORKER_TOKEN,paymentVerification:new PaymentVerification({url:process.env.SOVEREIGN_X402_URL,networks:(process.env.SOVEREIGN_X402_NETWORKS??'').split(',').filter(Boolean)}),inference:new PrivateInference({url:process.env.SOVEREIGN_OLLAMA_URL,models:(process.env.SOVEREIGN_LOCAL_MODELS??'').split(',').filter(Boolean)}),webllmAssets:process.env.SOVEREIGN_WEBLLM_ASSETS,webllmConfig:process.env.SOVEREIGN_WEBLLM_CONFIG?JSON.parse(readFileSync(process.env.SOVEREIGN_WEBLLM_CONFIG,'utf8')):null});
  app.requestTimeout=30000;app.headersTimeout=10000;
  app.listen(port,'127.0.0.1',()=>console.log(`HackaSandbox Sovereign OS: http://127.0.0.1:${port}`));
  const timer=setInterval(()=>control.transaction(()=>control.expire()),5000);timer.unref();
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{clearInterval(timer);app.close(()=>{control.close();process.exit(0);});});
}
