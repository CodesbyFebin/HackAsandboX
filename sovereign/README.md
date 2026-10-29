# HackaSandbox Sovereign OS — CodesByFebin

Your infrastructure. Private AI. Isolated execution. Verifiable outcomes.

This experimental service extends the existing hackathon portal with a private control plane. It is runnable software, not a hosted multi-tenant service. It adds no mandatory cloud account, Firebase dependency, paid API or billing integration.

## Capability ledger

| Capability | Current state |
|---|---|
| Mission console and HTTP API | Implemented; loopback, operator/worker tokens, no browser token persistence |
| Queue and task budgets | Implemented; SQLite WAL, atomic claims, four running slots, 100 active tasks |
| Leases | Implemented; 60-second renewable lease, absolute deadline, expired jobs fail closed |
| Evidence | Implemented; SHA-256 of submitted UTF-8 artifacts, Ed25519 signed manifest, trusted-key verifier |
| Approval | Implemented for evidence export only; exact manifest digest, five-minute expiry, single-use nonce |
| Audit | Implemented; local hash chain, not an externally anchored transparency log |
| OpenCode | Transport adapter implemented and fixture-tested; live model run not qualified |
| Workspace execution | Existing rootless Docker kit; automatic Sovereign-to-Docker bridge planned |
| Kubernetes | Offline Job planner and boundary manifest; not applied or cluster-tested |
| MeTaBos, MetaPen | Planned adapters; no invoices, scans or deployments execute from this API |
| WebLLM | Planned browser integration; no model assets downloaded by the console |
| Background inference | Existing local Ollama kit; not automatically connected to mission workers |
| STARK zkVM | Not connected; every evidence bundle says `not_generated` |
| PostgreSQL, OIDC, HA queue, object storage | Planned production migration |

## Run locally

Requires Node 24 (built-in SQLite and Ed25519). No npm install needed.

```sh
node --test sovereign/tests/*.test.mjs
# Run in a private shell; these values are not printed or saved by the service.
export SOVEREIGN_OPERATOR_TOKEN="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
export SOVEREIGN_WORKER_TOKEN="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
node sovereign/server.mjs
```

Open `http://127.0.0.1:8788`. Enter the operator token from your local secret manager. The console keeps it only in memory. Use `SOVEREIGN_DATA` for a private durable directory and `SOVEREIGN_PORT` to change the port. The service binds only to 127.0.0.1, checks Host and Origin, and emits no request bodies or tokens to logs. This release is a single trusted installation, not a tenant-isolation implementation. Tokens grant installation-wide roles. Do not expose it directly to the Internet.

## Exact task contract

POST `/v1/tasks` with the operator bearer token and JSON:

```json
{
  "project": "my-app",
  "repository": "owner/repository",
  "commit": "0123456789012345678901234567890123456789",
  "module": "coding",
  "prompt": "Fix the failing unit test and return a reviewable patch.",
  "capabilities": ["read", "edit", "test"],
  "network": "deny",
  "budgetSeconds": 300
}
```

The commit above illustrates the format; supply a real commit from your repository. This service validates the contract, not repository ownership or commit existence. An executor must independently enforce scope and verify the checkout. Security tasks additionally require `authorization`; a statement alone is not verified target authorization. No security scanner is invoked by this release.

| Endpoint | Role and behavior |
|---|---|
| GET `/v1/status` | Operator; tasks, integration ledger, signing public key |
| GET `/v1/tasks/:id` | Operator; persisted task and evidence |
| GET `/v1/audit` | Operator; local event chain |
| POST `/v1/worker/claim` | Worker; atomic claim, task and secret lease |
| POST `/v1/worker/tasks/:id/heartbeat` | Worker; `{lease}` renews within deadline |
| POST `/v1/worker/tasks/:id/finish` | Worker; `{lease,outcome,artifacts:[{name,content}]}` |
| POST `/v1/tasks/:id/approve` | Operator; `{decision,manifestDigest}` |
| POST `/v1/tasks/:id/export` | Operator; `{nonce,manifestDigest}` consumes approval |

Outcomes are `succeeded` or `failed`. Finish artifacts are bounded UTF-8 contents, not arbitrary filesystem paths; their hashes are computed server-side. Raw contents are not retained by this service: archive them privately alongside the receipt. At most 20 unique artifacts and 500 KB total are accepted. No raw worker command API exists. Approval grants only `export-evidence`, never deployment or business mutation.

