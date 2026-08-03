## MODIFIED Requirements

### Requirement: Public and Private Environment Separation

Environment values intended for browser use SHALL use the configured public prefix. Bootstrap credentials, recovery-mode credentials, and other security configuration MUST remain outside the public namespace and MUST NOT be exposed to client code. Revocable session bearer tokens SHALL exist only in secure cookies and transient server request handling; their stored digests SHALL remain server-side relational data.

#### Scenario: Bootstrap or recovery credential is configured

- **WHEN** the application receives a bootstrap or operator-recovery credential
- **THEN** the credential SHALL be available only to server execution and MUST NOT be serialized to the browser, logs, activity metadata, or public configuration

#### Scenario: Session is projected to the client

- **WHEN** a protected server load returns authenticated identity
- **THEN** it SHALL return only the safe user/member/household projection and MUST NOT return the bearer token or stored digest
