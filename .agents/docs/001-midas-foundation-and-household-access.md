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

| ID  | Resolution                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| C6  | Amended spec to simplified "Household Operation Gate"; wired `withGate` into all 10 mutating route actions                                        |
| W2  | Member↔user link now visible and fully manageable: dropdown to change association, "Desvincular" to remove; member detail page shows linked users |
| W9  | Route logic is inline inside `withGate` closures — tested `credentials.ts` functions remain as domain logic for future use                        |
| W11 | Bootstrap now creates a pending operation root before entity writes and marks it complete on success                                              |
| S1  | Added `defaultWeight` number input to member create form                                                                                          |
| S3  | Member management is accessible to all authenticated household users per "equal financial access" — intentional                                   |
| S4  | Recovery schema now uses `.transform(normalizeUsername)`                                                                                          |

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
1c3f644 docs: add session handoff file and .agents/docs convention
e0d61d9 fix: wire operation gate into all mutating routes, amend spec
84715e6 fix: remaining adversarial findings S1/S3/S4/W11, update handoff
a9be586 feat: user-member link management with change and remove actions
84d6b9b fix: bootstrap row, gate TOCTOU, user create UX, activity events
```

### Second Adversarial Review (2026-08-05, Kimi K3)

A fresh adversarial review by a different model verified all previous fixes as genuine but found **4 CRITICAL + 10 WARNING + 6 SUGGESTION** new issues.

| ID    | Issue                                                                                  | Status                                                                                                                                        |
| ----- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| N-C1  | Fresh DB bootstrap impossible — migration never inserts `bootstrap_gate` singleton row | **Fixed** — replay-safe singleton insert in migration 0002                                                                                    |
| N-C2  | TOCTOU race — invariant checks (last admin, min members) outside gate                  | **Fixed** — all invariant reads moved inside `withGate` closure; `withGate` now catches errors as results instead of rethrowing               |
| N-C3  | User create: 500 on duplicate, no form errors, unvalidated member link                 | **Fixed** — duplicate returns form error, create form uses `activeCreateForm`, member link validated before gate, panel stays open on failure |
| N-C4  | Default weights broken: hardcoded 0, clobbered by lifecycle, no edit UI                | **Open**                                                                                                                                      |
| N-W1  | Activity history hides bootstrap/recovery events (inner join)                          | **Fixed** — `leftJoin`                                                                                                                        |
| N-W2  | Missing activity events for member delete + session actions                            | **Fixed** — events added for all three session actions + member delete                                                                        |
| N-W3  | user.household_id/member_id nullable without FKs                                       | **Open**                                                                                                                                      |
| N-W4  | AGENTS.md still describes removed JWT auth model                                       | **Open**                                                                                                                                      |
| N-W5  | Dead credential service with placeholder landmine                                      | **Open**                                                                                                                                      |
| N-W6  | Activity validation bypassed by routes                                                 | **Open**                                                                                                                                      |
| N-W7  | Member delete unreachable, no confirmations                                            | **Open**                                                                                                                                      |
| N-W8  | Bootstrap failure recovery diverges from spec                                          | **Open**                                                                                                                                      |
| N-W9  | Raw English reason codes shown to users + 2 unlabeled event types                      | **Fixed** — `reasonLabels` map + all 17 event labels                                                                                          |
| N-W10 | Recovery consumes credential after mutation                                            | **Open**                                                                                                                                      |

## Recommendations for Next Session

1. **N-C4 is the most impactful remaining item** — default allocation weights are write-only and clobbered by lifecycle changes. This affects the household-funding capability's financial calculations.

2. **N-W4 is a quick win** — update AGENTS.md Authentication section to describe mandatory D1 sessions instead of optional JWT.

3. **N-W5 decision needed** — the `credentials.ts` functions are tested but unused by routes. Either wire routes through them or delete them.

4. **N-W7** — add member delete button on detail page with confirmation dialog.

5. **N-W10** — recovery route should insert the consumed credential digest before mutating the user record.

| ID    | Issue                                                                                  | Status   |
| ----- | -------------------------------------------------------------------------------------- | -------- |
| N-C1  | Fresh DB bootstrap impossible — migration never inserts `bootstrap_gate` singleton row | **Open** |
| N-C2  | TOCTOU race — invariant checks (last admin, min members) outside gate                  | **Open** |
| N-C3  | User create: 500 on duplicate, no form errors, unvalidated member link                 | **Open** |
| N-C4  | Default weights broken: hardcoded 0, clobbered by lifecycle, no edit UI                | **Open** |
| N-W1  | Activity history hides bootstrap/recovery events (inner join)                          | **Open** |
| N-W2  | Missing activity events for member delete + session actions                            | **Open** |
| N-W3  | user.household_id/member_id nullable without FKs                                       | **Open** |
| N-W4  | AGENTS.md still describes removed JWT auth model                                       | **Open** |
| N-W5  | Dead credential service with placeholder landmine                                      | **Open** |
| N-W6  | Activity validation bypassed by routes                                                 | **Open** |
| N-W7  | Member delete unreachable, no confirmations                                            | **Open** |
| N-W8  | Bootstrap failure recovery diverges from spec                                          | **Open** |
| N-W9  | Raw English reason codes shown to users + 2 unlabeled event types                      | **Open** |
| N-W10 | Recovery consumes credential after mutation                                            | **Open** |

## Recommendations for Next Session

1. **N-C1 is a production blocker** — bootstrap cannot work on any non-preseeded database. Insert the singleton row in migration 0002 replay-safely.

2. **N-C2 undermines the gate** — the whole point of `withGate` is to serialize invariant checks with writes. Move all invariant reads INSIDE the gate closure.

3. **N-C3 breaks user creation UX** — the create-user form has three independent defects: 500 on duplicate, invisible errors, unvalidated member link.

4. **N-C4 means default weights are fiction** — they write but never read back, and lifecycle changes clobber them.
