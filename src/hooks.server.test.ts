import { isHttpError, isRedirect } from "@sveltejs/kit";
import { describe, expect, it, vi } from "vitest";
import { createRequestHandle } from "./hooks.server";
import type { Kysely } from "kysely";
import type { Database } from "$lib/server/database/schema";
import type { RequestSession } from "$lib/server/auth/request";

const noopDb = {} as Kysely<Database>;
const noopLogger = { log: vi.fn() };
const noopDbInit = vi.fn().mockResolvedValue(noopDb);

function mockResolveSession(result: RequestSession) {
	return vi.fn().mockResolvedValue(result);
}

const AUTHED_USER = {
	id: "user-1",
	username: "developer",
	householdId: "hh-1",
	isAdministrator: true,
	requiresPasswordChange: false,
	memberId: "member-1",
};

function createEvent(routeId = "/", pathname = "/") {
	return {
		request: new Request(`https://midas.example${pathname}`),
		url: new URL(`https://midas.example${pathname}`),
		route: { id: routeId },
		cookies: {
			get: vi.fn(),
			getAll: vi.fn(() => []),
			set: vi.fn(),
			delete: vi.fn(),
			serialize: vi.fn(),
		},
		locals: { db: noopDb, kv: undefined, user: null, sessionId: null },
		isSubRequest: false,
		getClientAddress: () => "127.0.0.1",
	} as unknown as Parameters<ReturnType<typeof createRequestHandle>>[0]["event"];
}

describe("request handle", () => {
	it("admits an authenticated request to a public route", async () => {
		const handle = createRequestHandle({
			accessLogger: noopLogger,
			initializeDatabase: noopDbInit,
			isBuilding: () => false,
			resolveSession: mockResolveSession({ user: AUTHED_USER, sessionId: "s1", clearCookie: false }),
		});

		const event = createEvent();
		const response = await handle({ event, resolve: vi.fn().mockResolvedValue(new Response("ok")) });

		expect(response.status).toBe(200);
		expect(event.locals.user).toEqual(AUTHED_USER);
	});

	it("redirects unauthenticated protected page requests to login", async () => {
		const handle = createRequestHandle({
			accessLogger: noopLogger,
			initializeDatabase: noopDbInit,
			isBuilding: () => false,
			resolveSession: mockResolveSession({ user: null, sessionId: null, clearCookie: false }),
		});

		const event = createEvent("/(protected)", "/private");

		let thrown: unknown;
		try {
			await handle({ event, resolve: vi.fn() });
		} catch (error) {
			thrown = error;
		}

		expect(isRedirect(thrown)).toBe(true);
		if (isRedirect(thrown)) expect(thrown.location).toContain("/login");
	});

	it("returns 401 for unauthenticated protected API requests", async () => {
		const handle = createRequestHandle({
			accessLogger: noopLogger,
			initializeDatabase: noopDbInit,
			isBuilding: () => false,
			resolveSession: mockResolveSession({ user: null, sessionId: null, clearCookie: false }),
		});

		const event = createEvent("/(protected-api)/api/session");

		let thrown: unknown;
		try {
			await handle({ event, resolve: vi.fn() });
		} catch (error) {
			thrown = error;
		}

		expect(isHttpError(thrown)).toBe(true);
		if (isHttpError(thrown)) expect(thrown.status).toBe(401);
	});

	it("clears an invalid session cookie", async () => {
		const handle = createRequestHandle({
			accessLogger: noopLogger,
			initializeDatabase: noopDbInit,
			isBuilding: () => false,
			resolveSession: mockResolveSession({ user: null, sessionId: null, clearCookie: true }),
		});

		const event = createEvent();
		await handle({ event, resolve: vi.fn().mockResolvedValue(new Response("ok")) });

		expect(event.cookies.delete).toHaveBeenCalled();
	});

	it("rotates the session token when requested", async () => {
		const handle = createRequestHandle({
			accessLogger: noopLogger,
			initializeDatabase: noopDbInit,
			isBuilding: () => false,
			resolveSession: mockResolveSession({
				user: AUTHED_USER,
				sessionId: "s1",
				clearCookie: false,
				rotatedToken: "new-token",
			}),
		});

		const event = createEvent();
		await handle({ event, resolve: vi.fn().mockResolvedValue(new Response("ok")) });

		expect(event.cookies.set).toHaveBeenCalledWith("auth_session", "new-token", expect.objectContaining({ path: "/" }));
	});
});
