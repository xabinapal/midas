/**
 * Pure domain vocabulary for financial accounts and account transfers.
 * Framework-neutral: no Kysely, no SvelteKit, no bindings.
 */

export type AccountClassification = "personal" | "shared";
export type AccountStatus = "draft" | "active" | "closed";
export type TransferClassification = "unclassified" | "pure" | "contribution" | "distribution";
export type TransferStatus = "draft" | "posted" | "reversed";
export type ObservationStatus = "valid" | "invalidated";
export type FundingStatus = "posted" | "reversed";

/**
 * Terminal classifications a transfer may take given the account
 * classifications of its source and destination. A later settlement
 * capability extends this matrix with `settlement` for shared-to-personal
 * transfers; keep every rule in this one place.
 */
export function allowedTransferClassifications(
	source: AccountClassification,
	destination: AccountClassification,
): TransferClassification[] {
	if (source === "personal" && destination === "shared") {
		return ["unclassified", "pure", "contribution"];
	}
	if (source === "shared" && destination === "personal") {
		return ["unclassified", "distribution"];
	}
	return ["unclassified", "pure"];
}

export function isClassificationAllowed(
	source: AccountClassification,
	destination: AccountClassification,
	classification: TransferClassification,
): boolean {
	return allowedTransferClassifications(source, destination).includes(classification);
}

/**
 * Stable effective ordering key. Records placed at the same effective
 * timestamp are ordered deterministically by their id. Corrections inherit
 * the original key so restated chains keep their historical anchor.
 */
export function orderingKeyFor(effectiveAt: string, id: string): string {
	return `${effectiveAt}#${id}`;
}

const CUTOFF_SENTINEL = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";

/**
 * Ordering key boundary inclusive of every record effective at the cutoff
 * timestamp. Ids are lowercase UUID hex and dashes, which all sort before
 * the "z" sentinel.
 */
export function cutoffOrderingKey(cutoff: string): string {
	return `${cutoff}#${CUTOFF_SENTINEL}`;
}
