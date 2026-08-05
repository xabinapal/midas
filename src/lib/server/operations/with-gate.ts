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

export interface GateErrorResult {
	conflict: false;
	error: Error;
}

export type GateResult<T> = GateConflictResult | GateSuccessResult<T> | GateErrorResult;

export function isGateConflict<T>(result: GateResult<T>): result is GateConflictResult {
	return result.conflict === true;
}

export function isGateError<T>(result: GateResult<T>): result is GateErrorResult {
	return !result.conflict && "error" in result;
}

/**
 * Acquires the household command gate, runs the mutation, and releases the gate.
 * Returns { conflict: true } if the gate is held.
 * Errors thrown by the mutation are caught and returned as { error }.
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
		return { conflict: false, error: error instanceof Error ? error : new Error(String(error)) };
	}
}
