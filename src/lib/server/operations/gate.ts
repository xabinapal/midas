import type { Kysely } from "kysely";
import type { Database } from "../database";
import { logger } from "../logger";

const DEFAULT_LEASE_SECONDS = 60;

export interface OperationContext {
	operationId: string;
	householdId: string;
	actorUserId: string | null;
}

export interface GateResult {
	acquired: boolean;
	context?: OperationContext;
	reason?: string;
}

export async function acquireGate(
	db: Kysely<Database>,
	householdId: string,
	actorUserId: string | null,
	now: number = Math.floor(Date.now() / 1000),
	leaseSeconds: number = DEFAULT_LEASE_SECONDS,
): Promise<GateResult> {
	const operationId = crypto.randomUUID();
	const leaseIso = new Date((now + leaseSeconds) * 1000).toISOString();

	const existing = await db
		.selectFrom("household_command_gates")
		.selectAll()
		.where("household_id", "=", householdId)
		.executeTakeFirst();

	if (!existing) {
		try {
			await db
				.insertInto("household_command_gates")
				.values({
					household_id: householdId,
					operation_id: operationId,
					expected_version: crypto.randomUUID(),
					lease_expires_at: leaseIso,
				})
				.execute();
		} catch {
			const retry = await acquireGate(db, householdId, actorUserId, now, leaseSeconds);
			return retry;
		}
	} else {
		const leaseMs = new Date(existing.lease_expires_at).getTime();
		const isExpired = leaseMs <= now * 1000;
		if (!isExpired) {
			return { acquired: false, reason: "gate_held" };
		}
		const updated = await db
			.updateTable("household_command_gates")
			.set({ operation_id: operationId, lease_expires_at: leaseIso })
			.where("household_id", "=", householdId)
			.where("lease_expires_at", "=", existing.lease_expires_at)
			.executeTakeFirst();
		if (!updated || updated.numUpdatedRows === 0n) {
			return { acquired: false, reason: "contention" };
		}
	}

	await db
		.insertInto("operation_roots")
		.values({
			id: operationId,
			household_id: householdId,
			actor_user_id: actorUserId,
			operation_type: "mutation",
			payload_fingerprint: crypto.randomUUID(),
			status: "pending",
			result_type: null,
			created_at: new Date(now * 1000).toISOString(),
			completed_at: null,
		})
		.execute();

	return {
		acquired: true,
		context: { operationId, householdId, actorUserId },
	};
}

export async function completeOperation(
	db: Kysely<Database>,
	context: OperationContext,
	now: number = Math.floor(Date.now() / 1000),
): Promise<void> {
	const nowIso = new Date(now * 1000).toISOString();
	await db
		.updateTable("operation_roots")
		.set({ status: "complete", completed_at: nowIso })
		.where("id", "=", context.operationId)
		.execute();
	await releaseGate(db, context.householdId);
}

export async function failOperation(db: Kysely<Database>, context: OperationContext): Promise<void> {
	await releaseGate(db, context.householdId);
	logger.warn("operation failed", { operationId: context.operationId });
}

async function releaseGate(db: Kysely<Database>, householdId: string): Promise<void> {
	const farFuture = new Date(0).toISOString();
	await db
		.updateTable("household_command_gates")
		.set({ lease_expires_at: farFuture })
		.where("household_id", "=", householdId)
		.execute();
}
