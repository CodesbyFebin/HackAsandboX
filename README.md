# HackaSandbox Sovereign OS

**Your infrastructure. Private AI. Isolated execution. Verifiable outcomes.**

A futuristic builder launchpad, 17 attributed MLH sponsor categories, developer feeds, browser-local tools and a self-hosted participant workbench by [CodesbyFebin](https://github.com/CodesbyFebin).

[Public website](https://codesbyfebin.github.io/HackAsandboX/) · [Documentation Wiki](https://github.com/CodesbyFebin/HackAsandboX/wiki) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## Sovereign OS control service

The new [Sovereign OS service](sovereign/README.md) adds a self-hosted mission console, durable SQLite queue, worker leases, payload-bound approval and Ed25519 evidence verification. It requires Node 24 and no external AI account. Start with `node --test sovereign/tests/*.test.mjs`.

This is an experimental control-plane slice. Coding execution requires a configured worker; MeTaBos, MetaPen, WebLLM and STARK proving remain planned integrations. No entire-agent zkVM proof or production qualification is claimed. The existing hackathon portal and workbench remain available below.

## What's included

| Component | Implementation |
|---|---|
| Public portal | Eight static routes, responsive accessible HTML, structured catalog and repository showcase |
| Developer tools | JSON/JSONL validation, SHA-256, UTF-8 Base64, URL cleanup, IST conversion and environment templates; browser-local |
| Hackathon discovery | Curated catalog plus attributed RSS ingestion in the authenticated app; eligibility uncertainty preserved |
| Fresh updates | Ten feed readers, six-hour authenticated refresh, retained snapshots on failures |
| Participant workbench | Authenticated Workers/D1 projects, file editor, HTML preview, starter imports and BYOK text routing |
| Self-hosted kit | Python/SQLite local accounts and bounded rootless Docker check/test/build/serve recipes |
| Repository references | Existing verified forks, upstream attribution and dated popularity snapshots |

## Run the public portal

Node 24 is required. No API key or dependency installation is needed for these commands:

```sh
git clone https://github.com/CodesbyFebin/HackAsandboX.git
cd HackAsandboX
node --test tests/portal.test.mjs
node scripts/build-pages.mjs
python3 -m http.server 8000 --directory _site
```

The Pages workflow tests the portal and local Python kit, then publishes the static output. It rebuilds every six hours to filter elapsed deadlines. The private app's existing RSS refresh runs separately. Public Pages cannot host Workers, D1, Python services or Docker workers.

## Run the full-stack workbench

See [local kit instructions](hacksandbox/README.md) and the [architecture documentation](docs/wiki/Home.md). For the React/Workers app: `npm run install:ci`, then `npm run dev`. Configure your own hosting identity and D1 database; `.openai/hosting.json` in this public source is a template, not a deployment to the original private project. BYOK providers and live execution require explicit operator configuration. Never enable billing implicitly.

The 11 editable starter snapshots include license evidence. Public source downloads use upstream archives pinned to the recorded commit; archives are downloaded on demand instead of duplicating large binaries. Pantry and unlicensed resources remain references only. Upstream references have not been security-qualified.

## Qualification and limits

Portal utility tests, TypeScript checks and existing platform tests are reproducible locally. Read CI results for the exact committed revision. A skipped check is not a pass. Live Docker isolation/recovery, external model inference, operational monitoring and backup/restore, and independent security review remain open. Modal, GPU training, RL and ZK proving are not connected. Local and hosted identities are separate.

No production-readiness score, guaranteed search ranking or GitHub Trending placement is claimed. The showcase uses dated upstream star snapshots, not a measured Trending rank.

## Search and AI discovery

Semantic crawlable pages, distinct metadata/canonicals, sitemap, robots policy, matching JSON-LD, JSON catalog and `llms.txt` navigation are generated together. No fake reviews, keyword stuffing, doorway pages or link schemes. Search Console ownership and external indexing are not assumed.

## License and community

Original Hackasandbox code: [MIT](LICENSE). Upstream snapshots and resources retain their original licenses; see [third-party notices](THIRD_PARTY_NOTICES.md) and manifests. Read [conduct](CODE_OF_CONDUCT.md), [support](SUPPORT.md) and [security](SECURITY.md) before contributing.
