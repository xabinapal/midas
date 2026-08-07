import { error, fail, redirect } from "@sveltejs/kit";
import { message, setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { formatMinorUnits, minorUnitFactor, parseAmountToMinorUnits } from "$lib/accounts/money";
import { selectionFromFormValues } from "$lib/expenses/allocation";
import { expectedEditSchema } from "$lib/expenses/schemas";
import { createAccountServices } from "$lib/server/accounts/services";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { createExpenseServices } from "$lib/server/expenses/services";
import type { PostExpenseInput } from "$lib/server/expenses/service";
import { createHouseholdRepository } from "$lib/server/household/repository";
import { isGateConflict, isGateError, withGate } from "$lib/server/operations/with-gate";
import type { Actions, PageServerLoad } from "./$types";

async function loadEditableExpense(locals: App.Locals, expenseId: string) {
	const householdId = locals.user!.householdId;
	const { expenseService, repositories } = createExpenseServices(locals.db);

	const expense = await expenseService.getExpense(householdId, expenseId).catch(() => null);
	if (!expense) {
		throw error(404, "Gasto no encontrado");
	}

	const applications = await repositories.applications.findActiveByExpense(expense.id);
	const editableExpected =
		expense.status === "posted" &&
		expense.actualAmountMinor === null &&
		expense.plannedAmountMinor !== null &&
		expense.realizedByExpenseId === null &&
		applications.length === 0;
	const isDraft = expense.status === "draft";
	if (!editableExpected && !isDraft) {
		throw error(404, "Este gasto ya no se puede editar");
	}

	const household = await createHouseholdRepository(locals.db).findById(householdId);
	return { expense, isDraft, currency: household?.currency ?? "EUR" };
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const context = await loadEditableExpense(locals, params.id);
	const householdId = locals.user!.householdId;
	const { expenseService, planningService, repositories } = createExpenseServices(locals.db);
	const { accountService } = createAccountServices(locals.db);

	const amountMinor = context.expense.plannedAmountMinor ?? context.expense.actualAmountMinor ?? 0;
	const factor = minorUnitFactor(context.currency);
	const method = context.expense.allocationMethod;

	const [periods, accounts, members, categories, allocationParams] = await Promise.all([
		planningService.listPeriods(householdId),
		accountService.listAccounts(householdId),
		repositories.members.findByHousehold(householdId),
		expenseService.listCategories(householdId),
		repositories.allocationParams.findByExpense(context.expense.id),
	]);
	periods.sort((a, b) => b.startDate.localeCompare(a.startDate));

	// Stored params prefill the reparto controls; values render in the same
	// text format the user would type (percent, minor units, or plain weight).
	const memberValues = allocationParams.map((param) => {
		if (param.value === null) return "";
		switch (method) {
			case "percentage":
				return (param.value / 100).toString();
			case "fixed":
				return (param.value / factor).toString().replace(".", ",");
			case "custom_weight":
				return String(param.value);
			default:
				return "";
		}
	});

	// Stored params may reference members deactivated after the expense was
	// posted; surface them so the user can drop them from the reparto.
	const storedMemberIds = new Set(allocationParams.map((param) => param.memberId));
	const storedInactiveMembers = members
		.filter((member) => !member.isActive && storedMemberIds.has(member.id))
		.map((member) => ({ id: member.id, displayName: member.displayName }));

	return {
		...context,
		periods,
		accounts: accounts.filter((account) => account.status === "active"),
		members: members.filter((member) => member.isActive),
		storedInactiveMembers,
		categories: categories.filter((category) => category.isActive),
		form: await superValidate(
			{
				description: context.expense.description,
				amount: (amountMinor / factor).toString().replace(".", ","),
				dueDate: context.expense.dueDate ?? "",
				categoryId: context.expense.categoryId,
				reportingPeriodId: context.expense.reportingPeriodId,
				serviceStartDate: context.expense.serviceStartDate ?? "",
				serviceEndDate: context.expense.serviceEndDate ?? "",
				accountHintId: context.expense.accountHintId ?? "",
				allocationMethod: method,
				memberIds: allocationParams.map((param) => param.memberId),
				memberValues,
			},
			zod4(expectedEditSchema),
		),
	};
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const householdId = locals.user!.householdId;
		const form = await superValidate(request, zod4(expectedEditSchema));
		if (!form.valid) return fail(400, { form });

		const { expenseService, repositories } = createExpenseServices(locals.db);
		const household = await createHouseholdRepository(locals.db).findById(householdId);
		const currency = household?.currency ?? "EUR";

		const amountMinor = parseAmountToMinorUnits(form.data.amount, currency);
		if (amountMinor === null || amountMinor <= 0) {
			return setError(form, "amount", "Indica un importe válido mayor que cero (por ejemplo 1.234,56)");
		}
		const dueDate = form.data.dueDate?.trim() ? form.data.dueDate.trim() : null;
		const serviceStartDate = form.data.serviceStartDate?.trim() ? form.data.serviceStartDate.trim() : null;
		const serviceEndDate = form.data.serviceEndDate?.trim() ? form.data.serviceEndDate.trim() : null;
		const accountHintId = form.data.accountHintId?.trim() ? form.data.accountHintId.trim() : null;

		// Household default weights resolve at save time, like nuevo: "Pesos
		// del hogar" stays proportional to current weights.
		const members = await repositories.members.findByHousehold(householdId);
		const defaultWeightByMember = new Map(members.map((member) => [member.id, member.defaultWeight]));

		const method = form.data.allocationMethod;
		const allocationMembers = selectionFromFormValues(
			method,
			form.data.memberIds,
			form.data.memberValues,
			currency,
			defaultWeightByMember,
		);

		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const expense = await expenseService.getExpense(householdId, params.id);

			if (expense.status === "draft") {
				// Drafts keep their accounting date; everything else is editable.
				const input: PostExpenseInput = {
					categoryId: form.data.categoryId || expense.categoryId,
					reportingPeriodId: form.data.reportingPeriodId || expense.reportingPeriodId,
					description: form.data.description,
					plannedAmountMinor: expense.actualAmountMinor === null ? amountMinor : null,
					actualAmountMinor: expense.actualAmountMinor === null ? null : amountMinor,
					accountingDate: expense.accountingDate,
					dueDate,
					serviceStartDate,
					serviceEndDate,
					accountHintId,
					allocation: { method, members: allocationMembers },
				};
				await expenseService.editDraftExpense(householdId, params.id, input, now, ctx.operationId);
			} else {
				await expenseService.editExpectedExpense(
					householdId,
					params.id,
					{
						description: form.data.description,
						plannedAmountMinor: amountMinor,
						dueDate,
						...(form.data.reportingPeriodId ? { reportingPeriodId: form.data.reportingPeriodId } : {}),
						serviceStartDate,
						serviceEndDate,
						accountHintId,
						allocation: { method, members: allocationMembers },
					},
					now,
					ctx.operationId,
				);
			}

			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "expense_updated",
				subjectType: "expense",
				subjectId: params.id,
				actorUserId: locals.user!.id,
				summary: {
					...(expense.reference ? { expenseReference: expense.reference } : {}),
					expenseDescription: form.data.description.trim(),
					plannedAmount: formatMinorUnits(amountMinor, currency),
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
				case "expense_not_editable":
				case "expense_not_draft":
					return message(form, "Este gasto ya no se puede editar", { status: 400 });
				case "expense_amount_not_positive":
					return setError(form, "amount", "El importe previsto debe ser mayor que cero");
				case "expense_description_required":
					return setError(form, "description", "La descripción es obligatoria");
				case "due_date_invalid":
					return setError(form, "dueDate", "Indica una fecha válida");
				case "service_span_invalid":
					return setError(form, "serviceStartDate", "Indica un periodo de servicio válido");
				case "period_not_found":
					return message(form, "Periodo no encontrado", { status: 404 });
				case "category_not_found":
					return setError(form, "categoryId", "Selecciona una categoría");
				case "category_inactive":
					return message(form, "La categoría está desactivada", { status: 400 });
				case "account_not_found":
					return message(form, "La cuenta habitual ya no existe", { status: 400 });
				case "allocation_members_empty":
					return setError(form, "memberIds._errors", "Selecciona al menos un miembro");
				case "allocation_member_not_found":
				case "allocation_member_not_active":
					return message(form, "Un miembro seleccionado está desactivado", { status: 400 });
				case "allocation_percentages_unbalanced":
					return setError(form, "allocationMethod", "Los porcentajes deben sumar 100%");
				case "allocation_weights_unbalanced":
					return message(form, "Los pesos deben sumar más que cero", { status: 400 });
				case "allocation_fixed_unbalanced":
					return message(form, "Los importes fijos deben sumar el total del gasto", { status: 400 });
				default:
					return message(form, "No se pudo guardar el gasto", { status: 400 });
			}
		}

		throw redirect(303, `/gastos/${params.id}`);
	},
};
