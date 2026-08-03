## Context

Midas will hold several independent truths: planned expense amount, actual expense burden, payment progress, member expense claims, account movements, shared contributions, and corrections. Reporting must compose them without inventing a new ledger or hiding the cutoff and date basis.

The dashboard answers three different questions:

```text
What did we expect and spend?   -> reporting-period expenses
Where did cash move this month? -> transaction-date activity
Who is currently out of balance?-> cumulative positions through cutoff
```

Combining these into one percentage would be misleading, especially when shared funds are contributed before use or reimbursements happen in a later month.

## Goals / Non-Goals

**Goals:**

- Make the current period understandable at a glance without decorative analytics.
- Keep expected, actual, paid, and settled totals mathematically distinct.
- Show every member's funding and burden for arbitrary household sizes.
- Explain retained shared funds or unmatched value instead of forcing member positions to sum to zero.
- Provide linkable past/future period views and restated historical balances after corrections.
- Make every dashboard amount traceable to source records.

**Non-Goals:**

- Net worth, income, investments, tax reports, machine-learning forecasts, arbitrary budgets, report exports, or immutable accounting-period close.
- Treating eventual-consistency caches as authoritative for financial values.

## Decisions

### Keep three report bases explicit

1. **Expense-period basis** groups expenses by their assigned reporting period, regardless of payment date.
2. **Cash-date basis** groups payments, transfers, contributions, distributions, and balance observations by their event date.
3. **As-of position basis** includes all non-reversed events through a selected cutoff and carries unresolved positions forward.

Each projection includes two explicit dimensions: an economic scope (assigned expense period or effective-date range/cutoff) and an as-of recorded cutoff, defaulting to report generation time. Expense-period totals include only operations completed by the recorded cutoff, even when a payment or settlement effective date falls after the expense period. Cash-date reports group those known operations by effective-date range. Cumulative positions include known operations through the requested effective cutoff. Using payment month as expense month was rejected because it breaks late invoices and advance payments.

### Calculate period totals from authoritative records

For a selected reporting period:

```text
expected total = expected amounts from due planned occurrences
actual total = actual expense amounts assigned to the period
paid total = active payment applications to those actual expenses
unpaid total = actual total - paid total
pending settlement = required settlement - applied settlement
```

Cancelled and reversed records contribute zero. A matched expected occurrence is counted once in expected totals and its actual expense once in actual totals.

### Separate member cash funding from allocated burden

For member `m` over a cash-date range:

```text
cash funding = personal-account expense payments
             + shared-account contributions
             + direct member-to-member settlement outflows
             - shared-account distributions
             - settlement receipts
```

Shared-account payments do not add member funding again because contributions supplied shared cash. Pure account transfers add zero. The report displays direct payments, contributions, outgoing settlement, distributions, and receipts as components so users can understand the total.

Allocated burden for a reporting period is the member's stored actual expense allocation in that period. Expected burden is shown separately.

### Show cumulative relative balance without erasing shared reserve

Raw member position through a cutoff is cumulative cash funding minus cumulative actual allocated burden. The sum may be non-zero because money remains in the shared account, an opening reserve funded costs, or activity is unmatched.

For fairness comparison, sum only active-member raw positions to obtain the active residual, then distribute that residual across those active members using their effective household default weights at the cutoff, with largest-remainder rounding. Relative position is active raw position minus active residual target share. Positive means the member has funded above the household target; negative means below. The report shows total residual, active residual, and inactive positions separately and does not present retained value as member debt.

Inactive members retain their raw position and are excluded from active residual centering. If an inactive member has a non-zero position, the report flags it for explicit settlement.

This centered position supports `balanced` even when all members have proportionally prepaid a shared reserve. Comparing raw positions directly was rejected because equal prepaid reserves would look like money owed back.

### Keep expense claims as the source of reimbursement actions

Recommended reimbursement actions come from open settlement claims, not from the reporting residual calculation. Funding position explains overall effective share; settlement claims explain specific paid-expense reimbursement. Both link to source records.

### Use an action-first dashboard order

The current-period page renders:

1. period navigator and freshness/cutoff;
2. compact expected, actual paid, actual unpaid, and pending settlement totals;
3. one recommended settlement action, `no open reimbursement`, or funding-balanced state with distinct wording;
4. expense progress groups;
5. member funding and relative-position rows;
6. upcoming expected expenses;
7. shared-account estimated availability when observed;
8. recent activity.

Empty or zero-value sections collapse to a concise state. Charts are not required. All totals link to filtered detail.

### Restate historical reports after corrections

Historical report views calculate the current corrected interpretation by economic/event date and display that they are restated. The append-only activity view remains the source for understanding when later reversals or replacements occurred. Immutable period snapshots were rejected because the product does not define period close.

### Query bounded data server-side

Dashboard projections use focused aggregate queries and bounded lists. Expense and activity history use server-side filtering, pagination, sorting, and URL state. Financial correctness never depends on Workers KV. A short-lived cache may be added only for a safe projection whose delayed invalidation is explicitly acceptable; corrections must invalidate or bypass it.

## Risks / Trade-offs

- **Users may compare expense-period and cash-date numbers directly** -> Label each basis and provide component drill-down.
- **Relative-position centering is not obvious** -> Explain retained shared funds and show raw funding, burden, residual target, and resulting relative position.
- **Late corrections alter old dashboards** -> Mark views as restated and link to activity events.
- **Large histories can become slow** -> Use indexed aggregate queries and server-side pagination; do not load the full ledger into the browser.
- **Dashboard can become crowded** -> Keep the action-first order, omit empty sections, and use lists rather than charts/cards for every metric.

## Migration Plan

1. Implement pure reporting projections and query interfaces over the accepted domain capabilities.
2. Add indexes needed for household, reporting-period, event-date, member, status, and activity queries through replay-safe migrations.
3. Replace the skeleton dashboard with current-period aggregates and bounded source links.
4. Add period expense, member funding, account availability, settlement history, and activity pages with URL state.
5. Add fixtures covering future periods, late invoices, annual spans, shared reserve, inactive members, partial payment/settlement, and later correction.
6. Verify every total against source records, Spanish formatting, responsive/accessibility behavior, query bounds, and all quality gates.

Rollback removes the reporting projections and screens but leaves all authoritative financial and activity records unchanged.

## Open Questions

None. Immutable period close and data export are future product decisions.
