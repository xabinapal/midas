## ADDED Requirements

### Requirement: Explicit Reporting Bases and Cutoffs

Every financial report SHALL identify two dimensions: its economic scope and its as-of recorded cutoff. Economic scope SHALL be an assigned expense reporting period, a cash effective-date range, or a cumulative effective cutoff. The recorded cutoff SHALL default to report generation time and include only operations completed and known by that timestamp. Expense-period views SHALL use the expense's assigned reporting period even when later payments or settlements are known by the recorded cutoff; cash views SHALL group payment, transfer, contribution, distribution, or settlement by effective date; cumulative positions SHALL include known operations through the requested effective cutoff. The application MUST NOT silently substitute or conflate these dimensions.

#### Scenario: July expense is paid in August

- **WHEN** an expense assigned to July is paid in August
- **THEN** July actual-expense reporting SHALL contain the expense and August cash reporting SHALL contain the payment

### Requirement: Period Expense Totals

For a selected reporting period and as-of cutoff, expected total SHALL include active expected occurrences assigned to that period only; due-date and upcoming views SHALL remain separate. Estimated total SHALL include the current planned amounts of non-realized expected occurrences; actual total SHALL include active actual expenses assigned to it; paid total SHALL include active payment applications to those actual expenses; unpaid total SHALL equal actual minus paid; and pending settlement SHALL equal required minus applied settlement. Cancelled and reversed records SHALL contribute zero.

Payment-state counts SHALL count expenses. Payment-state amounts SHALL use remaining unpaid amount for `unpaid`, `partially_paid`, and `overdue`, and applied paid amount for `paid`. Settlement-state counts SHALL count expenses. Settlement-state amounts SHALL use remaining required settlement for `pending` and `partially_settled`, required settlement for `settled`, and no aggregate amount for `not_required`. Every amount SHALL reconcile to the same filtered source records.

#### Scenario: Period contains mixed states

- **WHEN** a period has expected, actual unpaid, partially paid, paid pending-settlement, and settled expenses
- **THEN** each total SHALL include only the amounts defined for its state dimension and SHALL link to the corresponding filtered records

### Requirement: Expected Versus Actual Comparison

For each expected occurrence, reporting SHALL use its preserved planned amount and show linked actual amount when realized and signed variance actual minus planned. An expected occurrence matched to an actual expense SHALL be counted once in expected totals and its actual expense once in actual totals. Unmatched expected and unplanned actual expenses SHALL remain visible.

#### Scenario: Actual utility exceeds estimate

- **WHEN** an expected 9000 expense is realized as an actual 10000 expense
- **THEN** reporting SHALL show expected 9000, actual 10000, and variance +1000 without double-counting either record

### Requirement: Member Cash Funding Components

For a selected cash-date range, member cash funding SHALL equal personal-account expense payments plus shared-account contributions plus direct member-to-member settlement outflows minus shared-account distributions and settlement receipts. Shared-account expense payments and pure account transfers MUST NOT add member funding again. The report SHALL expose each component and total in household minor units.

#### Scenario: Contribution funds a reimbursement

- **WHEN** a member contributes 5000 to a shared account and that account later reimburses another member 5000
- **THEN** the contributor SHALL have +5000 contribution funding, the recipient -5000 settlement receipt, and the shared transfer SHALL not create a second member funding credit

### Requirement: Member Allocated Burden

For a selected reporting period, each member's actual allocated burden SHALL equal active actual expense allocation amounts in that period. Expected burden SHALL be calculated separately from expected expenses. Inactive historical members SHALL retain their allocations and SHALL not be omitted from totals.

#### Scenario: Historical member has July allocation

- **WHEN** a member becomes inactive after an expense was allocated to them in July
- **THEN** July burden reporting SHALL continue to include that member and amount

### Requirement: Raw and Relative Household Position

For each member through an economic effective cutoff and as-of recorded cutoff, raw position SHALL equal cumulative known cash funding minus cumulative known actual allocated burden. Midas SHALL expose total residual equal to all raw member positions and active residual equal only to active-member raw positions at the effective cutoff. For active-member fairness comparison, the active residual SHALL be allocated by member active state and default weights effective at that cutoff with deterministic largest-remainder rounding, and relative position SHALL equal active raw position minus active residual target share. Inactive non-zero positions SHALL remain explicit and MUST NOT contribute to active residual targets.

