import { isActionFailure, isRedirect, type Cookies } from "@sveltejs/kit";
import type { Kysely } from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAME } from "$lib/server/auth/request";
import { SESSION_DURATION_SECONDS, verifySessionToken } from "$lib/server/auth/session";
import type { Database } from "$lib/server/database";
import { actions } from "./+page.server";
import type { RequestEvent } from "./$types";

const AUTH_SECRET = "0123456789abcdef0123456789abcdef";
const authenticateUser = vi.hoisted(() => vi.fn());

vi.mock("$lib/server/auth/service", () => ({ authenticateUser }));

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
	authEnabled?: boolean;
	next?: string;
	password?: string;
	protocol?: "http" | "https";
	username?: string;
}

function createLoginEvent({
	authEnabled = true,
	next,
	password = "password",
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
			auth: authEnabled ? { enabled: true as const, secret: AUTH_SECRET } : { enabled: false as const },
			db: {} as Kysely<Database>,
			kv: undefined,
			user: null,
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
	beforeEach(() => authenticateUser.mockReset());

	it("redirects without validating or issuing a session when authentication is disabled", async () => {
		const { event, set } = createLoginEvent({ authEnabled: false, password: "", username: "" });

		const thrown = await thrownBy(Promise.resolve(defaultAction()(event)));

		expect(isRedirect(thrown)).toBe(true);
		if (!isRedirect(thrown)) throw thrown;
		expect(thrown).toMatchObject({ location: "/", status: 303 });
		expect(authenticateUser).not.toHaveBeenCalled();
		expect(set).not.toHaveBeenCalled();
	});

	it("rejects invalid input without exposing the submitted password", async () => {
		const { event, set } = createLoginEvent({ password: "", username: "x" });

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
		const { event, set } = createLoginEvent({ password: "incorrect" });

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

	it("issues a secure session and redirects to a validated local destination", async () => {
		const user = { id: "user-1", username: "developer" };
		authenticateUser.mockResolvedValue(user);
		const password = " unchanged password ";
		const { event, set } = createLoginEvent({
			next: "/dashboard?tab=one",
			password,
			username: " Developer ",
		});

		const thrown = await thrownBy(Promise.resolve(defaultAction()(event)));

		expect(authenticateUser).toHaveBeenCalledWith(expect.any(Object), "developer", password);
		expect(set).toHaveBeenCalledWith(SESSION_COOKIE_NAME, expect.any(String), {
			httpOnly: true,
			maxAge: SESSION_DURATION_SECONDS,
			path: "/",
			sameSite: "lax",
			secure: true,
		});
		const token = set.mock.calls[0]![1] as string;
		await expect(verifySessionToken(token, AUTH_SECRET)).resolves.toMatchObject({ user });
		expect(isRedirect(thrown)).toBe(true);
		if (!isRedirect(thrown)) throw thrown;
		expect(thrown).toMatchObject({ location: "/dashboard?tab=one", status: 303 });
	});

	it.each(["https://evil.example/path", "//evil.example/path", "/\\evil.example/path", undefined])(
		"redirects an authenticated submission with destination %s to the application root",
		async (next) => {
			const user = { id: "user-1", username: "developer" };
			authenticateUser.mockResolvedValue(user);
			const { event } = createLoginEvent({ next });

			const thrown = await thrownBy(Promise.resolve(defaultAction()(event)));

			expect(isRedirect(thrown)).toBe(true);
			if (!isRedirect(thrown)) throw thrown;
			expect(thrown).toMatchObject({ location: "/", status: 303 });
		},
	);
});
