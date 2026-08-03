# AGENTS.md

How to work in this codebase. This file defines stable conventions and behaviors
for AI agents (and humans). It is intentionally **non-volatile**: it describes
principles and patterns, not version numbers or exhaustive file lists. Update it
only when a convention itself changes — not for ordinary feature work.

## What this project is

A SvelteKit skeleton deployed to Cloudflare Workers, backed by Cloudflare D1
and Workers KV.
It exists as a common starting point for new applications, so consistency and
predictability matter more than cleverness.

## Stack

- **SvelteKit + Svelte 5** using runes (`$state`, `$props`, `$derived`, …).
- **TypeScript** in strict mode.
- **Cloudflare Workers + D1 + KV** via Wrangler; `@sveltejs/adapter-cloudflare`.
- **Kysely** ORM with code-based migrations (no raw SQL).
- **Tailwind CSS v4 + daisyUI** for all UI (see [DESIGN.md](DESIGN.md)).
- **Superforms + Zod** for schema-driven forms and validation.
- **Svelte Headless Table** for data tables, filtering, sorting, and pagination.
- **Internal authentication** with D1 users, PBKDF2 password hashes, and signed
  JWT cookies; no identity provider or authorization layer.
- **Vite** as the build/dev server.
- **mise** manages tools (Node, npm) and runs every task.
- **ESLint + Prettier** for lint/format, **svelte-check** for types, **Vitest +
  Testing Library** for tests, **logfmt** structured logging.

## Commands

All work flows through mise, which delegates to npm scripts:

| Task                        | Purpose                                    |
| --------------------------- | ------------------------------------------ |
| `mise run init`             | Install tools and dependencies             |
| `mise run dev`              | Migrate, preseed, and start the dev server |
| `mise run debug-chrome`     | Start the dev server with Chrome inspector |
| `mise run build`            | Production build                           |
| `mise run preview`          | Preview the production build               |
| `mise run deploy`           | Build and deploy to Cloudflare             |
| `mise run format`           | Format with Prettier                       |
| `mise run lint`             | Prettier check + ESLint                    |
| `mise run design-lint`      | Validate `DESIGN.md`                       |
| `mise run check`            | svelte-check type checking                 |
| `mise run test`             | Run all test suites                        |
| `mise run test-unit`        | Run Node unit tests                        |
| `mise run test-component`   | Run Svelte component tests                 |
| `mise run test-integration` | Run isolated local integration tests       |
| `mise run cache-reset`      | Clear local Workers KV cache entries       |
| `mise run db-migrate`       | Apply D1 migrations (local)                |
| `mise run db-preseed`       | Replace local D1 data with dummy data      |
| `mise run db-reset`         | Wipe local D1 and re-apply migrations      |

## Project layout (stable categories)

- `src/lib/server/` — server-only code: `database/` (Kysely), `kv/` (Workers
  KV), persistence adapters, application services, `logger`, and `logfmt`. Never
  import from here into client code.
- `src/lib/<domain>/` — framework-neutral shared schemas and domain types that
  are safe to use from both server and client code.
- `src/lib/site.ts` — static app identity (title, description, indexability).
- `src/routes/` — SvelteKit routes and endpoints (`+page`, `+layout`, `+server`).
- `src/lib/components/` — reusable Svelte components (built from daisyUI).
- `static/` — static assets.
- `scripts/` — local-only development scripts (migrate, preseed, cache reset,
  database reset).
- `mise.toml`, `wrangler.jsonc`, `svelte.config.js`, `vite.config.ts`,
  `vitest.config.ts`, `tsconfig.json`, `eslint.config.js`.

## Task naming

- Global lifecycle and quality tasks use unprefixed verbs (`dev`, `build`,
  `lint`). Scoped task families use a lowercase noun prefix and hyphen
  (`db-migrate`, `cache-reset`, `test-unit`, `debug-chrome`). Add new mise tasks
  to the appropriate family rather than introducing ambiguous bare verbs.

## OpenSpec workflow

- OpenSpec is the requirements source of truth. Specifications under
  `openspec/specs/` define current required behavior; active artifacts under
  `openspec/changes/` define proposed additions, modifications, and removals.
- Start every feature, bug fix, refactor, configuration change, schema change,
  API change, and behavior-affecting documentation task by reviewing all
  relevant canonical specs and active changes. Do this before designing or
  editing code so existing requirements are not broken through incomplete
  context.
