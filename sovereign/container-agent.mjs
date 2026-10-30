// Runs only inside the networkless Docker sandbox. No control-plane credentials.
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
async function hashFile(path){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
import {OpenCodeAdapter} from './opencode.mjs';
const exec=promisify(execFile),children=[];
async function command(args){return exec(args[0],args.slice(1),{cwd:'/workspace',timeout:30000,maxBuffer:150000});}
function service(binary,args){const child=spawn(binary,args,{cwd:'/workspace',stdio:'ignore',env:process.env});children.push(child);child.on('error',()=>{});return child;}
async function health(url,child){for(let i=0;i<120;i++){if(child.exitCode!==null)throw Error('Local runtime exited');try{const r=await fetch(url,{signal:AbortSignal.timeout(1000),redirect:'error'});if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw Error('Local runtime startup timed out');}
try{
  const task=JSON.parse(await readFile('/mission.json','utf8'));
  await command(['tar','-xf','/source.tar','-C','/workspace']);
  await command(['git','init','-q']);await command(['git','add','-A']);await command(['git','-c','user.name=HackaSandbox','-c','user.email=sandbox@localhost','commit','--allow-empty','-qm','Pinned source snapshot']);
  await mkdir('/tmp/config',{recursive:true});await mkdir('/tmp/data',{recursive:true});
  const config={model:'private/local',enabled_providers:['private'],autoupdate:false,share:'disabled',provider:{private:{npm:'@ai-sdk/openai-compatible',name:'Private llama.cpp',options:{baseURL:'http://127.0.0.1:8080/v1',apiKey:'local-only'},models:{local:{name:'local',limit:{context:2048,output:512}}}}},permission:{external_directory:'deny',webfetch:'deny',websearch:'deny',read:'allow',edit:'allow',bash:{'*':'deny','node --test':'allow','git diff':'allow'}}};
  await writeFile('/tmp/opencode.json',JSON.stringify(config));
  process.env.OPENCODE_CONFIG='/tmp/opencode.json';process.env.OPENCODE_SERVER_PASSWORD='sandbox-local-session';process.env.XDG_CONFIG_HOME='/tmp/config';process.env.XDG_DATA_HOME='/tmp/data';
  const model=service('llama-server',['--model','/model.gguf','--alias','local','--host','127.0.0.1','--port','8080','--ctx-size','2048','--threads','2','--n-predict','512','--n-gpu-layers','0']);
  await health('http://127.0.0.1:8080/health',model);
  const agent=service('opencode',['serve','--hostname','127.0.0.1','--port','4096']);
  // Basic-auth health is checked by the adapter transport rather than a public probe.
  await new Promise(r=>setTimeout(r,1500));if(agent.exitCode!==null)throw Error('OpenCode exited');
  const adapter=new OpenCodeAdapter({url:'http://127.0.0.1:4096',password:'sandbox-local-session',providerID:'private',modelID:'local'});
  const result=await adapter.run(task.spec.prompt,{deadline:task.deadline-10000,localOnlyConfirmed:true});
  const patch=(await command(['git','diff','HEAD','--no-ext-diff','--no-textconv','--','.'])).stdout;
  const untracked=(await command(['git','ls-files','--others','--exclude-standard'])).stdout;
  // Include newly created files in the reviewable patch without committing them.
  if(untracked.trim())await command(['git','add','-N','.']);
  const completePatch=untracked.trim()?(await command(['git','diff','HEAD','--no-ext-diff','--no-textconv'])).stdout:patch;
  let test,code=0;try{test=(await command(['node','--test'])).stdout;}catch(e){test=String(e.stdout??'')+String(e.stderr??'');code=typeof e.code==='number'?e.code:1;}
  const modelSha256=await hashFile('/model.gguf');
  const sourceArchiveSha256=await hashFile('/source.tar');
  const out={outcome:code===0&&completePatch.length<=120000&&test.length<=30000?'succeeded':'failed',artifacts:[{name:'patch.diff',content:completePatch.slice(0,120000)},{name:'test-output.txt',content:test.slice(0,30000)},{name:'agent-result.json',content:JSON.stringify({sessionId:result.sessionId,preview:JSON.stringify(result.response).slice(0,25000),truncated:JSON.stringify(result.response).length>25000})},{name:'execution.json',content:JSON.stringify({commit:task.spec.commit,mode:'private-agent',modelSha256,sourceArchiveSha256,network:'none',inference:'local-llama.cpp',exitCode:code,patchTruncated:completePatch.length>120000,testOutputTruncated:test.length>30000,patchSha256:createHash('sha256').update(completePatch).digest('hex'),zkProof:{status:'not_generated'}})}]};
  console.log(JSON.stringify(out));
}catch{console.log(JSON.stringify({outcome:'failed',artifacts:[{name:'agent-error.txt',content:'Private agent run failed. Verify the reviewed image includes OpenCode, cached provider adapter, llama-server, Node, Git and tar, and that the GGUF model fits the resource budget.'}]}));process.exitCode=1;}
finally{for(const child of children)child.kill('SIGTERM');}
