/** Opaque artifact transport only. This is OUR envelope, not Jolt's wire format.
 * No prover/verifier is integrated and no compatibility or containment claim is made.
 */
import { createHash } from 'node:crypto';
export type JoltArtifact = {
  schema: 'hackasandbox.opaque-jolt-artifact.v1';
  upstreamCommit: string;
  programSha256: string;
  publicInputsSha256: string;
  publicOutputsSha256: string;
  proofBase64: string;
  proofSha256: string;
  verification: 'not_verified';
};
const MAX_BYTES = 4 * 1024 * 1024;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function digest(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw Error('Expected SHA-256');
}
export function parseJoltArtifact(value: unknown): JoltArtifact {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Expected artifact');
  const v = value as Record<string, unknown>;
  const keys = ['schema','upstreamCommit','programSha256','publicInputsSha256','publicOutputsSha256','proofBase64','proofSha256','verification'];
  if (Object.keys(v).length !== keys.length || keys.some(key => !Object.hasOwn(v,key))) throw Error('Unexpected artifact fields');
  if (v.schema !== 'hackasandbox.opaque-jolt-artifact.v1' || v.verification !== 'not_verified') throw Error('Unsupported artifact status');
  if (typeof v.upstreamCommit !== 'string' || !/^[a-f0-9]{40}$/.test(v.upstreamCommit) || /^0+$/.test(v.upstreamCommit)) throw Error('Pin upstream commit');
  for (const key of ['programSha256','publicInputsSha256','publicOutputsSha256','proofSha256']) digest(v[key]);
  if (typeof v.proofBase64 !== 'string' || !v.proofBase64.length || v.proofBase64.length > Math.ceil(MAX_BYTES/3)*4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(v.proofBase64)) throw Error('Invalid proof encoding');
  const bytes = Buffer.from(v.proofBase64,'base64');
  if (bytes.length > MAX_BYTES || bytes.toString('base64') !== v.proofBase64 || hash(bytes) !== v.proofSha256) throw Error('Artifact bytes do not match digest');
  return { schema: v.schema, upstreamCommit: v.upstreamCommit, programSha256: v.programSha256 as string, publicInputsSha256: v.publicInputsSha256 as string, publicOutputsSha256: v.publicOutputsSha256 as string, proofBase64: v.proofBase64, proofSha256: v.proofSha256 as string, verification: 'not_verified' };
}
export function wrapJoltArtifact(input: { upstreamCommit: string; programSha256: string; publicInputsSha256: string; publicOutputsSha256: string; proof: Uint8Array }): JoltArtifact {
  if (!(input.proof instanceof Uint8Array) || !input.proof.length || input.proof.length > MAX_BYTES) throw Error('Artifact byte limit');
  const bytes = Buffer.from(input.proof);
  return parseJoltArtifact({ schema:'hackasandbox.opaque-jolt-artifact.v1', upstreamCommit:input.upstreamCommit, programSha256:input.programSha256, publicInputsSha256:input.publicInputsSha256, publicOutputsSha256:input.publicOutputsSha256, proofBase64:bytes.toString('base64'), proofSha256:hash(bytes), verification:'not_verified' });
}
