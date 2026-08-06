import { cutoffOrderingKey, orderingKeyFor } from "$lib/accounts/model";
import type { BalanceProjection, EstimatedBalance, UnavailableBalance } from "$lib/accounts/projection";
import type {
	AccountEntryRecord,
	AccountRepository,
	BalanceObservationRecord,
	BalanceObservationRepository,
} from "./repository";

export type { BalanceProjection, EstimatedBalance, UnavailableBalance };

export interface ChainFold {
	chainRootId: string;
	orderingKey: string;
	netMinor: number;
}

/**
 * Folds posted account entries into their correction chains. Original,
 * reversal, and replacement entries share the chain root and the inherited
 * effective ordering key, so the folded net is the restated economic effect.
 */
export function foldEntriesIntoChains(entries: AccountEntryRecord[]): ChainFold[] {
	const chains = new Map<string, ChainFold>();
	for (const entry of entries) {
		const chain = chains.get(entry.chainRootId) ?? {
			chainRootId: entry.chainRootId,
			orderingKey: entry.orderingKey,
			netMinor: 0,
		};
		chain.netMinor += entry.amountMinor;
		chains.set(entry.chainRootId, chain);
	}
	return [...chains.values()];
}

/**
 * Estimated available balance: the anchor is the observation with the
 * latest effective timestamp at or before the cutoff; ties at the same
 * effective timestamp resolve by recorded timestamp (later information
 * wins), then by id for stability. Folded correction chains follow the
 * anchor when their effective ordering key sorts strictly after the
 * anchor's key, through the cutoff. Without an observation the balance is
 * unavailable — never an invented zero.
 */
export function projectEstimatedBalance(input: {
	observations: BalanceObservationRecord[];
	entries: AccountEntryRecord[];
	cutoff: string;
}): BalanceProjection {
	const { observations, entries, cutoff } = input;
	const cutoffKey = cutoffOrderingKey(cutoff);

	const anchor = observations
		.filter((observation) => observation.orderingKey <= cutoffKey)
		.sort((a, b) => {
			if (a.effectiveAt !== b.effectiveAt) return a.effectiveAt < b.effectiveAt ? 1 : -1;
			if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? 1 : -1;
			return a.id < b.id ? 1 : -1;
		})[0];

	if (!anchor) {
		return { kind: "unavailable", asOf: cutoff };
	}

	let delta = 0;
	let movementCount = 0;
	for (const chain of foldEntriesIntoChains(entries)) {
		if (chain.netMinor === 0) continue;
		if (chain.orderingKey > anchor.orderingKey && chain.orderingKey <= cutoffKey) {
			delta += chain.netMinor;
			movementCount += 1;
		}
	}

	return {
		kind: "estimated",
		amountMinor: anchor.amountMinor + delta,
		observedAt: anchor.effectiveAt,
		observationRecordedAt: anchor.recordedAt,
		movementCount,
		asOf: cutoff,
	};
}

export interface RecordObservationInput {
	accountId: string;
	amountMinor: number;
	effectiveAt: string;
}

export interface ObservationService {
	recordObservation(
		householdId: string,
		input: RecordObservationInput,
		now: string,
		operationId?: string | null,
	): Promise<BalanceObservationRecord>;
	invalidateObservation(
		householdId: string,
		observationId: string,
		replacement: RecordObservationInput | null,
		now: string,
		operationId?: string | null,
	): Promise<{ invalidated: BalanceObservationRecord; replacement: BalanceObservationRecord | null }>;
	getEstimatedBalance(householdId: string, accountId: string, cutoff: string): Promise<BalanceProjection>;
}

export interface EntryReader {
	findByAccount(accountId: string): Promise<AccountEntryRecord[]>;
	findByAccountAfter(accountId: string, orderingKey: string): Promise<AccountEntryRecord[]>;
}

