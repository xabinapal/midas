import type { PageServerLoad, Actions } from "./$types";
import { createMemberRepository } from "$lib/server/household/repository";

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

export const actions: Actions = {
	deactivate: async ({ locals, request }) => {
		const data = await request.formData();
		const memberId = data.get("memberId") as string;
		const householdId = locals.user!.householdId;
		const db = locals.db;
		const repo = createMemberRepository(db);

		const member = await repo.findById(memberId);
		if (!verifyMemberOwnership(member, householdId)) {
			return { success: false, reason: "not_found" };
		}

		if (!member!.isActive) return { success: true };

		const activeCount = await repo.countActiveByHousehold(householdId);
		if (activeCount <= 2) {
			return { success: false, reason: "last_members" };
		}

		const linkedUser = await db
			.selectFrom("users")
			.select(["id", "username"])
			.where("member_id", "=", memberId)
			.where("is_active", "=", 1)
			.executeTakeFirst();
		if (linkedUser) {
			return {
				success: false,
				reason: "linked_user_active",
				linkedUsername: linkedUser.username,
			};
		}

		await repo.updateActive(memberId, false, new Date().toISOString());
		const nowIso = new Date().toISOString();
		await db
			.insertInto("activity_events")
			.values({
				id: crypto.randomUUID(),
				household_id: householdId,
				event_type: "member_deactivated",
				subject_type: "member",
				subject_id: memberId,
				actor_user_id: locals.user!.id,
				occurred_at: nowIso,
				recorded_at: nowIso,
				summary: JSON.stringify({ action: "deactivate" }),
				operation_id: null,
				correction_of_event_id: null,
			})
			.execute();
		return { success: true };
	},

	reactivate: async ({ locals, request }) => {
		const data = await request.formData();
		const memberId = data.get("memberId") as string;
		const householdId = locals.user!.householdId;
		const db = locals.db;
		const repo = createMemberRepository(db);

		const member = await repo.findById(memberId);
		if (!verifyMemberOwnership(member, householdId)) {
			return { success: false, reason: "not_found" };
		}

		if (member!.isActive) return { success: true };

		await repo.updateActive(memberId, true, new Date().toISOString());
		const nowIso = new Date().toISOString();
		await db
			.insertInto("activity_events")
			.values({
				id: crypto.randomUUID(),
				household_id: householdId,
				event_type: "member_reactivated",
				subject_type: "member",
				subject_id: memberId,
				actor_user_id: locals.user!.id,
				occurred_at: nowIso,
				recorded_at: nowIso,
				summary: JSON.stringify({ action: "reactivate" }),
				operation_id: null,
				correction_of_event_id: null,
			})
			.execute();
		return { success: true };
	},

	delete: async ({ locals, request }) => {
		const data = await request.formData();
		const memberId = data.get("memberId") as string;
		const householdId = locals.user!.householdId;
		const db = locals.db;
		const repo = createMemberRepository(db);

		const member = await repo.findById(memberId);
		if (!verifyMemberOwnership(member, householdId)) {
			return { success: false, reason: "not_found" };
		}

		const hasRefs = await repo.hasFinancialReferences(memberId);
		if (hasRefs) {
			return { success: false, reason: "has_references" };
		}

		await db.deleteFrom("member_intervals").where("member_id", "=", memberId).execute();
		await db.deleteFrom("members").where("id", "=", memberId).execute();
		return { success: true };
	},
};
