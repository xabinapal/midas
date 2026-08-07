# 003 — Plan and Record Expenses (full change + adversarial review)

- **Date:** 2026-08-06
- **Model:** moonshotai/kimi-k3-fast (via OpenCode)
- **OpenSpec change:** `plan-and-record-expenses` — implemented end-to-end
  (22/22 tasks; strict validation passes). The UI was built by three parallel
  sub-sessions whose reports are merged below (per AGENTS.md, subagents do not
  own handoff files).
- **Consolidates:** former drafts `003-expense-detail-and-lifecycle-routes.md`
  and `004-expense-planning-ui-routes.md` (merged here; removed).

## Summary of work

Implemented the complete expense-management and expense-planning change
test-first: pure domain modules, D1 migration 0004, typed schema,
household-scoped repositories, three domain services, view projections,
preseed data, integration tests, Spanish UI routes, navigation/activity/
account-history integration, all quality gates, and an adversarial review
whose findings are tracked below.

### Domain (`src/lib/expenses/`)

- `allocation.ts` — pure exact allocation resolution: equal, default/custom
  weights, percentage (basis points summing 10000), fixed; integer largest
  remainder with stable member-ID tie-breaking (integer numerators, no floats).
- `model.ts` — orthogonal dimensions: lifecycle, value, derived payment
  status, derived due state (overdue only vs household-local date, never paid).
- `references.ts` — slugify + `category/period` references with deterministic
  `-N` collision suffixes.
- `evidence.ts` — HTTPS-only evidence URL validation (no userinfo, no
  credential-like query keys or fragments).
- `recurrence.ts` — pure monthly/yearly cadence arithmetic with day clamping,
  active-interval bounds, iteration cap, service-span derivation.
- `terms.ts` — approved Spanish vocabulary; `schemas.ts` — zod form schemas.

### Persistence

- `migrations/0004_expenses_and_planning.ts` — replay-safe reversible: 11
  tables (categories, periods, templates+params, expenses, allocations,
  params, payments, payment entries, applications, evidence). Unique household
  slugs; occurrence identity index; FKs throughout.
- `database/schema.ts` — 11 new typed tables.
- `src/lib/server/expenses/repository.ts` — 11 repository factories; all
  projection reads apply `visibleToProjection`.

### Services (`src/lib/server/expenses/`)

- `service.ts` — category lifecycle (never delete), expense posting with
  reference generation + replay, draft edit/delete, expected editing with
  version bumps, cancellation, actualization (freeze baseline, unpaid only),
  expected↔actual linkage, evidence, correction (validate-before-flip,
  chain-inheriting replacement keeps the reference).
- `payments.ts` — payment posting (one debit via `payment_account_entries`;
  funding derived server-side from account classification + sole holder),
  bounded many-to-many applications (validated before any write), idempotent
  reversal, correction mirroring the transfer chain protocol.
- `planning.ts` — standard/custom periods (Spanish labels via `formatPeriod`),
  template CRUD (fixed method rejected — cannot rebalance), bounded per-month
  materialization with per-template failure containment, canonical occurrence
  idempotency, prospective template edits.
- `views.ts` — `buildExpenseViews`, `sumPeriodTotals` read projections.
- `entries.ts` — combined entry reader folding payment debits into the
  estimated-balance projection (wired in `accounts/services.ts`).
- `services.ts` — `createExpenseServices(db)` wiring.

### UI routes (three parallel sub-sessions)

- `/gastos` — period list: custom-period support (`?periodo=`), resilient
  gated materialization with `occurrence_generated` activity, totals card
  (Previsto/Real/Pagado/Sin pagar), divided-list rows with `FinancialStatus`
  chips, custom-period links. Live allocation preview in `/gastos/nuevo` via
  `$derived` + `resolveAllocations`; `default_weight` selections carry current
  member weights (same as generation).
- `/gastos/[id]` — detail (chips, amounts, reparto, pagos, justificantes with
  `rel="noopener noreferrer external"`, vinculación, acciones, chain,
  historial) + `editar`, `confirmar`, `corregir` (mirrors
  `transferencias/[id]/corregir` UX), `pagar` (one-gate postPayment +
  applyPayment, funder attribution alert).
- `/pagos/[id]` — payment detail with unapplied value, per-row confirmed
  application reversal, candidate matching (303 self-redirect), correction
  section.
- `/gastos/categorias`, `/gastos/periodos/nueva`, `/gastos/plantillas`
  (+`nueva`, +`[id]/editar`) — category create/deactivate, custom period
  creation, template list (cadence labels, disable/enable) and forms
  (shared `template-allocation-fields.svelte` Reparto block; method select
  excludes `fixed`).
