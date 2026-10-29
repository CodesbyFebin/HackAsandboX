import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { Control, Fault } from './core.mjs';
export function server(control, { operatorToken, workerToken }) {
  if (![operatorToken,workerToken].every(t=>typeof t==='string'&&t.length>=32)||operatorToken===workerToken) throw Error('Distinct operator and worker tokens of at least 32 characters required');
  const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
  const html=readFileSync(new URL('./console.html',import.meta.url));
  return createServer(async(req,res)=>{
    const send=(status,data,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"});res.end(type==='application/json'?JSON.stringify(data):data);};
    try {
      if(req.headers.host!==`127.0.0.1:${req.socket.localPort}`)throw new Fault(403,'Use the loopback endpoint');
      const origin='http://'+req.headers.host;
      if(req.headers.origin && req.headers.origin!==origin)throw new Fault(403,'Cross-origin request rejected');
      const path=new URL(req.url,origin).pathname;
      if(req.method==='GET'&&path==='/health')return send(200,{status:'ready',schema:'hackasandbox.sovereign.v1'});
      if(req.method==='GET'&&path==='/')return send(200,html,'text/html; charset=utf-8');
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
      if(req.method==='GET'&&path==='/v1/status')return send(200,{name:'HackaSandbox Sovereign OS',brand:'CodesByFebin',execution:'external_worker_required',inference:'operator_configured_local_only',zkProof:'not_connected',integrations:{opencode:'adapter_contract',metabos:'planned',metapen:'planned',webllm:'planned'},tasks:control.list(),publicKey:control.publicKey});
      if(req.method==='GET'&&path==='/v1/audit')return send(200,control.audit());
      if(req.method==='POST'&&path==='/v1/tasks')return send(201,control.create(input));
      if(req.method==='POST'&&path==='/v1/worker/claim')return send(200,control.claim());
      const m=path.match(/^\/v1\/(worker\/)?tasks\/([0-9a-f-]{36})(?:\/(heartbeat|finish|approve|export))?$/);
      if(m){const [,worker,id,action]=m;
        if(!worker&&!action&&req.method==='GET')return send(200,control.get(id));
        if(req.method==='POST'){
          if(worker&&action==='heartbeat')return send(200,control.heartbeat(id,input.lease));
          if(worker&&action==='finish')return send(200,control.finish(id,input.lease,input));
          if(!worker&&action==='approve')return send(200,control.approve(id,input));
          if(!worker&&action==='export')return send(200,control.consume(id,input));
        }
      }
      throw new Fault(404,'Not found');
    }catch(e){send(e.status??500,{error:e instanceof Fault?e.message:'Internal error'});}
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.SOVEREIGN_PORT??8788);
  const control=new Control(process.env.SOVEREIGN_DATA??'sovereign/data');
  const app=server(control,{operatorToken:process.env.SOVEREIGN_OPERATOR_TOKEN,workerToken:process.env.SOVEREIGN_WORKER_TOKEN});
  app.requestTimeout=30000;app.headersTimeout=10000;
  app.listen(port,'127.0.0.1',()=>console.log(`HackaSandbox Sovereign OS: http://127.0.0.1:${port}`));
  const timer=setInterval(()=>control.transaction(()=>control.expire()),5000);timer.unref();
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{clearInterval(timer);app.close(()=>{control.close();process.exit(0);});});
}
