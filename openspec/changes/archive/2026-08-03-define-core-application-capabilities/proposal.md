## Why

The application has established runtime, persistence, observability, and security behavior without corresponding OpenSpec contracts. Capturing these behaviors now provides a durable source of truth for future changes and prevents work in one area from silently breaking guarantees owned by another.

## What Changes

- Define the application runtime structure, server/client boundaries, request initialization, route access classification, metadata, and crawler behavior.
- Define structured application logging and centralized request completion records.
- Define relational persistence, migration, initialization, and local data-management behavior.
- Define namespaced key-value storage, validated cache behavior, consistency constraints, and local cache cleanup.
- Define optional internal user authentication, password protection, route guards, signed cookie sessions, login, and logout behavior.
- Establish these specifications as requirements that future proposals and implementations must preserve or explicitly modify.

## Capabilities

### New Capabilities

- `application-structure`: Runtime boundaries, request context, server-side data access, route classifications, application identity, and crawler behavior.
- `application-logging`: Structured log records, severity filtering, centralized request logging, and sensitive-data restrictions.
- `relational-database`: D1 access, typed queries, migrations, initialization, schema guarantees, and local database operations.
- `key-value-storage`: Namespaced JSON storage, validated caches, eventual-consistency constraints, and selective local cache cleanup.
- `user-authentication`: Configurable internal authentication, password hashing, protected routes, JWT cookie sessions, login, and logout.

### Modified Capabilities

None.

## Impact

- Adds the first normative capability specifications under OpenSpec.
- Establishes cross-cutting contracts for routes, server modules, Cloudflare bindings, operational commands, tests, and security-sensitive behavior.
- Adds no runtime dependency and changes no application behavior.
- Requires future changes to review applicable specifications and use an OpenSpec proposal when requirements need to change.
