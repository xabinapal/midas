## Context

Expense allocation answers who bears a cost. Payment funding answers who supplied the paid cash. Their difference creates member claims. Account transfer answers where cash moved. Settlement application answers which open member claims that transfer resolves. None of these can safely substitute for another.

For expense `e`, member `m`, expense amount `E`, cumulative applied payment `P`, resolved allocation `A_m`, direct member-funded payment `D_m`, and shared-funded payment `S`:

```text
paid burden B_m = allocate P proportionally by A_m using largest remainder
shared funding S_m = allocate S proportionally by A_m using largest remainder
initial claim C_m = D_m + S_m - B_m
```

Positive `C_m` means the member funded more than their paid burden and is a creditor. Negative means debtor. The invariant is `sum(C_m) = 0` for each expense's paid portion.

Member positions are then resolved into non-overlapping pair claim lots. Creditors and debtors are ordered by largest absolute open amount and stable member ID; each step creates a lot for the lesser remaining amount and decrements both sides until all positions are zero. Existing settlement applications consume these exact lots. This ensures total pair claims equal required settlement and no debtor or creditor value is recommended twice.

## Goals / Non-Goals

**Goals:**

- Derive claims for any number and subset of members from stored allocations and payments.
- Support shared-account payment without inventing a member payer.
- Match one transfer to many claims and one claim to many transfers, including partial matching.
- Keep transfer account effects singular while settlement applications explain member effects.
- Produce understandable, deterministic recommendations without making pairwise debt canonical.
- Recalculate safely after payment or transfer reversals.

**Non-Goals:**

- Bank execution, collection, legal debt, interest, foreign exchange, or guaranteed optimization to the globally minimum transfer count.
- Making one predefined member or the shared account a permanent debtor or creditor.
- Treating unmatched account movement as settled value.

## Decisions

### Derive claims only for the paid portion

An unpaid amount has not been funded and therefore creates no reimbursement claim yet. `B_m` allocates cumulative paid value across the stored expense allocation ratio. If one member pays 60 of a 100 equal expense, each member's paid burden is 30; the payer is creditor 30 and the other member debtor 30. The unpaid 40 remains a separate payment state.

Creating claims for the full expense before payment was rejected because it would recommend reimbursement for money nobody had advanced.

### Neutralize shared-account payments at expense level

For a shared-account payment, `S_m` is allocated using the same exact paid-burden distribution, so shared-funded value creates no expense-specific reimbursement claim by itself. Fairness of who supplied the shared account remains visible through contribution and distribution records.

Attributing a shared payment to the first holder or equal holders was rejected. Treating the household pool as a visible creditor on every expense was rejected because the household workflow wants member reimbursements and contribution balance, not a general-ledger pool account.

### Store claim inputs, derive claim outputs

Expense member positions and their deterministic non-overlapping pair claim lots are reproducible projections from immutable allocations, active payment applications, funding sources, and active settlement applications. They are not mutable balance rows. Settlement applications store exact matched lot portions and member roles, allowing the projection to be recalculated after reversals.

### Attach settlement semantics without duplicating transfer effects

A posted `unclassified` transfer may transition once to the sole economic classification `settlement` and receive one or more settlement applications. It MUST NOT also be pure, contribution, or distribution. Each application identifies one expense, debtor member, creditor member, and positive amount. Applications never create account effects. Their sum may be less than the transfer amount; unmatched value remains visibly unmatched settlement value and does not settle claims.

Settlement channels are personal-to-personal or shared-to-personal. For a personal source, the debtor on every application must be its owner. For a shared source, each debtor is explicit. The personal destination owner must be the creditor on every application. Personal-to-shared transfers remain pure or contribution, shared-to-personal transfers are either distribution or settlement, and shared-to-shared transfers remain pure. These mutually exclusive rules prevent double counting and silently assigning another member's personal cash.

### Support partial and many-to-many settlement

The following are valid:

- one transfer applied across several expense claims;
- several transfers partially resolving one claim;
- one shared-account reimbursement carrying debtor lines for several members;
- one transfer left partially unmatched until later classification.

Applications cannot exceed transfer unmatched value, debtor open amount, creditor open amount, or expense open settlement amount. Repeating an idempotency key returns the existing application.

### Protect applied settlements from later payment changes

Before adding or changing a payment application on an expense with active settlement applications, Midas recalculates the resulting initial positions and exact deterministic pair claim lots. For each existing application, the resulting lots for that same debtor-creditor pair must retain at least the cumulative applied capacity, and all applications are consumed against those exact lots in stable order. If pair capacity, member position, or total required settlement would be exceeded or contradicted, the payment mutation is rejected with an impact explanation. The user reverses or rematches the affected settlement first, then records the payment. This keeps every posted state internally valid without silently rewriting cash history.

