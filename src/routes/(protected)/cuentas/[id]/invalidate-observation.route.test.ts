import { describe, expect, it, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "$lib/server/database/schema";
import { actions } from "./+page.server";

const USER = {
	id: "user-1",
	username: "developer",
	householdId: "hh-1",
	isAdministrator: true,
	requiresPasswordChange: false,
	memberId: "m-1",
};

const ACCOUNT = {
	id: "acc-1",
	household_id: "hh-1",
	name: "Cuenta común",
	classification: "shared",
	status: "active",
	currency: "EUR",
	created_at: "2026-08-01T00:00:00.000Z",
	updated_at: "2026-08-01T00:00:00.000Z",
};

const OBSERVATION_ON_OTHER_ACCOUNT = {
	id: "obs-9",
	account_id: "acc-2",
	amount_minor: 50000,
	effective_at: "2026-08-01T00:00:00.000Z",
	ordering_key: "2026-08-01T00:00:00.000Z#obs-9",
	recorded_at: "2026-08-01T00:00:00.000Z",
	status: "valid",
	replaces_observation_id: null,
	invalidated_at: null,
	operation_id: null,
};

function chainable(result: unknown) {
	const execute = vi.fn().mockResolvedValue(result);
	const takeFirst = vi.fn().mockResolvedValue(Array.isArray(result) ? result[0] : result);
	const self: Record<string, ReturnType<typeof vi.fn>> = {};
	const make = (): unknown => {
		return new Proxy(self, {
			get: (_t, prop) => {
				if (prop === "execute") return execute;
				if (prop === "executeTakeFirst") return takeFirst;
				if (prop === "then") return undefined;
				return vi.fn(() => make());
			},
		});
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

function event(db: Kysely<Database>, accountId: string, observationId: string) {
	const body = new FormData();
	body.set("observationId", observationId);
	return {
		locals: { db, kv: undefined, user: USER, sessionId: "s1" },
		params: { id: accountId },
		request: new Request("http://localhost/cuentas/acc-1?/invalidateObservation", { method: "POST", body }),
	} as never;
}

describe("account detail invalidateObservation action", () => {
	it("rejects an observation that belongs to a different account without writing any event", async () => {
		const db = buildDb({
			balance_observations: [OBSERVATION_ON_OTHER_ACCOUNT],
			accounts: [ACCOUNT],
			activity_events: [],
		});
		const action = actions["invalidateObservation"];
		if (!action) throw new Error("Expected invalidateObservation action");

		const result = await action(event(db, "acc-1", "obs-9"));

		expect(result).toEqual({ success: false, reason: "observation_not_found" });
	});

	it("rejects a missing observation id", async () => {
		const db = buildDb({ balance_observations: [], accounts: [ACCOUNT] });
		const action = actions["invalidateObservation"];
		if (!action) throw new Error("Expected invalidateObservation action");
		const body = new FormData();
		const result = await action({
			locals: { db, kv: undefined, user: USER, sessionId: "s1" },
			params: { id: "acc-1" },
			request: new Request("http://localhost/cuentas/acc-1?/invalidateObservation", { method: "POST", body }),
		} as never);

		expect(result).toMatchObject({ status: 400 });
	});
});
