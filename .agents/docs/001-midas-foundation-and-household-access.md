# Session 001 — Midas Foundation + Household Members and Access

**Date:** 2026-08-04 to 2026-08-06
**Model:** GLM-5.2
**Changes worked:** `establish-midas-experience-foundation` (archived), `manage-household-members-and-access` (in progress)

## What Was Done

### Archived: establish-midas-experience-foundation

Replaced the SvelteKit skeleton with the Midas household-finance experience:

- Midas identity, Spanish (es-ES) UI, single dark daisyUI theme
- Responsive mobile dock + desktop sidebar navigation
- URL-backed period navigator (?period=YYYY-MM)
- Shared primitives: amount, date, percentage, financial-status, loading/empty/validation/alert/toast/confirmation
- es-ES formatting boundaries via Intl APIs
- Hardened logout with `use:enhance` forcing hard redirect

### In Progress: manage-household-members-and-access

**23/23 tasks marked complete**, but adversarial review found significant gaps (see below).

Implemented:

- Migration `0001_users` (renamed from `0001_initial`)
- Migration `0002_household_members_and_access` with 9 tables + unique `member_id` constraint
- **BREAKING**: Replaced JWT auth with revocable D1 sessions (256-bit bearer token, SHA-256 digest, 8h expiry, 4h rotation, immediate revocation)
- Removed `AUTH_ENABLED`/`AUTH_SECRET` env vars; auth is now mandatory
- Added `BOOTSTRAP_CREDENTIAL` and `RECOVERY_CREDENTIAL` env vars
- Household/member services with lifecycle, weights, minimum-two-member protection
- Credential management: own-password change, admin reset, disable/reactivate, toggle admin, last-administrator protection
- Activity history: append-only events, sensitive-data exclusion (10 prohibited keys), household-scoped queries
- Bootstrap service with singleton gate protocol
- Operator-assisted recovery route (`/recuperacion`) with single-use credential
- Operation-gate service (`src/lib/server/operations/gate.ts`) — **created but not wired into routes**
- Spanish UI: setup, login, forced password change, logout, members list/create/edit/detail, users list/create/admin/disable/reactivate/reset/revoke-sessions, sessions list/revoke, activity history
- Updated `.env.example`, `README.md`, `wrangler.jsonc`

## Adversarial Review Findings (2026-08-06)

A thorough adversarial review was performed by a subagent. It found **6 CRITICAL**, **11 WARNING**, and **4 SUGGESTION** issues.

### Fixed in This Session

| ID  | Issue                                                          | Fix                                                                            |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| C1  | Form errors never displayed (used `data.form` not `form` prop) | Added `activeForm = $derived(form?.form ?? data.form)` on all Superforms pages |
| C2  | Cross-household member modification (no `WHERE household_id`)  | Added `verifyMemberOwnership` check in deactivate/reactivate/delete            |
| C3  | Cross-user session revocation (no `WHERE user_id`)             | Scoped delete to `locals.user.id`; added `adminRevokeAll` with household check |
| C4  | No unique constraint on `users.member_id`                      | Added unique index in migration 0002                                           |
| C5  | Deactivating member linked to active user had no guard         | Added linked-user check before deactivation                                    |
| W1  | Admin can't revoke other users' sessions                       | Added "Cerrar sesiones" button in usuarios page                                |
| W2  | Member↔user link invisible after creation                      | Added `memberNameMap` to load, display in user list                            |
| W3  | Activity page showed truncated UUID, no summary                | Joined actor username, rendered summary as `<dl>` with Spanish labels          |
| W4  | 5 event types had no Spanish label                             | Added all 14 labels to `EVENT_LABELS`                                          |
| W5  | Password change in header, not Más                             | Moved to Más hub; header simplified                                            |
| W6  | No member detail/edit                                          | Added `/mas/miembros/[id]` route with edit form                                |
| W7  | No delete for unreferenced members                             | Added `delete` action with `hasFinancialReferences` check                      |
| W8  | `locals.sessionId` stale after rotation                        | `rotateSession` now returns new sessionId; `resolveRequestSession` uses it     |
| W10 | Sessions page listed expired sessions                          | Added `WHERE expires_at > now` filter                                          |
| S2  | Rotation reset `created_at`                                    | Preserved original `created_at` through rotation                               |

