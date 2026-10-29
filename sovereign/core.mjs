import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID, generateKeyPairSync, createPublicKey, sign, verify } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}
export const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
export class Fault extends Error { constructor(status, message) { super(message); this.status = status; } }
const requireThat = (ok, message, status = 400) => { if (!ok) throw new Fault(status, message); };
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
export function validateTask(x) {
  requireThat(x && typeof x === 'object' && !Array.isArray(x), 'Task object required');
  requireThat(text(x.project, 80) && text(x.prompt, 8000), 'Project and prompt required');
  requireThat(['coding', 'business', 'security'].includes(x.module), 'Unsupported module');
  requireThat(/^[0-9a-f]{40}$/.test(x.commit), 'Exact 40-character Git commit required');
  requireThat(text(x.repository, 200) && /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(x.repository), 'Use owner/repository identity');
  requireThat(Number.isSafeInteger(x.budgetSeconds) && x.budgetSeconds >= 1 && x.budgetSeconds <= 3600, 'Budget must be 1–3600 seconds');
  requireThat(Array.isArray(x.capabilities) && x.capabilities.length <= 4 && x.capabilities.every(v => ['read', 'edit', 'test', 'local-security-check'].includes(v)), 'Unsupported capability');
  requireThat(x.network === 'deny', 'This release supports network-deny workspaces only');
  requireThat(x.module !== 'security' || text(x.authorization, 2000), 'Security tasks require an authorization statement');
  return Object.fromEntries(['project','prompt','module','repository','commit','budgetSeconds','capabilities','network','authorization'].filter(k => x[k] !== undefined).map(k => [k,x[k]]));
}
export function verifyReceipt(receipt, trustedKey) {
  try {
    return receipt.manifest.schema === 'hackasandbox.evidence.v1' && receipt.manifestDigest === digest(receipt.manifest) &&
      verify(null, Buffer.from(canonical(receipt.manifest)), trustedKey, Buffer.from(receipt.signature, 'base64'));
  } catch { return false; }
}
export class Control {
  constructor(directory, { now = () => Date.now(), maxActive = 4 } = {}) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.now = now; this.maxActive = maxActive;
    const path = join(directory, 'signing.pem');
    if (!existsSync(path)) writeFileSync(path, generateKeyPairSync('ed25519').privateKey.export({ type:'pkcs8',format:'pem' }), { mode:0o600,flag:'wx' });
    this.key = readFileSync(path); this.publicKey = createPublicKey(this.key).export({ type:'spki',format:'pem' });
    this.db = new DatabaseSync(join(directory, 'control.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,spec TEXT NOT NULL,state TEXT NOT NULL,created INTEGER NOT NULL,deadline INTEGER NOT NULL,lease TEXT,leaseUntil INTEGER,receipt TEXT,approval TEXT);
      CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY AUTOINCREMENT,at INTEGER NOT NULL,task TEXT NOT NULL,event TEXT NOT NULL,previous TEXT NOT NULL,hash TEXT NOT NULL);`);
  }
  transaction(fn) { this.db.exec('BEGIN IMMEDIATE'); try { const r=fn();this.db.exec('COMMIT');return r; } catch(e){this.db.exec('ROLLBACK');throw e;} }
  event(id,event) {
    const previous=this.db.prepare('SELECT hash FROM audit ORDER BY seq DESC LIMIT 1').get()?.hash ?? '0'.repeat(64);
    const at=this.now();const hash=digest({at,task:id,event,previous});
    this.db.prepare('INSERT INTO audit(at,task,event,previous,hash) VALUES(?,?,?,?,?)').run(at,id,event,previous,hash);
  }
  row(id) { const r=this.db.prepare('SELECT * FROM tasks WHERE id=?').get(id);requireThat(r,'Task not found',404);return r; }
  view(r) { return {id:r.id,spec:JSON.parse(r.spec),state:r.state,created:r.created,deadline:r.deadline,leaseUntil:r.leaseUntil,receipt:r.receipt?JSON.parse(r.receipt):null,approval:r.approval?JSON.parse(r.approval):null}; }
  list() { return this.db.prepare('SELECT * FROM tasks ORDER BY created DESC LIMIT 100').all().map(r=>this.view(r)); }
  get(id) { return this.view(this.row(id)); }
  create(input) {
    const spec=validateTask(input),id=randomUUID(),now=this.now();
    return this.transaction(()=>{requireThat(this.db.prepare("SELECT count(*) AS n FROM tasks WHERE state IN ('queued','running','awaiting_approval','approved')").get().n<100,'Active task quota reached',429);
      this.db.prepare('INSERT INTO tasks(id,spec,state,created,deadline) VALUES(?,?,?,?,?)').run(id,canonical(spec),'queued',now,now+spec.budgetSeconds*1000);this.event(id,'created');return this.get(id);});
  }
  expire() {
    const now=this.now();
    for(const r of this.db.prepare("SELECT * FROM tasks WHERE (state IN ('queued','running') AND deadline<=?) OR (state='running' AND leaseUntil<=?)").all(now,now)) {
      this.db.prepare("UPDATE tasks SET state='failed',lease=NULL,leaseUntil=NULL WHERE id=?").run(r.id);this.event(r.id,'expired');
    }
  }
  claim() {return this.transaction(()=>{this.expire();
    requireThat(this.db.prepare("SELECT count(*) AS n FROM tasks WHERE state='running'").get().n<this.maxActive,'Worker slots full',429);
    const r=this.db.prepare("SELECT * FROM tasks WHERE state='queued' ORDER BY created,id LIMIT 1").get();if(!r)return null;
    const lease=randomUUID(),until=Math.min(r.deadline,this.now()+60000);
    this.db.prepare("UPDATE tasks SET state='running',lease=?,leaseUntil=? WHERE id=?").run(lease,until,r.id);this.event(r.id,'claimed');return {...this.get(r.id),lease};});}
  lease(id,lease) {const r=this.row(id);requireThat(r.state==='running'&&r.lease===lease&&r.leaseUntil>this.now()&&r.deadline>this.now(),'Lease invalid or expired',409);return r;}
  heartbeat(id,lease) {return this.transaction(()=>{const r=this.lease(id,lease);this.db.prepare('UPDATE tasks SET leaseUntil=? WHERE id=?').run(Math.min(r.deadline,this.now()+60000),id);return this.get(id);});}
  finish(id,lease,input) {
    requireThat(input && ['succeeded','failed'].includes(input.outcome),'Outcome required');
    requireThat(Array.isArray(input.artifacts)&&input.artifacts.length<=20,'Up to 20 artifacts allowed');
    let total=0;const artifacts=input.artifacts.map(a=>{requireThat(a&&text(a.name,120)&&/^[a-zA-Z0-9_.-]+$/.test(a.name),'Invalid artifact name');
      requireThat(typeof a.content==='string'&&a.content.length<=200000,'UTF-8 artifact content required');const bytes=Buffer.from(a.content);total+=bytes.length;
      return {name:a.name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};});
    requireThat(total<=500000&&new Set(artifacts.map(a=>a.name)).size===artifacts.length,'Duplicate names or artifact budget exceeded');
    return this.transaction(()=>{const r=this.lease(id,lease);const manifest={schema:'hackasandbox.evidence.v1',taskId:id,taskDigest:digest(JSON.parse(r.spec)),commit:JSON.parse(r.spec).commit,outcome:input.outcome,artifacts,recordedAt:this.now(),assurance:'worker-reported; content hashes verified by control plane',zkProof:{status:'not_generated'}};
      const receipt={manifest,manifestDigest:digest(manifest),signature:sign(null,Buffer.from(canonical(manifest)),this.key).toString('base64')};
      this.db.prepare('UPDATE tasks SET state=?,receipt=?,lease=NULL,leaseUntil=NULL WHERE id=?').run(input.outcome==='succeeded'?'awaiting_approval':'failed',canonical(receipt),id);this.event(id,'evidence_recorded');return this.get(id);});
  }
  approve(id,input) {return this.transaction(()=>{const r=this.row(id);requireThat(r.state==='awaiting_approval','Task is not awaiting approval',409);
    const receipt=JSON.parse(r.receipt);requireThat(input.manifestDigest===receipt.manifestDigest,'Approval must bind the current manifest',409);
    requireThat(['approve','reject'].includes(input.decision),'Decision required');
    const approval={manifestDigest:receipt.manifestDigest,nonce:randomUUID(),expiresAt:this.now()+300000,scope:'export-evidence',decision:input.decision,consumed:false};
    this.db.prepare('UPDATE tasks SET state=?,approval=? WHERE id=?').run(input.decision==='approve'?'approved':'rejected',canonical(approval),id);this.event(id,input.decision);return this.get(id);});}
  consume(id,input) {return this.transaction(()=>{const r=this.row(id),a=r.approval?JSON.parse(r.approval):{};
    requireThat(r.state==='approved'&&!a.consumed&&a.expiresAt>this.now()&&a.nonce===input.nonce&&a.manifestDigest===input.manifestDigest,'Approval expired, consumed or mismatched',409);
    a.consumed=true;this.db.prepare("UPDATE tasks SET state='completed',approval=? WHERE id=?").run(canonical(a),id);this.event(id,'evidence_exported');return {receipt:JSON.parse(r.receipt),approval:a};});}
  audit() {return this.db.prepare('SELECT * FROM audit ORDER BY seq').all();}
  close(){this.db.close();}
}
