import { error, redirect } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { z } from "zod";
import { createMemberRepository } from "$lib/server/household/repository";
import { withGate, isGateConflict } from "$lib/server/operations/with-gate";
import type { Actions, PageServerLoad } from "./$types";

const editMemberSchema = z.object({
	displayName: z.string().min(1, "El nombre es obligatorio").max(100),
});

export const load: PageServerLoad = async ({ locals, params }) => {
	const repo = createMemberRepository(locals.db);
	const member = await repo.findById(params.id);
	if (!member || member.householdId !== locals.user!.householdId) {
		throw error(404, "Miembro no encontrado");
	}
	return {
		member,
		form: await superValidate({ displayName: member.displayName }, zod4(editMemberSchema)),
	};
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const db = locals.db;
		const householdId = locals.user!.householdId;
		const repo = createMemberRepository(db);
		const member = await repo.findById(params.id);
		if (!member || member.householdId !== householdId) throw error(404, "Miembro no encontrado");

		const form = await superValidate(request, zod4(editMemberSchema));
		if (!form.valid) return { form };

		const outcome = await withGate(db, householdId, locals.user!.id, async (ctx) => {
			const nowIso = new Date().toISOString();
			await db
				.updateTable("members")
				.set({ display_name: form.data.displayName, updated_at: nowIso })
				.where("id", "=", params.id)
				.execute();
			await db
				.insertInto("activity_events")
				.values({
					id: crypto.randomUUID(),
					household_id: householdId,
					event_type: "member_updated",
					subject_type: "member",
					subject_id: params.id,
					actor_user_id: locals.user!.id,
					occurred_at: nowIso,
					recorded_at: nowIso,
					summary: JSON.stringify({ memberName: form.data.displayName }),
					operation_id: ctx.operationId,
					correction_of_event_id: null,
				})
				.execute();
			return { ok: true };
		});

		if (isGateConflict(outcome)) {
			return { form, conflict: true };
		}

		throw redirect(303, "/mas/miembros");
	},
};
