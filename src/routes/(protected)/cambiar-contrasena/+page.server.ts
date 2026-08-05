import { fail, redirect } from "@sveltejs/kit";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { message, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { passwordChangeSchema } from "$lib/auth/password-change-schema";
import { createSession, SESSION_COOKIE_NAME, sessionCookieOptions } from "$lib/server/auth/request";
import { hashPassword, verifyPassword } from "$lib/server/auth/password";
import { logger } from "$lib/server/logger";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, "/login");
	const forced = locals.user.requiresPasswordChange;
	return {
		form: await superValidate(zod4(passwordChangeSchema)),
		forced,
	};
};

export const actions: Actions = {
	default: async ({ cookies, locals, request, url }) => {
		if (!locals.user || !locals.sessionId) redirect(303, "/login");

		const form = await superValidate(request, zod4(passwordChangeSchema));
		if (!form.valid) {
			form.data.currentPassword = "";
			form.data.newPassword = "";
			form.data.confirmPassword = "";
			return fail(400, { form });
		}

		const db = locals.db;
		const userId = locals.user.id;
		const householdId = locals.user.householdId;
		const sessionId = locals.sessionId;

		const userRow = await db
			.selectFrom("users")
			.select(["id", "password_hash"])
			.where("id", "=", userId)
			.executeTakeFirst();

		if (!userRow) {
			form.data.currentPassword = "";
			return message(form, "No se pudo verificar tu identidad", { status: 400 });
		}

		const valid = await verifyPassword(form.data.currentPassword, userRow.password_hash);
		if (!valid) {
			form.data.currentPassword = "";
			form.data.newPassword = "";
			form.data.confirmPassword = "";
			return message(form, "La contraseña actual no es correcta", { status: 401 });
		}

		const newHash = await hashPassword(form.data.newPassword);
		const nowIso = new Date().toISOString();

		await db
			.updateTable("users")
			.set({ password_hash: newHash, requires_password_change: 0, updated_at: nowIso })
			.where("id", "=", userId)
			.execute();

		await db.deleteFrom("sessions").where("user_id", "=", userId).where("id", "!=", sessionId).execute();

		await db.deleteFrom("sessions").where("id", "=", sessionId).execute();
		const { token } = await createSession(db, userId, householdId);
		cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(url.protocol === "https:"));

		await insertValidatedActivity(db, {
			householdId,
			eventType: "password_changed",
			subjectType: "user",
			subjectId: userId,
			actorUserId: userId,
			summary: { action: "own_password_change" },
		});

		logger.info("password changed", { userId });
		throw redirect(303, "/");
	},
};
