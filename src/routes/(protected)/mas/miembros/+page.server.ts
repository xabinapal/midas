import type { PageServerLoad, Actions } from "./$types";
import { createMemberRepository } from "$lib/server/household/repository";

export const load: PageServerLoad = async ({ locals }) => {
	const householdId = locals.user!.householdId;
	const repo = createMemberRepository(locals.db);
	const members = await repo.findByHousehold(householdId);
	return { members };
};

export const actions: Actions = {
	deactivate: async ({ locals, request }) => {
		const data = await request.formData();
		const memberId = data.get("memberId") as string;
		const db = locals.db;
		const repo = createMemberRepository(db);
		const activeCount = await repo.countActiveByHousehold(locals.user!.householdId);
		if (activeCount <= 2) {
			return { success: false, reason: "last_members" };
		}
		await repo.updateActive(memberId, false, new Date().toISOString());
		const nowIso = new Date().toISOString();
		await db
			.insertInto("activity_events")
			.values({
				id: crypto.randomUUID(),
				household_id: locals.user!.householdId,
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
		const db = locals.db;
		const repo = createMemberRepository(db);
		await repo.updateActive(memberId, true, new Date().toISOString());
		const nowIso = new Date().toISOString();
		await db
			.insertInto("activity_events")
			.values({
				id: crypto.randomUUID(),
				household_id: locals.user!.householdId,
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
};
