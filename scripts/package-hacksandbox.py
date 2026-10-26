from pathlib import Path
import hashlib,json,tarfile
root=Path(__file__).resolve().parents[1];source=root/'hacksandbox';out=root/'public/hacksandbox';out.mkdir(parents=True,exist_ok=True)
with tarfile.open(out/'hacksandbox-selfhost.tar.gz','w:gz') as archive:
 for p in sorted(source.rglob('*')):
  if p.is_file() and not any(x in p.relative_to(source).parts for x in ('__pycache__','data')) and p.suffix!='.pyc':archive.add(p,arcname='hacksandbox/'+str(p.relative_to(source)))
(out/'README.md').write_text((source/'README.md').read_text())
(out/'template.json').write_text(json.dumps({'name':'Hacksandbox idea board','files':{p.name:p.read_text() for p in sorted((source/'template').iterdir()) if p.is_file()}},indent=2))
(out/'manifest.json').write_text(json.dumps({'version':'0.6.0','archive':'hacksandbox-selfhost.tar.gz','sha256':hashlib.sha256((out/'hacksandbox-selfhost.tar.gz').read_bytes()).hexdigest(),'execution':'rootless-docker-required','zkProof':'not_configured','platform':'local-participant-host','license':'MIT'},indent=2))
print('Packaged self-hosted kit, template and integrity manifest')
