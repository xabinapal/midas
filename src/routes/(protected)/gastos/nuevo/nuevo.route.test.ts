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

const CATEGORY = {
	id: "cat-1",
	household_id: "hh-1",
	name: "Luz",
	slug: "luz",
	ordering: 0,
	is_active: 1,
	created_at: "2026-08-01T00:00:00.000Z",
	updated_at: "2026-08-01T00:00:00.000Z",
	operation_id: null,
};

const PERIOD = {
	id: "period-1",
	household_id: "hh-1",
	slug: "2026-08",
	label: "Agosto de 2026",
	start_date: "2026-08-01",
	end_date: "2026-09-01",
	kind: "standard",
	created_at: "2026-08-01T00:00:00.000Z",
	operation_id: null,
};

const MEMBERS = [
	{
		id: "m-1",
		household_id: "hh-1",
		display_name: "Alex",
		is_active: 1,
		created_at: "2026-08-01T00:00:00.000Z",
		updated_at: "2026-08-01T00:00:00.000Z",
	},
	{
		id: "m-2",
		household_id: "hh-1",
		display_name: "Sam",
		is_active: 1,
		created_at: "2026-08-01T00:00:00.000Z",
		updated_at: "2026-08-01T00:00:00.000Z",
	},
];

const MEMBER_INTERVALS = [
	{
		id: "mi-1",
		member_id: "m-1",
		effective_from: "2026-08-01T00:00:00.000Z",
		default_weight: 1,
		is_active: 1,
		operation_id: null,
	},
	{
		id: "mi-2",
		member_id: "m-2",
		effective_from: "2026-08-01T00:00:00.000Z",
		default_weight: 1,
		is_active: 1,
		operation_id: null,
	},
];

const SHARED_ACCOUNT = {
	id: "acc-shared",
	household_id: "hh-1",
	name: "Cuenta común",
	classification: "shared",
	status: "active",
	currency: "EUR",
	created_at: "2026-08-01T00:00:00.000Z",
	updated_at: "2026-08-01T00:00:00.000Z",
};

const HOLDERS = [
	{
		id: "h-1",
		account_id: "acc-shared",
		member_id: "m-1",
		effective_from: "2026-08-01T00:00:00.000Z",
		effective_to: null,
		operation_id: null,
	},
	{
		id: "h-2",
		account_id: "acc-shared",
		member_id: "m-2",
		effective_from: "2026-08-01T00:00:00.000Z",
		effective_to: null,
		operation_id: null,
	},
];

/**
 * Records insert values per table and merges them into subsequent reads,
 * so the real service stack runs against it end to end.
 */
function buildRecordingDb(tables: Record<string, unknown>) {
	const inserts: Record<string, Record<string, unknown>[]> = {};
	const record = (table: string, values: unknown) => {
		const rows = Array.isArray(values) ? values : [values];
		inserts[table] = [...(inserts[table] ?? []), ...(rows as Record<string, unknown>[])];
	};
	const rowsOf = (table: string) => [
		...((tables[table] ?? []) as Record<string, unknown>[]),
		...(inserts[table] ?? []),
	];
	const chainable = (result: () => unknown, table?: string) => {
		const execute = vi.fn().mockImplementation(() => Promise.resolve(result()));
		const takeFirst = vi
			.fn()
			.mockImplementation(() => Promise.resolve(Array.isArray(result()) ? (result() as unknown[])[0] : result()));
		const self: Record<string, ReturnType<typeof vi.fn>> = {};
		const make = (): unknown =>
			new Proxy(self, {
				get: (_t, prop) => {
					if (prop === "execute") return execute;
					if (prop === "executeTakeFirst") return takeFirst;
					if (prop === "then") return undefined;
					if (prop === "values" && table) return vi.fn((values: unknown) => (record(table, values), make()));
					return vi.fn(() => make());
				},
			});
		return make();
	};
	const db = {
		selectFrom: (table: string) => chainable(() => rowsOf(table)),
		updateTable: () => chainable(() => undefined),
		insertInto: (table: string) => chainable(() => undefined, table),
		deleteFrom: () => chainable(() => undefined),
	} as unknown as Kysely<Database>;
	return { db, inserts };
}

function expenseRequest(fields: Record<string, string>, db: Kysely<Database>) {
	const body = new FormData();
	for (const [key, value] of Object.entries(fields)) body.append(key, value);
	return {
		locals: { db, kv: undefined, user: USER, sessionId: "s1" },
		request: new Request("http://localhost/gastos/nuevo", { method: "POST", body }),
	} as never;
}

