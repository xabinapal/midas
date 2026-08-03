import { isHttpError, isRedirect, type Cookies, type RequestEvent } from "@sveltejs/kit";
import type { D1Database, KVNamespace } from "@cloudflare/workers-types";
import type { Kysely } from "kysely";
import { describe, expect, it, vi } from "vitest";
import { createRequestHandle } from "./hooks.server";
import { SESSION_COOKIE_NAME } from "./lib/server/auth/request";
import { SESSION_DURATION_SECONDS, createSessionToken, verifySessionToken } from "./lib/server/auth/session";
import type { Database } from "./lib/server/database";

const AUTH_SECRET = "0123456789abcdef0123456789abcdef";

function createCookies(initial: Record<string, string> = {}) {
	const values = new Map(Object.entries(initial));
	const set = vi.fn((name: string, value: string) => void values.set(name, value));
	const deleteCookie = vi.fn((name: string) => void values.delete(name));
	const cookies = {
		get: vi.fn((name: string) => values.get(name)),
		getAll: vi.fn(() => [...values].map(([name, value]) => ({ name, value }))),
		set,
		delete: deleteCookie,
		serialize: vi.fn((name: string, value: string) => `${name}=${value}`),
	} satisfies Cookies;

	return { cookies, deleteCookie, set };
}

interface EventOptions {
	cookies?: Cookies;
	databaseBinding?: D1Database;
	kvBinding?: KVNamespace;
	method?: string;
	routeId?: RequestEvent["route"]["id"];
	url?: string;
}

function createEvent({
	cookies = createCookies().cookies,
	databaseBinding = {} as D1Database,
	kvBinding,
	method = "GET",
	routeId = "/(public)/login",
	url = "https://app.test/",
}: EventOptions = {}): RequestEvent {
	const parsedUrl = new URL(url);
	return {
		cookies,
		fetch,
		getClientAddress: () => "127.0.0.1",
		isDataRequest: false,
		isRemoteRequest: false,
		isSubRequest: false,
		locals: {} as App.Locals,
		params: {},
		platform: { env: { DB: databaseBinding, KV: kvBinding } } as App.Platform,
		request: new Request(parsedUrl, {
			headers: { authorization: "Bearer authorization-marker" },
			method,
		}),
		route: { id: routeId },
		setHeaders: vi.fn(),
		tracing: {} as RequestEvent["tracing"],
		url: parsedUrl,
	};
}

function createHarness(privateEnvironment: Record<string, string | undefined> = {}) {
	const database = { kind: "database" } as unknown as Kysely<Database>;
	const initializeDatabase = vi.fn(async () => database);
	const log = vi.fn();
	const handle = createRequestHandle({
		accessLogger: { log },
		getPrivateEnvironment: () => privateEnvironment,
		initializeDatabase,
		isBuilding: () => false,
	});

	return { database, handle, initializeDatabase, log };
}

async function thrownBy(operation: () => unknown): Promise<unknown> {
	try {
		await operation();
	} catch (error) {
		return error;
	}
	throw new Error("Expected the operation to throw");
}

function expectAccessLog(
	log: ReturnType<typeof vi.fn>,
	level: "info" | "warn" | "error",
	message: string,
	status: number,
) {
	expect(log).toHaveBeenCalledOnce();
	expect(log).toHaveBeenCalledWith(level, message, {
		method: expect.any(String),
		path: new URL(`https://app.test${message.split(" ")[1]}`).pathname,
		status,
		duration_ms: expect.any(Number),
	});
	const context = log.mock.calls[0]![2] as { duration_ms: number };
	expect(Number.isInteger(context.duration_ms)).toBe(true);
}

