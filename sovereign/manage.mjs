#!/usr/bin/env node
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,readFile,lstat,realpath} from 'node:fs/promises';
import {homedir} from 'node:os';
import {resolve,join} from 'node:path';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const directory=resolve(process.env.SOVEREIGN_CONFIG_DIR??join(homedir(),'.config','hackasandbox'));
const configPath=join(directory,'runtime.json');
const exec=promisify(execFile);
export async function doctor(config){const checks=[];checks.push({name:'Node 24+',ok:Number(process.versions.node.split('.')[0])>=24});checks.push({name:'Control credentials',ok:typeof config.SOVEREIGN_OPERATOR_TOKEN==='string'&&config.SOVEREIGN_OPERATOR_TOKEN.length>=32&&typeof config.SOVEREIGN_WORKER_TOKEN==='string'&&config.SOVEREIGN_WORKER_TOKEN.length>=32&&config.SOVEREIGN_OPERATOR_TOKEN!==config.SOVEREIGN_WORKER_TOKEN});
 try{const out=await exec('docker',['info','--format','{{json .SecurityOptions}}'],{timeout:5000});checks.push({name:'Rootless Docker',ok:JSON.parse(out.stdout).includes('name=rootless')});}catch{checks.push({name:'Rootless Docker',ok:false});}
 checks.push({name:'Pinned local image configured',ok:/@sha256:[0-9a-f]{64}$/.test(config.SOVEREIGN_IMAGE??'')});
 if(config.SOVEREIGN_IMAGE)try{await exec('docker',['image','inspect',config.SOVEREIGN_IMAGE],{timeout:5000,maxBuffer:1000000});checks.push({name:'Pinned image installed locally',ok:true});}catch{checks.push({name:'Pinned image installed locally',ok:false});}
 if(config.SOVEREIGN_REPOSITORIES)try{const repos=JSON.parse(await readFile(config.SOVEREIGN_REPOSITORIES,'utf8'));const valid=Object.keys(repos).length>0&&Object.values(repos).every(v=>typeof v==='string'&&v.startsWith('/'));checks.push({name:'Repository allowlist',ok:valid});}catch{checks.push({name:'Repository allowlist',ok:false});}else checks.push({name:'Repository allowlist',ok:false});
 if(config.SOVEREIGN_MODE==='agent'){try{const model=await lstat(config.SOVEREIGN_GGUF);checks.push({name:'GGUF model file',ok:model.isFile()&&!model.isSymbolicLink()});}catch{checks.push({name:'GGUF model file',ok:false});}}
 return checks;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const command=process.argv[2]??'help';
 try{
  if(command==='init'){await mkdir(directory,{recursive:true,mode:0o700});if((await lstat(directory)).isSymbolicLink())throw Error('Config directory must not be a symlink');const config={SOVEREIGN_OPERATOR_TOKEN:randomBytes(32).toString('hex'),SOVEREIGN_WORKER_TOKEN:randomBytes(32).toString('hex'),SOVEREIGN_DATA:join(directory,'data'),SOVEREIGN_ORIGIN:'http://127.0.0.1:8788'};await writeFile(configPath,JSON.stringify(config,null,2)+'\n',{mode:0o600,flag:'wx'});console.log('Private configuration created at '+configPath+'. No credentials printed.');}
  else if(['doctor','start','worker'].includes(command)){
   const info=await lstat(configPath);if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077))throw Error('Runtime config must be a regular file with mode 0600');
   let config;try{config=JSON.parse(await readFile(configPath,'utf8'));}catch{throw Error('Runtime configuration is not valid JSON');}
   if(command==='doctor'){const checks=await doctor(config);for(const check of checks)console.log((check.ok?'PASS ':'NEEDS SETUP ')+check.name);if(checks.some(c=>!c.ok))process.exitCode=1;}
   else{for(const k of Object.keys(config))if(!k.startsWith('SOVEREIGN_')||typeof config[k]!=='string')throw Error('Only SOVEREIGN_ string settings allowed');const script=join(root,'sovereign',command==='start'?'server.mjs':'worker.mjs');const child=spawn(process.execPath,[script],{cwd:root,env:{...process.env,...config},stdio:'inherit'});for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>child.kill(sig));child.on('exit',code=>process.exit(code??1));child.on('error',()=>{console.error('Service launch failed');process.exitCode=1;});}
  }else if(command==='service-files'){
   const target=resolve(process.argv[3]??join(root,'outputs','systemd'));await mkdir(target,{recursive:true,mode:0o700});
   const install=await realpath(root);if(/[\s%"\\]/.test(install)||/[\s%"\\]/.test(process.execPath))throw Error('systemd generation requires a path without whitespace or systemd specifiers');
   for(const role of ['control','worker']){const body=`[Unit]\nDescription=HackaSandbox Sovereign ${role}\nAfter=network.target\n\n[Service]\nType=simple\nWorkingDirectory=${install}\nExecStart=${process.execPath} ${install}sovereign/manage.mjs ${role==='control'?'start':'worker'}\nRestart=on-failure\nRestartSec=5\nTimeoutStopSec=30\nUMask=0077\n\n[Install]\nWantedBy=default.target\n`;await writeFile(join(target,'hackasandbox-'+role+'.service'),body);}
   console.log('Review the two user-service files in '+target+'. They have not been installed or enabled.');
  }else console.log('Usage: node sovereign/manage.mjs init|doctor|start|worker|service-files [output-directory]');
 }catch(e){console.error(e.code==='EEXIST'?'Configuration already exists; kept unchanged.':e.message==='ENOENT'?'Run init and configure prerequisites first.':e.message);process.exitCode=1;}
}