- Navigation: Gastos destination + Añadir action wired (`/gastos`,
  `/gastos/nuevo`); `/pagos/*` keeps Gastos active. Activity labels for all
  new event types + summary display keys. Payments appear in account history
  (`kind: "payment"`).

### Integration points touched

- `accounts/history.ts` + `cuentas/[id]` — payment history items.
- `accounts/services.ts` — combined entry reader for balances.
- `app-navigation.svelte`, `mas/actividad` EVENT_LABELS, `activity/display.ts`.
- `scripts/database/preseed.ts` — 6 categories (1 inactive), 3 periods (incl.
  custom), 2 templates (monthly/yearly), 11 expenses (occurrence, paid,
  unpaid, estimated, actualized, annual span, inactive-category history,
  correction chain, cancelled, custom-period), 5 payments (shared, personal,
  partial, multi-application with unapplied remainder, reversal chain),
  4 applications, 1 evidence link. Reversed-by back-patching for expenses and
  payments (forward-FK pattern, like transfers).
- `tests/integration/{accounts,database}.test.ts` — wipe lists extended;
  `vitest.integration.config.ts` — `$app/environment` stub alias.

## Conventions confirmed while implementing

- Two same-page superforms need no explicit ids (schema-hash ids differ).
- Array-level zod errors surface at `$errors.<arrayField>?._errors`;
  `setError(form, "memberIds._errors", …)` is the typed path.
- Form amount prefills use `(minor / factor).toString().replace(".", ",")` —
  `formatMinorUnits` output ("60,00 €") is rejected by the parser on submit.
- `[id]` route component tests must pass `params: { id: "exp-1" }`.
- This environment's Node ICU formats es-ES amounts without grouping
  ("1200,00 €"); component tests assert amounts < 1000.
- testing-library `getByText` only concatenates direct text nodes; keep
  amounts inline (`tabular-nums` on the paragraph).

## Verification (as implemented)

- `mise run format` / `lint` / `check` — clean. `mise run test` — 395 unit +
  76 component + 41 integration = 512 passing.
- `openspec validate plan-and-record-expenses --strict` — valid; opsx-verify
  passed (22/22 tasks) before the adversarial pass.

## Adversarial review (2026-08-06, seven isolated lenses + judge synthesis)

Verdict: **REVISE** — 7 high findings in spec-mandated workflows. Every HIGH
finding was re-verified against code in the defender pass. Systematic root
cause: four crash-resume paths adopt invisible rows from failed operations
without reattribution, permanently wedging corrections, reversals, and
occurrence generation.

## Fix pass (2026-08-06, same session — all findings addressed)

All HIGH, MEDIUM, and LOW findings were fixed; ask-human items were decided
by the user ("go with all your findings"). Test evidence: 433 unit + 82
component + 43 integration = 558 tests green; format/lint/check clean.
The most valuable catch of the fix pass: the F-017 visibility integration
test exposed that `applyPayment` read through the visibility filter, so the
paid-expense one-shot composition (postPayment + applyPayment in the same
operation) could never work end-to-end; fixed with operation-aware reads
(`requireOperationPayment`/`requireOperationExpense`).

### Implemented — HIGH

- **F-001** `insertOccurrence` now resolves default weights via
  `selectionFromParams`; real-port test added.
- **F-002** `correctPayment` mirrors transfers exactly: always fresh reversal
  rows under the current operation, unconditional re-flip; replacement
  funding pre-validated (no mid-operation `payment_funder_not_found`).
  Heal-on-retry test added.
- **F-003** Resume reattributes the invisible prior replacement into the
  retrying operation (`ExpenseRepository.reattributeOperation`); corregir
  route admits `reversed` rows so retries are reachable.
- **F-004** Materialization and `ensureStandardPeriod` adopt invisible
  occurrences/periods into the current operation
  (`findVisibleOccurrence`/`findVisibleBySlug` + reattribute); integration
  test proves a crashed generation heals on the next open.
- **F-005** Single `selectionFromParams` owner in `$lib/expenses/allocation`;
  edit/actualize resolve `default_weight` from current members and `fixed`
  from stored params. Per-method regression tests.
- **F-006** `applyPayment` rejects realized expenses
  (`expense_already_satisfied`); `canPay`, pagar load, and `/pagos/[id]`
  candidates exclude them.
- **F-007** `/gastos` renders materialization failures in a warning alert
  with Spanish reasons and a link to plantillas.

### Implemented — MEDIUM

- **F-008** Link targets must be separately entered actuals
  (`plannedAmountMinor === null`) in service and candidates.
- **F-009** `unlinkActualExpense` + UI; match scan ignores non-posted
  matchers; correction dissolves matches on either side.
- **F-010** Correction replacements inherit the frozen baseline
  (planned amount, version, verbatim planned lines).