export function createObservationService(
	accounts: AccountRepository,
	observations: BalanceObservationRepository,
	entries: EntryReader,
): ObservationService {
	async function requireAccount(householdId: string, accountId: string) {
		const account = await accounts.findById(accountId);
		if (!account || account.householdId !== householdId) {
			throw new Error("account_not_found");
		}
		if (account.status === "draft") {
			throw new Error("account_not_active");
		}
		return account;
	}

	async function appendReplacement(
		existing: BalanceObservationRecord,
		replacement: RecordObservationInput,
		now: string,
		operationId: string | null,
	): Promise<BalanceObservationRecord> {
		const id = crypto.randomUUID();
		const record: BalanceObservationRecord = {
			id,
			accountId: existing.accountId,
			amountMinor: replacement.amountMinor,
			effectiveAt: replacement.effectiveAt,
			orderingKey: orderingKeyFor(replacement.effectiveAt, id),
			recordedAt: now,
			status: "valid",
			replacesObservationId: existing.id,
			invalidatedAt: null,
			operationId,
		};
		await observations.append({
			id,
			accountId: existing.accountId,
			amountMinor: replacement.amountMinor,
			effectiveAt: replacement.effectiveAt,
			orderingKey: record.orderingKey,
			recordedAt: now,
			replacesObservationId: existing.id,
			operationId,
		});
		return record;
	}

	return {
		async recordObservation(householdId, input, now, operationId = null) {
			await requireAccount(householdId, input.accountId);
			if (!Number.isInteger(input.amountMinor)) {
				throw new Error("observation_amount_not_integer");
			}
			const id = crypto.randomUUID();
			const record: BalanceObservationRecord = {
				id,
				accountId: input.accountId,
				amountMinor: input.amountMinor,
				effectiveAt: input.effectiveAt,
				orderingKey: orderingKeyFor(input.effectiveAt, id),
				recordedAt: now,
				status: "valid",
				replacesObservationId: null,
				invalidatedAt: null,
				operationId,
			};
			await observations.append({
				id: record.id,
				accountId: record.accountId,
				amountMinor: record.amountMinor,
				effectiveAt: record.effectiveAt,
				orderingKey: record.orderingKey,
				recordedAt: record.recordedAt,
				operationId,
			});
			return record;
		},

		async invalidateObservation(householdId, observationId, replacement, now, operationId = null) {
			const existing = await observations.findById(observationId);
			if (!existing) {
				throw new Error("observation_not_found");
			}
			await requireAccount(householdId, existing.accountId);

			if (existing.status !== "valid") {
				// Resume a half-applied invalidation: a completed replacement
				// means the workflow genuinely finished; anything else is a
				// failed attempt to adopt or redo.
				const visibleReplacement = await observations.findVisibleReplacement(observationId);
				if (visibleReplacement) {
					throw new Error("observation_not_found");
				}
				const prior = await observations.findReplacement(observationId);
				if (prior) {
					await observations.reattributeOperation(prior.id, operationId, now);
					return { invalidated: existing, replacement: { ...prior, operationId } };
				}
				if (!replacement) {
					return { invalidated: existing, replacement: null };
				}
				if (replacement.accountId !== existing.accountId) {
					throw new Error("observation_replacement_account_mismatch");
				}
				if (!Number.isInteger(replacement.amountMinor)) {
					throw new Error("observation_amount_not_integer");
				}
				const appended = await appendReplacement(existing, replacement, now, operationId);
				return { invalidated: existing, replacement: appended };
			}

			// Validate the replacement BEFORE invalidating the anchor: a rejected
			// replacement must leave the valid observation untouched.
			if (replacement) {
				if (replacement.accountId !== existing.accountId) {
					throw new Error("observation_replacement_account_mismatch");
				}
				if (!Number.isInteger(replacement.amountMinor)) {
					throw new Error("observation_amount_not_integer");
				}
			}

			let replacementRecord: BalanceObservationRecord | null = null;
			if (replacement) {
				// A crashed attempt may have left an invisible replacement; adopt
				// it when it matches the request instead of appending a duplicate.
				const prior = await observations.findReplacement(observationId);
				if (
					prior &&
					!(await observations.findVisibleById(prior.id)) &&
					prior.amountMinor === replacement.amountMinor &&
					prior.effectiveAt === replacement.effectiveAt
				) {
					await observations.reattributeOperation(prior.id, operationId, now);
					replacementRecord = { ...prior, operationId };
				} else {
					replacementRecord = await appendReplacement(existing, replacement, now, operationId);
				}
			}
			await observations.markInvalidated(observationId, now);

			return {
				invalidated: { ...existing, status: "invalidated", invalidatedAt: now },
				replacement: replacementRecord,
			};
		},

		async getEstimatedBalance(householdId, accountId, cutoff) {
			const account = await accounts.findById(accountId);
			if (!account || account.householdId !== householdId) {
				throw new Error("account_not_found");
			}
			// Anchor pushdown: only the latest observation and the entries that
			// follow it are read, so the projection cost stays bounded.
			const anchor = await observations.findLatestValid(accountId, cutoffOrderingKey(cutoff));
			if (!anchor) {
				return { kind: "unavailable", asOf: cutoff };
			}
			const accountEntries = await entries.findByAccountAfter(accountId, anchor.orderingKey);
			return projectEstimatedBalance({ observations: [anchor], entries: accountEntries, cutoff });
		},
	};
}
