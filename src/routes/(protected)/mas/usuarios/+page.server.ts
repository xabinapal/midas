import { error, fail } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { z } from "zod";
import { hashPassword } from "$lib/server/auth/password";
import { createCredentialsRepository } from "$lib/server/auth/credentials-repository";
import { disableUser, reactivateUser, adminResetPassword } from "$lib/server/auth/credentials";
import type { PageServerLoad, Actions } from "./$types";

const createUserSchema = z.object({
	username: z
		.string()
		.min(3, "El nombre de usuario debe tener al menos 3 caracteres")
		.max(64)
		.regex(/^[a-z0-9._-]+$/, "Solo minúsculas, números, puntos, guiones y guiones bajos"),
	tempPassword: z.string().min(12, "La contraseña temporal debe tener al menos 12 caracteres").max(128),
	memberId: z.string().optional(),
});

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user?.isAdministrator) {
		throw error(403, "No tienes permiso de administrador");
	}
	const householdId = locals.user.householdId;
	const users = await locals.db
		.selectFrom("users")
		.select(["id", "username", "is_active", "is_administrator", "requires_password_change", "member_id", "created_at"])
		.where("household_id", "=", householdId)
		.orderBy("username", "asc")
		.execute();

	const linkedMemberIds = users.filter((u) => u.member_id).map((u) => u.member_id!);
	const allMembers = await locals.db
		.selectFrom("members")
		.select(["id", "display_name"])
		.where("household_id", "=", householdId)
		.where("is_active", "=", 1)
		.execute();
	const memberNameMap = new Map(allMembers.map((m) => [m.id, m.display_name]));
	const availableMembers = allMembers.filter((m) => !linkedMemberIds.includes(m.id));

	return {
		users,
		currentUserId: locals.user.id,
		availableMembers,
		memberNameMap,
		createForm: await superValidate(zod4(createUserSchema)),
	};
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		if (!locals.user?.isAdministrator) throw error(403, "No autorizado");
		const form = await superValidate(request, zod4(createUserSchema));
		if (!form.valid) {
			form.data.tempPassword = "";
			return fail(400, { createForm: form });
		}

		const householdId = locals.user.householdId;
		const existing = await locals.db
			.selectFrom("users")
			.select("id")
			.where("username", "=", form.data.username)
			.executeTakeFirst();
		if (existing) {
			form.data.tempPassword = "";
			return message(form, "El nombre de usuario ya existe", { status: 400 });
		}

		const nowIso = new Date().toISOString();
		const tempHash = await hashPassword(form.data.tempPassword);
		const userId = crypto.randomUUID();

		await locals.db
			.insertInto("users")
			.values({
				id: userId,
				username: form.data.username,
				password_hash: tempHash,
				household_id: householdId,
				member_id: form.data.memberId || null,
				is_active: 1,
				is_administrator: 0,
				requires_password_change: 1,
				created_at: nowIso,
				updated_at: nowIso,
			})
			.execute();

		await locals.db
			.insertInto("activity_events")
			.values({
				id: crypto.randomUUID(),
				household_id: householdId,
				event_type: "user_created",
				subject_type: "user",
				subject_id: userId,
				actor_user_id: locals.user.id,
				occurred_at: nowIso,
				recorded_at: nowIso,
				summary: JSON.stringify({ username: form.data.username }),
				operation_id: null,
				correction_of_event_id: null,
			})
			.execute();

		return { success: true };
	},

	disable: async ({ locals, request }) => {
		if (!locals.user?.isAdministrator) throw error(403, "No autorizado");
		const data = await request.formData();
		const targetUserId = data.get("userId") as string;
		const now = Math.floor(Date.now() / 1000);
		const creds = createCredentialsRepository(locals.db);
		const result = await disableUser(creds, locals.user.id, targetUserId, now);
		if (!result.success) return { success: false, reason: result.reason ?? "error" };
		const nowIso = new Date().toISOString();
		await locals.db
			.insertInto("activity_events")
			.values({
				id: crypto.randomUUID(),
				household_id: locals.user.householdId,
				event_type: "user_disabled",
				subject_type: "user",
				subject_id: targetUserId,
				actor_user_id: locals.user.id,
				occurred_at: nowIso,
				recorded_at: nowIso,
				summary: JSON.stringify({ action: "disable" }),
				operation_id: null,
				correction_of_event_id: null,
			})
			.execute();
		return { success: true };
	},

	reactivate: async ({ locals, request }) => {
		if (!locals.user?.isAdministrator) throw error(403, "No autorizado");
		const data = await request.formData();
		const targetUserId = data.get("userId") as string;
		const now = Math.floor(Date.now() / 1000);
		const creds = createCredentialsRepository(locals.db);
		const success = await reactivateUser(creds, locals.user.id, targetUserId, now);
		if (!success) return { success: false, reason: "unauthorized" };
		const nowIso = new Date().toISOString();
		await locals.db
			.insertInto("activity_events")
			.values({
				id: crypto.randomUUID(),
				household_id: locals.user.householdId,
				event_type: "user_reactivated",
				subject_type: "user",
				subject_id: targetUserId,
				actor_user_id: locals.user.id,
				occurred_at: nowIso,
				recorded_at: nowIso,
				summary: JSON.stringify({ action: "reactivate" }),
				operation_id: null,
				correction_of_event_id: null,
			})
			.execute();
		return { success: true };
	},

	toggleAdmin: async ({ locals, request }) => {
		if (!locals.user?.isAdministrator) throw error(403, "No autorizado");
		const data = await request.formData();
		const targetUserId = data.get("userId") as string;
		const makeAdmin = data.get("makeAdmin") === "true";

		const target = await locals.db
			.selectFrom("users")
			.select(["id", "household_id", "is_administrator"])
			.where("id", "=", targetUserId)
			.executeTakeFirst();
		if (!target || target.household_id !== locals.user.householdId) {
			return { success: false, reason: "not_found" };
		}

		if (!makeAdmin && target.is_administrator === 1) {
			const adminRows = await locals.db
				.selectFrom("users")
				.select("id")
				.where("household_id", "=", locals.user.householdId)
				.where("is_active", "=", 1)
				.where("is_administrator", "=", 1)
				.execute();
			if (adminRows.length <= 1) {
				return { success: false, reason: "last_administrator" };
			}
		}

		const nowIso = new Date().toISOString();
		await locals.db
			.updateTable("users")
			.set({ is_administrator: makeAdmin ? 1 : 0, updated_at: nowIso })
			.where("id", "=", targetUserId)
			.execute();

		await locals.db
			.insertInto("activity_events")
			.values({
				id: crypto.randomUUID(),
				household_id: locals.user.householdId,
				event_type: makeAdmin ? "admin_granted" : "admin_revoked",
				subject_type: "user",
				subject_id: targetUserId,
				actor_user_id: locals.user.id,
				occurred_at: nowIso,
				recorded_at: nowIso,
				summary: JSON.stringify({ action: makeAdmin ? "grant_admin" : "revoke_admin" }),
				operation_id: null,
				correction_of_event_id: null,
			})
			.execute();

		return { success: true };
	},

	resetPassword: async ({ locals, request }) => {
		if (!locals.user?.isAdministrator) throw error(403, "No autorizado");
		const data = await request.formData();
		const targetUserId = data.get("userId") as string;
		const tempPassword = data.get("tempPassword") as string;
		if (!tempPassword || tempPassword.length < 12) {
			return { success: false, reason: "La contraseña temporal debe tener al menos 12 caracteres" };
		}
		const now = Math.floor(Date.now() / 1000);
		const creds = createCredentialsRepository(locals.db);
		const success = await adminResetPassword(creds, locals.user.id, targetUserId, tempPassword, now, hashPassword);
		if (!success) return { success: false, reason: "No se pudo restablecer la contraseña" };
		const nowIso = new Date().toISOString();
		await locals.db
			.insertInto("activity_events")
			.values({
				id: crypto.randomUUID(),
				household_id: locals.user.householdId,
				event_type: "password_reset",
				subject_type: "user",
				subject_id: targetUserId,
				actor_user_id: locals.user.id,
				occurred_at: nowIso,
				recorded_at: nowIso,
				summary: JSON.stringify({ action: "admin_reset" }),
				operation_id: null,
				correction_of_event_id: null,
			})
			.execute();
		return { success: true };
	},
};
