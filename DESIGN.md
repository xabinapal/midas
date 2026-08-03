---
version: alpha
name: Midas
description: A compact, trustworthy, mobile-first household finance interface inspired by Wise's friendly fintech clarity and adapted to Midas with warm sage surfaces, deep forest actions, restrained gold accents, and independent financial-status colors.
colors:
  primary: "#1f5b49"
  on-primary: "#ffffff"
  primary-active: "#18483a"
  secondary: "#d4a72c"
  on-secondary: "#211a07"
  base: "#fbfaf6"
  base-soft: "#f1f3ed"
  surface: "#ffffff"
  surface-raised: "#ffffff"
  text: "#17201d"
  text-soft: "#405048"
  text-muted: "#66736c"
  border: "#cbd3cb"
  divider: "#dfe4dd"
  focus: "#2f75d6"
  info: "#286f8f"
  success: "#2f7d4a"
  warning: "#a85f08"
  error: "#b33a3a"
  planned: "#6f6489"
  paid: "#286f8f"
  unpaid: "#955005"
  pending: "#85611b"
  partial: "#a64f16"
  settled: "#2f7d4a"
  disabled-surface: "#e5e8e3"
  disabled-text: "#58635c"
  dark-base: "#101512"
  dark-base-soft: "#171e1a"
  dark-surface: "#202923"
  dark-text: "#f1f4f0"
  dark-text-soft: "#bdc7c0"
  dark-border: "#3a463e"
  dark-primary: "#83c8aa"
  dark-on-primary: "#10231b"
  dark-planned: "#c5b9e8"
  dark-paid: "#79c4df"
  dark-unpaid: "#f2b66d"
  dark-pending: "#e2c56b"
  dark-partial: "#f1a171"
  dark-settled: "#78c995"
  dark-error: "#ff9b9b"
typography:
  page-title:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 2rem
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: -0.02em
  section-title:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 1.25rem
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  body-strong:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 1rem
    fontWeight: 650
    lineHeight: 1.5
  label:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 0.875rem
    fontWeight: 650
    lineHeight: 1.4
  caption:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.35
  amount-large:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 2rem
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: -0.02em
  amount:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 1rem
    fontWeight: 700
    lineHeight: 1.4
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  pill: 9999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  xxxl: 40px
  section: 48px
elevation:
  flat: none
  raised: 0 1px 2px rgba(23, 32, 29, 0.08)
  overlay: 0 12px 32px rgba(23, 32, 29, 0.16)
