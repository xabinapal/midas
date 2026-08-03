## ADDED Requirements

### Requirement: Settlement-Aware Payment Mutation

When the transfer-and-settlement capability is present, before a payment application is added, changed, or reversed for an expense with active settlement applications, Midas SHALL calculate the resulting member positions and deterministic non-overlapping pair claim lots. Existing settlement applications SHALL consume resulting lots in stable application order. For every debtor-creditor pair, resulting lot capacity MUST be at least the cumulative active applied amount for that exact pair. If pair capacity, a member position, or total required settlement would be exceeded or contradicted, the payment mutation MUST be rejected unless the same replay-safe corrective operation first reverses the incompatible settlement applications.

#### Scenario: Other member pays after partial settlement

- **WHEN** a later payment would reduce an already settled claim lot below its active applied amount
- **THEN** the payment application SHALL be rejected with the affected settlement references until they are reversed or rematched

#### Scenario: Compatible later payment is posted

- **WHEN** a later payment leaves every applied settlement within the recalculated pair lots and total required amount
- **THEN** the payment application MAY post and settlement status SHALL recalculate

#### Scenario: Later payment changes canonical pairing

- **WHEN** member totals remain sufficient but recalculated deterministic lots remove an actively applied debtor-creditor pair
- **THEN** the payment mutation SHALL be rejected until that exact-pair application is reversed or rematched
