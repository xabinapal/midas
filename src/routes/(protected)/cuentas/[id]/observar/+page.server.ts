import { error, fail, redirect } from "@sveltejs/kit";
import { message, setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { parseAmountToMinorUnits } from "$lib/accounts/money";
import { effectiveAtFromDateInput, observationSchema, todayDateInput } from "$lib/accounts/schemas";
import { formatMinorUnits } from "$lib/accounts/money";
import { formatDate } from "$lib/format/format";
import { createAccountServices } from "$lib/server/accounts/services";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { isGateConflict, isGateError, withGate } from "$lib/server/operations/with-gate";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
	const householdId = locals.user!.householdId;
	const { accountService, repositories } = createAccountServices(locals.db);
	const account = await accountService.getAccount(householdId, params.id).catch(() => null);
	if (!account) throw error(404, "Cuenta no encontrada");
	if (account.status === "draft") throw error(409, "Activa la cuenta antes de observar su saldo");

	const household = await repositories.households.findById(householdId);
	return {
		account,
		form: await superValidate(
			{ effectiveDate: todayDateInput(household?.timezone ?? "Europe/Madrid") },
			zod4(observationSchema),
		),
	};
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const householdId = locals.user!.householdId;
		const form = await superValidate(request, zod4(observationSchema));
		if (!form.valid) return fail(400, { form });

		const { accountService, observationService } = createAccountServices(locals.db);
		const account = await accountService.getAccount(householdId, params.id).catch(() => null);
		if (!account) throw error(404, "Cuenta no encontrada");

		const amountMinor = parseAmountToMinorUnits(form.data.amount, account.currency);
		if (amountMinor === null) {
			return setError(form, "amount", "Indica un importe válido (por ejemplo 1.234,56)");
		}

		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const observation = await observationService.recordObservation(
				householdId,
				{
					accountId: params.id,
					amountMinor,
					effectiveAt: effectiveAtFromDateInput(form.data.effectiveDate),
				},
				now,
				ctx.operationId,
			);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "balance_observation_recorded",
				subjectType: "account",
				subjectId: params.id,
				actorUserId: locals.user!.id,
				summary: {
					accountName: account.name,
					amount: formatMinorUnits(observation.amountMinor, account.currency),
					observedAt: formatDate(observation.effectiveAt),
				},
				operationId: ctx.operationId,
			});
			return observation;
		});

		if (isGateConflict(outcome)) {
			return message(form, "Otra operación está en curso. Inténtalo de nuevo.", { status: 409 });
		}
		if (isGateError(outcome)) {
			if (outcome.error.message === "account_not_active") {
				return message(form, "Activa la cuenta antes de observar su saldo", { status: 400 });
			}
			return message(form, "No se pudo registrar la observación", { status: 400 });
		}

		throw redirect(303, `/cuentas/${params.id}`);
	},
};