components:
  app-shell:
    backgroundColor: "{colors.base}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  panel-raised:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  summary-card:
    backgroundColor: "{colors.base-soft}"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: 12px 20px
    height: 48px
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: 12px 20px
    height: 48px
  button-secondary:
    backgroundColor: "{colors.base-soft}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: 12px 20px
    height: 48px
  button-destructive:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: 12px 20px
    height: 48px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 12px 16px
    height: 48px
  navigation-item:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-soft}"
    typography: "{typography.caption}"
    height: 48px
  navigation-item-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.caption}"
    height: 48px
  list-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    padding: 12px 16px
    height: 56px
  border-line:
    backgroundColor: "{colors.border}"
    textColor: "{colors.text}"
    height: 1px
  divider-line:
    backgroundColor: "{colors.divider}"
    textColor: "{colors.text}"
    height: 1px
  accent-chip:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  muted-copy:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
    typography: "{typography.caption}"
  focus-indicator:
    backgroundColor: "{colors.focus}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xs}"
  alert-info:
    backgroundColor: "{colors.info}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  alert-success:
    backgroundColor: "{colors.success}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  alert-warning:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  control-disabled:
    backgroundColor: "{colors.disabled-surface}"
    textColor: "{colors.disabled-text}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: 48px
  status-planned:
    backgroundColor: "{colors.base-soft}"
    textColor: "{colors.planned}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  status-estimated:
    backgroundColor: "{colors.base-soft}"
    textColor: "{colors.planned}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  status-paid:
    backgroundColor: "{colors.base-soft}"
    textColor: "{colors.paid}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  status-unpaid:
    backgroundColor: "{colors.base-soft}"
    textColor: "{colors.unpaid}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  status-pending:
    backgroundColor: "{colors.base-soft}"
    textColor: "{colors.pending}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  status-payment-partial:
    backgroundColor: "{colors.base-soft}"
    textColor: "{colors.partial}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  status-settlement-partial:
    backgroundColor: "{colors.base-soft}"
    textColor: "{colors.pending}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  status-settlement-not-required:
    backgroundColor: "{colors.base-soft}"
    textColor: "{colors.text-soft}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  status-settled:
    backgroundColor: "{colors.base-soft}"
    textColor: "{colors.settled}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  status-overdue:
    backgroundColor: "{colors.base-soft}"
    textColor: "{colors.error}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  status-cancelled:
    backgroundColor: "{colors.disabled-surface}"
    textColor: "{colors.disabled-text}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  status-reversed:
    backgroundColor: "{colors.base-soft}"
    textColor: "{colors.error}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  dark-app-shell:
    backgroundColor: "{colors.dark-base}"
    textColor: "{colors.dark-text}"
    typography: "{typography.body}"
  dark-panel:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  dark-navigation:
    backgroundColor: "{colors.dark-base-soft}"
    textColor: "{colors.dark-text-soft}"
    typography: "{typography.caption}"
    height: 48px
  dark-divider:
    backgroundColor: "{colors.dark-border}"
    textColor: "{colors.dark-text}"
    height: 1px
  dark-button-primary:
    backgroundColor: "{colors.dark-primary}"
    textColor: "{colors.dark-on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    height: 48px
  dark-status-planned:
    backgroundColor: "{colors.dark-base-soft}"
    textColor: "{colors.dark-planned}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  dark-status-paid:
    backgroundColor: "{colors.dark-base-soft}"
    textColor: "{colors.dark-paid}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  dark-status-unpaid:
    backgroundColor: "{colors.dark-base-soft}"
    textColor: "{colors.dark-unpaid}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  dark-status-pending:
    backgroundColor: "{colors.dark-base-soft}"
    textColor: "{colors.dark-pending}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  dark-status-partial:
    backgroundColor: "{colors.dark-base-soft}"
    textColor: "{colors.dark-partial}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  dark-status-settled:
    backgroundColor: "{colors.dark-base-soft}"
    textColor: "{colors.dark-settled}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  dark-status-error:
    backgroundColor: "{colors.dark-base-soft}"
    textColor: "{colors.dark-error}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
---

## Direction

Midas is a calm household tool, not a trading terminal and not a decorative
banking landing page. The visual system uses warm sage and cream surfaces,
compact hierarchy, large touch targets, and strong numerical alignment. It
should feel trustworthy enough for corrections and password administration,
but friendly enough for daily expense entry.

The starting reference is the Wise design analysis at
`https://getdesign.md/wise/design-md`. Wise is
the strongest available baseline for friendly financial interaction, clear
money presentation, rounded mobile controls, and surface-based elevation. Midas
adapts those principles rather than reproducing Wise branding or trade dress.

## Deliberate Deviations

- Replace Wise's vivid lime with deep forest primary actions. The Midas gold
  accent is secondary and must not be used as a universal status color.
- Replace proprietary Wise Sans and oversized weight-900 marketing headlines
  with the dependency-free system stack and compact application titles.
- Reduce canonical card radius from 24px to 16px for dense lists; reserve 24px
  for summary cards and primary buttons.
- Use separate colors and explicit Spanish labels for payment and settlement
  states. Primary, success, paid, and settled must remain distinct roles.
- Prefer semantic lists, rows, and amount blocks over charts. Use a chart only
  when it answers a question more clearly than text and amounts.
