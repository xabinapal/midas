## 1. Database Initialization Recovery

- [x] 1.1 Add regression coverage for shared client-creation failure and a successful later retry.
- [x] 1.2 Clear failed initialization state for client-creation and migration failures while disposing only created clients.

## 2. Request and Authentication Boundaries

- [x] 2.1 Add the minimal request-handle dependency seam and SvelteKit-aware Node test configuration.
- [x] 2.2 Cover request context, optional KV, authentication bypass and enforcement, cookie lifecycle, and one safe access record per request.
- [x] 2.3 Cover login validation, generic failure, secure session issuance, and safe return redirects at the route-action boundary.
- [x] 2.4 Cover logout page loading and POST-only session termination at the route boundary.

## 3. KV Contract Alignment

- [x] 3.1 Make the platform KV binding optional in the TypeScript declaration.
- [x] 3.2 Add deterministic multi-page cache-reset coverage with cursor progression and complete deletion.

## 4. Verification

- [x] 4.1 Run formatting, linting, type checks, all test suites, and the production build.
- [x] 4.2 Run strict OpenSpec validation and resolve every issue.
- [x] 4.3 Verify the implementation against the proposal, design, requirements, and completed tasks.
