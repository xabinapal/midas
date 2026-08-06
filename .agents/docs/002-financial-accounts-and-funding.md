# 002 — Financial Accounts and Household Funding

- **Date:** 2026-08-06
- **Model:** moonshotai/kimi-k3-fast (via OpenCode)
- **OpenSpec change:** `manage-financial-accounts-and-funding` — 20/20 tasks, strict validation passing, verified with opsx-verify. Ready for `/opsx-archive`.

## Summary of work

Implemented the full `financial-accounts` and `household-funding` capabilities
end to end: domain model, migration 0003, typed repositories, pure services,
preseed data, integration tests, Spanish UI workflows, and component tests.

### Domain (framework-neutral)

- `src/lib/accounts/model.ts` — moved here from `$lib/server/accounts/` during
  implementation because the transfer-classification matrix is needed on the
  client. Account/transfer classification vocabulary, the source→destination
  classification matrix (`personal→shared`: unclassified/pure/contribution;
  `shared→personal`: unclassified/distribution; otherwise unclassified/pure),
  and the stable effective ordering key scheme (`${effectiveAt}#${id}` with a
  `z`-sentinel cutoff key). The settlement change extends this one matrix.
- `src/lib/accounts/money.ts` — minor-unit formatting (es-ES) and a tolerant
  amount parser (decimal comma/point, es-ES thousands dots, negatives).
- `src/lib/accounts/projection.ts` — shared `BalanceProjection` types so client
  components never import `$lib/server`.
- `src/lib/accounts/schemas.ts` — zod form schemas + `effectiveAtFromDateInput`.
- `src/lib/accounts/terms.ts` — approved Spanish labels.

### Server

- `src/lib/server/accounts/` — `service.ts` (lifecycle/holders/safe views),
  `transfers.ts` (`postClassifiedTransfer` shared helper, idempotent replay by
  `operationId`, reversal/replacement with chain inheritance),
  `balance.ts` (observation service + `projectEstimatedBalance` with
  correction-chain folding), `history.ts` (deterministic account history),
  `repository.ts` (Kysely factories), `services.ts` (route wiring factory).
- `src/lib/server/funding/` — contribution/distribution repositories and
  service (attribution validation, classification of unclassified transfers,
  dependency-aware correction, `sumNetFunding` per-member totals with range).
- Migration `0003_financial_accounts_and_funding` — 9 tables + 18 indexes,
  replay-safe and reversible (verified by db-reset and integration tests).
- Preseed: 5 accounts (personal×2, shared, closed, unobserved), 4 observations
  (incl. invalidated+replacement), 8 transfers (2 contributions, 1 distribution,
  pure, unclassified, and a full correction chain), funding allocations.

### Key invariants worth remembering

- **Completed-operation visibility:** every projection query (entries,
  transfers, observations, funding allocations) filters
  `operation_id IS NULL OR operation_roots.status = 'complete'`. Do not add a
  read path without this filter — partial writes must stay invisible.
- **Correction chains:** reversal/replacement inherit the original
  `chain_root_id` and `ordering_key`; projections fold entries per chain before
  comparing against the observation anchor. Never give a reversal its own key.
- **Funding = exactly one classification per transfer**, enforced by unique
  indexes on `contributions.transfer_id` / `distributions.transfer_id` plus the
  service matrix. Funded transfers are corrected only through
  `fundingService.correctFundingTransfer` (reverses funding + transfer together).
- **Balances never invent zero:** unavailable → "No registrado".
- D1 binds ~100 SQL variables per statement — chunk or loop seed inserts.

### UI

- `/cuentas` (wired to the "Saldos" nav destination), `/cuentas/crear`,
  `/cuentas/[id]` (lifecycle + history + observation invalidation),
  `/cuentas/[id]/editar`, `/cuentas/[id]/observar`,
  `/transferencias/nueva`, `/transferencias/[id]/clasificar`,
  `/transferencias/[id]/corregir`. "Más" hub gained a Cuentas card.
- New activity event types + Spanish labels (`account_*`, `transfer_*`,
  `contribution_*`, `distribution_*`, `balance_observation_*`) and summary
  labels (Cuenta, Cuenta origen/destino, Importe, Clasificación, …).
