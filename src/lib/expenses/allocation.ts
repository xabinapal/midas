/**
 * Pure expense allocation resolution. Every method resolves to exact
 * integer minor-unit lines that sum to the expense total. Percentage and
 * weight methods distribute leftover units by largest fractional remainder
 * with stable member-identifier tie-breaking, so results are deterministic
 * and never change when household defaults later move.
 *
 * Framework-neutral: no Kysely, no SvelteKit, no bindings.
 */

import { parseAmountToMinorUnits } from "$lib/accounts/money";

export type AllocationMethodKind = "equal" | "default_weight" | "custom_weight" | "percentage" | "fixed";

export interface AllocationMemberSelection {
	memberId: string;
	/** Household default weight for the `default_weight` method. */
	defaultWeight?: number;
	/** Custom relative weight for the `custom_weight` method. */
	weight?: number;
	/** Basis points (0–10000) for the `percentage` method. */
	basisPoints?: number;
	/** Exact amount for the `fixed` method. */
	fixedAmountMinor?: number;
}

export interface AllocationLine {
	memberId: string;
	amountMinor: number;
}

/**
 * Rebuilds member selections from stored allocation method parameters. The
 * single owner of this mapping — every edit, actualization, correction, and
 * generation path resolves through here so methods never lose their values.
 * `defaultWeightByMember` supplies current household weights for the
 * `default_weight` method; a stored param value wins when present
 * (occurrence generation resolves weights at generation time).
 */
export function selectionFromParams(
	method: AllocationMethodKind,
	params: { memberId: string; value: number | null }[],
	defaultWeightByMember?: Map<string, number>,
): AllocationMemberSelection[] {
	return params.map((param) => ({
		memberId: param.memberId,
		...(method === "custom_weight" ? { weight: param.value ?? 0 } : {}),
		...(method === "percentage" ? { basisPoints: param.value ?? 0 } : {}),
		...(method === "fixed" ? { fixedAmountMinor: param.value ?? 0 } : {}),
		...(method === "default_weight"
			? { defaultWeight: defaultWeightByMember?.get(param.memberId) ?? param.value ?? 0 }
			: {}),
	}));
}

function requireSolvableInput(method: AllocationMethodKind, totalMinor: number, members: AllocationMemberSelection[]) {
	void method;
	if (!Number.isInteger(totalMinor) || totalMinor <= 0) {
		throw new Error("allocation_total_not_positive");
	}
	if (members.length === 0) {
		throw new Error("allocation_members_empty");
	}
	const ids = new Set(members.map((member) => member.memberId));
	if (ids.size !== members.length) {
		throw new Error("allocation_members_duplicated");
	}
}

/**
 * Largest-remainder distribution. Each member's exact share is
 * `total * weight / weightSum`; floors are taken and the leftover units go
 * to the highest fractional remainders. Fractional remainders are compared
 * as integer numerators over the same denominator, avoiding float drift.
 */
function largestRemainder(totalMinor: number, weights: { memberId: string; weight: number }[]): AllocationLine[] {
	const weightSum = weights.reduce((sum, entry) => sum + entry.weight, 0);
	const shares = weights.map((entry) => {
		const raw = totalMinor * entry.weight;
		const floor = Math.floor(raw / weightSum);
		return { memberId: entry.memberId, floor, remainder: raw - floor * weightSum };
	});
	const leftover = totalMinor - shares.reduce((sum, share) => sum + share.floor, 0);
	const ranked = [...shares].sort((a, b) => {
		if (a.remainder !== b.remainder) return b.remainder - a.remainder;
		return a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0;
	});
	for (let i = 0; i < leftover; i += 1) {
		ranked[i]!.floor += 1;
	}
	return shares
		.map((share) => ({ memberId: share.memberId, amountMinor: share.floor }))
		.sort((a, b) => (a.memberId < b.memberId ? -1 : 1));
}

/**
 * Builds member selections from form arrays: member ids plus raw per-member
 * value strings (weights, percents, or formatted amounts). The single owner
 * of the form→domain mapping used by expense forms and live previews.
 * `fixed` values parse through the household currency; an unparseable value
 * becomes -1 so domain validation rejects it with the balance error.
 */
