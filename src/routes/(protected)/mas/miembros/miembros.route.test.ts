import { describe, expect, it, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "$lib/server/database/schema";
import { actions, load } from "./+page.server";

const ADMIN_USER = {
	id: "admin-1",
	username: "admin",
	householdId: "hh-1",
	isAdministrator: true,
	requiresPasswordChange: false,
	memberId: "m1",
};

function chainable(result: unknown) {
	const execute = vi.fn().mockResolvedValue(result);
	const self: Record<string, ReturnType<typeof vi.fn>> = {};
	const make = () => {
		const proxy = new Proxy(self, {
			get: (_t, prop) => {
				if (prop === "execute") return execute;
				if (prop === "then") return undefined;
				return vi.fn(() => make());
			},
		});
		return proxy;
	};
	return make();
}

describe("member list page", () => {
	it("loads members for the household", async () => {
		const db = {
			selectFrom: () => chainable([{ id: "m1", display_name: "Alex", is_active: 1 }]),
		} as unknown as Kysely<Database>;
		const event = { locals: { db, kv: undefined, user: ADMIN_USER, sessionId: "s1" } } as Parameters<typeof load>[0];
		const result = (await load(event)) as { members: unknown[] };
		expect(result.members).toHaveLength(1);
	});

	it("rejects deactivation when only two active members remain", async () => {
		const db = {
			selectFrom: () => chainable([{ id: "a" }, { id: "b" }]),
			updateTable: () => chainable(undefined),
			insertInto: () => chainable(undefined),
		} as unknown as Kysely<Database>;
		const fd = new FormData();
		fd.set("memberId", "m1");
		const event = {
			locals: { db, kv: undefined, user: ADMIN_USER, sessionId: "s1" },
			request: { formData: async () => fd },
		} as never;
		const action = actions["deactivate"];
		if (!action) throw new Error("Expected deactivate action");
		const result = await action(event);
		expect(result).toEqual({ success: false, reason: "last_members" });
	});
});
