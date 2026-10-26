import test from 'node:test';import assert from 'node:assert/strict';
process.env.NODE_ENV='test';process.env.APP_DB=':memory:';
const {add,list}=await import('./server.mjs');
test('persists actual rows and validates input',()=>{add('Build a useful agent');assert.equal(list()[0].title,'Build a useful agent');assert.throws(()=>add(''));assert.throws(()=>add('x'.repeat(161)));});
