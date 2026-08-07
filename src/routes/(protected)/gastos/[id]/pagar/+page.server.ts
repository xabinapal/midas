import { error, fail, redirect } from "@sveltejs/kit";
import { message, setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { formatMinorUnits, minorUnitFactor, parseAmountToMinorUnits } from "$lib/accounts/money";
import { effectiveAtFromDateInput, todayDateInput } from "$lib/accounts/schemas";
import { paymentFormSchema } from "$lib/expenses/schemas";
import { createAccountServices } from "$lib/server/accounts/services";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { createExpenseServices } from "$lib/server/expenses/services";
import { buildExpenseViews } from "$lib/server/expenses/views";
import { createHouseholdRepository } from "$lib/server/household/repository";
import { isGateConflict, isGateError, withGate } from "$lib/server/operations/with-gate";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
	const householdId = locals.user!.householdId;
	const { expenseService, repositories } = createExpenseServices(locals.db);
	const { accountService } = createAccountServices(locals.db);

	const expense = await expenseService.getExpense(householdId, params.id).catch(() => null);
	if (!expense) {
		throw error(404, "Gasto no encontrado");
	}

	const household = await createHouseholdRepository(locals.db).findById(householdId);
	const currency = household?.currency ?? "EUR";
	const timezone = household?.timezone ?? "Europe/Madrid";

	const view = (await buildExpenseViews(repositories, householdId, [expense], todayDateInput(timezone)))[0]!;
	if (expense.realizedByExpenseId !== null) {
		throw error(404, "Este gasto previsto ya está satisfecho por su gasto real vinculado");
	}
	if (expense.status !== "posted" || view.unpaidMinor <= 0) {
		throw error(404, "Nada que pagar en este gasto");
	}

	const accounts = (await accountService.listAccounts(householdId)).filter((account) => account.status === "active");
	const unpaidText = (view.unpaidMinor / minorUnitFactor(currency)).toString().replace(".", ",");

	return {
		expense,
		currency,
		unpaidMinor: view.unpaidMinor,
		accounts,
		form: await superValidate(
			{
				accountId: "",
				amount: unpaidText,
				effectiveDate: todayDateInput(timezone),
				description: expense.description,
				applicationAmount: unpaidText,
			},
			zod4(paymentFormSchema),
		),
	};
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const householdId = locals.user!.householdId;
		const form = await superValidate(request, zod4(paymentFormSchema));
		if (!form.valid) return fail(400, { form });

		const { expenseService, paymentService } = createExpenseServices(locals.db);
		const { accountService } = createAccountServices(locals.db);
		const household = await createHouseholdRepository(locals.db).findById(householdId);
		const currency = household?.currency ?? "EUR";

		const amountMinor = parseAmountToMinorUnits(form.data.amount, currency);
		if (amountMinor === null || amountMinor <= 0) {
			return setError(form, "amount", "Indica un importe válido mayor que cero (por ejemplo 1.234,56)");
		}
		const applicationMinor = form.data.applicationAmount?.trim()
			? parseAmountToMinorUnits(form.data.applicationAmount, currency)
			: amountMinor;
		if (applicationMinor === null || applicationMinor <= 0) {
			return setError(form, "applicationAmount", "Indica un importe aplicado válido mayor que cero");
		}

		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const account = await accountService.getAccount(householdId, form.data.accountId);
			const expense = await expenseService.getExpense(householdId, params.id);

			const payment = await paymentService.postPayment(
				householdId,
				{
					accountId: account.id,
					amountMinor,
					effectiveAt: effectiveAtFromDateInput(form.data.effectiveDate),
					description: form.data.description,
				},
				locals.user!.id,
				now,
				ctx.operationId,
			);
			await paymentService.applyPayment(
				householdId,
				payment.id,
				[{ expenseId: expense.id, amountMinor: applicationMinor }],
				now,
				ctx.operationId,
			);

			const baseSummary = {
				paymentDescription: payment.description,
				accountName: account.name,
				...(expense.reference ? { expenseReference: expense.reference } : {}),
			};
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "payment_posted",
				subjectType: "payment",
				subjectId: payment.id,
				actorUserId: locals.user!.id,
				summary: { ...baseSummary, amount: formatMinorUnits(amountMinor, currency) },
				operationId: ctx.operationId,
			});
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "payment_applied",
				subjectType: "payment",
				subjectId: payment.id,
				actorUserId: locals.user!.id,
				summary: { ...baseSummary, appliedAmount: formatMinorUnits(applicationMinor, currency) },
				operationId: ctx.operationId,
			});
			return { paymentId: payment.id };
		});

		if (isGateConflict(outcome)) {
			return message(form, "Otra operación está en curso. Inténtalo de nuevo.", { status: 409 });
		}
		if (isGateError(outcome)) {
			switch (outcome.error.message) {
				case "expense_not_found":
					throw error(404, "Gasto no encontrado");
				case "application_exceeds_unpaid":
					return setError(form, "applicationAmount", "Supera lo que queda por pagar");
				case "application_exceeds_unapplied":
					return setError(form, "applicationAmount", "Supera el importe del pago");
				case "application_amount_not_positive":
					return setError(form, "applicationAmount", "El importe aplicado debe ser mayor que cero");
				case "payment_amount_not_positive":
					return setError(form, "amount", "El importe del pago debe ser mayor que cero");
				case "account_not_found":
					return message(form, "Cuenta no encontrada", { status: 404 });
				case "account_closed":
					return message(form, "Una cuenta cerrada no acepta nuevos movimientos", { status: 400 });
				case "account_not_active":
					return message(form, "Activa la cuenta antes de registrar pagos", { status: 400 });
				case "expense_not_posted":
					return message(form, "Este gasto ya no admite pagos", { status: 400 });
				case "expense_already_satisfied":
					return message(form, "Este gasto previsto ya está satisfecho por su gasto real vinculado", { status: 400 });
				case "payment_is_reversal":
					return message(form, "Una reversión no puede aplicarse a gastos", { status: 400 });
				default:
					return message(form, "No se pudo registrar el pago", { status: 400 });
			}
		}

		throw redirect(303, `/pagos/${outcome.result.paymentId}`);
	},
};
