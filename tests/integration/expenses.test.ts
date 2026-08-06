import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import type { Kysely } from "kysely";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { preseedDatabase } from "../../scripts/database/preseed";
import { createObservationService } from "../../src/lib/server/accounts/balance";
import { createAccountRepository, createBalanceObservationRepository } from "../../src/lib/server/accounts/repository";
import { createCombinedEntryReader } from "../../src/lib/server/expenses/entries";
import { createExpenseServices } from "../../src/lib/server/expenses/services";
import { createDatabase } from "../../src/lib/server/database/db";
import { expensesAndPlanning } from "../../src/lib/server/database/migrations/0004_expenses_and_planning";
import { runMigrations } from "../../src/lib/server/database/migrator";
import type { Database } from "../../src/lib/server/database/schema";

const ALL_TABLES = [
	"expense_evidence",
	"payment_applications",
	"payment_account_entries",
	"payments",
	"expense_allocation_params",
	"expense_allocations",
	"expenses",
	"recurring_template_allocation_params",
	"recurring_templates",
	"reporting_periods",
	"expense_categories",
	"consumed_recovery_credentials",
	"activity_events",
	"sessions",
	"distribution_allocations",
	"distributions",
	"contribution_allocations",
	"contributions",
	"account_entries",
	"account_transfers",
	"balance_observations",
	"account_holder_intervals",
	"accounts",
	"member_intervals",
	"members",
	"users",
	"operation_roots",
	"household_command_gates",
	"households",
	"bootstrap_gate",
] as const satisfies readonly (keyof Database)[];

const TS = "2026-08-04T12:00:00.000Z";
const HH = "hh-1";
const USER = "user-1";

