#!/usr/bin/env node
// OpenHackathons CLI: local tools, no subscription or cloud provisioning.
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
const [cmd,...args]=process.argv.slice(2);
try {
if(cmd==='init'){
 const name=args[0];if(!name||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(name))throw Error('Use: init <safe-project-name>');
 const dir=resolve(name);await mkdir(dir);await writeFile(join(dir,'index.html'),'<!doctype html><html><head><title>'+name+'</title></head><body><h1>'+name+'</h1><p>Make something useful.</p></body></html>');await writeFile(join(dir,'README.md'),'# '+name+'\n\n## Problem\n\n## Run\nOpen index.html in a browser.\n\n## Evidence\nRecord tests and limitations.\n');console.log('Created local project at '+dir);
}else if(cmd==='clone'){
 const [url,folder]=args;if(!url||!folder||folder.startsWith('-')||!/^https:\/\//.test(url))throw Error('Use: clone <https-repository-url> <new-folder>');const u=new URL(url);if(u.username||u.password)throw Error('Do not embed credentials in URLs. Use your Git credential manager.');const r=spawnSync('git',['clone','--',url,folder],{stdio:'inherit'});if(r.status!==0)throw Error('Git clone failed. Check repository access.');console.log('Repository cloned locally. No dependencies or project code were executed.');
}else if(cmd==='check'){
 const files=await readdir('.');console.log(files.length+' root entries');console.log(files.includes('README.md')?'README present':'Add a README with setup and limitations');console.log(files.includes('index.html')?'Browser entry point present':'No root HTML entry point');console.log('This is a file check, not a test runner or security assessment.');
}else if(cmd==='unpack'){
 const [input,target]=args;if(!input||!target)throw Error('Use: unpack <workspace.json> <new-directory>');const data=JSON.parse(await readFile(input,'utf8'));if(!data.files||typeof data.files!=='object')throw Error('Invalid workspace export');const entries=Object.entries(data.files);if(entries.length>30)throw Error('Too many files');for(const [name,content] of entries){if(!/^[a-zA-Z0-9_.-]+$/.test(name)||name==='..'||typeof content!=='string'||content.length>150000)throw Error('Unsafe or unsupported file: '+name)}const dir=resolve(target);await mkdir(dir);for(const [name,content] of entries)await writeFile(join(dir,name),content,{flag:'wx'});console.log('Workspace unpacked into '+dir);
}else if(cmd==='plan'){
 const idea=args.join(' ');if(!idea)throw Error('Use: plan <your idea>. Requires a local Ollama server and an installed model.');const model=process.env.OPENHACK_MODEL||'llama3.2';const r=await fetch('http://127.0.0.1:11434/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,stream:false,prompt:'Write a concise hackathon build plan. Include one core workflow, tools, tests, failure cases and a demo. Do not claim to execute anything. Idea: '+idea}),signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error('Local Ollama returned '+r.status);const data=await r.json();console.log(data.response);
}else console.log('OpenHackathons CLI\n\nnode openhack.mjs init <name>\nnode openhack.mjs clone <https-git-url> <folder>\nnode openhack.mjs check\nnode openhack.mjs unpack <workspace.json> <folder>\nnode openhack.mjs plan <idea>\n\nRuns on your own machine, not a cloud sandbox. AI planning requires local Ollama; default model llama3.2, override with OPENHACK_MODEL. No code is executed from AI output.');
}catch(e){console.error(e.message);process.exitCode=1}
