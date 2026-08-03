## 1. Projection Tests

- [ ] 1.1 Review reporting requirements against every accepted Midas domain and application-experience capability before implementation.
- [ ] 1.2 Write failing tests for expense-period, cash-date, and cumulative cutoff separation, including late invoices, advance payment, and future periods.
- [ ] 1.3 Write failing tests for expected/actual/paid/unpaid/pending totals, matched occurrence de-duplication, cancellation, reversal, and variance.
- [ ] 1.4 Write failing exact-arithmetic tests for member cash-funding components, allocated burden, raw position, total/active residual targets, effective-dated weights, relative position, inactive-member exclusion, shared reserve, and funding-balanced state.
- [ ] 1.5 Write failing tests for traceable drill-down, restated history after later correction, account availability freshness, deterministic ordering, and server pagination.

## 2. Query and Projection Layer

- [ ] 2.1 Add replay-safe indexes required for household, period, event-date, member, status, settlement, and activity report queries and update preseed when schema changes.
- [ ] 2.2 Implement narrow reporting repository interfaces and pure projection services with explicit basis, cutoff, currency, and freshness metadata.
- [ ] 2.3 Implement period totals and expected-versus-actual source projections that reconcile exactly with filtered expense records.
- [ ] 2.4 Implement member funding, burden, raw/residual/relative position, and balanced-state projections for arbitrary active and historical members.
- [ ] 2.5 Implement bounded recent/upcoming/history queries and URL-backed server-side filter, sort, and pagination state.
- [ ] 2.6 Ensure financial correctness bypasses eventual-consistency caches; add only explicitly safe noncritical caching if justified and tested.

## 3. Dashboard and History Workflows

- [ ] 3.1 Replace the skeleton dashboard with the action-first current-period composition and link every amount to its reconciled source projection.
- [ ] 3.2 Build past/future/custom period navigation, expected/actual comparison, expense status groups, and no-data states.
- [ ] 3.3 Build arbitrary-member funding and relative-position rows with retained-reserve explanation, inactive-member flags, and plain Spanish positive/negative wording.
- [ ] 3.4 Integrate open-claim recommendations, upcoming recurring expenses, observed shared-account availability, and bounded recent activity.
- [ ] 3.5 Build server-filtered expense, account, transfer, settlement, member-position, and activity history views with restatement disclosure.

## 4. Experience Verification

- [ ] 4.1 Add component and route tests for Spanish formatting, independent statuses, traceable totals, future periods, corrections, arbitrary member counts, loading/error/empty states, and URL restoration.
- [ ] 4.2 Manually verify action hierarchy, numerical alignment, no decorative chart dependence, narrow mobile layouts, tablet/desktop density, light/dark themes, keyboard operation, and WCAG 2.2 AA behavior.
- [ ] 4.3 Verify aggregate query plans and bounded response sizes against representative preseed and larger generated local datasets without touching remote storage.

## 5. Final Verification

- [ ] 5.1 Run focused unit, component, and local D1 integration tests throughout implementation.
- [ ] 5.2 Run `mise run format`, `mise run lint`, `mise run check`, and `mise run test`.
- [ ] 5.3 Run strict OpenSpec validation and `/opsx-verify` for this change before archive.
