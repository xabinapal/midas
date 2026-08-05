import type { Kysely } from "kysely";
import type { Database } from "../database";

export interface HouseholdRecord {
	id: string;
	name: string;
	currency: string;
	timezone: string;
	locale: string;
	version: string;
	createdAt: string;
	updatedAt: string;
}

export interface MemberRecord {
	id: string;
	householdId: string;
	displayName: string;
	isActive: boolean;
	defaultWeight: number;
}

export interface CreateHouseholdInput {
	id: string;
	name: string;
	currency: string;
	timezone: string;
	locale: string;
	version: string;
}

export interface CreateMemberInput {
	id: string;
	householdId: string;
	displayName: string;
	defaultWeight: number;
}

export interface HouseholdRepository {
	findById(id: string): Promise<HouseholdRecord | undefined>;
	create(input: CreateHouseholdInput, now: string): Promise<void>;
	countUsersByHousehold(householdId: string): Promise<number>;
}

export interface MemberRepository {
	findByHousehold(householdId: string): Promise<MemberRecord[]>;
	findById(id: string): Promise<MemberRecord | undefined>;
	create(input: CreateMemberInput, now: string): Promise<void>;
	updateActive(memberId: string, isActive: boolean, now: string): Promise<void>;
	updateWeight(memberId: string, weight: number, now: string): Promise<void>;
	countActiveByHousehold(householdId: string): Promise<number>;
	hasFinancialReferences(memberId: string): Promise<boolean>;
}

async function currentWeight(db: Kysely<Database>, memberId: string): Promise<number> {
	const interval = await db
		.selectFrom("member_intervals")
		.select("default_weight")
		.where("member_id", "=", memberId)
		.orderBy("effective_from", "desc")
		.limit(1)
		.executeTakeFirst();
	return interval?.default_weight ?? 0;
}

export function createHouseholdRepository(db: Kysely<Database>): HouseholdRepository {
	return {
		async findById(id) {
			const row = await db.selectFrom("households").selectAll().where("id", "=", id).executeTakeFirst();
			if (!row) return undefined;
			return {
				id: row.id,
				name: row.name,
				currency: row.currency,
				timezone: row.timezone,
				locale: row.locale,
				version: row.version,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			};
		},

		async create(input, now) {
			await db
				.insertInto("households")
				.values({
					id: input.id,
					name: input.name,
					currency: input.currency,
					timezone: input.timezone,
					locale: input.locale,
					version: input.version,
					created_at: now,
					updated_at: now,
				})
				.execute();
		},

		async countUsersByHousehold(householdId) {
			const rows = await db.selectFrom("users").select("id").where("household_id", "=", householdId).execute();
			return rows.length;
		},
	};
}

export function createMemberRepository(db: Kysely<Database>): MemberRepository {
	return {
		async findByHousehold(householdId) {
			const rows = await db
				.selectFrom("members")
				.selectAll()
				.where("household_id", "=", householdId)
				.orderBy("created_at", "asc")
				.execute();
			const weights = await Promise.all(rows.map((row) => currentWeight(db, row.id)));
			return rows.map((row, i) => ({
				id: row.id,
				householdId: row.household_id,
				displayName: row.display_name,
				isActive: row.is_active === 1,
				defaultWeight: weights[i] ?? 0,
			}));
		},

		async findById(id) {
			const row = await db.selectFrom("members").selectAll().where("id", "=", id).executeTakeFirst();
			if (!row) return undefined;
			return {
				id: row.id,
				householdId: row.household_id,
				displayName: row.display_name,
				isActive: row.is_active === 1,
				defaultWeight: await currentWeight(db, id),
			};
		},

		async create(input, now) {
			await db
				.insertInto("members")
				.values({
					id: input.id,
					household_id: input.householdId,
					display_name: input.displayName,
					is_active: 1,
					created_at: now,
					updated_at: now,
				})
				.execute();

			await db
				.insertInto("member_intervals")
				.values({
					id: crypto.randomUUID(),
					member_id: input.id,
					effective_from: now,
					default_weight: input.defaultWeight,
					is_active: 1,
					operation_id: null,
				})
				.execute();
		},

		async updateActive(memberId, isActive, now) {
			await db
				.updateTable("members")
				.set({ is_active: isActive ? 1 : 0, updated_at: now })
				.where("id", "=", memberId)
				.execute();

			const weight = await currentWeight(db, memberId);
			await db
				.insertInto("member_intervals")
				.values({
					id: crypto.randomUUID(),
					member_id: memberId,
					effective_from: now,
					default_weight: weight,
					is_active: isActive ? 1 : 0,
					operation_id: null,
				})
				.execute();
		},

		async updateWeight(memberId, weight, now) {
			await db
				.insertInto("member_intervals")
				.values({
					id: crypto.randomUUID(),
					member_id: memberId,
					effective_from: now,
					default_weight: weight,
					is_active: 1,
					operation_id: null,
				})
				.execute();
		},

		async countActiveByHousehold(householdId) {
			const rows = await db
				.selectFrom("members")
				.select("id")
				.where("household_id", "=", householdId)
				.where("is_active", "=", 1)
				.execute();
			return rows.length;
		},

		async hasFinancialReferences(memberId) {
			const linked = await db.selectFrom("users").select("id").where("member_id", "=", memberId).executeTakeFirst();
			return linked !== undefined;
		},
	};
}
