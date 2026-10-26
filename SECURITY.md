# Security

Report vulnerabilities privately through GitHub Security Advisories; do not publish credentials or exploit details in public issues. If private reporting is unavailable, ask the maintainer for a private contact before sharing sensitive details.

## Boundaries

GitHub Pages serves public static discovery content and browser-local tools. It cannot provide authenticated backend routes or run participant code. The hosted app uses Workers/D1 and authenticated user ownership checks. The self-hosted Python kit has separate local accounts and fixed rootless Docker recipes. Never expose its development server directly to the Internet.

Provider keys belong in runtime secret stores or transient BYOK requests, never source, Pages, logs or browser persistence. Do not run unreviewed forks or let agents execute arbitrary host commands. Treat RSS entries and repository metadata as untrusted content.

## Release gates still open

Live Docker hostile-workload tests, recovery and load qualification; production authentication review; backup/restore drill; external inference tests; independent security assessment. GPU/Modal training and ZK proving are not connected. No comprehensive security certification or 100/100 readiness score is claimed.