A worker must prepare an isolated checkout at the exact commit, enforce allowed capabilities, deadlines and egress independently, invoke the agent, collect patch/test outputs, submit the result and terminate. Heartbeat or transport timeout is not a process kill: the executor must kill its process group or Job. Expired leases fail closed and are not automatically retried, to avoid duplicate side effects. The five-second expiry sweep is active in the service entry point.

## OpenCode transport

`opencode.mjs` implements authenticated loopback `/session` and `/session/:id/message` requests with an explicit provider/model, bounded response and timeout, and redirects disabled. It does not install or configure OpenCode. Use a separate server per workspace, with a private local model and no external fallback. Set `OPENCODE_SERVER_PASSWORD`, preserve its default username `opencode`, and pin the tested OpenCode release yourself.

Example from an operator-managed worker:

```js
import { OpenCodeAdapter } from './sovereign/opencode.mjs';
const agent = new OpenCodeAdapter({
  url: 'http://127.0.0.1:4096',
  password: process.env.OPENCODE_SERVER_PASSWORD,
  providerID: 'local', // must match your installed server's provider
  modelID: process.env.LOCAL_CODING_MODEL
});
// Only after validating server config and enforcing workload egress:
const result = await agent.run(task.spec.prompt, {
  deadline: task.deadline,
  localOnlyConfirmed: true
});
```

The boolean records caller confirmation, not automatic privacy attestation. A localhost agent can still call external providers unless server configuration and network boundaries prohibit it. No live model call was made during validation. See the [OpenCode server contract](https://opencode.ai/docs/server/).

## Kubernetes boundary

`job.mjs` returns a Job document from a validated task and digest-pinned, operator-built worker image. It does not execute kubectl or provision anything. `k8s/boundaries.yaml` declares a restricted worker namespace, default-deny ingress/egress, resource quota and a Kata RuntimeClass mapped to explicitly labeled nodes.

Install and verify the CRI handler first; a RuntimeClass does not install Kata, select Firecracker automatically or create a zkVM. Verify that your CNI enforces NetworkPolicy. The offline Job has no API token, no credentials, a read-only root filesystem and a bounded emptyDir. It has no network access even to the control service or inference: an operator must stage source/models/task data and collect results out of band, or design a narrow authenticated bridge. The Job is an offline planning template, not the connected OpenCode worker. Do not relax it to unrestricted egress to make it run. Images and model assets must already be mirrored inside a private installation. See [RuntimeClass documentation](https://kubernetes.io/docs/concepts/containers/runtime-class/).

## Evidence verification and limits

Save the operator-approved export and securely provision the signing public key separately. Do not trust a key merely because it accompanies a receipt.

```sh
node sovereign/verify.mjs evidence.json trusted-public-key.pem
```

The verifier checks the manifest digest and Ed25519 signature against your trusted key. Independently recompute artifact SHA-256 values from the archived bytes to check artifact content. The signature attests what this control plane recorded from a credentialed worker, not that a command ran, a test passed, or a finding is correct. A compromised worker can lie. The local audit chain can detect inconsistent edits relative to a trusted checkpoint, but a host administrator can rewrite the entire chain. Store checkpoints externally for stronger tamper evidence.

No SNARK/STARK proof is generated. A future proving adapter must identify an exact program digest, public inputs, verifier version and tested assertion. Hashing command output is not a proof of execution. Kata isolation and zkVM computation proofs are separate mechanisms.

## Operations and qualification

Run under a supervised local service for restart, with a private durable volume. Back up the SQLite database with a consistent SQLite backup procedure and back up the signing key separately with restricted access. Test restore before relying on the service. Signing key rotation, multi-user authentication, encrypted artifact storage, PostgreSQL migration, monitoring, TLS ingress and disaster recovery remain qualification work. Do not run multiple service replicas against this SQLite file. Coordinate one service process per signing directory.

13 new tests cover task validation, scope statements, persistence, lease fencing, concurrency, approval mismatch/expiry/replay, artifact validation, signature tampering, job boundaries, HTTP roles and the OpenCode transport fixture. Fixtures test contracts, not live providers or cluster execution. Existing portal and Python kit checks remain separate.

## Integration sequence

1. Connect a dedicated offline repository worker to this lease contract and qualify process termination.
2. Verify local inference and OpenCode against a pinned server release in an isolated workspace.
3. Add MeTaBos transaction-scoped business approvals and MetaPen authorized-target adapters.
4. Add private artifact storage, OIDC identity and PostgreSQL-backed durable scheduling.
5. Add WebLLM with internally hosted model assets; background workers continue independently of the browser.
6. Add an independently tested selective computation prover.

Original code is covered by the repository MIT license. OpenCode, models and downstream tools retain their own licenses. This service does not bundle or rebrand their source.
