import { error, fail, redirect } from "@sveltejs/kit";
import { message, setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { formatMinorUnits, parseAmountToMinorUnits } from "$lib/accounts/money";
import { resolveAllocations, selectionFromParams, type AllocationMemberSelection } from "$lib/expenses/allocation";
import { applicableAmountMinor } from "$lib/expenses/model";
import { expenseCorrectionSchema } from "$lib/expenses/schemas";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { createExpenseServices } from "$lib/server/expenses/services";
import type { PostExpenseInput } from "$lib/server/expenses/service";
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
	if (expense.status !== "posted" && expense.status !== "reversed") {
		throw error(404, "Este gasto ya no se puede corregir");
	}
	if (expense.status === "reversed" && expense.reversedById) {
		// A reversed expense whose replacement is already visible is terminal;
		// only a half-applied correction may resume.
		const visibleReplacement = await repositories.expenses.findVisibleById(expense.reversedById);
		if (visibleReplacement) {
			throw error(400, "Este gasto ya tiene una corrección visible");
		}
	}

	const applications = await repositories.applications.findActiveByExpense(expense.id);
	const plainUnpaidExpected =
		expense.actualAmountMinor === null && expense.realizedByExpenseId === null && applications.length === 0;
	if (expense.status === "posted" && plainUnpaidExpected) {
		throw error(404, "Los gastos previstos sin pagar se anulan desde su detalle, no se corrigen");
	}

	const household = await createHouseholdRepository(locals.db).findById(householdId);
	const [allocationParams, members] = await Promise.all([
		repositories.allocationParams.findByExpense(expense.id),
		repositories.members.findByHousehold(householdId),
	]);

	return {
		expense,
		currency: household?.currency ?? "EUR",
		applicableMinor: applicableAmountMinor(expense.plannedAmountMinor, expense.actualAmountMinor),
		allocationParams: allocationParams.map((param) => ({ memberId: param.memberId, value: param.value })),
		members: members.filter((member) => member.isActive),
		form: await superValidate({ mode: "reverse" }, zod4(expenseCorrectionSchema)),
	};
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const householdId = locals.user!.householdId;
		const form = await superValidate(request, zod4(expenseCorrectionSchema));
		if (!form.valid) return fail(400, { form });

		const { expenseService, repositories } = createExpenseServices(locals.db);
		const household = await createHouseholdRepository(locals.db).findById(householdId);
		const currency = household?.currency ?? "EUR";

		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const expense = await expenseService.getExpense(householdId, params.id);
			if (expense.status !== "posted" && expense.status !== "reversed") {
				throw new Error("expense_not_correctable");
			}
			const baseSummary = {
				...(expense.reference ? { expenseReference: expense.reference } : {}),
				expenseDescription: expense.description,
			};

			if (form.data.mode === "reverse") {
				await expenseService.correctExpense(householdId, params.id, null, locals.user!.id, now, ctx.operationId);
				await insertValidatedActivity(locals.db, {
					householdId,
					eventType: "expense_reversed",
					subjectType: "expense",
					subjectId: params.id,
					actorUserId: locals.user!.id,
					summary: {
						...baseSummary,
						amount: formatMinorUnits(
							applicableAmountMinor(expense.plannedAmountMinor, expense.actualAmountMinor),
							currency,
						),
					},
					operationId: ctx.operationId,
				});
				return { redirectId: params.id };
			}

			const amountMinor = parseAmountToMinorUnits(form.data.amount ?? "", currency);
			if (amountMinor === null || amountMinor <= 0) {
				throw new Error("expense_amount_not_positive");
			}

			// The replacement clones the original: category, period, dates, and
			// allocation carry over; only amount (and optionally description)
			// change.
			const allocationParams = await repositories.allocationParams.findByExpense(expense.id);
			const applicableBefore = applicableAmountMinor(expense.plannedAmountMinor, expense.actualAmountMinor);
			let members: AllocationMemberSelection[];
			if (expense.allocationMethod === "fixed" && amountMinor !== applicableBefore) {
				// Fixed splits scale deterministically: the old fixed amounts act
				// as weights and the resolved proportional shares become the new
				// fixed amounts (the method itself stays "fixed").
				const scaled = resolveAllocations(
					"custom_weight",
					amountMinor,
					allocationParams.map((param) => ({ memberId: param.memberId, weight: param.value ?? 0 })),
				);
				members = scaled.map((line) => ({ memberId: line.memberId, fixedAmountMinor: line.amountMinor }));
			} else {
				const householdMembers = await repositories.members.findByHousehold(householdId);
				const defaultWeightByMember = new Map(householdMembers.map((member) => [member.id, member.defaultWeight]));
				members = selectionFromParams(expense.allocationMethod, allocationParams, defaultWeightByMember);
			}
			const replacement: PostExpenseInput = {
				categoryId: expense.categoryId,
				reportingPeriodId: expense.reportingPeriodId,
				description: form.data.description?.trim() || expense.description,
				actualAmountMinor: expense.actualAmountMinor !== null ? amountMinor : null,
				// An actualized original keeps its planned baseline: the service
				// inherits the amount, version, and frozen planned lines.
				plannedAmountMinor: expense.actualAmountMinor === null ? amountMinor : expense.plannedAmountMinor,
				accountingDate: expense.accountingDate,
				dueDate: expense.dueDate,
				serviceStartDate: expense.serviceStartDate,
				serviceEndDate: expense.serviceEndDate,
				accountHintId: expense.accountHintId,
				allocation: { method: expense.allocationMethod, members },
			};
			const { replacement: created } = await expenseService.correctExpense(
				householdId,
				params.id,
				replacement,
				locals.user!.id,
				now,
				ctx.operationId,
			);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "expense_corrected",
				subjectType: "expense",
				subjectId: params.id,
				actorUserId: locals.user!.id,
				summary: { ...baseSummary, amount: formatMinorUnits(amountMinor, currency) },
				operationId: ctx.operationId,
			});
			return { redirectId: created?.id ?? params.id };
		});

		if (isGateConflict(outcome)) {
			return message(form, "Otra operación está en curso. Inténtalo de nuevo.", { status: 409 });
		}
		if (isGateError(outcome)) {
			switch (outcome.error.message) {
				case "expense_not_found":
					throw error(404, "Gasto no encontrado");
				case "expense_not_correctable":
					return message(form, "Este gasto ya no se puede corregir", { status: 400 });
				case "expense_already_reversed":
					return message(form, "Este gasto ya tiene una corrección visible", { status: 400 });
				case "expense_amount_not_positive":
					return setError(form, "amount", "El importe corregido debe ser mayor que cero");
				case "expense_description_required":
					return setError(form, "description", "La descripción es obligatoria");
				case "allocation_fixed_unbalanced":
					return message(form, "El reparto de importes fijos ya no cuadra con el importe corregido", {
						status: 400,
					});
				default:
					return message(form, "No se pudo corregir el gasto", { status: 400 });
			}
		}

		throw redirect(303, `/gastos/${outcome.result.redirectId}`);
	},
};
