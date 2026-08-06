# household-funding Specification

## Purpose

Defines member contributions into shared household accounts and distributions back to members as distinct economic events on posted account transfers, explicit single-member attribution persisted at posting, per-member net shared funding totals, and funding correction by linked reversal and replacement with preserved history.

## Requirements

### Requirement: Contribution Is Distinct from Transfer and Expense

A contribution SHALL represent economic value supplied by one member to a shared household account and SHALL be the sole economic classification of exactly one posted personal-to-shared transfer. The contributing member SHALL be the personal source-account owner and the contribution amount SHALL equal the full transfer amount. It MUST NOT also be treated as pure transfer, distribution, expense, expense payment, or settlement. Contributions from multiple members SHALL use multiple contribution transfers.

#### Scenario: Two members contribute

- **WHEN** two members supply 6000 and 4000 from their respective personal accounts
- **THEN** Midas SHALL record two contribution transfers, attribute each to its source owner, and affect each account movement exactly once

#### Scenario: Contribution member differs from source owner

- **WHEN** a contribution names a member other than the personal source-account owner
- **THEN** posting SHALL be rejected

### Requirement: Distribution Is Distinct from Settlement

A distribution SHALL represent shared-account value returned to one member without settling an expense claim and SHALL be the sole economic classification of exactly one posted shared-to-personal transfer. The recipient SHALL be the personal destination-account owner and the distribution amount SHALL equal the full transfer amount. A reimbursement that settles open expense claims MUST use settlement semantics instead of distribution. Distributions to multiple members SHALL use multiple transfers.

#### Scenario: Shared reserve is returned

- **WHEN** shared reserve is sent to two members' personal accounts
- **THEN** Midas SHALL record one distribution transfer per destination owner and decrease each recipient's funding without changing expense settlement

### Requirement: Explicit Funding Attribution

Contribution and distribution attribution SHALL reference the personal source or destination owner explicitly, and posting SHALL persist the confirmed member and full amount. Shared-account holder lists and default expense shares MUST NOT determine or retroactively change attribution.

#### Scenario: Default shares later change

- **WHEN** household allocation defaults change after a contribution is posted
- **THEN** the stored contribution allocation SHALL remain unchanged

### Requirement: Member Net Shared Funding

For a selected cutoff and member, net shared funding SHALL equal posted non-reversed contribution allocations minus posted non-reversed distribution allocations. Pure account transfers MUST contribute zero. Totals SHALL be available per period and cumulatively and SHALL not include direct expense payments or settlements unless the reporting capability explicitly composes those independent measures.

#### Scenario: Member contributes and receives a distribution

- **WHEN** a member has contributed 12000 and received a distribution of 2000 through the cutoff
- **THEN** their net shared funding SHALL be 10000

### Requirement: Funding Correction and History

A posted contribution or distribution MUST NOT be edited or deleted. Correction SHALL reverse the linked funding classification and its account transfer together and MAY post a replacement. History SHALL retain the original attribution, reversal, replacement, actors, timestamps, and links.

#### Scenario: Contribution member is corrected

- **WHEN** a posted contribution was attributed to the wrong member
- **THEN** Midas SHALL reverse the original transfer and contribution and post a corrected replacement rather than rewriting the original allocation
