import {
	classifyTerminal,
	insertReversalRows,
	postClassifiedTransfer,
	requireCorrectableTransfer,
	type TransferDeps,
} from "../accounts/transfers";
import type { AccountHolderRepository, AccountTransferRecord } from "../accounts/repository";
import type { MemberRepository } from "../household/repository";
import type {
	ContributionRecord,
	ContributionRepository,
	DistributionRecord,
	DistributionRepository,
	PostedAllocation,
} from "./repository";

export interface PostFundingInput {
	sourceAccountId: string;
	destinationAccountId: string;
	amountMinor: number;
	effectiveAt: string;
	description: string;
	memberId: string;
}

export interface ReplacementFundingInput {
	amountMinor: number;
	effectiveAt: string;
	description: string;
	memberId: string;
	/**
	 * Corrected account for the personal side (source for contributions,
	 * destination for distributions). Defaults to the original account.
	 * The attributed member must be the sole owner of the chosen account,
	 * which makes the "contribution member is corrected" scenario reachable.
	 */
	accountId?: string;
}

export interface MemberFundingTotals {
	memberId: string;
	contributionsMinor: number;
	distributionsMinor: number;
	netMinor: number;
}

export interface FundingRange {
	from?: string;
	to?: string;
}

function inRange(effectiveAt: string, range?: FundingRange): boolean {
	if (range?.from && effectiveAt < range.from) return false;
	if (range?.to && effectiveAt > range.to) return false;
	return true;
}

/**
 * Net shared funding per member: posted non-reversed contribution
 * allocations minus distribution allocations. Pure and unclassified
 * transfers never appear here, so they contribute zero by construction.
 */
export function sumNetFunding(
	contributions: PostedAllocation[],
	distributions: PostedAllocation[],
	range?: FundingRange,
): MemberFundingTotals[] {
	const totals = new Map<string, MemberFundingTotals>();
	const row = (memberId: string): MemberFundingTotals => {
		const existing = totals.get(memberId) ?? {
			memberId,
			contributionsMinor: 0,
			distributionsMinor: 0,
			netMinor: 0,
		};
		totals.set(memberId, existing);
		return existing;
	};
	for (const allocation of contributions) {
		if (!inRange(allocation.effectiveAt, range)) continue;
		const total = row(allocation.memberId);
		total.contributionsMinor += allocation.amountMinor;
		total.netMinor += allocation.amountMinor;
	}
	for (const allocation of distributions) {
		if (!inRange(allocation.effectiveAt, range)) continue;
		const total = row(allocation.memberId);
		total.distributionsMinor += allocation.amountMinor;
		total.netMinor -= allocation.amountMinor;
	}
	return [...totals.values()].sort((a, b) => a.memberId.localeCompare(b.memberId));
}

interface FundingDeps {
	contributions: ContributionRepository;
	distributions: DistributionRepository;
}

interface MembershipDeps {
	holders: AccountHolderRepository;
	members: MemberRepository;
}

export interface FundingService {
	postContribution(
		householdId: string,
		input: PostFundingInput,
		now: string,
		operationId?: string | null,
	): Promise<{ transfer: AccountTransferRecord; contribution: ContributionRecord }>;
	postDistribution(
		householdId: string,
		input: PostFundingInput,
		now: string,
		operationId?: string | null,
	): Promise<{ transfer: AccountTransferRecord; distribution: DistributionRecord }>;
	classifyAsContribution(
		householdId: string,
		transferId: string,
		memberId: string,
		now: string,
		operationId?: string | null,
	): Promise<ContributionRecord>;
	classifyAsDistribution(
		householdId: string,
		transferId: string,
		memberId: string,
		now: string,
		operationId?: string | null,
	): Promise<DistributionRecord>;
	correctFundingTransfer(
		householdId: string,
		transferId: string,
		replacement: ReplacementFundingInput | null,
		now: string,
		operationId?: string | null,
	): Promise<{
		reversal: AccountTransferRecord;
		replacement: {
			transfer: AccountTransferRecord;
			contribution?: ContributionRecord;
			distribution?: DistributionRecord;
		} | null;
	}>;
	getNetFunding(householdId: string, range?: FundingRange): Promise<MemberFundingTotals[]>;
}

