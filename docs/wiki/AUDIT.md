# Security qualification and ASVS 5.0.0 gap map

This is a scoped engineering mapping, not ASVS certification, a complete ASVS assessment, SOC 2 or ISO 27001 compliance. The [current engineering audit](../../sovereign/AUDIT.md) remains the source of implementation limits. Control IDs are pinned to **ASVS 5.0.0**, not the changing master branch. Row descriptions below are our own summaries, with references to OWASP rather than copied requirements.

| Release gap / area | ASVS 5.0.0 controls | Observed evidence | Remaining qualification |
|---|---|---|---|
| Third-party provenance | v5.0.0-15.1.2, v5.0.0-15.2.4 | `vendor/SOURCES.json` pins reviewed commit, upstream paths and Git blobs; generated manifest binds SHA-256 and retained license bytes. CI rejects missing coverage or changed bytes. Starter snapshots have a separate manifest; package dependencies use the lockfile. | Inventory covers `vendor/`, not every copied component, runtime image or model. Review upstream ownership and license meaning manually; no automatic legal clearance. |
| Dependency remediation and legacy lint | v5.0.0-15.1.1, v5.0.0-15.1.4, v5.0.0-15.2.1 | Exact runtime tooling/ORM pins, lockfile, Dependabot and dated notices for legacy starters. Strict Sovereign lint passes. | 82 legacy lint errors/22 warnings remain from prior audit; vulnerability triage timeframes and full transitive SBOM are not qualified. Lint errors are not a vulnerability count. |
| Live sandbox isolation | v5.0.0-15.1.5, v5.0.0-15.2.5 | Worker requests rootless Docker, pinned image, network deny, dropped capabilities and bounded resources. | Hostile-workload escape, host configuration and network-isolation tests on real operator hardware remain open. A signed output does not prove containment. |
| Kubernetes deployment | v5.0.0-15.2.2, v5.0.0-15.2.5 | Offline Job planner, RuntimeClass selector, deny-all policy and quotas. | Verify installed Kata handler and enforcing CNI, tenant boundaries and recovery. RuntimeClass is not a zkVM. |
| Expensive operations / crash recovery | v5.0.0-15.1.3, v5.0.0-15.2.2 | Queue concurrency, budgets, deadlines, renewable leases, caps and cancellation have regression coverage. | Crash reaper, fair scheduling under load and operator resource qualification remain open. |
| Model inference / frontend device QA | v5.0.0-15.1.5, v5.0.0-15.2.5 | Loopback-only private endpoint contracts, mirrored browser assets and preview CSP tests. | Live OpenCode/model/image/WebGPU compatibility, browser accessibility, asset licensing and observed egress isolation remain open. |
| Identity and tenancy | v5.0.0-8.2.1, v5.0.0-8.2.2, v5.0.0-8.4.1 | Separate installation-wide operator/worker tokens with server-side route restrictions. | No per-user/project tenancy or OIDC; loopback-only deployment remains required. |
| Evidence and cryptographic lifecycle | v5.0.0-11.1.1, v5.0.0-11.1.2, v5.0.0-16.4.2 | Ed25519 trusted-key signatures and artifact SHA-256 verification; tamper/wrong-key/missing-byte tests. | Key rotation/revocation/backup and independent external anchoring unqualified. Database owner can rewrite local history. No post-quantum signature or zkVM proof. |
| Durable operations | v5.0.0-16.1.1, v5.0.0-16.4.3, v5.0.0-16.5.2 | Local SQLite and structured audit history, bounded failure handling. | Backup/restore drills, retention policy, logically separate protected log sink and operational incident processes remain open. ASVS does not replace disaster recovery qualification. |
| Business mutations / external integration | v5.0.0-8.3.1, v5.0.0-15.4.2, v5.0.0-16.5.3 | Payload-bound expiring single-use approvals and transactional inventory commit tests; verification adapter cannot settle payments. | No external business service integration, production payments, communication or deployment approvals qualified. |
| Security assessment scope | v5.0.0-15.1.5, v5.0.0-15.2.5 | Owned-source heuristic review only. No arbitrary target execution. | No penetration-test assurance, no live vulnerability validation, no universal auto-fix or production vulnerability gate. |
| zkVM / PQC research | v5.0.0-11.1.2; no ASVS control proves containment | `sovereign/zkvm/adapters/jolt.ts` preserves opaque artifact bytes and rejects digest/status tampering. | No native Jolt serialization/verifier fixture, syscall model, proof circuit, PQC implementation or no-exfiltration proof. Envelope is our transport format, **not Jolt interoperability**. |

## Reproduce the evidence

```sh
node scripts/vendor-manifest.mjs --check
node --experimental-strip-types --test tests/*.test.mjs sovereign/tests/*.test.mjs
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint sovereign scripts/vendor-manifest.mjs tests/vendor.test.mjs --max-warnings 0
```

The expanded suite contains 100 JS/TS tests: 42 Sovereign tests and 58 application/portal/provenance tests. Counts describe this revision, not an invariant for future versions. The original 92-test source release already included 39 Sovereign tests covering SQLite queue persistence, lease fencing, Ed25519 signatures, artifact verification and approval replay prevention. Neither count establishes a cryptographic proof of execution.

## Primary references

- [OWASP ASVS v5.0.0 authorization](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x17-V8-Authorization.md)
- [OWASP ASVS v5.0.0 cryptography](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x20-V11-Cryptography.md)
- [OWASP ASVS v5.0.0 architecture and dependencies](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x24-V15-Secure-Coding-and-Architecture.md)
- [OWASP ASVS v5.0.0 logging and errors](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x25-V16-Security-Logging-and-Error-Handling.md)
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
