## Why

Midas requires a generic household with two or more historical members and mandatory, in-application credential management, while the skeleton supports only optional identity-only authentication and externally provisioned users. Household members and application users must be separate concepts so financial history does not depend on continued login access.

## What Changes

- Define households, active and historical household members, default allocation weights, and optional one-to-one links from members to application users.
- Add one-time secure bootstrap, user creation, user disablement, administrator designation, current-password changes, administrator password reset, forced password rotation, session listing, and session revocation.
- Give active users equal access to household financial data while limiting user and credential administration to household administrators.
- **BREAKING** Make authentication mandatory for Midas instead of allowing the disabled-authentication runtime mode.
- **BREAKING** Replace independently valid stateless JWT sessions with server-validated, individually revocable sessions so password rotation and user disablement take effect immediately.
- Define durable actor attribution and append-only activity history for security and financial changes.
- Preserve referenced members and users through inactive states instead of destructive deletion.

## Capabilities

### New Capabilities

- `household-management`: Household identity, member lifecycle, allocation defaults, and separation between members and authenticated users.
- `credential-management`: Bootstrap, user administration, password rotation and reset, administrator boundaries, and session management.
- `activity-history`: Durable actor attribution, immutable audit events, correction links, and safe history presentation.

### Modified Capabilities

- `user-authentication`: Authentication becomes mandatory, credential constraints are strengthened, sessions become server-validated and revocable, and bounded administration replaces pure identity-only semantics.
- `relational-database`: The user relation gains household lifecycle and credential/session attributes required for controlled access.
- `application-structure`: The private-environment example changes from a JWT signing secret to bootstrap and recovery credentials used by the revocable-session design.

## Impact

- Depends on `establish-midas-experience-foundation` for Spanish screens and shared interaction rules.
- Affects authentication configuration, login and setup routes, session cookies, request identity lookup, user persistence, household persistence, activity history, protected navigation, local preseed data, and security tests.
- Password hashes remain PBKDF2-HMAC-SHA-256 at the existing required work factor; no external identity provider or authorization framework is introduced.
- Multi-household user membership, public registration, email delivery, and unattended account recovery are non-goals for this initial application.
