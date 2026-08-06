import type { Kysely } from "kysely";
import type { Database } from "../database";
import type { EntryReader } from "../accounts/balance";
import { createAccountEntryRepository, type AccountEntryRecord } from "../accounts/repository";
import { createPaymentEntryRepository, type PaymentAccountEntryRecord } from "./repository";

/**
 * Balance integration: the estimated-balance projection folds every account
 * effect through one reader, so payment debits join transfer entries here
 * rather than duplicating projection logic. Payment entries adopt the
 * transfer-entry shape; `transferId` carries the owning payment id.
 */
function paymentEntryAsAccountEntry(record: PaymentAccountEntryRecord): AccountEntryRecord {
	return {
		id: record.id,
		accountId: record.accountId,
		transferId: record.paymentId,
		ownerKind: "payment",
		chainRootId: record.chainRootId,
		amountMinor: record.amountMinor,
		effectiveAt: record.effectiveAt,
		orderingKey: record.orderingKey,
		recordedAt: record.recordedAt,
		operationId: record.operationId,
	};
}

export function createCombinedEntryReader(db: Kysely<Database>): EntryReader {
	const accountEntries = createAccountEntryRepository(db);
	const paymentEntries = createPaymentEntryRepository(db);

	function merge(entries: AccountEntryRecord[], payments: PaymentAccountEntryRecord[]): AccountEntryRecord[] {
		return [...entries, ...payments.map(paymentEntryAsAccountEntry)].sort((a, b) =>
			a.orderingKey < b.orderingKey ? -1 : a.orderingKey > b.orderingKey ? 1 : a.id < b.id ? -1 : 1,
		);
	}

	return {
		async findByAccount(accountId) {
			const [entries, payments] = await Promise.all([
				accountEntries.findByAccount(accountId),
				paymentEntries.findByAccount(accountId),
			]);
			return merge(entries, payments);
		},

		async findByAccountAfter(accountId, orderingKey) {
			const [entries, payments] = await Promise.all([
				accountEntries.findByAccountAfter(accountId, orderingKey),
				paymentEntries.findByAccountAfter(accountId, orderingKey),
			]);
			return merge(entries, payments);
		},
	};
}
