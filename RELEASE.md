# HackaSandbox Sovereign OS — full source distribution

By CodesByFebin. This ZIP contains the tracked full-stack source: the public portal, authenticated Workers/D1 app, original Python/SQLite workbench, Sovereign Node/SQLite backend and console, worker, local business/source-review modules, optional local inference and WebLLM adapters, Kubernetes planning manifests, tests and documentation.

## Start the independent self-hosted console

Node 24+ is required. No npm dependencies or cloud account are needed for this service.

```sh
node sovereign/manage.mjs init
node sovereign/manage.mjs start
```

Open `http://127.0.0.1:8788`. `init` generates distinct credentials and private state paths outside the repository in `~/.config/hackasandbox/runtime.json`. Use a local secret manager to retrieve the operator token for your own console; never publish that file. Its mode must remain 0600. Existing configuration is not overwritten.

```sh
node sovereign/manage.mjs doctor
node sovereign/manage.mjs service-files
```

Doctor reports prerequisite readiness without disclosing credentials, pulling images or provisioning resources. User service files are generated for review, not installed or enabled. For 24/7 operation, install them under your own Linux user service manager after configuring the runtime. A workstation that is off cannot run background agents.

## Connected private inference

Add `SOVEREIGN_OLLAMA_URL` (`http://127.0.0.1:11434`) and comma-separated `SOVEREIGN_LOCAL_MODELS` to the private runtime JSON. The console's private-inference form calls only this endpoint, verifies the model is not remote-backed and never falls back externally. The operator must install a licensed local model and enforce local-service egress separately. No model has been installed or called in this release's validation.

WebLLM uses a separate browser-local path: mirror the WebLLM ESM runtime, compatible weights and WASM, then configure `SOVEREIGN_WEBLLM_ASSETS` and `SOVEREIGN_WEBLLM_CONFIG` as described in `sovereign/README.md`. It requires a real WebGPU-capable browser. No public CDN fallback is configured.

## Connected repository worker

Configure `SOVEREIGN_IMAGE` with a locally prepared digest-pinned image and `SOVEREIGN_REPOSITORIES` with the absolute path to your repository allowlist JSON. `node sovereign/manage.mjs worker` runs the background worker. Its default mode executes offline `node --test` against an exact local Git commit; it never pulls images or clones task-supplied URLs.

For AI edits and a reviewable patch, configure a separate agent worker with `SOVEREIGN_MODE: "agent"` and `SOVEREIGN_GGUF` pointing to an approved local GGUF file. The reviewed image must contain Node 24, Git, tar, OpenCode with its provider adapter cached, and the `llama-server` CPU binary. Set the task execution mode to **Private agent edits + tests**. Read/edit/test capabilities and at least 30 seconds are mandatory.

The agent harness starts llama.cpp and OpenCode **inside the same networkless, rootless container**, using an explicit local provider and no model key or cloud fallback. It snapshots source, requests the task, collects a patch, runs Node tests and submits bounded artifacts to the control service. Only read-only source/model/harness files enter the container; the worker/control credentials stay on the host. The agent container has a 4 GiB memory limit; choose a compatible model. Truncated patches/test output fail the mission rather than masquerading as a complete successful build.

This path is code-integrated and contract-tested, **not live-qualified**: Docker, a reviewed agent image, GGUF weights and compatible OpenCode/llama.cpp versions were unavailable in the build environment. Operator-supplied image licensing, binary pinning, provider-cache preparation and runtime verification are mandatory. Do not label this ZIP a fully deployed autonomous agent system.

## Other workflows

The local business console is functional: stock → invoice draft → exact-payload approval → atomic commit and stock recheck. It is not a payments, GST or upstream MeTaBoss integration. Owned-source review returns deterministic heuristic hints; it is not a remote penetration test or a connected MetaPen deployment.

