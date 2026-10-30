import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, lstatSync, writeFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function safePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.split('/').some(p => !p || p === '.' || p.startsWith('.')) || value.startsWith('/')) throw Error('Unsafe vendor path');
  return value;
}
export function inventory(root) {
  const base = resolve(root, 'vendor');
  const files = new Set();
  function walk(dir) {
    for (const name of readdirSync(dir).sort()) {
      const path = resolve(dir, name), local = relative(base, path).split(sep).join('/');
      if (dir === base && ['manifest.json', 'SOURCES.json'].includes(name)) continue;
      safePath(local);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw Error('Vendor symlink rejected');
      if (stat.isDirectory()) { if (!readdirSync(path).length) throw Error('Unrecorded empty vendor directory'); walk(path); }
      else if (stat.isFile()) files.add(local);
      else throw Error('Unsupported vendor file');
    }
  }
  walk(base);
  const sources = JSON.parse(readFileSync(resolve(base, 'SOURCES.json'), 'utf8'));
  if (sources.schema !== 'hackasandbox.vendor-sources.v1' || !Array.isArray(sources.entries)) throw Error('Invalid source registry');
  const covered = new Set();
  const entries = sources.entries.map(source => {
    if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(source.source) || !/^[a-f0-9]{40}$/.test(source.commitSha) || /^0+$/.test(source.commitSha) || !/^[A-Za-z0-9. ()+-]+$/.test(source.license) || !source.license.trim() || !Array.isArray(source.files) || !source.files.length) throw Error('Incomplete vendor provenance');
    safePath(source.path);
    const evidence = safePath(source.evidence);
    if (!source.files.some(f => f.path === evidence)) throw Error('License evidence is not inventoried');
    const records = source.files.map(file => {
      const path = safePath(file.path); safePath(file.upstreamPath);
      if (!files.has(path) || covered.has(path) || !/^[a-f0-9]{40}$/.test(file.gitBlobSha)) throw Error('Missing, duplicate or unpinned vendor file');
      covered.add(path);
      const bytes = readFileSync(resolve(base, path));
      const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      if (blob !== file.gitBlobSha) throw Error(`Upstream blob mismatch: ${path}`);
      if (path === evidence && !bytes.toString('utf8').trim()) throw Error('Empty license evidence');
      return { path: `vendor/${path}`, upstreamPath: file.upstreamPath, gitBlobSha: blob, sha256: sha256(bytes), bytes: bytes.length };
    }).sort((a,b) => a.path.localeCompare(b.path));
    if (!records.some(f => f.path === `vendor/${source.path}` || f.path.startsWith(`vendor/${source.path}/`))) throw Error('Source path does not identify inventoried content');
    return { path: `vendor/${source.path}`, source: source.source, commitSha: source.commitSha, license: source.license, evidence: `vendor/${evidence}`, files: records };
  }).sort((a,b) => a.path.localeCompare(b.path));
  if (covered.size !== files.size) throw Error(`Unrecorded vendor files: ${[...files].filter(f => !covered.has(f)).join(', ')}`);
  return { schema: 'hackasandbox.vendor-manifest.v1', entries };
}
export function checkManifest(root) {
  const expected = inventory(root), saved = JSON.parse(readFileSync(resolve(root, 'vendor/manifest.json'), 'utf8'));
  if (!Number.isFinite(Date.parse(saved.generatedAt)) || saved.schema !== expected.schema || JSON.stringify(saved.entries) !== JSON.stringify(expected.entries)) throw Error('Stale vendor manifest; review SOURCES.json then regenerate');
  return expected;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
    if (process.argv.includes('--check')) checkManifest(root);
    else writeFileSync(resolve(root, 'vendor/manifest.json'), JSON.stringify({ ...inventory(root), generatedAt: new Date().toISOString() }, null, 2) + '\n');
    console.log('Vendor provenance and bytes verified. License interpretation still requires human review.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
