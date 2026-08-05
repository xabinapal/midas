import type { Kysely } from "kysely";
import type { Database } from "../database";
import { hashPassword } from "../auth/password";
import { logger } from "../logger";

export interface BootstrapInput {
	bootstrapCredential: string;
	householdName: string;
	currency: string;
	timezone: string;
	members: Array<{ displayName: string; defaultWeight: number }>;
	adminMemberIndex: number;
	adminUsername: string;
	adminPassword: string;
}

export interface BootstrapResult {
	success: boolean;
	householdId?: string;
	adminUserId?: string;
}

const MIN_CREDENTIAL_BYTES = 32;
const GATE_LEASE_SECONDS = 60;

function equalTiming(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

export function isBootstrapAvailable(userCount: number, gateState: string): boolean {
	return userCount === 0 && gateState !== "complete";
}

export function validateBootstrapCredential(submitted: string, configured: string | undefined): boolean {
	if (!configured) return false;
	if (new TextEncoder().encode(configured).byteLength < MIN_CREDENTIAL_BYTES) return false;
	return equalTiming(submitted, configured);
}

export async function performBootstrap(
	db: Kysely<Database>,
	input: BootstrapInput,
	configuredCredential: string | undefined,
	now: number = Math.floor(Date.now() / 1000),
	hash: (password: string) => Promise<string> = hashPassword,
): Promise<BootstrapResult> {
	const userCount = await db.selectFrom("users").select("id").execute();
	if (userCount.length > 0) {
		logger.warn("bootstrap rejected: users already exist");
		return { success: false };
	}

	const gate = await db.selectFrom("bootstrap_gate").selectAll().where("id", "=", 1).executeTakeFirst();
	const gateState = gate?.state ?? "available";

	if (gateState === "complete") {
		return { success: false };
	}

	if (!validateBootstrapCredential(input.bootstrapCredential, configuredCredential)) {
		logger.warn("bootstrap rejected: invalid credential");
		return { success: false };
	}

	if (input.members.length < 2) {
		return { success: false };
	}

	if (input.adminMemberIndex < 0 || input.adminMemberIndex >= input.members.length) {
		return { success: false };
	}

	const operationId = crypto.randomUUID();
	const leaseIso = new Date((now + GATE_LEASE_SECONDS) * 1000).toISOString();

	if (gateState === "available") {
		const acquired = await db
			.updateTable("bootstrap_gate")
			.set({ state: "held", operation_id: operationId, lease_expires_at: leaseIso })
			.where("id", "=", 1)
			.where("state", "=", "available")
			.executeTakeFirst();
		if (!acquired || acquired.numUpdatedRows === 0n) {
			logger.warn("bootstrap rejected: gate contention");
			return { success: false };
		}
	} else if (gateState === "held") {
		const leaseExpires = gate?.lease_expires_at;
		if (leaseExpires && new Date(leaseExpires).getTime() > now * 1000) {
			logger.warn("bootstrap rejected: gate held by active operation");
			return { success: false };
		}
		// Recover the expired holder from its bootstrap operation root before
		// allowing another attempt: close the stale root so the attempt ledger
		// never leaves a permanently pending operation.
		const expiredOperationId = gate?.operation_id;
		if (expiredOperationId) {
			const expiredRoot = await db
				.selectFrom("operation_roots")
				.select(["id", "status"])
				.where("id", "=", expiredOperationId)
				.executeTakeFirst();
			if (expiredRoot && expiredRoot.status === "pending") {
				await db
					.updateTable("operation_roots")
					.set({ status: "failed", result_type: "lease_expired", completed_at: new Date(now * 1000).toISOString() })
					.where("id", "=", expiredRoot.id)
					.execute();
				logger.warn("bootstrap recovered expired operation root", { operationId: expiredRoot.id });
			}
		}
		await db
			.updateTable("bootstrap_gate")
			.set({ state: "available", operation_id: null, lease_expires_at: null })
			.where("id", "=", 1)
			.execute();
		const reacquired = await db
			.updateTable("bootstrap_gate")
			.set({ state: "held", operation_id: operationId, lease_expires_at: leaseIso })
			.where("id", "=", 1)
			.where("state", "=", "available")
			.executeTakeFirst();
		if (!reacquired || reacquired.numUpdatedRows === 0n) {
			return { success: false };
		}
	}

	const nowIso = new Date(now * 1000).toISOString();
	const householdId = crypto.randomUUID();
	const adminUserId = crypto.randomUUID();

	await db
		.insertInto("operation_roots")
		.values({
			id: operationId,
			household_id: householdId,
			actor_user_id: null,
			operation_type: "bootstrap",
			payload_fingerprint: crypto.randomUUID(),
			status: "pending",
			result_type: null,
			created_at: nowIso,
			completed_at: null,
		})
		.execute();

	try {
		await db
			.insertInto("households")
			.values({
				id: householdId,
				name: input.householdName,
				currency: input.currency,
				timezone: input.timezone,
				locale: "es-ES",
				version: crypto.randomUUID(),
				created_at: nowIso,
				updated_at: nowIso,
			})
			.execute();

		const memberIds: string[] = [];
		for (const member of input.members) {
			const memberId = crypto.randomUUID();
			memberIds.push(memberId);
			await db
				.insertInto("members")
				.values({
					id: memberId,
					household_id: householdId,
					display_name: member.displayName,
					is_active: 1,
					created_at: nowIso,
					updated_at: nowIso,
				})
				.execute();

			await db
				.insertInto("member_intervals")
				.values({
					id: crypto.randomUUID(),
					member_id: memberId,
					effective_from: nowIso,
					default_weight: member.defaultWeight,
					is_active: 1,
					operation_id: null,
				})
				.execute();
		}

		const passwordHash = await hash(input.adminPassword);
		await db
			.insertInto("users")
			.values({
				id: adminUserId,
				username: input.adminUsername,
				password_hash: passwordHash,
				household_id: householdId,
				member_id: memberIds[input.adminMemberIndex] ?? null,
				is_active: 1,
				is_administrator: 1,
				requires_password_change: 0,
				created_at: nowIso,
				updated_at: nowIso,
			})
			.execute();

		await db
			.insertInto("activity_events")
			.values({
				id: crypto.randomUUID(),
				household_id: householdId,
				event_type: "bootstrap_completed",
				subject_type: "household",
				subject_id: householdId,
				actor_user_id: null,
				occurred_at: nowIso,
				recorded_at: nowIso,
				summary: JSON.stringify({ householdName: input.householdName, memberCount: input.members.length }),
				operation_id: operationId,
				correction_of_event_id: null,
			})
			.execute();

		await db
			.updateTable("bootstrap_gate")
			.set({ state: "complete", operation_id: null, lease_expires_at: null, completed_at: nowIso })
			.where("id", "=", 1)
			.execute();

		await db
			.updateTable("operation_roots")
			.set({ status: "complete", completed_at: nowIso })
			.where("id", "=", operationId)
			.execute();

		logger.info("bootstrap completed", { householdId, adminUserId });
		return { success: true, householdId, adminUserId };
	} catch (error) {
		logger.error("bootstrap failed during entity creation", {
			error: error instanceof Error ? error.message : String(error),
		});
		// Close the pending operation root so a failed attempt stays retryable
		// and the ledger reflects the failure instead of a permanent pending row.
		await db
			.updateTable("operation_roots")
			.set({ status: "failed", result_type: "error", completed_at: nowIso })
			.where("id", "=", operationId)
			.execute();
		await db
			.updateTable("bootstrap_gate")
			.set({ state: "available", operation_id: null, lease_expires_at: null })
			.where("id", "=", 1)
			.execute();
		return { success: false };
	}
}
