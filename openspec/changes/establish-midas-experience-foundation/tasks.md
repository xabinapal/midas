## 1. Contract Alignment

- [x] 1.1 Review every application-experience scenario against the accepted `DESIGN.md` and dependent Midas proposals before changing application code.
- [x] 1.2 Update centralized site identity, manifest metadata, crawler-safe product copy, and stable documentation from the skeleton identity to Midas without changing protected-route boundaries.
- [x] 1.3 Map every `DESIGN.md` semantic token to a single explicit daisyUI theme and run design lint before building screens.

## 2. Shared Experience Components

- [x] 2.1 Write failing component tests for the mobile destinations, distinct create action, active-route semantics, keyboard operation, and desktop navigation equivalence.
- [x] 2.2 Implement the responsive protected application shell with mobile bottom navigation, desktop sidebar, safe-area spacing, and Spanish labels.
- [x] 2.3 Write failing tests for URL-backed previous/current/next period navigation, including past, future, reload, and browser history behavior.
- [x] 2.4 Implement the reusable period navigator and route-state contract without mutable global user state.
- [x] 2.5 Implement shared amount, date, percentage, financial-status, loading, empty, validation-summary, alert, toast, and confirmation primitives from daisyUI components.

## 3. Localization and Accessibility

- [x] 3.1 Replace every application-owned starter, login, logout, error, and protected-shell string with natural Spanish for Spain while keeping internal identifiers English.
- [x] 3.2 Add shared `es-ES` formatting boundaries for household currency, dates, numbers, and percentages using platform APIs.
- [x] 3.3 Add component tests for independent payment/settlement labels, long Spanish labels at narrow viewport widths, accessible names, focus order, live feedback, and reduced-motion behavior.
- [x] 3.4 Manually verify representative 320px/360px mobile, 768px tablet, and desktop layouts for overflow, one-handed reach, focus visibility, and WCAG 2.2 AA contrast.

## 4. Skeleton Replacement Boundaries

- [x] 4.1 Replace the starter navigation and capability demonstration with a Spanish shell-safe home state, hide unavailable domain routes, and avoid fabricating placeholder financial data.
- [x] 4.2 Remove or isolate starter-only cache presentation once no protected screen depends on it, preserving the canonical KV capability contract.
- [x] 4.3 Update component and route tests to assert Spanish visible behavior and the new application shell rather than starter copy.

## 5. Verification

- [x] 5.1 Run `mise run design-lint` and resolve every DESIGN.md error.
- [x] 5.2 Run `mise run format`, `mise run lint`, `mise run check`, and `mise run test`.
- [x] 5.3 Run strict OpenSpec validation and `/opsx-verify` for this change before archive.