- Work OpenSpec-first rather than coding behavioral changes directly. Use
  `/opsx-explore` to investigate ambiguity and cross-capability impact, then
  `/opsx-propose` to define requirement changes and implementation tasks. Use
  `/opsx-apply` only after the proposal is reviewable, `/opsx-verify` before
  considering implementation complete, and `/opsx-archive` after verification.
- When no relevant capability spec exists, add one through an OpenSpec proposal
  before implementing the behavior. A proposal must identify every affected
  capability, including indirect effects on security, persistence, logging,
  route behavior, and operational workflows.
- Never knowingly implement behavior that contradicts a canonical spec or an
  accepted active change. Modify the requirements through a proposal first and
  keep implementation, tests, documentation, and specs aligned.
- Purely mechanical changes that cannot affect behavior may proceed without a
  new proposal, but still require a spec and active-change review to confirm
  they are non-behavioral.
- Keep capability specifications durable and behavior-focused. Do not encode
  temporary initialization, repository-copying, or placeholder-removal concerns
  as product requirements.

## Working principles

- **KISS / YAGNI.** Build the simplest thing that works. Don't add abstractions,
  options, or dependencies for imaginary future needs.
- **SOLID.** Small, single-responsibility modules. Depend on abstractions, not
  concrete bindings.
- **DDD.** Put domain logic in pure, framework-agnostic modules under
  `src/lib/server/` (or `src/lib/`). Routes and endpoints are thin adapters that
  parse input, call domain functions, and shape output. Keep framework-coupled
  code (`$app/*`, bindings, `fetch`) at the edges, not in the core.
- **Dependency injection.** Pass dependencies (the database, clients, config) as
  parameters so they can be mocked in tests. Don't reach for globals inside
  domain functions.
- **Stay focused.** Make the requested change. Don't refactor unrelated code in
  the same change. Check for existing utilities before creating new ones.

## SvelteKit & Svelte 5 conventions

- **Runes only.** Use `$state`, `$derived`, `$props()`, `$bindable()`, `$effect`.
  Never Svelte 4 syntax: no `export let`, no `$:` reactive declarations, no
  `on:click` directives, no `createEventDispatcher`, no `<slot>`.
- **`$derived` for computed values; never `$effect`.** Don't use `$effect` to
  assign a value that could be derived. Use `$effect` only for side effects, and
  always return a cleanup function for subscriptions/listeners.
- **Type props.** Components use an `interface Props` + `let { … }: Props =
$props()`. Routes use the generated `PageProps` / `LayoutProps` from
  `./$types` — never untyped `$props()` in a page or layout.
- **Events are HTML attributes.** `onclick`, not `on:click`. There are no event
  modifiers — call `event.preventDefault()` / `stopPropagation()` inside the
  handler. Component-to-parent communication uses callback props, not
  `createEventDispatcher`.
- **Snippets, not slots.** `let { children } = $props()` and `{@render
children?.()}`; use optional chaining for optional snippets.
- **Data loading boundaries.** Secrets, D1, KV, and private env belong in
  `+page.server.ts` / `$lib/server` — never in universal `+page.js` (which also
  runs in the browser). Use `+page.server.ts` loads for data and form actions
  for mutations; don't fetch client-side for page data.
- **Forms.** Use Superforms with Zod for form state and validation. Define each
  schema at module scope in its domain package, initialize it with
  `superValidate`, return
  `fail(400, { form })` when invalid, and use Superforms' `message` helper for
  successful actions. On the client, use `superForm` and its `enhance` action;
  don't hand-roll form state or use SvelteKit's raw `enhance` action directly.
  Use `throw error(status, …)` for unexpected errors and
  `throw redirect(status, …)` for auth/redirects.
- **Data tables.** Use `@humanspeak/svelte-headless-table` and its plugins for
  filtering, sorting, pagination, selection, and other table state; don't
  implement these behaviors manually. Use client-side plugins only for bounded,
  already-loaded datasets. For large or remote datasets, use server-side plugin
  mode and keep query state in the URL. Render semantic table markup, preserve
  accessible labels and sort state, and style it with daisyUI table primitives.
  Columns are initialization-time structure; rows may update reactively. Remount
  the component when changing the column structure.
