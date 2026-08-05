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
	const takeFirst = vi.fn().mockResolvedValue(Array.isArray(result) ? result[0] : result);
	const self: Record<string, ReturnType<typeof vi.fn>> = {};
	const make = () => {
		const proxy = new Proxy(self, {
			get: (_t, prop) => {
				if (prop === "execute") return execute;
				if (prop === "executeTakeFirst") return takeFirst;
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
		const member = { id: "m1", household_id: "hh-1", display_name: "Alex", is_active: 1 };
		let membersCallCount = 0;
		const db = {
			selectFrom: (table: string) => {
				if (table === "users") return chainable([]);
				if (table === "members") {
					membersCallCount++;
					return chainable(membersCallCount === 1 ? [member] : [{ id: "m1" }, { id: "m2" }]);
				}
				return chainable([]);
			},
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

	it("rejects deactivation when it would zero the household total active weight", async () => {
		const member = { id: "m1", household_id: "hh-1", display_name: "Alex", is_active: 1 };
		// members queries: findById (takeFirst), countActive (3 rows), sumActiveWeight (3 rows)
		const activeRows = [{ id: "m1" }, { id: "m2" }, { id: "m3" }];
		// interval queries: findById weight (50), then one per active member (50, 0, 0) → total 50
		const intervalWeights = [
			{ default_weight: 50 },
			{ default_weight: 50 },
			{ default_weight: 0 },
			{ default_weight: 0 },
		];
		let membersCallCount = 0;
		let intervalsCallCount = 0;
		const db = {
			selectFrom: (table: string) => {
				if (table === "users") return chainable([]);
				if (table === "members") {
					membersCallCount++;
					return chainable(membersCallCount === 1 ? [member] : activeRows);
				}
				if (table === "member_intervals") {
					return chainable([intervalWeights[Math.min(intervalsCallCount++, intervalWeights.length - 1)]]);
				}
				return chainable([]);
			},
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
		expect(result).toEqual({ success: false, reason: "last_weight" });
	});
});
