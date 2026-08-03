## ADDED Requirements

### Requirement: Structured Log Records

Every emitted runtime application log SHALL be a logfmt record beginning with `msg`, `level`, and `ts`, followed by caller-supplied context fields. The timestamp SHALL be an ISO 8601 UTC timestamp representing the time of emission.

#### Scenario: Informational event is formatted

- **WHEN** an informational event is emitted with additional context
- **THEN** the record SHALL begin with `msg`, `level=info`, and `ts` before its context fields

### Requirement: Log Value Encoding and Omission

Values containing whitespace, an equals sign, or a double quote MUST be enclosed in double quotes. Backslashes and double quotes within quoted values MUST be escaped. Numbers and booleans SHALL remain unquoted. JSON-serializable objects and arrays SHALL be serialized before logfmt quoting rules are applied. Context fields with an empty string, `null`, or `undefined` value SHALL be omitted.

#### Scenario: Values requiring quoting are encoded

- **WHEN** a context value contains whitespace, an equals sign, or a quote
- **THEN** the value SHALL be quoted and embedded quotes and backslashes SHALL be escaped

#### Scenario: Empty values are omitted

- **WHEN** context fields contain an empty string, `null`, or `undefined`
- **THEN** those fields SHALL NOT appear in the log record

#### Scenario: Primitive values remain unquoted

- **WHEN** context fields contain numbers or booleans
- **THEN** those values SHALL be represented without quotes

### Requirement: Logging Levels and Filtering

The logger SHALL support the ordered levels `debug`, `info`, `warn`, and `error`. Development mode SHALL emit all supported levels. Non-development mode SHALL omit `debug` and emit `info`, `warn`, and `error` records.

#### Scenario: Debug event in development

- **WHEN** a debug event is submitted in development mode
- **THEN** the logger SHALL emit the event

#### Scenario: Debug event outside development

- **WHEN** a debug event is submitted outside development mode
- **THEN** the logger SHALL produce no output for that event

### Requirement: Centralized Runtime Logging

Runtime application code SHALL use the centralized structured logger rather than writing directly to console methods. Error, warning, and informational records SHALL use their corresponding runtime console severity, while debug records SHALL use the general log sink. Operational command scripts MAY write command results directly to the console.

#### Scenario: Runtime error is emitted

- **WHEN** application runtime code records an error event
- **THEN** the centralized logger SHALL format it as logfmt and emit it through the error console severity

#### Scenario: Local command reports completion

- **WHEN** an operational command completes
- **THEN** the command MAY write a human-readable result directly to the console

### Requirement: Request Completion Records

The centralized request lifecycle SHALL emit one completion record for every resolved or failed request. The message SHALL contain the request method and URL pathname. Context SHALL include `method`, `path`, numeric `status`, and integer `duration_ms`. Query strings, request bodies, response bodies, and request headers MUST NOT be included.

#### Scenario: Successful request completes

- **WHEN** a `GET` request to `/items?sort=name` completes with status `200`
- **THEN** one completion record SHALL identify `GET /items`, path `/items`, status `200`, and elapsed integer milliseconds without the query string

#### Scenario: Request fails without a numeric status

- **WHEN** request processing throws an error without a numeric `status` property
- **THEN** the completion record SHALL use status `500`

### Requirement: Access Log Severity

Request completion records below status `400` SHALL use `info`, records from `400` through `499` SHALL use `warn`, and records at `500` or above SHALL use `error`.

#### Scenario: Redirect completes

- **WHEN** a request completes with status `303`
- **THEN** its completion record SHALL use level `info`

#### Scenario: Client error completes

- **WHEN** a request completes with status `404`
- **THEN** its completion record SHALL use level `warn`

#### Scenario: Server error completes

- **WHEN** a request completes with status `503`
- **THEN** its completion record SHALL use level `error`

### Requirement: Sensitive Data Exclusion

Runtime logging call sites MUST NOT pass plaintext passwords, password hashes, session tokens, JWTs, cookie values, authentication secrets, authorization headers, or equivalent credentials to the logger. Callers SHALL provide only context values that are safe for operational logging.

#### Scenario: Authentication request completes

- **WHEN** request processing has access to submitted credentials, session cookies, or signing secrets
- **THEN** its completion record MUST omit those values and contain only the defined safe request context

### Requirement: Stable Logging Vocabulary

Application-defined event messages and context keys SHALL remain stable and lowercase so operational consumers can query them reliably. Request completion messages SHALL preserve the uppercase HTTP method. Routes MUST NOT duplicate the request completion record emitted by the centralized lifecycle.

#### Scenario: Route handles a request

- **WHEN** a route emits domain-specific operational events
- **THEN** it SHALL leave the single request completion record to the centralized request lifecycle
