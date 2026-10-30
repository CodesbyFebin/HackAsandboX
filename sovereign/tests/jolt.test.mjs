import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJoltArtifact, wrapJoltArtifact } from '../zkvm/adapters/jolt.ts';
const input=()=>({upstreamCommit:'a'.repeat(40),programSha256:'b'.repeat(64),publicInputsSha256:'c'.repeat(64),publicOutputsSha256:'d'.repeat(64),proof:Buffer.from('opaque fixture, not a valid Jolt proof')});
test('opaque bytes round-trip without claiming proof verification',()=>{const a=wrapJoltArtifact(input());assert.deepEqual(parseJoltArtifact(JSON.parse(JSON.stringify(a))),a);assert.equal(Buffer.from(a.proofBase64,'base64').toString(),input().proof.toString());assert.equal(a.verification,'not_verified');});
test('tampering, status escalation, mutable revisions and extra claims fail closed',()=>{const a=wrapJoltArtifact(input());for(const patch of [{proofBase64:Buffer.from('different').toString('base64')},{verification:'verified'},{upstreamCommit:'main'},{containment:true},{programSha256:'invalid'},{proofBase64:a.proofBase64+'\n'}])assert.throws(()=>parseJoltArtifact({...a,...patch}));});
test('empty and oversized artifacts are rejected before encoding',()=>{for(const proof of [new Uint8Array(),new Uint8Array(4*1024*1024+1)])assert.throws(()=>wrapJoltArtifact({...input(),proof}));});
