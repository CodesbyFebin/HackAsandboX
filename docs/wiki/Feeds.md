# Discovery source contracts

This documents configured sources, not a new live refresh. The source of truth is `lib/feed-sources.ts`. The catalog ingests the attributed Brabble RSS feed; the ten news readers ingest RSS/Atom. No official Devpost API/RSS compatibility is claimed. The suggested `MLH/iovethe-devpost-api` repository returned HTTP 404 when checked on 31 October 2026; that does not establish whether it was renamed, removed or private. We have not substituted a scraper or invented an official Devpost feed.

| Reader | Configured feed | Scope |
|---|---|---|
| [Brabble Hackathons](https://brabble.ai/developers) | [https://brabble.ai/rss/hackathons.xml](https://brabble.ai/rss/hackathons.xml) | Aggregated opportunities; confirm eligibility and deadlines with organizers. |
| [Devfolio](https://devfolio.co/blog/) | [https://devfolio.co/blog/rss/](https://devfolio.co/blog/rss/) | Platform news, hackathon announcements and recaps. |
| [Major League Hacking](https://blog.mlh.com/) | [https://blog.mlh.com/feed](https://blog.mlh.com/feed) | Official MLH announcements and community stories. |
| [DEV Hackathons](https://dev.to/t/hackathon) | [https://dev.to/feed/tag/hackathon](https://dev.to/feed/tag/hackathon) | Community posts; announcements and claims are not organizer-verified. |
| [DEV AI](https://dev.to/t/ai) | [https://dev.to/feed/tag/ai](https://dev.to/feed/tag/ai) | Community-written AI news and build guides. |
| [Hugging Face](https://huggingface.co/blog) | [https://huggingface.co/blog/feed.xml](https://huggingface.co/blog/feed.xml) | Models, datasets, open-source tooling and research. |
| [GitHub Changelog](https://github.blog/changelog/) | [https://github.blog/changelog/feed/](https://github.blog/changelog/feed/) | Official GitHub product and developer-tool updates. |
| [Google Developers](https://developers.googleblog.com/) | [https://developers.googleblog.com/feeds/posts/default/?alt=rss](https://developers.googleblog.com/feeds/posts/default/?alt=rss) | Official developer ecosystem announcements. |
| [Stack Overflow](https://stackoverflow.blog/) | [https://stackoverflow.blog/feed/](https://stackoverflow.blog/feed/) | Engineering, AI and developer-community articles. |
| [NVIDIA Developer](https://developer.nvidia.com/blog/) | [https://developer.nvidia.com/blog/feed/](https://developer.nvidia.com/blog/feed/) | GPU computing, inference and development guides. |

## What can be audited

- `tests/feed.test.mjs` and `tests/update-feeds.test.mjs` exercise URL normalization, deduplication, parsing, date treatment and failure retention. Storage tests check saved status/item contracts.
- The authenticated deployment exposes persisted catalog check/status/count through `/api/refresh`, and saved reader statuses/counts/items through `/api/updates`. These require that deployment's access, not public Pages.
- `checkedAt` is a source check; `lastSuccess` is a successful fetch/validation; `publishedAt` is publisher metadata; `firstSeenAt` is our discovery. They are not interchangeable. Brabble discoveries currently have no publication date.
- Historical live observations of 100 catalog listings and 201 deduplicated news items are snapshots, not constants or independently organizer-verified eligibility claims. Current counts must come from authenticated readback.
- News includes tutorials, platform announcements and recaps. Readers preserve attribution, previous successful data on failures and eligibility uncertainty. Organizer pages/rules remain required for deadlines, prizes and India eligibility.

No third-party integration, affiliation or verified open-hackathon status follows from a matching RSS/Atom schema.
