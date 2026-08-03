import { error, redirect, type Handle } from "@sveltejs/kit";
import { building } from "$app/environment";
import { env } from "$env/dynamic/private";
import { readAuthConfig } from "$lib/server/auth/config";
import { createLoginRedirect, protectedRouteKind } from "$lib/server/auth/guard";
import { SESSION_COOKIE_NAME, resolveRequestSession, sessionCookieOptions } from "$lib/server/auth/request";
import { createDatabase, runMigrations, type Database } from "$lib/server/database";
import { createDatabaseInitializer } from "$lib/server/database/initializer";
import { createKeyValueStore } from "$lib/server/kv";
import { logger, type LogLevel } from "$lib/server/logger";
import type { D1Database } from "@cloudflare/workers-types";
import type { Kysely } from "kysely";

const initializeDatabase = createDatabaseInitializer({
	createClient: createDatabase,
	async migrate(db: Kysely<Database>) {
		try {
			const result = await runMigrations(db);
			const applied = result.results?.filter((migration) => migration.status === "Success").length ?? 0;
			if (applied > 0) logger.info("database migrated", { migrations: applied });
		} catch (error) {
			logger.error("database migration failed", {
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	},
	dispose: (db) => db.destroy(),
});

function statusLevel(status: number): LogLevel {
	if (status >= 500) return "error";
	if (status >= 400) return "warn";
	return "info";
}

interface RequestHandleDependencies {
	accessLogger: Pick<typeof logger, "log">;
	getPrivateEnvironment(): Record<string, string | undefined>;
	initializeDatabase(binding: D1Database | undefined): Promise<Kysely<Database>>;
	isBuilding(): boolean;
}

export function createRequestHandle({
	accessLogger,
	getPrivateEnvironment,
	initializeDatabase,
	isBuilding,
}: RequestHandleDependencies): Handle {
	return async ({ event, resolve }) => {
		const start = performance.now();
		let status = 500;

		try {
			event.locals.auth = { enabled: false };
			event.locals.user = null;

			if (isBuilding() && protectedRouteKind(event.route.id)) {
				error(500, "Protected routes cannot be prerendered");
			}

			if (!isBuilding()) {
				const environment = event.platform?.env;
				event.locals.db = await initializeDatabase(environment?.DB);
				const namespace = environment?.KV;
				event.locals.kv = namespace ? createKeyValueStore(namespace, "app") : undefined;
				const privateEnvironment = getPrivateEnvironment();
				event.locals.auth = readAuthConfig({
					AUTH_ENABLED: privateEnvironment["AUTH_ENABLED"] ?? environment?.AUTH_ENABLED,
					AUTH_SECRET: privateEnvironment["AUTH_SECRET"] ?? environment?.AUTH_SECRET,
				});

				const requestSession = await resolveRequestSession(event.locals.auth, event.cookies.get(SESSION_COOKIE_NAME));
				event.locals.user = requestSession.user;

				if (requestSession.clearCookie) event.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
				if (requestSession.refreshedToken) {
					event.cookies.set(
						SESSION_COOKIE_NAME,
						requestSession.refreshedToken,
						sessionCookieOptions(event.url.protocol === "https:"),
					);
				}

				if (event.locals.auth.enabled && !event.locals.user) {
					const routeKind = protectedRouteKind(event.route.id);
					if (routeKind === "page") redirect(303, createLoginRedirect(event.url));
					if (routeKind === "api") error(401, "Authentication required");
				}
			}

			const response = await resolve(event);
			status = response.status;
			return response;
		} catch (error) {
			if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") {
				status = error.status;
			}
			throw error;
		} finally {
			accessLogger.log(statusLevel(status), `${event.request.method} ${event.url.pathname}`, {
				method: event.request.method,
				path: event.url.pathname,
				status,
				duration_ms: Math.round(performance.now() - start),
			});
		}
	};
}

export const handle = createRequestHandle({
	accessLogger: logger,
	getPrivateEnvironment: () => env,
	initializeDatabase,
	isBuilding: () => building,
});
