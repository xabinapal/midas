## ADDED Requirements

### Requirement: Generic Household Membership

A household SHALL contain two or more members and MUST support an arbitrary number of active and historical members without name, gender, relationship, or two-person assumptions. Each member SHALL have a stable identifier, household identifier, display name, active lifecycle, creation timestamp, and update timestamp.

#### Scenario: Household adds a third member

- **WHEN** an authorized user adds a valid member to a household that already has two members
- **THEN** the member SHALL become available to new household workflows without changing existing member identities or history

### Requirement: Member and User Separation

A household member SHALL exist independently from authentication. A member MAY have one associated application user, and a user MAY associate with at most one member in the same household. Disabling or deleting an unreferenced user MUST NOT delete its member, and deactivating a member MUST NOT silently disable an associated user.

#### Scenario: Historical member has no login

- **WHEN** a member's associated user is disabled or absent
- **THEN** the member SHALL remain available in historical financial records and filters

#### Scenario: Member is deactivated

- **WHEN** an authorized user deactivates a member linked to an active user
- **THEN** the application SHALL require an explicit separate decision about the user's access

### Requirement: Default Allocation Weights

Every active member SHALL have a non-negative default allocation weight, and the household SHALL require the total active weight to be greater than zero. Each weight and active-state change SHALL have an effective timestamp so reporting can resolve membership and defaults at a cutoff. Equal allocation SHALL use equal weights regardless of the configured custom defaults. Changing defaults SHALL affect only newly initialized allocations and MUST NOT alter stored historical allocations.

#### Scenario: Household uses a custom default split

- **WHEN** active members have weights `50`, `30`, and `20`
- **THEN** a new default-weight allocation SHALL initialize those proportions across all three members

#### Scenario: Default weights change

- **WHEN** an authorized user changes member weights after expenses exist
- **THEN** existing allocation amounts SHALL remain unchanged

### Requirement: Member Lifecycle and Historical Preservation

An active member MAY become inactive and later active again. Inactive members MUST be excluded from new default allocations but SHALL remain selectable for historical correction, refund, and settlement workflows. A member referenced by financial or activity history MUST NOT be permanently deleted.

#### Scenario: Referenced member is removed

- **WHEN** an authorized user removes a member referenced by a posted record
- **THEN** the system SHALL deactivate the member while preserving every reference and displayed historical name

#### Scenario: Unreferenced mistaken member is deleted

- **WHEN** a member has no financial, user, or activity references
- **THEN** an authorized user MAY permanently delete it after confirmation

### Requirement: Household Currency and Locale

Each household SHALL have one configured ISO 4217 currency, one IANA timezone, and the `es-ES` presentation locale. Financial records SHALL use integer minor units in the household currency, and household-local due dates SHALL use the configured timezone. Changing the household currency after a posted financial record exists MUST be rejected.

#### Scenario: New household is configured

- **WHEN** the initial household is created with EUR
- **THEN** financial entry SHALL store EUR minor units, evaluate local dates in the configured timezone, and use Spanish formatting

#### Scenario: Posted data exists

- **WHEN** an administrator attempts to change the household currency after a financial event is posted
- **THEN** the change SHALL be rejected without converting historical values
