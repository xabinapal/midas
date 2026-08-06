import { isClassificationAllowed, orderingKeyFor, type TransferClassification } from "$lib/accounts/model";
import type {
	AccountEntryRepository,
	AccountRepository,
	AccountTransferRecord,
	AccountTransferRepository,
	CreateAccountEntryInput,
} from "./repository";

/**
 * Transfer posting port. `postClassifiedTransfer`, `insertReversalRows`,
 * `requireCorrectableTransfer`, `isEffectivelyReversed`, `classifyTerminal`,
 * and `TransferDeps` are the deliberate narrow interface the funding
 * capability consumes — all transfer-row and entry-row writes flow through
 * here, so replay, resume, and matrix rules live in exactly one place.
 */

export interface PostTransferInput {
	sourceAccountId: string;
	destinationAccountId: string;
	amountMinor: number;
	effectiveAt: string;
	description: string;
	classification?: "unclassified" | "pure";
}

export interface ReplacementTransferInput {
	amountMinor: number;
	effectiveAt: string;
	description: string;
}

export interface TransferService {
	postTransfer(
		householdId: string,
		input: PostTransferInput,
		now: string,
		operationId?: string | null,
	): Promise<AccountTransferRecord>;
	classifyTransfer(householdId: string, transferId: string, classification: "pure"): Promise<AccountTransferRecord>;
	reverseTransfer(
		householdId: string,
		transferId: string,
		now: string,
		operationId?: string | null,
	): Promise<AccountTransferRecord>;
	correctTransfer(
		householdId: string,
		transferId: string,
		replacement: ReplacementTransferInput | null,
		now: string,
		operationId?: string | null,
	): Promise<{ reversal: AccountTransferRecord; replacement: AccountTransferRecord | null }>;
	getTransfer(householdId: string, transferId: string): Promise<AccountTransferRecord>;
	listTransfersByAccount(householdId: string, accountId: string): Promise<AccountTransferRecord[]>;
}

export interface TransferDeps {
	accounts: AccountRepository;
	transfers: AccountTransferRepository;
	entries: AccountEntryRepository;
}

export interface FundedTransferInput {
	sourceAccountId: string;
	destinationAccountId: string;
	amountMinor: number;
	effectiveAt: string;
	description: string;
}

export interface ChainInheritance {
	chainRootId: string;
	orderingKey: string;
	replacesId: string;
}

/**
 * Creates one authoritative posted transfer row plus its exact debit/credit
 * entry pair. Corrections inherit the original chain root and ordering key
 * and skip the active-lifecycle check, because corrective workflows stay
 * available on closed accounts.
 */
export async function postClassifiedTransfer(
	deps: TransferDeps,
	householdId: string,
	input: FundedTransferInput,
	classification: TransferClassification,
	now: string,
	operationId: string | null,
	inherit?: ChainInheritance,
): Promise<AccountTransferRecord> {
	if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
		throw new Error("transfer_amount_not_positive");
	}
	if (input.sourceAccountId === input.destinationAccountId) {
		throw new Error("transfer_accounts_identical");
	}
	const source = await requireHouseholdAccount(deps.accounts, householdId, input.sourceAccountId);
	const destination = await requireHouseholdAccount(deps.accounts, householdId, input.destinationAccountId);
	if (!inherit) {
		for (const account of [source, destination]) {
			if (account.status === "closed") {
				throw new Error("account_closed");
			}
			if (account.status !== "active") {
				throw new Error("account_not_active");
			}
		}
	}
	if (!isClassificationAllowed(source.classification, destination.classification, classification)) {
		throw new Error("transfer_classification_not_allowed");
	}

	const id = crypto.randomUUID();
	const transfer: AccountTransferRecord = {
		id,
		householdId,
		sourceAccountId: input.sourceAccountId,
		destinationAccountId: input.destinationAccountId,
		amountMinor: input.amountMinor,
		effectiveAt: input.effectiveAt,
		orderingKey: inherit?.orderingKey ?? orderingKeyFor(input.effectiveAt, id),
		recordedAt: now,
		description: input.description.trim(),
		classification,
		status: "posted",
		chainRootId: inherit?.chainRootId ?? id,
		reversalOfId: null,
		replacesId: inherit?.replacesId ?? null,
		reversedById: null,
		operationId,
		createdAt: now,
	};
	await deps.transfers.create(transfer);
	await deps.entries.appendMany(entriesFor(transfer, operationId));
	return transfer;
}

