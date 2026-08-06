import { error, fail, redirect } from "@sveltejs/kit";
import { message, setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { accountEditSchema } from "$lib/accounts/schemas";
import { createAccountServices } from "$lib/server/accounts/services";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { isGateConflict, isGateError, withGate } from "$lib/server/operations/with-gate";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
	const householdId = locals.user!.householdId;
	const { accountService, repositories } = createAccountServices(locals.db);
	const account = await accountService.getAccount(householdId, params.id).catch(() => null);
	if (!account) throw error(404, "Cuenta no encontrada");
	if (account.status !== "draft") throw error(409, "Solo las cuentas en borrador pueden editarse");

	const members = await repositories.members.findByHousehold(householdId);
	return {
		account,
		members: members.filter((member) => member.isActive),
		form: await superValidate(
			{ name: account.name, holderMemberIds: account.holders.map((holder) => holder.memberId) },
			zod4(accountEditSchema),
		),
	};
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const householdId = locals.user!.householdId;
		const form = await superValidate(request, zod4(accountEditSchema));
		if (!form.valid) return fail(400, { form });

		const { accountService } = createAccountServices(locals.db);
		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			await accountService.updateDraftAccount(
				householdId,
				params.id,
				{ name: form.data.name, holderMemberIds: form.data.holderMemberIds },
				now,
				ctx.operationId,
			);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "account_updated",
				subjectType: "account",
				subjectId: params.id,
				actorUserId: locals.user!.id,
				summary: { accountName: form.data.name.trim() },
				operationId: ctx.operationId,
			});
			return { ok: true };
		});

		if (isGateConflict(outcome)) {
			return message(form, "Otra operación está en curso. Inténtalo de nuevo.", { status: 409 });
		}
		if (isGateError(outcome)) {
			switch (outcome.error.message) {
				case "account_not_found":
					throw error(404, "Cuenta no encontrada");
				case "account_not_draft":
					throw error(409, "Solo las cuentas en borrador pueden editarse");
				case "account_name_required":
					return setError(form, "name", "El nombre es obligatorio");
				case "personal_account_requires_single_owner":
					return setError(form, "holderMemberIds._errors", "Una cuenta personal tiene exactamente un titular");
				case "shared_account_requires_two_holders":
					return setError(form, "holderMemberIds._errors", "Una cuenta compartida necesita al menos dos titulares");
				default:
					return message(form, "No se pudo guardar la cuenta", { status: 400 });
			}
		}

		throw redirect(303, `/cuentas/${params.id}`);
	},
};
