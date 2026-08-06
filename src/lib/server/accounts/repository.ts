import type { Kysely } from "kysely";
import type { Database } from "../database";
import { visibleToProjection } from "../operations/visibility";
import type {
	AccountClassification,
	AccountStatus,
	ObservationStatus,
	TransferClassification,
	TransferStatus,
} from "$lib/accounts/model";

export interface AccountRecord {
	id: string;
	householdId: string;
	name: string;
	classification: AccountClassification;
	status: AccountStatus;
	currency: string;
	createdAt: string;
	updatedAt: string;
}

export interface CreateAccountInput {
	id: string;
	householdId: string;
	name: string;
	classification: AccountClassification;
	currency: string;
}

export interface AccountHolderIntervalRecord {
	id: string;
	accountId: string;
	memberId: string;
	effectiveFrom: string;
	effectiveTo: string | null;
	operationId: string | null;
}

export interface BalanceObservationRecord {
	id: string;
	accountId: string;
	amountMinor: number;
	effectiveAt: string;
	orderingKey: string;
	recordedAt: string;
	status: ObservationStatus;
	replacesObservationId: string | null;
	invalidatedAt: string | null;
	operationId: string | null;
}

export interface CreateBalanceObservationInput {
	id: string;
	accountId: string;
	amountMinor: number;
	effectiveAt: string;
	orderingKey: string;
	recordedAt: string;
	replacesObservationId?: string | null;
	operationId?: string | null;
}

export interface AccountTransferRecord {
	id: string;
	householdId: string;
	sourceAccountId: string;
	destinationAccountId: string;
	amountMinor: number;
	effectiveAt: string;
	orderingKey: string;
	recordedAt: string;
	description: string;
	classification: TransferClassification;
	status: TransferStatus;
	chainRootId: string;
	reversalOfId: string | null;
	replacesId: string | null;
	reversedById: string | null;
	operationId: string | null;
	createdAt: string;
}

export interface CreateAccountTransferInput {
	id: string;
	householdId: string;
	sourceAccountId: string;
	destinationAccountId: string;
	amountMinor: number;
	effectiveAt: string;
	orderingKey: string;
	recordedAt: string;
	description: string;
	classification: TransferClassification;
	chainRootId: string;
	reversalOfId?: string | null;
	replacesId?: string | null;
	operationId?: string | null;
}

export interface AccountEntryRecord {
	id: string;
	accountId: string;
	/**
	 * Owning movement id: a transfer id for transfer entries, a payment id
	 * for payment entries adopted by the combined balance reader. Consumers
	 * joining back to `account_transfers` must check `ownerKind` first.
	 */
	transferId: string;
	ownerKind: "transfer" | "payment";
	chainRootId: string;
	amountMinor: number;
	effectiveAt: string;
	orderingKey: string;
	recordedAt: string;
	operationId: string | null;
}

export interface CreateAccountEntryInput {
	id: string;
	accountId: string;
	transferId: string;
	chainRootId: string;
	amountMinor: number;
	effectiveAt: string;
	orderingKey: string;
	recordedAt: string;
	operationId?: string | null;
}

export interface AccountRepository {
	findById(id: string): Promise<AccountRecord | undefined>;
	findByHousehold(householdId: string): Promise<AccountRecord[]>;
	create(input: CreateAccountInput, now: string): Promise<void>;
	rename(id: string, name: string, now: string): Promise<void>;
	updateStatus(id: string, status: AccountStatus, now: string): Promise<void>;
	remove(id: string): Promise<void>;
	hasReferences(id: string): Promise<boolean>;
}

export interface AccountHolderRepository {
	addInterval(input: {
		id: string;
		accountId: string;
		memberId: string;
		effectiveFrom: string;
		operationId?: string | null;
	}): Promise<void>;
	findByAccount(accountId: string): Promise<AccountHolderIntervalRecord[]>;
	currentHolderMemberIds(accountId: string): Promise<string[]>;
	replaceHolders(
		accountId: string,
		memberIds: string[],
		effectiveFrom: string,
		operationId?: string | null,
	): Promise<void>;
}

