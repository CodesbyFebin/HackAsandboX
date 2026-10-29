import { readFileSync } from 'node:fs';
import { verifyReceipt } from './core.mjs';
const [receiptPath,keyPath]=process.argv.slice(2);
if(!receiptPath||!keyPath){console.error('Usage: node sovereign/verify.mjs receipt.json trusted-public-key.pem');process.exit(2);}
const receipt=JSON.parse(readFileSync(receiptPath));
if(!verifyReceipt(receipt.receipt??receipt,readFileSync(keyPath))){console.error('INVALID signature or manifest digest');process.exit(1);}
console.log('Valid signature from the supplied trusted key. Worker-reported evidence; no zkVM execution proof.');
