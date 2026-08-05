# application-structure Specification

## Purpose

Defines application execution boundaries, request context, route access classification, application identity, crawler policy, and public/private configuration separation.

## Requirements

### Requirement: Server and Client Boundaries

Private environment values, platform bindings, persistence clients, authentication services, session handling, and server logging SHALL remain in server-only execution contexts. Browser-capable modules MUST NOT import server-only modules or receive raw platform bindings, private configuration, credentials, or secrets. Data needed by browser code SHALL cross the boundary only as an explicit safe projection returned by a server load, action, or endpoint.

#### Scenario: Server data is projected safely

- **WHEN** a page requires storage data, private configuration, or authenticated request identity
- **THEN** server-side code SHALL read that data and return only fields explicitly intended for browser use

#### Scenario: Client code is isolated from private dependencies

- **WHEN** the client application is built
- **THEN** its module graph MUST NOT contain raw storage bindings, private environment values, credentials, or server-only services

### Requirement: Request-Scoped Application Context

Before resolving a runtime route, the application SHALL establish a request-local reference to the initialized relational client, optional key-value storage, authentication configuration, and authenticated user context. Request-specific identity and authentication state MUST NOT be stored in mutable process-global or module-level state.

#### Scenario: Runtime context is initialized

- **WHEN** a runtime request arrives with the required relational binding and an available key-value binding
- **THEN** the route SHALL receive an initialized relational client, a namespaced key-value store, evaluated authentication configuration, and an authenticated user projection or `null`

#### Scenario: Optional key-value storage is unavailable

- **WHEN** a runtime request has no available key-value binding
- **THEN** request initialization SHALL expose key-value storage as unavailable without fabricating a store

### Requirement: Server-Side Data and Mutation Handling

Page data that depends on private configuration, request identity, D1, or Workers KV SHALL be loaded in server execution. Mutations SHALL execute through server form actions or server endpoints and SHALL validate untrusted input before invoking application behavior.

#### Scenario: Page loads private data

- **WHEN** a page needs data from a server-only resource
- **THEN** a server load SHALL obtain the data and return a safe page projection

#### Scenario: Browser submits a mutation

- **WHEN** a browser submits application data
- **THEN** a server action or endpoint SHALL validate the input before executing the mutation

### Requirement: Explicit Route Access Classification

Route placement SHALL determine whether a route is a protected browser page, a protected server endpoint, or public. Routes in the protected browser and API groups MUST remain dynamically rendered and MUST NOT depend on hidden navigation or client-side checks for protection. Routes outside those groups SHALL be treated as public.

#### Scenario: Protected browser page is defined

- **WHEN** a page belongs to the protected browser route group
- **THEN** the server request lifecycle SHALL classify it as protected and prerendering SHALL be disabled for its route tree

#### Scenario: Protected endpoint is defined

- **WHEN** a server endpoint belongs to the protected API route group
- **THEN** the server request lifecycle SHALL classify it as protected and that endpoint SHALL explicitly disable prerendering

#### Scenario: Route is outside protected groups

- **WHEN** a route belongs to neither protected route group
- **THEN** the request lifecycle SHALL treat it as public

### Requirement: Protected Content Cannot Be Prerendered

Protected content MUST NOT be emitted as static output. If build-time processing encounters a protected route, processing SHALL fail rather than render the protected content.

#### Scenario: Build encounters a protected route

- **WHEN** build-time route processing reaches a route classified as protected
- **THEN** processing SHALL fail and MUST NOT produce static protected content

### Requirement: Centralized Application Identity

The application SHALL maintain one client-safe identity source for its title, description, author, keywords, theme color, manifest short name, manifest background color, manifest display mode, and crawler indexability. Document metadata, visible application identity, and those web-manifest properties SHALL derive from this source. The root layout's canonical, icon, and manifest links SHALL use the configured public application base URL.

#### Scenario: Root metadata is rendered

- **WHEN** the root layout renders a page
- **THEN** its title, description, author, keywords, theme color, and crawler metadata SHALL agree with the centralized application identity

#### Scenario: Web manifest is requested

- **WHEN** a client requests `/site.webmanifest`
- **THEN** the response SHALL derive its name, short name, description, theme color, background color, and display mode from the centralized application identity

### Requirement: Unified Crawler Policy

One indexability setting SHALL control both document crawler metadata and `/robots.txt`. When indexing is disabled, rendered documents SHALL emit `noindex,nofollow` and `/robots.txt` SHALL disallow all paths. When indexing is enabled, rendered documents SHALL emit `index,follow` and `/robots.txt` SHALL allow all paths.

#### Scenario: Indexing is disabled

- **WHEN** application indexability is false
- **THEN** rendered documents SHALL contain `noindex,nofollow` and `/robots.txt` SHALL disallow `/`

#### Scenario: Indexing is enabled

- **WHEN** application indexability is true
- **THEN** rendered documents SHALL contain `index,follow` and `/robots.txt` SHALL allow `/`

### Requirement: Public and Private Environment Separation

Environment values intended for browser use SHALL use the configured public prefix. Bootstrap credentials, recovery-mode credentials, and other security configuration MUST remain outside the public namespace and MUST NOT be exposed to client code. Revocable session bearer tokens SHALL exist only in secure cookies and transient server request handling; their stored digests SHALL remain server-side relational data.

#### Scenario: Bootstrap or recovery credential is configured

- **WHEN** the application receives a bootstrap or operator-recovery credential
- **THEN** the credential SHALL be available only to server execution and MUST NOT be serialized to the browser, logs, activity metadata, or public configuration

#### Scenario: Session is projected to the client

- **WHEN** a protected server load returns authenticated identity
- **THEN** it SHALL return only the safe user/member/household projection and MUST NOT return the bearer token or stored digest
