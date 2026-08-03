import { isRedirect, type Cookies } from "@sveltejs/kit";
import type { Kysely } from "kysely";
import { describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAME } from "$lib/server/auth/request";
import type { Database } from "$lib/server/database";
import { actions, load } from "./+page.server";
import type { PageServerLoadEvent, RequestEvent } from "./$types";

function createLogoutEvent() {
	const deleteCookie = vi.fn();
	const cookies = {
		get: vi.fn(),
		getAll: vi.fn(() => []),
		set: vi.fn(),
		delete: deleteCookie,
		serialize: vi.fn((name: string, value: string) => `${name}=${value}`),
	} satisfies Cookies;
	const locals: App.Locals = {
		auth: { enabled: true, secret: "0123456789abcdef0123456789abcdef" },
		db: {} as Kysely<Database>,
		kv: undefined,
		user: { id: "user-1", username: "developer" },
	};

	return { cookies, deleteCookie, locals };
}

async function thrownBy(operation: () => unknown): Promise<unknown> {
	try {
		await operation();
	} catch (error) {
		return error;
	}
	throw new Error("Expected the action to throw");
}

describe("logout route", () => {
	it("loads the confirmation page without clearing the session", async () => {
		const { cookies, deleteCookie, locals } = createLogoutEvent();
		const event = { cookies, locals } as unknown as PageServerLoadEvent;

		await expect(Promise.resolve(load(event))).resolves.toEqual({});

		expect(deleteCookie).not.toHaveBeenCalled();
		expect(locals.user).toEqual({ id: "user-1", username: "developer" });
	});

	it("clears the session only when the logout action is submitted", async () => {
		const { cookies, deleteCookie, locals } = createLogoutEvent();
		const event = { cookies, locals } as unknown as RequestEvent;
		const action = actions["default"];
		if (!action) throw new Error("Expected a default logout action");

		const thrown = await thrownBy(() => action(event));

		expect(deleteCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, { path: "/" });
		expect(locals.user).toBeNull();
		expect(isRedirect(thrown)).toBe(true);
		if (!isRedirect(thrown)) throw thrown;
		expect(thrown).toMatchObject({ location: "/login", status: 303 });
	});
});
