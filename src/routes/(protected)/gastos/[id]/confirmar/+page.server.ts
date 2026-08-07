import { error, fail, redirect } from "@sveltejs/kit";
import { message, setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { formatMinorUnits, parseAmountToMinorUnits } from "$lib/accounts/money";
import { todayDateInput } from "$lib/accounts/schemas";
import { actualizeSchema } from "$lib/expenses/schemas";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { createExpenseServices } from "$lib/server/expenses/services";
import { buildExpenseViews } from "$lib/server/expenses/views";
import { createHouseholdRepository } from "$lib/server/household/repository";
import { isGateConflict, isGateError, withGate } from "$lib/server/operations/with-gate";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
	const householdId = locals.user!.householdId;
	const { expenseService, repositories } = createExpenseServices(locals.db);

	const expense = await expenseService.getExpense(householdId, params.id).catch(() => null);
	if (!expense) {
		throw error(404, "Gasto no encontrado");
	}

	const applications = await repositories.applications.findActiveByExpense(expense.id);
	const actualizable =
		expense.status === "posted" &&
		expense.actualAmountMinor === null &&
		expense.plannedAmountMinor !== null &&
		expense.realizedByExpenseId === null &&
		applications.length === 0;
	if (!actualizable) {
		throw error(404, "Este gasto ya no admite confirmación");
	}

	const household = await createHouseholdRepository(locals.db).findById(householdId);
	const [view, allocationParams, members] = await Promise.all([
		buildExpenseViews(
			repositories,
			householdId,
			[expense],
			todayDateInput(household?.timezone ?? "Europe/Madrid"),
		).then((views) => views[0]!),
		repositories.allocationParams.findByExpense(expense.id),
		repositories.members.findByHousehold(householdId),
	]);

	// Stored params may reference members deactivated after the expense was
	// posted; the split display and preview still name them.
	const storedMemberIds = new Set(allocationParams.map((param) => param.memberId));
	const storedInactiveMembers = members
		.filter((member) => !member.isActive && storedMemberIds.has(member.id))
		.map((member) => ({ id: member.id, displayName: member.displayName }));

	return {
		expense,
		currency: household?.currency ?? "EUR",
		plannedAmountMinor: expense.plannedAmountMinor!,
		plannedLines: view.allocations.filter((line) => line.basis === "planned"),
		allocationMethod: expense.allocationMethod,
		allocationParams: allocationParams.map((param) => ({ memberId: param.memberId, value: param.value })),
		members: members.filter((member) => member.isActive),
		storedInactiveMembers,
		form: await superValidate({ amount: "" }, zod4(actualizeSchema)),
	};
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const householdId = locals.user!.householdId;
		const form = await superValidate(request, zod4(actualizeSchema));
		if (!form.valid) return fail(400, { form });

		const { expenseService } = createExpenseServices(locals.db);
		const household = await createHouseholdRepository(locals.db).findById(householdId);
		const currency = household?.currency ?? "EUR";

		const actualAmountMinor = parseAmountToMinorUnits(form.data.amount, currency);
		if (actualAmountMinor === null || actualAmountMinor <= 0) {
			return setError(form, "amount", "Indica un importe válido mayor que cero (por ejemplo 1.234,56)");
		}

		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const expense = await expenseService.getExpense(householdId, params.id);
			await expenseService.actualizeExpense(householdId, params.id, { actualAmountMinor }, now, ctx.operationId);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "expense_actualized",
				subjectType: "expense",
				subjectId: params.id,
				actorUserId: locals.user!.id,
				summary: {
					...(expense.reference ? { expenseReference: expense.reference } : {}),
					plannedAmount: formatMinorUnits(expense.plannedAmountMinor ?? 0, currency),
					actualAmount: formatMinorUnits(actualAmountMinor, currency),
				},
				operationId: ctx.operationId,
			});
		});

		if (isGateConflict(outcome)) {
			return message(form, "Otra operación está en curso. Inténtalo de nuevo.", { status: 409 });
		}
		if (isGateError(outcome)) {
			switch (outcome.error.message) {
				case "expense_not_found":
					throw error(404, "Gasto no encontrado");
				case "expense_has_payments":
					return message(form, "Tiene pagos aplicados; reviértelos antes de confirmar el importe real", {
						status: 400,
					});
				case "expense_not_actualizable":
					return message(form, "Este gasto ya no admite confirmación", { status: 400 });
				case "expense_amount_not_positive":
					return setError(form, "amount", "El importe real debe ser mayor que cero");
				default:
					return message(form, "No se pudo confirmar el importe real", { status: 400 });
			}
		}

		throw redirect(303, `/gastos/${params.id}`);
	},
};
