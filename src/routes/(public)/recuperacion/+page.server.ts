import { fail, redirect } from "@sveltejs/kit";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { message, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { recoverySchema } from "$lib/auth/recovery-schema";
import { hashPassword } from "$lib/server/auth/password";
import { env } from "$env/dynamic/private";
import { logger } from "$lib/server/logger";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	const enabled = !!env["RECOVERY_CREDENTIAL"] && env["RECOVERY_CREDENTIAL"].length >= 32;
	if (!enabled) redirect(303, "/login");
	return { form: await superValidate(zod4(recoverySchema)) };
};

function equalTiming(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(recoverySchema));
		if (!form.valid) {
			form.data.recoveryCredential = "";
			form.data.tempPassword = "";
			return fail(400, { form });
		}

		const configured = env["RECOVERY_CREDENTIAL"];
		if (!configured || configured.length < 32) {
			form.data.recoveryCredential = "";
			form.data.tempPassword = "";
			return message(form, "La recuperación no está disponible", { status: 400 });
		}

		if (!equalTiming(form.data.recoveryCredential, configured)) {
			form.data.recoveryCredential = "";
			form.data.tempPassword = "";
			return message(form, "La recuperación no está disponible", { status: 400 });
		}

		const credentialDigest = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(form.data.recoveryCredential),
		);
		const digestHex = Array.from(new Uint8Array(credentialDigest))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		const consumed = await locals.db
			.selectFrom("consumed_recovery_credentials")
			.select("digest")
			.where("digest", "=", digestHex)
			.executeTakeFirst();
		if (consumed) {
			form.data.recoveryCredential = "";
			form.data.tempPassword = "";
			return message(form, "La recuperación no está disponible", { status: 400 });
		}

		const admin = await locals.db
			.selectFrom("users")
			.select(["id", "household_id", "username"])
			.where("username", "=", form.data.adminUsername)
			.where("is_administrator", "=", 1)
			.executeTakeFirst();

		if (!admin || !admin.household_id) {
			form.data.recoveryCredential = "";
			form.data.tempPassword = "";
			return message(form, "La recuperación no está disponible", { status: 400 });
		}

		const nowIso = new Date().toISOString();
		const tempHash = await hashPassword(form.data.tempPassword);
		const operationId = crypto.randomUUID();

		// Mark the credential consumed BEFORE mutating the user record,
		// so a mid-operation failure cannot reuse the credential.
		await locals.db
			.insertInto("consumed_recovery_credentials")
			.values({
				digest: digestHex,
				consumed_at: nowIso,
				target_user_id: admin.id,
				operation_id: operationId,
			})
			.execute();

		await locals.db
			.updateTable("users")
			.set({
				is_active: 1,
				password_hash: tempHash,
				requires_password_change: 1,
				updated_at: nowIso,
			})
			.where("id", "=", admin.id)
			.execute();

		await locals.db.deleteFrom("sessions").where("user_id", "=", admin.id).execute();

		await insertValidatedActivity(locals.db, {
			householdId: admin.household_id,
			eventType: "operator_recovery",
			subjectType: "user",
			subjectId: admin.id,
			actorUserId: null,
			summary: { action: "recovery", target: admin.username },
			operationId: operationId,
		});

		logger.warn("operator recovery completed", { adminId: admin.id });

		form.data.recoveryCredential = "";
		form.data.tempPassword = "";
		throw redirect(303, "/login");
	},
};