describe.sequential("D1 expenses and planning integration", () => {
	let proxy: PlatformProxy<{ DB: D1Database }>;
	let db: Kysely<Database>;

	beforeAll(async () => {
		proxy = await getPlatformProxy({
			configPath: "wrangler.jsonc",
			persist: false,
			remoteBindings: false,
		});
		db = createDatabase(proxy.env.DB);
		await runMigrations(db);
	});

	beforeEach(async () => {
		for (const table of ALL_TABLES) {
			await db.deleteFrom(table).execute();
		}
	});

	afterAll(async () => {
		await db?.destroy();
		await proxy?.dispose();
	});

	it("keeps the expenses migration replay-safe and reversible", async () => {
		await expensesAndPlanning.up(db);
		await expensesAndPlanning.up(db);

		await expect(db.selectFrom("expenses").selectAll().execute()).resolves.toEqual([]);
		await expect(db.selectFrom("payments").selectAll().execute()).resolves.toEqual([]);

		await expensesAndPlanning.down!(db);
		await expect(db.selectFrom("expenses").selectAll().execute()).rejects.toThrow();
		await expect(db.selectFrom("payment_applications").selectAll().execute()).rejects.toThrow();

		await expensesAndPlanning.up(db);
		await expect(db.selectFrom("expenses").selectAll().execute()).resolves.toEqual([]);
	});

	it("creates the expected tables and indexes", async () => {
		const rows = await db.introspection.getTables({ withInternalKyselyTables: true });
		const names = rows.map((row) => row.name);
		for (const table of [
			"expense_categories",
			"reporting_periods",
			"recurring_templates",
			"recurring_template_allocation_params",
			"expenses",
			"expense_allocations",
			"expense_allocation_params",
			"payments",
			"payment_account_entries",
			"payment_applications",
			"expense_evidence",
		]) {
			expect(names).toContain(table);
		}

		const indexes = await proxy.env.DB.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'",
		).all();
		const indexNames = indexes.results.map((row) => row["name"]);
		for (const index of [
			"idx_expense_categories_household_slug",
			"idx_reporting_periods_household_slug",
			"idx_expenses_household_period",
			"idx_expenses_household_reference",
			"idx_expenses_household_accounting_date",
			"idx_expenses_category",
			"idx_expenses_template_occurrence",
			"idx_payment_applications_expense",
			"idx_payment_applications_payment",
			"idx_payment_account_entries_account",
		]) {
			expect(indexNames).toContain(index);
		}
	});

	async function seedHousehold() {
		await db
			.insertInto("households")
			.values({
				id: HH,
				name: "Piso",
				currency: "EUR",
				timezone: "Europe/Madrid",
				locale: "es-ES",
				version: "v1",
				created_at: TS,
				updated_at: TS,
			})
			.execute();
		const services = createExpenseServices(db);
		const { members, accounts, holders } = services.repositories;
		await members.create({ id: "m-1", householdId: HH, displayName: "Alex", defaultWeight: 1 }, TS);
		await members.create({ id: "m-2", householdId: HH, displayName: "Sam", defaultWeight: 3 }, TS);
		await accounts.create(
			{ id: "acc-personal", householdId: HH, name: "Cuenta de Alex", classification: "personal", currency: "EUR" },
			TS,
		);
		await accounts.create(
			{ id: "acc-shared", householdId: HH, name: "Común", classification: "shared", currency: "EUR" },
			TS,
		);
		await accounts.updateStatus("acc-personal", "active", TS);
		await accounts.updateStatus("acc-shared", "active", TS);
		await holders.addInterval({ id: "h-1", accountId: "acc-personal", memberId: "m-1", effectiveFrom: TS });
		await holders.addInterval({ id: "h-2", accountId: "acc-shared", memberId: "m-1", effectiveFrom: TS });
		await holders.addInterval({ id: "h-3", accountId: "acc-shared", memberId: "m-2", effectiveFrom: TS });
		return services;
	}

	it("enforces expense category referential integrity", async () => {
		await seedHousehold();
		await expect(
			db
				.insertInto("expenses")
				.values({
					id: "e-bad",
					household_id: HH,
					category_id: "missing",
					reporting_period_id: "missing",
					description: "Roto",
					reference: null,
					status: "draft",
					planned_amount_minor: null,
					planned_version: 1,
					actual_amount_minor: 100,
					accounting_date: "2026-08-01",
					due_date: null,
					service_start_date: null,
					service_end_date: null,
					allocation_method: "equal",
					account_hint_id: null,
					template_id: null,
					scheduled_due_date: null,
					realized_by_expense_id: null,
					chain_root_id: "e-bad",
					replaces_id: null,
					reversed_by_id: null,
					actor_user_id: null,
					operation_id: null,
					created_at: TS,
					updated_at: TS,
				})
				.execute(),
		).rejects.toThrow();
	});

	it("enforces unique standard period slugs per household", async () => {
		const services = await seedHousehold();
		await services.planningService.ensureStandardPeriod(HH, "2026-08", TS, null);
		await expect(
			db
				.insertInto("reporting_periods")
				.values({
					id: "p-dup",
					household_id: HH,
					slug: "2026-08",
					label: "Duplicado",
					start_date: "2026-08-01",
					end_date: "2026-09-01",
					kind: "standard",
					created_at: TS,
					operation_id: null,
				})
				.execute(),
		).rejects.toThrow();
	});

	it("resolves deterministic reference collisions through the real repositories", async () => {
		const services = await seedHousehold();
		const category = await services.expenseService.createCategory(HH, { name: "Luz" }, TS, null);
		const period = await services.planningService.ensureStandardPeriod(HH, "2026-08", TS, null);
		const input = {
			categoryId: category.id,
			reportingPeriodId: period.id,
			description: "Factura de la luz",
			actualAmountMinor: 10000,
			accountingDate: "2026-08-03",
			allocation: { method: "equal" as const, members: [{ memberId: "m-1" }, { memberId: "m-2" }] },
		};

		const first = await services.expenseService.postExpense(HH, input, USER, TS, null);
		const second = await services.expenseService.postExpense(HH, input, USER, TS, null);

		expect(first.reference).toBe("luz/2026-08");
		expect(second.reference).toBe("luz/2026-08-2");
	});

	it("generates exactly one occurrence per template and scheduled date", async () => {
		const services = await seedHousehold();
		const category = await services.expenseService.createCategory(HH, { name: "Vivienda" }, TS, null);
		await services.planningService.createTemplate(
			HH,
			{
				categoryId: category.id,
				description: "Alquiler",
				estimatedAmountMinor: 90000,
				cadence: "monthly",
				intervalCount: 1,
				startDate: "2026-01-05",
				allocationMethod: "equal",
				allocationParams: [
					{ memberId: "m-1", value: null },
					{ memberId: "m-2", value: null },
				],
			},
			TS,
			null,
		);

		const first = await services.planningService.materializeStandardPeriod(HH, "2026-08", USER, TS, null);
		const second = await services.planningService.materializeStandardPeriod(HH, "2026-08", USER, TS, null);

		expect(first.created).toHaveLength(1);
		expect(second.created).toHaveLength(0);
		const occurrences = await db
			.selectFrom("expenses")
			.selectAll()
			.where("scheduled_due_date", "=", "2026-08-05")
			.execute();
		expect(occurrences).toHaveLength(1);
	});

	it("debits the account exactly once and folds payments into the balance", async () => {
		const services = await seedHousehold();
		const observationService = createObservationService(
			createAccountRepository(db),
			createBalanceObservationRepository(db),
			createCombinedEntryReader(db),
		);
		await observationService.recordObservation(
			HH,
			{ accountId: "acc-shared", amountMinor: 100000, effectiveAt: TS },
			TS,
		);

		const payment = await services.paymentService.postPayment(
			HH,
			{
				accountId: "acc-shared",
				amountMinor: 30000,
				effectiveAt: "2026-08-05T00:00:00.000Z",
				description: "Supermercado",
			},
			USER,
			TS,
			null,
		);

		const entries = await services.repositories.paymentEntries.findByAccount("acc-shared");
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({ paymentId: payment.id, amountMinor: -30000 });

		const balance = await observationService.getEstimatedBalance(HH, "acc-shared", "2026-08-06T00:00:00.000Z");
		expect(balance).toMatchObject({ kind: "estimated", amountMinor: 70000 });
	});

	it("restores the account effect when a payment reverses", async () => {
		const services = await seedHousehold();
		const payment = await services.paymentService.postPayment(
			HH,
			{ accountId: "acc-shared", amountMinor: 30000, effectiveAt: TS, description: "Supermercado" },
			USER,
			TS,
			null,
		);
		await services.paymentService.correctPayment(HH, payment.id, null, USER, TS, null);

		const entries = await services.repositories.paymentEntries.findByAccount("acc-shared");
		expect(entries).toHaveLength(2);
		expect(entries.reduce((sum, entry) => sum + entry.amountMinor, 0)).toBe(0);
	});

	it("hides expense-domain rows of incomplete operations from projections", async () => {
		const services = await seedHousehold();
		await db
			.insertInto("operation_roots")
			.values({
				id: "op-pending",
				household_id: HH,
				actor_user_id: null,
				operation_type: "mutation",
				payload_fingerprint: "fp",
				status: "pending",
				result_type: null,
				created_at: TS,
				completed_at: null,
			})
			.execute();

		const category = await services.expenseService.createCategory(HH, { name: "Luz" }, TS, null);
		const period = await services.planningService.ensureStandardPeriod(HH, "2026-08", TS, null);
		const expense = await services.expenseService.postExpense(
			HH,
			{
				categoryId: category.id,
				reportingPeriodId: period.id,
				description: "Factura invisible",
				actualAmountMinor: 5000,
				accountingDate: "2026-08-03",
				allocation: { method: "equal" as const, members: [{ memberId: "m-1" }] },
			},
			USER,
			TS,
			"op-pending",
		);
		const payment = await services.paymentService.postPayment(
			HH,
			{ accountId: "acc-shared", amountMinor: 3000, effectiveAt: TS, description: "Pago invisible" },
			USER,
			TS,
			"op-pending",
		);
		await services.paymentService.applyPayment(
			HH,
			payment.id,
			[{ expenseId: expense.id, amountMinor: 3000 }],
			TS,
			"op-pending",
		);

		// While the operation is pending, every projection hides its rows.
		await expect(services.repositories.expenses.findVisibleById(expense.id)).resolves.toBeUndefined();
		await expect(services.repositories.expenses.listByPeriod(HH, period.id)).resolves.toEqual([]);
		await expect(services.repositories.payments.findVisibleById(payment.id)).resolves.toBeUndefined();
		await expect(services.repositories.applications.findActiveByExpense(expense.id)).resolves.toEqual([]);
		await expect(services.repositories.applications.findActiveByPayment(payment.id)).resolves.toEqual([]);

		// Completing the root publishes every row of the operation.
		await db
			.updateTable("operation_roots")
			.set({ status: "complete", completed_at: TS })
			.where("id", "=", "op-pending")
			.execute();

		await expect(services.repositories.expenses.findVisibleById(expense.id)).resolves.toMatchObject({ id: expense.id });
		await expect(services.repositories.expenses.listByPeriod(HH, period.id)).resolves.toHaveLength(1);
		await expect(services.repositories.payments.findVisibleById(payment.id)).resolves.toMatchObject({ id: payment.id });
		await expect(services.repositories.applications.findActiveByExpense(expense.id)).resolves.toHaveLength(1);
	});

	it("heals a crashed occurrence materialization on the next open", async () => {
		const services = await seedHousehold();
		await db
			.insertInto("operation_roots")
			.values({
				id: "op-crashed",
				household_id: HH,
				actor_user_id: null,
				operation_type: "mutation",
				payload_fingerprint: "fp",
				status: "pending",
				result_type: null,
				created_at: TS,
				completed_at: null,
			})
			.execute();
		const category = await services.expenseService.createCategory(HH, { name: "Vivienda" }, TS, null);
		await services.planningService.createTemplate(
			HH,
			{
				categoryId: category.id,
				description: "Alquiler",
				estimatedAmountMinor: 90000,
				cadence: "monthly",
				intervalCount: 1,
				startDate: "2026-01-05",
				allocationMethod: "equal",
				allocationParams: [
					{ memberId: "m-1", value: null },
					{ memberId: "m-2", value: null },
				],
			},
			TS,
			null,
		);

		// The crashed attempt leaves an invisible occurrence and period.
		const crashed = await services.planningService.materializeStandardPeriod(HH, "2026-08", USER, TS, "op-crashed");
		expect(crashed.created).toHaveLength(1);
		await expect(services.repositories.expenses.listByPeriod(HH, crashed.period.id)).resolves.toEqual([]);

		// The retry adopts them into a completing operation: exactly one
		// occurrence, now visible, and no duplicates.
		await db
			.insertInto("operation_roots")
			.values({
				id: "op-retry",
				household_id: HH,
				actor_user_id: null,
				operation_type: "mutation",
				payload_fingerprint: "fp2",
				status: "pending",
				result_type: null,
				created_at: TS,
				completed_at: null,
			})
			.execute();
		const retried = await services.planningService.materializeStandardPeriod(HH, "2026-08", USER, TS, "op-retry");
		expect(retried.created).toHaveLength(1);
		expect(retried.created[0]!.id).toBe(crashed.created[0]!.id);
		expect(retried.period.id).toBe(crashed.period.id);
		await db
			.updateTable("operation_roots")
			.set({ status: "complete", completed_at: TS })
			.where("id", "=", "op-retry")
			.execute();

		const occurrences = await db
			.selectFrom("expenses")
			.selectAll()
			.where("scheduled_due_date", "=", "2026-08-05")
			.execute();
		expect(occurrences).toHaveLength(1);
		await expect(services.repositories.expenses.listByPeriod(HH, crashed.period.id)).resolves.toHaveLength(1);
	});

	it("keeps preseed data complete and exactly balanced", async () => {
		const result = await preseedDatabase(db);
		expect(result.expenses).toBeGreaterThan(0);
		expect(result.payments).toBeGreaterThan(0);

		const categories = await db.selectFrom("expense_categories").selectAll().execute();
		expect(categories.length).toBeGreaterThanOrEqual(5);
		const templates = await db.selectFrom("recurring_templates").selectAll().execute();
		expect(templates.length).toBeGreaterThanOrEqual(2);
		const periods = await db.selectFrom("reporting_periods").selectAll().execute();
		expect(periods.length).toBeGreaterThanOrEqual(3);

		// Every posted or cancelled expense resolves exact allocation sums per basis.
		const expenses = await db.selectFrom("expenses").selectAll().execute();
		const allocations = await db.selectFrom("expense_allocations").selectAll().execute();
		for (const expense of expenses) {
			const planned = allocations
				.filter((line) => line.expense_id === expense.id && line.basis === "planned")
				.reduce((sum, line) => sum + line.amount_minor, 0);
			const actual = allocations
				.filter((line) => line.expense_id === expense.id && line.basis === "actual")
				.reduce((sum, line) => sum + line.amount_minor, 0);
			if (expense.planned_amount_minor !== null) {
				expect(planned).toBe(expense.planned_amount_minor);
			}
			if (expense.actual_amount_minor !== null) {
				expect(actual).toBe(expense.actual_amount_minor);
			}
		}

		// Every active application stays within the payment's applied value.
		const applications = await db
			.selectFrom("payment_applications")
			.selectAll()
			.where("status", "=", "active")
			.execute();
		const payments = await db.selectFrom("payments").selectAll().execute();
		for (const payment of payments) {
			const applied = applications
				.filter((application) => application.payment_id === payment.id)
				.reduce((sum, application) => sum + application.amount_minor, 0);
			expect(applied).toBeLessThanOrEqual(payment.amount_minor);
		}

		// The reversed payment chain folds to zero account effect.
		const entries = await db.selectFrom("payment_account_entries").selectAll().execute();
		const chains = new Map<string, number>();
		for (const entry of entries) {
			chains.set(entry.chain_root_id, (chains.get(entry.chain_root_id) ?? 0) + entry.amount_minor);
		}
		const reversed = payments.filter((payment) => payment.status === "reversed");
		for (const payment of reversed) {
			expect(chains.get(payment.chain_root_id)).toBe(0);
		}
	});
});
