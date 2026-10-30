import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp,writeFile,rm,realpath,lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const exec=promisify(execFile);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export class Client {
  constructor(origin,token){const u=new URL(origin);if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!u.port||u.pathname!=='/'||u.username||u.password||u.search||u.hash)throw Error('Loopback control origin required');if(!token||token.length<32)throw Error('Worker token required');this.origin=u.origin;this.token=token;}
  async call(path,body){const r=await fetch(this.origin+path,{method:'POST',headers:{Authorization:'Bearer '+this.token,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(10000)});const d=await r.json();if(!r.ok){const e=Error(d.error);e.status=r.status;throw e;}return d;}
}
export async function runOnce(client,execute,{modules=['coding'],modes=['test'],signal}={}) {
  const task=await client.call('/v1/worker/claim',{modules,modes});if(!task)return false;
  const abort=new AbortController();let heartbeat;
  const stop=()=>abort.abort();signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop();
  let heartbeatFailure=null;
  heartbeat=setInterval(async()=>{try{await client.call('/v1/worker/tasks/'+task.id+'/heartbeat',{lease:task.lease});}catch(e){heartbeatFailure=e;abort.abort();}},15000);
  const timeout=setTimeout(stop,Math.max(1,task.deadline-Date.now()));
  try {
    const result=await execute(task,abort.signal);
    if(heartbeatFailure)throw heartbeatFailure;
    await client.call('/v1/worker/tasks/'+task.id+'/finish',{lease:task.lease,...result});return true;
  } catch(e) {
    if(!heartbeatFailure){try{await client.call('/v1/worker/tasks/'+task.id+'/finish',{lease:task.lease,outcome:'failed',artifacts:[{name:'worker-error.txt',content:'Worker failed or was interrupted. Check local runtime readiness and task budget.'}]});}catch{}}
    throw e;
  } finally {clearInterval(heartbeat);clearTimeout(timeout);signal?.removeEventListener('abort',stop);}
}
export class DockerExecutor {
  constructor({image,repositories,mode='test',modelPath=null}) {
    if(!/^[a-zA-Z0-9./:_-]+@sha256:[0-9a-f]{64}$/.test(image??''))throw Error('Digest-pinned local worker image required');
    if(!repositories||typeof repositories!=='object'||Array.isArray(repositories))throw Error('Operator repository allowlist required');
    if(!['test','agent'].includes(mode))throw Error('Unknown worker mode');
    if(mode==='agent'&&(!modelPath||!modelPath.startsWith('/')))throw Error('Absolute local GGUF model path required');
    this.mode=mode;this.modelPath=modelPath;this.image=image;this.repositories=repositories;
  }
  async ready(){const info=await exec('docker',['info','--format','{{json .SecurityOptions}}'],{timeout:10000});if(!JSON.parse(info.stdout).includes('name=rootless'))throw Error('Rootless Docker required');await exec('docker',['image','inspect',this.image],{timeout:10000,maxBuffer:1000000});}
  async execute(task,signal) {
    if((task.spec.execution??'test')!==this.mode)throw Error('Worker execution mode mismatch');
    if(task.spec.module!=='coding'||!task.spec.capabilities.includes('test'))throw Error('This executor supports coding test missions only');
    const configured=this.repositories[task.spec.repository];if(typeof configured!=='string')throw Error('Repository is not allowlisted');
    const repo=await realpath(configured);if((await lstat(configured)).isSymbolicLink())throw Error('Repository symlinks prohibited');
    const opts={timeout:10000,maxBuffer:6000000,signal};
    const head=await exec('git',['-C',repo,'rev-parse','--verify',task.spec.commit+'^{commit}'],opts);if(head.stdout.trim()!==task.spec.commit)throw Error('Exact commit unavailable');
    const tree=await exec('git',['-C',repo,'ls-tree','-r','-z',task.spec.commit],opts);
    let count=0;for(const entry of tree.stdout.split('\0').filter(Boolean)){const [meta,path]=entry.split('\t');if(!meta.startsWith('100644 blob ')&&!meta.startsWith('100755 blob '))throw Error('Symlinks and submodules prohibited');if(path?.split('/').some(p=>p.startsWith('.env')||p.endsWith('.pem')||p==='id_rsa'||p==='id_ed25519'))throw Error('Credential files are prohibited in worker source');if(!path||path.startsWith('/')||path.split('/').some(x=>x==='..'||x==='.')||++count>500)throw Error('Source tree exceeds policy');}
    const {stdout:archive}=await exec('git',['-C',repo,'archive','--format=tar',task.spec.commit],{...opts,encoding:'buffer'});
    const directory=await mkdtemp(join(tmpdir(),'sovereign-source-'));const source=join(directory,'source.tar'),name='sovereign-'+task.id;
    try {
      await writeFile(source,archive,{mode:0o644});
      const mission=join(directory,'mission.json');await writeFile(mission,JSON.stringify({id:task.id,spec:task.spec,deadline:task.deadline}),{mode:0o644});
      const agentMounts=[];if(this.mode==='agent'){const model=await realpath(this.modelPath);if(!(await lstat(model)).isFile())throw Error('Local GGUF file required');for(const file of ['container-agent.mjs','opencode.mjs','core.mjs'])agentMounts.push('--mount',`type=bind,source=${fileURLToPath(new URL(file,import.meta.url))},target=/harness/${file},readonly`);agentMounts.push('--mount',`type=bind,source=${model},target=/model.gguf,readonly`,'--mount',`type=bind,source=${mission},target=/mission.json,readonly`);}
      const args=['run','--pull=never','--name',name,'--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--user=65534:65534','--cpus=1','--memory='+(this.mode==='agent'?'4g':'256m'),'--memory-swap='+(this.mode==='agent'?'4g':'256m'),'--pids-limit='+(this.mode==='agent'?'256':'64'),'--ulimit','nofile=256:256','--log-driver=none','--tmpfs','/tmp:rw,nosuid,nodev,size=32m,uid=65534,gid=65534','--tmpfs','/workspace:rw,nosuid,nodev,size=64m,uid=65534,gid=65534','--mount',`type=bind,source=${source},target=/source.tar,readonly`,...agentMounts,'--workdir','/workspace','--entrypoint','/bin/sh',this.image,'-c',this.mode==='agent'?'exec node /harness/container-agent.mjs':'tar -xf /source.tar -C /workspace && exec node --test'];
      const output=await new Promise((resolve,reject)=>{
        if(signal.aborted)return reject(Error('Task interrupted'));
        const proc=spawn('docker',args,{stdio:['ignore','pipe','pipe']});let logs='',overflow=false;
        const read=chunk=>{if(Buffer.byteLength(logs)+chunk.length>150000){overflow=true;proc.kill('SIGTERM');}else logs+=chunk.toString('utf8');};
        proc.stdout.on('data',read);proc.stderr.on('data',read);
        const cancel=()=>proc.kill('SIGTERM');signal.addEventListener('abort',cancel,{once:true});
        proc.once('error',reject);proc.once('close',code=>{signal.removeEventListener('abort',cancel);if(signal.aborted||overflow)return reject(Error('Task interrupted or output exceeded limit'));resolve({code,logs});});
      });
      if(this.mode==='agent'){try{const result=JSON.parse(output.logs.trim());if(!['succeeded','failed'].includes(result.outcome)||!Array.isArray(result.artifacts))throw Error();return result;}catch{throw Error('Private agent returned invalid evidence');}}
      return {outcome:output.code===0?'succeeded':'failed',artifacts:[{name:'test-output.txt',content:output.logs},{name:'execution.json',content:JSON.stringify({commit:task.spec.commit,image:this.image,command:['node','--test'],network:'none',exitCode:output.code,assurance:'rootless Docker worker report; not zkVM proof'})}]};
    }finally{await exec('docker',['rm','-f',name],{timeout:10000}).catch(()=>{});await rm(directory,{recursive:true,force:true});}
  }
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const client=new Client(process.env.SOVEREIGN_ORIGIN??'http://127.0.0.1:8788',process.env.SOVEREIGN_WORKER_TOKEN);
  const {readFile}=await import('node:fs/promises');
  const executor=new DockerExecutor({image:process.env.SOVEREIGN_IMAGE,mode:process.env.SOVEREIGN_MODE??'test',modelPath:process.env.SOVEREIGN_GGUF,repositories:JSON.parse(await readFile(process.env.SOVEREIGN_REPOSITORIES,'utf8'))});
  await executor.ready();const shutdown=new AbortController();for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>shutdown.abort());
  console.log('Sovereign offline test worker ready. No external model provider.');
  while(!shutdown.signal.aborted){try{await runOnce(client,executor.execute.bind(executor),{signal:shutdown.signal,modes:[executor.mode]});}catch{console.error('Worker attempt failed; no automatic task retry.');}if(!shutdown.signal.aborted)await pause(2000);}
}
