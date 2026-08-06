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

function transferRequest(fields: Record<string, string>) {
	const body = new FormData();
	for (const [key, value] of Object.entries(fields)) body.set(key, value);
	return {
		locals: { db: buildDb({}), kv: undefined, user: USER, sessionId: "s1" },
		request: new Request("http://localhost/transferencias/nueva", { method: "POST", body }),
	} as never;
}

describe("new transfer action validation", () => {
	it("rejects identical source and destination with a field error", async () => {
		const action = actions["default"];
		if (!action) throw new Error("Expected default action");

		const result = (await action(
			transferRequest({
				sourceAccountId: "acc-1",
				destinationAccountId: "acc-1",
				amount: "10,00",
				effectiveDate: "2026-08-05",
				description: "",
				classification: "pure",
			}),
		)) as { data: { form: { errors: Record<string, string[]> } } };

		expect(result.data.form.errors["destinationAccountId"]?.[0]).toContain("cuentas distintas");
	});

	it("rejects an unparseable amount with a field error", async () => {
		const action = actions["default"];
		if (!action) throw new Error("Expected default action");

		const result = (await action(
			transferRequest({
				sourceAccountId: "acc-1",
				destinationAccountId: "acc-2",
				amount: "abc",
				effectiveDate: "2026-08-05",
				description: "",
				classification: "pure",
			}),
		)) as { data: { form: { errors: Record<string, string[]> } } };

		expect(result.data.form.errors["amount"]?.[0]).toContain("importe válido");
	});

	it("rejects an amount of zero as not positive", async () => {
		const action = actions["default"];
		if (!action) throw new Error("Expected default action");

		const result = (await action(
			transferRequest({
				sourceAccountId: "acc-1",
				destinationAccountId: "acc-2",
				amount: "0,00",
				effectiveDate: "2026-08-05",
				description: "",
				classification: "pure",
			}),
		)) as { data: { form: { errors: Record<string, string[]> } } };

		expect(result.data.form.errors["amount"]?.[0]).toContain("mayor que cero");
	});
});
