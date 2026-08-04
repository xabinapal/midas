## Context

The current protected page and navigation are starter demonstrations in English, and the root `DESIGN.md` defines only an orange accent and a minimal panel. Midas will be used primarily from a phone for frequent expense entry, but it also needs dense historical review on larger screens. Every later domain change needs one stable visual, language, navigation, and state contract.

The design-reference review considered candidates for authenticated forms, lists, numerical summaries, and mobile interaction rather than marketing-page appearance:

| Candidate  | Strengths                                                                                              | Limitations for Midas                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Wise       | Friendly fintech voice, clear money UI, strong touch geometry, sage surfaces, explicit semantic colors | Proprietary heavy display face, neon brand green, and marketing-scale type require adaptation         |
| Coinbase   | Trustworthy, restrained, strong numerical hierarchy and blue focus language                            | More institutional and trading-oriented; dark editorial heroes do not suit daily household workflows  |
| Revolut    | Polished mobile-finance feel and strong dark mode                                                      | Product-mockup aesthetic, black canvas, and broad accent palette risk visual drama over clarity       |
| Airtable   | Excellent structured-data density, lists, forms, and calm hierarchy                                    | Reads as workflow software rather than a friendly finance product                                     |
| Mastercard | Warm editorial palette and approachable shapes                                                         | Marketing-led orbital imagery and extreme whitespace are unsuitable for compact authenticated screens |

Wise is the selected baseline. The root `DESIGN.md` records the adapted Midas tokens and rules and is normative for implementation.

## Goals / Non-Goals

**Goals:**

- Establish a coherent mobile-first application shell and screen hierarchy.
- Make Spanish for Spain the complete visible language while preserving English internal identifiers.
- Make payment and settlement states understandable as independent dimensions.
- Optimize common entry for one hand without reducing accessibility or correction safety.
- Define a responsive path from bottom navigation to desktop sidebar without changing information architecture.
- Keep every later UI change aligned with one `DESIGN.md` contract.

**Non-Goals:**

- Implement full runtime locale switching or translation management.
- Create a public marketing site, decorative data visualization system, or bank-like account aggregation UI.
- Introduce a font, icon, chart, or component dependency.
- Specify the domain calculations that produce displayed values; domain capabilities own those rules.

## Decisions

### Use a stable destination model with an action in the center

Mobile navigation uses four destinations plus one central create action:

```text
+--------------------------------------------------+
| Resumen | Gastos |  + Añadir  | Saldos | Más   |
+--------------------------------------------------+
```

`Resumen` owns the selected period overview. `Gastos` owns expense discovery and detail. `Saldos` owns pending settlement and transfers. `Más` exposes planning, accounts, categories, members, users, activity, and the current user's security settings. `Añadir` opens the most common expense flow and does not acquire selected-tab state.

A hamburger-only mobile shell was rejected because it hides frequent destinations. A five-destination shell without a create action was rejected because it adds steps to the dominant workflow.

Desktop reuses the same destinations in a persistent sidebar and surfaces secondary destinations directly. URL and focus behavior stay consistent across breakpoints.

### Make the period a shared route context

The current accounting period is represented in URL state and shown by a reusable previous/current/next navigator beneath the page heading where relevant. Past and future periods remain reachable. This avoids mutable global period state and makes views linkable and browser-navigation safe.

### Keep the dashboard action-oriented

The default current-period dashboard is ordered by decisions rather than by chart appeal:

```text
Current period and status
  -> compact expected / paid / unpaid totals
  -> recommended transfer or "balanced" state
  -> expense progress list
  -> member funding positions
  -> upcoming expected expenses
  -> recent activity
```

The dashboard may omit a section when it has no useful content. Generic charts were rejected because exact amounts and next actions better answer the household's questions.

### Assign one responsibility to each principal screen

