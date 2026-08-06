import { fail, redirect } from "@sveltejs/kit";
import { message, setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { formatMinorUnits, parseAmountToMinorUnits } from "$lib/accounts/money";
import { effectiveAtFromDateInput, todayDateInput, transferSchema } from "$lib/accounts/schemas";
import { TRANSFER_CLASSIFICATION_LABELS } from "$lib/accounts/terms";
import { createAccountServices } from "$lib/server/accounts/services";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { isGateConflict, isGateError, withGate } from "$lib/server/operations/with-gate";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	const householdId = locals.user!.householdId;
	const { accountService, repositories } = createAccountServices(locals.db);
	const household = await repositories.households.findById(householdId);
	const accounts = (await accountService.listAccounts(householdId)).filter((account) => account.status === "active");
	return {
		accounts,
		currency: household?.currency ?? "EUR",
		form: await superValidate(
			{ effectiveDate: todayDateInput(household?.timezone ?? "Europe/Madrid"), classification: "unclassified" },
			zod4(transferSchema),
		),
	};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const householdId = locals.user!.householdId;
		const form = await superValidate(request, zod4(transferSchema));
		if (!form.valid) return fail(400, { form });

		const { accountService, transferService, fundingService, repositories } = createAccountServices(locals.db);
		const household = await repositories.households.findById(householdId);
		const currency = household?.currency ?? "EUR";

		const amountMinor = parseAmountToMinorUnits(form.data.amount, currency);
		if (amountMinor === null || amountMinor <= 0) {
			return setError(form, "amount", "Indica un importe válido mayor que cero (por ejemplo 1.234,56)");
		}
		if (form.data.sourceAccountId === form.data.destinationAccountId) {
			return setError(form, "destinationAccountId", "El origen y el destino deben ser cuentas distintas");
		}

		const classification = form.data.classification;
		const effectiveAt = effectiveAtFromDateInput(form.data.effectiveDate);

		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const source = await accountService.getAccount(householdId, form.data.sourceAccountId);
			const destination = await accountService.getAccount(householdId, form.data.destinationAccountId);
			const summary = {
				sourceAccountName: source.name,
				destinationAccountName: destination.name,
				amount: formatMinorUnits(amountMinor, source.currency),
			};

			if (classification === "contribution") {
				const memberId = source.holders[0]?.memberId;
				if (!memberId) throw new Error("contribution_member_not_source_owner");
				const { transfer, contribution } = await fundingService.postContribution(
					householdId,
					{
						sourceAccountId: source.id,
						destinationAccountId: destination.id,
						amountMinor,
						effectiveAt,
						description: form.data.description,
						memberId,
					},
					now,
					ctx.operationId,
				);
				await insertValidatedActivity(locals.db, {
					householdId,
					eventType: "contribution_posted",
					subjectType: "transfer",
					subjectId: transfer.id,
					actorUserId: locals.user!.id,
					summary: { ...summary, memberName: source.holders[0]!.displayName },
					operationId: ctx.operationId,
				});
				return { transferId: transfer.id, contributionId: contribution.id };
			}

			if (classification === "distribution") {
				const memberId = destination.holders[0]?.memberId;
				if (!memberId) throw new Error("distribution_member_not_destination_owner");
				const { transfer, distribution } = await fundingService.postDistribution(
					householdId,
					{
						sourceAccountId: source.id,
						destinationAccountId: destination.id,
						amountMinor,
						effectiveAt,
						description: form.data.description,
						memberId,
					},
					now,
					ctx.operationId,
				);
				await insertValidatedActivity(locals.db, {
					householdId,
					eventType: "distribution_posted",
					subjectType: "transfer",
					subjectId: transfer.id,
					actorUserId: locals.user!.id,
					summary: { ...summary, memberName: destination.holders[0]!.displayName },
					operationId: ctx.operationId,
				});
				return { transferId: transfer.id, distributionId: distribution.id };
			}

			const transfer = await transferService.postTransfer(
				householdId,
				{
					sourceAccountId: source.id,
					destinationAccountId: destination.id,
					amountMinor,
					effectiveAt,
					description: form.data.description,
					classification,
				},
				now,
				ctx.operationId,
			);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "transfer_posted",
				subjectType: "transfer",
				subjectId: transfer.id,
				actorUserId: locals.user!.id,
				summary: { ...summary, classification: TRANSFER_CLASSIFICATION_LABELS[transfer.classification] },
				operationId: ctx.operationId,
			});
			return { transferId: transfer.id };
		});

		if (isGateConflict(outcome)) {
			return message(form, "Otra operación está en curso. Inténtalo de nuevo.", { status: 409 });
		}
		if (isGateError(outcome)) {
			switch (outcome.error.message) {
				case "transfer_amount_not_positive":
					return setError(form, "amount", "El importe debe ser mayor que cero");
				case "transfer_accounts_identical":
					return setError(form, "destinationAccountId", "El origen y el destino deben ser cuentas distintas");
				case "account_not_found":
					return message(form, "Cuenta no encontrada", { status: 404 });
				case "account_closed":
					return message(form, "Una cuenta cerrada no acepta nuevos movimientos", { status: 400 });
				case "account_not_active":
					return message(form, "Activa las cuentas antes de mover dinero", { status: 400 });
				case "transfer_classification_not_allowed":
					return setError(form, "classification", "Esa clasificación no es válida para estas cuentas");
				case "contribution_member_not_source_owner":
					return message(form, "La aportación solo puede atribuirse al titular de la cuenta personal de origen", {
						status: 400,
					});
				case "distribution_member_not_destination_owner":
					return message(form, "La distribución solo puede atribuirse al titular de la cuenta personal de destino", {
						status: 400,
					});
				case "holder_not_active":
					return message(form, "El titular está desactivado. Reactívalo desde Más → Miembros o elige otra opción.", {
						status: 400,
					});
				case "holder_not_household_member":
					return message(form, "El titular debe ser miembro del hogar.", { status: 400 });
				default:
					return message(form, "No se pudo registrar la transferencia", { status: 400 });
			}
		}

		throw redirect(303, `/cuentas/${form.data.destinationAccountId}`);
	},
};
