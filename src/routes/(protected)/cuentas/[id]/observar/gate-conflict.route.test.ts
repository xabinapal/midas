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

describe("observar action gate handling", () => {
	it("maps a held household gate to a 409 conflict message", async () => {
		const db = buildDb({ accounts: [ACCOUNT], household_command_gates: [HELD_GATE] });
		const action = actions["default"];
		if (!action) throw new Error("Expected default action");
		const body = new FormData();
		body.set("amount", "10,00");
		body.set("effectiveDate", "2026-08-05");

		const result = (await action({
			locals: { db, kv: undefined, user: USER, sessionId: "s1" },
			params: { id: "acc-1" },
			request: new Request("http://localhost/cuentas/acc-1/observar", { method: "POST", body }),
		} as never)) as { status: number; data: { form: { message?: string } } };

		expect(result.status).toBe(409);
		expect(result.data.form.message).toContain("Otra operación está en curso");
	});
});
