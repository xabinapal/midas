# relational-database Specification

## Purpose

Defines typed D1 access, migration and initialization behavior, relational schema constraints, and local database operations.

## Requirements

### Requirement: Typed Relational Access

D1 SHALL be the authoritative relational store. Server-side request handling SHALL access it through a typed database client parameterized by the application schema. Application persistence code MUST use the typed client through request locals and repository boundaries rather than accessing the raw binding or issuing raw SQL.

#### Scenario: Request receives database access

- **WHEN** a runtime request arrives with an available D1 binding and initialization succeeds
- **THEN** server-side request handling SHALL receive a database client typed with the application schema

#### Scenario: D1 binding is unavailable

- **WHEN** a runtime request arrives without the required D1 binding
- **THEN** initialization SHALL fail before the route is served

### Requirement: Migration Lifecycle

Schema changes MUST be expressed as ordered TypeScript migrations registered with the application migration provider and implemented through the typed schema builder. Pending migrations SHALL be applied before the first runtime request is served and when the local migration operation is invoked. An applied migration MUST NOT be rewritten; subsequent changes MUST use a new ordered migration. A migration error or non-success result MUST fail the operation.

#### Scenario: First request has pending migrations

- **WHEN** the first runtime request reaches an application instance whose database has pending migrations
- **THEN** all pending migrations SHALL complete before request handling continues

#### Scenario: Migration does not complete successfully

- **WHEN** a migration returns an error or a result other than success
- **THEN** initialization SHALL fail and the request MUST NOT be served against the incomplete schema

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

### Requirement: Replay-Safe Migrations

Forward migrations MUST be safe to replay because migration execution does not provide cross-isolate serialization or transaction guarantees. Migrations SHALL use idempotent schema operations, conflict handling, or equivalent safeguards so repeated or competing attempts do not corrupt data.

#### Scenario: Forward migration is replayed

- **WHEN** a replay-safe migration executes more than once against the same schema
- **THEN** the database SHALL retain one valid resulting schema without duplicate data created by the migration

### Requirement: Migration Introspection Boundary

Migration-oriented table and view discovery SHALL remain available. General schema introspection MUST fail explicitly when correct column metadata cannot be obtained rather than return incomplete or misleading information.

#### Scenario: Migrator discovers schema objects

- **WHEN** migration processing requests table and view discovery
- **THEN** the database adapter SHALL return the discoverable schema objects needed by the migrator

#### Scenario: General introspection is requested

- **WHEN** application code requests unsupported full schema introspection
- **THEN** the adapter SHALL reject explicitly

### Requirement: User Relation

The relational schema SHALL define users with a text identifier, username, password hash, creation timestamp, and update timestamp. The identifier MUST be the primary key. Username, password hash, and timestamps MUST be non-null, and username MUST be unique.

#### Scenario: Valid user is stored

- **WHEN** a user record supplies every required field with an unused identifier and username
- **THEN** the database SHALL persist the record and make it available through typed queries

#### Scenario: Duplicate username is stored

- **WHEN** a user record uses a username already present in the user relation
- **THEN** the database SHALL reject the record

### Requirement: Local Database Operations

The application SHALL provide local operations for applying migrations, preseeding development data, and resetting the database. Every operation MUST explicitly disable remote bindings. Preseeding SHALL apply pending migrations, clear all application relations in dependency-safe order, and insert bounded development data without storing plaintext passwords. Resetting SHALL verify every migration is reversible before changing data, roll all migrations back, and reapply the latest migrations.

#### Scenario: Local database is preseeded

- **WHEN** the local preseed operation runs
- **THEN** migrations SHALL be applied, existing application rows SHALL be removed, and development records SHALL be inserted without accessing remote D1

#### Scenario: Reset includes an irreversible migration

- **WHEN** the local reset operation finds a migration without a reverse operation
- **THEN** it SHALL abort before changing the database

#### Scenario: Local database is reset

- **WHEN** every migration supports reversal and the local reset operation runs
- **THEN** all migrations SHALL be rolled back and reapplied without accessing remote D1

### Requirement: Development Preseed Isolation and Completeness

Development preseed behavior SHALL remain outside the production application module graph and MUST NOT execute during production builds, previews, deployments, or runtime requests. Every relational schema change SHALL update the preseed operation in the same change so it clears every application relation in dependency-safe order and supplies valid representative data for new required relations, columns, and relationships.

#### Scenario: Production application is built

- **WHEN** the production application is built
- **THEN** development preseed code and credentials MUST NOT enter the production application bundle or execute

#### Scenario: Relational schema changes

- **WHEN** a migration adds or changes an application relation, required column, or relationship
- **THEN** the same change SHALL update deletion order and representative preseed data for the resulting schema