- **F-011** Detail loads the linked actual explicitly and renders it with a
  "Ver gasto real" link; dead `realizedByReference` removed.
- **F-012** Editar exposes period (incl. custom), service span, account hint,
  and allocation with live preview; drafts keep full editing.
- **F-013** Reversal dialogs and corregir state the payment stays posted
  unapplied and the account is not refunded; detail lists reversed
  applications with payment links.
- **F-014** Confirmar shows the live recalculated allocation preview.
- **F-015** `reactivateCategory` + UI; recreating an inactive slug
  reactivates it; dialog explains reactivation.
- **F-016** `views.test.ts` (10 tests) covers totals semantics and the clamp.
- **F-017** Integration coverage for pending-operation invisibility and
  crashed-generation healing on real D1.
- **F-018** Route tests: paid one-shot composition asserts distinct linked
  records sharing one operation; `/gastos` load renders under a held gate.
- **F-019** All application reversals flow through
  `PaymentService.reverseApplicationsForExpense` (port injected into the
  expense service) — one seam for the settlement guard.

### Implemented — LOW

Schema `.max(64)` on member arrays; batched member validation; template
account-hint household validation; whitespace-description rejection;
payment correction exposes account + effective date; confirmation dialogs
format amounts with the household currency; plain unpaid expected excluded
from correction (cancel path); fixed splits scale proportionally with
preview; reversed-payment context copy + correction chain section; "Añadir
gasto" carries the browsed period (`?period=`/`?periodo=`); paid-estimate
explanatory note; no-accounts/no-categories guards; evidence links announce
new-tab navigation (sr-only + icon); `findByTemplates` batch; shared
`EVENT_LABELS` in `activity/display.ts`; `/pagos/[id]` candidates use
`buildExpenseViews`; `AccountEntryRecord.ownerKind` discriminates
transfer/payment entries; `listPostedByHousehold(limit)` bounds candidate
reads; rejection tests assert unchanged state; `sumPeriodTotals` excludes
drafts.

### Decided (formerly ask-human)

- "Sin pagar"/"Pagado" totals now exclude unrealized estimates entirely
  (spec: expected records excluded from actual paid totals until realized);
  expected totals keep their planned amounts.
- Draft lifecycle: domain support kept (spec MAY), drafts excluded from
  totals; no creation UI in this change.
- `renameCategory` wired into the categorias page (inline rename form).
- Expense detail history merges the expense's payment events
  (`subjectIds` filter); activity feed rows link to their detail screens
  (expense/payment/account/member/template).

## Adversarial re-review (2026-08-06, four lenses, re-review loop)

Re-verified every fix against code and hunted fix-introduced regressions.
Verdict: **REVISE** — the first pass closed its original scenarios but left
one new HIGH and nine MEDIUM residual issues, all fixed below in fix pass 2
(573 tests green: 444 unit + 86 component + 43 integration).

### Implemented — re-review HIGH

- **N-01** Reversal payment rows were applicable and correctable: reversing
  a reversal printed money into the balance projection, and applying one
  marked expenses paid with returned money. Now rejected
  (`payment_is_reversal`) in `requireCorrectablePayment` and `applyPayment`,
  hidden from `/pagos/[id]` apply/correct sections, with regression tests.

### Implemented — re-review MEDIUM

- **N-02** Resume adoption redesigned: adopt only the replacement the flip
  designated (`reversedById`), only when it matches the submitted input;
  otherwise insert fresh and re-point. Stale-orphan publishing eliminated.
- **N-03** `correctPayment` flips `markReversed` LAST (crash window
  narrowed); `/pagos/[id]` shows a resumable correction state and
  visibility-filters its correction chain.
- **N-04** `ApplicationReversalPort` is now required — no fallback
  implementation; tests inject a recording port; direct
  `reverseApplicationsForExpense` coverage added.
- **N-05** Expense chain scan uses `listByChainRoot` (all statuses);
  replacements link back to their reversed originals again.
- **N-06** Correction-driven match releases return `releasedExpectedIds`
  and emit `expense_unmatched` activity events from all three routes.
- **N-07** Fixed splits scale proportionally at actualization via the new
  pure `scaleFixedSelections` (old amounts as weights), refreshing method
  metadata; the fixed-actualization trap is gone.
- **N-08** Stored-but-inactive members render as removable "(inactivo)"
  rows in editar/confirmar/corregir; unchecking drops them so edits,
  actualizations, and corrections succeed.
- **N-09** F-007 failure pipeline tested: planning containment unit test
  (failing template + healthy sibling) and `/gastos` alert component test.
- **N-10** `planningService.listPeriods` uses a visibility-filtered read;
  raw reads remain only for slug uniqueness and the adoption protocol.

