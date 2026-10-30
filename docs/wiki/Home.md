# Hackasandbox documentation

Find a hackathon, explore attributed repositories and build in a participant workbench.

## Three deployment surfaces

| Surface | Runs | Boundary |
|---|---|---|
| GitHub Pages | Static discovery portal, eight browser utilities, JSON catalog | Public; no backend or user data |
| Authenticated app | React/Vinext, Workers/D1, projects, feeds and BYOK text routing | Separate deployment and authentication |
| Self-hosted kit | Python/SQLite, local accounts, bounded rootless Docker recipes | Dedicated operator-controlled host |

## Start locally

Requires Node 24 for the portal. Clone the repository, then run:

```sh
node --test tests/portal.test.mjs
node scripts/build-pages.mjs
python3 -m http.server 8000 --directory _site
```

For the full-stack application, use `npm run install:ci`, then `npm run dev`. Its hosting bindings and database setup are provider-specific. Do not reuse the original private Site identity for a fork. See the repository's `hacksandbox/README.md` for the local runner.

## Data and attribution

Ten RSS sources are listed in `lib/feed-sources.ts`. The authenticated application's scheduled refresh retains previous data on source failures. Registration deadlines and eligibility require organizer confirmation. Static Pages generation filters expired explicit registration deadlines; static catalog leads are not freshly rule-verified recommendations. The public workflow rebuilds every six hours, but it does not authenticate into or export private workspace data.

The repository showcase records verified existing forks and dated upstream star snapshots. It does not measure GitHub Trending rank. Upstream code is not automatically executed. Licenses and notices remain attached to starter snapshots. Large redundant source archives are fetched from pinned upstream commits in public repository builds.

## Security and production gates

Do not commit provider keys or user data. Browser tools process input locally with a 1 MiB bound. Pages has no inference proxy or participant code execution. Local and hosted identities are separate. Review `SECURITY.md` before deployment.

Live Docker hostile-workload and recovery qualification, external inference tests, operational backup/restore and monitoring, and independent security review remain open. Modal/GPU training, RL and ZK proving are not connected. No 100/100 production score or search-ranking guarantee is claimed.

## Search and machine readability

The public portal provides semantic HTML, distinct titles/descriptions, canonicals, a sitemap, robots policy, JSON-LD matching visible pages, a public JSON catalog and `llms.txt` navigation. These support discovery; they do not guarantee indexing, AI citations or ranking.

## Contribute

Read `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md` and `SECURITY.md`. Submit focused changes with observed test evidence. No purchased stars, automated fake engagement or spam link schemes.

## Engineering evidence

[ASVS gap map](AUDIT.md) · [Third-party provenance](Provenance.md) · [Feed source contracts](Feeds.md) · [Proof boundary](../../sovereign/zkvm/README.md)
