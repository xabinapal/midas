## Why

The runtime request boundary coordinates persistence, optional KV, authentication, cookies, route protection, and access logging, but its orchestration is not directly regression-tested. Database initialization also retains a rejected promise when client creation throws, preventing later requests in that isolate from recovering.

## What Changes

- Make database initialization clear failed state and permit retry after either client creation or migration fails, while disposing only clients that were successfully created.
- Add direct request-lifecycle coverage for context initialization, optional KV, authentication enforcement and bypass, session cookie clearing and refresh, and one safe access record per request.
- Add login and logout route-action coverage for validation, generic failures, secure session issuance, safe redirects, and POST-only logout.
- Align the platform type declaration with the existing optional KV runtime contract.
- Exercise multi-page local cache reset with a deterministic namespace fake while retaining ephemeral Wrangler coverage for real-binding prefix preservation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `relational-database`: Extend single-flight initialization recovery from migration failures to client-creation failures as well.

## Impact

The change affects the database initializer, request hook testability, platform bindings type declarations, authentication route tests, and KV reset coverage. It adds no dependencies, public commands, authentication features, storage formats, remote operations, or production deployment changes.
