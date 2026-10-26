import json,sys,threading,unittest,tempfile,urllib.request,urllib.error
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from compute import LocalInference
from core import Problem,Store,DockerRunner
from server import make_handler
class Compute(unittest.TestCase):
 def setUp(self):
  self.calls=[];self.remote=False;self.redirect=False;outer=self
  class Fixture(BaseHTTPRequestHandler):
   def log_message(self,*a):pass
   def do_GET(self):self.respond()
   def do_POST(self):self.respond()
   def respond(self):
    payload=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0')))) if self.command=='POST' else None;outer.calls.append((self.path,payload))
    if outer.redirect:self.send_response(302);self.send_header('Location','http://127.0.0.1:1/should-not-be-followed');self.end_headers();return
    d={'/api/tags':{'models':[{'name':'local-test'},{'name':'unapproved'},{'name':'remote:cloud'}]},'/api/show':{'remote_host':'https://example.invalid'} if outer.remote else {'details':{'format':'gguf'}},'/api/generate':{'response':'fixture response, not live model output','done':True,'eval_count':7}}[self.path]
    body=json.dumps(d).encode();self.send_response(200);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
  self.server=ThreadingHTTPServer(('127.0.0.1',0),Fixture);self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start();self.client=LocalInference('http://127.0.0.1:'+str(self.server.server_port),'local-test,remote:cloud',True)
 def tearDown(self):self.server.shutdown();self.server.server_close();self.thread.join()
 def test_loopback_policy(self):
  for url in ('https://example.com','http://localhost:1234','http://127.0.0.1:1234/extra','http://user:pass@127.0.0.1:1234','http://127.0.0.1:1234/?token=x'):
   self.assertFalse(LocalInference(url,'local-test',True).configured)
  self.assertFalse(LocalInference('http://127.0.0.1:1234','local-test',False).configured)
 def test_explicit_local_protocol_and_limits(self):
  self.assertEqual(self.client.models(),['local-test']);d=self.client.generate('local-test','Review this design');self.assertEqual(d['outputTokens'],7);self.assertEqual(d['provider'],'local-ollama')
  payload=self.calls[-1][1];self.assertFalse(payload['stream']);self.assertEqual(payload['options']['num_predict'],512);self.assertEqual(payload['keep_alive'],0)
 def test_cloud_unapproved_remote_and_bad_prompts_fail_closed(self):
  for model,prompt in [('remote:cloud','x'),('unapproved','x'),('local-test',''),('local-test','x'*8001)]:
   with self.assertRaises(Problem):self.client.generate(model,prompt)
  self.assertEqual(self.calls,[])
  self.remote=True
  with self.assertRaises(Problem):self.client.generate('local-test','x')
  self.assertNotIn('/api/generate',[p for p,_ in self.calls])
 def test_authenticated_gateway_consent_ownership_and_persistent_quota(self):
  with tempfile.TemporaryDirectory() as tmp:
   store=Store(Path(tmp)/'db.sqlite');a=store.register('a@example.test','test-password-123','invite','invite')['token'];b=store.register('b@example.test','test-password-456','invite','invite')['token'];owner=store.owner(a);p=store.save(owner,'Project',{'server.mjs':'console.log(1)'})
   gateway=ThreadingHTTPServer(('127.0.0.1',0),lambda *args,**kwargs:None)
   port=gateway.server_port;gateway.RequestHandlerClass=make_handler(store,DockerRunner(store,''),port,self.client);thread=threading.Thread(target=gateway.serve_forever,daemon=True);thread.start()
   def call(token,consent=True):
    req=urllib.request.Request(f'http://127.0.0.1:{port}/api/inference',data=json.dumps({'project':p['id'],'model':'local-test','prompt':'private-prompt-fixture','consent':consent}).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+token})
    try:
     with urllib.request.urlopen(req) as r:return r.status,json.load(r)
    except urllib.error.HTTPError as e:return e.code,json.load(e)
   try:
    self.assertEqual(call('invalid')[0],401);self.assertEqual(call(a,False)[0],400);self.assertEqual(call(b)[0],404)
    for _ in range(5):self.assertEqual(call(a)[0],200)
    self.assertEqual(call(a)[0],429)
    with Store(store.path).db() as db:
     rows=[dict(r) for r in db.execute('SELECT * FROM inference_runs')];self.assertEqual(len(rows),5);self.assertNotIn('private-prompt-fixture',json.dumps(rows));self.assertNotIn('fixture response',json.dumps(rows))
   finally:gateway.shutdown();gateway.server_close();thread.join()
 def test_redirect_is_not_followed(self):
  self.redirect=True
  with self.assertRaises(Problem):self.client.models()
  self.assertEqual(len(self.calls),1)
if __name__=='__main__':unittest.main()
