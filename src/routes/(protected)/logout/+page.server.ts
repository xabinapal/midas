import { redirect } from "@sveltejs/kit";
import { insertValidatedActivity } from "$lib/server/activity/insert";
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
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "session_revoked",
				subjectType: "user",
				subjectId: userId,
				actorUserId: userId,
				summary: { action: "logout" },
			});
		}
		redirect(303, "/login");
	},
};
