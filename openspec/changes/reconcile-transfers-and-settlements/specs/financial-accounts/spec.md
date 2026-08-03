## ADDED Requirements

### Requirement: Settlement Transfer Classification

The account-transfer classification set SHALL include `settlement` as a terminal economic meaning. A settlement transfer SHALL use a personal or shared source and a personal destination and MUST NOT also be pure, contribution, or distribution. A transfer MAY move from `unclassified` to `settlement` once. Personal-to-shared transfers SHALL be pure or contribution, shared-to-personal transfers SHALL be distribution or settlement, and shared-to-shared transfers SHALL be pure.

When a settlement source is personal, every linked application SHALL identify its owner as debtor. When the source is shared, each debtor SHALL be explicit. Every linked application SHALL identify the personal destination owner as creditor. Every member, account, expense, and transfer SHALL belong to the same household and currency.

#### Scenario: Shared account reimburses a member

- **WHEN** an unclassified shared-to-personal transfer is validly classified as settlement
- **THEN** its applications SHALL identify explicit debtors and the personal destination owner as creditor without changing the account effect again

#### Scenario: Settlement overlaps a distribution

- **WHEN** a shared-to-personal transfer is already classified as distribution
- **THEN** classifying any portion as settlement SHALL be rejected

#### Scenario: Personal source is attributed to another member

- **WHEN** a settlement application identifies a debtor other than the personal source-account owner
- **THEN** the application SHALL be rejected
