# expense-planning Specification

## Purpose

Defines expense planning over flexible reporting periods: one standard calendar-month period per household/month plus optional custom periods, optional service spans without accrual, expected expense occurrences with versioned planned amounts, estimate actualization that freezes a realization baseline, prospective recurring templates, idempotent bounded occurrence materialization, occurrence lifecycle including skipping and cancellation, and expected-versus-actual linkage.

## Requirements

### Requirement: Flexible Reporting Period

A reporting period SHALL belong to one household and contain a stable identifier, household-unique slug, label, inclusive start date, and exclusive end date with start before end. Midas SHALL permit exactly one standard calendar-month period for each household/year/month and MAY permit explicitly labeled overlapping custom periods. Every expense SHALL reference exactly one reporting period, while payment date and service span remain independent.

#### Scenario: Late invoice belongs to an earlier period

- **WHEN** a user records an invoice received in August and assigns it to the July reporting period
- **THEN** July reporting SHALL include the expense while payment reporting retains its actual payment date

#### Scenario: Custom period is created

- **WHEN** valid non-calendar start and end dates are submitted
- **THEN** expenses MAY be assigned to that custom period without changing monthly period definitions

### Requirement: Optional Service Span

An expense MAY define an inclusive service start date and exclusive service end date, with start before end. The span MAY cross reporting periods and SHALL describe coverage only; Midas MUST NOT automatically split or accrue the expense across months.

#### Scenario: Annual insurance is recorded

- **WHEN** an annual expense is assigned to one reporting period with a twelve-month service span
- **THEN** the selected period SHALL contain the full expense and the detail SHALL preserve the annual coverage dates

### Requirement: Expected Expense Occurrence

Midas SHALL support expected expenses with versioned current planned positive amounts, future or current reporting periods, allocations, optional due dates, and no required payment. The current planned amount MAY be edited with activity history only before realization or payment. Actualization or explicit linkage to a separate actual expense SHALL freeze the then-current planned amount as the immutable realization baseline. An expected occurrence without a due date SHALL be included by its assigned reporting period. Expected records MUST remain excluded from actual paid totals until realized but SHALL contribute to expected totals.

#### Scenario: Future planned expense is created

- **WHEN** a user records an estimated one-off expense for a future period
- **THEN** it SHALL appear as expected for that period without changing actual spending or account balances

### Requirement: Estimate Actualization

An estimated expense SHALL be actualized at most once by freezing its current planned amount as the realization baseline and adding a positive actual amount and resolved actual allocations while preserving identity and reference. Actualization SHALL be allowed only while no payment is applied and SHALL append activity history. An actual expense MUST use correction rather than actualization to change its baseline or actual amount.

#### Scenario: Estimated utility receives actual invoice

- **WHEN** an unpaid estimated occurrence is confirmed with a different actual amount
- **THEN** Midas SHALL retain the original planned amount, store the actual amount, resolve exact actual allocations, preserve identity, and expose both values for variance reporting

#### Scenario: Paid estimate is actualized

- **WHEN** an estimated expense already has an active payment application
- **THEN** actualization SHALL be rejected until the incompatible application is corrected

### Requirement: Recurring Expense Template

A recurring template SHALL define household, category, description, estimated amount, active interval, monthly or yearly cadence with positive interval, due rule, optional service-span rule, account hint, and allocation method. Template changes SHALL affect only occurrences not yet generated.

#### Scenario: Monthly template generates an occurrence

- **WHEN** an active monthly template is due in a reporting period without an existing occurrence
- **THEN** Midas SHALL generate one independent expected expense using the template values

#### Scenario: Template amount changes

- **WHEN** an authorized user changes a template after earlier occurrences exist
- **THEN** earlier occurrences SHALL remain unchanged and later generation SHALL use the new amount

### Requirement: Idempotent Occurrence Generation

For each recurring template and scheduled due date/sequence, Midas SHALL create at most one canonical occurrence regardless of reporting-period overlap or later reassignment. Repeated page loads, retries, custom-period views, or concurrent generation attempts MUST return or retain the same occurrence rather than duplicate expected expenses.

#### Scenario: Generation is retried

- **WHEN** occurrence generation for the same template and scheduled due date runs through standard and overlapping custom-period views
- **THEN** exactly one expected expense SHALL exist for that canonical scheduled identity

### Requirement: Bounded On-Demand Occurrence Materialization

Opening or explicitly preparing a standard reporting period SHALL materialize active recurring occurrences whose scheduled identity belongs to that standard month. Opening an overlapping custom period MUST NOT generate a second occurrence; an existing occurrence MAY be explicitly reassigned to the custom period. Midas MUST NOT generate an unbounded future horizon. Materialization SHALL use the replay-safe operation protocol and scheduled-identity uniqueness rule.

#### Scenario: User opens a future month

- **WHEN** the user opens one future reporting period
- **THEN** Midas SHALL materialize due occurrences for that period without generating every later period

### Requirement: Expected Occurrence Editing

An unpaid, unrealized expected occurrence MAY be edited independently from its template, including current planned amount, due date, assigned reporting period, service span, account hint, and allocation method. The edit SHALL append activity history and MUST NOT change its template, canonical scheduled identity, or sibling occurrences. Actualization, explicit linkage to a separate actual expense, or payment SHALL freeze the planned baseline; later changes SHALL use financial correction rules.

#### Scenario: One generated estimate differs

- **WHEN** a user edits one unpaid expected occurrence
- **THEN** that occurrence SHALL retain the edited plan while its template and other occurrences remain unchanged

### Requirement: Recurrence and Occurrence Lifecycle

Disabling a recurring template SHALL prevent future generation but MUST NOT delete generated occurrences. An individual expected occurrence MAY be cancelled without disabling its template. Cancelling an actualized or paid occurrence MUST use financial correction rules.

#### Scenario: One month is skipped

- **WHEN** a user cancels one unpaid expected occurrence
- **THEN** that occurrence SHALL remain historically cancelled and the template SHALL remain active for later periods

### Requirement: Expected Versus Actual Linkage

An actualized expected occurrence SHALL remain the same expense identity. A separately entered actual expense MAY explicitly satisfy one expected occurrence, which SHALL freeze the expected occurrence's current planned amount as its realization baseline. Expected-versus-actual reporting SHALL match them once and MUST NOT count both as separate expected costs.

#### Scenario: Actual expense matches planned occurrence

- **WHEN** a user links a separately recorded actual invoice to one unsatisfied expected occurrence
- **THEN** reporting SHALL compare the two amounts and count one expected item and one actual realization