- **SSR safety.** Never store per-user data in module-level `let` or global
  `$state` — it leaks across requests on the server. Per-user data flows through
  `event.locals` and is returned from `load`. (App-wide singletons like the
  shared DB client are fine.)
- **Performance.** Parallelize independent async work with `Promise.all`, and
  stream non-critical data by returning un-awaited promises from `load`. Don't
  reimplement in `$effect` what Svelte can do declaratively (`{#if}`, class
  bindings).

## Logging

- Use the structured logger from `$lib/server/logger` — it emits logfmt lines
  (message, level, timestamp, then `key=value` context).
- **Never use raw `console.log`/`console.error` in application code.** Use the
  logger at the appropriate level (`debug`/`info`/`warn`/`error`).
- Access logs are handled centrally in `hooks.server.ts`; don't re-log requests
  in routes.
- Keep application-defined log messages and context keys stable and lowercase.
  Access-log messages preserve the uppercase HTTP method.
- Never log passwords, password hashes, JWTs, cookies, or authentication
  secrets. Use generic login-failure responses that do not reveal whether a
  username exists.

## Authentication

- Authentication is optional and disabled unless `AUTH_ENABLED`, after trimming
  and case normalization, is `true`. Enabled deployments require a server-only
  `AUTH_SECRET` of at least 32 bytes. Never expose the secret through an `APP_`
  variable or client module.
- Every new route must deliberately choose its access boundary. Browser pages
  requiring login belong under `src/routes/(protected)/`; the hook redirects
  unauthenticated requests to `/login`. Protected `+server.ts` endpoints belong
  under `src/routes/(protected-api)/`; the hook returns `401`. Routes outside
  those groups are public.
- Protection is enforced in `hooks.server.ts`, not only in layouts, components,
  or hidden navigation. Use `event.locals.user` as the authenticated safe user
  projection. Never trust a browser-provided user identifier.
- Protected page layouts and endpoints must explicitly set `prerender = false`.
  Static output bypasses server hooks and must never contain protected content.
- Protected routes must still work when authentication is disabled, where
  `event.locals.user` is `null`. Authentication establishes identity only; do
  not add roles, permissions, or other authorization behavior unless requested.
- Hash all stored passwords through `$lib/server/auth/password`; never store,
  compare, log, or seed plaintext passwords in the database. Keep usernames in
  canonical lowercase form and return generic invalid-credential errors.
- Session cookies are `HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS, and scoped
  to `/`. JWT payloads contain only the user ID, username, issued time, and
  expiration. Keep login return paths same-origin and make logout a POST action.
- There are intentionally no registration, password-reset, user-admin, or
  authorization screens. Production user provisioning is application-specific;
  never run development preseed against remote bindings.
- PBKDF2 verification is intentionally expensive. Production applications must
  apply platform edge rate limiting to login attempts and select a Worker CPU
  limit based on measured verification time; do not weaken the password work
  factor to solve capacity issues.

## Debugging

- Keep [`.vscode/launch.json`](.vscode/launch.json) source-controlled and
  functional. It is the required breakpoint configuration for both VS Code and
  Google Chrome.
- For VS Code breakpoints, use **Run and Debug** and launch `SvelteKit: VS Code
breakpoints` with `F5`. It runs `mise run dev` in VS Code's debug terminal and
  supports client and server source breakpoints.
- For Google Chrome, launch `SvelteKit: Chrome breakpoints`. It
  starts `mise run debug-chrome` with Node inspection and a dedicated Chrome
  debug profile. Alternatively, run `mise run debug-chrome`, open
  `chrome://inspect`, and select the dedicated Node DevTools target.
- Use breakpoint debugging for runtime issues before adding diagnostic logging.
  Never commit temporary breakpoints, `debugger` statements, or generated Chrome
  profiles. `.vscode/chrome-debug-profile/` is local-only.

## Storage

### D1 and Kysely

- D1 is the relational source of truth. Access it through `event.locals.db` and
  **Kysely** (`src/lib/server/database/`), never through raw D1 or raw SQL. It is
  server-only. Keep Kysely queries in repository modules rather than routes;
  application services depend on narrow repository interfaces.
- **Migrations are TypeScript** using Kysely's schema builder — never raw SQL
  files. Each migration lives in `migrations/NNNN_name.ts` and is registered in
  `migrations/index.ts`. Give every migration a `down` if you want it to support
  `mise run db-reset`.
