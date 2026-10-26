#!/usr/bin/env python3
import argparse, fcntl, base64, hashlib, json, os, secrets, subprocess, threading, time
from collections import defaultdict, deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote
from core import Store,DockerRunner,Problem
from compute import LocalInference
ROOT=Path(__file__).resolve().parent

def make_handler(store,runner,port,inference=None):
 inference=inference or LocalInference();inference_slot=threading.BoundedSemaphore(1)
 limits=defaultdict(deque);lock=threading.Lock()
 class Handler(BaseHTTPRequestHandler):
  def log_message(self,*args):pass # Never log authorization, bodies or preview capabilities.
  def send(self,status,data,ctype='application/json',extra=None):
   body=json.dumps(data).encode() if ctype=='application/json' else data
   self.send_response(status);self.send_header('Content-Type',ctype);self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Referrer-Policy','no-referrer')
   if ctype=='text/html':self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; frame-src http://127.0.0.1:"+str(port+1)+"; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
   for k,v in (extra or {}).items():self.send_header(k,v)
   self.end_headers();self.wfile.write(body)
  def do_GET(self):self.handle_request()
  def do_POST(self):self.handle_request()
  def do_PUT(self):self.handle_request()
  def do_DELETE(self):self.handle_request()
  def handle_request(self):
   try:
    if self.headers.get('Host')!=f'127.0.0.1:{port}':raise Problem(403,'Use the loopback URL printed at startup')
    origin=self.headers.get('Origin')
    if origin and origin!=f'http://127.0.0.1:{port}':raise Problem(403,'Cross-origin request rejected')
    path=urlsplit(self.path).path;data={}
    if self.command in ('POST','PUT'):
     if self.headers.get('Content-Type','').split(';')[0]!='application/json':raise Problem(415,'JSON required')
     size=int(self.headers.get('Content-Length','0'))
     if not 0<size<=800000:raise Problem(413,'Request too large or empty')
     try:data=json.loads(self.rfile.read(size))
     except Exception:raise Problem(400,'Invalid JSON')
     if not isinstance(data,dict):raise Problem(400,'JSON object required')
    if path in ('/api/login','/api/register'):
     if self.command!='POST':raise Problem(405,'POST required')
     with lock:
      now=time.time();q=limits[self.client_address[0]]
      while q and q[0]<now-60:q.popleft()
      if len(q)>=10:raise Problem(429,'Too many sign-in attempts; retry in one minute')
      q.append(now)
     out=store.login(data.get('email'),data.get('password')) if path.endswith('login') else store.register(data.get('email'),data.get('password'),data.get('invite'),os.environ.get('HACKSANDBOX_INVITE',''))
     return self.send(200,out)
    if path.startswith('/api/'):
     token=self.headers.get('Authorization','').removeprefix('Bearer ');owner=store.owner(token)
     if path=='/api/models' and self.command=='GET':return self.send(200,{'models':inference.models(),'provider':'local-ollama'})
     if path=='/api/inference' and self.command=='POST':
      if not inference.configured:raise Problem(503,'Local inference is not configured')
      if data.get('consent') is not True:raise Problem(400,'Explicit prompt-sharing consent required')
      project=store.project(owner,data.get('project'))
      with store.db() as db:
       db.execute('BEGIN IMMEDIATE')
       if db.execute('SELECT COUNT(*) FROM inference_runs WHERE owner=? AND created>?',(owner,int(time.time())-60)).fetchone()[0]>=5:raise Problem(429,'Five inference attempts per minute')
       runid=secrets.token_hex(16);db.execute('INSERT INTO inference_runs VALUES(?,?,?,?,?,?,NULL)',(runid,owner,project['id'],str(data.get('model'))[:120],'started',int(time.time())))
      started=time.monotonic();result_status='failed'
      if not inference_slot.acquire(blocking=False):
       with store.db() as db:db.execute("UPDATE inference_runs SET status='busy' WHERE id=?",(runid,))
       raise Problem(429,'Local inference slot busy; retry later')
      try:
       result=inference.generate(data.get('model'),data.get('prompt'));result_status='succeeded';self.send(200,{**result,'runId':runid})
      finally:
       inference_slot.release()
       with store.db() as db:db.execute('UPDATE inference_runs SET status=?,duration_ms=? WHERE id=?',(result_status,int((time.monotonic()-started)*1000),runid))
      return
     if path=='/api/template' and self.command=='GET':return self.send(200,{'name':'My idea board','files':{p.name:p.read_text() for p in (ROOT/'template').iterdir() if p.is_file()}})
     if path=='/api/status' and self.command=='GET':return self.send(200,{'runtime':{'ready':runner.ready,'message':runner.reason},'inference':{'configured':inference.configured,'provider':'local-ollama','modal':'not_connected'},'training':{'status':'not_connected'},'proof':{'status':'not_configured'},'storage':'SQLite','recipes':['check','test','build','serve']})
     if path=='/api/logout' and self.command=='POST':store.logout(token);return self.send(200,{'ok':True})
     if path=='/api/projects' and self.command=='GET':return self.send(200,store.list(owner))
     if path=='/api/projects' and self.command=='POST':return self.send(201,store.save(owner,data.get('name'),data.get('files')))
     parts=path.strip('/').split('/')
     if len(parts)>=3 and parts[1]=='projects':
      pid=parts[2]
      if len(parts)==3 and self.command=='GET':return self.send(200,store.project(owner,pid))
      if len(parts)==3 and self.command=='PUT':return self.send(200,store.save(owner,data.get('name'),data.get('files'),pid))
      if len(parts)==4 and parts[3]=='training-plan' and self.command=='GET':
       p=store.project(owner,pid)
       return self.send(200,{'schema':'hacksandbox.training-plan.v1','status':'plan_only','project':p['name'],'sourceSha256':__import__('core').digest(p['files']),'provider':'unconfigured','model':None,'dataset':None,'gpu':None,'maxSteps':100,'checkpointEvery':25,'evaluation':{'holdoutRequired':True,'baselineRequired':True},'requires':['Choose a licensed model and dataset','Configure a GPU worker and checkpoint storage','Confirm compute credit and a bounded budget','Run a baseline evaluation before training'],'executionStarted':False},extra={'Content-Disposition':'attachment; filename="training-plan.json"'})
      if len(parts)==4 and parts[3]=='submission' and self.command=='GET':
       p=store.project(owner,pid);jobs=store.list(owner)['jobs'];receipts=[j['receipt'] for j in jobs if j['project']==pid and j['receipt'] and j['source_hash']==__import__('core').digest(p['files'])]
       return self.send(200,{'schema':'hacksandbox.submission.v1','project':p,'receipts':receipts,'zkProof':{'status':'not_generated'},'checklist':['Verify organizer eligibility and deadline','Push source to your Git provider','Add public demo URL and video','Describe actual tests and limitations','Review license and attribution','Submit manually on organizer website']},extra={'Content-Disposition':'attachment; filename="submission.json"'})
     if path=='/api/jobs' and self.command=='POST':
      if not runner.ready:raise Problem(503,runner.reason)
      return self.send(202,store.queue(owner,data.get('project'),data.get('recipe')))
     if len(parts)>=3 and parts[1]=='jobs':
      jid=parts[2]
      if len(parts)==3 and self.command=='GET':return self.send(200,store.job(owner,jid))
      if len(parts)==4 and parts[3]=='cancel' and self.command=='POST':store.cancel(owner,jid);return self.send(200,{'ok':True})
      if len(parts)==4 and parts[3]=='preview' and self.command=='GET':
       store.job(owner,jid)
       with store.db() as db:r=db.execute("SELECT preview_token FROM jobs WHERE id=? AND owner=? AND recipe='serve' AND status='running'",(jid,owner)).fetchone()
       if not r or not r['preview_token']:raise Problem(409,'Start a serve job first')
       return self.send(200,{'url':f"http://127.0.0.1:{port+1}/{r['preview_token']}/"})
     raise Problem(404,'Not found')
    if self.command!='GET':raise Problem(405,'GET required')
    files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'}
    if path not in files:raise Problem(404,'Not found')
    ctype={'/':'text/html','/app.js':'text/javascript','/style.css':'text/css'}[path]
    return self.send(200,(ROOT/'static'/files[path]).read_bytes(),ctype)
   except Problem as e:self.send(e.status,{'error':e.message})
   except (ValueError,TypeError):self.send(400,{'error':'Invalid request'})
   except Exception:self.send(500,{'error':'Internal error; contact the operator'})
 return Handler

