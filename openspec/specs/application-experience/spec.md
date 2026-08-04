# Capability: Application Experience

## Purpose

The application experience capability defines the user-facing presentation,
interaction, and accessibility contract for Midas. It governs the visible
language (Spanish for Spain), the design-system theme, the mobile-first
navigation shell, the linkable accounting-period navigation, the separation
of financial-status dimensions, the shared loading/empty/validation/failure
states, the accessible responsive interaction requirements, and the safety
of destructive and corrective actions.

## Requirements

### Requirement: Spanish User Interface

Every user-facing application string SHALL use natural Spanish suitable for Spain, including navigation, headings, field labels, actions, statuses, validation, errors, confirmations, empty states, notifications, authentication, and user administration. Dates, numbers, percentages, and currency SHALL use `es-ES` presentation rules and the configured household currency. Internal identifiers and technical artifacts MUST remain English and MUST NOT be used as untranslated visible copy.

#### Scenario: Application page is presented

- **WHEN** a user opens any public or protected Midas page
- **THEN** every application-owned visible string SHALL be Spanish and formatted for Spain

#### Scenario: Domain state is displayed

- **WHEN** an internal English status or validation code reaches the presentation boundary
- **THEN** the interface SHALL render the corresponding Spanish label or message rather than the internal identifier

### Requirement: Authoritative Design Contract

Application screens and components SHALL consume the semantic tokens and component rules defined by the root `DESIGN.md` through the shared daisyUI theme. A component MUST NOT introduce an arbitrary color, typography rule, spacing value, radius, elevation, focus treatment, or financial-status style outside that contract. The application SHALL use a single dark theme; no light variant is provided and the application SHALL NOT depend on `prefers-color-scheme`.

#### Scenario: New component is styled

- **WHEN** a Midas component requires a visual value
- **THEN** it SHALL use an existing semantic design token or first extend the reviewed design contract

#### Scenario: Application renders with the single theme

- **WHEN** the application loads on any device or platform regardless of operating-system color-scheme preference
- **THEN** it SHALL consistently apply the single dark semantic theme without changing the meaning of actions or statuses

### Requirement: Mobile-First Application Navigation

On mobile, the protected application shell SHALL provide persistent destinations for `Resumen`, `Gastos`, `Saldos`, and `Más`, plus a distinct `Añadir` expense action. The action MUST NOT behave as a selected destination. On larger viewports, the same destinations SHALL move to a persistent sidebar or equivalent navigation without changing their route meaning or hiding the create action.

#### Scenario: User navigates on mobile

- **WHEN** the protected shell renders below the desktop breakpoint
- **THEN** the four destinations and distinct expense action SHALL be reachable as at least 44-by-44-pixel targets without opening another menu

#### Scenario: User navigates on desktop

- **WHEN** the protected shell renders at the desktop breakpoint
- **THEN** it SHALL expose the same destination hierarchy in the desktop navigation and identify the active route

### Requirement: Linkable Period Navigation

Period-oriented screens SHALL expose the selected accounting period in URL state and provide previous and next navigation, including future periods. Browser back, forward, reload, and shared links SHALL restore the same selected period. Per-user period state MUST NOT be held in mutable server-global state.

#### Scenario: User opens a previous month

- **WHEN** the user selects the previous period
- **THEN** the URL and visible period SHALL update together and a reload SHALL preserve that selection

#### Scenario: User opens a future month

- **WHEN** the user navigates beyond the current period
- **THEN** the screen SHALL show that future period and its available planned data rather than forcing the current month

### Requirement: Capability-Owned Screen Responsibilities

The application shell SHALL define distinct destinations for period summary, expenses, balances and settlements, and secondary administration. Each domain capability, when implemented, SHALL provide its own detail, entry, correction, and administration screens within that information architecture. The shell MUST hide unavailable domain routes rather than fabricate data or behavior. A screen SHALL present only safe household-scoped projections and SHALL link to the owning workflow rather than duplicate unrelated mutation behavior.

#### Scenario: User opens an expense detail

- **WHEN** the expense-management capability is implemented and an expense is selected from a summary, list, or activity event
- **THEN** one detail screen SHALL present its expense facts, allocations, payment state, evidence, and history and SHALL add settlement state only when the transfer-and-settlement capability is implemented

#### Scenario: User opens secondary administration

- **WHEN** the user selects `Más`
- **THEN** the application SHALL provide access to each implemented secondary capability according to the user's authorization and SHALL omit capabilities not yet available

### Requirement: Independent Financial Status Presentation

The interface SHALL present payment progress independently from settlement progress. Planning, estimation, due, and reversal state SHALL remain additional dimensions. Color MUST NOT be the only indicator, and `paid` MUST NOT be presented as equivalent to `settled`.

#### Scenario: Paid expense awaits reimbursement

- **WHEN** an expense is fully paid but has an open settlement claim
- **THEN** the interface SHALL show both `Pagado` and `Pendiente de compensar` or their approved Spanish equivalents

#### Scenario: Unpaid expense is overdue

- **WHEN** an expense has an unpaid amount after its due date
- **THEN** the interface SHALL show its payment state and overdue state separately

### Requirement: Shared Loading, Empty, Validation, and Failure States

Every data-bearing screen SHALL define loading, empty, validation, success, and failure behavior. Loading placeholders SHALL preserve layout; empty states SHALL explain the absent content and offer at most one primary next action; validation SHALL be associated with fields and summarized when necessary; recoverable load failures SHALL offer retry. Sensitive values MUST NOT be returned in validation state.

#### Scenario: Expense period is empty

- **WHEN** a selected period has no expenses or expected occurrences
- **THEN** the screen SHALL explain that state in Spanish and offer the appropriate expense or planning action

#### Scenario: Form validation fails

- **WHEN** submitted input is invalid
- **THEN** the form SHALL retain safe input, identify each invalid field accessibly, and omit passwords or equivalent secrets

### Requirement: Accessible Responsive Interaction

The application SHALL meet WCAG 2.2 AA for contrast, focus, naming, keyboard operation, semantic structure, and status communication. Interactive targets SHALL be at least 44 by 44 pixels, primary form controls SHALL be at least 48 pixels high, reduced-motion preferences SHALL be respected, and essential Spanish labels MUST wrap without truncation or horizontal page overflow at a 320-pixel viewport.

#### Scenario: Keyboard user operates a workflow

- **WHEN** a user navigates and submits a form without a pointing device
- **THEN** every control SHALL be reachable in logical order with a visible focus indicator and an accessible name

#### Scenario: Long Spanish label renders on mobile

- **WHEN** a control label is longer than its English equivalent at a 320-pixel viewport
- **THEN** the component SHALL preserve the complete label and usable target without horizontal page scrolling

### Requirement: Safe Destructive and Corrective Actions

Destructive actions SHALL be visually distinct from ordinary actions and SHALL require confirmation that names the affected record and consequence. Posted financial records SHALL be described as reversals or corrections rather than silent deletion when the owning domain requires preservation.

#### Scenario: User corrects a posted transfer

- **WHEN** the user invokes the corrective action for a posted transfer
- **THEN** the confirmation SHALL explain that the original remains in history and a reversal or replacement will be recorded