### Implemented — re-review LOW

`selectionFromFormValues` single form→domain mapping (nuevo/editar actions
and previews); fixed previews share `scaleFixedSelections`; dead repository
methods removed (`expenses.listByHousehold`, `categories.findBySlug`,
`expenses.markPosted`, `expenses.findReplacement`); `subjectLink` extended
to member/template; `expense_already_satisfied`/`payment_is_reversal`
mapped in apply routes; application reversal uses a visible read and skips
duplicate audit events; payment-replace info alert is mode-accurate;
test hardening (operation-root assertions in the route harness, per-member
weight/line assertions in the previously vacuous default-weight/fixed/F-010
tests, application-seeded replacement rejection, corregir admission route
test, confirmar typed-amount preview test, linked-actual and
reversed-applications component tests, F-019 port-spy test).

### Documented (product decisions pending)

- Corrected payment/expense dates keep the original ordering anchor (the
  transfer protocol); observations recompute theirs — the two protocols
  intentionally disagree pending a product decision on restated timelines.
- A pre-paid estimate's payment is invisible in period totals (spec) while
  its row shows partial payment; totals-card annotation deferred to the
  monthly-position change.

### Documented assumptions

- 60 s gate lease expiry permits a double-apply window (pre-existing
  protocol property; low probability).
- `operation_roots` grows one row per `/gastos` standard-period view.
- Migration 0004 `down` drops all expense relations; production rollback is
  forward-only (new migration), `down` exists for local `db-reset`.
- Occurrence/reference uniqueness enforced by service + household gate, not
  DB constraints (by design).
- accounts↔expenses adapter direction (expenses owns the combined
  `EntryReader` adapter; accounts composition wires it) is deliberate.

## Architecture notes worth preserving

- Expenses use status-flip reversal (allocations interpreted via expense
  status); payments use reversal-row chains (entries are additive facts).
  Application reversal is a visible-but-idempotent flip, matching the
  accepted funding correction semantics.
- Reference/occurrence uniqueness is enforced in services, serialized by the
  household gate — no DB unique constraint on `expenses.reference` (reversed
  originals share it with replacements) or on occurrence identity.
- `default_weight` resolves current member weights at posting/generation
  time; resolved lines are authoritative and never recalculated.
- The settlement change (`reconcile-transfers-and-settlements`) will extend
  payment-application limits — they live in `payments.ts#applyPayment` (see
  F-019 for the seam concern).
- Templates accept only proportional allocation methods (fixed rejected:
  `template_method_not_supported`) — documented design constraint.
- `/gastos` materializes occurrences in a gate on page open; gate conflicts
  degrade gracefully (page renders, next open retries).

## Known test debt / follow-ups

- `buildExpenseViews → sumPeriodTotals` is not exercised as one pipeline
  (each half is tested separately).
- `payment_account_entries` visibility across the completion boundary is
  not asserted in the pending-root integration test (the projection itself
  is protocol-covered elsewhere).
- The recording-D1 route harness ignores `.where` filters; it proves
  composition, not repository filter correctness (D1 integration covers
  those).
- Balance anchor semantics: same-effectiveAt movements order by id — a
  payment effective exactly at an observation's timestamp may sort before
  the anchor (pre-existing domain behavior, surfaced in integration tests).

## Commit history

- `9248964` docs: own session handoffs by the orchestrator and merge session 003
- `9bc23c6` feat: plan and record household expenses with payments and recurrence
- `441901b` feat: add spanish expense, payment, and planning workflows
- `a67a96a` docs: record commit history in session 003 handoff
- `e7257c9` fix: harden expense and payment protocols after adversarial re-review
- `fa0dc3e` fix: harden expense workflows in the spanish UI
- `2d7256e` docs(openspec): archive plan-and-record-expenses and sync capability specs

## Archive record

Archived 2026-08-06 to `openspec/changes/archive/2026-08-06-plan-and-record-expenses/`
after both adversarial review rounds and their fix passes (573 tests green:
444 unit + 86 component + 43 integration; format/lint/check clean). The two
capability specs were synced into `openspec/specs/expense-management/spec.md`
and `openspec/specs/expense-planning/spec.md`; strict validation passes on
all 13 canonical specs.

## Recommendations for the next session

1. Fix F-001…F-019 and the LOW triage batch (tracked above with status);
   re-run the adversarial review on the fixes, then `/opsx-archive`.
2. When implementing `reconcile-transfers-and-settlements`, funnel all
   application mutations through one seam first (F-019) and extend the
   transfer classification matrix only.
3. Decide the ask-human items (totals semantics, draft lifecycle, category
   rename, history subject model, activity links) before archive.