Automatically moving earlier settlement applications to new claims was rejected because it would change user-confirmed attribution without consent.

### Derive settlement state independently

For each expense, required settlement is the sum of positive initial member claims. Active applied settlement is the sum of applications. State is:

```text
required = 0                         -> not_required
required > 0 and applied = 0         -> pending
0 < applied < required               -> partially_settled
applied = required                   -> settled
```

Payment status remains independent. A partially paid expense can already have a partial reimbursement claim and later create additional claims as more payments arrive.

### Recommend only representable claim flows

For a selected household scope, group open non-overlapping expense claim lots by their derived debtor-creditor pair and aggregate compatible lots across expenses. Recommendations process the largest representable pair totals first with stable member IDs and oldest claims for ties. A recommendation identifies member pair, amount, and exact lot composition and may suggest an eligible personal or shared source account separately.

Pairwise recommendation rows are projections, not persisted obligations. A different valid set of claim applications may be recorded. Transitive netting that would recommend a member pay someone with whom they share no expense claim was rejected because the resulting transfer could not be represented by expense-scoped applications. Global minimum-transfer optimization is therefore a non-goal.

### Keep household funding reporting separate

Expense claims determine what remains to be reimbursed. Monthly effective funding composes actual cash behavior: personal-account expense payments, contributions, distributions, and classified transfer receipts/outflows. A shared-account settlement receipt reduces the recipient's net funding; the shared source does not add member funding again because contributions supplied it. A direct member-to-member transfer increases payer funding and decreases recipient funding.

This separation avoids counting a member's contribution and the later shared-account reimbursement as two payments by that member.

### Reverse classifications with their dependencies

Reversing a settlement application reopens its claim without changing account effects. Reversing a transfer reverses active applications first, then the account transfer. Reversing an expense payment recalculates claims and requires incompatible settlement applications to be reversed in the same corrective operation. Every financial record retains an effective date for restated calculations and a distinct recorded timestamp for activity chronology. Multi-record operations use the replay-safe operation-root protocol.

## Worked Examples

### Direct payment and shared reimbursement

An actual expense of 10000 is allocated 5000/5000. Member A pays 10000 from a personal account:

```text
paid burden: A 5000, B 5000
funding:     A 10000, B 0
claims:      A +5000, B -5000
```

A transfer of 5000 from the shared account to A's account is applied with B as debtor and A as creditor. Both open claims become zero and the expense becomes settled. Whether B supplied enough shared-account value remains visible in contribution reporting.

### Shared account pays directly

The same expense is paid entirely from a shared account:

```text
paid burden:   A 5000, B 5000
shared funding:A 5000, B 5000
claims:        A 0, B 0
```

The expense requires no reimbursement. Contribution reporting still shows whether household funding is balanced.

### Three-member partial payment

An expense of 12000 allocated 2000/4000/6000 is partially paid 6000 by Member A. Paid burden resolves to 1000/2000/3000, so claims are A +5000, B -2000, C -3000. Any valid combination totaling those claims can settle the paid portion.

## Risks / Trade-offs

- **Expense settlement and monthly funding can appear different** -> Present both with plain explanations: claim status is reimbursement for paid expenses; funding position includes shared contributions and retained cash.
- **Unmatched transfers can be forgotten** -> Surface them prominently in `Saldos` and activity until classified or explicitly left as pure transfers.
- **Payment reversal may cascade** -> Preview affected claims/applications and perform linked reversals as one validated operation.
- **Representable recommendations may use more transfers than global netting** -> Prefer recordable provenance over an unexplainable minimum and group all compatible claims for one member pair.
- **Shared-account attribution can be abused** -> Require explicit debtor/creditor lines and preserve actor audit history.

## Migration Plan

1. Add settlement-application and idempotency relations linked to existing transfers, expenses, members, and activity.
2. Implement pure exact-arithmetic claim, status, validation, aggregation, and recommendation services with property-style tests.
3. Implement replay-safe application/reversal orchestration and incompatible-dependency correction under the household command gate.
4. Add direct, shared, partial, multi-member, multi-expense, unmatched, and reversed scenarios to preseed.
5. Build Spanish `Saldos`, pending-claim, transfer-matching, recommendation, and correction screens.
6. Verify household scope, no double account effects, no over-application, deterministic rounding/recommendations, and all quality gates.

Rollback after applications exist must first reverse or migrate them while preserving account transfers and activity history.

## Open Questions

None. Recommendation optimization preferences can be added later without changing canonical claim arithmetic.