export function selectionFromFormValues(
	method: AllocationMethodKind,
	memberIds: string[],
	rawValues: string[],
	currency: string,
	defaultWeightByMember?: Map<string, number>,
): AllocationMemberSelection[] {
	return memberIds.map((memberId, index) => {
		const raw = rawValues[index] ?? "";
		switch (method) {
			case "custom_weight":
				return { memberId, weight: Number(raw || 0) };
			case "percentage":
				return { memberId, basisPoints: Math.round(Number(raw || 0) * 100) };
			case "fixed":
				return { memberId, fixedAmountMinor: parseAmountToMinorUnits(raw || "", currency) ?? -1 };
			case "default_weight":
				return { memberId, defaultWeight: defaultWeightByMember?.get(memberId) ?? 0 };
			default:
				return { memberId };
		}
	});
}

/**
 * Scales a stored fixed split to a new total, preserving proportions
 * deterministically (old amounts act as weights, largest remainder decides
 * leftover units, member identifiers break ties). Used when an actual or
 * corrected amount changes under the fixed method. Zero shares stay zero.
 */
export function scaleFixedSelections(
	fixedParams: { memberId: string; value: number | null }[],
	newTotalMinor: number,
): AllocationMemberSelection[] {
	const weights = fixedParams.map((param) => ({ memberId: param.memberId, weight: param.value ?? 0 }));
	// A split that never allocated cannot scale proportionally; fall back to
	// equal shares rather than dividing by zero.
	if (weights.reduce((sum, entry) => sum + entry.weight, 0) <= 0) {
		return resolveAllocations("equal", newTotalMinor, weights).map((line) => ({
			memberId: line.memberId,
			fixedAmountMinor: line.amountMinor,
		}));
	}
	const lines = largestRemainder(newTotalMinor, weights);
	return lines.map((line) => ({ memberId: line.memberId, fixedAmountMinor: line.amountMinor }));
}

export function resolveAllocations(
	method: AllocationMethodKind,
	totalMinor: number,
	members: AllocationMemberSelection[],
): AllocationLine[] {
	requireSolvableInput(method, totalMinor, members);
	const sorted = [...members].sort((a, b) => (a.memberId < b.memberId ? -1 : 1));

	switch (method) {
		case "equal":
			return largestRemainder(
				totalMinor,
				sorted.map((member) => ({ memberId: member.memberId, weight: 1 })),
			);
		case "default_weight": {
			for (const member of sorted) {
				const weight = member.defaultWeight ?? 0;
				if (!Number.isFinite(weight) || weight < 0) {
					throw new Error("allocation_weight_negative");
				}
			}
			const weights = sorted.map((member) => ({ memberId: member.memberId, weight: member.defaultWeight ?? 0 }));
			if (weights.reduce((sum, entry) => sum + entry.weight, 0) <= 0) {
				throw new Error("allocation_weights_unbalanced");
			}
			return largestRemainder(totalMinor, weights);
		}
		case "custom_weight": {
			for (const member of sorted) {
				const weight = member.weight ?? 0;
				if (!Number.isFinite(weight) || weight < 0) {
					throw new Error("allocation_weight_negative");
				}
			}
			const weights = sorted.map((member) => ({ memberId: member.memberId, weight: member.weight ?? 0 }));
			if (weights.reduce((sum, entry) => sum + entry.weight, 0) <= 0) {
				throw new Error("allocation_weights_unbalanced");
			}
			return largestRemainder(totalMinor, weights);
		}
		case "percentage": {
			for (const member of sorted) {
				const basisPoints = member.basisPoints ?? 0;
				if (!Number.isFinite(basisPoints) || basisPoints < 0) {
					throw new Error("allocation_percentage_negative");
				}
				if (!Number.isInteger(basisPoints)) {
					throw new Error("allocation_percentage_not_integer");
				}
			}
			const totalBasisPoints = sorted.reduce((sum, member) => sum + (member.basisPoints ?? 0), 0);
			if (totalBasisPoints !== 10000) {
				throw new Error("allocation_percentages_unbalanced");
			}
			return largestRemainder(
				totalMinor,
				sorted.map((member) => ({ memberId: member.memberId, weight: member.basisPoints ?? 0 })),
			);
		}
		case "fixed": {
			for (const member of sorted) {
				const amount = member.fixedAmountMinor ?? 0;
				if (!Number.isFinite(amount) || amount < 0) {
					throw new Error("allocation_fixed_negative");
				}
				if (!Number.isInteger(amount)) {
					throw new Error("allocation_fixed_not_integer");
				}
			}
			const fixedTotal = sorted.reduce((sum, member) => sum + (member.fixedAmountMinor ?? 0), 0);
			if (fixedTotal !== totalMinor) {
				throw new Error("allocation_fixed_unbalanced");
			}
			return sorted.map((member) => ({ memberId: member.memberId, amountMinor: member.fixedAmountMinor ?? 0 }));
		}
	}
}
