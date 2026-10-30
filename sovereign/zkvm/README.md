# Selective proof integration boundary

The control plane currently produces Ed25519-signed evidence bundles. It does not generate zero-knowledge proofs or post-quantum signatures. `zkProof.status` remains `not_generated`. Signed evidence binds an issuer to recorded bytes; it does not establish that an operating system event occurred, that a container prevented escape or that no exfiltration happened.

`adapters/jolt.ts` is a bounded, application-owned transport for **opaque externally supplied bytes**. It records an exact upstream revision and program/input/output digests. It never upgrades its `not_verified` status, runs no subprocess, has no network access and is not wired into trusted receipt verification. Its tests use deliberately invalid proof fixtures; they qualify transport integrity only. Anyone can create a matching hash for arbitrary bytes.

There is no generic JSON envelope that makes a proof Jolt-compatible. Native interoperation needs a version-pinned Jolt guest, prover, serialization codec, verification key/setup, public IO definition and independently executed positive/negative verifier fixtures. Until those exist, this module must not be advertised as an interoperable verifier. [Jolt upstream source](https://github.com/a16z/jolt) is a reference target, not a dependency or endorsement.

## Integration acceptance criteria

1. Pin the upstream commit and toolchain, compile a minimal guest with an explicitly bounded assertion and record program identity.
2. Produce a real native proof/public IO with the pinned prover. Keep raw sensitive inputs private under a stated threat model.
3. Run the native verifier in a separately bounded environment using operator-trusted program identity/setup. Never trust an artifact's own key or claimed result.
4. Demonstrate valid proof acceptance and failure for altered proof, input, output and program identity. Add fixtures and a reproducible build to CI.
5. If proving containment, specify trusted syscall capture, host/kernel/monitor assumptions, complete mediation and the actual isolation policy. A proof over supplied logs alone cannot attest to omitted events.
6. Evaluate PQC migration separately with standardized algorithms, audited implementations and key lifecycle tests. Ed25519 is not quantum-resistant. Do not call hash-only logs ZK proofs or immutable ledgers.

No superiority, exclusivity, competitor ranking, confidentiality certification, zero retention agreement or guaranteed search placement is asserted.
