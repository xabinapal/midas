import { fail, redirect } from "@sveltejs/kit";
import { zod4 } from "sveltekit-superforms/adapters";
import { message, setError, superValidate } from "sveltekit-superforms/server";
import { formatMinorUnits, parseAmountToMinorUnits } from "$lib/accounts/money";
import { effectiveAtFromDateInput, todayDateInput } from "$lib/accounts/schemas";
import type { AllocationMemberSelection } from "$lib/expenses/allocation";
import { expenseFormSchema } from "$lib/expenses/schemas";
import { FUNDING_SOURCE_LABELS } from "$lib/expenses/terms";
import { createAccountServices } from "$lib/server/accounts/services";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { createExpenseServices } from "$lib/server/expenses/services";
import { isGateConflict, isGateError, withGate } from "$lib/server/operations/with-gate";
import type { Actions, PageServerLoad } from "./$types";

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const load: PageServerLoad = async ({ locals, url }) => {
	const householdId = locals.user!.householdId;
	const { expenseService, planningService, repositories } = createExpenseServices(locals.db);
	const { accountService, repositories: accountRepositories } = createAccountServices(locals.db);

	const household = await accountRepositories.households.findById(householdId);
	const currency = household?.currency ?? "EUR";
	const today = todayDateInput(household?.timezone ?? "Europe/Madrid");

	const [categories, accounts, members, periods] = await Promise.all([
		expenseService.listCategories(householdId),
		accountService.listAccounts(householdId),
		repositories.members.findByHousehold(householdId),
		planningService.listPeriods(householdId),
	]);

	const requestedPeriod = url.searchParams.get("period");
	const requestedCustomSlug = url.searchParams.get("periodo");
	const hasStandardParam = requestedPeriod !== null && PERIOD_PATTERN.test(requestedPeriod);
	const selectedPeriod = hasStandardParam && requestedPeriod ? requestedPeriod : today.slice(0, 7);

	// The default period must exist before the form can post against it. If the
	// gate is busy, leave the default empty and retry on the next open.
	// A custom period slug preselects an existing period — customs never need
	// the ensure flow. A valid standard `?period=` wins when both are present.
	let defaultPeriod: (typeof periods)[number] | undefined;
	if (!hasStandardParam && requestedCustomSlug) {
		defaultPeriod = periods.find((period) => period.kind === "custom" && period.slug === requestedCustomSlug);
	} else {
		defaultPeriod = periods.find((period) => period.slug === selectedPeriod);
		if (!defaultPeriod) {
			const ensured = await withGate(locals.db, householdId, locals.user!.id, async (ctx) =>
				planningService.ensureStandardPeriod(householdId, selectedPeriod, new Date().toISOString(), ctx.operationId),
			);
			if (!isGateConflict(ensured) && !isGateError(ensured)) {
				defaultPeriod = ensured.result;
			} else {
				defaultPeriod = await repositories.periods.findBySlug(householdId, selectedPeriod);
			}
			if (defaultPeriod && !periods.some((period) => period.id === defaultPeriod!.id)) {
				periods.push(defaultPeriod);
			}
		}
	}
	periods.sort((a, b) => b.startDate.localeCompare(a.startDate));

	const activeMembers = members.filter((member) => member.isActive);

	return {
		categories: categories.filter((category) => category.isActive),
		accounts: accounts.filter((account) => account.status === "active"),
		members: activeMembers,
		periods,
		currency,
		form: await superValidate(
			{
				accountingDate: today,
				paymentDate: today,
				reportingPeriodId: defaultPeriod?.id ?? "",
				valueKind: "actual",
				allocationMethod: "equal",
				memberIds: activeMembers.map((member) => member.id),
				memberValues: [],
				paid: false,
			},
			zod4(expenseFormSchema),
		),
	};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const householdId = locals.user!.householdId;
		const form = await superValidate(request, zod4(expenseFormSchema));
		if (!form.valid) return fail(400, { form });

		const { expenseService, paymentService, repositories } = createExpenseServices(locals.db);
		const { repositories: accountRepositories } = createAccountServices(locals.db);
		const household = await accountRepositories.households.findById(householdId);
		const currency = household?.currency ?? "EUR";

		const amountMinor = parseAmountToMinorUnits(form.data.amount, currency);
		if (amountMinor === null || amountMinor <= 0) {
			return setError(form, "amount", "Indica un importe válido mayor que cero (por ejemplo 1.234,56)");
		}

		// Household default weights resolve at posting time, like occurrence
		// generation, so "Pesos del hogar" stays proportional to current weights.
		const members = await repositories.members.findByHousehold(householdId);
		const defaultWeightByMember = new Map(members.map((member) => [member.id, member.defaultWeight]));

		const method = form.data.allocationMethod;
		const allocationMembers: AllocationMemberSelection[] = form.data.memberIds.map((memberId, index) => {
			const raw = form.data.memberValues[index] ?? "";
			switch (method) {
				case "custom_weight":
					return { memberId, weight: Number(raw || 0) };
				case "percentage":
					return { memberId, basisPoints: Math.round(Number(raw || 0) * 100) };
				case "fixed":
					return { memberId, fixedAmountMinor: parseAmountToMinorUnits(raw || "", currency) ?? -1 };
				case "default_weight":
					return { memberId, defaultWeight: defaultWeightByMember.get(memberId) ?? 0 };
				default:
					return { memberId };
			}
		});

		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const expense = await expenseService.postExpense(
				householdId,
				{
					categoryId: form.data.categoryId,
					reportingPeriodId: form.data.reportingPeriodId,
					description: form.data.description,
					plannedAmountMinor: form.data.valueKind === "estimated" ? amountMinor : null,
					actualAmountMinor: form.data.valueKind === "actual" ? amountMinor : null,
					accountingDate: form.data.accountingDate,
					dueDate: form.data.dueDate || null,
					serviceStartDate: form.data.serviceStartDate || null,
					serviceEndDate: form.data.serviceEndDate || null,
					accountHintId: form.data.accountHintId || null,
					allocation: { method, members: allocationMembers },
				},
				locals.user!.id,
				now,
				ctx.operationId,
			);

			const category = await repositories.categories.findById(form.data.categoryId);
			const summary = {
				expenseDescription: expense.description,
				expenseReference: expense.reference ?? "",
				amount: formatMinorUnits(amountMinor, currency),
				categoryName: category?.name ?? "",
			};
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "expense_posted",
				subjectType: "expense",
				subjectId: expense.id,
				actorUserId: locals.user!.id,
				summary,
				operationId: ctx.operationId,
			});

			if (form.data.paid) {
				const payment = await paymentService.postPayment(
					householdId,
					{
						accountId: form.data.paymentAccountId!,
						amountMinor,
						effectiveAt: effectiveAtFromDateInput(form.data.paymentDate!),
						description: form.data.description,
					},
					locals.user!.id,
					now,
					ctx.operationId,
				);
				await paymentService.applyPayment(
					householdId,
					payment.id,
					[{ expenseId: expense.id, amountMinor }],
					now,
					ctx.operationId,
				);
				const account = await repositories.accounts.findById(payment.accountId);
				await insertValidatedActivity(locals.db, {
					householdId,
					eventType: "payment_posted",
					subjectType: "payment",
					subjectId: payment.id,
					actorUserId: locals.user!.id,
					summary: {
						...summary,
						accountName: account?.name ?? "",
						fundingSource: FUNDING_SOURCE_LABELS[payment.fundingSource],
					},
					operationId: ctx.operationId,
				});
			}

			return { expenseId: expense.id };
		});

		if (isGateConflict(outcome)) {
			return message(form, "Otra operación está en curso. Inténtalo de nuevo.", { status: 409 });
		}
		if (isGateError(outcome)) {
			switch (outcome.error.message) {
				case "category_inactive":
					return message(form, "La categoría está desactivada", { status: 400 });
				case "period_not_found":
					return message(form, "Periodo no encontrado", { status: 404 });
				case "allocation_members_empty":
					return setError(form, "memberIds._errors", "Selecciona al menos un miembro");
				case "allocation_member_not_active":
					return message(form, "Un miembro seleccionado está desactivado", { status: 400 });
				case "allocation_percentages_unbalanced":
					return setError(form, "allocationMethod", "Los porcentajes deben sumar 100%");
				case "allocation_weights_unbalanced":
					return message(form, "Los pesos deben sumar más que cero", { status: 400 });
				case "allocation_fixed_unbalanced":
					return message(form, "Los importes fijos deben sumar el total del gasto", { status: 400 });
				case "service_span_invalid":
					return setError(form, "serviceStartDate", "Indica un periodo de servicio válido");
				case "account_closed":
				case "account_not_active":
					return message(form, "La cuenta del pago no está activa", { status: 400 });
				case "application_exceeds_unpaid":
					return message(form, "El pago supera lo que queda por pagar", { status: 400 });
				default:
					return message(form, "No se pudo registrar el gasto", { status: 400 });
			}
		}

		throw redirect(303, `/gastos/${outcome.result.expenseId}`);
	},
};