#### Scenario: Members proportionally prepay shared reserve

- **WHEN** two equally weighted members have each contributed 10000 more than their allocated burden
- **THEN** the report SHALL show aggregate retained value 20000 and relative position zero for both members

#### Scenario: Only one equal member prepays reserve

- **WHEN** one of two equally weighted members has raw position +10000 and the other zero
- **THEN** residual targets SHALL be +5000 each and relative positions SHALL be +5000 and -5000

#### Scenario: Inactive member retains a position

- **WHEN** one inactive member has raw position +10000 and two equally weighted active members each have raw position zero
- **THEN** active residual and both active relative positions SHALL be zero while the inactive +10000 remains separately visible

### Requirement: Balanced Split Presentation

The household funding split SHALL be `balanced` only when every active member relative position is zero and every inactive member raw position is zero. Open-expense reimbursement SHALL use the distinct states `no open reimbursement` or `pending reimbursement` from settlement claims and MUST NOT be labeled by the funding-balanced calculation. Positive and negative values SHALL be presented with explanatory Spanish wording and source components, not unexplained signs or color alone.

#### Scenario: Household is unbalanced

- **WHEN** at least one member has a non-zero relative or inactive raw position
- **THEN** the dashboard SHALL identify who funded above or below target and the amount without reducing the household to a predefined pair

### Requirement: Current-Period Dashboard Priority

The default dashboard SHALL open the current standard monthly reporting period and prioritize period totals, pending reimbursement or no-open-reimbursement state, separate household funding balance, expense progress, member funding positions, upcoming expected expenses, available shared-account estimate when observed, and recent activity. A section with no useful content SHALL render a concise empty state or be omitted without changing other calculations.

#### Scenario: Current month has pending reimbursement

- **WHEN** the current period contains an open settlement claim
- **THEN** the dashboard SHALL present the pending amount and primary route to its recommended or matching workflow before recent activity

### Requirement: Past and Future Period Navigation

Users SHALL be able to navigate standard monthly periods in both directions and open custom periods. Future periods SHALL show expected occurrences and zero actual values where appropriate. Period selection, filters, sort, and pagination SHALL use URL state where applicable.

#### Scenario: Future month is opened

- **WHEN** a user navigates to a future month with recurring expected occurrences
- **THEN** the dashboard SHALL show expected values and SHALL not fabricate payments, settlements, or account balances

### Requirement: Traceable Summary Values

Every dashboard total, member amount, status count, and recommendation SHALL link or drill down to the bounded source records included in its calculation. The source projection SHALL use the same scope and cutoff as the summary.

#### Scenario: User opens unpaid total

- **WHEN** a user selects the period unpaid amount
- **THEN** the expense list SHALL open with the same period and payment-state filter and its records SHALL reconcile to the displayed total

### Requirement: Shared Account Availability

When a shared account has a balance observation, reporting SHALL show its estimated available balance and observation timestamp according to the financial-account calculation. When unavailable, reporting SHALL show `No registrado` or omit the amount and MUST NOT substitute zero.

#### Scenario: Shared balance is stale

- **WHEN** the latest observation predates later recorded movements
- **THEN** reporting SHALL include those movements in the estimate and continue to disclose the original observation timestamp

### Requirement: Restated Historical Reports

Historical balances and period reports SHALL reflect the current corrected interpretation of active, reversed, and replacement records by their economic or event dates. They SHALL disclose that values are restated and SHALL link to append-only activity history for the chronology of later corrections. Midas MUST NOT claim an immutable closed-period statement.

#### Scenario: August correction changes July expense

- **WHEN** a July expense is reversed and replaced in August
- **THEN** the July report SHALL show the corrected restated value and history SHALL show when and by whom the correction occurred

### Requirement: Bounded Server-Side History

Expense, transfer, settlement, account, member-position, and activity histories SHALL be household-scoped, deterministically ordered, server-filtered, and paginated for unbounded datasets. Query state SHALL be represented in the URL. Financial correctness MUST NOT depend on an eventually consistent cache.

#### Scenario: User opens a large activity history

- **WHEN** matching records exceed one page
- **THEN** the server SHALL return one deterministic page and URL state SHALL preserve filters, sort, and page selection
