## ADDED Requirements

### Requirement: Durable Activity Events

Every material household, member, user, credential, session-administration, and posted financial mutation SHALL append a durable activity event containing household, event type, subject type and identifier, actor user when available, occurrence timestamp, and an allow-listed safe summary. The event SHALL be written as part of the owning application operation and MUST NOT be replaced by operational logs.

#### Scenario: User changes a financial record

- **WHEN** an authenticated user completes a material mutation
- **THEN** the resulting activity event SHALL identify the actor, action, subject, household, and timestamp

#### Scenario: Bootstrap creates the first actor

- **WHEN** initial setup completes before an authenticated actor exists
- **THEN** the activity event SHALL identify the bootstrap operation as the actor context without fabricating a user

### Requirement: Sensitive Activity Data Exclusion

Activity events MUST NOT contain plaintext passwords, password hashes, temporary passwords, session bearer tokens, token digests, cookies, authentication secrets, authorization headers, evidence contents, or complete request bodies. User-visible summaries SHALL disclose only the minimum security metadata needed to understand the action.

#### Scenario: Password is reset

- **WHEN** an administrator resets another user's password
- **THEN** the event SHALL identify the reset action, actor, and target but omit every password and session credential value

### Requirement: Immutable History and Correction Links

An activity event MUST NOT be edited or deleted through ordinary application workflows. Corrections, reversals, and replacements SHALL append new events and SHALL link to the affected record or earlier event so the chronology remains reproducible.

#### Scenario: Posted record is corrected

- **WHEN** a user reverses and replaces a posted financial record
- **THEN** history SHALL retain the original, reversal, replacement, actors, timestamps, and links among them

### Requirement: Household-Scoped History Access

Active household users SHALL be able to view safe activity events for their household. Results SHALL be ordered deterministically and MAY be filtered by period, actor, event type, or subject. A user MUST NOT retrieve another household's history.

#### Scenario: User filters activity by record

- **WHEN** an active user opens the history for a household expense
- **THEN** the application SHALL return that expense's ordered safe activity events and no unrelated household data

### Requirement: Replay-Safe Multi-Record Operation

Every mutating operation SHALL use a stable household-scoped operation identifier and an authoritative pending or complete state. Before domain writes, it SHALL acquire the household command gate through one conditional write matching the expected household version and an available or recoverable lease. At most one operation ID MAY hold the gate for a household. Competing IDs SHALL receive a conflict/retry result; an expired holder SHALL be recovered or safely abandoned before admission of another operation.

Domain versions and the activity event SHALL reference the admitted operation, and readers MUST select effects only from completed operations. Retrying an identifier with the same safe payload fingerprint SHALL complete missing idempotent writes or return the completed non-secret result; reuse with different input SHALL be rejected. Sensitive values MUST NOT enter the fingerprint and SHALL be staged only in their approved protected representation. Only the original actor or an authorized recovery service MAY resume a pending operation. An operation MUST NOT report success until its domain effects, required activity event, completed state, and command-gate release are durable.

When a completed operation's result includes a newly generated bearer token, the server MUST NOT persist or replay that token. A retry of that completed operation SHALL return a generic fresh-authentication-required result and SHALL require a new login operation to issue another token. This secret-result exception MUST NOT weaken idempotency of the completed relational effects.

#### Scenario: Worker fails during a multi-record operation

- **WHEN** execution stops after some child writes but before operation completion
- **THEN** those pending effects SHALL remain invisible and retrying the same operation identifier SHALL safely complete or recover them without duplication

#### Scenario: Competing operations use different identifiers

- **WHEN** two isolates attempt household mutations from the same expected version
- **THEN** one conditional gate acquisition SHALL succeed and the other SHALL receive a conflict without posting domain effects

#### Scenario: Identifier is reused with different input

- **WHEN** a completed or pending operation identifier is submitted with a different safe payload fingerprint
- **THEN** the command SHALL be rejected rather than reinterpret the existing operation

#### Scenario: Completed bearer issuance is retried

- **WHEN** a response containing a new session bearer token is lost and the completed operation identifier is retried
- **THEN** the server SHALL not replay or reconstruct the token and SHALL require a fresh login operation

### Requirement: Actor Preservation

Disabling or archiving a user MUST NOT remove the user identifier or safe display projection from historical activity. Historical events SHALL distinguish an inactive actor without implying that the actor remains authorized.

#### Scenario: Former user appears in history

- **WHEN** a user who created a record is later disabled
- **THEN** the record history SHALL continue to identify that historical actor and their inactive state
