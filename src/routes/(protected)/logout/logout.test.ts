import { isRedirect, type Cookies } from "@sveltejs/kit";
import type { Kysely } from "kysely";
import { describe, expect, it, vi } from "vitest";
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
	const db = {
		deleteFrom: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ execute: vi.fn() }) }),
		insertInto: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ execute: vi.fn() }) }),
	};
	const locals = {
		db: db as unknown as Kysely<Database>,
		kv: undefined,
		user: {
			id: "user-1",
			username: "developer",
			householdId: "hh-1",
			isAdministrator: true,
			requiresPasswordChange: false,
			memberId: "m1",
		},
		sessionId: "session-1",
	};
	const url = new URL("http://localhost/logout");
	return { cookies, deleteCookie, locals, url, db };
}

describe("logout route", () => {
	it("loads the confirmation page without revoking the session", () => {
		const { cookies, locals } = createLogoutEvent();
		const event = { cookies, locals } as unknown as PageServerLoadEvent;

		expect(() => load(event)).not.toThrow();
	});

	it("revokes the session, clears the cookie, and redirects to login", async () => {
		const { cookies, deleteCookie, locals, url } = createLogoutEvent();
		const event = { cookies, locals, url } as unknown as RequestEvent;
		const action = actions["default"];
		if (!action) throw new Error("Expected a default logout action");

		let thrown: unknown;
		try {
			await action(event);
		} catch (error) {
			thrown = error;
		}

		expect(isRedirect(thrown)).toBe(true);
		if (!isRedirect(thrown)) throw thrown;
		expect(thrown).toMatchObject({ location: "/login", status: 303 });
		expect(deleteCookie).toHaveBeenCalledWith("auth_session", expect.objectContaining({ path: "/" }));
		expect(locals.user).toBeNull();
		expect(locals.sessionId).toBeNull();
	});
});
