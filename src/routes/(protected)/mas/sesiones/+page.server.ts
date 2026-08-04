import type { PageServerLoad } from "./$types";

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