async function requireHouseholdAccount(accounts: AccountRepository, householdId: string, accountId: string) {
	const account = await accounts.findById(accountId);
	if (!account || account.householdId !== householdId) {
		throw new Error("account_not_found");
	}
	return account;
}

function entriesFor(transfer: AccountTransferRecord, operationId: string | null): CreateAccountEntryInput[] {
	return [
		{
			id: crypto.randomUUID(),
			accountId: transfer.sourceAccountId,
			transferId: transfer.id,
			chainRootId: transfer.chainRootId,
			amountMinor: -transfer.amountMinor,
			effectiveAt: transfer.effectiveAt,
			orderingKey: transfer.orderingKey,
			recordedAt: transfer.recordedAt,
			operationId,
		},
		{
			id: crypto.randomUUID(),
			accountId: transfer.destinationAccountId,
			transferId: transfer.id,
			chainRootId: transfer.chainRootId,
			amountMinor: transfer.amountMinor,
			effectiveAt: transfer.effectiveAt,
			orderingKey: transfer.orderingKey,
			recordedAt: transfer.recordedAt,
			operationId,
		},
	];
}

/**
 * Appends the reversal rows of a posted transfer: same amount moving from
 * the original destination back to the original source, inheriting the
 * original effective ordering key and chain root. The rows stay invisible to
 * projections until the operation completes; the caller applies the visible
 * `markReversed` flip on the original LAST, after every other insert, so a
 * failed operation leaves a resumable state.
 */
export async function insertReversalRows(
	deps: TransferDeps,
	original: AccountTransferRecord,
	now: string,
	operationId: string | null,
): Promise<AccountTransferRecord> {
	const id = crypto.randomUUID();
	const reversal: AccountTransferRecord = {
		id,
		householdId: original.householdId,
		sourceAccountId: original.destinationAccountId,
		destinationAccountId: original.sourceAccountId,
		amountMinor: original.amountMinor,
		effectiveAt: original.effectiveAt,
		orderingKey: original.orderingKey,
		recordedAt: now,
		description: original.description,
		classification: original.classification,
		status: "posted",
		chainRootId: original.chainRootId,
		reversalOfId: original.id,
		replacesId: null,
		reversedById: null,
		operationId,
		createdAt: now,
	};
	await deps.transfers.create(reversal);
	await deps.entries.appendMany(entriesFor(reversal, operationId));
	return reversal;
}

/**
 * A transfer is effectively reversed only when its reversal row is visible
 * to projections (its operation completed). A reversed pointer to an
 * invisible reversal is the half-applied state of a failed operation and
 * MUST be resumable, not terminal.
 */
export async function isEffectivelyReversed(deps: TransferDeps, transfer: AccountTransferRecord): Promise<boolean> {
	if (!transfer.reversedById) return false;
	const reversal = await deps.transfers.findVisibleById(transfer.reversedById);
	return reversal !== undefined;
}

/**
 * Loads a visible transfer that can still be classified or corrected:
 * posted, not effectively reversed. Half-applied corrections (visible
 * `reversed` status pointing at an invisible reversal) load fine so the
 * retried operation can resume them.
 */
export async function requireCorrectableTransfer(
	deps: TransferDeps,
	householdId: string,
	transferId: string,
): Promise<AccountTransferRecord> {
	const transfer = await deps.transfers.findVisibleById(transferId);
	if (!transfer || transfer.householdId !== householdId) {
		throw new Error("transfer_not_found");
	}
	if (transfer.status !== "posted" && transfer.status !== "reversed") {
		throw new Error("transfer_not_posted");
	}
	if (await isEffectivelyReversed(deps, transfer)) {
		throw new Error("transfer_already_reversed");
	}
	return transfer;
}

