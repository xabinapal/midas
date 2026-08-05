import { error, redirect } from "@sveltejs/kit";
import { setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { z } from "zod";
import { createMemberRepository } from "$lib/server/household/repository";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { withGate, isGateConflict, isGateError } from "$lib/server/operations/with-gate";
import type { Actions, PageServerLoad } from "./$types";

const editMemberSchema = z.object({
	displayName: z.string().min(1, "El nombre es obligatorio").max(100),
	defaultWeight: z.coerce.number().int().min(0, "El peso debe ser positivo"),
});

export const load: PageServerLoad = async ({ locals, params }) => {
	const repo = createMemberRepository(locals.db);
	const member = await repo.findById(params.id);
	if (!member || member.householdId !== locals.user!.householdId) {
		throw error(404, "Miembro no encontrado");
	}
	const linkedUsers = await locals.db
		.selectFrom("users")
		.select(["id", "username", "is_active"])
		.where("member_id", "=", params.id)
		.execute();
	return {
		member,
		linkedUsers,
		form: await superValidate(
			{ displayName: member.displayName, defaultWeight: member.defaultWeight },
			zod4(editMemberSchema),
		),
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
			if (form.data.defaultWeight !== member.defaultWeight && member.isActive) {
				const totalActiveWeight = await repo.sumActiveWeight(householdId);
				if (totalActiveWeight - member.defaultWeight + form.data.defaultWeight <= 0) {
					throw new Error("last_weight");
				}
			}
			await db
				.updateTable("members")
				.set({ display_name: form.data.displayName, updated_at: nowIso })
				.where("id", "=", params.id)
				.execute();
			if (form.data.defaultWeight !== member.defaultWeight) {
				await repo.updateWeight(params.id, form.data.defaultWeight, nowIso);
			}
			await insertValidatedActivity(db, {
				householdId,
				eventType: "member_updated",
				subjectType: "member",
				subjectId: params.id,
				actorUserId: locals.user!.id,
				summary: { memberName: form.data.displayName, defaultWeight: form.data.defaultWeight },
				operationId: ctx.operationId,
			});
			return { ok: true };
		});

		if (isGateConflict(outcome)) {
			return { form, conflict: true };
		}
		if (isGateError(outcome) && outcome.error.message === "last_weight") {
			return setError(
				form,
				"defaultWeight",
				"El peso total de reparto de los miembros activos debe ser mayor que cero",
			);
		}

		throw redirect(303, "/mas/miembros");
	},

	delete: async ({ locals, params }) => {
		const db = locals.db;
		const householdId = locals.user!.householdId;
		const repo = createMemberRepository(db);
		const member = await repo.findById(params.id);
		if (!member || member.householdId !== householdId) throw error(404, "Miembro no encontrado");

		if (await repo.hasFinancialReferences(member.id)) {
			return { deleteResult: { success: false, reason: "has_references" } };
		}
		if (await repo.hasActivityReferences(member.id)) {
			return { deleteResult: { success: false, reason: "has_references" } };
		}

		const outcome = await withGate(db, householdId, locals.user!.id, async (ctx) => {
			await db.deleteFrom("member_intervals").where("member_id", "=", member.id).execute();
			await db.deleteFrom("members").where("id", "=", member.id).execute();
			await insertValidatedActivity(db, {
				householdId,
				eventType: "member_deleted",
				subjectType: "member",
				subjectId: member.id,
				actorUserId: locals.user!.id,
				summary: { memberName: member.displayName },
				operationId: ctx.operationId,
			});
			return { ok: true };
		});
		if (isGateConflict(outcome)) return { deleteResult: { success: false, reason: "conflict" } };
		if (isGateError(outcome)) return { deleteResult: { success: false, reason: outcome.error.message } };

		throw redirect(303, "/mas/miembros");
	},
};
