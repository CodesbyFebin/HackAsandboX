# Hacksandbox — self-hosted participant workbench

Free software for participant accounts, SQLite projects, source editing/import, bounded rootless Docker jobs, isolated local app previews, actual logs, execution reports, and submission packs. No subscriptions or AI credentials required for the included Node + SQLite app. Your hardware, electricity, network and optional AI calls are your responsibility.

## Start the platform

Requires Python 3.11+ (stdlib only). This service binds **127.0.0.1 only**; each participant runs it on their own machine. Shared internet hosting is not qualified by this release. Do not expose the development server directly to the internet.

```sh
# From this directory. Choose the invite locally; never paste it into chat.
read -r -s -p 'Choose a participant invite: ' HACKSANDBOX_INVITE
export HACKSANDBOX_INVITE
python3 server.py
```

Open http://127.0.0.1:4848/, create an account with your invite and a unique password of at least 12 characters. Sessions expire after 12 hours; sign-out revokes the current token. SQLite is in `data/`, created with owner-only permissions. Keep backups of this directory with the service stopped. Losing the database loses accounts/projects/history. There is no password-reset or email-delivery service.

## Enable actual isolated execution

Install **rootless Docker** from https://docs.docker.com/engine/security/rootless/ and confirm `docker info` reports rootless mode. The service rejects rootful Docker and will never pull images or enable billing itself.

Prepare an operator-reviewed Node 24 image. This explicit preparation needs internet access and disk space; Docker software is free for this use but registry/network terms are separate.

```sh
docker pull node:24-bookworm-slim
export HACKSANDBOX_IMAGE="$(docker image inspect node:24-bookworm-slim --format '{{index .RepoDigests 0}}')"
# Restart server.py with HACKSANDBOX_IMAGE and HACKSANDBOX_INVITE set.
python3 server.py
```

Keep that exact digest for reproducibility; tags change. For projects with dependencies, prepare a separate reviewed image containing the required dependencies. The runner uses `--pull=never`, a read-only root filesystem, dropped capabilities, `no-new-privileges`, UID/GID 65534, no outbound network, one CPU, 256 MiB RAM, 64 processes, and bounded writable tmpfs. Source is copied from a read-only mount into ephemeral `/workspace`. It never mounts the Docker socket, credentials or host home into a job. Docker shares the host kernel; use a disposable Linux VM for untrusted public participants. This is not an independently assessed hostile-code boundary.

## Working build flow

1. Create the included full-stack starter, or import `{name, files}` JSON exported by Hackasandbox. The default app provides an HTTP API, real SQLite CRUD, UI and tests without npm dependencies.
2. Edit and **save** files. Jobs always snapshot saved source.
3. Run **Syntax check**, **Run tests**, **Build offline**, or **Run app**. Recipes are fixed; arbitrary code inside project tests/scripts stays in the container. `server.mjs` is the serve entry point on port 3000.
4. Inspect real logs and the final exit status. Test/build timeout is 60 seconds; serve sessions expire after 15 minutes. One execution slot runs at a time, three active jobs maximum per participant, ten projects and 100 retained jobs per participant.
5. Open the live app from a running serve job. The separate loopback preview origin forwards requests into the networkless container using `docker exec`, never forwards platform credentials, disables redirects, and limits body/response sizes. Its random capability expires when the job ends. User code is untrusted: previews have no platform session or keys.
6. Export a submission pack: saved source, matching completed execution reports, and an organizer checklist. Add your public Git repository, demo/video, license and verified eligibility. **No organizer submission is automated.**

App filesystem changes are ephemeral and are not exported back into project source. The included app database is temporary per serve session; platform source and execution history persist in host SQLite. No Git OAuth, remote Git clone or managed public deployment is claimed. Import/export works with files from any Git platform.

## ZK integrity boundary

`sourceSha256` and `logSha256` are integrity hashes in a local runner report. They are **not a ZK proof or an independent attestation**. Every receipt explicitly reports `zkProof.status=not_generated`. There is no fake verifier or user-toggleable verified badge. A future RISC Zero/SP1 guest must bind a specific deterministic computation, pinned image/program identity and inputs/outputs; proving arbitrary Docker/network behavior needs a separate design. See https://dev.risczero.com/api/zkvm . This release does not install a prover, generate or verify a ZK receipt.

## Validation and operational limits

```sh
python3 -m unittest discover -s tests -v
node --test template/server.test.mjs
```

Tests cover actual HTTP/SQLite authentication, sessions, ownership, source validation, persistence, quotas, concurrent claims, cancellations and submission export. Docker smoke test runs only when `HACKSANDBOX_IMAGE` is set and rootless Docker is available; a skip means execution is unqualified on that host. Live internet multi-user hosting, kernel escapes, TLS/reverse proxy, physical devices, Git-provider OAuth and ZK verification require separate qualification. No paid cloud/provider resources are provisioned.

## Combined Inference / Sandboxes / Training workspace (v0.5)

Hackasandbox discovery and build tools share saved project context in the hosted build hub. The self-hosted kit uses one participant account, project store and interface for execution, local text inference and training-plan export. Hosted and local accounts remain separate; transfer source using the existing export/import flow.

### Local text inference

Start an Ollama server with cloud features disabled (`OLLAMA_NO_CLOUD=1` in the Ollama server environment, or its documented `disable_ollama_cloud` configuration). Choose and install a suitably licensed local model yourself. The kit never pulls models and does not call a provider automatically.

Set these values in the shell running Hacksandbox, using the exact model names returned by your own `ollama list`:

```sh
export HACKSANDBOX_OLLAMA_URL=http://127.0.0.1:11434
export HACKSANDBOX_LOCAL_MODELS=YOUR_INSTALLED_LOCAL_MODEL_NAME
export HACKSANDBOX_OLLAMA_LOCAL_ONLY=1
python3 server.py
```

The last flag is the operator's confirmation that their Ollama service has cloud access disabled; the kit cannot independently attest another process's environment. The adapter accepts a numeric loopback endpoint only, follows no redirects, disables environment proxies, requires an approved installed model, rejects cloud model names and remote-backed model metadata, limits prompt length to 8,000 characters, requests at most 512 output tokens and 4,096 context tokens, and has one active inference slot with five attempts/minute per participant. Output limits and HTTP timeouts bound the client; server-side model cancellation after a timeout is not guaranteed. The model server should also have its own concurrency/resource limits.

Open a project, load approved models and explicitly submit a prompt. Only that prompt is sent; source files are not automatically included. The database records model/project/status/duration metadata, never prompts or responses. Outputs stay in the current browser view. Existing hosted BYOK inference remains separately subject to its provider's billing policy.

### Training and Modal

Training-plan export (`GET /api/projects/<id>/training-plan`) binds a plan to the saved source hash. It lists the missing model, dataset, baseline evaluation, checkpoint storage, GPU worker and budget. It starts no training. Modal integration, GPU fine-tuning, RL, image/video/audio inference and ZK proof generation are **not connected**. No cloud credentials are collected by this kit; no Vera speedup is claimed. GPU/provider deployment requires its own implementation and live qualification.

Protocol references: https://docs.ollama.com/api/generate , https://docs.ollama.com/api/tags , https://github.com/ollama/ollama/blob/main/docs/cloud.mdx . Adapter tests use an explicitly marked local HTTP fixture, not a live model.
