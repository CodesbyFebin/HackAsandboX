import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {DatabaseSync} from 'node:sqlite';import ts from 'typescript';
import {validateBody} from '../lib/validation.ts';import * as statements from '../lib/workspace-store.ts';
const source=ts.transpileModule(fs.readFileSync('app/api/hub/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function database(path){const sql=new DatabaseSync(path);sql.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');return sql}
function bridge(sql){return {prepare(query){const bind=(...values)=>({first:async()=>sql.prepare(query).get(...values)??null,all:async()=>({results:sql.prepare(query).all(...values)}),run:async()=>sql.prepare(query).run(...values)});return {...bind(),bind}}}}
const req=(body,method='POST',origin='https://test.example')=>new Request('https://test.example/api/hub',{method,headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const user=id=>({userId:id,email:id+'@example.test',fullName:null});const project={name:'Boundary test',files:{'index.html':'<h1>Test</h1>'}};
test('API handlers enforce ownership and recovery against real SQLite with identity fixtures',async()=>{const dir=mkdtempSync(join(tmpdir(),'openhack-api-'));let sql=database(join(dir,'test.db'));try{
for(const file of fs.readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));
let identity=null;const env={get DB(){return bridge(sql)}};const exports={};vm.runInNewContext(source,{exports,require:id=>id.includes('chatgpt-auth')?{getChatGPTUser:async()=>identity}:id==='cloudflare:workers'?{env}:id.includes('validation')?{validateBody}:id.includes('workspace-store')?statements:id.includes('catalog')?{events:[]}:null,Response,URL,crypto,JSON,Date,Promise});
assert.equal((await exports.POST(req({kind:'project',body:project}))).status,401);
identity=user('alice');assert.equal((await exports.POST(req({kind:'project',body:project},'POST','https://evil.example'))).status,403);
const create=await exports.POST(req({kind:'project',body:project}));assert.equal(create.status,200);const {id}=await create.json();assert.equal(sql.prepare('SELECT owner FROM records WHERE id=?').get(id).owner,'alice');
identity=user('bob');assert.equal((await exports.GET()).status,200);assert.equal((await(await exports.GET()).json()).records.length,0);
assert.equal((await exports.POST(req({kind:'project',id,body:{...project,name:'Stolen'}}))).status,404);
assert.equal((await exports.DELETE(new Request('https://test.example/api/hub?id='+id,{method:'DELETE',headers:{origin:'https://test.example'}}))).status,404);
assert.equal((await exports.POST(req({kind:'showcase',body:{name:'Stolen',projectId:id,description:'Not mine'}}))).status,403);
identity=user('alice');assert.equal((await exports.POST(req({kind:'project',id,body:{...project,name:'Updated'}}))).status,200);
assert.equal((await exports.POST(req({kind:'showcase',body:{name:'Public build',projectId:id,description:'A real project'}}))).status,200);
assert.equal((await(await exports.GET()).json()).showcases.length,1);
assert.equal((await exports.DELETE(new Request('https://test.example/api/hub?id='+id,{method:'DELETE',headers:{origin:'https://test.example'}}))).status,200);
let state=await(await exports.GET()).json();assert.equal(state.records.some(r=>r.id===id),false);assert.equal(state.trash[0].id,id);assert.equal(state.showcases.length,0);
identity=user('bob');assert.equal((await exports.PATCH(req({id},'PATCH'))).status,409);
identity=user('alice');assert.equal((await exports.PATCH(req({id},'PATCH'))).status,200);assert.equal((await(await exports.GET()).json()).showcases.length,1);
assert.equal((await exports.POST(req({kind:'saved',body:{eventId:'same'}}))).status,200);assert.equal((await exports.POST(req({kind:'saved',body:{eventId:'same'}}))).status,409);
assert.equal((await exports.POST(req({kind:'reservation',body:{name:'Build',status:'running'}}))).status,200);assert.equal((await exports.POST(req({kind:'reservation',body:{name:'Duplicate'}}))).status,409);assert.equal(JSON.parse(sql.prepare("SELECT body FROM records WHERE kind='reservation'").get().body).status,'queued');
identity=user('charlie');const ids=[];for(let i=0;i<10;i++){const r=await exports.POST(req({kind:'project',body:{...project,name:'P'+i}}));assert.equal(r.status,200);ids.push((await r.json()).id)}assert.equal((await exports.POST(req({kind:'project',body:project}))).status,429);
await exports.DELETE(new Request('https://test.example/api/hub?id='+ids[0],{method:'DELETE',headers:{origin:'https://test.example'}}));assert.equal((await exports.POST(req({kind:'project',body:project}))).status,200);assert.equal((await exports.PATCH(req({id:ids[0]},'PATCH'))).status,409);
sql.close();sql=database(join(dir,'test.db'));identity=user('alice');state=await(await exports.GET()).json();assert.equal(state.records.find(r=>r.id===id).body.files['index.html'],'<h1>Test</h1>');
}finally{sql.close();rmSync(dir,{recursive:true,force:true})}});
