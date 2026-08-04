import { error, redirect, type Handle } from "@sveltejs/kit";
import { building } from "$app/environment";
import { createLoginRedirect, protectedRouteKind } from "$lib/server/auth/guard";
import {
	SESSION_COOKIE_NAME,
	resolveRequestSession,
	sessionCookieOptions,
	type RequestSession,
} from "$lib/server/auth/request";
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
	initializeDatabase(binding: D1Database | undefined): Promise<Kysely<Database>>;
	isBuilding(): boolean;
	resolveSession?: (db: Kysely<Database>, token: string | undefined) => Promise<RequestSession>;
}

export function createRequestHandle({
	accessLogger,
	initializeDatabase,
	isBuilding,
	resolveSession = resolveRequestSession,
}: RequestHandleDependencies): Handle {
	return async ({ event, resolve }) => {
		const start = performance.now();
		let status = 500;

		try {
			event.locals.user = null;
			event.locals.sessionId = null;

			if (isBuilding() && protectedRouteKind(event.route.id)) {
				error(500, "Protected routes cannot be prerendered");
			}

			if (!isBuilding()) {
				const environment = event.platform?.env;
				event.locals.db = await initializeDatabase(environment?.DB);
				const namespace = environment?.KV;
				event.locals.kv = namespace ? createKeyValueStore(namespace, "app") : undefined;

				const requestSession = await resolveSession(event.locals.db, event.cookies.get(SESSION_COOKIE_NAME));
				event.locals.user = requestSession.user;
				event.locals.sessionId = requestSession.sessionId;

				if (requestSession.clearCookie) {
					event.cookies.delete(SESSION_COOKIE_NAME, {
						path: "/",
						httpOnly: true,
						sameSite: "lax",
						secure: event.url.protocol === "https:",
					});
				}
				if (requestSession.rotatedToken) {
					event.cookies.set(
						SESSION_COOKIE_NAME,
						requestSession.rotatedToken,
						sessionCookieOptions(event.url.protocol === "https:"),
					);
				}

				if (!event.locals.user) {
					const routeKind = protectedRouteKind(event.route.id);
					if (routeKind === "page") redirect(303, createLoginRedirect(event.url));
					if (routeKind === "api") error(401, "Autenticación obligatoria");
				} else if (event.locals.user.requiresPasswordChange) {
					const allowedDuringForced = ["/(protected)/cambiar-contrasena", "/(protected)/logout"];
					if (!allowedDuringForced.includes(event.route.id ?? "")) {
						redirect(303, "/cambiar-contrasena");
					}
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
	initializeDatabase,
	isBuilding: () => building,
});
