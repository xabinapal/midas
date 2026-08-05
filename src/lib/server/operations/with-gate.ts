import type { Kysely } from "kysely";
import type { Database } from "../database";
import { acquireGate, completeOperation, failOperation, type OperationContext } from "./gate";

export interface GateConflictResult {
	conflict: true;
}

export interface GateSuccessResult<T> {
	conflict: false;
	result: T;
}

export type GateResult<T> = GateConflictResult | GateSuccessResult<T>;

export function isGateConflict<T>(result: GateResult<T>): result is GateConflictResult {
	return result.conflict === true;
}

/**
 * Acquires the household command gate, runs the mutation, and releases the gate.
 * Returns { conflict: true } if the gate is held; the caller should retry or
 * show a conflict message.
 *
 * Usage in a route action:
 *
 * const outcome = await withGate(db, householdId, userId, async (ctx) => {
 *     // do writes, reference ctx.operationId in activity events
 *     return { success: true };
 * });
 * if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
 * return outcome.result;
 */
export async function withGate<T>(
	db: Kysely<Database>,
	householdId: string,
	actorUserId: string | null,
	mutation: (ctx: OperationContext) => Promise<T>,
): Promise<GateResult<T>> {
	const gateResult = await acquireGate(db, householdId, actorUserId);
	if (!gateResult.acquired || !gateResult.context) {
		return { conflict: true };
	}

	const ctx = gateResult.context;
	try {
		const result = await mutation(ctx);
		await completeOperation(db, ctx);
		return { conflict: false, result };
	} catch (error) {
		await failOperation(db, ctx);
		throw error;
	}
}
