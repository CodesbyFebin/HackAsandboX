import concurrent.futures, subprocess, time, json, os, socket, sys, tempfile, threading, unittest, urllib.request, urllib.error
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from core import Store,DockerRunner,Problem,digest,validate_files
from server import make_handler,ThreadingHTTPServer
class Platform(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.store=Store(Path(self.tmp.name)/'db.sqlite');self.invite='test-invite';self.a=self.store.owner(self.store.register('a@example.test','safe-password-123',self.invite,self.invite)['token']);self.b=self.store.owner(self.store.register('b@example.test','safe-password-456',self.invite,self.invite)['token']);self.files={'server.mjs':'console.log("real source")'}
 def tearDown(self):self.tmp.cleanup()
 def test_auth_and_revocation(self):
  with self.assertRaises(Problem):self.store.login('a@example.test','wrong')
  t=self.store.login('a@example.test','safe-password-123')['token'];self.assertEqual(self.store.owner(t),self.a);self.store.logout(t)
  with self.assertRaises(Problem):self.store.owner(t)
  with self.assertRaises(Problem):self.store.register('c@example.test','safe-password-789','wrong',self.invite)
  with self.store.db() as db:
   row=dict(db.execute('SELECT * FROM users WHERE id=?',(self.a,)).fetchone());self.assertNotEqual(row['password'],'safe-password-123')
 def test_expired_session(self):
  t=self.store.login('a@example.test','safe-password-123')['token']
  with self.store.db() as db:db.execute('UPDATE sessions SET expires=0')
  with self.assertRaises(Problem):self.store.owner(t)
 def test_ownership_persistence_and_snapshot(self):
  p=self.store.save(self.a,'App',self.files);j=self.store.queue(self.a,p['id'],'test');self.store.save(self.a,'Changed',{'server.mjs':'changed'},p['id'])
  self.assertEqual(self.store.job(self.a,j['id'])['source_hash'],digest(self.files));self.assertEqual(Store(self.store.path).project(self.a,p['id'])['name'],'Changed')
  for op in (lambda:self.store.project(self.b,p['id']),lambda:self.store.save(self.b,'Steal',self.files,p['id']),lambda:self.store.job(self.b,j['id']),lambda:self.store.cancel(self.b,j['id'])):
   with self.assertRaises(Problem):op()
 def test_paths_and_size(self):
  for files in ({'../escape':'bad'},{'/absolute':'bad'},{'a/../../b':'bad'},{'a\\b':'bad'},{'a':'x'*150001},{}, {'a//b':'bad'}):
   with self.assertRaises(Problem):validate_files(files)
  self.assertEqual(validate_files({'src/app.mjs':'yes'}),{'src/app.mjs':'yes'})
 def test_atomic_quotas_and_claim(self):
  def create(n):
   try:return self.store.save(self.a,'App '+str(n),self.files)
   except Problem:return None
  with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:rows=[r for r in pool.map(create,range(30)) if r]
  self.assertEqual(len(rows),10)
  def queue(n):
   try:return self.store.queue(self.a,rows[0]['id'],'test')
   except Problem:return None
  with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:jobs=[j for j in pool.map(queue,range(20)) if j]
  self.assertEqual(len(jobs),3)
  with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:claims=[j for j in pool.map(lambda _:self.store.claim(),range(12)) if j]
  self.assertEqual(len(claims),3);self.assertEqual(len({j['id'] for j in claims}),3)
 def test_cancel_queued(self):
  p=self.store.save(self.a,'App',self.files);j=self.store.queue(self.a,p['id'],'test');self.store.cancel(self.a,j['id']);self.assertIsNone(self.store.claim());self.assertEqual(self.store.job(self.a,j['id'])['status'],'cancelled')
 def test_http_boundaries_and_submission(self):
  runner=DockerRunner(self.store,'');sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();server=ThreadingHTTPServer(('127.0.0.1',port),make_handler(self.store,runner,port));thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();token=self.store.login('a@example.test','safe-password-123')['token']
  def call(path,method='GET',data=None,auth=token,origin=None):
   headers={'Content-Type':'application/json','Authorization':'Bearer '+auth}
   if origin:headers['Origin']=origin
   req=urllib.request.Request(f'http://127.0.0.1:{port}'+path,data=json.dumps(data).encode() if data is not None else None,method=method,headers=headers)
   try:
    with urllib.request.urlopen(req) as r:return r.status,json.load(r)
   except urllib.error.HTTPError as e:return e.code,json.load(e)
  try:
   self.assertEqual(call('/api/projects',auth='bad')[0],401)
   self.assertEqual(call('/api/projects',origin='https://evil.test')[0],403)
   template=call('/api/template')[1];code,p=call('/api/projects','POST',template);self.assertEqual(code,201)
   self.assertEqual(call('/api/jobs','POST',{'project':p['id'],'recipe':'test'})[0],503)
   code,pack=call('/api/projects/'+p['id']+'/submission');self.assertEqual(code,200);self.assertEqual(pack['zkProof']['status'],'not_generated');self.assertIn('server.test.mjs',pack['project']['files'])
   code,plan=call('/api/projects/'+p['id']+'/training-plan');self.assertEqual(code,200);self.assertFalse(plan['executionStarted']);self.assertEqual(plan['status'],'plan_only')
   self.assertEqual(call('/api/inference','POST',{'project':p['id'],'model':'x','prompt':'x','consent':True})[0],503)
   bt=self.store.login('b@example.test','safe-password-456')['token'];self.assertEqual(call('/api/projects/'+p['id']+'/submission',auth=bt)[0],404);self.assertEqual(call('/api/projects/'+p['id']+'/training-plan',auth=bt)[0],404)
  finally:server.shutdown();server.server_close();thread.join()
 def test_live_fullstack_starter(self):
  sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close()
  env={**os.environ,'PORT':str(port),'APP_DB':str(Path(self.tmp.name)/'app.sqlite')};entry=str(Path(__file__).resolve().parents[1]/'template/server.mjs')
  def start():
   proc=subprocess.Popen(['node',entry],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
   for _ in range(50):
    try:
     with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/ideas',timeout=.3) as r:json.load(r)
     return proc
    except (OSError,urllib.error.URLError):time.sleep(.05)
   proc.terminate();proc.communicate(timeout=5);self.fail('Starter did not listen')
  proc=start()
  try:
   req=urllib.request.Request(f'http://127.0.0.1:{port}/api/ideas',data=json.dumps({'title':'Persistent HTTP idea'}).encode(),headers={'Content-Type':'application/json'})
   with urllib.request.urlopen(req) as r:self.assertEqual(r.status,201);self.assertEqual(json.load(r)[0]['title'],'Persistent HTTP idea')
  finally:proc.terminate();proc.communicate(timeout=5)
  proc=start()
  try:
   with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/ideas') as r:self.assertEqual(json.load(r)[0]['title'],'Persistent HTTP idea')
  finally:proc.terminate();proc.communicate(timeout=5)
 def test_real_docker_execution_when_available(self):
  runner=DockerRunner(self.store,os.environ.get('HACKSANDBOX_IMAGE',''))
  if not runner.check():self.skipTest(runner.reason)
  p=self.store.save(self.a,'Smoke',{'server.test.mjs':'import test from "node:test";test("actual-container-output",()=>{});'});j=self.store.queue(self.a,p['id'],'test');runner.execute(self.store.claim());j=self.store.job(self.a,j['id']);self.assertEqual(j['status'],'succeeded');self.assertEqual(j['exit_code'],0);self.assertEqual(j['receipt']['zkProof']['status'],'not_generated')
if __name__=='__main__':unittest.main()