- Support dark mode through equivalent semantic tokens rather than inverting
  arbitrary colors. The initial theme follows the operating-system preference.
  In dark mode, status names keep their semantic hue while surfaces remap to the
  dark base ladder and all text/indicator combinations retain AA contrast.

## Composition

Pages use a single reading column on mobile with 16px gutters and no horizontal
page scrolling. Summary content may use a two-column grid on tablet and a
sidebar-plus-content shell on desktop. Long financial lists stay full width.

The mobile shell has a compact top bar, an optional period navigator below it,
and a fixed bottom navigation. Bottom-navigation destinations are `Resumen`,
`Gastos`, `Saldos`, and `Más`; a visually distinct central `Añadir` action opens
the common expense flow and is not treated as a destination tab.

On desktop, the destinations move to a left sidebar and the create action stays
prominent near the page title. Selection, focus, and route state must remain
equivalent between layouts.

## Financial Data

- Format currency and numbers with the household currency and `es-ES` locale.
- Use tabular numerals for every amount, percentage, balance, and date column.
- Place the amount at the strongest edge of an expense or transfer row and
  never rely on color to communicate its meaning.
- Show payment status and settlement status as separate labels when both are
  relevant. Do not compress `Pagado` and `Compensado` into one badge.
- Negative position means the member still needs to contribute; positive
  position means the member has advanced value. Pair the sign with explanatory
  language such as `Debe aportar` or `Ha adelantado`.

## Components

Compose all controls from daisyUI primitives and map their semantic theme roles
to this file. Tailwind utilities control layout only. New visual values must be
added here before use.

Cards are not the default wrapper for every section. Use a card for a summary,
actionable recommendation, grouped form, or bounded empty state. Use divided
lists for expenses, transfers, activity, accounts, and members.

Inputs and buttons have at least a 48px interactive height. Icon-only controls
have an accessible name and at least a 44px target. Destructive actions use a
confirmation dialog that names the record and describes reversal or deletion.

Status indicators always combine color with text and, where compact enough, an
icon. The primary status vocabulary is:

- `Previsto` or `Estimado` for planned values.
- `Sin pagar`, `Pago parcial`, and `Pagado` for payment progress.
- `Pendiente de compensar`, `Compensado parcialmente`, and `Compensado` for
  settlement progress.
- `Vencido` for an unpaid expense past its due date.
- `Anulado` for a posted record reversed by a corrective operation.

## Feedback And States

Validation appears beside the field and is summarized at the form heading when
multiple fields fail. Preserve entered non-sensitive values after validation.
Never preserve or redisplay password values.

Use inline alerts for persistent financial or security consequences, toasts for
successful low-risk completion, skeletons that preserve page geometry for
loading, and explicit retry actions for failed server loads. Empty states name
what is absent and offer one next action; they do not use decorative filler.

## Accessibility

- Meet WCAG 2.2 AA contrast and keyboard requirements.
- Maintain visible focus using `{colors.focus}` with at least a 2px ring and
  sufficient offset from the component border.
- Respect reduced-motion preferences; no financial meaning may depend on
  animation.
- Use semantic headings, lists, tables, fieldsets, labels, legends, and live
  regions as appropriate.
- Do not truncate essential Spanish labels. Allow wrapping before reducing type
  size, and test common controls with labels at least 30 percent longer than the
  English equivalent.
- Keep destructive controls away from the bottom-navigation create action and
  require explicit confirmation for posted financial corrections.

## Always And Never

- Always use the shared semantic tokens and daisyUI component states.
- Always distinguish money movement, expense status, and settlement status in
  both wording and visual hierarchy.
- Always keep the most common expense entry flow reachable with one hand.
- Never use the gold accent as success, warning, or overdue without an explicit
  status token.
- Never show unexplained signed amounts or accounting jargon on the dashboard.
- Never hide financial context behind icon-only controls.
- Never use dense chart dashboards, glass effects, gradients, or decorative
  finance imagery as substitutes for useful household information.
