# Hackasandbox catalog and Fresh Updates refresh

This Site remains owner-private. The maintenance API relies on that platform access boundary. Before changing the audience, add an independent updater credential/authorization policy.

## Unattended update

1. Read the Site with Sites get_site using the supplied project ID. Obtain fresh service access from that response; never persist the token or place it in a task prompt.
2. Prefer the published Site MCP tool `refresh_catalog`, then `get_catalog_sync_status`, when available.
3. Otherwise POST `/api/refresh` at the Site's current_live_url using `OAI-Sites-Authorization: Bearer <fresh service token>`. Follow no redirects, and never send this credential to another origin. This API refreshes the Brabble hackathon catalog plus the ten fixed RSS/Atom sources in `lib/feed-sources.ts`. It records individual feed status, counts and errors.
4. GET `/api/refresh` through the same access and confirm the persisted catalog checkedAt, lastSuccess, status and count, plus every feed checkedAt, lastSuccess, status, item count and error. GET `/api/updates` verifies the actual saved widget items.
5. Report failure accurately. Preserve old listings when sources fail. A saved schedule is not evidence of a completed refresh. Do not make AI calls or allocate cloud resources for refreshes.

The importer rejects DTD/entities, bounds the response size, normalizes URLs, deduplicates records and filters explicit past registration deadlines. It never treats an RSS publication timestamp as an event deadline. Preserve Brabble attribution and uncertainty around eligibility. User-hosted events and user projects are untouched.

## Repository catalog

13 repositories were shallow-cloned and pinned on October 25, 2026. Metadata and commits are in `lib/starter-library.json`. Eleven separate source archives preserve upstream licenses. Pantry is CC-BY-NC-4.0 and hackathon-dicas has no detected license, so those are external references only. Source archives are immutable snapshots and not automatically replaced by feed refreshes.
