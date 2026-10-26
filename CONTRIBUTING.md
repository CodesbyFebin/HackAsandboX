# Contributing

Start with an issue describing the user problem and scope. Fork the repository, create a focused branch and submit a pull request with observed verification results. Do not commit API keys, user data, environment files or generated runtime state.

Use Node 24 for the public portal: `node --test tests/portal.test.mjs && node scripts/build-pages.mjs`. Preview `_site` using `python3 -m http.server 8000 --directory _site`. The canonical deployment has the `/HackAsandboX/` prefix; local relative links also work.

For the full-stack app, run `npm run install:ci`, then `node_modules/.bin/tsc --noEmit` and `node --experimental-strip-types --test tests/*.test.mjs`. See `hacksandbox/README.md` for local kit setup and tests. Docker qualification requires a dedicated Linux Docker host. Mark skipped or unexecuted checks accurately.

Feed changes require attribution, bounded fetches, explicit eligibility uncertainty and failure retention. Repository additions require upstream identity, license and a dated popularity basis. No purchased stars, fake engagement, keyword stuffing or mass-generated doorway pages.
