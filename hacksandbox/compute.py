"""Local-only inference adapter. Never installs models or falls back to cloud."""
import json, re, urllib.request, urllib.error
from urllib.parse import urlsplit
from core import Problem
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
class LocalInference:
 def __init__(self,url='',models='',local_only=False):
  self.url=url.rstrip('/');self.allowed=[m.strip() for m in models.split(',') if m.strip()];self.configured=False
  try:
   p=urlsplit(url)
   self.configured=bool(local_only and self.allowed and p.scheme=='http' and p.hostname=='127.0.0.1' and p.port and not p.username and not p.password and p.path in ('','/') and not p.query and not p.fragment)
  except ValueError:pass
  self.client=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
 def request(self,path,payload=None):
  if not self.configured:raise Problem(503,'Configure a loopback Ollama endpoint, approved models and local-only mode first')
  req=urllib.request.Request(self.url+path,data=json.dumps(payload).encode() if payload is not None else None,headers={'Content-Type':'application/json'})
  try:
   with self.client.open(req,timeout=60 if path=='/api/generate' else 5) as r:
    raw=r.read(1000001)
    if len(raw)>1000000:raise Problem(502,'Model response too large')
    d=json.loads(raw)
    if not isinstance(d,dict):raise ValueError()
    return d
  except Problem:raise
  except (OSError,ValueError,urllib.error.HTTPError):raise Problem(502,'Local model request failed; no fallback was attempted')
 def models(self):
  d=self.request('/api/tags');return [r['name'] for r in d.get('models',[]) if isinstance(r,dict) and r.get('name') in self.allowed and not r.get('remote_host') and not r.get('remote_model') and 'cloud' not in r['name'].lower()]
 def generate(self,model,prompt):
  if not isinstance(model,str) or model not in self.allowed or 'cloud' in model.lower():raise Problem(400,'Choose an approved local model')
  if not isinstance(prompt,str) or not 1<=len(prompt.strip())<=8000:raise Problem(400,'Prompt must contain 1–8000 characters')
  if model not in self.models():raise Problem(409,'Approved model is not installed locally')
  info=self.request('/api/show',{'model':model})
  if info.get('remote_host') or info.get('remote_model'):raise Problem(403,'Remote-backed models are blocked')
  d=self.request('/api/generate',{'model':model,'prompt':prompt,'stream':False,'keep_alive':0,'options':{'num_predict':512,'num_ctx':4096}})
  if not isinstance(d.get('response'),str):raise Problem(502,'Local model returned no text')
  return {'model':model,'text':d['response'][:64000],'outputTokens':d.get('eval_count'),'provider':'local-ollama','done':d.get('done',False)}
