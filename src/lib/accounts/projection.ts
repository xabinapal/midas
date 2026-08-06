/**
 * Safe balance projection shared between server services and client
 * components. The unavailable state is explicit: Midas never invents zero.
 */

export interface EstimatedBalance {
	kind: "estimated";
	amountMinor: number;
	observedAt: string;
	observationRecordedAt: string;
	movementCount: number;
	asOf: string;
}

export interface UnavailableBalance {
	kind: "unavailable";
	asOf: string;
}

export type BalanceProjection = EstimatedBalance | UnavailableBalance;
