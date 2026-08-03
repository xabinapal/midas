## Context

Midas records selected household activity manually; it does not mirror every transaction in a personal bank account. Accounts therefore identify payment and transfer channels, while household funding records explain which members supplied shared money. An account's displayed available balance is useful only when anchored to an explicit manual observation.

```text
Account
  +-- holders (member references)
  +-- balance observations
  +-- posted account movements

AccountTransfer
  +-- source and destination account projections
  +-- one economic classification
  +-- optional Contribution or Distribution
```

## Goals / Non-Goals

**Goals:**

- Represent personal and shared accounts for any household size.
- Record manual account transfers without treating them as expenses.
- Attribute member contributions and distributions without inferring ownership from account names.
- Show an optional, honest estimated balance derived from a dated manual observation.
- Preserve closed accounts and reverse incorrect posted funding events.

**Non-Goals:**

- Bank synchronization, statements, personal spending, full double-entry accounting, credit products, foreign exchange, or reconciliation against imported transactions.
- Treating a shared account's legal holders as proof of who funded its current balance.
- Defining expense reimbursement; the settlement change links settlement semantics to account transfers later.

## Decisions

### Model account classification explicitly

A `personal` account has exactly one member owner. A `shared` account has at least two household-member holders and represents a household-accessible payment channel. Holders are historical links with effective active intervals. Account type and holders are never inferred from the display name. Deactivating a member does not silently close an account; an authorized user must explicitly close it or confirm its remaining active holders.

An unconstrained account type was rejected because defaults and UI language would become ambiguous. Modeling every beneficial-ownership claim was rejected as excessive for a manually managed household planner.

### Store all money in household minor units

Account movements, observations, contributions, and distributions use signed integer minor units in the household currency. Cross-currency accounts are rejected. This avoids floating-point drift and keeps settlement calculations composable.

### Introduce the account transfer before settlement semantics

This change owns the basic posted movement between two distinct accounts: one amount, source, destination, effective date, recorded timestamp, description, and lifecycle. Debit and credit are derived from that single authoritative row, avoiding partial paired-entry writes. A transfer has one economic classification: `unclassified`, `pure`, `contribution`, or `distribution`; the settlement change later adds `settlement`. An unclassified transfer affects account estimates but no member funding and stays visibly unresolved. Classification may move once from unclassified to one terminal meaning and cannot overlap.

The later settlement change links one transfer to settlement applications. Reusing the posted transfer avoids creating a second account effect.

### Make contribution attribution explicit

A contribution is a personal-to-shared transfer attributed in full to the personal source owner. A distribution is a shared-to-personal transfer attributed in full to the personal destination owner. Contributions from multiple members and distributions to multiple members use multiple transfers. The user confirms the inferred member before posting.

Allowing arbitrary member attribution from another member's personal account was rejected because it invents beneficial ownership. Treating every deposit as a contribution was rejected because pure internal transfers must remain possible. Multi-member attribution in one transfer is deferred until Midas has an account type that can represent that source ownership safely.

### Use dated balance observations as anchors

A balance observation records the amount seen at an account, an effective timestamp, a stable effective ordering key, and a recorded timestamp. The displayed estimated available balance is the latest valid observation plus posted Midas account movements whose effective ordering is after it. Correction chains inherit the original movement's effective ordering key and are folded to their net restated effect before comparison with an observation, so a later-recorded reversal cannot cross a same-time observation anchor. If no observation exists, the balance is `No registrado`; the system never invents zero.

```text
estimated balance(t) = latest observed balance
                     + sum(posted account entries after observation through t)
```

The projection includes a `last observed` timestamp and is not described as a bank-confirmed balance. Updating an observation appends a new observation rather than rewriting history.

### Keep posted movement immutable

Draft transfers may be edited or deleted. Posted transfers, contributions, and distributions are corrected by linked reversal and optional replacement. Reversals and replacements inherit the original effective ordering key for restated projections and receive new recorded timestamps for activity chronology. A mistaken observation is invalidated and optionally replaced; it is never negated with an artificial opposite balance.

### Close rather than delete referenced accounts

Accounts move from `draft` to `active` and may later become `closed`. Closed accounts reject new ordinary payments and transfers but remain visible in history and available to correction/reversal workflows. Unreferenced draft accounts may be deleted. Reopening is an audited action.

### Use replay-safe operation roots

Transfer classification, funding records, and activity events use the operation-root protocol defined by activity history. Only completed operations enter account and funding projections. This avoids assuming unavailable Kysely transactions while keeping retries idempotent and partial writes invisible.

## Risks / Trade-offs

- **Estimated balance diverges from the bank** -> Label its observation date and provide a new balance-observation action; never imply synchronization.
- **Contribution attribution may feel like an extra step** -> Pre-fill from personal ownership or household defaults but require visible confirmation.
- **Later settlement links add another semantic layer to transfers** -> Keep account posting immutable and attach settlement applications without adding account entries.
- **Shared-account holders change over time** -> Store holder intervals and preserve the holder set relevant to historical display.

## Migration Plan

1. Add account, account-holder, balance-observation, transfer, transfer-entry, contribution, contribution-allocation, distribution, and distribution-allocation relations.
2. Add typed repositories and pure services for lifecycle, posting, exact-sum validation, balance projection, reversal, and replacement.
3. Add representative personal/shared/closed accounts, observations, pure transfers, and contributions/distributions from multiple members through separate single-member transfers to local preseed.
4. Add Spanish mobile account lists, detail, transfer, contribution, distribution, observation, and correction forms.
5. Verify minor-unit arithmetic, household scoping, exact paired entries, no double-counting, historical closure, activity events, and quality gates.

Rollback is safe only before later financial records reference the account relations. After use, preserve data and migrate forward rather than dropping history.

## Open Questions

None. Liability accounts and multiple currencies require separate future proposals.
