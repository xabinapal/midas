import { fail, redirect } from "@sveltejs/kit";
import { message, setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { customPeriodSchema } from "$lib/expenses/schemas";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { createExpenseServices } from "$lib/server/expenses/services";
import { isGateConflict, isGateError, withGate } from "$lib/server/operations/with-gate";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	return { form: await superValidate(zod4(customPeriodSchema)) };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const householdId = locals.user!.householdId;
		const form = await superValidate(request, zod4(customPeriodSchema));
		if (!form.valid) return fail(400, { form });

		const { planningService } = createExpenseServices(locals.db);
		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const period = await planningService.createCustomPeriod(
				householdId,
				{ label: form.data.label, startDate: form.data.startDate, endDate: form.data.endDate },
				now,
				ctx.operationId,
			);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "reporting_period_created",
				subjectType: "reporting_period",
				subjectId: period.id,
				actorUserId: locals.user!.id,
				summary: { periodLabel: period.label },
				operationId: ctx.operationId,
			});
			return period;
		});

		if (isGateConflict(outcome)) {
			return message(form, "Otra operación está en curso. Inténtalo de nuevo.", { status: 409 });
		}
		if (isGateError(outcome)) {
			switch (outcome.error.message) {
				case "period_dates_invalid":
					return setError(form, "endDate", "El fin debe ser posterior al inicio");
				case "period_label_required":
					return setError(form, "label", "El nombre del periodo es obligatorio");
				default:
					return message(form, "No se pudo crear el periodo", { status: 400 });
			}
		}

		throw redirect(303, `/gastos?periodo=${outcome.result.slug}`);
	},
};
