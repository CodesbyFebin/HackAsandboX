import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { verifyReceipt } from './core.mjs';
import { fileURLToPath } from 'node:url';
export function verifyBundle(bundle,key) {
  if(!verifyReceipt(bundle?.receipt,key)||!Array.isArray(bundle.artifacts))return false;
  const artifacts=bundle.receipt.manifest.artifacts;
  if(bundle.artifacts.length!==artifacts.length||new Set(bundle.artifacts.map(a=>a.name)).size!==artifacts.length)return false;
  return artifacts.every(a=>{const found=bundle.artifacts.find(x=>x.name===a.name);if(typeof found?.content!=='string')return false;const bytes=Buffer.from(found.content);return bytes.length===a.bytes&&createHash('sha256').update(bytes).digest('hex')===a.sha256;});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [receiptPath,keyPath]=process.argv.slice(2);
  if(!receiptPath||!keyPath){console.error('Usage: node sovereign/verify.mjs exported-bundle.json trusted-public-key.pem');process.exit(2);}
  try{const receipt=JSON.parse(readFileSync(receiptPath));if(!verifyBundle(receipt,readFileSync(keyPath)))throw Error();console.log('Valid signed manifest and matching artifact bytes from the supplied trusted key. No zkVM execution proof.');}catch{console.error('INVALID signature, manifest or artifact contents');process.exit(1);}
}
