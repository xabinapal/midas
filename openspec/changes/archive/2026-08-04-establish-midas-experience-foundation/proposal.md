## Why

The skeleton has no Midas product identity, application information architecture, localization contract, or design system suitable for a mobile household-finance workflow. A shared experience foundation is required before domain screens can be specified or implemented consistently.

## What Changes

- Establish Midas as a private, mobile-first household financial planner whose complete user interface is presented in Spanish for Spain.
- Define the authenticated application shell, mobile and desktop navigation, month navigation, shared screen states, and responsibilities of the principal screens.
- Replace the placeholder visual contract with a Midas-specific `DESIGN.md` inspired by Wise's friendly fintech language but adapted for compact application use, Spanish copy, daisyUI, and independent financial-status semantics.
- Define responsive, accessible, one-handed interaction requirements and shared formatting rules for money, dates, percentages, and numerical data.
- Keep product copy separate from English implementation identifiers so future localization remains possible without requiring a full internationalization system now.

## Capabilities

### New Capabilities

- `application-experience`: Product language, information architecture, navigation, responsive behavior, accessibility, shared screen states, and design-system conformance.

### Modified Capabilities

None.

## Impact

- Establishes the product and UI contract used by every later Midas change.
- Affects the application shell, protected routes, product metadata, Spanish user-facing copy, daisyUI theme tokens, shared components, responsive layouts, and component tests.
- Requires no new runtime dependency; the system font stack and existing daisyUI/Tailwind tooling remain sufficient.
- Does not define household finance behavior, authentication administration, or persistence schemas; those enter through dependent changes.