export interface BalanceObservationRepository {
	append(input: CreateBalanceObservationInput): Promise<void>;
	findById(id: string): Promise<BalanceObservationRecord | undefined>;
	findVisibleById(id: string): Promise<BalanceObservationRecord | undefined>;
	findValidByAccount(accountId: string): Promise<BalanceObservationRecord[]>;
	findLatestValid(accountId: string, cutoffKey: string): Promise<BalanceObservationRecord | undefined>;
	findHistoryByAccount(accountId: string): Promise<BalanceObservationRecord[]>;
	findReplacement(replacesObservationId: string): Promise<BalanceObservationRecord | undefined>;
	findVisibleReplacement(replacesObservationId: string): Promise<BalanceObservationRecord | undefined>;
	reattributeOperation(id: string, operationId: string | null, recordedAt: string): Promise<void>;
	markInvalidated(id: string, invalidatedAt: string): Promise<void>;
}

export interface AccountTransferRepository {
	create(input: CreateAccountTransferInput): Promise<void>;
	findById(id: string): Promise<AccountTransferRecord | undefined>;
	findVisibleById(id: string): Promise<AccountTransferRecord | undefined>;
	findByOperationId(operationId: string): Promise<AccountTransferRecord | undefined>;
	findPostedByHousehold(householdId: string): Promise<AccountTransferRecord[]>;
	findPostedByAccount(accountId: string): Promise<AccountTransferRecord[]>;
	updateClassification(id: string, classification: TransferClassification): Promise<void>;
	markReversed(id: string, reversedById: string): Promise<void>;
}

export interface AccountEntryRepository {
	appendMany(entries: CreateAccountEntryInput[]): Promise<void>;
	findByAccount(accountId: string): Promise<AccountEntryRecord[]>;
	findByAccountAfter(accountId: string, orderingKey: string): Promise<AccountEntryRecord[]>;
}