describe("request handle", () => {
	it("initializes request context and bypasses guards when authentication is disabled", async () => {
		const databaseBinding = {} as D1Database;
		const kvBinding = {} as KVNamespace;
		const { cookies, deleteCookie } = createCookies({ [SESSION_COOKIE_NAME]: "cookie-marker" });
		const event = createEvent({
			cookies,
			databaseBinding,
			kvBinding,
			routeId: "/(protected)",
			url: "https://app.test/private?token=query-marker",
		});
		const { database, handle, initializeDatabase, log } = createHarness({ AUTH_SECRET: "secret-marker" });
		const resolve = vi.fn(async (resolvedEvent: RequestEvent) => {
			expect(resolvedEvent.locals).toMatchObject({ auth: { enabled: false }, db: database, user: null });
			expect(resolvedEvent.locals.kv).toEqual(expect.objectContaining({ get: expect.any(Function) }));
			return new Response(null, { status: 204 });
		});

		await expect(handle({ event, resolve })).resolves.toHaveProperty("status", 204);

		expect(initializeDatabase).toHaveBeenCalledWith(databaseBinding);
		expect(resolve).toHaveBeenCalledOnce();
		expect(deleteCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, { path: "/" });
		expectAccessLog(log, "info", "GET /private", 204);
		expect(JSON.stringify(log.mock.calls)).not.toMatch(/query-marker|cookie-marker|authorization-marker|secret-marker/);
	});

	it("exposes optional KV as unavailable without fabricating a store", async () => {
		const event = createEvent({ kvBinding: undefined });
		const { handle } = createHarness();
		const resolve = vi.fn(async (resolvedEvent: RequestEvent) => {
			expect(resolvedEvent.locals.kv).toBeUndefined();
			return new Response(null, { status: 200 });
		});

		await handle({ event, resolve });

		expect(resolve).toHaveBeenCalledOnce();
	});

	it("allows an unauthenticated public route when authentication is enabled", async () => {
		const event = createEvent({ routeId: "/(public)/login", url: "https://app.test/login" });
		const { handle, log } = createHarness({ AUTH_ENABLED: "true", AUTH_SECRET });
		const resolve = vi.fn(async (resolvedEvent: RequestEvent) => {
			expect(resolvedEvent.locals.user).toBeNull();
			return new Response(null, { status: 200 });
		});

		await expect(handle({ event, resolve })).resolves.toHaveProperty("status", 200);

		expect(resolve).toHaveBeenCalledOnce();
		expectAccessLog(log, "info", "GET /login", 200);
	});

	it("redirects an unauthenticated protected page and records one completion", async () => {
		const event = createEvent({ routeId: "/(protected)", url: "https://app.test/private?tab=one" });
		const { handle, log } = createHarness({ AUTH_ENABLED: "true", AUTH_SECRET });
		const resolve = vi.fn(async () => new Response());

		const thrown = await thrownBy(() => handle({ event, resolve }));

		expect(isRedirect(thrown)).toBe(true);
		if (!isRedirect(thrown)) throw thrown;
		expect(thrown).toMatchObject({
			location: "/login?next=%2Fprivate%3Ftab%3Done",
			status: 303,
		});
		expect(resolve).not.toHaveBeenCalled();
		expectAccessLog(log, "info", "GET /private", 303);
	});

	it("clears an invalid enabled-session cookie before enforcing the protected route", async () => {
		const { cookies, deleteCookie } = createCookies({ [SESSION_COOKIE_NAME]: "invalid-token" });
		const event = createEvent({ cookies, routeId: "/(protected)", url: "https://app.test/private" });
		const { handle, log } = createHarness({ AUTH_ENABLED: "true", AUTH_SECRET });
		const resolve = vi.fn(async () => new Response());

		const thrown = await thrownBy(() => handle({ event, resolve }));

		expect(isRedirect(thrown)).toBe(true);
		expect(deleteCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, { path: "/" });
		expect(resolve).not.toHaveBeenCalled();
		expectAccessLog(log, "info", "GET /private", 303);
	});

	it("rejects an unauthenticated protected API without redirecting", async () => {
		const event = createEvent({ routeId: "/(protected-api)/api/session", url: "https://app.test/api/session" });
		const { handle, log } = createHarness({ AUTH_ENABLED: "true", AUTH_SECRET });
		const resolve = vi.fn(async () => new Response());

		const thrown = await thrownBy(() => handle({ event, resolve }));

		expect(isHttpError(thrown, 401)).toBe(true);
		expect(isRedirect(thrown)).toBe(false);
		expect(resolve).not.toHaveBeenCalled();
		expectAccessLog(log, "warn", "GET /api/session", 401);
	});

	it("refreshes a mature valid session before resolving a protected route", async () => {
		const user = { id: "user-1", username: "developer" };
		const issuedAt = Math.floor(Date.now() / 1000) - SESSION_DURATION_SECONDS / 2;
		const token = await createSessionToken(user, AUTH_SECRET, issuedAt);
		const { cookies, deleteCookie, set } = createCookies({ [SESSION_COOKIE_NAME]: token });
		const event = createEvent({ cookies, routeId: "/(protected)", url: "https://app.test/private" });
		const { handle } = createHarness({ AUTH_ENABLED: "true", AUTH_SECRET });
		const resolve = vi.fn(async (resolvedEvent: RequestEvent) => {
			expect(resolvedEvent.locals.user).toEqual(user);
			return new Response(null, { status: 200 });
		});

		await handle({ event, resolve });

		expect(deleteCookie).not.toHaveBeenCalled();
		expect(set).toHaveBeenCalledWith(SESSION_COOKIE_NAME, expect.any(String), {
			httpOnly: true,
			maxAge: SESSION_DURATION_SECONDS,
			path: "/",
			sameSite: "lax",
			secure: true,
		});
		const refreshedToken = set.mock.calls[0]![1];
		await expect(verifySessionToken(refreshedToken, AUTH_SECRET)).resolves.toMatchObject({ user });
	});

	it("rethrows an unexpected failure after recording one server-error completion", async () => {
		const failure = new Error("route failed");
		const event = createEvent({ url: "https://app.test/failure" });
		const { handle, log } = createHarness();
		const resolve = vi.fn(async () => {
			throw failure;
		});

		await expect(handle({ event, resolve })).rejects.toBe(failure);

		expectAccessLog(log, "error", "GET /failure", 500);
	});
});
