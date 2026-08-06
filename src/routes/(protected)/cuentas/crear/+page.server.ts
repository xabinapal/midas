import { fail, redirect } from "@sveltejs/kit";
import { message, setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { accountSchema } from "$lib/accounts/schemas";
import { ACCOUNT_CLASSIFICATION_LABELS } from "$lib/accounts/terms";
import { createAccountServices } from "$lib/server/accounts/services";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { isGateConflict, isGateError, withGate } from "$lib/server/operations/with-gate";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	const householdId = locals.user!.householdId;
	const { repositories } = createAccountServices(locals.db);
	const members = await repositories.members.findByHousehold(householdId);
	return {
		members: members.filter((member) => member.isActive),
		form: await superValidate(zod4(accountSchema)),
	};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const householdId = locals.user!.householdId;
		const form = await superValidate(request, zod4(accountSchema));
		if (!form.valid) return fail(400, { form });

		const { accountService } = createAccountServices(locals.db);
		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const account = await accountService.createAccount(
				householdId,
				{
					name: form.data.name,
					classification: form.data.classification,
					holderMemberIds: form.data.holderMemberIds,
				},
				new Date().toISOString(),
				ctx.operationId,
			);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "account_created",
				subjectType: "account",
				subjectId: account.id,
				actorUserId: locals.user!.id,
				summary: { accountName: account.name, classification: ACCOUNT_CLASSIFICATION_LABELS[account.classification] },
				operationId: ctx.operationId,
			});
			return { accountId: account.id };
		});

		if (isGateConflict(outcome)) {
			return message(form, "Otra operación está en curso. Inténtalo de nuevo.", { status: 409 });
		}
		if (isGateError(outcome)) {
			switch (outcome.error.message) {
				case "account_name_required":
					return setError(form, "name", "El nombre es obligatorio");
				case "personal_account_requires_single_owner":
					return setError(form, "holderMemberIds._errors", "Una cuenta personal tiene exactamente un titular");
				case "shared_account_requires_two_holders":
					return setError(form, "holderMemberIds._errors", "Una cuenta compartida necesita al menos dos titulares");
				case "holder_not_household_member":
				case "holder_not_active":
					return setError(form, "holderMemberIds._errors", "Los titulares deben ser miembros activos del hogar");
				default:
					return message(form, "No se pudo crear la cuenta", { status: 400 });
			}
		}

		throw redirect(303, `/cuentas/${outcome.result.accountId}`);
	},
};
