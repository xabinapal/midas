## ADDED Requirements

### Requirement: Household Account Classification

Every financial account SHALL belong to one household, use the household currency, and have an explicit `personal` or `shared` classification. A personal account SHALL have exactly one member owner. A shared account SHALL have at least two household-member holders with effective active intervals. Account classification and holders MUST NOT be inferred from its name. Member deactivation MUST NOT silently change account lifecycle or historical holder intervals.

#### Scenario: Personal account is created

- **WHEN** an active member and valid account details are submitted as personal
- **THEN** the account SHALL be stored with that sole member owner

#### Scenario: Shared account lacks holders

- **WHEN** a shared account is submitted with fewer than two household members
- **THEN** creation SHALL be rejected

### Requirement: Account Lifecycle

An account SHALL be `draft`, `active`, or `closed`. A draft MAY be edited or deleted while unreferenced. Active accounts SHALL be available for new ordinary account activity. Closed accounts SHALL remain visible in historical and corrective workflows but MUST reject new ordinary payments and transfers. An account referenced by posted financial or activity records MUST NOT be permanently deleted.

#### Scenario: Referenced account is removed

- **WHEN** an authorized user removes an account with posted activity
- **THEN** the account SHALL become closed and all historical references SHALL remain intact

#### Scenario: Closed account is selected for a new payment

- **WHEN** a user attempts to post new ordinary activity against a closed account
- **THEN** the operation SHALL be rejected

### Requirement: Exact Posted Account Transfer

A posted account transfer SHALL move one positive minor-unit amount between two distinct active accounts in the same household and currency. One authoritative transfer record SHALL project an equal debit from the source and credit to the destination. Each transfer SHALL have exactly one economic classification. It MAY begin `unclassified` and move once to `pure`, `contribution`, `distribution`, or a classification added by a later capability; classifications MUST NOT overlap. An unclassified or pure transfer MUST NOT change member funding.

#### Scenario: Pure account transfer is posted

- **WHEN** a valid transfer of 10000 minor units is posted
- **THEN** the transfer SHALL project -10000 for the source and +10000 for the destination exactly once and member funding SHALL remain unchanged

#### Scenario: Transfer accounts are identical

- **WHEN** source and destination identify the same account
- **THEN** posting SHALL be rejected

### Requirement: Manual Balance Observation

An authorized user SHALL be able to record a dated balance observation for an account. An observation SHALL state the observed minor-unit amount, effective timestamp, stable effective ordering key, recorded timestamp, and lifecycle and MUST NOT fabricate missing account activity or alter prior posted movements. A mistaken observation SHALL be invalidated and MAY be replaced rather than negated as an account movement.

#### Scenario: First balance is recorded

- **WHEN** a user records a valid observed balance for an account without an observation
- **THEN** the account SHALL expose that amount with its observation timestamp

### Requirement: Estimated Available Balance

When an account has a valid balance observation, Midas SHALL calculate its estimated available balance as the latest effective observation plus every completed posted account-movement correction chain whose net restated effect and effective ordering key follow that observation through the requested cutoff. A reversal and replacement SHALL inherit the original movement's effective ordering key for projection and use their own recorded timestamps for history. Correction chains SHALL be folded before comparison with the observation anchor. The projection SHALL disclose the observation timestamp. Without an observation, the balance SHALL be unavailable rather than zero.

#### Scenario: Movement follows observation

- **WHEN** an account observed at 50000 receives a later posted debit of 10000 and credit of 3000
- **THEN** its estimated balance SHALL be 43000 and SHALL identify the observation date

#### Scenario: Account has no observation

- **WHEN** a balance is requested for an account without a valid observation
- **THEN** the application SHALL return an unavailable balance state

### Requirement: Account Correction and Reversal

Draft account records MAY be edited or deleted. A posted transfer MUST NOT be silently edited or deleted; correction SHALL append an exact linked reversal and MAY append a replacement. Reversing or replacing a transfer SHALL use the original effective ordering key and negate or replace both account projections exactly. A posted balance observation SHALL be invalidated and MAY be replaced while preserving its recorded history.

#### Scenario: Posted transfer is corrected

- **WHEN** a user corrects the amount of a posted transfer
- **THEN** Midas SHALL preserve the original, post an equal opposite reversal, post the replacement when supplied, and append linked activity events

### Requirement: Account History

Account detail SHALL provide deterministic chronological history of observations, transfers, payments, reversals, and later settlement classifications affecting the account. Each item SHALL expose its event date, recorded timestamp, amount, lifecycle, actor projection, and linked subject without exposing another household's data.

#### Scenario: Closed account history is opened

- **WHEN** a user opens a closed account
- **THEN** the application SHALL show its preserved activity and correction links while disabling ordinary new activity
