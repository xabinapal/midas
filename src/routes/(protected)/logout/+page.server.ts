import { redirect } from "@sveltejs/kit";
import { revokeSession, SESSION_COOKIE_NAME } from "$lib/server/auth/request";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) redirect(303, "/login");
	return {};
};

export const actions: Actions = {
	default: async ({ cookies, locals, url }) => {
		if (locals.sessionId) {
			await revokeSession(locals.db, locals.sessionId);
		}
		const householdId = locals.user?.householdId;
		const userId = locals.user?.id;
		locals.user = null;
		locals.sessionId = null;
		cookies.delete(SESSION_COOKIE_NAME, {
			path: "/",
			httpOnly: true,
			sameSite: "lax",
			secure: url.protocol === "https:",
		});
		if (householdId && userId) {
			const nowIso = new Date().toISOString();
			await locals.db
				.insertInto("activity_events")
				.values({
					id: crypto.randomUUID(),
					household_id: householdId,
					event_type: "session_revoked",
					subject_type: "user",
					subject_id: userId,
					actor_user_id: userId,
					occurred_at: nowIso,
					recorded_at: nowIso,
					summary: JSON.stringify({ action: "logout" }),
					operation_id: null,
					correction_of_event_id: null,
				})
				.execute();
		}
		redirect(303, "/login");
	},
};
