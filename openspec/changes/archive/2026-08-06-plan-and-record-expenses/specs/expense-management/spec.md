## ADDED Requirements

### Requirement: Expense Is Independent from Payment

An expense SHALL record household consumption independently from payment and settlement. It SHALL contain a stable identifier, household, description, category, positive planned or actual amount in household minor units as appropriate to value state, reporting period, accounting date, optional service span, optional due date, lifecycle, creation actor, effective date, and recorded timestamps. An actualized expense SHALL retain both its planned and actual amounts. Creating an expense MUST NOT imply that money moved.

#### Scenario: Known unpaid invoice is recorded

- **WHEN** a user posts an actual expense without a payment
- **THEN** the expense SHALL exist with its full allocation and an unpaid amount equal to the expense amount

#### Scenario: Paid expense is recorded

- **WHEN** a user posts an expense with valid payment details
- **THEN** Midas SHALL create the expense, payment, and payment application as distinct linked records

### Requirement: Category Lifecycle

Each expense SHALL reference a household category with a stable identifier, unique active display name, stable slug, ordering value, and active state. Inactive categories SHALL remain visible on historical expenses but MUST be excluded from ordinary new-expense defaults. A referenced category MUST NOT be deleted.

#### Scenario: Used category is removed

- **WHEN** an authorized user removes a category referenced by an expense
- **THEN** the category SHALL become inactive and historical expense display SHALL remain unchanged

### Requirement: Exact Multi-Member Allocation

Every posted expense SHALL have one or more member allocation lines with positive or zero integer minor-unit amounts summing exactly to the applicable planned or actual expense amount. Allocations MAY include any active subset of household members and SHALL support equal, household-default weight, custom relative weight, percentage, and fixed-amount methods. At least one member amount MUST be positive. Percentage basis points SHALL be non-negative and total exactly 10000 across selected members. Default or custom weights SHALL be non-negative and total greater than zero across the selected subset.

#### Scenario: Expense involves a subset

- **WHEN** a household has four active members and an expense is allocated equally to two selected members
- **THEN** only those two members SHALL receive resolved allocation lines summing to the expense amount

#### Scenario: Fixed allocation does not balance

- **WHEN** fixed member amounts do not sum exactly to the expense amount
- **THEN** posting SHALL be rejected

#### Scenario: Selected default weights total zero

- **WHEN** every selected member has zero default weight
- **THEN** default-weight allocation SHALL be rejected and the user SHALL choose equal or valid custom allocation

### Requirement: Deterministic Allocation Rounding

Percentage and weight allocations SHALL resolve to exact minor-unit amounts using largest-remainder distribution. Remaining minor units SHALL be assigned by descending fractional remainder and stable member-identifier order for ties. The resolved amounts SHALL be stored and MUST NOT change when household defaults or member names later change.

#### Scenario: Allocation leaves one cent

- **WHEN** equal allocation of 100 minor units among three members produces a remainder
- **THEN** the stored amounts SHALL be 34, 33, and 33 according to stable member-identifier order

### Requirement: Stable Human-Readable Expense Reference

Every posted expense SHALL have a household-unique human-readable reference in addition to its opaque identifier. The generated reference SHALL use stable category and reporting-period slugs and SHALL append a deterministic collision suffix when necessary. A posted reference MUST remain stable through later correction or category rename.

#### Scenario: Two electricity expenses share a period

- **WHEN** a second expense would generate the same category/period reference
- **THEN** Midas SHALL append a stable collision suffix rather than reject the expense or reuse the reference

### Requirement: Payment and Funding Source

A payment SHALL record one actual outflow with household, source account, positive amount, effective payment date, recorded timestamp, payee or description, lifecycle, and funding source. A personal account payment SHALL identify its sole member owner as funder. A shared account payment SHALL identify shared household funds and MUST NOT infer one member funder from account-holder order.

#### Scenario: Personal account pays an expense

- **WHEN** a payment is posted from a member's active personal account
- **THEN** the payment SHALL record that member as the direct funder and debit the account once

#### Scenario: Shared account pays an expense

- **WHEN** a payment is posted from an active shared account
- **THEN** the payment SHALL record shared funding and debit the account once

### Requirement: Many-to-Many Payment Applications

A payment application SHALL link a positive minor-unit portion of one posted payment to one posted expense in the same household and currency. One payment MAY apply to multiple expenses and one expense MAY receive multiple payments. Active applications MUST NOT exceed the payment's unapplied amount or the expense's unpaid amount and MUST NOT create another account entry.

#### Scenario: One payment covers two expenses

- **WHEN** a payment has sufficient unapplied value and valid portions are applied to two expenses
- **THEN** both expenses' unpaid amounts SHALL decrease by their portions and the payment account effect SHALL remain singular

#### Scenario: Application overpays an expense

- **WHEN** an application amount exceeds the expense's unpaid amount
- **THEN** the application SHALL be rejected and balances SHALL remain unchanged

### Requirement: Derived Payment Status

Expense paid amount SHALL equal active non-reversed payment applications. Payment status SHALL be `unpaid` when paid amount is zero, `partially_paid` when greater than zero and less than expense amount, and `paid` when equal. Over-application MUST be rejected. Reversing an application or payment SHALL recalculate the status.

#### Scenario: Expense receives a partial payment

- **WHEN** 6000 minor units are actively applied to a 10000-minor-unit expense
- **THEN** the expense SHALL report paid 6000, unpaid 4000, and `partially_paid`

### Requirement: Due and Value State

An expense SHALL retain `estimated` or `actual` value state independently from payment status. An unpaid or partially paid expense SHALL be overdue only when it has an actual due date earlier than the household-local current date. A future or absent due date MUST NOT be presented as overdue.

#### Scenario: Actual unpaid expense passes due date

- **WHEN** an actual expense retains an unpaid amount after its due date
- **THEN** it SHALL report both its payment status and overdue state

### Requirement: Evidence References

An expense MAY contain safe evidence references with label, HTTPS URL, optional note, creator, and timestamps. Parsed URLs MUST reject user information, non-HTTPS schemes, and credential-like query parameters; rendered external links SHALL prevent opener access and avoid sending an application referrer. Midas MUST NOT fetch, proxy, or store the referenced binary as part of this capability. Removing a reference from an actual posted expense SHALL append history rather than erase evidence of the change.

#### Scenario: Invoice URL is attached

- **WHEN** a valid HTTPS invoice reference is added to an expense
- **THEN** the expense detail SHALL expose the safe link and attribution without embedding credentials from the URL

### Requirement: Expense and Payment Correction

Draft expenses and payments MAY be edited or deleted. Expected unpaid expenses MAY be cancelled. Posted actual expenses and posted payments MUST NOT be silently edited or deleted; correction SHALL use linked exact reversal and optional replacement. Reversal SHALL negate allocation, account, and active application effects and append activity events.

#### Scenario: Paid expense amount is wrong

- **WHEN** a user corrects an actual expense with an applied payment
- **THEN** Midas SHALL preserve and reverse the original linked effects before posting a valid replacement
