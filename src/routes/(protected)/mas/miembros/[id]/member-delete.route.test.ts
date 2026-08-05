import { describe, expect, it, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "$lib/server/database/schema";
import { actions } from "./+page.server";

const ADMIN_USER = {
	id: "admin-1",
	username: "admin",
	householdId: "hh-1",
	isAdministrator: true,
	requiresPasswordChange: false,
	memberId: "m1",
};

const MEMBER = { id: "m2", household_id: "hh-1", display_name: "Sam", is_active: 0, default_weight: 0 };

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

function buildDb(tables: Record<string, unknown>) {
	return {
		selectFrom: (table: string) => chainable(tables[table] ?? []),
		updateTable: () => chainable(undefined),
		insertInto: () => chainable(undefined),
		deleteFrom: () => chainable(undefined),
	} as unknown as Kysely<Database>;
}

function deleteEvent(db: Kysely<Database>) {
	return {
		locals: { db, kv: undefined, user: ADMIN_USER, sessionId: "s1" },
		params: { id: "m2" },
	} as never;
}

describe("member detail delete action", () => {
	it("rejects deletion when the member has an associated user", async () => {
		const db = buildDb({ members: [MEMBER], users: [{ id: "u1" }], activity_events: [] });
		const action = actions["delete"];
		if (!action) throw new Error("Expected delete action");
		const result = await action(deleteEvent(db));
		expect(result).toEqual({ deleteResult: { success: false, reason: "has_references" } });
	});

	it("rejects deletion when the member has activity history references", async () => {
		const db = buildDb({ members: [MEMBER], users: [], activity_events: [{ id: "e1" }] });
		const action = actions["delete"];
		if (!action) throw new Error("Expected delete action");
		const result = await action(deleteEvent(db));
		expect(result).toEqual({ deleteResult: { success: false, reason: "has_references" } });
	});

	it("deletes an unreferenced member and redirects to the member list", async () => {
		const db = buildDb({ members: [MEMBER], users: [], activity_events: [] });
		const action = actions["delete"];
		if (!action) throw new Error("Expected delete action");
		try {
			await action(deleteEvent(db));
			expect.unreachable("delete should redirect after success");
		} catch (redirectError) {
			const r = redirectError as { status: number; location: string };
			expect(r.status).toBe(303);
			expect(r.location).toBe("/mas/miembros");
		}
	});
});