- Migration `0001_initial` is the current baseline migration. Do not rewrite it
  or any later applied migration; introduce a new numbered migration so
  existing databases can upgrade safely.
- Migrations run automatically before the first request and on demand via
  `mise run db-migrate`. Initialization is single-flight per Worker isolate,
  migration failures fail the request and are retried on the next request.
- `mise run dev` applies migrations and then preseed data before Vite starts.
  Preseeding is destructive: it clears every application table in dependency
  order and inserts representative, useful dummy records. Run the same behavior
  manually with `mise run db-preseed`.
- Every database schema change must update `scripts/database/preseed.ts` in the
  same change. Add every new table to the complete deletion order and add seed
  records for new tables, required columns, and relationships without waiting
  for a separate request. Keep data varied but bounded and useful for exercising
  the application.
- Keep preseed code under `scripts/` and never import it from application code,
  ensuring production builds cannot include or execute it. Preseed only local
  Wrangler bindings with `remoteBindings: false`. Use Kysely for deletion and
  insertion rather than raw SQL.
- D1 does not support the transactions or cross-isolate locks expected by
  Kysely's SQLite migrator. Every migration must therefore be replay-safe; use
  `ifNotExists`, conflict handling, and other idempotent operations where needed.
- The custom D1 introspector supports Kysely migration discovery only. General
  `db.introspection` calls fail explicitly because Workers-bound D1 does not
  expose the PRAGMA metadata required for a correct result.
- Wrangler provides a local D1 database under `.wrangler/`; production requires
  replacing the `database_id` placeholder in `wrangler.jsonc`. Local scripts
  must set `remoteBindings: false` explicitly.

### Workers KV

- Access KV through the namespaced JSON store at `event.locals.kv`, implemented
  in `src/lib/server/kv/`; do not scatter direct `event.platform.env.KV` calls.
- Use versioned domain keys such as `sessions:v1:<token>` or `cache:v1:<id>` and
  expiration for temporary data. KV has no migrations; introduce a new key
  version when stored shapes change.
- KV is eventually consistent and read-optimized. Use it for caches,
  configuration, preferences, allow-lists, and session records where delayed
  invalidation is acceptable. Never use it for atomic counters, locks,
  transactions, or immediate global session revocation.
- Session keys must be high-entropy, live only in secure cookies, and have an
  explicit expiration. Do not put secrets or KV values into client code unless
  the route intentionally returns a safe projection. Validate stored JSON at
  the domain boundary before trusting security-sensitive fields.
- Wrangler provides local, persistent KV under `.wrangler/` during development;
  never enable remote bindings by default.
- `mise run cache-reset` deletes only `app:cache:` keys from local Wrangler KV;
  it preserves other application KV domains. Keep this script under `scripts/`,
  require `remoteBindings: false`, and never use it against remote storage.
- Unit tests mock D1 and KV. Local integration tests may use ephemeral Wrangler
  D1 and KV bindings only with persistence and remote bindings disabled.

## Verification gates (mandatory)

- After application or configuration changes, run `mise run format`,
  `mise run lint`, `mise run check`, and `mise run test`. Documentation-only
  changes may omit tests.
- A **pre-commit hook** automatically runs `format`, `lint`, `check`, and the
  complete test suite on every commit and aborts on failure. Never bypass it
  with `--no-verify`.
- Do not consider work done until all gates pass. Type errors and lint failures
  are not acceptable.

## Dependency policy

- Ask before adding, removing, or upgrading dependencies.
- Prefer the Node standard library and packages already in the repo over new
  ones. Pin every npm dependency to an exact version; range constraints such as
  `^`, `~`, `>`, `<`, or `*` are not allowed.
- npm blocks install scripts by default; if a newly added native dependency
  needs one, add it under `allowScripts` in `package.json`.

## Escalation triggers (ask first)

- Adding, removing, or upgrading dependencies.
- Deploying to Cloudflare, changing remote D1/KV data, or running any destructive
  command against remote storage. (`mise run db-reset` is local-only — never assume
  it is safe to run remotely.)
- Changing the on-disk migration format, the wrangler bindings, or the public
  task/CLI surface (`mise.toml`, npm scripts).

## Testing

- **Test-first (TDD)** for new logic and bug fixes: write the smallest meaningful
  failing test, implement, and refactor while it stays green. Do not describe
  tests written after implementation as TDD.
