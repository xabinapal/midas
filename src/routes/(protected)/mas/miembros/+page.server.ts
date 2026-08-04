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
		const repo = createMemberRepository(locals.db);
		const activeCount = await repo.countActiveByHousehold(locals.user!.householdId);
		if (activeCount <= 2) {
			return { success: false, reason: "last_members" };
		}
		await repo.updateActive(memberId, false, new Date().toISOString());
		return { success: true };
	},
	reactivate: async ({ locals, request }) => {
		const data = await request.formData();
		const memberId = data.get("memberId") as string;
		const repo = createMemberRepository(locals.db);
		await repo.updateActive(memberId, true, new Date().toISOString());
		return { success: true };
	},
};
