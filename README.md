# Midas

Midas is a private, mobile-first application for organizing shared household
expenses and balances. It runs on SvelteKit and Cloudflare Workers with D1 and
KV storage.

## Stack

- **SvelteKit 2** + **Svelte 5** (runes)
- **Vite 8** with the devtools-json plugin
- **Tailwind CSS v4** (CSS-first, via the `@tailwindcss/vite` plugin) with **daisyUI** components
- **Superforms + Zod** for schema-driven forms and **Svelte Headless Table** for data grids
- **Cloudflare Workers** deployment via `@sveltejs/adapter-cloudflare` + Wrangler
- **Cloudflare D1** database accessed through the **Kysely** ORM with code-based migrations
- **Cloudflare KV** for globally distributed caches, configuration, preferences, and session data
- **Internal authentication** with PBKDF2 password hashes and signed JWT cookies
- **TypeScript 6** in strict mode with `svelte-check`
- **Prettier** + **ESLint 10** (flat config) for formatting and linting
- **mise** for tool and task management (Node.js 26 + npm 12)

## Prerequisites

- [mise](https://mise.jdx.dev/) — pins Node.js and npm and runs all tasks.

Node.js and npm versions are declared in `mise.toml`. mise installs them
automatically on first use.

## Getting started

```sh
mise run init   # install mise tools and npm dependencies
mise run dev    # start the Vite dev server
```

The dev server runs on `http://localhost:5173`. Startup applies pending local D1
migrations, clears every application table, and inserts useful development data.

## Debugging

Breakpoint configurations are committed in [`.vscode/launch.json`](.vscode/launch.json).

### Visual Studio Code

Open **Run and Debug**, select `SvelteKit: VS Code breakpoints`, and press `F5`.
VS Code starts `mise run dev` in its JavaScript debug terminal, allowing
breakpoints in both client and server SvelteKit source.

### Google Chrome

In VS Code, select `SvelteKit: Chrome breakpoints` to start the
inspected development server and a separate Chrome debug profile. Set client
breakpoints in VS Code or Chrome DevTools source maps.

Outside VS Code, run:

```sh
mise run debug-chrome
```

Then open `chrome://inspect` in Chrome and select the dedicated Node DevTools
target. Open `http://localhost:5173` in Chrome to debug client source maps.

## Tasks

All tasks are run through mise, which delegates to the underlying npm scripts
defined in `package.json`.

| Task                        | Description                             |
| --------------------------- | --------------------------------------- |
| `mise run init`             | Install mise tools and npm dependencies |
| `mise run dev`              | Start the Vite dev server               |
| `mise run build`            | Build for production                    |
| `mise run preview`          | Preview the production build locally    |
| `mise run deploy`           | Build and deploy to Cloudflare Workers  |
| `mise run lint`             | Run Prettier checks and ESLint          |
| `mise run format`           | Format the codebase with Prettier       |
| `mise run design-lint`      | Validate `DESIGN.md`                    |
| `mise run check`            | Run `svelte-check` type checking        |
| `mise run test`             | Run all test suites                     |
| `mise run test-unit`        | Run Node unit tests                     |
| `mise run test-component`   | Run Svelte component tests              |
| `mise run test-integration` | Run isolated local integration tests    |
| `mise run cache-reset`      | Clear local Workers KV cache entries    |
| `mise run db-migrate`       | Run D1 migrations against the local DB  |
| `mise run db-preseed`       | Replace local D1 data with dummy data   |
| `mise run db-reset`         | Wipe local D1 and re-apply from scratch |

## Environment variables

Only values that change between environments live in env vars. Copy the example
file and adjust:

```sh
cp .env.example .env
```

| Variable               | Purpose                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `APP_BASE_URL`         | Canonical base URL (local dev vs production)                                          |
| `BOOTSTRAP_CREDENTIAL` | Server-only one-time setup credential (≥32 bytes; remove after first setup)           |
| `RECOVERY_CREDENTIAL`  | Server-only operator recovery credential (≥32 bytes; single-use; disabled by default) |

Static app identity — title, description, author, keywords, and theme color —
lives in [`src/lib/site.ts`](src/lib/site.ts), not in env vars.

Bootstrap and recovery credentials are server-only and must never be exposed to
client code, logs, or activity metadata. Remove or rotate the bootstrap
credential after the initial setup is complete.

## Authentication

Authentication is mandatory. There is no disabled-authentication bypass mode.
Every request to a protected route validates a server-side session against D1.

Passwords use PBKDF2-HMAC-SHA256 with 600,000 iterations and a unique 16-byte
salt. Passwords must be 12–128 characters. Login failures use the same response
whether the username is missing or the password is wrong.

Sessions use cryptographically random 256-bit bearer tokens stored only in
secure cookies. The server stores a SHA-256 digest — never the bearer token
itself. Every protected request validates the digest, user active state, and
household relationship against D1. Sessions expire after eight hours and rotate
their bearer token once after four hours. Disabling a user, resetting a
password, or explicitly revoking a session takes effect immediately on the next
request.

Development preseeding creates this local-only account on every server start:

```text
username: developer
password: development-password
```

Never use that account or password in production. Use the one-time `/setup` flow
with `BOOTSTRAP_CREDENTIAL` configured to create the first household and
administrator.

### Protecting routes

Route groups make protection explicit without changing public URLs:

- Put browser pages under `src/routes/(protected)/`. Unauthenticated requests
  redirect to `/login` and preserve a safe local return path.
- Put server endpoints under `src/routes/(protected-api)/`. Unauthenticated
  requests receive `401 Authentication required`; `/api/session` is the included
  example.
- Keep routes outside those groups when they must remain public. `/login`,
  `/setup`, `/recuperacion`, `/robots.txt`, and `/site.webmanifest` are public.

Users with `requires_password_change` are restricted to password change, logout,
and supporting routes until they set a new password.

### Credential administration

Active household administrators can create users, designate administrators,
disable and reactivate users, reset passwords, and revoke sessions. Every
household must retain at least one active administrator. All credential
operations append durable activity events that never store passwords, hashes, or
tokens.

### Operator-assisted recovery

When all administrators lose access, a deployment operator can enable the
`/recuperacion` route by setting `RECOVERY_CREDENTIAL` (≥32 bytes). Each
credential can be used only once to reactivate one administrator with a forced
temporary password. The recovery is audited.

For production, provision `BOOTSTRAP_CREDENTIAL` and optionally
`RECOVERY_CREDENTIAL` with Cloudflare Secrets. Apply edge rate limiting to
`POST /login`, `POST /setup`, and `POST /recuperacion`. Configure a Worker CPU
limit that accommodates password verification at the required work factor.

## Testing

`mise run test` runs three isolated Vitest suites:

- Node unit tests beside source modules as `*.test.ts`.
- Svelte component tests as `*.component.test.ts` using Testing Library and
  jsdom.
- Local D1 and KV integration tests under `tests/integration/` using Wrangler
  with persistence and remote bindings disabled.

The integration suite creates ephemeral local D1 and KV bindings and cannot
access production resources. The pre-commit hook runs the complete suite
together with formatting, linting, and type checks.

### Search engine visibility

Apps are **private by default**: `site.indexable` is `false`, which emits
`noindex,nofollow` and serves `Disallow: /` from `/robots.txt`. To make an app
public, flip the flag in `src/lib/site.ts`:

```ts
export const site = {
	// ...
	indexable: true,
} as const;
```

This single switch updates both the robots meta tag and the `robots.txt` route.

## Database (D1)

Midas uses Cloudflare D1 through the Kysely ORM, including
a migrations framework and the internal `users` table. Migrations are written
in TypeScript using Kysely's schema builder — never raw SQL.

The current `0001_initial` replaced the earlier disposable counter migration.
Existing local checkouts from that earlier revision must run `mise run db-reset`
once. It is now the baseline migration: do not rewrite it or any later applied
migration; add a new numbered migration instead.

### Local development

In `vite dev`, the `adapter-cloudflare` platform proxy exposes the D1 binding
(`event.platform.env.DB`) backed by a local SQLite database stored under
`.wrangler/`. Before Vite starts, the development command applies pending
migrations and replaces all application data with useful dummy records. The
preseed is intentionally destructive and runs on every development server
start, keeping the local database predictable without manual setup.

Migrations also run automatically on the first request after a server start as
a runtime safeguard. Concurrent requests in one Worker isolate share the same
initialization. A migration failure fails the request and is retried rather than
silently serving against a stale schema.

To run migrations explicitly against the local database (without starting the
dev server):

```sh
mise run db-migrate
```

To clear every application table and insert fresh development data manually:

```sh
mise run db-preseed
```

The preseed command applies pending migrations first, uses Kysely rather than
raw SQL, and always disables remote bindings. It recreates the local development
user documented above. Its implementation lives entirely under `scripts/`;
application code does not import it, so production builds and deployments
neither execute nor bundle development seed logic.

To wipe the local database and re-apply every migration from scratch (handy
during development):

```sh
mise run db-reset
```

This rolls all migrations back through their `down` methods and re-applies them,
so each migration must have a `down`; reset aborts before changing the database
if an irreversible migration is registered. All database scripts explicitly
disable remote bindings.

### Writing migrations

Add a new migration file in `src/lib/server/database/migrations/` using the
`NNNN_name.ts` convention, then register it in `migrations/index.ts`:

```ts
import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";

export const example: Migration = {
	async up(db: Kysely<any>): Promise<void> {
		await db.schema
			.createTable("example")
			.ifNotExists()
			.addColumn("id", "integer", (col) => col.primaryKey())
			.execute();
	},
};
```

The Kysely schema builder keeps every schema change type-checked and SQL-free.
Migrations are bundled into the Worker (no filesystem access at runtime), so
they also run on cold starts in production. D1 cannot provide transactions or
cross-isolate migration locks through this dialect, so every migration must be
safe to retry. Use `ifNotExists`, conflict handling, and equivalent idempotent
operations where needed.

The D1 dialect exposes only the table discovery required by Kysely migrations.
General Kysely schema introspection throws explicitly because Workers-bound D1
does not expose the PRAGMA metadata needed to return correct column details.

### Production

Before deploying, create a real D1 database and set its id in `wrangler.jsonc`:

```sh
mise exec -- npx wrangler d1 create midas   # copy the printed database_id
```

Replace the `database_id` placeholder in `wrangler.jsonc`, then `mise run deploy`.
Migrations are applied automatically on the first request after each deploy.

## Key-value storage (KV)

The `KV` binding is exposed by Wrangler as `event.platform.env.KV`. The server
hook wraps it as a namespaced JSON store at `event.locals.kv`, so routes and
server modules share serialization and key conventions instead of calling the
raw binding directly:

```ts
import { z } from "zod";

const sessionSchema = z.object({ userId: z.string() });
const stored = await locals.kv?.get<unknown>(`sessions:v1:${token}`);
const parsed = sessionSchema.safeParse(stored);
const session = parsed.success ? parsed.data : null;
await locals.kv?.put(`sessions:v1:${token}`, { userId }, { expirationTtl: 3600 });
await locals.kv?.delete(`sessions:v1:${token}`);
```

The wrapper adds the `app:` prefix. Callers must add a domain and version,
such as `sessions:v1:` or `cache:v1:`, and use expiration for temporary values.
KV has no schema migrations; evolve key formats by introducing a new versioned
prefix and deleting old keys when they are no longer needed.

### Local development

The adapter-cloudflare platform proxy provides a local KV implementation during
`mise run dev`. Values persist under `.wrangler/` and never touch production KV,
so the placeholder namespace id in `wrangler.jsonc` is enough for development.
The isolated cache module and its unit tests demonstrate a five-minute
read-through entry without exposing development diagnostics in product screens.

Clear local cached values without changing other local KV domains with:

```sh
mise run cache-reset
```

This deletes every key under the application cache prefix (`app:cache:`) from
the local Wrangler binding only. It preserves non-cache keys such as preferences
and never enables remote bindings.

### Consistency and sessions

Workers KV is optimized for read-heavy workloads and is eventually consistent.
Writes, updates, and deletes may take 60 seconds or more to become visible in
other locations. It is appropriate for caches, configuration, preferences,
allow-lists, and expiring session records when delayed invalidation is
acceptable. Do not use KV for counters, locks, transactions, write-heavy data,
or security flows that require immediate global revocation; use D1 or another
coordination mechanism instead. Session identifiers must be high-entropy,
stored only in secure cookies, and paired with explicit KV expiration.

### Production

Create the production namespace before deployment:

```sh
mise exec -- npx wrangler kv namespace create KV   # copy the printed id
```

Replace the KV `id` placeholder in `wrangler.jsonc`. Deployment requires both
the real D1 database id and KV namespace id.

## Logging

Structured logs are emitted in [logfmt](https://brandur.org/logfmt) — `key=value`
pairs with the message first — and are written to the console, so they appear in
the Vite dev terminal and in Cloudflare logs (`wrangler tail` / Workers
observability).

```
msg="GET /" level=info ts=2026-08-03T16:39:55.000Z method=GET path=/ status=200 duration_ms=15
```

Access logging is built into `hooks.server.ts`: every request logs its method,
path, status, and duration, with the level rising to `warn` (4xx) and `error`
(5xx). Internal events (e.g. migrations) are logged the same way.

Use the logger from any server module:

```ts
import { logger } from "$lib/server/logger";

logger.info("user created", { id: 42 });
logger.error("payment failed", { reason: "insufficient_funds" });
```

Levels are `debug`, `info`, `warn`, and `error`. `debug` is only shown in
development; `info` and above are shown everywhere.

## Project structure

```
mise.toml              tool pins and task definitions
svelte.config.js       adapter-cloudflare + APP_ env prefix
vite.config.ts         sveltekit plugin and dev server
wrangler.jsonc         cloudflare workers deployment config
tsconfig.json          strict typescript configuration
eslint.config.js       eslint flat config
vitest.config.ts       node unit test configuration
vitest.component.config.ts  jsdom component test configuration
vitest.integration.config.ts local Wrangler integration test configuration
src/
  app.html             html shell
  app.d.ts             app type declarations (Locals, Platform)
  app.css              tailwind import and daisyui plugin
  hooks.server.ts      initializes storage, authentication, route guards, and access logs
  lib/auth/            shared login schema and safe authenticated-user type
  lib/site.ts          site metadata, manifest settings, and indexability flag
  lib/components/      reusable daisyUI components, including login and data table UI
  lib/server/auth/     password hashing, JWT sessions, users repository, and guards
  lib/server/logger.ts structured logfmt logger
  lib/server/database/ kysely orm layer
    schema.ts          table and database types
    db.ts              d1-backed kysely client factory
    d1-dialect.ts      d1-safe dialect and introspector
    migrator.ts        kysely migrator (transactions disabled for d1)
    migrations/        code-based migration files + index registry
  lib/server/kv/       namespaced JSON wrapper for Cloudflare KV
  lib/server/cache/    read-through cache policies
  routes/
    +layout.svelte     layout with seo meta tags
    (protected)/       authenticated browser pages; redirects to login
    (protected-api)/   authenticated server endpoints; returns 401
    (public)/login/    public username/password login page
    +error.svelte      error page
    robots.txt/        dynamic robots.txt driven by site.indexable
    site.webmanifest/  dynamic manifest driven by site metadata
scripts/
  migrate-db.ts        standalone migration runner (local d1 via platform proxy)
  preseed-db.ts        local-only user preseed runner
  reset-cache.ts       local Workers KV cache reset runner
  reset-db.ts          local migration rollback and replay runner
static/                favicon assets
```

## Customizing for a new application

1. Update `name` and `version` in `package.json` and `wrangler.jsonc`.
2. Edit `src/lib/site.ts` to set the app metadata, web manifest settings, and
   whether it should be `indexable`.
3. Rename the `APP_` env prefix everywhere if a project-specific prefix is
   preferred (`svelte.config.js`, `vite.config.ts`, `.env.example`, and
   `$env/static/public` references in routes).
4. Replace `static/favicon.svg`.

## Deployment

Deployment targets Cloudflare Workers via Wrangler. Authenticate with
`npx wrangler login` once, then:

```sh
mise run deploy
```

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for
details.
