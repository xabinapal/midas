## MODIFIED Requirements

### Requirement: User Relation

The relational schema SHALL define users with a text identifier, household identifier, optional member identifier, username, password hash, active state, administrator designation, required-password-change state, creation timestamp, and update timestamp. The identifier MUST be the primary key. Household, username, password hash, lifecycle fields, and timestamps MUST be non-null; username MUST be unique; and a member MUST NOT link to more than one user. User, household, member, session, and activity relationships SHALL preserve referential integrity.

#### Scenario: Valid household user is stored

- **WHEN** a user record supplies every required field with an unused identifier and username and valid same-household relationships
- **THEN** the database SHALL persist the record and make it available through typed queries

#### Scenario: Duplicate username is stored

- **WHEN** a user record uses a username already present in the user relation
- **THEN** the database SHALL reject the record

#### Scenario: Member is linked twice

- **WHEN** a second user attempts to link to a member already associated with a user
- **THEN** the database SHALL reject the relationship
