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

function expenseRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: "exp-1",
		household_id: "hh-1",
		category_id: "cat-1",
		reporting_period_id: "period-1",
		description: "Factura de la luz",
		reference: "luz/2026-08",
		status: "reversed",
		planned_amount_minor: null,
		planned_version: 1,
		actual_amount_minor: 10000,
		accounting_date: "2026-08-03",
		due_date: null,
		service_start_date: null,
		service_end_date: null,
		allocation_method: "equal",
		account_hint_id: null,
		template_id: null,
		scheduled_due_date: null,
		realized_by_expense_id: null,
		chain_root_id: "exp-1",
		replaces_id: null,
		reversed_by_id: "exp-2",
		actor_user_id: "user-1",
		operation_id: null,
		created_at: "2026-08-03T00:00:00.000Z",
		updated_at: "2026-08-03T00:00:00.000Z",
		...overrides,
	};
}

/**
 * Records insert values per table and merges them into subsequent reads.
 * Equality `where(column, "=", value)` clauses filter the seeded rows, and
 * function-form `where` clauses act as the completed-operation visibility
 * predicate: rows carrying a pending operation id stay invisible.
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
		const filters: ((row: Record<string, unknown>) => boolean)[] = [];
		const apply = () => {
			const rows = result();
			if (!Array.isArray(rows)) return rows;
			return rows.filter((row) => filters.every((filter) => filter(row)));
		};
		const execute = vi.fn().mockImplementation(() => Promise.resolve(apply()));
		const takeFirst = vi.fn().mockImplementation(() => Promise.resolve((apply() as unknown[])[0]));
		const self: Record<string, ReturnType<typeof vi.fn>> = {};
		const make = (): unknown =>
			new Proxy(self, {
				get: (_t, prop) => {
					if (prop === "execute") return execute;
					if (prop === "executeTakeFirst") return takeFirst;
					if (prop === "then") return undefined;
					if (prop === "values" && table) return vi.fn((values: unknown) => (record(table, values), make()));
					if (prop === "where") {
						return vi.fn((...args: unknown[]) => {
							if (typeof args[0] === "string" && args[1] === "=") {
								const column = args[0].split(".").pop()!;
								const value = args[2];
								filters.push((row) => row[column] === value);
							}
							if (typeof args[0] === "function") {
								filters.push((row) => row["operation_id"] === null || row["operation_id"] === undefined);
							}
							return make();
						});
					}
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

function loadEvent(db: Kysely<Database>, id: string) {
	return {
		locals: { db, kv: undefined, user: USER, sessionId: "s1" },
		params: { id },
	} as never;
}

function seedTables(expenses: Record<string, unknown>[]) {
	return buildRecordingDb({
		households: [HOUSEHOLD],
		expense_categories: [CATEGORY],
		reporting_periods: [PERIOD],
		expenses,
		expense_allocation_params: [
			{ id: "ap-1", expense_id: "exp-1", member_id: "m-1", value: null },
			{ id: "ap-2", expense_id: "exp-1", member_id: "m-2", value: null },
		],
		payment_applications: [],
		members: MEMBERS,
		member_intervals: MEMBER_INTERVALS,
		household_command_gates: [],
	});
}

describe("corregir load admission", () => {
	it("admits a reversed expense whose replacement is not yet visible", async () => {
		const { db } = seedTables([
			expenseRow(),
			expenseRow({
				id: "exp-2",
				reference: null,
				status: "posted",
				replaces_id: "exp-1",
				reversed_by_id: null,
				operation_id: "op-pending",
			}),
		]);

		const result = (await load(loadEvent(db, "exp-1"))) as {
			expense: { id: string; status: string };
			storedInactiveMembers: unknown[];
		};

		expect(result.expense.id).toBe("exp-1");
		expect(result.expense.status).toBe("reversed");
		expect(result.storedInactiveMembers).toEqual([]);
	});

	it("rejects a reversed expense whose replacement is already visible", async () => {
		const { db } = seedTables([
			expenseRow(),
			expenseRow({ id: "exp-2", reference: null, status: "posted", replaces_id: "exp-1", reversed_by_id: null }),
		]);

		let thrown: { status: number; body: { message: string } } | null = null;
		try {
			await load(loadEvent(db, "exp-1"));
		} catch (error) {
			thrown = error as { status: number; body: { message: string } };
		}

		expect(thrown).not.toBeNull();
		expect(thrown!.status).toBe(400);
		expect(thrown!.body.message).toContain("ya tiene una corrección");
	});
});
