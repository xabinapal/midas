# user-authentication Specification

## Purpose

Defines mandatory identity authentication, credential and session behavior, route enforcement, logout, immediate revocation, and production deployment guidance.

## Requirements

### Requirement: Mandatory Authentication Configuration

Midas SHALL require authentication for every application workflow except login, one-time setup, explicitly enabled operator-assisted recovery, crawler policy, and static application metadata. Authentication MUST NOT have a disabled bypass mode. Runtime initialization SHALL require authoritative relational access and a cryptographically secure random source for session generation. Protected requests MUST NOT proceed with a null user.

#### Scenario: Authentication configuration is missing

- **WHEN** runtime initialization lacks authoritative relational access or secure random session generation
- **THEN** initialization SHALL fail and MUST NOT serve protected household data

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

### Requirement: Credential Normalization and Validation

Usernames SHALL be trimmed and normalized to lowercase before lookup. Canonical usernames MUST contain between 3 and 64 characters and only lowercase ASCII letters, digits, period, underscore, or hyphen. Passwords SHALL remain unchanged without trimming or case normalization and MUST contain between 12 and 128 characters.

#### Scenario: Username is normalized

- **WHEN** a client submits a username with uppercase characters or surrounding whitespace
- **THEN** credential lookup SHALL use the trimmed lowercase username while leaving the password unchanged

#### Scenario: Credential shape is invalid

- **WHEN** a submitted username or password violates its constraints
- **THEN** login or credential mutation SHALL fail validation without issuing a session or changing a hash

### Requirement: Generic Login Failures

Unknown usernames, disabled users, and incorrect passwords SHALL produce the same status `401` invalid-credential response. Unknown or disabled users MUST still trigger password derivation against a valid dummy hash. Failed responses MUST remove the submitted password from returned form state. Successful authentication SHALL expose only the user identifier, stored username, household identifier, administrator designation, forced-password-change state, and optional safe member projection.

#### Scenario: Username is unknown

- **WHEN** a valid login submission references a username that does not exist
- **THEN** the application SHALL perform password derivation and return the generic invalid-credential response without revealing that the username is unknown

#### Scenario: User is disabled

- **WHEN** a valid login submission references a disabled user
- **THEN** the application SHALL perform password derivation and return the same generic invalid-credential response

#### Scenario: Password is incorrect

- **WHEN** a valid login submission references an active user with an incorrect password
- **THEN** the application SHALL return the same generic response and omit the submitted password from returned state

#### Scenario: Credentials are valid

- **WHEN** the normalized username finds an active user and the password verifies
- **THEN** authentication SHALL create a revocable session and expose only the defined safe projection

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

### Requirement: Server-Validated Revocable Session

Successful login SHALL issue a cryptographically random bearer token containing at least 256 bits of entropy in the `auth_session` cookie. The server SHALL store only a one-way digest of the token with session identifier, user identifier, creation, rotation, and expiration timestamps. Every protected request SHALL validate the session, active user, and household relationship against authoritative relational state.

#### Scenario: Valid session reaches a protected route

- **WHEN** the cookie token digest identifies an unexpired session for an active user
- **THEN** the request SHALL receive the safe user and household projection

#### Scenario: Revoked session is reused

- **WHEN** a cookie identifies a revoked or missing session
- **THEN** the application SHALL clear the cookie and treat the request as unauthenticated

#### Scenario: Session issuance response is lost

- **WHEN** a completed login or rotation response containing the only bearer-token copy is not received
- **THEN** Midas SHALL require fresh login to issue a different session and MUST NOT persist or replay the lost bearer token

### Requirement: Session Cookie and Sliding Rotation

The authentication cookie SHALL be scoped to `/` with `HttpOnly`, `SameSite=Lax`, an eight-hour maximum age, and `Secure` on HTTPS. A valid session SHALL expire eight hours after issuance or rotation and SHALL rotate its bearer token once at least four hours old. Rotation SHALL invalidate the previous token before returning the replacement.

#### Scenario: Session reaches rotation threshold

- **WHEN** a valid session is at least four hours old
- **THEN** the application SHALL replace it with a new token and invalidate the previous token

#### Scenario: Session expires

- **WHEN** a session is more than eight hours beyond issuance or rotation
- **THEN** it SHALL be rejected and its cookie SHALL be cleared

### Requirement: Immediate Security Revocation

Disabling a user, resetting a user's password, or explicitly revoking a session SHALL make the affected sessions invalid for the next request. Changing one's own password SHALL revoke every other session and rotate the current session.

#### Scenario: Disabled user reuses a cookie

- **WHEN** a disabled user's formerly valid session cookie is presented
- **THEN** session validation SHALL fail without waiting for cookie expiration

### Requirement: Safe Authentication Redirects

Login return destinations MUST begin with `/` and resolve to the application origin. Absolute, protocol-relative, malformed, or cross-origin values MUST be rejected. A missing or rejected destination SHALL resolve to `/`.

#### Scenario: Return destination is local

- **WHEN** login receives a valid same-origin path with query or fragment
- **THEN** successful authentication SHALL redirect to that local destination

#### Scenario: Return destination is unsafe

- **WHEN** login receives an absolute, protocol-relative, malformed, or cross-origin destination
- **THEN** successful authentication SHALL redirect to `/`

### Requirement: POST Logout

User-initiated logout SHALL terminate the current server-validated session only through a POST logout action. Loading a logout confirmation page MUST NOT revoke or clear the session. A successful logout SHALL revoke the authoritative current session before clearing the cookie and request-local identity, then redirect with status `303` to login. Reusing a copied token from that session MUST fail.

#### Scenario: Logout page is loaded

- **WHEN** an authenticated client loads the logout page without submitting it
- **THEN** the current session SHALL remain active

#### Scenario: Logout is submitted

- **WHEN** an authenticated client submits the logout POST action
- **THEN** the application SHALL revoke the current session, clear the cookie and local user, and redirect to login

#### Scenario: Logged-out token is reused

- **WHEN** the former session token is presented after successful logout
- **THEN** session validation SHALL reject it

### Requirement: Equal Financial Access with Credential Administration

Authentication SHALL establish household identity and administrator designation. Every active user SHALL satisfy household financial access equally. The administrator designation SHALL be evaluated only for user, credential, and cross-user session administration defined by the credential-management capability.

#### Scenario: Active users access financial route

- **WHEN** an administrator and a non-administrator from the same household request the same financial workflow
- **THEN** the authentication boundary SHALL admit both without applying financial roles

### Requirement: Production Login Protection Guidance

Production deployment guidance MUST require edge rate limiting for login, bootstrap, and enabled recovery submissions and a Worker CPU limit selected from measured password-verification cost. The guidance MUST NOT recommend weakening the password work factor to resolve capacity constraints.

#### Scenario: Production authentication is prepared

- **WHEN** an operator prepares a production deployment that accepts credential or setup submissions
- **THEN** deployment guidance SHALL require edge rate limiting for every public credential endpoint and sufficient request CPU for password verification at the required work factor
