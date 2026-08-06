import type { FundingStatus } from "$lib/accounts/model";

export interface ContributionRecord {
	id: string;
	householdId: string;
	transferId: string;
	memberId: string;
	amountMinor: number;
	status: FundingStatus;
	recordedAt: string;
	operationId: string | null;
}

export interface DistributionRecord {
	id: string;
	householdId: string;
	transferId: string;
	memberId: string;
	amountMinor: number;
	status: FundingStatus;
	recordedAt: string;
	operationId: string | null;
}

export interface CreateContributionInput {
	id: string;
	householdId: string;
	transferId: string;
	memberId: string;
	amountMinor: number;
	recordedAt: string;
	operationId?: string | null;
}

export interface CreateDistributionInput {
	id: string;
	householdId: string;
	transferId: string;
	memberId: string;
	amountMinor: number;
	recordedAt: string;
	operationId?: string | null;
}

export interface PostedAllocation {
	memberId: string;
	amountMinor: number;
	effectiveAt: string;
}

export interface ContributionRepository {
	create(input: CreateContributionInput, allocationId: string): Promise<void>;
	findByTransferId(transferId: string): Promise<ContributionRecord | undefined>;
	findVisibleByTransferId(transferId: string): Promise<ContributionRecord | undefined>;
	reattributeOperation(id: string, operationId: string | null, recordedAt: string): Promise<void>;
	markReversed(id: string): Promise<void>;
	postedAllocations(householdId: string): Promise<PostedAllocation[]>;
}

export interface DistributionRepository {
	create(input: CreateDistributionInput, allocationId: string): Promise<void>;
	findByTransferId(transferId: string): Promise<DistributionRecord | undefined>;
	findVisibleByTransferId(transferId: string): Promise<DistributionRecord | undefined>;
	reattributeOperation(id: string, operationId: string | null, recordedAt: string): Promise<void>;
	markReversed(id: string): Promise<void>;
	postedAllocations(householdId: string): Promise<PostedAllocation[]>;
}

import type { Kysely } from "kysely";
import type { Database } from "../database";
import { visibleToProjection } from "../operations/visibility";

function toContribution(row: {
	id: string;
	household_id: string;
	transfer_id: string;
	member_id: string;
	amount_minor: number;
	status: string;
	recorded_at: string;
	operation_id: string | null;
}): ContributionRecord {
	return {
		id: row.id,
		householdId: row.household_id,
		transferId: row.transfer_id,
		memberId: row.member_id,
		amountMinor: row.amount_minor,
		status: row.status as ContributionRecord["status"],
		recordedAt: row.recorded_at,
		operationId: row.operation_id,
	};
}

function toDistribution(row: {
	id: string;
	household_id: string;
	transfer_id: string;
	member_id: string;
	amount_minor: number;
	status: string;
	recorded_at: string;
	operation_id: string | null;
}): DistributionRecord {
	return {
		id: row.id,
		householdId: row.household_id,
		transferId: row.transfer_id,
		memberId: row.member_id,
		amountMinor: row.amount_minor,
		status: row.status as DistributionRecord["status"],
		recordedAt: row.recorded_at,
		operationId: row.operation_id,
	};
}

