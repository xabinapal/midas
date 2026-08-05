import { error, fail } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { z } from "zod";
import { hashPassword } from "$lib/server/auth/password";
import { withGate, isGateConflict } from "$lib/server/operations/with-gate";
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

type AuthUser = NonNullable<App.Locals["user"]>;

function requireAdmin(locals: App.Locals): AuthUser {
	if (!locals.user?.isAdministrator) throw error(403, "No autorizado");
	return locals.user;
}

function insertActivity(
	db: Parameters<typeof withGate>[0],
	householdId: string,
	actorId: string,
	type: string,
	subjectId: string,
	opId: string,
	summary: Record<string, unknown>,
) {
	return db
		.insertInto("activity_events")
		.values({
			id: crypto.randomUUID(),
			household_id: householdId,
			event_type: type,
			subject_type: "user",
			subject_id: subjectId,
			actor_user_id: actorId,
			occurred_at: new Date().toISOString(),
			recorded_at: new Date().toISOString(),
			summary: JSON.stringify(summary),
			operation_id: opId,
			correction_of_event_id: null,
		})
		.execute();
}

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireAdmin(locals);
	const householdId = user.householdId;
	const users = await locals.db
		.selectFrom("users")
		.select(["id", "username", "is_active", "is_administrator", "requires_password_change", "member_id", "created_at"])
		.where("household_id", "=", householdId)
		.orderBy("username", "asc")
		.execute();

	const allMembers = await locals.db
		.selectFrom("members")
		.select(["id", "display_name"])
		.where("household_id", "=", householdId)
		.where("is_active", "=", 1)
		.execute();
	const linkedMemberIds = users.filter((u) => u.member_id).map((u) => u.member_id!);
	const memberNameMap = new Map(allMembers.map((m) => [m.id, m.display_name]));
	const availableMembers = allMembers.filter((m) => !linkedMemberIds.includes(m.id));

	return {
		users,
		currentUserId: user.id,
		availableMembers,
		memberNameMap,
		createForm: await superValidate(zod4(createUserSchema)),
	};
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const user = requireAdmin(locals);
		const form = await superValidate(request, zod4(createUserSchema));
		if (!form.valid) {
			form.data.tempPassword = "";
			return fail(400, { createForm: form });
		}

		const db = locals.db;
		const householdId = user.householdId;

		const outcome = await withGate(db, householdId, user.id, async (ctx) => {
			const existing = await db
				.selectFrom("users")
				.select("id")
				.where("username", "=", form.data.username)
				.executeTakeFirst();
			if (existing) throw new Error("username_exists");

			const tempHash = await hashPassword(form.data.tempPassword);
			const userId = crypto.randomUUID();
			const nowIso = new Date().toISOString();
			await db
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
			await insertActivity(db, householdId, user.id, "user_created", userId, ctx.operationId, {
				username: form.data.username,
			});
			return { userId };
		});

		form.data.tempPassword = "";
		if (isGateConflict(outcome)) return message(form, "Otra operación está en curso.", { status: 409 });
		return { success: true };
	},

	disable: async ({ locals, request }) => {
		const user = requireAdmin(locals);
		const data = await request.formData();
		const targetUserId = data.get("userId") as string;
		const db = locals.db;
		const householdId = user.householdId;

		const target = await db
			.selectFrom("users")
			.select(["id", "household_id", "is_administrator"])
			.where("id", "=", targetUserId)
			.executeTakeFirst();
		if (!target || target.household_id !== householdId) return { success: false, reason: "not_found" };
		if (target.is_administrator === 1) {
			const adminRows = await db
				.selectFrom("users")
				.select("id")
				.where("household_id", "=", householdId)
				.where("is_active", "=", 1)
				.where("is_administrator", "=", 1)
				.execute();
			if (adminRows.length <= 1) return { success: false, reason: "last_administrator" };
		}

		const outcome = await withGate(db, householdId, user.id, async (ctx) => {
			const nowIso = new Date().toISOString();
			await db.updateTable("users").set({ is_active: 0, updated_at: nowIso }).where("id", "=", targetUserId).execute();
			await db.deleteFrom("sessions").where("user_id", "=", targetUserId).execute();
			await insertActivity(db, householdId, user.id, "user_disabled", targetUserId, ctx.operationId, {
				action: "disable",
			});
			return { ok: true };
		});
		if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
		return { success: true };
	},

	reactivate: async ({ locals, request }) => {
		const user = requireAdmin(locals);
		const data = await request.formData();
		const targetUserId = data.get("userId") as string;
		const db = locals.db;
		const householdId = user.householdId;

		const target = await db
			.selectFrom("users")
			.select(["id", "household_id"])
			.where("id", "=", targetUserId)
			.executeTakeFirst();
		if (!target || target.household_id !== householdId) return { success: false, reason: "not_found" };

		const outcome = await withGate(db, householdId, user.id, async (ctx) => {
			await db
				.updateTable("users")
				.set({ is_active: 1, updated_at: new Date().toISOString() })
				.where("id", "=", targetUserId)
				.execute();
			await insertActivity(db, householdId, user.id, "user_reactivated", targetUserId, ctx.operationId, {
				action: "reactivate",
			});
			return { ok: true };
		});
		if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
		return { success: true };
	},

	toggleAdmin: async ({ locals, request }) => {
		const user = requireAdmin(locals);
		const data = await request.formData();
		const targetUserId = data.get("userId") as string;
		const makeAdmin = data.get("makeAdmin") === "true";
		const db = locals.db;
		const householdId = user.householdId;

		const target = await db
			.selectFrom("users")
			.select(["id", "household_id", "is_administrator"])
			.where("id", "=", targetUserId)
			.executeTakeFirst();
		if (!target || target.household_id !== householdId) return { success: false, reason: "not_found" };

		if (!makeAdmin && target.is_administrator === 1) {
			const adminRows = await db
				.selectFrom("users")
				.select("id")
				.where("household_id", "=", householdId)
				.where("is_active", "=", 1)
				.where("is_administrator", "=", 1)
				.execute();
			if (adminRows.length <= 1) return { success: false, reason: "last_administrator" };
		}

		const outcome = await withGate(db, householdId, user.id, async (ctx) => {
			await db
				.updateTable("users")
				.set({ is_administrator: makeAdmin ? 1 : 0, updated_at: new Date().toISOString() })
				.where("id", "=", targetUserId)
				.execute();
			await insertActivity(
				db,
				householdId,
				user.id,
				makeAdmin ? "admin_granted" : "admin_revoked",
				targetUserId,
				ctx.operationId,
				{ action: makeAdmin ? "grant_admin" : "revoke_admin" },
			);
			return { ok: true };
		});
		if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
		return { success: true };
	},

	resetPassword: async ({ locals, request }) => {
		const user = requireAdmin(locals);
		const data = await request.formData();
		const targetUserId = data.get("userId") as string;
		const tempPassword = data.get("tempPassword") as string;
		if (!tempPassword || tempPassword.length < 12)
			return { success: false, reason: "La contraseña temporal debe tener al menos 12 caracteres" };
		const db = locals.db;
		const householdId = user.householdId;

		const target = await db
			.selectFrom("users")
			.select(["id", "household_id"])
			.where("id", "=", targetUserId)
			.executeTakeFirst();
		if (!target || target.household_id !== householdId) return { success: false, reason: "not_found" };

		const tempHash = await hashPassword(tempPassword);
		const outcome = await withGate(db, householdId, user.id, async (ctx) => {
			const nowIso = new Date().toISOString();
			await db
				.updateTable("users")
				.set({ password_hash: tempHash, requires_password_change: 1, updated_at: nowIso })
				.where("id", "=", targetUserId)
				.execute();
			await db.deleteFrom("sessions").where("user_id", "=", targetUserId).execute();
			await insertActivity(db, householdId, user.id, "password_reset", targetUserId, ctx.operationId, {
				action: "admin_reset",
			});
			return { ok: true };
		});
		if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
		return { success: true };
	},
};
