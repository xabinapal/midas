import { isActionFailure, isRedirect, type Cookies } from "@sveltejs/kit";
import type { Kysely } from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAME } from "$lib/server/auth/request";
import type { Database } from "$lib/server/database";
import { actions } from "./+page.server";
import type { RequestEvent } from "./$types";

const authenticateUser = vi.hoisted(() => vi.fn());
const createSession = vi.hoisted(() => vi.fn());

vi.mock("$lib/server/auth/service", () => ({ authenticateUser }));
vi.mock("$lib/server/auth/request", async (importOriginal) => {
	const actual = await importOriginal<typeof import("$lib/server/auth/request")>();
	return {
		...actual,
		createSession,
	};
});

const AUTHED_USER = {
	id: "user-1",
	username: "developer",
	householdId: "hh-1",
	isAdministrator: true,
	requiresPasswordChange: false,
	memberId: "member-1",
};

function createCookies() {
	const set = vi.fn();
	const cookies = {
		get: vi.fn(),
		getAll: vi.fn(() => []),
		set,
		delete: vi.fn(),
		serialize: vi.fn((name: string, value: string) => `${name}=${value}`),
	} satisfies Cookies;
	return { cookies, set };
}

interface LoginEventOptions {
	next?: string;
	password?: string;
	protocol?: "http" | "https";
	username?: string;
}

function createLoginEvent({
	next,
	password = "valid-password-12",
	protocol = "https",
	username = "developer",
}: LoginEventOptions = {}) {
	const { cookies, set } = createCookies();
	const url = new URL(`${protocol}://app.test/login`);
	if (next !== undefined) url.searchParams.set("next", next);
	const data = new FormData();
	data.set("username", username);
	data.set("password", password);
	const event = {
		cookies,
		locals: {
			db: {
				insertInto: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ execute: vi.fn() }) }),
			} as unknown as Kysely<Database>,
			kv: undefined,
			user: null,
			sessionId: null,
		},
		request: new Request(url, { body: data, method: "POST" }),
		url,
	} as unknown as RequestEvent;
	return { event, set };
}

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
	try {
		await promise;
	} catch (error) {
		return error;
	}
	throw new Error("Expected the action to throw");
}

function defaultAction() {
	const action = actions["default"];
	if (!action) throw new Error("Expected a default login action");
	return action;
}

describe("login action", () => {
	beforeEach(() => {
		authenticateUser.mockReset();
		createSession.mockReset();
	});

	it("rejects invalid input without exposing the submitted password", async () => {
		const { event, set } = createLoginEvent({ password: "short", username: "x" });

		const result = await defaultAction()(event);

		expect(isActionFailure(result)).toBe(true);
		if (!isActionFailure(result)) throw new Error("Expected an action failure");
		const failure = result as unknown as { data: { form: { data: { password: string } } }; status: number };
		expect(failure.status).toBe(400);
		expect(failure.data.form.data.password).toBe("");
		expect(authenticateUser).not.toHaveBeenCalled();
		expect(set).not.toHaveBeenCalled();
	});

	it("returns one generic failure and clears the password for invalid credentials", async () => {
		authenticateUser.mockResolvedValue(null);
		const { event, set } = createLoginEvent({ password: "incorrect-pass" });

		const result = await defaultAction()(event);

		expect(isActionFailure(result)).toBe(true);
		if (!isActionFailure(result)) throw new Error("Expected an action failure");
		const failure = result as unknown as {
			data: { form: { data: { password: string }; message?: string } };
			status: number;
		};
		expect(failure.status).toBe(401);
		expect(failure.data.form.message).toBe("El nombre de usuario o la contraseña no son correctos");
		expect(failure.data.form.data.password).toBe("");
		expect(set).not.toHaveBeenCalled();
	});

	it("creates a session and redirects to a validated local destination", async () => {
		authenticateUser.mockResolvedValue(AUTHED_USER);
		createSession.mockResolvedValue({ token: "bearer-token", sessionId: "s1" });
		const { event, set } = createLoginEvent({
			next: "/dashboard?tab=one",
			password: "valid-password-12",
			username: " Developer ",
		});

		const thrown = await thrownBy(Promise.resolve(defaultAction()(event)));

		expect(authenticateUser).toHaveBeenCalledWith(expect.any(Object), "developer", "valid-password-12");
		expect(createSession).toHaveBeenCalledWith(expect.any(Object), "user-1", "hh-1");
		expect(set).toHaveBeenCalledWith(
			SESSION_COOKIE_NAME,
			"bearer-token",
			expect.objectContaining({
				path: "/",
				httpOnly: true,
				sameSite: "lax",
				secure: true,
			}),
		);
		expect(isRedirect(thrown)).toBe(true);
		if (!isRedirect(thrown)) throw thrown;
		expect(thrown).toMatchObject({ location: "/dashboard?tab=one", status: 303 });
	});

	it.each(["https://evil.example/path", "//evil.example/path", "/\\evil.example/path", undefined])(
		"redirects an authenticated submission with destination %s to the application root",
		async (next) => {
			authenticateUser.mockResolvedValue(AUTHED_USER);
			createSession.mockResolvedValue({ token: "t", sessionId: "s1" });
			const { event } = createLoginEvent({ next });

			const thrown = await thrownBy(Promise.resolve(defaultAction()(event)));

			expect(isRedirect(thrown)).toBe(true);
			if (!isRedirect(thrown)) throw thrown;
			expect(thrown).toMatchObject({ location: "/", status: 303 });
		},
	);
});