export function createContributionRepository(db: Kysely<Database>): ContributionRepository {
	return {
		async create(input, allocationId) {
			await db
				.insertInto("contributions")
				.values({
					id: input.id,
					household_id: input.householdId,
					transfer_id: input.transferId,
					member_id: input.memberId,
					amount_minor: input.amountMinor,
					status: "posted",
					recorded_at: input.recordedAt,
					operation_id: input.operationId ?? null,
				})
				.execute();
			await db
				.insertInto("contribution_allocations")
				.values({
					id: allocationId,
					contribution_id: input.id,
					member_id: input.memberId,
					amount_minor: input.amountMinor,
				})
				.execute();
		},

		async findByTransferId(transferId) {
			const row = await db
				.selectFrom("contributions")
				.selectAll()
				.where("transfer_id", "=", transferId)
				.executeTakeFirst();
			return row ? toContribution(row) : undefined;
		},

		async findVisibleByTransferId(transferId) {
			const row = await db
				.selectFrom("contributions")
				.leftJoin("operation_roots", "operation_roots.id", "contributions.operation_id")
				.selectAll("contributions")
				.where("contributions.transfer_id", "=", transferId)
				.where((eb) => visibleToProjection(eb, "contributions.operation_id"))
				.executeTakeFirst();
			return row ? toContribution(row) : undefined;
		},

		async reattributeOperation(id, operationId, recordedAt) {
			await db
				.updateTable("contributions")
				.set({ operation_id: operationId, recorded_at: recordedAt })
				.where("id", "=", id)
				.execute();
		},

		async markReversed(id) {
			await db.updateTable("contributions").set({ status: "reversed" }).where("id", "=", id).execute();
		},

		async postedAllocations(householdId) {
			const rows = await db
				.selectFrom("contribution_allocations")
				.innerJoin("contributions", "contributions.id", "contribution_allocations.contribution_id")
				.innerJoin("account_transfers", "account_transfers.id", "contributions.transfer_id")
				.leftJoin("operation_roots", "operation_roots.id", "contributions.operation_id")
				.select([
					"contribution_allocations.member_id as member_id",
					"contribution_allocations.amount_minor as amount_minor",
					"account_transfers.effective_at as effective_at",
				])
				.where("contributions.household_id", "=", householdId)
				.where("contributions.status", "=", "posted")
				.where("account_transfers.status", "=", "posted")
				.where((eb) => visibleToProjection(eb, "contributions.operation_id"))
				.execute();
			return rows.map((row) => ({
				memberId: row.member_id,
				amountMinor: row.amount_minor,
				effectiveAt: row.effective_at,
			}));
		},
	};
}

export function createDistributionRepository(db: Kysely<Database>): DistributionRepository {
	return {
		async create(input, allocationId) {
			await db
				.insertInto("distributions")
				.values({
					id: input.id,
					household_id: input.householdId,
					transfer_id: input.transferId,
					member_id: input.memberId,
					amount_minor: input.amountMinor,
					status: "posted",
					recorded_at: input.recordedAt,
					operation_id: input.operationId ?? null,
				})
				.execute();
			await db
				.insertInto("distribution_allocations")
				.values({
					id: allocationId,
					distribution_id: input.id,
					member_id: input.memberId,
					amount_minor: input.amountMinor,
				})
				.execute();
		},

		async findByTransferId(transferId) {
			const row = await db
				.selectFrom("distributions")
				.selectAll()
				.where("transfer_id", "=", transferId)
				.executeTakeFirst();
			return row ? toDistribution(row) : undefined;
		},

		async findVisibleByTransferId(transferId) {
			const row = await db
				.selectFrom("distributions")
				.leftJoin("operation_roots", "operation_roots.id", "distributions.operation_id")
				.selectAll("distributions")
				.where("distributions.transfer_id", "=", transferId)
				.where((eb) => visibleToProjection(eb, "distributions.operation_id"))
				.executeTakeFirst();
			return row ? toDistribution(row) : undefined;
		},

		async reattributeOperation(id, operationId, recordedAt) {
			await db
				.updateTable("distributions")
				.set({ operation_id: operationId, recorded_at: recordedAt })
				.where("id", "=", id)
				.execute();
		},

		async markReversed(id) {
			await db.updateTable("distributions").set({ status: "reversed" }).where("id", "=", id).execute();
		},

		async postedAllocations(householdId) {
			const rows = await db
				.selectFrom("distribution_allocations")
				.innerJoin("distributions", "distributions.id", "distribution_allocations.distribution_id")
				.innerJoin("account_transfers", "account_transfers.id", "distributions.transfer_id")
				.leftJoin("operation_roots", "operation_roots.id", "distributions.operation_id")
				.select([
					"distribution_allocations.member_id as member_id",
					"distribution_allocations.amount_minor as amount_minor",
					"account_transfers.effective_at as effective_at",
				])
				.where("distributions.household_id", "=", householdId)
				.where("distributions.status", "=", "posted")
				.where("account_transfers.status", "=", "posted")
				.where((eb) => visibleToProjection(eb, "distributions.operation_id"))
				.execute();
			return rows.map((row) => ({
				memberId: row.member_id,
				amountMinor: row.amount_minor,
				effectiveAt: row.effective_at,
			}));
		},
	};
}
