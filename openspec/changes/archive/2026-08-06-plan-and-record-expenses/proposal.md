## Why

Midas must represent expected and actual household costs independently from how and when they are paid. A durable expense model is needed for recurring planning, arbitrary member allocations, partial payments, account funding, irregular billing periods, and clear payment state.

## What Changes

- Define categories, accounting periods, expense records, service periods, due dates, estimated and actual amounts, stable human-readable references, and evidence references.
- Define equal, percentage, relative-weight, and fixed-amount allocations across any active subset of household members with deterministic minor-unit rounding.
- Define payments and payment applications separately from expenses, allowing unpaid, partially paid, fully paid, one-to-many, and many-to-one payment relationships.
- Define recurring templates that produce independently editable expected occurrences without changing historical occurrences.
- Support late, annual, advance, irregular, future, and one-off expenses through explicit accounting-period and service-period assignment.
- Preserve posted expenses and payments through reversal and replacement, and audit every material change.

## Capabilities

### New Capabilities

- `expense-management`: Categories, expenses, allocations, payments, payment applications, evidence references, status derivation, and correction behavior.
- `expense-planning`: Accounting periods, expected occurrences, recurring templates, estimates, due behavior, and expected-versus-actual transitions.

### Modified Capabilities

None.

## Impact

- Depends on household members, financial accounts, household funding, activity history, and the common application experience.
- Adds protected expense, category, planning, detail, creation, and edit/correction workflows plus D1 relations, repositories, domain services, preseed data, and tests.
- Uploaded binary files, merchant accounting, taxes, budgets unrelated to expected expenses, and cross-currency conversion are non-goals; evidence is initially stored as a safe external reference and description.
