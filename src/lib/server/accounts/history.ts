import type { ObservationStatus, TransferClassification, TransferStatus } from "$lib/accounts/model";
import type { FundingSource } from "$lib/expenses/model";
import type { AccountTransferRecord, BalanceObservationRecord } from "./repository";
import type { PaymentRecord } from "../expenses/repository";

export interface AccountHistoryItem {
	id: string;
	kind: "transfer" | "observation" | "payment";
	effectiveAt: string;
	recordedAt: string;
	orderingKey: string;
	actorUsername?: string | null;
	actorIsActive?: boolean | null;
	transferId?: string;
	direction?: "in" | "out";
	amountMinor?: number;
	counterpartAccountId?: string;
	counterpartName?: string;
	description?: string;
	classification?: TransferClassification;
	transferStatus?: TransferStatus;
	chainRootId?: string;
	reversalOfId?: string | null;
	replacesId?: string | null;
	reversedById?: string | null;
	observationId?: string;
	observationStatus?: ObservationStatus;
	replacesObservationId?: string | null;
	paymentId?: string;
	paymentStatus?: "posted" | "reversed";
	fundingSource?: FundingSource;
}

export interface HistoryActor {
	username: string;
	isActive: boolean;
}

/**
 * Deterministic chronological history of the transfers, payments, and
 * observations affecting one account. Items order by effective ordering key
 * (latest first), then by recorded timestamp and id for stable ties.
 * Correction links stay visible so original, reversal, and replacement can
 * be traced. Each item exposes a safe actor projection resolved from its
 * operation root; historical actors stay visible even after deactivation.
 */
export function buildAccountHistory(input: {
	accountId: string;
	transfers: AccountTransferRecord[];
	observations: BalanceObservationRecord[];
	accountNames: Map<string, string>;
	payments?: PaymentRecord[];
	actors?: Map<string, HistoryActor>;
}): AccountHistoryItem[] {
	const { accountId, transfers, observations, accountNames, payments = [], actors } = input;
	const items: AccountHistoryItem[] = [];

	const actorFor = (operationId: string | null): Pick<AccountHistoryItem, "actorUsername" | "actorIsActive"> => {
		const actor = operationId ? actors?.get(operationId) : undefined;
		return { actorUsername: actor?.username ?? null, actorIsActive: actor?.isActive ?? null };
	};

	for (const transfer of transfers) {
		const outgoing = transfer.sourceAccountId === accountId;
		const counterpartAccountId = outgoing ? transfer.destinationAccountId : transfer.sourceAccountId;
		items.push({
			id: `transfer-${transfer.id}`,
			kind: "transfer",
			effectiveAt: transfer.effectiveAt,
			recordedAt: transfer.recordedAt,
			orderingKey: transfer.orderingKey,
			...actorFor(transfer.operationId),
			transferId: transfer.id,
			direction: outgoing ? "out" : "in",
			amountMinor: outgoing ? -transfer.amountMinor : transfer.amountMinor,
			counterpartAccountId,
			counterpartName: accountNames.get(counterpartAccountId) ?? counterpartAccountId,
			description: transfer.description,
			classification: transfer.classification,
			transferStatus: transfer.status,
			chainRootId: transfer.chainRootId,
			reversalOfId: transfer.reversalOfId,
			replacesId: transfer.replacesId,
			reversedById: transfer.reversedById,
		});
	}

	for (const payment of payments) {
		// Reversal payment rows return the outflow to the account.
		const restoring = payment.reversalOfId !== null;
		items.push({
			id: `payment-${payment.id}`,
			kind: "payment",
			effectiveAt: payment.effectiveAt,
			recordedAt: payment.recordedAt,
			orderingKey: payment.orderingKey,
			...actorFor(payment.operationId),
			paymentId: payment.id,
			direction: restoring ? "in" : "out",
			amountMinor: restoring ? payment.amountMinor : -payment.amountMinor,
			description: payment.description,
			fundingSource: payment.fundingSource,
			paymentStatus: payment.status,
			chainRootId: payment.chainRootId,
			reversalOfId: payment.reversalOfId,
			replacesId: payment.replacesId,
			reversedById: payment.reversedById,
		});
	}

	for (const observation of observations) {
		items.push({
			id: `observation-${observation.id}`,
			kind: "observation",
			effectiveAt: observation.effectiveAt,
			recordedAt: observation.recordedAt,
			orderingKey: observation.orderingKey,
			...actorFor(observation.operationId),
			observationId: observation.id,
			amountMinor: observation.amountMinor,
			observationStatus: observation.status,
			replacesObservationId: observation.replacesObservationId,
		});
	}

	return items.sort((a, b) => {
		if (a.orderingKey !== b.orderingKey) return a.orderingKey < b.orderingKey ? 1 : -1;
		if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? 1 : -1;
		return a.id < b.id ? 1 : -1;
	});
}
