import { realpath,stat,open } from 'node:fs/promises';
import { resolve,sep,extname } from 'node:path';
import { Fault } from './core.mjs';
// Only explicitly installed public model assets are served. Never point this root
// at source repositories, runtime databases or a home directory.
export async function serveAsset(root,url,req,res) {
  if(!root)throw new Fault(503,'No locally mirrored WebLLM assets configured');
  const base=await realpath(root),relative=decodeURIComponent(url.slice('/local-model/'.length));
  if(!relative||relative.split('/').some(p=>!p||p==='.'||p==='..')||relative.includes('\\'))throw new Fault(400,'Invalid asset path');
  let path;try{path=await realpath(resolve(base,relative));}catch{throw new Fault(404,'Model asset not installed');}
  if(!path.startsWith(base+sep))throw new Fault(403,'Asset outside mirror');
  const types={'.json':'application/json','.mjs':'text/javascript','.js':'text/javascript','.wasm':'application/wasm','.bin':'application/octet-stream','.model':'application/octet-stream'};
  const type=types[extname(path)];if(!type)throw new Fault(403,'Unsupported model asset type');
  const info=await stat(path);if(!info.isFile())throw new Fault(404,'Not a file');
  const handle=await open(path,'r');
  res.writeHead(200,{'Content-Type':type,'Content-Length':info.size,'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'});
  await new Promise((resolve,reject)=>{const stream=handle.createReadStream();res.once('close',()=>stream.destroy());stream.once('error',reject);res.once('finish',resolve);stream.pipe(res);}).finally(()=>handle.close().catch(()=>{}));
}
