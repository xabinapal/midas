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

### Requirement: Household Operation Gate

Every mutating household operation SHALL acquire a per-household command gate before writing domain effects. The gate ensures at most one in-flight mutation per household at a time. If the gate is held by an unexpired lease, the operation SHALL return a conflict result. If the previous holder's lease has expired, it SHALL be reclaimed before the new operation proceeds.

Each operation SHALL create a pending operation root, perform its domain writes and activity event referencing that root, then mark the root complete and release the gate. On failure after acquisition, the gate SHALL be released without marking the root complete. Expired or failed operations leave no visible domain effect; the user simply retries.

This requirement does not mandate payload fingerprinting, idempotent retry by operation identifier, or secret-result replay prevention. Those properties are deferred to a future hardening change if write-volume or reliability requirements demand them.

#### Scenario: Worker fails during a mutation

- **WHEN** execution stops after the gate is acquired but before the operation root is marked complete
- **THEN** the gate lease SHALL expire naturally and the next operation SHALL reclaim it; the incomplete operation's partial writes remain as-is and the user retries the action

#### Scenario: Competing mutations

- **WHEN** two isolates attempt mutations on the same household simultaneously
- **THEN** one SHALL acquire the gate and the other SHALL receive a conflict result without posting domain effects

### Requirement: Actor Preservation

Disabling or archiving a user MUST NOT remove the user identifier or safe display projection from historical activity. Historical events SHALL distinguish an inactive actor without implying that the actor remains authorized.

#### Scenario: Former user appears in history

- **WHEN** a user who created a record is later disabled
- **THEN** the record history SHALL continue to identify that historical actor and their inactive state
