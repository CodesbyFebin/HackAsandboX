"""Hacksandbox: dependency-free local control plane. Python 3.11+, rootless Docker."""
import base64, hashlib, hmac, json, os, re, secrets, sqlite3, subprocess, tempfile, threading, time
from pathlib import Path
RECIPES={'check':['node','--check','server.mjs'],'test':['node','--test'],'build':['npm','--offline','run','build'],'serve':['node','server.mjs']}
class Problem(Exception):
 def __init__(self,status,message): self.status=status; self.message=message

def validate_files(files):
 if not isinstance(files,dict) or not 1<=len(files)<=30: raise Problem(400,'Use 1–30 text files')
 total=0
 for name,body in files.items():
  if not isinstance(name,str) or not re.fullmatch(r'[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*',name) or any(p in ('.','..') for p in name.split('/')) or len(name)>120: raise Problem(400,'Invalid relative file path')
  if not isinstance(body,str) or len(body.encode())>150000: raise Problem(400,'Each file must be text under 150 KB')
  total+=len(body.encode())
 if total>500000: raise Problem(400,'Project limit is 500 KB')
 return files

def digest(files): return hashlib.sha256(json.dumps(files,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def password_hash(password,salt): return hashlib.scrypt(password.encode(),salt=salt,n=16384,r=8,p=1).hex()
class Store:
 def __init__(self,path):
  self.path=str(path)
  with self.db() as db:
   db.executescript('''PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE,salt TEXT,password TEXT);
CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,owner TEXT,expires INTEGER);
CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,owner TEXT,name TEXT,files TEXT,updated INTEGER);
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,owner TEXT,project TEXT,recipe TEXT,status TEXT,files TEXT,source_hash TEXT,created INTEGER,finished INTEGER,exit_code INTEGER,logs TEXT DEFAULT '',container TEXT,preview_token TEXT,receipt TEXT,cancel INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS inference_runs(id TEXT PRIMARY KEY,owner TEXT,project TEXT,model TEXT,status TEXT,created INTEGER,duration_ms INTEGER);
CREATE INDEX IF NOT EXISTS inference_owner_created ON inference_runs(owner,created);
CREATE INDEX IF NOT EXISTS jobs_owner ON jobs(owner,status);
''')
 def db(self):
  db=sqlite3.connect(self.path,timeout=10);db.row_factory=sqlite3.Row;return db
 def register(self,email,password,invite,expected):
  if not expected or not hmac.compare_digest(str(invite),expected):raise Problem(403,'Operator invite required')
  if not isinstance(email,str) or not re.fullmatch(r'[^\s@]{1,80}@[^\s@]{1,80}\.[^\s@]{1,30}',email) or not isinstance(password,str) or not 12<=len(password)<=128:raise Problem(400,'Use an email and a 12–128 character password')
  salt=secrets.token_bytes(16);uid=secrets.token_hex(16)
  try:
   with self.db() as db:db.execute('INSERT INTO users VALUES(?,?,?,?)',(uid,email.lower(),salt.hex(),password_hash(password,salt)))
  except sqlite3.IntegrityError:raise Problem(409,'Account already exists')
  return self.login(email,password)
 def login(self,email,password):
  with self.db() as db:
   row=db.execute('SELECT * FROM users WHERE email=?',(str(email).lower(),)).fetchone()
   candidate=password_hash(str(password)[:128],bytes.fromhex(row['salt']) if row else bytes(16))
   if not row or not hmac.compare_digest(candidate,row['password']):raise Problem(401,'Invalid credentials')
   token=secrets.token_urlsafe(32);db.execute('DELETE FROM sessions WHERE expires<?',(int(time.time()),));db.execute('INSERT INTO sessions VALUES(?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),row['id'],int(time.time())+43200))
  return {'token':token,'expiresIn':43200}
 def owner(self,token):
  with self.db() as db:r=db.execute('SELECT owner FROM sessions WHERE hash=? AND expires>?',(hashlib.sha256(token.encode()).hexdigest(),int(time.time()))).fetchone()
  if not r:raise Problem(401,'Sign in required')
  return r['owner']
 def logout(self,token):
  with self.db() as db:db.execute('DELETE FROM sessions WHERE hash=?',(hashlib.sha256(token.encode()).hexdigest(),))
 def project(self,owner,pid):
  with self.db() as db:r=db.execute('SELECT * FROM projects WHERE id=? AND owner=?',(pid,owner)).fetchone()
  if not r:raise Problem(404,'Project not found')
  d=dict(r);d['files']=json.loads(d['files']);return d
 def save(self,owner,name,files,pid=None):
  validate_files(files)
  if not isinstance(name,str) or not 1<=len(name.strip())<=120:raise Problem(400,'Project name required (max 120)')
  now=int(time.time())
  with self.db() as db:
   db.execute('BEGIN IMMEDIATE')
   if pid:
    r=db.execute('UPDATE projects SET name=?,files=?,updated=? WHERE id=? AND owner=?',(name,json.dumps(files),now,pid,owner))
    if not r.rowcount:raise Problem(404,'Project not found')
   else:
    if db.execute('SELECT COUNT(*) FROM projects WHERE owner=?',(owner,)).fetchone()[0]>=10:raise Problem(429,'Ten project limit')
    pid=secrets.token_hex(16);db.execute('INSERT INTO projects VALUES(?,?,?,?,?)',(pid,owner,name,json.dumps(files),now))
  return self.project(owner,pid)
 def queue(self,owner,pid,recipe):
  if recipe not in RECIPES:raise Problem(400,'Unknown recipe')
  p=self.project(owner,pid);jid=secrets.token_hex(16)
  with self.db() as db:
   db.execute('BEGIN IMMEDIATE')
   if db.execute("SELECT COUNT(*) FROM jobs WHERE owner=? AND status IN ('queued','running')",(owner,)).fetchone()[0]>=3:raise Problem(429,'Three active jobs per participant')
   if db.execute('SELECT COUNT(*) FROM jobs WHERE owner=?',(owner,)).fetchone()[0]>=100:raise Problem(429,'100 retained jobs: ask the operator to archive completed evidence')
   db.execute('INSERT INTO jobs(id,owner,project,recipe,status,files,source_hash,created) VALUES(?,?,?,?,?,?,?,?)',(jid,owner,pid,recipe,'queued',json.dumps(p['files']),digest(p['files']),int(time.time())))
  return self.job(owner,jid)
 def job(self,owner,jid):
  with self.db() as db:r=db.execute('SELECT * FROM jobs WHERE id=? AND owner=?',(jid,owner)).fetchone()
  if not r:raise Problem(404,'Job not found')
  d=dict(r);d.pop('files');d.pop('owner');d.pop('container');d.pop('preview_token');d['receipt']=json.loads(d['receipt']) if d['receipt'] else None;return d
 def list(self,owner):
  with self.db() as db:
   ps=[dict(p) for p in db.execute('SELECT id,name,updated FROM projects WHERE owner=? ORDER BY updated DESC',(owner,))];ids=[r['id'] for r in db.execute('SELECT id FROM jobs WHERE owner=? ORDER BY created DESC LIMIT 30',(owner,))]
  return {'projects':ps,'jobs':[self.job(owner,j) for j in ids]}
 def cancel(self,owner,jid):
  self.job(owner,jid)
  with self.db() as db:db.execute("UPDATE jobs SET cancel=1,status=CASE WHEN status='queued' THEN 'cancelled' ELSE status END WHERE id=? AND owner=? AND status IN ('queued','running')",(jid,owner))
 def claim(self):
  with self.db() as db:
   db.execute('BEGIN IMMEDIATE');r=db.execute("SELECT * FROM jobs WHERE status='queued' AND cancel=0 ORDER BY created LIMIT 1").fetchone()
   if not r:return None
   db.execute("UPDATE jobs SET status='running' WHERE id=?",(r['id'],));return dict(r)
 def recover(self):
  with self.db() as db:rows=db.execute("SELECT container FROM jobs WHERE status='running' AND container IS NOT NULL").fetchall()
  for r in rows:subprocess.run(['docker','rm','-f',r['container']],capture_output=True,timeout=20)
  with self.db() as db:db.execute("UPDATE jobs SET status='interrupted',finished=?,logs=logs||'\nRunner restarted; execution interrupted.' WHERE status='running'",(int(time.time()),))

class DockerRunner:
 def __init__(self,store,image):self.store=store;self.image=image;self.ready=False;self.reason='Runtime not checked';self.stopping=threading.Event()
 def check(self):
  if not re.fullmatch(r'[a-zA-Z0-9./:_-]+@sha256:[0-9a-f]{64}',self.image or ''):self.reason='Set HACKSANDBOX_IMAGE to an operator-reviewed Node 24 image digest';return False
  try:
   r=subprocess.run(['docker','info','--format','{{json .SecurityOptions}}'],capture_output=True,text=True,timeout=10)
   if r.returncode or 'rootless' not in r.stdout:self.reason='A rootless Docker daemon is required';return False
   r=subprocess.run(['docker','image','inspect',self.image],capture_output=True,timeout=10)
   if r.returncode:self.reason='Prepare the pinned image locally first (runner never pulls images)';return False
  except (OSError,subprocess.TimeoutExpired):self.reason='Rootless Docker unavailable';return False
  self.ready=True;self.reason='Rootless Docker ready';return True
 def append(self,jid,chunk):
  with self.store.db() as db:db.execute('UPDATE jobs SET logs=substr(logs||?,1,64000) WHERE id=?',(chunk,jid))
 def execute(self,job):
  jid=job['id'];cid=None;code=None;status='failed';start=time.time();limit=900 if job['recipe']=='serve' else 60
  try:
   with tempfile.TemporaryDirectory(prefix='hacksandbox-') as work:
    os.chmod(work,0o755);files=validate_files(json.loads(job['files']))
    for name,content in files.items():
     p=Path(work,name);p.parent.mkdir(parents=True,exist_ok=True)
     for parent in p.parents:
      if parent==Path(work):break
      parent.chmod(0o755)
     p.write_text(content);p.chmod(0o644)
    args=['docker','create','--pull=never','--name','hacksandbox-'+jid,'--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--user=65534:65534','--cpus=1','--memory=256m','--memory-swap=256m','--pids-limit=64','--ulimit','nofile=256:256','--log-driver=none','--tmpfs','/tmp:rw,nosuid,nodev,size=64m,uid=65534,gid=65534','--tmpfs','/workspace:rw,nosuid,nodev,size=64m,uid=65534,gid=65534','--mount',f'type=bind,source={work},target=/source,readonly','--workdir=/workspace','--env','PORT=3000','--env','NODE_ENV=development',self.image,'sh','-c','cp -R /source/. /workspace/ && exec "$@"','hacksandbox',*RECIPES[job['recipe']]]
    r=subprocess.run(args,capture_output=True,text=True,timeout=20)
    if r.returncode:raise RuntimeError('Container creation failed: '+r.stderr[:1500])
    cid=r.stdout.strip()
    if not re.fullmatch('[0-9a-f]{64}',cid):raise RuntimeError('Unexpected container identifier')
    cap=secrets.token_urlsafe(32) if job['recipe']=='serve' else None
    with self.store.db() as db:db.execute('UPDATE jobs SET container=?,preview_token=? WHERE id=?',(cid,cap,jid))
    proc=subprocess.Popen(['docker','start','-a',cid],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    def read():
     while chunk:=proc.stdout.read1(1024):self.append(jid,chunk.decode(errors='replace'))
    reader=threading.Thread(target=read,daemon=True);reader.start()
    while proc.poll() is None:
     with self.store.db() as db:cancel=db.execute('SELECT cancel FROM jobs WHERE id=?',(jid,)).fetchone()[0]
     if cancel or self.stopping.is_set() or time.time()-start>limit:
      status='cancelled' if cancel or self.stopping.is_set() else 'timed_out';subprocess.run(['docker','kill',cid],capture_output=True,timeout=10);break
     time.sleep(.3)
    proc.wait(timeout=15);reader.join(timeout=3)
    r=subprocess.run(['docker','inspect','--format','{{.State.ExitCode}}',cid],capture_output=True,text=True,timeout=10);code=int(r.stdout.strip())
    if status not in ('cancelled','timed_out'):status='succeeded' if code==0 else 'failed'
  except Exception as e:self.append(jid,'\n'+str(e)[:2000])
  finally:
   if cid:
    try:subprocess.run(['docker','rm','-f',cid],capture_output=True,timeout=20)
    except Exception:pass
   with self.store.db() as db:
    logs=db.execute('SELECT logs FROM jobs WHERE id=?',(jid,)).fetchone()[0]
    receipt={'schema':'hacksandbox.execution.v1','sourceSha256':job['source_hash'],'logSha256':hashlib.sha256(logs.encode()).hexdigest(),'image':self.image,'recipe':job['recipe'],'status':status,'exitCode':code,'finishedAt':int(time.time()),'zkProof':{'status':'not_generated'},'attestation':'local-runner-report; hashes are not a cryptographic proof of execution'}
    db.execute('UPDATE jobs SET status=?,exit_code=?,finished=?,preview_token=NULL,receipt=? WHERE id=?',(status,code,int(time.time()),json.dumps(receipt),jid))
 def loop(self):
  if not self.check():return
  self.store.recover()
  while not self.stopping.is_set():
   job=self.store.claim()
   if job:self.execute(job)
   else:time.sleep(1)
