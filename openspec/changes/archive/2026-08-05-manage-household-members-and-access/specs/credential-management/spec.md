## ADDED Requirements

### Requirement: Controlled Initial Bootstrap

When no application user exists, Midas SHALL offer a one-time setup operation protected by a server-only bootstrap credential containing at least 32 UTF-8 bytes. Before creating a household, setup SHALL acquire a singleton application bootstrap gate through one conditional transition from `available` to its operation identifier. Only the gate holder MAY create one household, at least two members, and one active administrator linked to one member as a replay-safe operation. Completion SHALL permanently close the gate. An expired holder SHALL be recovered from its bootstrap operation root before another attempt. Once the gate is complete or any administrator exists, setup MUST be unavailable. Invalid or competing setup requests SHALL return a generic failure and MUST NOT disclose configuration details.

#### Scenario: First administrator is created

- **WHEN** no user exists and valid household, two-or-more-member, administrator, and bootstrap inputs are submitted
- **THEN** the household, all submitted members, linked administrator, and completion activity SHALL be created and setup SHALL become unavailable

#### Scenario: Setup is attempted again

- **WHEN** an administrator already exists
- **THEN** the setup operation SHALL reject the request regardless of the submitted bootstrap credential

#### Scenario: Concurrent first setup requests

- **WHEN** two requests attempt to bootstrap different household identifiers while the singleton gate is available
- **THEN** one conditional gate acquisition SHALL succeed and at most one household and first administrator SHALL complete

### Requirement: Household User Administration

An active household administrator SHALL be able to create users in the same household, optionally link each user to an unlinked member, designate administrators, disable users, and reactivate users. Usernames SHALL remain canonical and unique. The system MUST preserve at least one active administrator per household.

#### Scenario: Administrator creates a linked user

- **WHEN** an administrator submits a unique username, valid temporary password, and unlinked member
- **THEN** the user SHALL be created for the household, linked to that member, and required to change the temporary password at next login

#### Scenario: Last administrator is disabled

- **WHEN** an operation would leave the household without an active administrator
- **THEN** the operation SHALL be rejected

### Requirement: Equal Financial Access and Bounded Administration

Every active authenticated household user SHALL have equivalent access to household financial records and workflows. Only active administrators SHALL create, disable, reactivate, or change administrator status for users; reset another user's password; or revoke another user's sessions. The administrator designation MUST NOT restrict ordinary financial visibility or mutation.

#### Scenario: Regular user opens household finances

- **WHEN** an active non-administrator requests a protected household financial workflow
- **THEN** the application SHALL admit the user to the same financial behavior as an administrator

#### Scenario: Regular user attempts password reset for another user

- **WHEN** an active non-administrator submits an administrative credential action
- **THEN** the application SHALL reject it without changing the target user

### Requirement: Current User Password Change

An active user SHALL be able to change their own password by supplying the current password and a valid new password. Success SHALL replace the hash, clear any forced-change state, revoke all other sessions, rotate the current session, and append an activity event. Failure MUST use a generic response and MUST NOT expose or retain either password.

#### Scenario: User changes their password

- **WHEN** the current password verifies and the new password satisfies policy
- **THEN** the password SHALL change, other sessions SHALL be revoked, and the current session SHALL continue with a rotated token

### Requirement: Administrator Password Reset

An administrator SHALL be able to replace another household user's password with a valid temporary password without knowing the previous password. Success SHALL revoke every target session, require password change at the target's next login, and append an activity event. An administrator MUST NOT retrieve an existing password or hash.

#### Scenario: Administrator resets a forgotten password

- **WHEN** an administrator submits a valid temporary password for another user
- **THEN** the target's sessions SHALL be revoked and the target SHALL be required to choose a new password after authenticating

### Requirement: Forced Password Rotation

A user with required-password-change state SHALL be admitted only to password change, session termination, and required supporting routes until a successful password change clears the state.

#### Scenario: User logs in with a temporary password

- **WHEN** valid credentials belong to a user who must change their password
- **THEN** the application SHALL redirect to password change and block household financial routes until completion

### Requirement: Session Visibility and Revocation

An authenticated user SHALL be able to list their active sessions, identify the current session, revoke another session, and revoke all other sessions. An administrator SHALL be able to revoke every session for another household user. Session projections MUST NOT expose bearer tokens or stored token digests.

#### Scenario: User revokes another session

- **WHEN** the current user revokes one of their non-current active sessions
- **THEN** that session SHALL fail on its next request while the current session remains valid

#### Scenario: Administrator disables a user

- **WHEN** an administrator disables another user
- **THEN** every session for the disabled user SHALL become invalid immediately

### Requirement: Operator-Assisted Total Lockout Recovery

Midas SHALL provide a disabled-by-default operator-assisted recovery mode for the case where no active administrator can authenticate. Enabling recovery SHALL require a distinct server-only credential containing at least 32 UTF-8 bytes and production edge rate limiting. A valid recovery SHALL target an existing administrator, reactivate that user if needed, set a valid temporary password, require password change, revoke every target session, append an operator-recovery activity event, and mark the recovery credential digest consumed. The same configured credential MUST NOT succeed again. Invalid, rate-limited, or disabled recovery SHALL use a generic failure. Midas MUST NOT provide public security questions, default credentials, or unattended email recovery.

#### Scenario: All administrators lose access

- **WHEN** recovery mode is enabled and the valid unconsumed credential and target administrator are submitted
- **THEN** the target SHALL receive a forced temporary-password reset, every target session SHALL be revoked, the action SHALL be audited, and that recovery credential SHALL become unusable

#### Scenario: Consumed recovery credential is reused

- **WHEN** a previously successful recovery credential is submitted again
- **THEN** recovery SHALL fail generically without changing any user or session