- Forms use `superForm(untrack(() => data.form))` (first superForm usage in
  routes; existing pages still use raw `$app/forms` enhance — pre-existing
  deviation, not touched).

### Verification

- Gates: format/lint/check/test all green (203 unit, 28 component, 25
  integration). Production build green. Runtime smoke: login → list → detail →
  POST transfer → history + activity verified; dev DB re-preseeded afterwards.
- Route component tests live beside pages as `page.component.test.ts`
  (NOT `+page.component.test.ts` — the `+` prefix is reserved by SvelteKit).
- `vitest.integration.config.ts` gained a `$lib` resolve alias.

### Notes for the next session

- `plan-and-record-expenses` consumes accounts as payment sources; its
  personal/shared funder semantics are already in `AccountView.holders`.
- `reconcile-transfers-and-settlements` adds `settlement` to the matrix in
  `src/lib/accounts/model.ts` (shared→personal) and links transfers to
  settlement applications without new account entries.
- `report-monthly-household-position` reads `projectEstimatedBalance` and
  `sumNetFunding` — both are pure and cutoff-aware.
- Transfer `draft` status exists in schema/types but no workflow creates draft
  transfers (spec MAY). Holder changes on active accounts exist in the
  repository (`replaceHolders`) but are not exposed in UI (YAGNI).
- Test debt: no route-action integration coverage (loads/actions are exercised
  by services + component tests only); jsdom needs the `showModal` polyfill for
  dialog tests (see detail page component test).

## Adversarial review 2026-08-06 (7 lenses, review-only) — VERDICT: REVISE → fix-and-review COMPLETE

All 32 findings were addressed in batches (protocol integrity → spec
violations → test integrity → UX → architecture/currency). A focused
adversarial re-review closed F-001…F-019, found 5 new smaller issues
(R-001…R-006 below) — all fixed and covered by new unit + integration tests.
Final state: format/lint/check/build green; 249 unit, 39 component, 32
integration tests; strict OpenSpec validation passing. Runtime smoke:
contribution posted → corrected with re-attribution to another member →
funding totals and activity verified end to end.

Key implementation outcomes:

- **Resume semantics everywhere:** invisible inserts first, visible flips
  last; retries adopt or replace invisible rows (never unique-index wedges,
  never terminal half-states). `requireCorrectableTransfer` +
  `isEffectivelyReversed` define "genuinely done" via reversal visibility.
- **`operations/visibility.ts`** is the single completed-operation predicate;
  applied to entries, transfers, observations, funding allocations, and the
  activity feed (repo + actividad page).
- **Re-attribution** is reachable: correction replacements may pick a
  different personal account; the member is always derived server-side from
  its sole owner.
- **Anchor determinism:** observation anchor = max(effectiveAt, recordedAt,
  id); chains follow via strict ordering-key comparison; balance projection
  pushes the anchor filter down to SQL (`findLatestValid` +
  `findByAccountAfter`).
- **Money:** exponent derives from the currency's ISO fraction digits;
  amounts above `Number.MAX_SAFE_INTEGER` minor units are rejected.

### Status

- **F-001** Visible status flips bypass protocol — **implemented** (ordering
  - resume/adopt + crash-injection tests at unit and D1 integration level;
    re-review verified, including the classify mirror window).
- **F-002** Invalidate-before-validate — **implemented**.
- **F-003** Inactive-member corrections rejected — **implemented**
  (membership-only validation in correction/classify paths + route mapping).
- **F-004** No actor projection — **implemented** (join via operation_roots ⋈
  users, rendered incl. inactive marker, history.test.ts).
- **F-005** Phantom activity events — **implemented** (predicate on both read
  paths + integration test).
- **F-006** Test-integrity cluster — **implemented** (real collision tests,
  defaults-mutation test, end-to-end neutrality, pending-op funding
  integration test, route tests: error mapping / 409 / cross-account
  invalidate).
- **F-007** UUID-random anchor — **implemented** (deterministic tiebreak +
  design.md rule + both-direction tests).