Task evidence is retained in private SQLite and exported with an Ed25519 signature and artifact bytes. Verify using `node sovereign/verify.mjs bundle.json trusted-public-key.pem`. A signer report is not a STARK proof. No zkVM prover is bundled because no specified proving program/library has been supplied.

## Other source applications

- `hacksandbox/README.md`: original Python local workbench.
- Root `README.md`: public portal and React/Workers/D1 app setup.
- `sovereign/README.md`: API contracts, permissions and configuration.
- `sovereign/AUDIT.md`: explicit qualification gaps and legacy lint debt.
- `sovereign/k8s/`: offline boundary/planning templates; no cluster operator rollout.

GitHub Pages publishes the static portal only. It cannot host SQLite services, Docker agents, private models or the Workers/D1 backend. This release does not change the original owner-private Site or connect paid services.

## Validate and package

```sh
node --experimental-strip-types --test tests/*.test.mjs sovereign/tests/*.test.mjs
python3 -m unittest discover -s hacksandbox/tests -p 'test_*.py'
node scripts/build-pages.mjs
node scripts/check-pages.mjs
python3 scripts/package-source.py /absolute/path/HackaSandbox-Sovereign-OS-Full-Stack.zip
```

Install the locked application dependencies with `npm run install:ci` before the complete root test suite, TypeScript and application build. The Sovereign-only tests need no package install. The packager reads **committed Git objects**, not the working tree. Every included file has a SHA-256 in `SOURCE-MANIFEST.json`; runtime data, credentials, node_modules and Git metadata are excluded. Upstream notices and license files remain included. The repository's MIT license covers original code; third-party dependencies retain their licenses.

## Remaining release limits

Full legacy lint still reports the previously recorded 82 errors; this release does not weaken that rule or claim a clean full-repository lint result. Production OIDC/tenant isolation, distributed scheduling, operational restore qualification, Kubernetes runtime rollout and actual zkVM proving remain unfinished. The source ZIP is complete for the implemented applications, not for every roadmap item.

## Builder studio

Open `http://127.0.0.1:8788/builder` after starting the control service. Connect with the installation's operator token. Create a workspace from the Web or Node-service template, edit persisted files, save a revision, and export its actual contents. The studio includes a file tree, editor, private-model specialist selector, persistent chat and an isolated HTML preview.

Assistant responses use the operator-local model, not a hardcoded list of hosted providers. Proposed files are validated, saved separately and applied only through an explicit review action against the exact source revision. Saving other changes invalidates stale proposals. Discard is available. Model errors produce an error, not a fabricated completion. For a large project, the current 5,000-character local-assistant source-context limit requires a smaller selected workspace. This is a bounded first slice, not repository-wide context retrieval.

HTML previews use short-lived capabilities and a sandboxed iframe. They inline the saved `style.css` and `app.js`, block external requests and do not start a backend process. Node services require the configured test/agent worker. Workspace exports are JSON source bundles; the full application source release is the ZIP generated from this repository.

Workspace APIs are installation-wide operator endpoints under `/v1/workspaces`. Source revisions use optimistic concurrency; messages and proposals are in SQLite. There are no imported accounts or seeded user projects. Production multi-user tenant isolation still requires implementation.

## Optional local payment verification

Set `SOVEREIGN_X402_URL` to an operator-managed loopback facilitator endpoint and `SOVEREIGN_X402_NETWORKS` to the explicit comma-separated network identifiers it supports. The control console can forward a bounded v2 `{paymentPayload,paymentRequirements}` request to `/verify` through `/v1/payments/verify`. It returns the verifier's reported validity, network and bounded reason; this application does not perform cryptographic chain verification itself.

Settlement has no route or signing key in this adapter. It does not submit transactions, call a hosted facilitator, start a fee-payer service or enable billing. Verify-only service configuration is optional and remains disabled by default. The operator is responsible for auditing the local facilitator and its external RPC behavior. `GET /v1/integrations` reports configuration state without claiming live readiness.
