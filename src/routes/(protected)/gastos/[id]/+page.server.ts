import { error, fail, redirect } from "@sveltejs/kit";
import { message, setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { formatMinorUnits } from "$lib/accounts/money";
import { todayDateInput } from "$lib/accounts/schemas";
import { applicableAmountMinor } from "$lib/expenses/model";
import { evidenceFormSchema, linkActualSchema } from "$lib/expenses/schemas";
import { buildActivityDetails, EVENT_LABELS } from "$lib/server/activity/display";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { createActivityRepository } from "$lib/server/activity/repository";
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

	const household = await createHouseholdRepository(locals.db).findById(householdId);
	const currency = household?.currency ?? "EUR";
	const timezone = household?.timezone ?? "Europe/Madrid";

	// The history covers the expense and every payment that ever touched it,
	// so reversal and correction events on those payments also appear.
	const applicationsAndActivity = repositories.applications.findByExpense(expense.id).then(async (rows) => {
		const paymentIds = [...new Set(rows.map((row) => row.paymentId))];
		const activityEvents = await createActivityRepository(locals.db).findByHousehold(householdId, {
			subjectIds: [expense.id, ...paymentIds],
		});
		return { allApplications: rows, activityEvents };
	});

	const [view, applications, evidence, period, allAccounts, linkedActualExpense, history] = await Promise.all([
		buildExpenseViews(repositories, householdId, [expense], todayDateInput(timezone)).then((views) => views[0]!),
		repositories.applications.findActiveByExpense(expense.id),
		repositories.evidence.findActiveByExpense(expense.id),
		repositories.periods.findById(expense.reportingPeriodId),
		repositories.accounts.findByHousehold(householdId),
		expense.realizedByExpenseId
			? repositories.expenses.findVisibleById(expense.realizedByExpenseId)
			: Promise.resolve(undefined),
		applicationsAndActivity,
	]);
	const { allApplications, activityEvents } = history;

	const accountNames = new Map(allAccounts.map((account) => [account.id, account.name]));
	const paymentRows = (
		await Promise.all(
			applications.map(async (application) => {
				const payment = await repositories.payments.findVisibleById(application.paymentId);
				if (!payment) return null;
				return {
					applicationId: application.id,
					paymentId: payment.id,
					amountMinor: application.amountMinor,
					paymentDescription: payment.description,
					effectiveAt: payment.effectiveAt,
					fundingSource: payment.fundingSource,
					accountName: accountNames.get(payment.accountId) ?? "",
				};
			}),
		)
	).filter((row) => row !== null);

	const reversedRows = (
		await Promise.all(
			allApplications
				.filter((application) => application.status === "reversed")
				.map(async (application) => {
					const payment = await repositories.payments.findVisibleById(application.paymentId);
					if (!payment) return null;
					return {
						applicationId: application.id,
						paymentId: payment.id,
						paymentDescription: payment.description,
						amountMinor: application.amountMinor,
						reversedAt: application.reversedAt,
					};
				}),
		)
	).filter((row) => row !== null);

	const linkedActual =
		linkedActualExpense && linkedActualExpense.actualAmountMinor !== null
			? {
					id: linkedActualExpense.id,
					reference: linkedActualExpense.reference,
					description: linkedActualExpense.description,
					amountMinor: linkedActualExpense.actualAmountMinor,
				}
			: null;

	const activity = activityEvents.slice(0, 50).map((event) => ({
		id: event.id,
		eventType: event.eventType,
		occurredAt: event.occurredAt,
		details: buildActivityDetails({
			subjectType: event.subjectType,
			subjectId: event.subjectId,
			actorUserId: event.actorUserId,
			summary: JSON.stringify(event.summary),
		}),
	}));

	const isDraft = expense.status === "draft";
	const isUnmatchedEstimated =
		expense.status === "posted" && expense.actualAmountMinor === null && expense.realizedByExpenseId === null;
	const withoutPayments = applications.length === 0;
	const canEdit = isUnmatchedEstimated && withoutPayments;

	let matchCandidates: { id: string; description: string; reference: string | null; actualAmountMinor: number }[] = [];
	if (canEdit) {
		const allExpenses = await repositories.expenses.listPostedByHousehold(householdId, 200);
		const matchedActualIds = new Set(
			allExpenses.map((row) => row.realizedByExpenseId).filter((id): id is string => id !== null),
		);
		matchCandidates = allExpenses
			.filter(
				(candidate) =>
					candidate.status === "posted" &&
					candidate.actualAmountMinor !== null &&
					candidate.plannedAmountMinor === null &&
					candidate.id !== expense.id &&
					!matchedActualIds.has(candidate.id),
			)
			.slice(0, 50)
			.map((candidate) => ({
				id: candidate.id,
				description: candidate.description,
				reference: candidate.reference,
				actualAmountMinor: candidate.actualAmountMinor!,
			}));
	}

	let chain: {
		id: string;
		description: string;
		reference: string | null;
		status: typeof expense.status;
		replacesId: string | null;
		reversedById: string | null;
	}[] = [];
	if (expense.chainRootId !== expense.id || expense.replacesId || expense.reversedById) {
		// Chain siblings keep every status: originals stay reachable from their
		// replacements and vice versa.
		const siblings = await repositories.expenses.listByChainRoot(expense.chainRootId);
		chain = siblings
			.filter((sibling) => sibling.id !== expense.id)
			.map((sibling) => ({
				id: sibling.id,
				description: sibling.description,
				reference: sibling.reference,
				status: sibling.status,
				replacesId: sibling.replacesId,
				reversedById: sibling.reversedById,
			}));
	}

	return {
		expense,
		view,
		currency,
		period: period ?? null,
		accountHintName: expense.accountHintId ? (accountNames.get(expense.accountHintId) ?? null) : null,
		payments: paymentRows,
		reversedApplications: reversedRows,
		linkedActual,
		evidence,
		activity,
		eventLabels: EVENT_LABELS,
		matchCandidates,
		chain,
		flags: {
			canEdit,
			canActualize: canEdit,
			canCancel: canEdit,
			canPay: expense.status === "posted" && view.unpaidMinor > 0 && expense.realizedByExpenseId === null,
			canCorrect: expense.status === "posted" && (expense.actualAmountMinor !== null || !withoutPayments),
			isDraft,
		},
		evidenceForm: await superValidate(zod4(evidenceFormSchema)),
		linkForm: await superValidate(zod4(linkActualSchema)),
	};
};

