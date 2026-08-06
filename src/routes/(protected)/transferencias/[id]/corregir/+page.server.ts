import { error, fail, redirect } from "@sveltejs/kit";
import { message, setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { formatMinorUnits, parseAmountToMinorUnits } from "$lib/accounts/money";
import { correctionSchema, effectiveAtFromDateInput } from "$lib/accounts/schemas";
import { TRANSFER_CLASSIFICATION_LABELS } from "$lib/accounts/terms";
import { createAccountServices } from "$lib/server/accounts/services";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { isGateConflict, isGateError, withGate } from "$lib/server/operations/with-gate";
import type { Actions, PageServerLoad } from "./$types";

async function loadContext(locals: App.Locals, transferId: string) {
	const householdId = locals.user!.householdId;
	const { transferService, accountService, repositories } = createAccountServices(locals.db);
	const transfer = await transferService.getTransfer(householdId, transferId).catch(() => null);
	if (!transfer) throw error(404, "Transferencia no encontrada");
	if (transfer.status !== "posted" || transfer.reversedById) {
		throw error(409, "Esta transferencia ya está revertida");
	}

	const source = await accountService.getAccount(householdId, transfer.sourceAccountId);
	const destination = await accountService.getAccount(householdId, transfer.destinationAccountId);

	let attributedMemberName: string | undefined;
	let attributedMemberId: string | undefined;
	if (transfer.classification === "contribution") {
		const contribution = await repositories.contributions.findByTransferId(transfer.id);
		if (contribution) {
			const member = await repositories.members.findById(contribution.memberId);
			attributedMemberName = member?.displayName;
			attributedMemberId = contribution.memberId;
		}
	} else if (transfer.classification === "distribution") {
		const distribution = await repositories.distributions.findByTransferId(transfer.id);
		if (distribution) {
			const member = await repositories.members.findById(distribution.memberId);
			attributedMemberName = member?.displayName;
			attributedMemberId = distribution.memberId;
		}
	}

	const funded = transfer.classification === "contribution" || transfer.classification === "distribution";
	const personalAccountId = transfer.classification === "contribution" ? source.id : destination.id;
	const personalAccounts = funded
		? (await accountService.listAccounts(householdId)).filter(
				(account) =>
					account.classification === "personal" && (account.status === "active" || account.id === personalAccountId),
			)
		: [];

	return {
		transfer,
		source,
		destination,
		attributedMemberName,
		attributedMemberId,
		funded,
		personalAccountId,
		personalAccounts,
	};
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const context = await loadContext(locals, params.id);
	return {
		...context,
		form: await superValidate(
			{
				mode: "reverse",
				amount: (context.transfer.amountMinor / 100).toString().replace(".", ","),
				effectiveDate: context.transfer.effectiveAt.slice(0, 10),
				description: context.transfer.description,
				fundingAccountId: context.personalAccountId,
			},
			zod4(correctionSchema),
		),
	};
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const householdId = locals.user!.householdId;
		const form = await superValidate(request, zod4(correctionSchema));
		if (!form.valid) return fail(400, { form });

		const { transferService, fundingService, accountService, repositories } = createAccountServices(locals.db);

		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const transfer = await transferService.getTransfer(householdId, params.id);
			const source = await accountService.getAccount(householdId, transfer.sourceAccountId);
			const destination = await accountService.getAccount(householdId, transfer.destinationAccountId);
			const summary = {
				sourceAccountName: source.name,
				destinationAccountName: destination.name,
				amount: formatMinorUnits(transfer.amountMinor, source.currency),
			};

			const funded = transfer.classification === "contribution" || transfer.classification === "distribution";

			if (form.data.mode === "reverse") {
				if (funded) {
					await fundingService.correctFundingTransfer(householdId, params.id, null, now, ctx.operationId);
				} else {
					await transferService.correctTransfer(householdId, params.id, null, now, ctx.operationId);
				}
				await insertValidatedActivity(locals.db, {
					householdId,
					eventType: funded ? `${transfer.classification}_reversed` : "transfer_reversed",
					subjectType: "transfer",
					subjectId: params.id,
					actorUserId: locals.user!.id,
					summary,
					operationId: ctx.operationId,
				});
				return { source, replaced: false };
			}

			const amountMinor = parseAmountToMinorUnits(form.data.amount ?? "", source.currency);
			if (amountMinor === null || amountMinor <= 0) {
				throw new Error("transfer_amount_not_positive");
			}
			const replacement = {
				amountMinor,
				effectiveAt: effectiveAtFromDateInput(form.data.effectiveDate ?? ""),
				description: form.data.description ?? "",
			};

			if (funded) {
				const fundingRecord =
					transfer.classification === "contribution"
						? await repositories.contributions.findByTransferId(transfer.id)
						: await repositories.distributions.findByTransferId(transfer.id);
				if (!fundingRecord) throw new Error("funding_record_not_found");

				// Re-attribution: the personal account may change; the attributed
				// member is always derived from its sole owner, never trusted
				// from form data.
				const personalAccountId =
					transfer.classification === "contribution" ? transfer.sourceAccountId : transfer.destinationAccountId;
				const chosenAccountId = form.data.fundingAccountId || personalAccountId;
				let memberId = fundingRecord.memberId;
				if (chosenAccountId !== personalAccountId) {
					const chosen = await accountService.getAccount(householdId, chosenAccountId);
					memberId = chosen.holders[0]?.memberId ?? fundingRecord.memberId;
				}
				await fundingService.correctFundingTransfer(
					householdId,
					params.id,
					{ ...replacement, memberId, accountId: chosenAccountId },
					now,
					ctx.operationId,
				);
			} else {
				await transferService.correctTransfer(householdId, params.id, replacement, now, ctx.operationId);
			}
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: funded ? `${transfer.classification}_corrected` : "transfer_corrected",
				subjectType: "transfer",
				subjectId: params.id,
				actorUserId: locals.user!.id,
				summary: {
					...summary,
					classification: TRANSFER_CLASSIFICATION_LABELS[transfer.classification],
				},
				operationId: ctx.operationId,
			});
			return { source, replaced: true };
		});

		if (isGateConflict(outcome)) {
			return message(form, "Otra operación está en curso. Inténtalo de nuevo.", { status: 409 });
		}
		if (isGateError(outcome)) {
			switch (outcome.error.message) {
				case "transfer_not_found":
					throw error(404, "Transferencia no encontrada");
				case "transfer_already_reversed":
				case "transfer_not_posted":
					throw error(409, "Esta transferencia ya está revertida");
				case "transfer_amount_not_positive":
					return setError(form, "amount", "El importe corregido debe ser mayor que cero");
				case "funding_record_not_found":
					return message(form, "No se encontró la aportación o distribución asociada", { status: 400 });
				case "transfer_has_funding_classification":
					return message(form, "Las aportaciones y distribuciones se corrigen desde su clasificación", {
						status: 400,
					});
				case "holder_not_active":
					return message(form, "El titular está desactivado. Reactívalo desde Más → Miembros o elige otra opción.", {
						status: 400,
					});
				case "holder_not_household_member":
					return message(form, "El titular debe ser miembro del hogar.", { status: 400 });
				case "contribution_member_not_source_owner":
					return message(form, "La aportación solo puede atribuirse al titular de la cuenta personal elegida", {
						status: 400,
					});
				case "distribution_member_not_destination_owner":
					return message(form, "La distribución solo puede atribuirse al titular de la cuenta personal elegida", {
						status: 400,
					});
				default:
					return message(form, "No se pudo corregir la transferencia", { status: 400 });
			}
		}

		throw redirect(303, `/cuentas/${outcome.result.source.id}`);
	},
};
