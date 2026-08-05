import type { PageServerLoad, Actions } from "./$types";
import { createMemberRepository } from "$lib/server/household/repository";
import { withGate, isGateConflict, isGateError } from "$lib/server/operations/with-gate";
import { insertValidatedActivity } from "$lib/server/activity/insert";

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
	return insertValidatedActivity(db, {
		householdId,
		eventType: type,
		subjectType: "member",
		subjectId: memberId,
		actorUserId: actorId,
		summary,
		operationId: opId,
	});
}

export const actions: Actions = {
	deactivate: async ({ locals, request }) => {
		const data = await request.formData();
		const memberId = data.get("memberId") as string;
		const householdId = locals.user!.householdId;
		const db = locals.db;
		const repo = createMemberRepository(db);

		const outcome = await withGate(db, householdId, locals.user!.id, async (ctx) => {
			const member = await repo.findById(memberId);
			if (!verifyMemberOwnership(member, householdId)) throw new Error("not_found");
			if (!member!.isActive) return { ok: true, noop: true };

			const activeCount = await repo.countActiveByHousehold(householdId);
			if (activeCount <= 2) throw new Error("last_members");

			const linkedUser = await db
				.selectFrom("users")
				.select(["id", "username"])
				.where("member_id", "=", memberId)
				.where("is_active", "=", 1)
				.executeTakeFirst();
			if (linkedUser) throw new Error("linked_user_active");

			await repo.updateActive(memberId, false, new Date().toISOString());
			await activityEvent(db, householdId, locals.user!.id, "member_deactivated", memberId, ctx.operationId, {
				action: "deactivate",
			});
			return { ok: true };
		});
		if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
		if (isGateError(outcome)) {
			return { success: false, reason: outcome.error.message };
		}
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
};
