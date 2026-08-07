## Context

An expense is recognition of household consumption; a payment is an account outflow; a payment application says which expense that outflow discharged; an allocation assigns the burden to members. These events can happen at different times and must remain independent.

```text
RecurringTemplate ---> Expected Expense ---> Actual Expense
                              |                    |
                              +--- Allocations ----+

Payment ---> PaymentApplication <--- Expense
   |
   +-- source Account
```

The model must support known unpaid invoices, already-paid expenses, partial payments, one payment covering several expenses, several payments covering one expense, custom member subsets, annual service spans, and estimates replaced by actual values.

## Goals / Non-Goals

**Goals:**

- Record expenses, allocations, and payments as distinct concepts.
- Resolve every allocation to exact minor-unit amounts for any number of members.
- Support expected, estimated, actual, unpaid, partial, paid, overdue, cancelled, and reversed state without one overloaded status field.
- Generate recurring expected occurrences without rewriting historical records.
- Support custom reporting and service periods while keeping monthly use simple.
- Make common paid-expense entry compact and advanced cases explicit.

**Non-Goals:**

- Settlement calculation, bank synchronization, merchant bookkeeping, tax accounting, budgets beyond expected expenses, foreign exchange, or binary file upload.
- Accrual calculations inferred from service spans; the user controls reporting assignment.

## Decisions

### Use orthogonal expense state dimensions

An expense has independent dimensions:

```text
lifecycle: draft -> posted -> reversed
                \-> cancelled (expected only)
value:     estimated -> actual
payment:   unpaid | partially_paid | paid      (derived)
due:       upcoming | due | overdue            (derived)
settlement:not_required | pending | partial | settled (later change)
```

The UI composes relevant Spanish labels rather than creating every state combination. One status enum was rejected because combinations such as `actual + paid + pending settlement + overdue correction` cannot be represented safely.

### Store allocations as resolved amounts plus their method

Supported methods are equal, household-default weights, custom relative weights, percentages in basis points, and fixed minor-unit amounts. Before posting, every method resolves to member amount lines that sum exactly to the expense amount. Percentage/weight remainders use largest remainder with stable member-ID tie-breaking.

```text
floor share_i = floor(total * weight_i / sum(weights))
remaining units -> highest fractional remainders, then stable member ID
```

Resolved amounts are authoritative. Method metadata supports explanation and editing before posting but never recalculates history when defaults change.

### Treat reporting period and service period separately

`ReportingPeriod` has a stable ID, label, start date, and exclusive end date. Standard calendar-month periods are available by default, but custom periods are valid. Every expense belongs to one reporting period. An optional service span records what dates the expense covers and may cross reporting periods. Due date and payment date remain separate.

The user can assign a late invoice to an earlier reporting period, record an annual service span in one month, or record an advance payment without changing its payment date. Automatic accrual was rejected.

### Generate stable human references in addition to opaque IDs

Every expense has an opaque canonical ID. On first posting, Midas generates a household-unique readable reference from category slug and reporting-period label, appending a deterministic ordinal on collision. The reference remains stable if description, amount, or category later changes through correction.

Using `category/YYYY-MM` as the primary key was rejected because multiple expenses, category renames, custom periods, and corrections create collisions.

### Model payments and applications many-to-many

A payment records one account outflow, payee/description, date, amount, source account, and funding source (`member` for a personal account, `shared` for a shared account). A payment application links a positive portion to an expense. Applications cannot exceed either the payment's unapplied amount or the expense's unpaid amount.

Payment and expense posting create account and burden effects once. Applications explain coverage and create no second account movement. Overpayments remain unapplied rather than forcing negative expense balances.

### Preserve planned and actual values separately

Expected occurrences and future one-off plans carry a versioned current planned amount that may be edited with activity history before realization. Actualization or explicit linkage to a separate actual expense freezes the then-current amount as the immutable realization baseline. Actualization adds an actual amount while retaining that baseline and identity for variance reporting. It resolves actual allocations again using the stored method and is allowed only while no payment is applied. Once realized or paid, planned-baseline or actual-amount correction uses explicit correction history rather than ordinary editing.

### Make recurring templates prospective

A template stores cadence, active interval, category, description, estimated amount, due rule, default account hint, service-span rule, and allocation method. Monthly and yearly cadences support positive intervals. Each scheduled occurrence has a canonical identity of template plus scheduled due date/sequence and is assigned by default to the one standard month containing that date. Opening a standard period materializes only identities assigned to it; custom periods never generate duplicate identities, though an existing occurrence may be explicitly reassigned. No unbounded future horizon is generated. Editing or disabling a template affects only ungenerated future occurrences; generated expected occurrences are independently editable and audited until realized or paid.

### Store evidence references, not uploaded blobs

An expense may hold multiple evidence records containing label, safe HTTPS URL, optional note, and timestamps. URL parsing rejects non-HTTPS schemes, user information, fragments containing credentials, and credential-like query keys; rendered links use safe external-navigation and referrer behavior. This satisfies invoice/receipt referencing without adding R2 or placing binary data in D1. Uploads require a future storage and security proposal.

### Preserve posted records

Drafts may be edited or deleted. Expected unpaid records may be edited with activity history or cancelled. Posted actual expenses and payments are corrected through exact reversal and optional replacement. Financial records distinguish effective date from recorded timestamp; reversals retain original effective dates for restated reports and new recorded timestamps for chronology. Reversal also reverses account effects and incompatible active applications while preserving history. Multi-record posting uses the activity-history operation-root protocol so partial writes remain invisible and retryable.

## Risks / Trade-offs

- **Users may confuse reporting and service periods** -> Default both from the selected month and reveal service span only when needed, with plain Spanish helper text.
- **Largest-remainder results can surprise at one cent** -> Show resolved amounts before submission and store an explanation of the method.
- **Many-to-many payment UI can become complex** -> Common entry creates one payment application automatically; advanced matching lives in payment detail.
- **Reference-only evidence may be less convenient** -> Clearly label it as a link/reference and defer uploads until an appropriate object-storage capability exists.
- **Estimate actualization changes member amounts** -> Permit it only before payment and show the recalculated allocation before confirmation.

## Migration Plan

1. Add category, reporting-period, expense, allocation, recurring-template, payment, payment-application, and evidence-reference relations.
2. Add pure domain services for allocation resolution, reference generation, status derivation, recurrence generation, actualization, applications, and reversal.
3. Integrate payment account entries with the account capability and activity events with the history capability.
4. Add representative categories, monthly/annual/one-off templates, estimated/actual expenses, member subsets, custom splits, partial payments, and reversals to preseed.
5. Build Spanish mobile expense, detail, category, planning, payment, evidence-reference, and correction workflows.
6. Verify arithmetic properties, recurrence idempotency, status combinations, account effects, household scoping, and all quality gates.

Rollback after posted expenses exist must preserve or migrate their allocations and payment links; dropping the relations is not acceptable.

## Open Questions

None. Binary evidence uploads and more complex recurrence rules are deferred capabilities.