export const actions: Actions = {
	addEvidence: async ({ locals, params, request }) => {
		const householdId = locals.user!.householdId;
		const form = await superValidate(request, zod4(evidenceFormSchema));
		if (!form.valid) return fail(400, { form });

		const { expenseService } = createExpenseServices(locals.db);
		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const expense = await expenseService.getExpense(householdId, params.id);
			await expenseService.addEvidence(
				householdId,
				params.id,
				{
					label: form.data.label,
					url: form.data.url,
					note: form.data.note?.trim() ? form.data.note.trim() : null,
				},
				locals.user!.id,
				now,
				ctx.operationId,
			);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "evidence_added",
				subjectType: "expense",
				subjectId: params.id,
				actorUserId: locals.user!.id,
				summary: {
					evidenceLabel: form.data.label.trim(),
					...(expense.reference ? { expenseReference: expense.reference } : {}),
				},
				operationId: ctx.operationId,
			});
		});

		if (isGateConflict(outcome)) {
			return message(form, "Otra operación está en curso. Inténtalo de nuevo.", { status: 409 });
		}
		if (isGateError(outcome)) {
			switch (outcome.error.message) {
				case "evidence_url_not_allowed":
					return setError(form, "url", "La URL no es segura: solo se admiten enlaces HTTPS sin credenciales");
				case "evidence_label_required":
					return setError(form, "label", "El nombre del enlace es obligatorio");
				case "expense_not_found":
					return message(form, "Gasto no encontrado", { status: 404 });
				case "expense_not_posted":
					return message(form, "Este gasto ya no admite justificantes", { status: 400 });
				default:
					return message(form, "No se pudo añadir el justificante", { status: 400 });
			}
		}
		return message(form, "Justificante enlazado");
	},

	removeEvidence: async ({ locals, params, request }) => {
		const formData = await request.formData();
		const evidenceId = String(formData.get("evidenceId") ?? "");
		if (!evidenceId) return fail(400, { success: false, reason: "evidence_not_found" });

		const householdId = locals.user!.householdId;
		const { expenseService, repositories } = createExpenseServices(locals.db);

		// The evidence must belong to this page's expense; otherwise the audit
		// event would name the wrong expense as subject.
		const target = await repositories.evidence.findById(evidenceId);
		if (!target || target.expenseId !== params.id) {
			return { success: false, reason: "evidence_not_found" };
		}

		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const expense = await expenseService.getExpense(householdId, params.id);
			await expenseService.removeEvidence(householdId, evidenceId, now, ctx.operationId);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "evidence_removed",
				subjectType: "expense",
				subjectId: params.id,
				actorUserId: locals.user!.id,
				summary: {
					evidenceLabel: target.label,
					...(expense.reference ? { expenseReference: expense.reference } : {}),
				},
				operationId: ctx.operationId,
			});
		});

		if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
		if (isGateError(outcome)) return { success: false, reason: outcome.error.message };
		return { success: true };
	},

	cancel: async ({ locals, params }) => {
		const householdId = locals.user!.householdId;
		const { expenseService } = createExpenseServices(locals.db);
		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const expense = await expenseService.getExpense(householdId, params.id);
			await expenseService.cancelExpectedExpense(householdId, params.id, now, ctx.operationId);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "expense_cancelled",
				subjectType: "expense",
				subjectId: params.id,
				actorUserId: locals.user!.id,
				summary: {
					...(expense.reference ? { expenseReference: expense.reference } : {}),
					expenseDescription: expense.description,
				},
				operationId: ctx.operationId,
			});
		});

		if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
		if (isGateError(outcome)) return { success: false, reason: outcome.error.message };
		return { success: true };
	},

	linkActual: async ({ locals, params, request }) => {
		const householdId = locals.user!.householdId;
		const form = await superValidate(request, zod4(linkActualSchema));
		if (!form.valid) return fail(400, { form });

		const { expenseService, repositories } = createExpenseServices(locals.db);
		const household = await createHouseholdRepository(locals.db).findById(householdId);
		const currency = household?.currency ?? "EUR";

		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const expense = await expenseService.getExpense(householdId, params.id);
			const actual = await repositories.expenses.findVisibleById(form.data.actualExpenseId);
			if (!actual) throw new Error("expense_not_actual");
			await expenseService.linkActualExpense(householdId, params.id, actual.id, now, ctx.operationId);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "expense_matched",
				subjectType: "expense",
				subjectId: params.id,
				actorUserId: locals.user!.id,
				summary: {
					...(expense.reference ? { expenseReference: expense.reference } : {}),
					expenseDescription: `${expense.description} → ${actual.description}`,
					...(actual.actualAmountMinor !== null
						? { actualAmount: formatMinorUnits(actual.actualAmountMinor, currency) }
						: {}),
				},
				operationId: ctx.operationId,
			});
		});

		if (isGateConflict(outcome)) {
			return message(form, "Otra operación está en curso. Inténtalo de nuevo.", { status: 409 });
		}
		if (isGateError(outcome)) {
			switch (outcome.error.message) {
				case "expense_not_matchable":
					return message(form, "Este gasto previsto ya no admite vinculación", { status: 400 });
				case "expense_not_actual":
					return setError(form, "actualExpenseId", "El gasto seleccionado no es un importe real");
				case "expense_already_matched":
					return setError(form, "actualExpenseId", "Ese gasto real ya está vinculado");
				default:
					return message(form, "No se pudo vincular el gasto", { status: 400 });
			}
		}
		return message(form, "Gasto vinculado con el importe real");
	},

	unlink: async ({ locals, params }) => {
		const householdId = locals.user!.householdId;
		const { expenseService } = createExpenseServices(locals.db);
		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const expense = await expenseService.getExpense(householdId, params.id);
			await expenseService.unlinkActualExpense(householdId, params.id, now, ctx.operationId);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "expense_unmatched",
				subjectType: "expense",
				subjectId: params.id,
				actorUserId: locals.user!.id,
				summary: {
					expenseDescription: expense.description,
					...(expense.reference ? { expenseReference: expense.reference } : {}),
				},
				operationId: ctx.operationId,
			});
		});

		if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
		if (isGateError(outcome)) return { success: false, reason: outcome.error.message };
		return { success: true };
	},

	deleteDraft: async ({ locals, params }) => {
		const householdId = locals.user!.householdId;
		const { expenseService } = createExpenseServices(locals.db);
		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const expense = await expenseService.getExpense(householdId, params.id);
			await expenseService.deleteDraftExpense(householdId, params.id, now, ctx.operationId);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "expense_deleted",
				subjectType: "expense",
				subjectId: params.id,
				actorUserId: locals.user!.id,
				summary: { expenseDescription: expense.description },
				operationId: ctx.operationId,
			});
		});

		if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
		if (isGateError(outcome)) return { success: false, reason: outcome.error.message };
		throw redirect(303, "/gastos");
	},

	reverse: async ({ locals, params }) => {
		const householdId = locals.user!.householdId;
		const { expenseService, repositories } = createExpenseServices(locals.db);
		const household = await createHouseholdRepository(locals.db).findById(householdId);
		const currency = household?.currency ?? "EUR";

		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const expense = await expenseService.getExpense(householdId, params.id);
			const { releasedExpectedIds } = await expenseService.correctExpense(
				householdId,
				params.id,
				null,
				locals.user!.id,
				now,
				ctx.operationId,
			);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "expense_reversed",
				subjectType: "expense",
				subjectId: params.id,
				actorUserId: locals.user!.id,
				summary: {
					...(expense.reference ? { expenseReference: expense.reference } : {}),
					expenseDescription: expense.description,
					amount: formatMinorUnits(
						applicableAmountMinor(expense.plannedAmountMinor, expense.actualAmountMinor),
						currency,
					),
				},
				operationId: ctx.operationId,
			});
			for (const releasedId of releasedExpectedIds) {
				const released = await repositories.expenses.findVisibleById(releasedId);
				await insertValidatedActivity(locals.db, {
					householdId,
					eventType: "expense_unmatched",
					subjectType: "expense",
					subjectId: releasedId,
					actorUserId: locals.user!.id,
					summary: {
						expenseDescription: released?.description ?? "",
						...(released?.reference ? { expenseReference: released.reference } : {}),
					},
					operationId: ctx.operationId,
				});
			}
		});

		if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
		if (isGateError(outcome)) return { success: false, reason: outcome.error.message };
		return { success: true };
	},
};