- Node unit tests sit beside modules as `*.test.ts`. They cover validation,
  services, state transitions, error handling, and storage orchestration with
  fakes or mocks; they never require Workers, D1, KV, or network access.
- Unit tests are the default focus for application logic. Prefer them over
  integration tests whenever a behavior can be tested through a narrow seam.
- Svelte component tests use `*.component.test.ts`, Testing Library, and jsdom.
  Test accessible markup and application-owned event wiring, not Svelte,
  daisyUI, Superforms, or headless-table internals.
- Local integration tests live under `tests/integration/`. They may use Wrangler
  bindings only with `persist: false` and `remoteBindings: false`; they must be
  deterministic, isolated, and incapable of touching Cloudflare resources.
- Run integration tests only through `mise run test-integration`; do not invoke
  the underlying npm or Vitest command directly. Add integration coverage only
  when real framework, binding, migration, or adapter wiring is the behavior
  under test; do not create broad integration coverage by default.
- Do not duplicate dependency test suites. Test this application's schema
  policy and wrapper contracts, not Zod coercion mechanics, Kysely SQL text,
  Superforms serialization, or headless-table algorithms.
- Keep I/O behind narrow interfaces and inject clocks, identifiers, and stores
  when their behavior matters. Routes and components remain thin adapters.
- `mise run test` runs all three suites through their mise tasks and is mandatory
  for application changes. Focused unit or component work may use
  `mise run test-unit` or `mise run test-component` during iteration.

## UI work — read DESIGN.md first

- **Before any UI change, read [DESIGN.md](DESIGN.md).** It is the design
  contract and a mandatory check for UI work.
- **DESIGN.md follows the official [design.md format spec](https://github.com/google-labs-code/design.md).**
  It is YAML design tokens (front matter) plus markdown rationale — not free
  text. Treat the tokens as the normative design values. When `DESIGN.md` is
  changed, run `mise run design-lint` (must pass with no errors). The pre-commit
  hook runs this task automatically when the file is staged.
- **Always use daisyUI components.** Never use a raw element (`<button>`,
  `<div>` card, hand-rolled modal, etc.) when a daisyUI component exists.
  Tailwind utilities are for layout/spacing; daisyUI is for components and
  theming. If no daisyUI component fits, compose the smallest possible wrapper
  from daisyUI primitives as a Svelte component under `src/lib/components/` — not
  from raw elements.
- Use daisyUI semantic color tokens (`text-primary`, `bg-base-200`, …). Do not
  hardcode hex colors in markup; if a new value is needed, add it as a token in
  `DESIGN.md` first.
- Preserve accessibility: keep daisyUI's ARIA roles and keyboard behavior, and
  keep theming working in all configured themes.
- Theme/token changes happen in two places that must stay in sync: the daisyUI
  theme in `src/app.css` and the tokens in `DESIGN.md`.

## Git workflow

- **Conventional commits** (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`,
  `chore:`, `build:`, …), lowercase, with a concise imperative subject and a
  bulletted body for anything non-trivial.
- **Every commit must be GPG-signed and signed off.** Always commit with
  `git commit -S -s` — `-S` produces a verified GPG signature and `-s` adds the
  `Signed-off-by:` trailer. Never use `--no-verify`, `--no-gpg-sign`, or commit
  without signing. (This is in addition to the pre-commit hook, which runs the
  format/lint/check gates.)
- **Commit often.** Each commit is one logical, reviewable unit. Don't wait until
  a feature is "completely finished" to start committing — commit as soon as a
  coherent change stands on its own. Equally, don't batch unrelated changes into
  one commit.
- Don't commit during speculative exploration or while debugging blindly.
- Include the required attribution trailers on every commit: `Signed-off-by:`
  (from `-s`) and a `Co-Authored-By:` trailer identifying the model used for
  the change with its provider-associated email address (for example,
  `Co-Authored-By: GPT-5.6-Luna <noreply@openai.com>` when using GPT-5.6-Luna).

## Maintenance

- **`AGENTS.md` is non-volatile.** It holds principles and conventions, not
  version pins, exact dependency lists, or file inventories. Update it only when
  a convention itself changes — not for ordinary feature work.
- **Keep stable docs accurate.** Update `README.md` when setup, commands, or
  supported runtimes change. Update `DESIGN.md` when the UI rules change. Don't
  let them drift from the code.