# Preview origin has no platform authentication, cookies, tokens, or filesystem API.
# A short-lived capability grants access only to one running app in a networkless container.
def make_preview_handler(store,port):
 class Preview(BaseHTTPRequestHandler):
  def log_message(self,*args):pass
  def do_GET(self):self.proxy()
  def do_POST(self):self.proxy()
  def do_OPTIONS(self):
   self.send_response(204);self.send_header('Access-Control-Allow-Origin',f'http://127.0.0.1:{port+1}');self.send_header('Access-Control-Allow-Methods','GET, POST, OPTIONS');self.send_header('Access-Control-Allow-Headers','Content-Type');self.end_headers()
  def proxy(self):
   try:
    if self.headers.get('Host')!=f'127.0.0.1:{port+1}':raise Problem(403,'Invalid host')
    pieces=self.path.split('/',2)
    if len(pieces)!=3:raise Problem(404,'Missing app capability')
    cap,route=pieces[1],pieces[2]
    if not cap or len(cap)>100 or '\\' in route or '..' in unquote(route).split('/'):raise Problem(400,'Invalid preview path')
    with store.db() as db:r=db.execute("SELECT container FROM jobs WHERE preview_token=? AND status='running' AND recipe='serve' AND cancel=0",(cap,)).fetchone()
    if not r:raise Problem(404,'Preview expired; start another serve job')
    size=int(self.headers.get('Content-Length','0'))
    if size>64000:raise Problem(413,'Preview request too large')
    body=self.rfile.read(size).decode() if size else None
    spec=base64.b64encode(json.dumps({'path':'/'+route,'method':self.command,'body':body,'type':self.headers.get('Content-Type','text/plain')}).encode()).decode()
    js="const s=JSON.parse(Buffer.from(process.argv[1],'base64'));const u=new URL('http://127.0.0.1:3000');u.pathname=s.path.split('?')[0];u.search=s.path.includes('?')?s.path.slice(s.path.indexOf('?')):'';const r=await fetch(u,{method:s.method,body:s.body,headers:{'content-type':s.type},redirect:'manual',signal:AbortSignal.timeout(4000)});if(r.status>=300&&r.status<400)throw Error('Redirects disabled');let n=0,c=[];for await(const b of r.body){n+=b.length;if(n>1000000)throw Error('Response too large');c.push(b)}console.log(JSON.stringify({status:r.status,type:r.headers.get('content-type'),body:Buffer.concat(c).toString('base64')}));"
    result=subprocess.run(['docker','exec',r['container'],'node','--input-type=module','-e',js,spec],capture_output=True,text=True,timeout=7)
    if result.returncode:raise Problem(502,'App is not ready or response exceeded limits')
    d=json.loads(result.stdout);payload=base64.b64decode(d['body']);ctype=d['type'] or 'application/octet-stream'
    if 'text/html' in ctype:
     # Give relative requests the capability prefix without exposing platform origin.
     payload=(f'<base href="http://127.0.0.1:{port+1}/{cap}/">'.encode()+payload)
    self.send_response(d['status']);self.send_header('Content-Type',ctype);self.send_header('Content-Length',str(len(payload)));self.send_header('Cache-Control','no-store');self.send_header('Referrer-Policy','no-referrer');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Content-Security-Policy',f"default-src 'self' 'unsafe-inline' data:; connect-src http://127.0.0.1:{port+1}; object-src 'none'; frame-ancestors 'none'");self.end_headers();self.wfile.write(payload)
   except Problem as e:self.send_error(e.status,e.message)
   except Exception:self.send_error(502,'Preview unavailable')
 return Preview

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=4848);parser.add_argument('--data',default=str(ROOT/'data'));args=parser.parse_args()
 if not 1024<=args.port<=65534:parser.error('Port must be 1024–65534')
 os.umask(0o077);Path(args.data).mkdir(parents=True,exist_ok=True)
 lockfile=open(Path(args.data)/'runner.lock','a')
 try:fcntl.flock(lockfile,fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:parser.error('Another instance already owns this data directory')
 store=Store(Path(args.data)/'hacksandbox.sqlite');runner=DockerRunner(store,os.environ.get('HACKSANDBOX_IMAGE',''));runner.check()
 # Acquire both listeners before starting the worker. Only one instance can own a store.
 inference=LocalInference(os.environ.get('HACKSANDBOX_OLLAMA_URL',''),os.environ.get('HACKSANDBOX_LOCAL_MODELS',''),os.environ.get('HACKSANDBOX_OLLAMA_LOCAL_ONLY')=='1')
 server=ThreadingHTTPServer(('127.0.0.1',args.port),make_handler(store,runner,args.port,inference));preview=ThreadingHTTPServer(('127.0.0.1',args.port+1),make_preview_handler(store,args.port))
 threading.Thread(target=preview.serve_forever,daemon=True).start();worker=threading.Thread(target=runner.loop,daemon=True);worker.start()
 print(f'Hacksandbox: http://127.0.0.1:{args.port}/\n{runner.reason}\nZK proof generation: not configured',flush=True)
 try:server.serve_forever()
 except KeyboardInterrupt:pass
 finally:
  runner.stopping.set()
  with store.db() as db:db.execute("UPDATE jobs SET cancel=1 WHERE status='running'")
  worker.join(timeout=30);preview.shutdown();server.server_close();lockfile.close()
if __name__=='__main__':main()