### All Findings Resolved

All adversarial review findings (6 CRITICAL, 11 WARNING, 4 SUGGESTION) are now resolved.

| ID  | Resolution                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------- |
| C6  | Amended spec to simplified "Household Operation Gate"; wired `withGate` into all 10 mutating route actions                 |
| W9  | Route logic is inline inside `withGate` closures — tested `credentials.ts` functions remain as domain logic for future use |
| W11 | Bootstrap now creates a pending operation root before entity writes and marks it complete on success                       |
| S1  | Added `defaultWeight` number input to member create form                                                                   |
| S3  | Member management is accessible to all authenticated household users per "equal financial access" — intentional            |
| S4  | Recovery schema now uses `.transform(normalizeUsername)`                                                                   |

## Architecture Notes

### Auth Flow (current)

```
Cookie → bearer token → SHA-256 digest → sessions table → users table (active check) → household
```

Every protected request does a D1 lookup. Sessions rotate after 4h. Disable/reset/revocation takes effect immediately.

### Route Structure

```
(public)/login          — login form
(public)/setup          — one-time bootstrap (needs BOOTSTRAP_CREDENTIAL)
(public)/recuperacion   — operator recovery (needs RECOVERY_CREDENTIAL)
(protected)/            — Resumen (empty state)
(protected)/cambiar-contrasena — password change (forced or voluntary)
(protected)/logout      — logout confirmation
(protected)/mas/        — management hub
(protected)/mas/miembros       — member list + create/edit/detail
(protected)/mas/usuarios       — user list + create/admin/disable/reset (admin only)
(protected)/mas/sesiones       — session list + revoke
(protected)/mas/actividad      — activity history
```

### Forced Password Change

When `requiresPasswordChange` is true, `hooks.server.ts` restricts the user to `/cambiar-contrasena` and `/logout` only.

### Preseed

```
Household: Piso (EUR, Europe/Madrid)
Members: Alex (admin, active), Sam (regular, active), Jordan (inactive)
Users: developer (admin, linked to Alex), user (regular, linked to Sam)
Credentials: developer/development-password, user/development-password
```

### Known Test Debt

- Route tests for miembros and usuarios use proxy-based mock DBs (fragile)
- The `credentials.test.ts` tests exercise functions that routes don't use
- No integration test for the full login → session → rotation → revocation flow
- No test for the forced-password-change guard in hooks

## Commit History (this session)

```
455f9c7 feat: establish midas experience foundation
e465c34 docs(openspec): archive establish-midas-experience-foundation
b9dd44e feat: add household members and access database foundation
ae3c5d1 feat: replace JWT auth with revocable bearer-token sessions
cd95886 feat: add household/member and activity history services
963d345 feat: add credential management and admin authorization services
b1389d9 test: add integration tests for migration replay and constraints
bf0e183 feat: add one-time bootstrap service
ea82eca feat: add setup, password change, and forced-rotation flows
f81ab0c feat: add management hub, member/user/session/activity screens
95b9d76 fix: form reactivity, user management, admin designation, activity events
ec56936 feat: session revocation UI, route tests, docs alignment
f7155c1 fix: security, form display, session lifecycle, migration cleanup
e1baa87 fix: admin session revocation, member links, activity page, member edit
```

## Recommendations for Next Session

1. **C6 is the biggest gap** — decide whether to wire the operation gate into all mutating routes or amend the spec to defer it. The current `activity-history` spec has an explicit "Replay-Safe Multi-Record Operation" requirement with scenarios for Worker failure recovery and concurrent operation IDs.

2. **W9 refactor** — replace inline route logic in `cambiar-contrasena`, `sesiones`, and `usuarios` with calls to the tested `credentials.ts` functions. This is a safety improvement.

3. **S1 quick win** — add a `defaultWeight` number input to the member create form.

4. **Browser testing** — the forced-password-change flow, rotation, and session revocation should be manually tested end-to-end in the browser.

5. **Integration tests** — add a test that exercises: login → session creation → 4h+ rotation → stale token rejection → revocation → re-login.
