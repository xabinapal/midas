## 1. Calculation Tests

- [ ] 1.1 Review settlement requirements against accepted expense, payment, account-transfer, funding, member, activity, and experience contracts.
- [ ] 1.2 Write failing exact-arithmetic tests for paid-burden distribution, direct/shared/mixed funding, two-member and multi-member claims, partial payment, and zero-sum invariants.
- [ ] 1.3 Write failing tests for the transfer-classification matrix, account-owner attribution, shared-source explicit attribution, personal destinations, partial/many-to-many applications, unmatched settlement value, every over-application boundary, and idempotency.
- [ ] 1.4 Write failing tests for later-payment compatibility, independent settlement status, deterministic representable-pair recommendations, transitive-netting rejection, alternate valid plans, inactive members, and unchanged-input determinism.
- [ ] 1.5 Write failing tests for settlement-application reversal, transfer reversal ordering, payment/expense correction cascades, and preserved activity links.

## 2. Persistence

- [ ] 2.1 Add a replay-safe reversible migration for settlement applications, correction links, idempotency keys, and claim/recommendation query indexes.
- [ ] 2.2 Update typed schema and implement narrow household-scoped application repositories without persisted mutable claim balances.
- [ ] 2.3 Update local preseed deletion order and add direct/shared/mixed, partial, multi-member, multi-expense, unmatched, duplicate-retry, fully settled, and reversed scenarios.
- [ ] 2.4 Add integration tests for migration replay, application uniqueness, relational scoping, reversal integrity, and preseed completeness.

## 3. Settlement Services

- [ ] 3.1 Implement pure paid-burden, shared-funding attribution, initial/open claim, required/applied amount, and settlement-status projections.
- [ ] 3.2 Implement replay-safe settlement application with exclusive classification, channel/ownership constraints, exact limits, completion visibility, no account duplication, idempotency, and activity attribution.
- [ ] 3.3 Implement household/period/member/expense open-claim grouping and deterministic recordable debtor-creditor recommendations with source composition.
- [ ] 3.4 Implement dependency-aware application, transfer, payment, and expense reversal orchestration with preflight impact previews.
- [ ] 3.5 Add stable structured operational events for settlement failures and corrections without logging financial evidence or credentials.

## 4. Spanish Settlement Workflows

- [ ] 4.1 Build the `Saldos` view for arbitrary member counts with aggregate positions, pending claims, source expenses, unmatched transfers, and balanced state.
- [ ] 4.2 Build transfer registration and matching flows that support shared/personal accounts, one-to-many applications, partial settlement, and explicit debtor/creditor attribution.
- [ ] 4.3 Build recommendation presentation as editable suggestions with scope/cutoff disclosure and direct links to source claims.
- [ ] 4.4 Build settlement/transfer detail, history, impact preview, reversal, and replacement workflows.
- [ ] 4.5 Add component and route tests for independent Spanish statuses, arbitrary participants, long labels, validation, recommendation editing, confirmation, and accessible mobile behavior.

## 5. Verification

- [ ] 5.1 Run focused arithmetic/property, unit, component, and local D1 integration tests throughout implementation.
- [ ] 5.2 Run `mise run format`, `mise run lint`, `mise run check`, and `mise run test`.
- [ ] 5.3 Run strict OpenSpec validation and `/opsx-verify` for this change before archive.