- **F-008** Replace-mode confirmation — **implemented** (mode-aware text +
  corrected values in the named record).
- **F-009** 320px overflow — **implemented**.
- **F-010** Currency exponent — **implemented** (Intl-derived; JPY/KWD tests).
- **F-011** Unfiltered guard reads — **implemented** (`findVisibleById`).
- **F-012** Unbounded reads — **implemented** (anchor pushdown; history
  pagination deferred to the reporting change).
- **F-013** No pending-classification signal — **implemented** (count +
  Clasificar links on /cuentas).
- **F-014** Missing `<legend>` — **implemented**.
- **F-015** Invalidation names account — **implemented** (names amount+date).
- **F-016** Member re-attribution unreachable — **implemented** (account
  select + server-side derivation + tests).
- **F-017** Closed-account observation inconsistency — **implemented**
  (allowed as corrective workflow; banner copy aligned).
- **F-018** Unbounded amount — **implemented** (safe-integer cap).
- **F-019** Cross-account invalidation — **implemented** (guard + route test).
- **F-020** Reversal classification matrix — **assumed** (display semantics;
  matrix is a posting-time rule).
- **F-021** editar rename-before-validate — **implemented** (atomic
  `updateDraftAccount`).
- **F-022** UTC-today default — **implemented** (household timezone).
- **F-023** Always-red confirm — **implemented** (`tone` prop).
- **F-024** Nav exact-match — **implemented** (prefix + /transferencias →
  Saldos).
- **F-025** Draft balance affordance — **implemented** (draft badge).
- **F-026** JS-only destructive submissions — **assumed** (shared dialog
  component requires JS).
- **F-027** Duplicate Más card — **implemented** (removed).
- **F-028** Unreachable replay guard — **assumed** (spec defers idempotent
  retry; design.md wording corrected).
- **F-029** effectiveAtFromDateInput — **implemented** (pinned).
- **F-030** Consolidation debt — **implemented** (`classifyTerminal`, shared
  predicate, deliberate posting port, `reverseTransfer` delegates, dead
  `listTransfers` removed, `amount.svelte` on minor units).
- **F-031** Test-fidelity gaps — **implemented** (visibility-aware mocks,
  confirmation completion, replay-with-data, real `hasReferences`).
- **F-032** Gate internals (unconditional release, catch-all recursion) —
  **assumed** — pre-existing from the household change; escalate to an
  operations-hardening proposal (fence `completeOperation`/`releaseGate` on
  `operation_id`, bound recursion, log non-conflict failures). The resume
  model relies on that fencing for absolute chain uniqueness under lease
  overrun.

### Re-review additions (all implemented)

- **R-001** Classify crash-window mirror state (row before flip) → adopt
  before insert; unique index never wedged (unit + D1 integration).
- **R-002** Adopt only invisible funding rows; member mismatch rejected.
- **R-003** Duplicate-replacement hazard on observations → visible-replacement
  guard + matching-prior adoption.
- **R-004** `?? ""` operation-id fallback → nullable signatures.
- **R-005** Dead `isOperationCompleted` helper → removed.
- **R-006** Gate fencing under lease overrun → folded into F-032 escalation.

### Evidence preserved from the data-operations probe (originally a separate

### file written by the reviewer subagent; consolidated here)

- Empirical crash probe against ephemeral Wrangler D1 (`persist: false`,
  `remoteBindings: false`) reproduced the F-001 wedge before the fix:
  contribution dropped from `postedAllocations` while entries stayed visible,
  `reversed_by_id` dangling at an invisible reversal, retry blocked forever.
- Verified non-findings at review time: `down(0003)` succeeds with preseed
  data present (incl. the self-referencing correction chain — no rollback
  hazard); D1/miniflare enforces foreign keys; preseed deletion order
  respects the FK graph; preseed chain ordering keys match runtime
  inheritance (`orderingKeyFor(effectiveAt, chainRootId)`).
- Accounts and `account_holder_intervals` intentionally live outside the
  operation-root protocol (no `operation_id` on accounts): a crash mid-create
  can show a draft with a partial holder set, self-healing via draft
  deletion. Recorded as an accepted assumption.
