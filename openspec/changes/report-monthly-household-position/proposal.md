## Why

The domain records are only useful if household members can understand the current month, upcoming costs, funding balance, pending reimbursements, account availability, and historical changes without reading an accounting ledger. Midas needs a compact reporting layer that derives all figures from the authoritative records.

## What Changes

- Define the default current-period dashboard and month navigation across past and future periods.
- Summarize expected, actual, unpaid, paid, pending-settlement, settled, overdue, and estimated expenses without collapsing their distinct state dimensions.
- Show each member's net household funding, allocated burden, effective share, and position for arbitrary household sizes.
- Show recommended settlement actions, upcoming recurring expenses, recent activity, optional shared-account availability, and expected-versus-actual comparisons.
- Provide month expense lists, historical balances, settlement history, and auditable activity views with bounded server-side filtering and Spanish financial formatting.
- Define transparent calculation cutoffs and freshness so corrections and reversals recalculate every affected view.

## Capabilities

### New Capabilities

- `household-reporting`: Period summaries, member positions, expected-versus-actual reporting, dashboard prioritization, history views, and recalculation behavior.

### Modified Capabilities

None.

## Impact

- Depends on all preceding Midas domain capabilities and the common application experience.
- Replaces the skeleton dashboard and starter cache demonstration with protected reporting pages and projections.
- Affects server loads, reporting queries/services, bounded table state, URL month state, dashboard and history components, cache policy where correctness permits, and test fixtures.
- Decorative analytics, forecasting beyond configured expected expenses, net-worth tracking, and exporting reports are non-goals.
