## ADDED Requirements

### Requirement: Optional Authentication Configuration

The application SHALL enable authentication only when the authentication flag, after trimming and case normalization, is `true`. An absent flag or `false` SHALL disable authentication. Any other value MUST fail closed. Enabled authentication MUST require a server-only signing secret containing at least 32 UTF-8 bytes; a missing or insufficient secret MUST fail closed.

#### Scenario: Authentication is disabled by default

- **WHEN** the authentication flag is absent or resolves to `false`
- **THEN** authentication SHALL be disabled without requiring a signing secret

#### Scenario: Authentication is enabled

- **WHEN** the authentication flag resolves to `true` and the signing secret contains at least 32 UTF-8 bytes
- **THEN** authentication SHALL be enabled using that secret for session signing and verification

#### Scenario: Invalid configuration is supplied

- **WHEN** the flag is neither `true` nor `false`, or enabled authentication lacks an adequate secret
- **THEN** request initialization SHALL fail rather than continue with authentication disabled

### Requirement: Public and Protected Route Behavior

When authentication is enabled, public routes SHALL remain accessible without a session, protected browser pages SHALL redirect unauthenticated requests to login with status `303`, and protected server endpoints SHALL reject unauthenticated requests with status `401` without redirecting. Access enforcement SHALL occur at the server request boundary.

#### Scenario: Unauthenticated protected page request

- **WHEN** authentication is enabled and an unauthenticated request targets a protected browser page
- **THEN** the response SHALL redirect with status `303` to login and preserve the requested local path and query as the return destination

#### Scenario: Unauthenticated protected API request

- **WHEN** authentication is enabled and an unauthenticated request targets a protected server endpoint
- **THEN** the response SHALL have status `401` and MUST NOT redirect to a browser page

#### Scenario: Public route request

- **WHEN** an unauthenticated request targets a public route
- **THEN** the authentication guard SHALL allow the route to apply its own behavior

### Requirement: Disabled Authentication Mode

When authentication is disabled, the application SHALL bypass authentication guards, expose a null authenticated user, and allow routes to operate without identity. Existing authentication cookies MUST be ignored and cleared. Login submissions MUST NOT validate credentials or issue sessions.

#### Scenario: Protected route while authentication is disabled

- **WHEN** authentication is disabled and a request targets a protected route
- **THEN** the request SHALL proceed with a null authenticated user

#### Scenario: Stale cookie while authentication is disabled

- **WHEN** authentication is disabled and a request contains an authentication cookie
- **THEN** the application SHALL ignore and clear the cookie without restoring identity

#### Scenario: Login is submitted while authentication is disabled

- **WHEN** a client submits credentials while authentication is disabled
- **THEN** the application SHALL redirect without validating credentials or issuing a session

### Requirement: Credential Normalization and Validation

Usernames SHALL be trimmed and normalized to lowercase before lookup. Canonical usernames MUST contain between 3 and 64 characters and only lowercase ASCII letters, digits, period, underscore, or hyphen. Passwords SHALL remain unchanged without trimming or case normalization and MUST contain between 1 and 128 characters.

#### Scenario: Username is normalized

- **WHEN** a client submits a username with uppercase characters or surrounding whitespace
- **THEN** credential lookup SHALL use the trimmed lowercase username while leaving the password unchanged

#### Scenario: Credential shape is invalid

- **WHEN** a submitted username or password violates its constraints
- **THEN** login SHALL fail validation without issuing a session

### Requirement: Generic Login Failures

Unknown usernames and incorrect passwords SHALL produce the same status `401` invalid-credential response. Unknown usernames MUST still trigger password derivation against a valid dummy hash. Failed responses MUST remove the submitted password from returned form state. Successful authentication SHALL expose only the user identifier and stored username.

#### Scenario: Username is unknown

- **WHEN** a valid login submission references a username that does not exist
- **THEN** the application SHALL perform password derivation and return the generic invalid-credential response without revealing that the username is unknown

#### Scenario: Password is incorrect

- **WHEN** a valid login submission references an existing username with an incorrect password
- **THEN** the application SHALL return the same generic response and omit the submitted password from returned state

#### Scenario: Credentials are valid

- **WHEN** the normalized username lookup finds a user and the password verifies
- **THEN** authentication SHALL succeed with a user projection containing only identifier and username

### Requirement: Password Storage

Passwords SHALL be stored only as salted PBKDF2-HMAC-SHA-256 hashes using 600,000 iterations, a unique random 16-byte salt, and a 256-bit derived hash. Stored values SHALL identify the algorithm and work factor and encode the salt and hash. Plaintext passwords MUST NOT be stored, seeded into the database, logged, or compared directly. Unsupported or malformed stored hashes MUST fail verification.

#### Scenario: Password hash is created

- **WHEN** password material is prepared for persistence
- **THEN** the stored value SHALL contain a unique salt and derived hash instead of plaintext

