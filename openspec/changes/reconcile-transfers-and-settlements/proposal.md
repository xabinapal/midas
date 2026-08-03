## Why

Paying an expense does not determine whether household members have funded their agreed shares. Midas needs a separate transfer and settlement model that can calculate obligations for any number of members, support shared-account reimbursement, and match partial transfers to one or many expense claims without double-counting money.

## What Changes

- Build settlement semantics on the account-transfer capability while keeping transfers separate from expenses, payments, contributions, and settlement applications.
- Derive per-expense member funding claims from applied payments and expense allocations, including partial and shared-account payments.
- Support direct and shared-account settlement transfers, partial settlement, one transfer covering multiple claims, and one claim covered by multiple transfers.
- Record settlement applications as explanatory matches that do not create a second financial effect.
- Derive pending, partially settled, and settled states and reject over-application, duplicate application, and currency mismatch.
- Generate deterministic recommended transfers from aggregate open member positions while preserving the underlying claims as the source of truth.
- Correct posted transfers and settlements through linked reversal and replacement records.

## Capabilities

### New Capabilities

- `transfer-and-settlement`: Account movements, member funding claims, settlement applications, status derivation, recommendations, and correction behavior.

### Modified Capabilities

- `financial-accounts`: Extends the terminal account-transfer classifications and source/destination compatibility matrix with settlement transfers.
- `expense-management`: Requires payment-application and correction operations to preserve already-applied settlement invariants.

## Impact

- Depends on posted expenses and payments, accounts, household funding, members, and activity history.
- Adds settlement calculation services, transfer and application persistence, pending-balance screens, transfer registration and matching flows, recommendation projections, preseed scenarios, and extensive unit/integration coverage.
- Automatic bank transfers, debt collection, interest, foreign exchange, and treating a recommendation as an authoritative liability are non-goals.
