# Third-party provenance

`vendor/manifest.json` is generated offline from reviewed `vendor/SOURCES.json` and actual bytes. It includes source URL, exact upstream commit, license identifier, retained evidence path, original Git blob identity, SHA-256 and size for every vendor file. Adding any file/directory without coverage, changing bytes or losing license evidence fails CI. Symlinks and hidden metadata directories are rejected rather than traversed. Generation does not execute upstream code or inspect `.git` worktrees.

The stylesheet and MIT notice match upstream blobs at [release commit d0fae528221011f75a8c64a917073904c2847493](https://github.com/shadcn-ui/ui/tree/d0fae528221011f75a8c64a917073904c2847493). Metadata was checked against the release tag and upstream tree. This check is evidence of matching content, not an automated determination of license obligations or upstream trust.

To add an upstream resource: review redistribution permission, retain original notices, record the immutable source commit and exact upstream file paths/blob IDs in `SOURCES.json`, then run:

```sh
node scripts/vendor-manifest.mjs
node scripts/vendor-manifest.mjs --check
node --test tests/vendor.test.mjs
```

Review metadata and license changes in the same PR as code. The generator will not invent commits, infer legal terms or silently bless new files. SHA-256 binds content; legacy Git SHA-1 IDs are only additional upstream identity evidence.

This inventory is deliberately scoped to `vendor/`. It is not a full SBOM and does not close all licensing gaps permanently. Editable starter snapshots use `public/starter-sources/manifest.json`, `lib/starter-library.json` and `THIRD_PARTY_NOTICES.md`; those have independent snapshot tests. Other copied components and operator-provided images/model assets need separate review.

Cloudflare workers-sdk is a repository, not the installed package name. The actual `wrangler`, Cloudflare plugin/types, `drizzle-orm` and `drizzle-kit` dependencies already have exact versions in `package.json` and resolution/integrity entries in `pnpm-lock.yaml`. They stay package-managed, not vendored.
