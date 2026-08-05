import type { PageServerLoad, Actions } from "./$types";
import { createMemberRepository } from "$lib/server/household/repository";
import { withGate, isGateConflict } from "$lib/server/operations/with-gate";

export const load: PageServerLoad = async ({ locals }) => {
	const householdId = locals.user!.householdId;
	const repo = createMemberRepository(locals.db);
	const members = await repo.findByHousehold(householdId);
	const linkedUserMap = await locals.db
		.selectFrom("users")
		.select(["member_id", "username"])
		.where("household_id", "=", householdId)
		.where("is_active", "=", 1)
		.execute();
	return { members, linkedUserMap };
};

function verifyMemberOwnership(
	member: { householdId: string } | undefined,
	expectedHouseholdId: string,
): member is { householdId: string } {
	return !!member && member.householdId === expectedHouseholdId;
}

function activityEvent(
	db: Parameters<typeof withGate>[0],
	householdId: string,
	actorId: string,
	type: string,
	memberId: string,
	opId: string,
	summary: Record<string, unknown>,
) {
	return db
		.insertInto("activity_events")
		.values({
			id: crypto.randomUUID(),
			household_id: householdId,
			event_type: type,
			subject_type: "member",
			subject_id: memberId,
			actor_user_id: actorId,
			occurred_at: new Date().toISOString(),
			recorded_at: new Date().toISOString(),
			summary: JSON.stringify(summary),
			operation_id: opId,
			correction_of_event_id: null,
		})
		.execute();
}

export const actions: Actions = {
	deactivate: async ({ locals, request }) => {
		const data = await request.formData();
		const memberId = data.get("memberId") as string;
		const householdId = locals.user!.householdId;
		const db = locals.db;
		const repo = createMemberRepository(db);

		const member = await repo.findById(memberId);
		if (!verifyMemberOwnership(member, householdId)) return { success: false, reason: "not_found" };
		if (!member!.isActive) return { success: true };

		const activeCount = await repo.countActiveByHousehold(householdId);
		if (activeCount <= 2) return { success: false, reason: "last_members" };

		const linkedUser = await db
			.selectFrom("users")
			.select(["id", "username"])
			.where("member_id", "=", memberId)
			.where("is_active", "=", 1)
			.executeTakeFirst();
		if (linkedUser) return { success: false, reason: "linked_user_active", linkedUsername: linkedUser.username };

		const outcome = await withGate(db, householdId, locals.user!.id, async (ctx) => {
			await repo.updateActive(memberId, false, new Date().toISOString());
			await activityEvent(db, householdId, locals.user!.id, "member_deactivated", memberId, ctx.operationId, {
				action: "deactivate",
			});
			return { ok: true };
		});
		if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
		return { success: true };
	},

	reactivate: async ({ locals, request }) => {
		const data = await request.formData();
		const memberId = data.get("memberId") as string;
		const householdId = locals.user!.householdId;
		const db = locals.db;
		const repo = createMemberRepository(db);

		const member = await repo.findById(memberId);
		if (!verifyMemberOwnership(member, householdId)) return { success: false, reason: "not_found" };
		if (member!.isActive) return { success: true };

		const outcome = await withGate(db, householdId, locals.user!.id, async (ctx) => {
			await repo.updateActive(memberId, true, new Date().toISOString());
			await activityEvent(db, householdId, locals.user!.id, "member_reactivated", memberId, ctx.operationId, {
				action: "reactivate",
			});
			return { ok: true };
		});
		if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
		return { success: true };
	},

	delete: async ({ locals, request }) => {
		const data = await request.formData();
		const memberId = data.get("memberId") as string;
		const householdId = locals.user!.householdId;
		const db = locals.db;
		const repo = createMemberRepository(db);

		const member = await repo.findById(memberId);
		if (!verifyMemberOwnership(member, householdId)) return { success: false, reason: "not_found" };

		const hasRefs = await repo.hasFinancialReferences(memberId);
		if (hasRefs) return { success: false, reason: "has_references" };

		const outcome = await withGate(db, householdId, locals.user!.id, async () => {
			await db.deleteFrom("member_intervals").where("member_id", "=", memberId).execute();
			await db.deleteFrom("members").where("id", "=", memberId).execute();
			return { ok: true };
		});
		if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
		return { success: true };
	},
};
