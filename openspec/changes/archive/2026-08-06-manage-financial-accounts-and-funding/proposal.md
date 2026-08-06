## Why

Household expenses can be paid from personal or shared accounts, and contributions to a shared account are economically different from expenses or reimbursements. Midas needs explicit account and funding records before it can calculate who has provided household money.

## What Changes

- Define personal and shared accounts without bank connectivity, including effective-dated holders, lifecycle, household currency, and manual balance observations.
- Define contributions into shared accounts and distributions back to members as distinct economic events linked to account transfers.
- Track account activity from Midas-recorded payments and transfers while clearly labeling manually observed or estimated balances.
- Preserve closed accounts and posted funding records for history; correct posted records by reversal and replacement.
- Present account, contribution, and balance workflows using the shared Spanish mobile experience contract.

## Capabilities

### New Capabilities

- `financial-accounts`: Account classification, holders, lifecycle, manually tracked balances, and account-history behavior.
- `household-funding`: Member contributions, distributions, monthly funding totals, and their distinction from expenses and transfers.

### Modified Capabilities

None.

## Impact

- Depends on `manage-household-members-and-access` for household scope, member identity, actor attribution, and activity history.
- Adds authoritative D1 financial relations, repositories, services, schemas, protected account screens, forms, representative preseed data, and unit/component/integration coverage.
- Uses one configurable household currency and integer minor units; foreign exchange, bank synchronization, and full personal-bank reconciliation are non-goals.
