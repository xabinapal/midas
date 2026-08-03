## ADDED Requirements

### Requirement: Paid Burden Is Proportional to Expense Allocation

For each expense, Midas SHALL distribute its cumulative paid amount across member allocations in proportion to the stored expense allocation amounts, using the same largest-remainder and stable tie-break rules as expense allocation. Only the paid portion SHALL create settlement claims; the unpaid portion MUST NOT create a reimbursement obligation.

#### Scenario: Equal expense is partially paid

- **WHEN** 6000 minor units are paid on a 10000 expense allocated equally to two members
- **THEN** each member's paid burden SHALL be 3000 and the remaining 4000 SHALL create no settlement claim

### Requirement: Expense Member Claim Calculation

For each member on an expense, initial claim SHALL equal direct member-funded applied payments plus the member's attributed share of shared-account applied payments minus the member's paid burden. Shared-account payment value SHALL be attributed using the expense allocation proportions. Positive claim means creditor, negative means debtor, and all member claims for one expense SHALL sum to zero.

#### Scenario: One member pays an equal expense

- **WHEN** one member directly funds a fully paid 10000 expense allocated 5000 to each of two members
- **THEN** the payer SHALL have a +5000 claim and the other member a -5000 claim

#### Scenario: Shared account pays an equal expense

- **WHEN** a shared account fully pays the same expense
- **THEN** shared funding SHALL attribute 5000 to each member and neither SHALL have an expense-specific claim

#### Scenario: Three members share a partial payment

- **WHEN** one member pays 6000 of a 12000 expense allocated 2000, 4000, and 6000
- **THEN** paid burdens SHALL be 1000, 2000, and 3000 and claims SHALL be +5000, -2000, and -3000

### Requirement: Settlement Application Is Separate from Transfer

A settlement application SHALL classify part of one posted transfer whose sole economic classification is `settlement` against one expense's open member claims. It SHALL contain transfer, expense, debtor member, creditor member, positive amount, actor, lifecycle, effective date, and recorded timestamps. The transfer MUST NOT also be pure, contribution, or distribution. An application MUST NOT create or alter account effects and MUST NOT be treated as an expense or payment.

#### Scenario: Transfer is matched to a claim

- **WHEN** a valid 5000 portion of a posted transfer is applied from an expense debtor to creditor
- **THEN** both open claims SHALL decrease by 5000 and account balances SHALL not move again

### Requirement: Deterministic Non-Overlapping Claim Pairs

For each expense, Midas SHALL transform initial member positions into disjoint debtor-creditor claim lots before settlement application. It SHALL order creditors and debtors by descending absolute open amount and stable member identifier, repeatedly create a lot for the lesser remaining side, and decrement both sides until exhausted. The lot amounts SHALL sum exactly to required settlement, and no member position portion MAY appear in more than one open lot.

#### Scenario: Expense has two creditors and two debtors

- **WHEN** creditor positions total 10000 and debtor positions total -10000 across four members
- **THEN** the derived disjoint lot amounts SHALL total 10000 rather than every possible pair combination

#### Scenario: Pair derivation is repeated

- **WHEN** unchanged expense positions and applications are derived again
- **THEN** Midas SHALL return the same pair lots and remaining amounts

### Requirement: Partial and Many-to-Many Settlement

One transfer MAY apply to multiple expense claims, one expense claim MAY receive multiple transfer applications, and one transfer MAY remain partially unmatched. Active applications SHALL not exceed the transfer's unmatched amount, the expense's open required settlement, the debtor's open amount, or the creditor's open amount.

#### Scenario: One transfer settles three expenses

- **WHEN** valid application lines allocate one transfer across three open claims within every limit
- **THEN** all three expense claims SHALL decrease by their applied amounts and the transfer SHALL retain one account effect

#### Scenario: Application exceeds debtor claim

- **WHEN** an application amount is greater than the debtor's open amount for the expense
- **THEN** the application SHALL be rejected without changing any claim or transfer

### Requirement: Duplicate Settlement Prevention

Settlement application posting SHALL accept an idempotency key unique within the household operation scope. Repeating the same key SHALL return the existing result and MUST NOT add another application. Independent applications SHALL still be validated against current unmatched and open amounts.

#### Scenario: Application request is retried

- **WHEN** the same valid settlement-application command is submitted twice with one idempotency key
- **THEN** exactly one active application SHALL exist

### Requirement: Derived Expense Settlement Status

Required settlement for an expense SHALL equal the sum of its positive initial claims. Applied settlement SHALL equal active application amounts. Status SHALL be `not_required` when required is zero, `pending` when required is positive and applied is zero, `partially_settled` when applied is between zero and required, and `settled` when applied equals required. Payment status SHALL remain independent.

#### Scenario: Paid expense awaits settlement

- **WHEN** a fully paid expense has required settlement greater than zero and no application
- **THEN** it SHALL report `paid` and `pending` as separate states

#### Scenario: Shared-paid expense has no claim

- **WHEN** a paid expense has zero required settlement
- **THEN** it SHALL report `not_required` without requiring a synthetic transfer

### Requirement: Pending Settlement View

Active household users SHALL be able to view open expense claims grouped by creditor, debtor, expense, and reporting period. The view SHALL expose paid amount, required settlement, applied amount, remaining amount, and relevant account choices and MUST NOT collapse multiple members into a predefined pair.

#### Scenario: Household has four open participants

- **WHEN** pending claims involve four members
- **THEN** the view SHALL present every open position and its source expenses without assuming only two members

### Requirement: Deterministic Settlement Recommendations

For a selected household scope and currency, Midas SHALL group active open non-overlapping claim lots by their derived debtor-creditor pair and produce deterministic recommendations that can be recorded as expense-scoped applications. It SHALL process largest compatible pair totals first, then stable member identifiers and oldest claims for ties. Recommendations SHALL identify scope, cutoff, and exact underlying lots, MUST NOT use transitive netting across unrelated pairs, MUST NOT be persisted as authoritative obligations, and MAY identify eligible personal or shared source accounts separately.

#### Scenario: Recommendation is regenerated

- **WHEN** unchanged claim data is evaluated repeatedly for the same scope
- **THEN** Midas SHALL return the same recommended member flows

#### Scenario: User records another valid plan

- **WHEN** a user records valid settlements that differ from the recommendation
- **THEN** the application SHALL accept them and recalculate open positions

### Requirement: Settlement and Transfer Correction

A settlement application MAY be reversed without moving account money again. Reversing a transfer SHALL first reverse its active settlement applications and then reverse the transfer account effect. Reversing a payment or expense SHALL also reverse any settlement applications that would exceed recalculated claims. Every reversal SHALL preserve effective dates for restated calculations, use a new recorded timestamp, preserve links, and append activity events through the replay-safe operation protocol.

#### Scenario: Settled payment is reversed

- **WHEN** correction reverses a payment that generated already-settled claims
- **THEN** Midas SHALL reverse incompatible settlement applications, reverse the payment effects, recalculate states, and preserve the complete history