/**
 * The single owner of the one-way classification transition: a posted,
 * unclassified transfer may move once to a terminal meaning allowed by the
 * source/destination matrix. Applying the same classification again is an
 * idempotent no-op so crashed classify operations can resume.
 */
export async function classifyTerminal(
	deps: TransferDeps,
	householdId: string,
	transfer: AccountTransferRecord,
	classification: TransferClassification,
): Promise<AccountTransferRecord> {
	if (transfer.status !== "posted") {
		throw new Error("transfer_not_posted");
	}
	if (transfer.classification !== "unclassified") {
		if (transfer.classification === classification) {
			return transfer;
		}
		throw new Error("transfer_already_classified");
	}
	const source = await requireHouseholdAccount(deps.accounts, householdId, transfer.sourceAccountId);
	const destination = await requireHouseholdAccount(deps.accounts, householdId, transfer.destinationAccountId);
	if (!isClassificationAllowed(source.classification, destination.classification, classification)) {
		throw new Error("transfer_classification_not_allowed");
	}
	await deps.transfers.updateClassification(transfer.id, classification);
	return { ...transfer, classification };
}

export function createTransferService(
	accounts: AccountRepository,
	transfers: AccountTransferRepository,
	entries: AccountEntryRepository,
): TransferService {
	const deps: TransferDeps = { accounts, transfers, entries };

	return {
		async postTransfer(householdId, input, now, operationId = null) {
			if (operationId) {
				const replay = await transfers.findByOperationId(operationId);
				if (replay) {
					return replay;
				}
			}

			const classification = input.classification ?? "unclassified";
			if (classification !== "unclassified" && classification !== "pure") {
				throw new Error("transfer_classification_not_allowed");
			}
			return postClassifiedTransfer(
				deps,
				householdId,
				{
					sourceAccountId: input.sourceAccountId,
					destinationAccountId: input.destinationAccountId,
					amountMinor: input.amountMinor,
					effectiveAt: input.effectiveAt,
					description: input.description,
				},
				classification,
				now,
				operationId,
			);
		},

		async classifyTransfer(householdId, transferId, classification) {
			const transfer = await requireCorrectableTransfer(deps, householdId, transferId);
			return classifyTerminal(deps, householdId, transfer, classification);
		},

		async reverseTransfer(householdId, transferId, now, operationId = null) {
			const { reversal } = await this.correctTransfer(householdId, transferId, null, now, operationId);
			return reversal;
		},

		async correctTransfer(householdId, transferId, replacement, now, operationId = null) {
			const transfer = await requireCorrectableTransfer(deps, householdId, transferId);
			if (transfer.classification === "contribution" || transfer.classification === "distribution") {
				throw new Error("transfer_has_funding_classification");
			}
			const reversal = await insertReversalRows(deps, transfer, now, operationId);
			await transfers.markReversed(transfer.id, reversal.id);

			let replacementRecord: AccountTransferRecord | null = null;
			if (replacement) {
				replacementRecord = await postClassifiedTransfer(
					deps,
					householdId,
					{
						sourceAccountId: transfer.sourceAccountId,
						destinationAccountId: transfer.destinationAccountId,
						amountMinor: replacement.amountMinor,
						effectiveAt: replacement.effectiveAt,
						description: replacement.description,
					},
					transfer.classification,
					now,
					operationId,
					{ chainRootId: transfer.chainRootId, orderingKey: transfer.orderingKey, replacesId: transfer.id },
				);
			}

			return { reversal, replacement: replacementRecord };
		},

		async getTransfer(householdId, transferId) {
			const transfer = await transfers.findVisibleById(transferId);
			if (!transfer || transfer.householdId !== householdId) {
				throw new Error("transfer_not_found");
			}
			return transfer;
		},

		async listTransfersByAccount(householdId, accountId) {
			await requireHouseholdAccount(accounts, householdId, accountId);
			return transfers.findPostedByAccount(accountId);
		},
	};
}