#### Scenario: Password is verified

- **WHEN** a submitted password is verified against a supported stored hash
- **THEN** verification SHALL succeed only when the derived value matches the stored hash

#### Scenario: Stored hash is unsupported

- **WHEN** a stored password value is malformed or declares unsupported parameters
- **THEN** password verification SHALL fail without treating the value as plaintext

### Requirement: Signed Session Cookie

Successful login SHALL issue an HS256-signed JWT with an eight-hour lifetime. The payload MUST contain only the user identifier, stored username, issued-at time, and expiration time. The token SHALL be stored in an `auth_session` cookie scoped to `/` with `HttpOnly`, `SameSite=Lax`, and an eight-hour maximum age. The cookie SHALL set `Secure` for HTTPS requests.

#### Scenario: Session is issued

- **WHEN** valid credentials are submitted while authentication is enabled
- **THEN** the application SHALL set the signed session cookie and redirect with status `303` to the validated return destination

#### Scenario: Session is issued over HTTPS

- **WHEN** the session cookie is issued for an HTTPS request
- **THEN** it SHALL include `Secure`, `HttpOnly`, `SameSite=Lax`, and `Path=/`

### Requirement: Session Validation and Sliding Expiration

A session SHALL be accepted only when its token structure, HS256 header, signature, required payload fields, issued-at time, expiration, and exact eight-hour lifetime are valid. Invalid session cookies MUST be cleared and produce a null user. A valid session SHALL be refreshed once at least half its lifetime has elapsed, receiving a new issued-at time and eight-hour expiration.

#### Scenario: Session token is invalid

- **WHEN** a request contains a malformed, tampered, future-issued, expired, or otherwise invalid token
- **THEN** the application SHALL treat the request as unauthenticated and clear the cookie

#### Scenario: Session is younger than four hours

- **WHEN** a valid session is less than half its lifetime old
- **THEN** the application SHALL accept it without replacing its token

#### Scenario: Session reaches four hours

- **WHEN** a valid session is at least half its lifetime old
- **THEN** the application SHALL accept it and issue a newly signed token valid for eight hours from refresh

### Requirement: Safe Authentication Redirects

Login return destinations MUST begin with `/` and resolve to the application origin. Absolute, protocol-relative, malformed, or cross-origin values MUST be rejected. A missing or rejected destination SHALL resolve to `/`.

#### Scenario: Return destination is local

- **WHEN** login receives a valid same-origin path with query or fragment
- **THEN** successful authentication SHALL redirect to that local destination

#### Scenario: Return destination is unsafe

- **WHEN** login receives an absolute, protocol-relative, malformed, or cross-origin destination
- **THEN** successful authentication SHALL redirect to `/`

### Requirement: POST Logout

User-initiated logout SHALL terminate the current browser session only through a POST logout action. Loading a logout confirmation page MUST NOT clear the session. Invalid-token handling, disabled authentication, and signing-secret rotation MAY invalidate sessions independently of logout. A successful logout SHALL clear the session cookie, clear request-local identity, and redirect with status `303` to login.

#### Scenario: Logout page is loaded

- **WHEN** an authenticated client loads the logout page without submitting it
- **THEN** the current session SHALL remain intact

#### Scenario: Logout is submitted

- **WHEN** an authenticated client submits the logout POST action
- **THEN** the application SHALL clear the session cookie and local user and redirect to login

### Requirement: Stateless Revocation Limits

Session validation SHALL depend on the signed token and configured secret rather than a per-request user lookup. Changing or deleting a user MUST NOT be represented as immediate revocation of an independently retained token. Rotating the signing secret SHALL invalidate tokens signed with the previous secret.

#### Scenario: User changes after session issuance

- **WHEN** a valid token has been issued and its user record is changed or deleted
- **THEN** the token MAY remain valid until expiration unless the signing secret changes

#### Scenario: Signing secret rotates

- **WHEN** the configured signing secret changes
- **THEN** tokens signed with the previous secret SHALL fail validation

### Requirement: Identity-Only Semantics

Authentication SHALL establish identity only. It MUST NOT assign or evaluate roles, permissions, groups, ownership, privilege levels, or other authorization decisions. Every valid authenticated identity SHALL satisfy the authentication boundary equally.

#### Scenario: Valid identity reaches a protected route

- **WHEN** any user presents a valid session to a protected route
- **THEN** the authentication guard SHALL admit the request without evaluating authorization attributes

### Requirement: Production Login Protection Guidance

Production deployment guidance MUST require edge rate limiting for login submissions and a Worker CPU limit selected from measured password-verification cost. The guidance MUST NOT recommend weakening the password work factor to resolve capacity constraints.

#### Scenario: Production authentication is prepared

- **WHEN** an operator prepares a production deployment that accepts login submissions
- **THEN** deployment guidance SHALL require edge rate limiting and sufficient request CPU for password verification at the required work factor
