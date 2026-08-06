import { describe, expect, it, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "$lib/server/database/schema";
import { load } from "./+page.server";

const USER = {
	id: "user-1",
	username: "developer",
	householdId: "hh-1",
	isAdministrator: true,
	requiresPasswordChange: false,
	memberId: "m-1",
};

const HOUSEHOLD = {
	id: "hh-1",
	name: "Piso",
	currency: "EUR",
	timezone: "Europe/Madrid",
	locale: "es-ES",
	version: "v1",
	created_at: "2026-08-01T00:00:00.000Z",
	updated_at: "2026-08-01T00:00:00.000Z",
};

const HELD_GATE = {
	household_id: "hh-1",
	operation_id: "op-other",
	expected_version: "v1",
	lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
};

function chainable(result: unknown) {
	const execute = vi.fn().mockResolvedValue(result);
	const takeFirst = vi.fn().mockResolvedValue(Array.isArray(result) ? result[0] : result);
	const self: Record<string, ReturnType<typeof vi.fn>> = {};
	const make = (): unknown =>
		new Proxy(self, {
			get: (_t, prop) => {
				if (prop === "execute") return execute;
				if (prop === "executeTakeFirst") return takeFirst;
				if (prop === "then") return undefined;
				return vi.fn(() => make());
			},
		});
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

describe("gastos load gate handling", () => {
	it("renders without materializing when the household gate is held", async () => {
		const db = buildDb({ households: [HOUSEHOLD], household_command_gates: [HELD_GATE] });

		const result = (await load({
			locals: { db, kv: undefined, user: USER, sessionId: "s1" },
			url: new URL("http://localhost/gastos?period=2026-08"),
		} as never)) as {
			views: unknown[];
			isCustomPeriod: boolean;
			periodSlug: string;
			materializationFailures: unknown[];
		};

		// The page must still render; generation retries on the next open.
		expect(result.views).toEqual([]);
		expect(result.isCustomPeriod).toBe(false);
		expect(result.periodSlug).toBe("2026-08");
		expect(result.materializationFailures).toEqual([]);
	});
});
