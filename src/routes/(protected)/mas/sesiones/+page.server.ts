import type { PageServerLoad, Actions } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user!.id;
	const sessions = await locals.db
		.selectFrom("sessions")
		.select(["id", "created_at", "rotated_at", "expires_at"])
		.where("user_id", "=", userId)
		.orderBy("created_at", "desc")
		.execute();
	return {
		sessions,
		currentSessionId: locals.sessionId,
	};
};

export const actions: Actions = {
	revoke: async ({ locals, request }) => {
		const data = await request.formData();
		const sessionId = data.get("sessionId") as string;
		if (sessionId === locals.sessionId) return { success: false, reason: "current" };
		await locals.db.deleteFrom("sessions").where("id", "=", sessionId).execute();
		return { success: true };
	},
	revokeAllOthers: async ({ locals }) => {
		const userId = locals.user!.id;
		const sessionId = locals.sessionId;
		await locals.db
			.deleteFrom("sessions")
			.where("user_id", "=", userId)
			.where("id", "!=", sessionId ?? "")
			.execute();
		return { success: true };
	},
};