describe("new expense action", () => {
	it("creates the expense, payment, and application as distinct linked records in one operation", async () => {
		const { db, inserts } = buildRecordingDb({
			households: [HOUSEHOLD],
			expense_categories: [CATEGORY],
			reporting_periods: [PERIOD],
			members: MEMBERS,
			member_intervals: MEMBER_INTERVALS,
			accounts: [SHARED_ACCOUNT],
			account_holder_intervals: HOLDERS,
			expenses: [],
		});
		const action = actions["default"];
		if (!action) throw new Error("Expected default action");

		let redirect: { status: number; location: string } | null = null;
		try {
			await action(
				expenseRequest(
					{
						description: "Factura de la luz",
						categoryId: "cat-1",
						reportingPeriodId: "period-1",
						amount: "100",
						valueKind: "actual",
						accountingDate: "2026-08-05",
						allocationMethod: "equal",
						memberIds: "m-1",
						paid: "on",
						paymentAccountId: "acc-shared",
						paymentDate: "2026-08-05",
					},
					db,
				),
			);
		} catch (error) {
			redirect = error as { status: number; location: string };
		}

		expect(redirect).not.toBeNull();
		expect(redirect!.status).toBe(303);
		expect(redirect!.location).toMatch(/^\/gastos\//);

		const expenses = inserts["expenses"] ?? [];
		const payments = inserts["payments"] ?? [];
		const applications = inserts["payment_applications"] ?? [];
		const entries = inserts["payment_account_entries"] ?? [];
		const activities = inserts["activity_events"] ?? [];

		expect(expenses).toHaveLength(1);
		expect(expenses[0]).toMatchObject({
			actual_amount_minor: 10000,
			planned_amount_minor: null,
			reference: "luz/2026-08",
			status: "posted",
		});
		expect(payments).toHaveLength(1);
		expect(payments[0]).toMatchObject({ amount_minor: 10000, funding_source: "shared", funder_member_id: null });
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({ account_id: "acc-shared", amount_minor: -10000 });
		expect(applications).toHaveLength(1);
		expect(applications[0]).toMatchObject({
			expense_id: expenses[0]!["id"],
			payment_id: payments[0]!["id"],
			amount_minor: 10000,
		});
		// One shared operation root links every record of the composition.
		expect(expenses[0]!["operation_id"]).toBe(payments[0]!["operation_id"]);
		expect(applications[0]!["operation_id"]).toBe(payments[0]!["operation_id"]);
		expect(entries[0]!["operation_id"]).toBe(payments[0]!["operation_id"]);
		expect(activities.map((row) => row["event_type"])).toEqual(["expense_posted", "payment_posted"]);
	});

	it("creates an unpaid estimated expense without any payment records", async () => {
		const { db, inserts } = buildRecordingDb({
			households: [HOUSEHOLD],
			expense_categories: [CATEGORY],
			reporting_periods: [PERIOD],
			members: MEMBERS,
			member_intervals: MEMBER_INTERVALS,
			accounts: [SHARED_ACCOUNT],
			account_holder_intervals: HOLDERS,
			expenses: [],
		});
		const action = actions["default"];
		if (!action) throw new Error("Expected default action");

		let redirect: { status: number; location: string } | null = null;
		try {
			await action(
				expenseRequest(
					{
						description: "Estimación del agua",
						categoryId: "cat-1",
						reportingPeriodId: "period-1",
						amount: "40",
						valueKind: "estimated",
						accountingDate: "2026-08-05",
						allocationMethod: "equal",
						memberIds: "m-1",
					},
					db,
				),
			);
		} catch (error) {
			redirect = error as { status: number; location: string };
		}

		expect(redirect).not.toBeNull();
		const expenses = inserts["expenses"] ?? [];
		expect(expenses).toHaveLength(1);
		expect(expenses[0]).toMatchObject({ planned_amount_minor: 4000, actual_amount_minor: null });
		expect(inserts["payments"] ?? []).toHaveLength(0);
		expect(inserts["payment_applications"] ?? []).toHaveLength(0);
		expect(inserts["payment_account_entries"] ?? []).toHaveLength(0);
	});

	it("rejects an invalid amount with a field error before touching the database", async () => {
		const { db, inserts } = buildRecordingDb({ households: [HOUSEHOLD] });
		const action = actions["default"];
		if (!action) throw new Error("Expected default action");

		const result = (await action(
			expenseRequest(
				{
					description: "Factura",
					categoryId: "cat-1",
					reportingPeriodId: "period-1",
					amount: "abc",
					valueKind: "actual",
					accountingDate: "2026-08-05",
					allocationMethod: "equal",
					memberIds: "m-1",
				},
				db,
			),
		)) as { status: number; data: { form: { errors: Record<string, string[]> } } };

		expect(result.status).toBe(400);
		expect(result.data.form.errors["amount"]?.[0]).toContain("importe válido");
		expect(inserts["expenses"] ?? []).toHaveLength(0);
	});
});
