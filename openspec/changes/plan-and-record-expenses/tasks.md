## 1. Domain Tests

- [ ] 1.1 Review expense and planning requirements against accepted household, account, funding, activity, and experience contracts.
- [ ] 1.2 Write failing property-focused tests for equal/default/custom-weight/percentage/fixed allocations, member subsets, exact sums, largest remainder, and stable tie-breaking.
- [ ] 1.3 Write failing tests for expense lifecycle/value/payment/due dimensions, human references, category lifecycle, evidence safety, and correction/reversal.
- [ ] 1.4 Write failing tests for payment/application many-to-many limits, account debits, shared versus member funding, unapplied value, reversal, and idempotency.
- [ ] 1.5 Write failing tests for custom reporting periods, service spans, estimate actualization, recurrence cadence, occurrence idempotency, template prospectivity, skipping, and expected/actual matching.

## 2. Persistence

- [ ] 2.1 Add replay-safe reversible migrations for categories, reporting periods, expenses, allocations/method metadata, payments/applications, evidence references, recurring templates/occurrences, and correction links.
- [ ] 2.2 Update typed schema and implement household-scoped repositories with uniqueness and query indexes for reference, period, date, category, payment state, and template occurrence.
- [ ] 2.3 Update local preseed deletion order and add varied categories, monthly/yearly templates, custom periods, estimates, actuals, annual spans, member subsets, custom splits, shared/personal payments, partial/multi applications, cancellations, and reversals.
- [ ] 2.4 Add local integration tests for migration replay, exact relational constraints, occurrence uniqueness, reference collisions, account effects, and preseed completeness.

## 3. Domain and Application Services

- [ ] 3.1 Implement pure allocation resolution and validation using integer minor units and deterministic largest remainder.
- [ ] 3.2 Implement expense/category lifecycle, stable reference generation, independent status derivation, evidence validation, and safe projections.
- [ ] 3.3 Implement replay-safe payment and application posting with one account effect, exact remaining limits, completion visibility, unapplied value, idempotency, and activity events.
- [ ] 3.4 Implement reporting-period/service-span rules, estimate actualization, recurring-template lifecycle, idempotent occurrence generation, and expected/actual matching.
- [ ] 3.5 Implement dependency-aware cancellation, reversal, and replacement across expenses, allocations, payments, applications, account entries, and history.

## 4. Spanish Expense and Planning Workflows

- [ ] 4.1 Build the progressive common expense form with paid/unpaid, actual/estimated, account, period, category, member subset, and allocation defaults visible before submission.
- [ ] 4.2 Build period expense list/detail with independent payment/planning/due states, allocations, payments, evidence references, and activity history, omitting settlement UI until that capability is available.
- [ ] 4.3 Build advanced payment matching, partial payment, multi-expense application, and unapplied-payment workflows.
- [ ] 4.4 Build category, reporting-period, recurring-template, expected-occurrence, actualization, skip/cancel, and expected/actual matching workflows.
- [ ] 4.5 Build reversal/replacement confirmations and add component/route tests for common and advanced Spanish flows, long labels, validation, states, and accessible mobile interaction.

## 5. Verification

- [ ] 5.1 Run focused unit, component, and local D1 integration tests throughout the test-first implementation.
- [ ] 5.2 Run `mise run format`, `mise run lint`, `mise run check`, and `mise run test`.
- [ ] 5.3 Run strict OpenSpec validation and `/opsx-verify` for this change before archive.