function toAccount(row: {
	id: string;
	household_id: string;
	name: string;
	classification: string;
	status: string;
	currency: string;
	created_at: string;
	updated_at: string;
}): AccountRecord {
	return {
		id: row.id,
		householdId: row.household_id,
		name: row.name,
		classification: row.classification as AccountClassification,
		status: row.status as AccountStatus,
		currency: row.currency,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export function createAccountRepository(db: Kysely<Database>): AccountRepository {
	return {
		async findById(id) {
			const row = await db.selectFrom("accounts").selectAll().where("id", "=", id).executeTakeFirst();
			return row ? toAccount(row) : undefined;
		},

		async findByHousehold(householdId) {
			const rows = await db
				.selectFrom("accounts")
				.selectAll()
				.where("household_id", "=", householdId)
				.orderBy("created_at", "asc")
				.execute();
			return rows.map(toAccount);
		},

		async create(input, now) {
			await db
				.insertInto("accounts")
				.values({
					id: input.id,
					household_id: input.householdId,
					name: input.name,
					classification: input.classification,
					status: "draft",
					currency: input.currency,
					created_at: now,
					updated_at: now,
				})
				.execute();
		},

		async rename(id, name, now) {
			await db.updateTable("accounts").set({ name, updated_at: now }).where("id", "=", id).execute();
		},

		async updateStatus(id, status, now) {
			await db.updateTable("accounts").set({ status, updated_at: now }).where("id", "=", id).execute();
		},

		async remove(id) {
			await db.deleteFrom("account_holder_intervals").where("account_id", "=", id).execute();
			await db.deleteFrom("accounts").where("id", "=", id).execute();
		},

		async hasReferences(id) {
			const transfer = await db
				.selectFrom("account_transfers")
				.select("id")
				.where((eb) => eb.or([eb("source_account_id", "=", id), eb("destination_account_id", "=", id)]))
				.executeTakeFirst();
			if (transfer) return true;
			const observation = await db
				.selectFrom("balance_observations")
				.select("id")
				.where("account_id", "=", id)
				.executeTakeFirst();
			return observation !== undefined;
		},
	};
}

function toHolderInterval(row: {
	id: string;
	account_id: string;
	member_id: string;
	effective_from: string;
	effective_to: string | null;
	operation_id: string | null;
}): AccountHolderIntervalRecord {
	return {
		id: row.id,
		accountId: row.account_id,
		memberId: row.member_id,
		effectiveFrom: row.effective_from,
		effectiveTo: row.effective_to,
		operationId: row.operation_id,
	};
}

export function createAccountHolderRepository(db: Kysely<Database>): AccountHolderRepository {
	return {
		async addInterval(input) {
			await db
				.insertInto("account_holder_intervals")
				.values({
					id: input.id,
					account_id: input.accountId,
					member_id: input.memberId,
					effective_from: input.effectiveFrom,
					effective_to: null,
					operation_id: input.operationId ?? null,
				})
				.execute();
		},

		async findByAccount(accountId) {
			const rows = await db
				.selectFrom("account_holder_intervals")
				.selectAll()
				.where("account_id", "=", accountId)
				.orderBy("effective_from", "asc")
				.execute();
			return rows.map(toHolderInterval);
		},

		async currentHolderMemberIds(accountId) {
			const rows = await db
				.selectFrom("account_holder_intervals")
				.select("member_id")
				.where("account_id", "=", accountId)
				.where("effective_to", "is", null)
				.execute();
			return rows.map((row) => row.member_id);
		},

		async replaceHolders(accountId, memberIds, effectiveFrom, operationId = null) {
			await db
				.updateTable("account_holder_intervals")
				.set({ effective_to: effectiveFrom })
				.where("account_id", "=", accountId)
				.where("effective_to", "is", null)
				.execute();
			for (const memberId of memberIds) {
				await db
					.insertInto("account_holder_intervals")
					.values({
						id: crypto.randomUUID(),
						account_id: accountId,
						member_id: memberId,
						effective_from: effectiveFrom,
						effective_to: null,
						operation_id: operationId,
					})
					.execute();
			}
		},
	};
}

function toObservation(row: {
	id: string;
	account_id: string;
	amount_minor: number;
	effective_at: string;
	ordering_key: string;
	recorded_at: string;
	status: string;
	replaces_observation_id: string | null;
	invalidated_at: string | null;
	operation_id: string | null;
}): BalanceObservationRecord {
	return {
		id: row.id,
		accountId: row.account_id,
		amountMinor: row.amount_minor,
		effectiveAt: row.effective_at,
		orderingKey: row.ordering_key,
		recordedAt: row.recorded_at,
		status: row.status as ObservationStatus,
		replacesObservationId: row.replaces_observation_id,
		invalidatedAt: row.invalidated_at,
		operationId: row.operation_id,
	};
}

export function createBalanceObservationRepository(db: Kysely<Database>): BalanceObservationRepository {
	return {
		async append(input) {
			await db
				.insertInto("balance_observations")
				.values({
					id: input.id,
					account_id: input.accountId,
					amount_minor: input.amountMinor,
					effective_at: input.effectiveAt,
					ordering_key: input.orderingKey,
					recorded_at: input.recordedAt,
					status: "valid",
					replaces_observation_id: input.replacesObservationId ?? null,
					invalidated_at: null,
					operation_id: input.operationId ?? null,
				})
				.execute();
		},

		async findById(id) {
			const row = await db.selectFrom("balance_observations").selectAll().where("id", "=", id).executeTakeFirst();
			return row ? toObservation(row) : undefined;
		},

		async findVisibleById(id) {
			const row = await db
				.selectFrom("balance_observations")
				.leftJoin("operation_roots", "operation_roots.id", "balance_observations.operation_id")
				.selectAll("balance_observations")
				.where("balance_observations.id", "=", id)
				.where((eb) => visibleToProjection(eb, "balance_observations.operation_id"))
				.executeTakeFirst();
			return row ? toObservation(row) : undefined;
		},

		async findValidByAccount(accountId) {
			const rows = await db
				.selectFrom("balance_observations")
				.leftJoin("operation_roots", "operation_roots.id", "balance_observations.operation_id")
				.selectAll("balance_observations")
				.where("balance_observations.account_id", "=", accountId)
				.where("balance_observations.status", "=", "valid")
				.where((eb) => visibleToProjection(eb, "balance_observations.operation_id"))
				.orderBy("balance_observations.ordering_key", "asc")
				.execute();
			return rows.map(toObservation);
		},

		async findLatestValid(accountId, cutoffKey) {
			const rows = await db
				.selectFrom("balance_observations")
				.leftJoin("operation_roots", "operation_roots.id", "balance_observations.operation_id")
				.selectAll("balance_observations")
				.where("balance_observations.account_id", "=", accountId)
				.where("balance_observations.status", "=", "valid")
				.where("balance_observations.ordering_key", "<=", cutoffKey)
				.where((eb) => visibleToProjection(eb, "balance_observations.operation_id"))
				.orderBy("balance_observations.effective_at", "desc")
				.orderBy("balance_observations.recorded_at", "desc")
				.orderBy("balance_observations.id", "desc")
				.limit(1)
				.execute();
			return rows[0] ? toObservation(rows[0]) : undefined;
		},

		async findHistoryByAccount(accountId) {
			const rows = await db
				.selectFrom("balance_observations")
				.leftJoin("operation_roots", "operation_roots.id", "balance_observations.operation_id")
				.selectAll("balance_observations")
				.where("balance_observations.account_id", "=", accountId)
				.where((eb) => visibleToProjection(eb, "balance_observations.operation_id"))
				.orderBy("balance_observations.recorded_at", "desc")
				.execute();
			return rows.map(toObservation);
		},

		async findReplacement(replacesObservationId) {
			const row = await db
				.selectFrom("balance_observations")
				.selectAll()
				.where("replaces_observation_id", "=", replacesObservationId)
				.orderBy("recorded_at", "asc")
				.executeTakeFirst();
			return row ? toObservation(row) : undefined;
		},

		async findVisibleReplacement(replacesObservationId) {
			const row = await db
				.selectFrom("balance_observations")
				.leftJoin("operation_roots", "operation_roots.id", "balance_observations.operation_id")
				.selectAll("balance_observations")
				.where("balance_observations.replaces_observation_id", "=", replacesObservationId)
				.where((eb) => visibleToProjection(eb, "balance_observations.operation_id"))
				.executeTakeFirst();
			return row ? toObservation(row) : undefined;
		},

		async reattributeOperation(id, operationId, recordedAt) {
			await db
				.updateTable("balance_observations")
				.set({ operation_id: operationId, recorded_at: recordedAt })
				.where("id", "=", id)
				.execute();
		},

		async markInvalidated(id, invalidatedAt) {
			await db
				.updateTable("balance_observations")
				.set({ status: "invalidated", invalidated_at: invalidatedAt })
				.where("id", "=", id)
				.execute();
		},
	};
}

function toTransfer(row: {
	id: string;
	household_id: string;
	source_account_id: string;
	destination_account_id: string;
	amount_minor: number;
	effective_at: string;
	ordering_key: string;
	recorded_at: string;
	description: string;
	classification: string;
	status: string;
	chain_root_id: string;
	reversal_of_id: string | null;
	replaces_id: string | null;
	reversed_by_id: string | null;
	operation_id: string | null;
	created_at: string;
}): AccountTransferRecord {
	return {
		id: row.id,
		householdId: row.household_id,
		sourceAccountId: row.source_account_id,
		destinationAccountId: row.destination_account_id,
		amountMinor: row.amount_minor,
		effectiveAt: row.effective_at,
		orderingKey: row.ordering_key,
		recordedAt: row.recorded_at,
		description: row.description,
		classification: row.classification as TransferClassification,
		status: row.status as TransferStatus,
		chainRootId: row.chain_root_id,
		reversalOfId: row.reversal_of_id,
		replacesId: row.replaces_id,
		reversedById: row.reversed_by_id,
		operationId: row.operation_id,
		createdAt: row.created_at,
	};
}

export function createAccountTransferRepository(db: Kysely<Database>): AccountTransferRepository {
	return {
		async create(input) {
			await db
				.insertInto("account_transfers")
				.values({
					id: input.id,
					household_id: input.householdId,
					source_account_id: input.sourceAccountId,
					destination_account_id: input.destinationAccountId,
					amount_minor: input.amountMinor,
					effective_at: input.effectiveAt,
					ordering_key: input.orderingKey,
					recorded_at: input.recordedAt,
					description: input.description,
					classification: input.classification,
					status: "posted",
					chain_root_id: input.chainRootId,
					reversal_of_id: input.reversalOfId ?? null,
					replaces_id: input.replacesId ?? null,
					reversed_by_id: null,
					operation_id: input.operationId ?? null,
					created_at: input.recordedAt,
				})
				.execute();
		},

		async findById(id) {
			const row = await db.selectFrom("account_transfers").selectAll().where("id", "=", id).executeTakeFirst();
			return row ? toTransfer(row) : undefined;
		},

		async findVisibleById(id) {
			const row = await db
				.selectFrom("account_transfers")
				.leftJoin("operation_roots", "operation_roots.id", "account_transfers.operation_id")
				.selectAll("account_transfers")
				.where("account_transfers.id", "=", id)
				.where((eb) => visibleToProjection(eb, "account_transfers.operation_id"))
				.executeTakeFirst();
			return row ? toTransfer(row) : undefined;
		},

		async findByOperationId(operationId) {
			const row = await db
				.selectFrom("account_transfers")
				.selectAll()
				.where("operation_id", "=", operationId)
				.executeTakeFirst();
			return row ? toTransfer(row) : undefined;
		},

		async findPostedByHousehold(householdId) {
			const rows = await db
				.selectFrom("account_transfers")
				.leftJoin("operation_roots", "operation_roots.id", "account_transfers.operation_id")
				.selectAll("account_transfers")
				.where("account_transfers.household_id", "=", householdId)
				.where((eb) => visibleToProjection(eb, "account_transfers.operation_id"))
				.orderBy("account_transfers.recorded_at", "desc")
				.execute();
			return rows.map(toTransfer);
		},

		async findPostedByAccount(accountId) {
			const rows = await db
				.selectFrom("account_transfers")
				.leftJoin("operation_roots", "operation_roots.id", "account_transfers.operation_id")
				.selectAll("account_transfers")
				.where((eb) =>
					eb.or([
						eb("account_transfers.source_account_id", "=", accountId),
						eb("account_transfers.destination_account_id", "=", accountId),
					]),
				)
				.where((eb) => visibleToProjection(eb, "account_transfers.operation_id"))
				.orderBy("account_transfers.ordering_key", "asc")
				.execute();
			return rows.map(toTransfer);
		},

		async updateClassification(id, classification) {
			await db.updateTable("account_transfers").set({ classification }).where("id", "=", id).execute();
		},

		async markReversed(id, reversedById) {
			await db
				.updateTable("account_transfers")
				.set({ status: "reversed", reversed_by_id: reversedById })
				.where("id", "=", id)
				.execute();
		},
	};
}

function toEntry(row: {
	id: string;
	account_id: string;
	transfer_id: string;
	chain_root_id: string;
	amount_minor: number;
	effective_at: string;
	ordering_key: string;
	recorded_at: string;
	operation_id: string | null;
}): AccountEntryRecord {
	return {
		id: row.id,
		accountId: row.account_id,
		transferId: row.transfer_id,
		ownerKind: "transfer",
		chainRootId: row.chain_root_id,
		amountMinor: row.amount_minor,
		effectiveAt: row.effective_at,
		orderingKey: row.ordering_key,
		recordedAt: row.recorded_at,
		operationId: row.operation_id,
	};
}

export function createAccountEntryRepository(db: Kysely<Database>): AccountEntryRepository {
	return {
		async appendMany(entries) {
			if (entries.length === 0) return;
			await db
				.insertInto("account_entries")
				.values(
					entries.map((entry) => ({
						id: entry.id,
						account_id: entry.accountId,
						transfer_id: entry.transferId,
						chain_root_id: entry.chainRootId,
						amount_minor: entry.amountMinor,
						effective_at: entry.effectiveAt,
						ordering_key: entry.orderingKey,
						recorded_at: entry.recordedAt,
						operation_id: entry.operationId ?? null,
					})),
				)
				.execute();
		},

		async findByAccount(accountId) {
			const rows = await db
				.selectFrom("account_entries")
				.leftJoin("operation_roots", "operation_roots.id", "account_entries.operation_id")
				.select([
					"account_entries.id",
					"account_entries.account_id",
					"account_entries.transfer_id",
					"account_entries.chain_root_id",
					"account_entries.amount_minor",
					"account_entries.effective_at",
					"account_entries.ordering_key",
					"account_entries.recorded_at",
					"account_entries.operation_id",
				])
				.where("account_entries.account_id", "=", accountId)
				.where((eb) => visibleToProjection(eb, "account_entries.operation_id"))
				.orderBy("account_entries.ordering_key", "asc")
				.execute();
			return rows.map(toEntry);
		},

		async findByAccountAfter(accountId, orderingKey) {
			const rows = await db
				.selectFrom("account_entries")
				.leftJoin("operation_roots", "operation_roots.id", "account_entries.operation_id")
				.select([
					"account_entries.id",
					"account_entries.account_id",
					"account_entries.transfer_id",
					"account_entries.chain_root_id",
					"account_entries.amount_minor",
					"account_entries.effective_at",
					"account_entries.ordering_key",
					"account_entries.recorded_at",
					"account_entries.operation_id",
				])
				.where("account_entries.account_id", "=", accountId)
				.where("account_entries.ordering_key", ">", orderingKey)
				.where((eb) => visibleToProjection(eb, "account_entries.operation_id"))
				.orderBy("account_entries.ordering_key", "asc")
				.execute();
			return rows.map(toEntry);
		},
	};
}
