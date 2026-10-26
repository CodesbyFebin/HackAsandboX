import {test} from 'node:test';import assert from 'node:assert/strict';import {transform} from '../portal/tools.mjs';
test('UTF-8 Base64 round trip',async()=>assert.equal(await transform('decode',await transform('encode','കേരളം 👋')),'കേരളം 👋'));
test('hash uses SHA-256 known vector',async()=>assert.equal(await transform('sha','abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'));
test('tracking cleaner preserves functional query',async()=>assert.equal(await transform('url','https://example.org/?id=42&utm_source=x&gclid=y'),'https://example.org/?id=42'));
test('executable URLs rejected',()=>assert.rejects(transform('url','javascript:alert(1)')));
test('ambiguous timestamps rejected',()=>assert.rejects(transform('ist','2026-10-27T12:00:00')));
test('JSONL errors identify exact line',()=>assert.rejects(transform('jsonl','{}\ninvalid'),/line 2/));
test('large inputs rejected',()=>assert.rejects(transform('json','x'.repeat(1048577)),/limit/));
test('env generator emits no values',async()=>assert.equal(await transform('env','API_TOKEN=secret API_TOKEN'),'API_TOKEN='));
