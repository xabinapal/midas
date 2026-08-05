## 1. Security and Domain Tests

- [x] 1.1 Review the user-authentication and relational-database deltas with the household, credential, activity, application-structure, logging, and KV contracts before implementation.
- [x] 1.2 Write failing unit tests for member lifecycle, default weights, user/member separation, last-administrator protection, and household currency immutability.
- [x] 1.3 Write failing unit tests for singleton-gated bootstrap, user creation/disable/reactivation, own-password change, administrator reset, forced rotation, authoritative logout, lost bearer-response recovery, session listing/revocation, generic failures, and sensitive-data exclusion.
- [x] 1.4 Write failing tests for append-only activity events, inactive actor preservation, correction links, household scoping, and prohibited audit fields.

## 2. Relational Model

- [x] 2.1 Add a replay-safe reversible migration for the singleton bootstrap gate, households and command gates, members, effective member intervals/defaults, versioned user/credential state, revocable sessions, operation roots, activity events, consumed recovery credentials, and required relationships.
- [x] 2.2 Update typed database schema and repository interfaces with household-scoped constraints and indexes.
- [x] 2.3 Update local preseed deletion order and representative data for multiple active members, active administrators, a regular user, an inactive historical member, and valid credential hashes.
- [x] 2.4 Add local integration tests for migration replay, uniqueness, same-household relationships, command-gate conflicts/lease recovery, different-ID concurrent operations, session digest lookup, and preseed completeness.

## 3. Authentication and Administration Services

- [x] 3.1 Implement injected household/member services and repositories for creation, lifecycle, default weights, safe projections, and historical retention.
- [x] 3.2 Implement one-time bootstrap with a server-only credential, replay-safe household/two-or-more-member/admin creation, generic failure, and data-state shutdown.
- [x] 3.3 Replace JWT issuance/validation with random bearer tokens, SHA-256 session digests, eight-hour expiry, four-hour rotation, active-user checks, and immediate revocation.
- [x] 3.4 Implement household-administrator authorization only for user, credential, and cross-user session operations while preserving equal financial access.
- [x] 3.5 Implement own-password change, administrator reset, forced password change, session enumeration/revocation, one-time operator recovery, last-administrator protection, and stable structured security logging without secrets.
- [x] 3.6 Implement append-only activity recording in each material operation and safe history queries.

## 4. Spanish User Workflows

- [x] 4.1 Build setup, login, forced-password-change, own-password, and logout flows with Superforms/Zod, generic failures, and no returned password values.
- [x] 4.2 Build household member list/detail/create/lifecycle/default-allocation workflows for arbitrary member counts.
- [x] 4.3 Build administrator user list/create/link/designate/disable/reactivate/reset/revoke workflows and protect every action server-side.
- [x] 4.4 Build current-user session management and household activity history with Spanish copy, responsive states, confirmations, and URL-backed filters.
- [x] 4.5 Add component and route tests for permissions, long Spanish labels, validation, confirmations, immediate revocation, forced rotation, and safe history display.

## 5. Operations and Verification

- [x] 5.1 Align `AGENTS.md`, `README.md`, and OpenSpec context with mandatory authentication, bounded credential administration, bootstrap/recovery-secret removal or rotation, and production rate limiting.
- [x] 5.2 Run focused security, unit, component, and integration tests during implementation.
- [x] 5.3 Run `mise run format`, `mise run lint`, `mise run check`, and `mise run test`.
- [x] 5.4 Run strict OpenSpec validation and `/opsx-verify` for this change before archive.
