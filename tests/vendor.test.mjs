import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, rmSync, writeFileSync, readFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inventory, checkManifest } from '../scripts/vendor-manifest.mjs';
function fixture(t) { const dir = mkdtempSync(join(tmpdir(), 'vendor-')); cpSync('vendor', join(dir,'vendor'), {recursive:true}); t.after(()=>rmSync(dir,{recursive:true,force:true})); return dir; }
test('all vendor bytes have pinned upstream provenance and retained licenses', () => assert.equal(checkManifest(process.cwd()).entries.length,1));
test('unrecorded files, directories and symlinks fail closed', t => {
  for (const kind of ['file','directory','symlink']) { const root=fixture(t), path=join(root,'vendor/new'); if(kind==='file')writeFileSync(path,'unknown'); if(kind==='directory')mkdirSync(path); if(kind==='symlink')symlinkSync('/etc/passwd',path); assert.throws(()=>inventory(root)); }
});
test('changed source or missing license fails provenance checks', t => {
  for (const name of ['shadcn-tailwind-4.13.0.css','shadcn-tailwind-4.13.0.LICENSE.md']) { const root=fixture(t); writeFileSync(join(root,'vendor',name),'changed'); assert.throws(()=>inventory(root),/mismatch/); }
});
test('missing commit, unsafe evidence, duplicate coverage and stale manifest are rejected', t => {
  for (const mutate of [s=>s.entries[0].commitSha='main',s=>s.entries[0].evidence='../LICENSE',s=>s.entries.push(s.entries[0])]) { const root=fixture(t), path=join(root,'vendor/SOURCES.json'), s=JSON.parse(readFileSync(path)); mutate(s);writeFileSync(path,JSON.stringify(s));assert.throws(()=>inventory(root)); }
  const root=fixture(t), path=join(root,'vendor/manifest.json'), s=JSON.parse(readFileSync(path));s.entries[0].license='Apache-2.0';writeFileSync(path,JSON.stringify(s));assert.throws(()=>checkManifest(root),/Stale/);
});
test('runtime tooling and ORM dependencies remain exact pins rather than vendored copies',()=>{const p=JSON.parse(readFileSync('package.json'));for(const name of ['wrangler','@cloudflare/vite-plugin','@cloudflare/workers-types','drizzle-kit'])assert.match(p.devDependencies[name],/^\d+\.\d+\.\d+$/);assert.match(p.dependencies['drizzle-orm'],/^\d+\.\d+\.\d+$/);});