- **Resumen**: selected-period totals, member position, next settlement action, upcoming items, and recent activity.
- **Gastos**: period-filtered expense list, status/filter/search controls, and creation entry.
- **Detalle del gasto**: expense facts, allocations, payment applications, settlement progress, evidence, and audit trail.
- **Nuevo/editar gasto**: progressive form for amount, period, category, payment state, source account, and member allocation.
- **Saldos**: member positions, pending claims, deterministic recommendations, and transfer history.
- **Registrar transferencia**: source/destination, date, amount, purpose, and optional matching to pending claims.
- **Planificación**: expected occurrences, recurring templates, estimates, and expected-versus-actual differences.
- **Cuentas**: active/closed accounts, holders, last recorded balance, and account movement history.
- **Categorías**: category lifecycle and ordering.
- **Hogar**: members, default shares, active state, and optional user link.
- **Usuarios y seguridad**: authorized user administration, sessions, password changes, and password resets.
- **Actividad**: filterable actor and record history.

### Use progressive expense entry

The common paid-expense path initially asks for description/category, amount, date/period, source account, and split. Secondary controls reveal unpaid/estimated state, service period, due date, custom fixed amounts, evidence, and notes. Defaults come from the category, recurring occurrence, household allocation, and account classification but are always shown before submission.

A multi-page wizard was rejected because it slows common entry and makes correction harder. One unstructured long form was rejected because advanced fields would dominate the common case.

### Separate status dimensions in copy and components

Payment status (`Sin pagar`, `Pago parcial`, `Pagado`) and settlement status (`No requiere compensación`, `Pendiente de compensar`, `Compensado parcialmente`, `Compensado`) are rendered separately. Planning and due state add independent labels (`Previsto`, `Estimado`, `Vencido`). `Cancelado` is reserved for an expected occurrence stopped before realization; `Anulado` identifies a posted financial record reversed through correction. Color reinforces but never replaces text.

### Use a single dark theme

The application uses a single dark theme derived from the semantic design contract. No light variant is provided, and the application does not follow `prefers-color-scheme`. This keeps the visual system simple, avoids dual-token maintenance, and produces a calm, focused surface that suits frequent household finance interaction.

### Keep copy localized at the presentation boundary

All visible labels, messages, status names, confirmations, dates, numbers, and currency use natural Spanish for Spain. Domain types, routes, payloads, persistence identifiers, tests, and technical documents remain English. Copy is centralized by feature rather than embedded in domain logic, which enables future localization without introducing a full i18n dependency now.

## Risks / Trade-offs

- **The Wise inspiration may become imitation** -> Midas uses different brand colors, system typography, compact radii, application layouts, and no Wise assets or copy.
- **Bottom navigation can become crowded in Spanish** -> Use four short destination labels, allow labels to wrap only where specified, and move low-frequency functions to `Más`.
- **Multiple status labels can create noise** -> Show only dimensions relevant to the current context, but never merge payment and settlement into one derived label.
- **System fonts vary by platform** -> Preserve size, weight, line-height, and tabular-number behavior; do not depend on exact glyph metrics.
- **Future capabilities may invent visual exceptions** -> Every later proposal references root `DESIGN.md`; new tokens require an explicit design-contract change.

## Change Sequence

The active changes are reviewed, applied, verified, and archived in this order:

1. `establish-midas-experience-foundation`
2. `manage-household-members-and-access`
3. `manage-financial-accounts-and-funding`
4. `plan-and-record-expenses`
5. `reconcile-transfers-and-settlements`
6. `report-monthly-household-position`

Each change may rely only on canonical capabilities plus earlier changes that have been accepted and archived. A later change must be rebased against the promoted canonical specs before implementation if an earlier review alters its contract. Applying all six concurrently was rejected because authentication, account movement, expense claims, and reporting formulas need reviewable ownership and migration order.

## Migration Plan

1. Obtain review acceptance for the selected Wise-inspired Midas direction and root token contract.
2. Align the daisyUI theme and centralized site identity with the accepted tokens.
3. Build the responsive protected shell, common navigation, period navigator, and shared feedback states.
4. Convert login, error, and empty/loading states to Spanish and verify long-label behavior.
5. Replace starter-only content as dependent domain changes become available; do not retain competing component styles.
6. Run design lint, accessibility-focused component tests, and all repository quality gates.

Rollback restores the previous shell and theme together. Mixing old orange starter tokens with the Midas shell is not a supported intermediate state.

## Open Questions

None block proposal review. A manual visual review on representative 360px, 768px, and desktop viewports remains an implementation acceptance activity.
