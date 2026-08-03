## MODIFIED Requirements

### Requirement: Single-Flight Initialization

Database initialization SHALL be single-flight within each runtime isolate. Concurrent requests awaiting initialization SHALL share one client creation and migration attempt, and subsequent requests SHALL reuse the initialized client. If client creation or migration fails, the application MUST reject dependent requests, clear the failed initialization state, and permit a later request to retry. Any client successfully created during a failed attempt MUST be disposed.

#### Scenario: Concurrent requests initialize the database

- **WHEN** multiple requests arrive in one isolate while initialization is pending
- **THEN** they SHALL share one migration attempt and receive the same initialized client

#### Scenario: Client creation fails and is retried

- **WHEN** database client creation throws during initialization
- **THEN** dependent requests SHALL fail and a later request SHALL perform a new initialization attempt

#### Scenario: Initialization fails and is retried

- **WHEN** a migration attempt fails during initialization
- **THEN** the request SHALL fail, the client SHALL be disposed, and a later request SHALL perform a new initialization attempt
