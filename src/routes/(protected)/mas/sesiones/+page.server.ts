import type { PageServerLoad, Actions } from "./$types";
import type { Kysely } from "kysely";
import type { Database } from "$lib/server/database/schema";
import { insertValidatedActivity } from "$lib/server/activity/insert";

const NOW_ISO = () => new Date().toISOString();

function insertSessionEvent(
	db: Kysely<Database>,
	householdId: string,
	actorId: string | null,
	type: string,
	subjectId: string | null,
	summary: Record<string, unknown>,
) {
	return insertValidatedActivity(db, {
		householdId,
		eventType: type,
		subjectType: "session",
		subjectId,
		actorUserId: actorId,
		summary,
	});
}

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user!.id;
	const nowIso = NOW_ISO();
	const sessions = await locals.db
		.selectFrom("sessions")
		.select(["id", "created_at", "rotated_at", "expires_at"])
		.where("user_id", "=", userId)
		.where("expires_at", ">", nowIso)
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
		await locals.db.deleteFrom("sessions").where("id", "=", sessionId).where("user_id", "=", locals.user!.id).execute();
		await insertSessionEvent(locals.db, locals.user!.householdId, locals.user!.id, "session_revoked", sessionId, {});
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
		await insertSessionEvent(locals.db, locals.user!.householdId, locals.user!.id, "session_revoked", null, {});
		return { success: true };
	},

	adminRevokeAll: async ({ locals, request }) => {
		if (!locals.user?.isAdministrator) return { success: false, reason: "unauthorized" };
		const data = await request.formData();
		const targetUserId = data.get("targetUserId") as string;

		const target = await locals.db
			.selectFrom("users")
			.select(["household_id", "username"])
			.where("id", "=", targetUserId)
			.where("household_id", "=", locals.user.householdId)
			.executeTakeFirst();
		if (!target) return { success: false, reason: "not_found" };

		await locals.db.deleteFrom("sessions").where("user_id", "=", targetUserId).execute();
		await insertSessionEvent(locals.db, locals.user.householdId, locals.user.id, "session_revoked", null, {
			username: target.username,
		});
		return { success: true };
	},
};
