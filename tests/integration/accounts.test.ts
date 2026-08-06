import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import type { Kysely } from "kysely";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { preseedDatabase } from "../../scripts/database/preseed";
import { orderingKeyFor } from "../../src/lib/accounts/model";
import {
	createAccountEntryRepository,
	createAccountHolderRepository,
	createAccountRepository,
	createAccountTransferRepository,
	createBalanceObservationRepository,
} from "../../src/lib/server/accounts/repository";
import { createTransferService } from "../../src/lib/server/accounts/transfers";
import { createObservationService } from "../../src/lib/server/accounts/balance";
import { createDatabase } from "../../src/lib/server/database/db";
import { createContributionRepository, createDistributionRepository } from "../../src/lib/server/funding/repository";
import { createFundingService } from "../../src/lib/server/funding/service";
import { createMemberRepository } from "../../src/lib/server/household/repository";
import { visibleToProjection } from "../../src/lib/server/operations/visibility";
import { financialAccountsAndFunding } from "../../src/lib/server/database/migrations/0003_financial_accounts_and_funding";
import { runMigrations } from "../../src/lib/server/database/migrator";
import type { Database } from "../../src/lib/server/database/schema";

const ALL_TABLES = [
	"consumed_recovery_credentials",
	"activity_events",
	"sessions",
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

function sequentialId() {
	let n = 0;
	return () => `id-${++n}`;
}

const TS = "2026-08-04T12:00:00.000Z";

describe.sequential("D1 financial accounts integration", () => {
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

	it("keeps the financial accounts migration replay-safe", async () => {
		await financialAccountsAndFunding.up(db);
		await financialAccountsAndFunding.up(db);

		await expect(db.selectFrom("accounts").selectAll().execute()).resolves.toEqual([]);
		await expect(db.selectFrom("account_transfers").selectAll().execute()).resolves.toEqual([]);
	});

	it("reverses the financial accounts migration cleanly", async () => {
		await financialAccountsAndFunding.down!(db);

		await expect(db.selectFrom("accounts").selectAll().execute()).rejects.toThrow();
		await expect(db.selectFrom("account_entries").selectAll().execute()).rejects.toThrow();

		await financialAccountsAndFunding.up(db);
	});

	it("creates the expected indexes", async () => {
		const rows = await db.introspection.getTables({ withInternalKyselyTables: true });
		const names = rows.map((row) => row.name);

		for (const table of [
			"accounts",
			"account_holder_intervals",
			"balance_observations",
			"account_transfers",
			"account_entries",
			"contributions",
			"contribution_allocations",
			"distributions",
			"distribution_allocations",
		]) {
			expect(names).toContain(table);
		}

		const indexes = await proxy.env.DB.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'",
		).all();
		const indexNames = indexes.results.map((row) => row["name"]);
		for (const index of [
			"idx_accounts_household",
			"idx_account_holder_intervals_account",
			"idx_account_holder_intervals_member",
			"idx_balance_observations_account",
			"idx_account_transfers_household",
			"idx_account_transfers_source",
			"idx_account_transfers_destination",
			"idx_account_transfers_operation",
			"idx_account_entries_account",
			"idx_account_entries_transfer",
			"idx_contributions_transfer",
			"idx_contributions_household",
			"idx_contribution_allocations_contribution",
			"idx_contribution_allocations_member",
			"idx_distributions_transfer",
			"idx_distributions_household",
			"idx_distribution_allocations_distribution",
			"idx_distribution_allocations_member",
		]) {
			expect(indexNames).toContain(index);
		}
	});

	async function seedHouseholdWithAccounts() {
		await db
			.insertInto("households")
			.values({
				id: "hh-1",
				name: "Piso",
				currency: "EUR",
				timezone: "Europe/Madrid",
				locale: "es-ES",
				version: "v1",
				created_at: TS,
				updated_at: TS,
			})
			.execute();
		await db
			.insertInto("members")
			.values([
				{ id: "m-1", household_id: "hh-1", display_name: "Alex", is_active: 1, created_at: TS, updated_at: TS },
				{ id: "m-2", household_id: "hh-1", display_name: "Sam", is_active: 1, created_at: TS, updated_at: TS },
			])
			.execute();
		const accounts = createAccountRepository(db);
		await accounts.create(
			{ id: "acc-personal", householdId: "hh-1", name: "Cuenta de Alex", classification: "personal", currency: "EUR" },
			TS,
		);
		await accounts.create(
			{ id: "acc-shared", householdId: "hh-1", name: "Común", classification: "shared", currency: "EUR" },
			TS,
		);
		await accounts.updateStatus("acc-personal", "active", TS);
		await accounts.updateStatus("acc-shared", "active", TS);
		const holders = createAccountHolderRepository(db);
		return { accounts, holders };
	}

	it("enforces transfer account referential integrity", async () => {
		await seedHouseholdWithAccounts();

		await expect(
			db
				.insertInto("account_transfers")
				.values({
					id: "t-bad",
					household_id: "hh-1",
					source_account_id: "acc-personal",
					destination_account_id: "missing",
					amount_minor: 100,
					effective_at: TS,
					ordering_key: orderingKeyFor(TS, "t-bad"),
					recorded_at: TS,
					description: "",
					classification: "pure",
					status: "posted",
					chain_root_id: "t-bad",
					reversal_of_id: null,
					replaces_id: null,
					reversed_by_id: null,
					operation_id: null,
					created_at: TS,
				})
				.execute(),
		).rejects.toThrow();
	});

	it("enforces exactly one funding classification per transfer", async () => {
		await seedHouseholdWithAccounts();
		const transfers = createAccountTransferRepository(db);
		const transfer = {
			id: "t-1",
			householdId: "hh-1",
			sourceAccountId: "acc-personal",
			destinationAccountId: "acc-shared",
			amountMinor: 100,
			effectiveAt: TS,
			orderingKey: orderingKeyFor(TS, "t-1"),
			recordedAt: TS,
			description: "",
			classification: "contribution" as const,
			chainRootId: "t-1",
		};
		await transfers.create(transfer);

		const contribution = {
			household_id: "hh-1",
			transfer_id: "t-1",
			member_id: "m-1",
			amount_minor: 100,
			status: "posted",
			recorded_at: TS,
			operation_id: null,
		};
		await db
			.insertInto("contributions")
			.values({ id: "c-1", ...contribution })
			.execute();

		await expect(
			db
				.insertInto("contributions")
				.values({ id: "c-2", ...contribution })
				.execute(),
		).rejects.toThrow();
	});

	it("projects exactly one debit and one credit through the real repositories", async () => {
		await seedHouseholdWithAccounts();
		const service = createTransferService(
			createAccountRepository(db),
			createAccountTransferRepository(db),
			createAccountEntryRepository(db),
		);

		const posted = await service.postTransfer(
			"hh-1",
			{
				sourceAccountId: "acc-personal",
				destinationAccountId: "acc-shared",
				amountMinor: 10000,
				effectiveAt: TS,
				description: "Traspaso",
				classification: "pure",
			},
			TS,
		);

		const personalEntries = await createAccountEntryRepository(db).findByAccount("acc-personal");
		const sharedEntries = await createAccountEntryRepository(db).findByAccount("acc-shared");
		expect(personalEntries).toHaveLength(1);
		expect(personalEntries[0]).toMatchObject({ transferId: posted.id, amountMinor: -10000 });
		expect(sharedEntries).toHaveLength(1);
		expect(sharedEntries[0]).toMatchObject({ transferId: posted.id, amountMinor: 10000 });
	});

	it("hides account entries whose operation never completed", async () => {
		await seedHouseholdWithAccounts();
		await db
			.insertInto("operation_roots")
			.values({
				id: "op-pending",
				household_id: "hh-1",
				actor_user_id: null,
				operation_type: "mutation",
				payload_fingerprint: "fp",
				status: "pending",
				result_type: null,
				created_at: TS,
				completed_at: null,
			})
			.execute();
		const service = createTransferService(
			createAccountRepository(db),
			createAccountTransferRepository(db),
			createAccountEntryRepository(db),
		);
		await service.postTransfer(
			"hh-1",
			{
				sourceAccountId: "acc-personal",
				destinationAccountId: "acc-shared",
				amountMinor: 500,
				effectiveAt: TS,
				description: "Invisible",
				classification: "pure",
			},
			TS,
			"op-pending",
		);

		const entries = await createAccountEntryRepository(db).findByAccount("acc-personal");

		expect(entries).toHaveLength(0);
	});

	it("hides transfers and observations of incomplete operations from projections", async () => {
		await seedHouseholdWithAccounts();
		await db
			.insertInto("operation_roots")
			.values({
				id: "op-pending",
				household_id: "hh-1",
				actor_user_id: null,
				operation_type: "mutation",
				payload_fingerprint: "fp",
				status: "pending",
				result_type: null,
				created_at: TS,
				completed_at: null,
			})
			.execute();
		const transferService = createTransferService(
			createAccountRepository(db),
			createAccountTransferRepository(db),
			createAccountEntryRepository(db),
		);
		await transferService.postTransfer(
			"hh-1",
			{
				sourceAccountId: "acc-personal",
				destinationAccountId: "acc-shared",
				amountMinor: 500,
				effectiveAt: TS,
				description: "Invisible",
				classification: "pure",
			},
			TS,
			"op-pending",
		);
		const observationService = createObservationService(
			createAccountRepository(db),
			createBalanceObservationRepository(db),
			createAccountEntryRepository(db),
		);
		await observationService.recordObservation(
			"hh-1",
			{ accountId: "acc-shared", amountMinor: 99900, effectiveAt: TS },
			TS,
			"op-pending",
		);

		await expect(transferService.listTransfersByAccount("hh-1", "acc-shared")).resolves.toHaveLength(0);
		const balance = await observationService.getEstimatedBalance("hh-1", "acc-shared", "2026-08-05T00:00:00.000Z");
		expect(balance.kind).toBe("unavailable");
	});

	async function insertOperationRoot(id: string, status: "pending" | "complete") {
		await db
			.insertInto("operation_roots")
			.values({
				id,
				household_id: "hh-1",
				actor_user_id: null,
				operation_type: "mutation",
				payload_fingerprint: "fp",
				status,
				result_type: null,
				created_at: TS,
				completed_at: status === "complete" ? TS : null,
			})
			.execute();
	}

	function fundingServices() {
		const accounts = createAccountRepository(db);
		const transfers = createAccountTransferRepository(db);
		const entries = createAccountEntryRepository(db);
		const holders = createAccountHolderRepository(db);
		return {
			accounts,
			transfers,
			entries,
			funding: createFundingService(
				{ accounts, transfers, entries },
				{
					contributions: createContributionRepository(db),
					distributions: createDistributionRepository(db),
				},
				{ holders, members: createMemberRepository(db) },
			),
			holders,
		};
	}

	it("resumes a half-applied classification without duplicating the funding row", async () => {
		const { accounts, holders } = await seedHouseholdWithAccounts();
		await holders.addInterval({ id: "hi-p", accountId: "acc-personal", memberId: "m-1", effectiveFrom: TS });
		const { transfers, funding } = fundingServices();
		const { createTransferService } = await import("../../src/lib/server/accounts/transfers");
		const transferService = createTransferService(accounts, transfers, createAccountEntryRepository(db));
		const transfer = await transferService.postTransfer(
			"hh-1",
			{
				sourceAccountId: "acc-personal",
				destinationAccountId: "acc-shared",
				amountMinor: 6000,
				effectiveAt: TS,
				description: "Aporte",
				classification: "unclassified",
			},
			TS,
		);

		// Crash simulation: classification flipped, funding row pinned to a failed operation
		await transfers.updateClassification(transfer.id, "contribution");
		await insertOperationRoot("op-failed", "pending");
		await db
			.insertInto("contributions")
			.values({
				id: "c-orphan",
				household_id: "hh-1",
				transfer_id: transfer.id,
				member_id: "m-1",
				amount_minor: 6000,
				status: "posted",
				recorded_at: TS,
				operation_id: "op-failed",
			})
			.execute();
		await db
			.insertInto("contribution_allocations")
			.values({ id: "ca-orphan", contribution_id: "c-orphan", member_id: "m-1", amount_minor: 6000 })
			.execute();

		await insertOperationRoot("op-resume", "pending");
		const contribution = await funding.classifyAsContribution("hh-1", transfer.id, "m-1", TS, "op-resume");

		expect(contribution.id).toBe("c-orphan");
		const rows = await db.selectFrom("contributions").selectAll().execute();
		expect(rows).toHaveLength(1);
		expect(rows[0]!.operation_id).toBe("op-resume");

		await db
			.updateTable("operation_roots")
			.set({ status: "complete", completed_at: TS })
			.where("id", "=", "op-resume")
			.execute();
		const totals = await funding.getNetFunding("hh-1");
		expect(totals.find((t) => t.memberId === "m-1")).toMatchObject({ contributionsMinor: 6000 });
	});

	it("resumes a half-applied classification whose funding row predates the flip", async () => {
		const { accounts, holders } = await seedHouseholdWithAccounts();
		await holders.addInterval({ id: "hi-p", accountId: "acc-personal", memberId: "m-1", effectiveFrom: TS });
		const { transfers, funding } = fundingServices();
		const { createTransferService } = await import("../../src/lib/server/accounts/transfers");
		const transferService = createTransferService(accounts, transfers, createAccountEntryRepository(db));
		const transfer = await transferService.postTransfer(
			"hh-1",
			{
				sourceAccountId: "acc-personal",
				destinationAccountId: "acc-shared",
				amountMinor: 6000,
				effectiveAt: TS,
				description: "Aporte",
				classification: "unclassified",
			},
			TS,
		);

		// Crash simulation: funding row inserted (invisible), classification never flipped
		await insertOperationRoot("op-failed", "pending");
		await db
			.insertInto("contributions")
			.values({
				id: "c-crashed",
				household_id: "hh-1",
				transfer_id: transfer.id,
				member_id: "m-1",
				amount_minor: 6000,
				status: "posted",
				recorded_at: TS,
				operation_id: "op-failed",
			})
			.execute();
		await db
			.insertInto("contribution_allocations")
			.values({ id: "ca-crashed", contribution_id: "c-crashed", member_id: "m-1", amount_minor: 6000 })
			.execute();

		await insertOperationRoot("op-resume", "pending");
		const contribution = await funding.classifyAsContribution("hh-1", transfer.id, "m-1", TS, "op-resume");

		expect(contribution.id).toBe("c-crashed");
		const rows = await db.selectFrom("contributions").selectAll().execute();
		expect(rows).toHaveLength(1);
		expect(rows[0]!.operation_id).toBe("op-resume");
		const updated = await transfers.findById(transfer.id);
		expect(updated!.classification).toBe("contribution");

		await db
			.updateTable("operation_roots")
			.set({ status: "complete", completed_at: TS })
			.where("id", "=", "op-resume")
			.execute();
		const totals = await funding.getNetFunding("hh-1");
		expect(totals.find((t) => t.memberId === "m-1")).toMatchObject({ contributionsMinor: 6000 });
	});

	it("resumes a half-applied funding correction to a consistent final state", async () => {
		const { accounts, holders } = await seedHouseholdWithAccounts();
		await holders.addInterval({ id: "hi-p", accountId: "acc-personal", memberId: "m-1", effectiveFrom: TS });
		const { transfers, funding } = fundingServices();
		const { insertReversalRows } = await import("../../src/lib/server/accounts/transfers");
		const posted = await funding.postContribution(
			"hh-1",
			{
				sourceAccountId: "acc-personal",
				destinationAccountId: "acc-shared",
				amountMinor: 6000,
				effectiveAt: TS,
				description: "Aporte",
				memberId: "m-1",
			},
			TS,
		);

		// Crash simulation: reversal rows + both flips happened under a failed operation
		await insertOperationRoot("op-failed", "pending");
		const crashed = await insertReversalRows(
			{ accounts, transfers, entries: createAccountEntryRepository(db) },
			posted.transfer,
			TS,
			"op-failed",
		);
		await transfers.markReversed(posted.transfer.id, crashed.id);
		await db
			.updateTable("contributions")
			.set({ status: "reversed" })
			.where("id", "=", posted.contribution.id)
			.execute();

		await insertOperationRoot("op-resume", "pending");
		const { reversal } = await funding.correctFundingTransfer("hh-1", posted.transfer.id, null, TS, "op-resume");
		await db
			.updateTable("operation_roots")
			.set({ status: "complete", completed_at: TS })
			.where("id", "=", "op-resume")
			.execute();

		expect(reversal.id).not.toBe(crashed.id);
		const totals = await funding.getNetFunding("hh-1");
		expect(totals.find((t) => t.memberId === "m-1")?.netMinor ?? 0).toBe(0);
		const visibleReversals = await db
			.selectFrom("account_transfers")
			.leftJoin("operation_roots", "operation_roots.id", "account_transfers.operation_id")
			.selectAll("account_transfers")
			.where("reversal_of_id", "=", posted.transfer.id)
			.where((eb) => visibleToProjection(eb, "account_transfers.operation_id"))
			.execute();
		expect(visibleReversals).toHaveLength(1);

		// A further correction attempt now fails as genuinely reversed
		await expect(funding.correctFundingTransfer("hh-1", posted.transfer.id, null, TS, "op-x")).rejects.toThrow(
			"transfer_already_reversed",
		);
	});

	it("hides activity events of incomplete operations", async () => {
		const { createActivityRepository } = await import("../../src/lib/server/activity/repository");
		await seedHouseholdWithAccounts();
		await insertOperationRoot("op-pending", "pending");
		const activity = createActivityRepository(db);
		await activity.append(
			{
				id: "evt-1",
				householdId: "hh-1",
				eventType: "transfer_posted",
				subjectType: "transfer",
				subjectId: "t-1",
				actorUserId: null,
				occurredAt: TS,
				summary: {},
				operationId: "op-pending",
			},
			TS,
		);

		await expect(activity.findByHousehold("hh-1")).resolves.toHaveLength(0);

		await db
			.updateTable("operation_roots")
			.set({ status: "complete", completed_at: TS })
			.where("id", "=", "op-pending")
			.execute();
		await expect(activity.findByHousehold("hh-1")).resolves.toHaveLength(1);
	});

	it("computes an estimated balance from a real observation and entries", async () => {
		await seedHouseholdWithAccounts();
		const accountRepo = createAccountRepository(db);
		const observationService = createObservationService(
			accountRepo,
			createBalanceObservationRepository(db),
			createAccountEntryRepository(db),
		);
		const transferService = createTransferService(
			accountRepo,
			createAccountTransferRepository(db),
			createAccountEntryRepository(db),
		);

		await observationService.recordObservation(
			"hh-1",
			{ accountId: "acc-shared", amountMinor: 50000, effectiveAt: "2026-08-01T00:00:00.000Z" },
			TS,
		);
		await transferService.postTransfer(
			"hh-1",
			{
				sourceAccountId: "acc-personal",
				destinationAccountId: "acc-shared",
				amountMinor: 10000,
				effectiveAt: "2026-08-03T00:00:00.000Z",
				description: "Aporte",
				classification: "pure",
			},
			TS,
		);

		const balance = await observationService.getEstimatedBalance("hh-1", "acc-shared", "2026-08-05T00:00:00.000Z");
		expect(balance).toMatchObject({ kind: "estimated", amountMinor: 60000 });

		const unavailable = await observationService.getEstimatedBalance(
			"hh-1",
			"acc-personal",
			"2026-08-05T00:00:00.000Z",
		);
		expect(unavailable.kind).toBe("unavailable");
	});

	it("tracks current holders through intervals", async () => {
		await seedHouseholdWithAccounts();
		const holders = createAccountHolderRepository(db);
		await holders.addInterval({ id: "hi-1", accountId: "acc-shared", memberId: "m-1", effectiveFrom: TS });
		await holders.addInterval({ id: "hi-2", accountId: "acc-shared", memberId: "m-2", effectiveFrom: TS });

		await expect(holders.currentHolderMemberIds("acc-shared")).resolves.toEqual(["m-1", "m-2"]);

		await holders.replaceHolders("acc-shared", ["m-1"], "2026-08-05T00:00:00.000Z");
		await expect(holders.currentHolderMemberIds("acc-shared")).resolves.toEqual(["m-1"]);
		const history = await holders.findByAccount("acc-shared");
		expect(history).toHaveLength(3);
		expect(history.filter((interval) => interval.effectiveTo !== null)).toHaveLength(2);
	});

	it("preseeds representative accounts, funding, observations, and corrections", async () => {
		const result = await preseedDatabase(db, {
			createId: sequentialId(),
			now: () => new Date("2026-08-03T12:00:00.000Z"),
			salt: new Uint8Array(16).fill(7),
		});

		expect(result).toMatchObject({ accounts: 5, transfers: 8, observations: 4 });

		const accounts = await db.selectFrom("accounts").selectAll().execute();
		expect(accounts).toHaveLength(5);
		expect(accounts.filter((account) => account.status === "closed")).toHaveLength(1);
		expect(accounts.filter((account) => account.classification === "shared")).toHaveLength(2);

		const transfers = await db.selectFrom("account_transfers").selectAll().execute();
		expect(transfers).toHaveLength(8);
		expect(transfers.filter((transfer) => transfer.status === "reversed")).toHaveLength(1);
		expect(transfers.filter((transfer) => transfer.classification === "contribution")).toHaveLength(2);
		expect(transfers.filter((transfer) => transfer.classification === "distribution")).toHaveLength(1);
		expect(transfers.filter((transfer) => transfer.classification === "unclassified")).toHaveLength(1);

		const entries = await db.selectFrom("account_entries").selectAll().execute();
		expect(entries).toHaveLength(16);
		for (const transfer of transfers) {
			const pair = entries.filter((entry) => entry.transfer_id === transfer.id);
			expect(pair).toHaveLength(2);
			expect(pair.reduce((sum, entry) => sum + entry.amount_minor, 0)).toBe(0);
		}

		const observations = await db.selectFrom("balance_observations").selectAll().execute();
		expect(observations).toHaveLength(4);
		expect(observations.filter((observation) => observation.status === "invalidated")).toHaveLength(1);

		const contributions = await db.selectFrom("contributions").selectAll().execute();
		expect(contributions).toHaveLength(2);
		const contributionAllocations = await db.selectFrom("contribution_allocations").selectAll().execute();
		expect(contributionAllocations).toHaveLength(2);

		const distributions = await db.selectFrom("distributions").selectAll().execute();
		expect(distributions).toHaveLength(1);
		const distributionAllocations = await db.selectFrom("distribution_allocations").selectAll().execute();
		expect(distributionAllocations).toHaveLength(1);

		const holders = await db.selectFrom("account_holder_intervals").selectAll().execute();
		expect(holders).toHaveLength(7);
	});

	// --- data-bearing safety ---
	it("keeps pending-operation funding allocations out of net funding", async () => {
		const { holders } = await seedHouseholdWithAccounts();
		await holders.addInterval({ id: "hi-p", accountId: "acc-personal", memberId: "m-1", effectiveFrom: TS });
		const { funding } = fundingServices();

		await insertOperationRoot("op-pending", "pending");
		await funding.postContribution(
			"hh-1",
			{
				sourceAccountId: "acc-personal",
				destinationAccountId: "acc-shared",
				amountMinor: 6000,
				effectiveAt: TS,
				description: "Aporte",
				memberId: "m-1",
			},
			TS,
			"op-pending",
		);

		await expect(funding.getNetFunding("hh-1")).resolves.toEqual([]);

		await db
			.updateTable("operation_roots")
			.set({ status: "complete", completed_at: TS })
			.where("id", "=", "op-pending")
			.execute();
		const totals = await funding.getNetFunding("hh-1");
		expect(totals.find((t) => t.memberId === "m-1")).toMatchObject({ contributionsMinor: 6000 });
	});

	it("replays the migration over tables that already contain data", async () => {
		await preseedDatabase(db, { createId: sequentialId(), salt: new Uint8Array(16).fill(7) });

		const before = await db.selectFrom("account_transfers").selectAll().execute();
		await financialAccountsAndFunding.up(db);
		await financialAccountsAndFunding.up(db);
		const after = await db.selectFrom("account_transfers").selectAll().execute();

		expect(after).toHaveLength(before.length);
	});

	it("rejects deleting a draft account once real references exist", async () => {
		const { accounts } = await seedHouseholdWithAccounts();
		const { createAccountService } = await import("../../src/lib/server/accounts/service");
		const { createHouseholdRepository } = await import("../../src/lib/server/household/repository");
		const holders = createAccountHolderRepository(db);
		const service = createAccountService(accounts, holders, createMemberRepository(db), createHouseholdRepository(db));

		const created = await service.createAccount(
			"hh-1",
			{ name: "Borrador", classification: "personal", holderMemberIds: ["m-1"] },
			TS,
		);
		await accounts.create(
			{ id: "acc-other", householdId: "hh-1", name: "Otra", classification: "shared", currency: "EUR" },
			TS,
		);
		await accounts.updateStatus("acc-other", "active", TS);
		await db
			.insertInto("account_transfers")
			.values({
				id: "t-ref",
				household_id: "hh-1",
				source_account_id: created.id,
				destination_account_id: "acc-other",
				amount_minor: 100,
				effective_at: TS,
				ordering_key: orderingKeyFor(TS, "t-ref"),
				recorded_at: TS,
				description: "",
				classification: "pure",
				status: "posted",
				chain_root_id: "t-ref",
				reversal_of_id: null,
				replaces_id: null,
				reversed_by_id: null,
				operation_id: null,
				created_at: TS,
			})
			.execute();

		await expect(service.deleteDraftAccount("hh-1", created.id)).rejects.toThrow("account_referenced");
		await expect(service.deleteDraftAccount("hh-1", "acc-other")).rejects.toThrow("account_not_draft");
	});
});
