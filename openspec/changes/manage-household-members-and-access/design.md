## Context

The skeleton stores users directly and issues self-contained JWTs without checking the user record on later requests. It deliberately has no registration, administration, password reset, role model, or immediate revocation. Midas requires at least two household members, generic household membership, in-application credential rotation, historical member retention, and traceable actors.

An authenticated user is not the same thing as a household member:

```text
Household 1---* HouseholdMember 0---1 User
    |                                   |
    +---* User -------------------------+
    +---* Session
    +---* ActivityEvent
```

Members own allocation history and may exist without login access. Users authenticate, administer credentials when authorized, and act on records. A user may optionally link to one member in the household, but historical membership survives user disablement.

## Goals / Non-Goals

**Goals:**

- Support an arbitrary number of active and historical members.
- Bootstrap the first household and administrator without public registration.
- Let authorized users provision, disable, reset, and rotate credentials inside Midas.
- Revoke sessions immediately when security state changes.
- Keep ordinary financial access equal while narrowly authorizing credential administration.
- Attribute material changes to durable users and preserve a safe audit trail.

**Non-Goals:**

- Multi-household membership for one user, public signup, invitations by email, SSO, MFA, or roles for financial data.
- Automatic recovery when every administrator and the deployment operator lose their credentials.
- Deleting actors or members that financial or activity records reference.

## Decisions

### Separate household member from user

`HouseholdMember` owns display name, lifecycle, default allocation weight, and financial references. `User` owns username, password hash, active state, administrator flag, required-password-change state, and optional member link. Usernames remain unique application-wide.

Collapsing both concepts was rejected because a historical member, member without login, service user, or disabled user would otherwise make financial records impossible to preserve correctly.

### Scope the initial application to one household per user

Every user belongs to exactly one household and may link to at most one member in that household. The model allows many households in persistence, but the initial UI and session select exactly one. A many-household switcher is deferred because it adds authorization and navigation complexity not required by the initial deployment.

### Use narrow administrator authorization

An active user is either a household administrator or regular household user. Both can access and mutate the same household financial records. Only administrators can create or disable users, change administrator designation, reset another user's password, or revoke another user's sessions. Every household must retain at least one active administrator.

Broad financial roles were rejected because the household requirements explicitly prefer equivalent access. Letting every user reset every other user was rejected because credential takeover is materially different from shared financial entry.

### Bootstrap with a server-only one-time credential

When no household user exists, a public setup route accepts a server-configured bootstrap credential of at least 32 bytes. Before creating a household, it conditionally acquires the singleton application bootstrap gate from `available` to its operation ID. Only that operation may create the household, at least two members, and first administrator; completion permanently closes the gate. A failed lease is recovered from the bootstrap operation root before another attempt. As soon as the gate is complete or any administrator exists, setup is unavailable regardless of the submitted credential. Setup uses generic failures and production edge rate limiting.

Open registration was rejected. Shipping fixed initial passwords was rejected because this is financial software. Fully operational provisioning was rejected because the requirement explicitly asks for initial creation inside the application.

### Replace self-contained JWTs with revocable sessions

Login produces a random 256-bit bearer token stored only in the existing secure cookie. D1 stores a SHA-256 digest and session metadata, never the bearer token. Every protected request validates the digest, expiry, user active state, and household relationship. Sessions retain the existing eight-hour sliding lifetime and rotate their bearer token after four hours.

```text
cookie token -> SHA-256 digest -> session row -> active user -> household
```

Workers KV was rejected because delayed revocation violates security behavior. Stateless JWT plus `credential_version` was considered, but per-request D1 lookup would still be required and would not provide individual session listing or revocation.

### Treat password changes and resets differently

- A user changes their own password by providing the current password and a new password; all other sessions are revoked and the current session is rotated.
- An administrator resets another user's password to a temporary value; every target session is revoked and the target must change the password after the next login.
- Passwords are 12-128 characters, are not trimmed or normalized, and continue using the canonical PBKDF2 representation.
- The reset form never displays an existing password and the application never sends passwords by email.

For complete administrator lockout, recovery is an explicit operator-assisted mode. The operator enables recovery with a separate server-only credential of at least 32 bytes. A successful recovery reactivates one existing administrator, sets a temporary password, forces password change, revokes all sessions, records an operator-recovery activity event, and records the credential digest as consumed. The same credential cannot be reused even if configuration remains enabled. An always-open recovery backdoor and knowledge-question recovery were rejected.

### Make multi-record operations safe without assuming transactions

D1 through the current Kysely dialect does not provide transactions. Multi-record commands therefore use a per-household command gate that admits at most one in-flight mutation at a time. The gate uses a conditional update with a lease expiry; a competing operation receives a conflict result, and an expired lease is reclaimed by the next operation.

Each mutating operation creates a pending operation root, performs its domain writes and activity event referencing that root, then marks the root complete and releases the gate. On failure after acquisition, the gate is released without completing the root. The user retries the action naturally.

Payload fingerprinting, idempotent retry by operation identifier, and secret-result replay prevention were considered and deferred. Household write volume is expected to be low and the gate lease provides adequate safety without the complexity of a full replay protocol.

Claiming ordinary service-level writes were atomic was rejected because a Worker can fail between statements. Raw D1 transaction calls were rejected by the repository persistence boundary. Household-level serialization is acceptable for the expected low write volume and keeps invariant admission explicit.

### Use append-only activity events

Material security, household, and later financial operations append an activity event in the same application operation as the authoritative change. Events record actor, household, event type, subject, timestamp, and a safe structured summary. They never store passwords, hashes, tokens, cookie values, or complete sensitive request bodies.

Operational logfmt logs remain for platform diagnosis; they are not the business audit trail. Mutable before/after snapshots for every table were rejected in favor of stable event-specific metadata and explicit reversal/replacement links.

### Archive referenced identities

Members and users with references are disabled or archived, not deleted. An unreferenced mistaken record may be permanently deleted before it participates in financial or audit history. Inactive members are excluded from new default allocations but remain available in historical filters and corrective workflows.

## Risks / Trade-offs

- **Per-request D1 session checks add latency** -> Keep the query narrow and indexed; correctness and revocation outweigh eventual-consistency caching.
- **A household administrator can take over another account** -> Restrict the action, revoke sessions, force rotation, and expose an immutable audit event.
- **Single-household sessions limit future use** -> Keep household IDs on users and records so a future proposal can add membership tables and a switcher without rewriting financial identity.
- **Bootstrap secret may remain configured after setup** -> Setup becomes data-state disabled; deployment guidance still requires removing or rotating the secret.
- **Audit events can leak sensitive metadata** -> Use allow-listed event payloads and test prohibited fields.

## Migration Plan

1. Add household, member, session, operation, and activity relations plus required user lifecycle columns in a replay-safe migration.
2. Update local preseed with one household, multiple members, multiple active administrators, an inactive historical member, and no plaintext credentials.
3. Add server-side repositories and services for bootstrap, membership, users, sessions, passwords, and activity.
4. Switch request authentication to server-validated sessions, then remove the disabled-authentication, authentication-secret signing, and stateless-JWT paths.
5. Add Spanish setup, login, household, users, password, and session screens.
6. Document operator-assisted total-lockout recovery and production rate-limiting requirements.
7. Verify migration, immediate revocation, last-administrator protection, actor attribution, and all quality gates.

Rollback before use may reverse the migration. Once Midas activity references users or members, rollback must preserve those relations or export the data; destructive rollback is not acceptable.

## Open Questions

None. Multi-factor authentication and multiple household memberships are explicit future proposals rather than implicit extension points.
