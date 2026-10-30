#!/usr/bin/env python3
"""Reproducible tracked-source ZIP. Never includes a working tree or credentials."""
import hashlib,io,json,pathlib,subprocess,sys,zipfile

def package(destination):
    root=pathlib.Path(__file__).resolve().parents[1]
    sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
    archive=subprocess.check_output(['git','archive','--format=zip',sha],cwd=root)
    output=pathlib.Path(destination).resolve();output.parent.mkdir(parents=True,exist_ok=True)
    files={};prefix='HackaSandbox-Sovereign-OS/'
    with zipfile.ZipFile(io.BytesIO(archive)) as source,zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as target:
        for item in source.infolist():
            if item.is_dir():continue
            path=pathlib.PurePosixPath(item.filename)
            if path.is_absolute() or '..' in path.parts:raise ValueError('Unsafe archive path')
            if any(p in ('node_modules','.git','.sites-runtime','.wrangler','__pycache__') for p in path.parts) or item.filename.startswith(('sovereign/data/','hacksandbox/data/')):raise ValueError('Runtime state in tracked source')
            if path.name.startswith(('.env','.dev.vars')) or path.suffix in ('.pem','.sqlite','.sqlite3'):raise ValueError('Credential/runtime file in source')
            data=source.read(item);files[item.filename]=hashlib.sha256(data).hexdigest()
            record=zipfile.ZipInfo(prefix+item.filename,(2026,1,1,0,0,0));record.external_attr=item.external_attr;record.compress_type=zipfile.ZIP_DEFLATED;target.writestr(record,data)
        manifest={'schema':'hackasandbox.source-distribution.v1','repository':'https://github.com/CodesbyFebin/HackAsandboX','commit':sha,'files':files,'excluded':'Git metadata, untracked files, dependency directories, runtime databases, generated secrets','limitations':'See sovereign/AUDIT.md and RELEASE.md. Model weights and live runtimes are not bundled.'}
        record=zipfile.ZipInfo(prefix+'SOURCE-MANIFEST.json',(2026,1,1,0,0,0));record.compress_type=zipfile.ZIP_DEFLATED;target.writestr(record,json.dumps(manifest,indent=2)+'\n')
    with zipfile.ZipFile(output) as check:
        if check.testzip():raise ValueError('ZIP corruption')
        for name,digest in files.items():
            if hashlib.sha256(check.read(prefix+name)).hexdigest()!=digest:raise ValueError('Digest mismatch')
    print(json.dumps({'file':str(output),'commit':sha,'files':len(files),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest()}))
if __name__=='__main__':package(sys.argv[1])
