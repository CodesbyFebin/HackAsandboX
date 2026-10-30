# Sovereign OS audit and qualification — 30 October 2026

Scope: HackAsandboX PRs #1–#8 combined, including the Sovereign control service, repository test worker, local business ledger, owned-source review and optional WebLLM adapter. This is an engineering review, not an independent penetration test or production certification.

## Fixed in this change

- Evidence exports previously contained only hashes. Raw UTF-8 artifacts now persist atomically with receipts and export alongside them; the independent verifier checks signature, manifest and actual bytes. Incomplete legacy or tampered evidence fails closed before approval consumption.
- Expired export approvals could leave tasks stuck in `approved`. They now return to review. Operators can cancel tasks, revoking worker leases. No approval authorizes deployment or network activity.
- Database history was unlimited despite active-task limits. Retained tasks and invoices now have explicit 1,000-record caps; sensitive data directories and signing keys are restricted locally.
- An actual background coding-test worker now claims supported tasks, validates an operator-allowlisted local Git mirror and exact commit, stages bounded source, executes only offline Node tests under a pinned local image, renews leases and removes its container. No arbitrary task-supplied host command or repository URL is executed.
- Business commits now use exact payload digests and expiring single-use nonces. Invoice commit and stock deductions share a SQLite transaction; race-sensitive stock rechecks and rollback have tests.
- The browser can load operator-mirrored WebLLM assets with same-origin validation and an external-connection-blocking CSP. Model files and runtime are not included. Asset-root traversal/symlink escapes are denied.
- Workflow conflicts across dependency PRs were resolved without dropping Sovereign checks. CI now runs all JS/TS tests, TypeScript, strict Sovereign lint, full app build, Python checks and static portal checks.

## Observed validation

- Combined locked dependency install: passed with Next 16.4.2, Recharts 3.10.1 and json-rpc-2.0 1.8.1.
- All application and Sovereign JavaScript/TypeScript tests: 81 passed after the final evidence-integrity regression was added.
- TypeScript `tsc --noEmit`: passed.
- `npm run build`: passed on the combined dependency tree.
- Sovereign ESLint: zero errors and warnings.
- Python kit: 14 tests run, 13 passed and one Docker-dependent integration test skipped.
- Static portal build and integrity check: eight routes passed metadata/link/source checks.
- `git diff --check`: passed.

## Unresolved findings / release limits

| Area | Evidence and remaining work |
|---|---|
| Legacy repository lint | Full ESLint reported 82 errors and 22 legacy warnings (mainly explicit `any` and React hook rules). These predate this audit slice. They are not suppressed, fixed by configuration changes or counted as passing. Sovereign has its own strict lint gate. |
| Live sandbox isolation | Neither Docker nor kubectl exists in the validation environment. Worker protocol tests use a fixture executor; they do not qualify container isolation. Install and verify rootless Docker on an operator-owned Linux host before use. |
| Kubernetes | Job planner and network/quotas manifests exist. No operator, cluster rollout or recovery drill is implemented or tested. Kata handler and enforcing CNI must be independently verified. |
| Model inference | OpenCode and WebLLM adapters have contract tests. No installed model, local GPU, weights mirror or live provider was available; no inference executed. Offline worker runs tests, not agent-generated edits. |
| External project integration | Local business/source-review slices work independently. Upstream MeTaBoss and MetaPen services, WhatsApp, payments and deployments are not connected. |
| Security assessment | Source review is heuristic only, not a pentest or vulnerability guarantee. Arbitrary remote targets are not supported. |
| zkVM | No proving library/program specification was supplied or integrated. Receipts explicitly say `not_generated`; signed reports do not prove execution. |
| Identity and tenancy | Installation-wide operator/worker roles only; no OIDC or per-user/project authorization. Keep service loopback-only. |
| Durable operations | Single service process/SQLite volume; no PostgreSQL migration, distributed queue, backup/restore qualification or external audit anchoring. |
| Worker crash recovery | Expired leases fence results, but a crashed worker can leave an orphan container. Supervisor/reaper and host resource qualification remain required. |
| Frontend device QA | HTTP contracts and escaping use are tested/reviewed. No WebGPU browser device test or visual accessibility audit was available. |

No 100/100 score, complete private agent autonomy or production-readiness claim is made. The remaining issues above require implementation and/or an actual operator runtime. Do not infer model privacy or hardware isolation from adapter configuration alone.


## Source-release follow-up

The private inference route and agent-mode queue/worker/harness are now code-integrated. Agent mode runs an operator-supplied OpenCode + CPU llama.cpp image inside a networkless container and returns a patch and tests; inference, image and GGUF runtime qualification are still pending. The independent console has an init/doctor/start/worker manager and reviewable user-service files. Source packaging now exports committed objects with per-file digests and rejects runtime/credential paths. See `RELEASE.md` for exact prerequisites and boundaries. The earlier 81-test count describes the audited foundation; current CI reports the expanded release suite.


## Builder studio qualification

The release adds original builder UI code, versioned workspace storage, bounded local-model chat, explicit proposed-file apply/discard and network-restricted capability previews. New regression tests cover stale writes/proposals, file traversal, credential paths, model failures, role enforcement, preview headers and verify-only routing. Optional payment verification is loopback-only, allowlisted, bounded and contains no settlement implementation. No supplied runtime databases, environment secrets or Git metadata were imported. Live browser/WebGPU/AI/Docker/chain qualification remains pending; reference assets are not evidence of a working deployed capability.
