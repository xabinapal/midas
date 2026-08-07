import { error, fail, redirect } from "@sveltejs/kit";
import { message, setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { formatMinorUnits, parseAmountToMinorUnits } from "$lib/accounts/money";
import { effectiveAtFromDateInput, todayDateInput } from "$lib/accounts/schemas";
import { applicationFormSchema, paymentCorrectionSchema } from "$lib/expenses/schemas";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { createExpenseServices } from "$lib/server/expenses/services";
import { buildExpenseViews } from "$lib/server/expenses/views";
import { createHouseholdRepository } from "$lib/server/household/repository";
import { isGateConflict, isGateError, withGate } from "$lib/server/operations/with-gate";
import type { Actions, PageServerLoad } from "./$types";

async function loadHouseholdCurrency(locals: App.Locals, householdId: string): Promise<string> {
	const household = await createHouseholdRepository(locals.db).findById(householdId);
	return household?.currency ?? "EUR";
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const householdId = locals.user!.householdId;
	const { paymentService, repositories } = createExpenseServices(locals.db);

	const view = await paymentService.getPaymentView(householdId, params.id).catch(() => null);
	if (!view) throw error(404, "Pago no encontrado");

	const [account, funderMember, household, householdAccounts] = await Promise.all([
		repositories.accounts.findById(view.payment.accountId),
		view.payment.funderMemberId ? repositories.members.findById(view.payment.funderMemberId) : undefined,
		createHouseholdRepository(locals.db).findById(householdId),
		repositories.accounts.findByHousehold(householdId),
	]);
	const currency = household?.currency ?? "EUR";
	const timezone = household?.timezone ?? "Europe/Madrid";
	// The correction select offers active accounts, but always keeps the
	// payment's own account so the prefill never points at a missing option.
	const correctionAccounts = householdAccounts.filter(
		(entry) => entry.status === "active" || entry.id === view.payment.accountId,
	);

	const applications = await Promise.all(
		view.applications.map(async (application) => {
			const expense = await repositories.expenses.findVisibleById(application.expenseId);
			return {
				applicationId: application.id,
				expenseId: application.expenseId,
				expenseDescription: expense?.description ?? "Gasto",
				expenseReference: expense?.reference ?? null,
				amountMinor: application.amountMinor,
			};
		}),
	);

	let candidates: { id: string; description: string; reference: string | null; unpaidMinor: number }[] = [];
	if (view.payment.status === "posted" && view.unappliedMinor > 0) {
		const expenses = await repositories.expenses.listPostedByHousehold(householdId, 200);
		const payable = expenses.filter((expense) => expense.status === "posted" && expense.realizedByExpenseId === null);
		const views = await buildExpenseViews(repositories, householdId, payable, todayDateInput(timezone));
		candidates = views
			.filter((candidate) => candidate.unpaidMinor > 0)
			.slice(0, 100)
			.map((candidate) => ({
				id: candidate.expense.id,
				description: candidate.expense.description,
				reference: candidate.expense.reference,
				unpaidMinor: candidate.unpaidMinor,
			}));
	}

	// A reversed payment whose reversal row is not yet visible is a
	// half-applied correction; the correction form stays available to resume it.
	const effectivelyReversed = view.payment.reversedById
		? (await repositories.payments.findVisibleById(view.payment.reversedById)) !== undefined
		: false;
	const resumable =
		view.payment.status === "posted" ||
		(view.payment.status === "reversed" && !effectivelyReversed && view.payment.reversalOfId === null);

	let chain: { id: string; label: string; amountMinor: number; recordedAt: string }[] = [];
	if (view.payment.reversalOfId || view.payment.reversedById || view.payment.replacesId) {
		const originalId = view.payment.reversalOfId ?? view.payment.replacesId;
		const [original, reversal, replacement] = await Promise.all([
			originalId ? repositories.payments.findVisibleById(originalId) : undefined,
			repositories.payments.findReversalOf(view.payment.id),
			repositories.payments.findReplacement(view.payment.id),
		]);
		// Chain rows stay visibility-aware: siblings of a half-applied
		// correction never surface until their operation completes.
		const [visibleReversal, visibleReplacement] = await Promise.all([
			reversal ? repositories.payments.findVisibleById(reversal.id) : undefined,
			replacement ? repositories.payments.findVisibleById(replacement.id) : undefined,
		]);
		chain = [
			...(original
				? [
						{
							id: original.id,
							label: "Original revertido",
							amountMinor: original.amountMinor,
							recordedAt: original.recordedAt,
						},
					]
				: []),
			...(visibleReversal
				? [
						{
							id: visibleReversal.id,
							label: "Reversión",
							amountMinor: visibleReversal.amountMinor,
							recordedAt: visibleReversal.recordedAt,
						},
					]
				: []),
			...(visibleReplacement
				? [
						{
							id: visibleReplacement.id,
							label: "Sustitución vigente",
							amountMinor: visibleReplacement.amountMinor,
							recordedAt: visibleReplacement.recordedAt,
						},
					]
				: []),
		];
	}

	return {
		payment: view.payment,
		accountName: account?.name ?? "Cuenta",
		funderMemberName: funderMember?.displayName ?? null,
		currency,
		unappliedMinor: view.unappliedMinor,
		applications,
		candidates,
		accounts: correctionAccounts,
		chain,
		resumable,
		applyForm: await superValidate(zod4(applicationFormSchema)),
		correctForm: await superValidate(
			{
				mode: "reverse",
				accountId: view.payment.accountId,
				effectiveDate: view.payment.effectiveAt.slice(0, 10),
			},
			zod4(paymentCorrectionSchema),
		),
	};
};

export const actions: Actions = {
	apply: async ({ locals, params, request }) => {
		const householdId = locals.user!.householdId;
		const form = await superValidate(request, zod4(applicationFormSchema));
		if (!form.valid) return fail(400, { form });

		const { paymentService, repositories } = createExpenseServices(locals.db);
		const currency = await loadHouseholdCurrency(locals, householdId);

		const amountMinor = parseAmountToMinorUnits(form.data.amount, currency);
		if (amountMinor === null || amountMinor <= 0) {
			return setError(form, "amount", "Indica un importe válido mayor que cero (por ejemplo 1.234,56)");
		}

		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const view = await paymentService.getPaymentView(householdId, params.id);
			const expense = await repositories.expenses.findVisibleById(form.data.expenseId);
			await paymentService.applyPayment(
				householdId,
				params.id,
				[{ expenseId: form.data.expenseId, amountMinor }],
				now,
				ctx.operationId,
			);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "payment_applied",
				subjectType: "payment",
				subjectId: params.id,
				actorUserId: locals.user!.id,
				summary: {
					paymentDescription: view.payment.description,
					appliedAmount: formatMinorUnits(amountMinor, currency),
					expenseReference: expense?.reference ?? expense?.description ?? form.data.expenseId,
				},
				operationId: ctx.operationId,
			});
		});

		if (isGateConflict(outcome)) {
			return message(form, "Otra operación está en curso. Inténtalo de nuevo.", { status: 409 });
		}
		if (isGateError(outcome)) {
			switch (outcome.error.message) {
				case "application_exceeds_unpaid":
					return setError(form, "amount", "Supera lo que queda por pagar en ese gasto");
				case "application_exceeds_unapplied":
					return setError(form, "amount", "Supera el importe sin aplicar del pago");
				case "application_amount_not_positive":
					return setError(form, "amount", "El importe aplicado debe ser mayor que cero");
				case "expense_not_posted":
					return setError(form, "expenseId", "Ese gasto no admite pagos");
				case "expense_already_satisfied":
					return setError(form, "expenseId", "Este gasto previsto ya está satisfecho por su gasto real vinculado");
				case "payment_is_reversal":
					return message(form, "Una reversión no puede aplicarse a gastos", { status: 400 });
				case "payment_not_posted":
					return message(form, "El pago está revertido", { status: 400 });
				case "payment_not_found":
					throw error(404, "Pago no encontrado");
				default:
					return message(form, "No se pudo aplicar el pago", { status: 400 });
			}
		}

		throw redirect(303, `/pagos/${params.id}`);
	},

	reverseApplication: async ({ locals, params, request }) => {
		const formData = await request.formData();
		const applicationId = String(formData.get("applicationId") ?? "");
		if (!applicationId) return fail(400, { success: false, reason: "application_not_found" });

		const householdId = locals.user!.householdId;
		const { paymentService, repositories } = createExpenseServices(locals.db);
		const currency = await loadHouseholdCurrency(locals, householdId);

		// The application must belong to this page's payment; otherwise the
		// audit event would name the wrong payment as subject.
		const application = await repositories.applications.findVisibleById(applicationId);
		if (!application || application.householdId !== householdId || application.paymentId !== params.id) {
			return { success: false, reason: "application_not_found" };
		}
		const expense = await repositories.expenses.findVisibleById(application.expenseId);

		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const { flipped } = await paymentService.reverseApplication(householdId, applicationId, now, ctx.operationId);
			// Repeat submissions of an already-reversed application are no-ops
			// with no duplicate audit event.
			if (!flipped) return;
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "payment_application_reversed",
				subjectType: "payment",
				subjectId: params.id,
				actorUserId: locals.user!.id,
				summary: {
					expenseReference: expense?.reference ?? expense?.description ?? application.expenseId,
					appliedAmount: formatMinorUnits(application.amountMinor, currency),
				},
				operationId: ctx.operationId,
			});
		});

		if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
		if (isGateError(outcome)) return { success: false, reason: outcome.error.message };
		return { success: true };
	},

	correct: async ({ locals, params, request }) => {
		const householdId = locals.user!.householdId;
		const form = await superValidate(request, zod4(paymentCorrectionSchema));
		if (!form.valid) return fail(400, { form });

		const { paymentService } = createExpenseServices(locals.db);
		const currency = await loadHouseholdCurrency(locals, householdId);

		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const view = await paymentService.getPaymentView(householdId, params.id);
			const payment = view.payment;

			if (form.data.mode === "reverse") {
				await paymentService.correctPayment(householdId, params.id, null, locals.user!.id, now, ctx.operationId);
				await insertValidatedActivity(locals.db, {
					householdId,
					eventType: "payment_reversed",
					subjectType: "payment",
					subjectId: params.id,
					actorUserId: locals.user!.id,
					summary: {
						paymentDescription: payment.description,
						amount: formatMinorUnits(payment.amountMinor, currency),
					},
					operationId: ctx.operationId,
				});
				return { replacementId: null };
			}

			const amountMinor = parseAmountToMinorUnits(form.data.amount ?? "", currency);
			if (amountMinor === null || amountMinor <= 0) {
				throw new Error("payment_amount_not_positive");
			}
			const { replacement } = await paymentService.correctPayment(
				householdId,
				params.id,
				{
					accountId: form.data.accountId ?? payment.accountId,
					amountMinor,
					effectiveAt: form.data.effectiveDate
						? effectiveAtFromDateInput(form.data.effectiveDate)
						: payment.effectiveAt,
					description: form.data.description?.trim() || payment.description,
				},
				locals.user!.id,
				now,
				ctx.operationId,
			);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "payment_corrected",
				subjectType: "payment",
				subjectId: params.id,
				actorUserId: locals.user!.id,
				summary: {
					paymentDescription: payment.description,
					amount: formatMinorUnits(amountMinor, currency),
				},
				operationId: ctx.operationId,
			});
			return { replacementId: replacement?.id ?? null };
		});

		if (isGateConflict(outcome)) {
			return message(form, "Otra operación está en curso. Inténtalo de nuevo.", { status: 409 });
		}
		if (isGateError(outcome)) {
			switch (outcome.error.message) {
				case "payment_not_found":
					throw error(404, "Pago no encontrado");
				case "payment_already_reversed":
				case "payment_not_posted":
					return message(form, "Este pago ya está revertido", { status: 409 });
				case "payment_amount_not_positive":
					return setError(form, "amount", "El importe corregido debe ser mayor que cero");
				case "payment_description_required":
					return setError(form, "description", "La descripción es obligatoria");
				default:
					return message(form, "No se pudo corregir el pago", { status: 400 });
			}
		}

		if (outcome.result.replacementId) {
			throw redirect(303, `/pagos/${outcome.result.replacementId}`);
		}
		return { success: true };
	},
};
