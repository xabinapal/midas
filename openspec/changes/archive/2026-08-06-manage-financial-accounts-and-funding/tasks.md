## 1. Domain Tests

- [x] 1.1 Review account and funding requirements against accepted household, activity, database, and application-experience contracts.
- [x] 1.2 Write failing unit tests for personal/shared classification, holder constraints, account closure/reopening, cross-household rejection, and household-currency enforcement.
- [x] 1.3 Write failing tests for exact transfer projections, single-owner contribution/distribution attribution, multiple members funding through separate transfers, pure-transfer neutrality, and reversal/replacement.
- [x] 1.4 Write failing tests for balance observations, unavailable balance, post-observation account entries, stale observation disclosure, and historical cutoffs.

## 2. Persistence

- [x] 2.1 Add a replay-safe reversible migration for account drafts/lifecycle, effective holder intervals, balance observations, classified account transfers, contributions/distributions, operation links, corrections, and indexes.
- [x] 2.2 Update typed database schema and implement narrow household-scoped repositories for each aggregate.
- [x] 2.3 Update local preseed deletion order and add personal, shared, closed, and unobserved accounts plus pure transfers, observations, separate contributions/distributions for multiple members, and corrections.
- [x] 2.4 Add integration tests for migration replay, exact transfer constraints, relational integrity, indexes, and preseed completeness.

## 3. Application Services

- [x] 3.1 Implement account lifecycle, holder, and safe-projection services with injected repositories and clocks.
- [x] 3.2 Implement replay-safe account-transfer posting from one authoritative row with exact debit/credit projections, idempotency, completion visibility, and activity attribution.
- [x] 3.3 Implement the source/destination classification matrix, mutually exclusive contribution/distribution attribution, net funding projections, and no duplicate account effect.
- [x] 3.4 Implement balance-observation append and estimated-balance projections with explicit cutoff and freshness.
- [x] 3.5 Implement dependency-aware reversal and replacement for transfers, observations, contributions, and distributions.

## 4. Spanish Account Workflows

- [x] 4.1 Build responsive account list/detail/create/edit-lifecycle screens with holders, classification, balance availability, history, and empty/loading/error states.
- [x] 4.2 Build transfer, contribution, distribution, and balance-observation Superforms with common defaults and explicit attribution confirmation.
- [x] 4.3 Build correction/reversal confirmations and historical views that preserve original, reversal, replacement, actor, and timestamp.
- [x] 4.4 Add component and route tests for arbitrary member allocations, unavailable balances, closed accounts, validation, Spanish terminology, and destructive-action safety.

## 5. Verification

- [x] 5.1 Run focused unit, component, and local D1 integration tests during implementation.
- [x] 5.2 Run `mise run format`, `mise run lint`, `mise run check`, and `mise run test`.
- [x] 5.3 Run strict OpenSpec validation and `/opsx-verify` for this change before archive.
