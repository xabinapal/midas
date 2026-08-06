import { fail, redirect } from "@sveltejs/kit";
import { message, setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { formatMinorUnits, parseAmountToMinorUnits } from "$lib/accounts/money";
import { todayDateInput } from "$lib/accounts/schemas";
import { templateFormSchema } from "$lib/expenses/schemas";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { createExpenseServices } from "$lib/server/expenses/services";
import { createHouseholdRepository } from "$lib/server/household/repository";
import { isGateConflict, isGateError, withGate } from "$lib/server/operations/with-gate";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	const householdId = locals.user!.householdId;
	const { expenseService, repositories } = createExpenseServices(locals.db);

	const [categories, accounts, members, household] = await Promise.all([
		expenseService.listCategories(householdId),
		repositories.accounts.findByHousehold(householdId),
		repositories.members.findByHousehold(householdId),
		createHouseholdRepository(locals.db).findById(householdId),
	]);

	const activeMembers = members.filter((member) => member.isActive);

	return {
		categories: categories.filter((category) => category.isActive),
		accounts: accounts.filter((account) => account.status === "active"),
		members: activeMembers,
		currency: household?.currency ?? "EUR",
		form: await superValidate(
			{
				cadence: "monthly",
				intervalCount: "1",
				allocationMethod: "equal",
				memberIds: activeMembers.map((member) => member.id),
				memberValues: [],
				startDate: todayDateInput(household?.timezone ?? "Europe/Madrid"),
			},
			zod4(templateFormSchema),
		),
	};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const householdId = locals.user!.householdId;
		const form = await superValidate(request, zod4(templateFormSchema));
		if (!form.valid) return fail(400, { form });

		const { planningService } = createExpenseServices(locals.db);
		const household = await createHouseholdRepository(locals.db).findById(householdId);
		const currency = household?.currency ?? "EUR";

		const amountMinor = parseAmountToMinorUnits(form.data.amount, currency);
		if (amountMinor === null || amountMinor <= 0) {
			return setError(form, "amount", "Indica un importe válido mayor que cero (por ejemplo 1.234,56)");
		}
		const intervalCount = Number(form.data.intervalCount);
		if (!Number.isInteger(intervalCount) || intervalCount < 1) {
			return setError(form, "intervalCount", "Indica un intervalo válido");
		}

		const method = form.data.allocationMethod;
		const allocationParams = form.data.memberIds.map((memberId, index) => ({
			memberId,
			value:
				method === "custom_weight"
					? Number(form.data.memberValues[index] || 0)
					: method === "percentage"
						? Math.round(Number(form.data.memberValues[index] || 0) * 100)
						: null,
		}));

		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const template = await planningService.createTemplate(
				householdId,
				{
					categoryId: form.data.categoryId,
					description: form.data.description,
					estimatedAmountMinor: amountMinor,
					cadence: form.data.cadence,
					intervalCount,
					startDate: form.data.startDate,
					endDate: form.data.endDate?.trim() ? form.data.endDate : null,
					dueDay: form.data.dueDay?.trim() ? Number(form.data.dueDay) : null,
					serviceSpanMonths: form.data.serviceSpanMonths?.trim() ? Number(form.data.serviceSpanMonths) : null,
					accountHintId: form.data.accountHintId?.trim() ? form.data.accountHintId : null,
					allocationMethod: method,
					allocationParams,
				},
				now,
				ctx.operationId,
			);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "template_created",
				subjectType: "template",
				subjectId: template.id,
				actorUserId: locals.user!.id,
				summary: { templateDescription: template.description, amount: formatMinorUnits(amountMinor, currency) },
				operationId: ctx.operationId,
			});
			return template;
		});

		if (isGateConflict(outcome)) {
			return message(form, "Otra operación está en curso. Inténtalo de nuevo.", { status: 409 });
		}
		if (isGateError(outcome)) {
			switch (outcome.error.message) {
				case "template_method_not_supported":
					return setError(form, "allocationMethod", "Las plantillas no admiten importes fijos");
				case "allocation_percentages_unbalanced":
					return message(form, "Los porcentajes deben sumar 100%", { status: 400 });
				case "allocation_weights_unbalanced":
					return message(form, "Los pesos del reparto deben sumar más que cero", { status: 400 });
				case "allocation_members_empty":
					return setError(form, "memberIds._errors", "Selecciona al menos un miembro");
				case "allocation_member_not_active":
					return message(form, "Uno de los miembros elegidos está desactivado", { status: 400 });
				case "allocation_member_not_found":
					return message(form, "Uno de los miembros elegidos ya no existe", { status: 400 });
				case "recurrence_interval_not_positive":
					return setError(form, "intervalCount", "Indica un intervalo válido");
				case "template_dates_invalid":
					return setError(form, "endDate", "El fin debe ser posterior al inicio");
				case "template_due_day_invalid":
					return setError(form, "dueDay", "Indica un día del mes entre 1 y 31");
				case "template_span_invalid":
					return setError(form, "serviceSpanMonths", "Indica un número de meses válido");
				case "category_inactive":
					return setError(form, "categoryId", "La categoría está desactivada");
				case "category_not_found":
					return setError(form, "categoryId", "Selecciona una categoría");
				case "expense_description_required":
					return setError(form, "description", "La descripción es obligatoria");
				case "expense_amount_not_positive":
					return setError(form, "amount", "El importe estimado debe ser mayor que cero");
				case "account_not_found":
					return setError(form, "accountHintId", "Esa cuenta ya no está disponible");
				default:
					return message(form, "No se pudo crear la plantilla", { status: 400 });
			}
		}

		throw redirect(303, "/gastos/plantillas");
	},
};