export function createFundingService(
	transferDeps: TransferDeps,
	funding: FundingDeps,
	membership: MembershipDeps,
): FundingService {
	async function soleOwnerMemberId(accountId: string): Promise<string | undefined> {
		const holders = await membership.holders.currentHolderMemberIds(accountId);
		return holders.length === 1 ? holders[0] : undefined;
	}

	async function requireActiveHouseholdMember(householdId: string, memberId: string) {
		const member = await membership.members.findById(memberId);
		if (!member || member.householdId !== householdId) {
			throw new Error("holder_not_household_member");
		}
		if (!member.isActive) {
			throw new Error("holder_not_active");
		}
		return member;
	}

	/**
	 * Historical corrections and classifications must stay available after a
	 * member is deactivated: household membership is required, active state
	 * is not (household-management member-lifecycle contract).
	 */
	async function requireHouseholdMember(householdId: string, memberId: string) {
		const member = await membership.members.findById(memberId);
		if (!member || member.householdId !== householdId) {
			throw new Error("holder_not_household_member");
		}
		return member;
	}

	async function appendContribution(
		householdId: string,
		transfer: AccountTransferRecord,
		memberId: string,
		now: string,
		operationId: string | null,
	): Promise<ContributionRecord> {
		const record: ContributionRecord = {
			id: crypto.randomUUID(),
			householdId,
			transferId: transfer.id,
			memberId,
			amountMinor: transfer.amountMinor,
			status: "posted",
			recordedAt: now,
			operationId,
		};
		await funding.contributions.create(record, crypto.randomUUID());
		return record;
	}

	async function appendDistribution(
		householdId: string,
		transfer: AccountTransferRecord,
		memberId: string,
		now: string,
		operationId: string | null,
	): Promise<DistributionRecord> {
		const record: DistributionRecord = {
			id: crypto.randomUUID(),
			householdId,
			transferId: transfer.id,
			memberId,
			amountMinor: transfer.amountMinor,
			status: "posted",
			recordedAt: now,
			operationId,
		};
		await funding.distributions.create(record, crypto.randomUUID());
		return record;
	}

	async function validateContributionAttribution(
		householdId: string,
		sourceAccountId: string,
		memberId: string,
		requireActive = true,
	) {
		if (requireActive) {
			await requireActiveHouseholdMember(householdId, memberId);
		} else {
			await requireHouseholdMember(householdId, memberId);
		}
		const ownerId = await soleOwnerMemberId(sourceAccountId);
		if (ownerId !== memberId) {
			throw new Error("contribution_member_not_source_owner");
		}
	}

	async function validateDistributionAttribution(
		householdId: string,
		destinationAccountId: string,
		memberId: string,
		requireActive = true,
	) {
		if (requireActive) {
			await requireActiveHouseholdMember(householdId, memberId);
		} else {
			await requireHouseholdMember(householdId, memberId);
		}
		const ownerId = await soleOwnerMemberId(destinationAccountId);
		if (ownerId !== memberId) {
			throw new Error("distribution_member_not_destination_owner");
		}
	}

	return {
		async postContribution(householdId, input, now, operationId = null) {
			const source = await transferDeps.accounts.findById(input.sourceAccountId);
			const destination = await transferDeps.accounts.findById(input.destinationAccountId);
			if (!source || !destination || source.classification !== "personal" || destination.classification !== "shared") {
				throw new Error("transfer_classification_not_allowed");
			}
			await validateContributionAttribution(householdId, input.sourceAccountId, input.memberId);
			const transfer = await postClassifiedTransfer(transferDeps, householdId, input, "contribution", now, operationId);
			const contribution = await appendContribution(householdId, transfer, input.memberId, now, operationId);
			return { transfer, contribution };
		},

		async postDistribution(householdId, input, now, operationId = null) {
			const source = await transferDeps.accounts.findById(input.sourceAccountId);
			const destination = await transferDeps.accounts.findById(input.destinationAccountId);
			if (!source || !destination || source.classification !== "shared" || destination.classification !== "personal") {
				throw new Error("transfer_classification_not_allowed");
			}
			await validateDistributionAttribution(householdId, input.destinationAccountId, input.memberId);
			const transfer = await postClassifiedTransfer(transferDeps, householdId, input, "distribution", now, operationId);
			const distribution = await appendDistribution(householdId, transfer, input.memberId, now, operationId);
			return { transfer, distribution };
		},

		async classifyAsContribution(householdId, transferId, memberId, now, operationId = null) {
			const transfer = await requireCorrectableTransfer(transferDeps, householdId, transferId);
			if (transfer.classification !== "unclassified") {
				if (transfer.classification !== "contribution") {
					throw new Error("transfer_already_classified");
				}
				const existing = await funding.contributions.findByTransferId(transferId);
				if (existing) {
					if (existing.memberId !== memberId) {
						throw new Error("contribution_member_not_source_owner");
					}
					// Adopt only an invisible row from a failed attempt; a visible
					// row is already done and must not be dragged into this operation.
					const visible = await funding.contributions.findVisibleByTransferId(transferId);
					if (visible) {
						return existing;
					}
					await funding.contributions.reattributeOperation(existing.id, operationId, now);
					return { ...existing, operationId };
				}
				await validateContributionAttribution(householdId, transfer.sourceAccountId, memberId, false);
				return appendContribution(householdId, transfer, memberId, now, operationId);
			}
			const source = await transferDeps.accounts.findById(transfer.sourceAccountId);
			const destination = await transferDeps.accounts.findById(transfer.destinationAccountId);
			if (!source || !destination || source.classification !== "personal" || destination.classification !== "shared") {
				throw new Error("transfer_classification_not_allowed");
			}
			// A crashed attempt may have left an invisible row before the flip:
			// adopt it instead of violating the unique transfer classification.
			const existing = await funding.contributions.findByTransferId(transferId);
			if (existing) {
				if (existing.memberId !== memberId) {
					throw new Error("contribution_member_not_source_owner");
				}
				const visible = await funding.contributions.findVisibleByTransferId(transferId);
				if (!visible) {
					await funding.contributions.reattributeOperation(existing.id, operationId, now);
				}
				await classifyTerminal(transferDeps, householdId, transfer, "contribution");
				return { ...existing, operationId: visible ? existing.operationId : operationId };
			}
			await validateContributionAttribution(householdId, transfer.sourceAccountId, memberId, false);
			// Invisible funding rows first; the visible classification flip last.
			const contribution = await appendContribution(householdId, transfer, memberId, now, operationId);
			await classifyTerminal(transferDeps, householdId, transfer, "contribution");
			return contribution;
		},

		async classifyAsDistribution(householdId, transferId, memberId, now, operationId = null) {
			const transfer = await requireCorrectableTransfer(transferDeps, householdId, transferId);
			if (transfer.classification !== "unclassified") {
				if (transfer.classification !== "distribution") {
					throw new Error("transfer_already_classified");
				}
				const existing = await funding.distributions.findByTransferId(transferId);
				if (existing) {
					if (existing.memberId !== memberId) {
						throw new Error("distribution_member_not_destination_owner");
					}
					const visible = await funding.distributions.findVisibleByTransferId(transferId);
					if (visible) {
						return existing;
					}
					await funding.distributions.reattributeOperation(existing.id, operationId, now);
					return { ...existing, operationId };
				}
				await validateDistributionAttribution(householdId, transfer.destinationAccountId, memberId, false);
				return appendDistribution(householdId, transfer, memberId, now, operationId);
			}
			const source = await transferDeps.accounts.findById(transfer.sourceAccountId);
			const destination = await transferDeps.accounts.findById(transfer.destinationAccountId);
			if (!source || !destination || source.classification !== "shared" || destination.classification !== "personal") {
				throw new Error("transfer_classification_not_allowed");
			}
			const existing = await funding.distributions.findByTransferId(transferId);
			if (existing) {
				if (existing.memberId !== memberId) {
					throw new Error("distribution_member_not_destination_owner");
				}
				const visible = await funding.distributions.findVisibleByTransferId(transferId);
				if (!visible) {
					await funding.distributions.reattributeOperation(existing.id, operationId, now);
				}
				await classifyTerminal(transferDeps, householdId, transfer, "distribution");
				return { ...existing, operationId: visible ? existing.operationId : operationId };
			}
			await validateDistributionAttribution(householdId, transfer.destinationAccountId, memberId, false);
			const distribution = await appendDistribution(householdId, transfer, memberId, now, operationId);
			await classifyTerminal(transferDeps, householdId, transfer, "distribution");
			return distribution;
		},

		async correctFundingTransfer(householdId, transferId, replacement, now, operationId = null) {
			const transfer = await requireCorrectableTransfer(transferDeps, householdId, transferId);
			if (transfer.classification !== "contribution" && transfer.classification !== "distribution") {
				throw new Error("transfer_has_no_funding_classification");
			}

			const fundingRecord =
				transfer.classification === "contribution"
					? await funding.contributions.findByTransferId(transferId)
					: await funding.distributions.findByTransferId(transferId);
			if (!fundingRecord) {
				throw new Error("funding_record_not_found");
			}

			// Invisible reversal rows first, then the visible flips; the funding
			// record's own flip stays last so a failed operation can resume.
			const reversal = await insertReversalRows(transferDeps, transfer, now, operationId);
			await transferDeps.transfers.markReversed(transfer.id, reversal.id);

			let replacementResult: {
				transfer: AccountTransferRecord;
				contribution?: ContributionRecord;
				distribution?: DistributionRecord;
			} | null = null;
			if (replacement) {
				const inherit = {
					chainRootId: transfer.chainRootId,
					orderingKey: transfer.orderingKey,
					replacesId: transfer.id,
				};
				if (transfer.classification === "contribution") {
					const sourceAccountId = replacement.accountId ?? transfer.sourceAccountId;
					await validateContributionAttribution(householdId, sourceAccountId, replacement.memberId, false);
					const replacementTransfer = await postClassifiedTransfer(
						transferDeps,
						householdId,
						{
							sourceAccountId,
							destinationAccountId: transfer.destinationAccountId,
							amountMinor: replacement.amountMinor,
							effectiveAt: replacement.effectiveAt,
							description: replacement.description,
						},
						"contribution",
						now,
						operationId,
						inherit,
					);
					const contribution = await appendContribution(
						householdId,
						replacementTransfer,
						replacement.memberId,
						now,
						operationId,
					);
					replacementResult = { transfer: replacementTransfer, contribution };
				} else {
					const destinationAccountId = replacement.accountId ?? transfer.destinationAccountId;
					await validateDistributionAttribution(householdId, destinationAccountId, replacement.memberId, false);
					const replacementTransfer = await postClassifiedTransfer(
						transferDeps,
						householdId,
						{
							sourceAccountId: transfer.sourceAccountId,
							destinationAccountId,
							amountMinor: replacement.amountMinor,
							effectiveAt: replacement.effectiveAt,
							description: replacement.description,
						},
						"distribution",
						now,
						operationId,
						inherit,
					);
					const distribution = await appendDistribution(
						householdId,
						replacementTransfer,
						replacement.memberId,
						now,
						operationId,
					);
					replacementResult = { transfer: replacementTransfer, distribution };
				}
			}

			if (fundingRecord.status !== "reversed") {
				if (transfer.classification === "contribution") {
					await funding.contributions.markReversed(fundingRecord.id);
				} else {
					await funding.distributions.markReversed(fundingRecord.id);
				}
			}

			return { reversal, replacement: replacementResult };
		},

		async getNetFunding(householdId, range) {
			const [contributionAllocations, distributionAllocations] = await Promise.all([
				funding.contributions.postedAllocations(householdId),
				funding.distributions.postedAllocations(householdId),
			]);
			return sumNetFunding(contributionAllocations, distributionAllocations, range);
		},
	};
}
