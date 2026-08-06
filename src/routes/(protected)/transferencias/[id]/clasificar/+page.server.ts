import { error, fail, redirect } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { allowedTransferClassifications, type TransferClassification } from "$lib/accounts/model";
import { formatMinorUnits } from "$lib/accounts/money";
import { classifyTransferSchema } from "$lib/accounts/schemas";
import { TRANSFER_CLASSIFICATION_LABELS } from "$lib/accounts/terms";
import { createAccountServices } from "$lib/server/accounts/services";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { isGateConflict, isGateError, withGate } from "$lib/server/operations/with-gate";
import type { Actions, PageServerLoad } from "./$types";

async function loadContext(locals: App.Locals, transferId: string) {
	const householdId = locals.user!.householdId;
	const { transferService, accountService } = createAccountServices(locals.db);
	const transfer = await transferService.getTransfer(householdId, transferId).catch(() => null);
	if (!transfer) throw error(404, "Transferencia no encontrada");
	if (transfer.status !== "posted" || transfer.classification !== "unclassified") {
		throw error(409, "Esta transferencia ya tiene una clasificación definitiva");
	}

	const source = await accountService.getAccount(householdId, transfer.sourceAccountId);
	const destination = await accountService.getAccount(householdId, transfer.destinationAccountId);
	const allowed = allowedTransferClassifications(source.classification, destination.classification).filter(
		(classification) => classification !== "unclassified",
	);
	const attributedMemberName =
		source.classification === "personal"
			? source.holders[0]?.displayName
			: destination.classification === "personal"
				? destination.holders[0]?.displayName
				: undefined;

	return { transfer, source, destination, allowed, attributedMemberName };
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const context = await loadContext(locals, params.id);
	return { ...context, form: await superValidate(zod4(classifyTransferSchema)) };
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const householdId = locals.user!.householdId;
		const form = await superValidate(request, zod4(classifyTransferSchema));
		if (!form.valid) return fail(400, { form });

		const { transferService, fundingService, accountService } = createAccountServices(locals.db);
		const classification = form.data.classification as TransferClassification;

		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const transfer = await transferService.getTransfer(householdId, params.id);
			const source = await accountService.getAccount(householdId, transfer.sourceAccountId);
			const destination = await accountService.getAccount(householdId, transfer.destinationAccountId);
			const summary = {
				sourceAccountName: source.name,
				destinationAccountName: destination.name,
				amount: formatMinorUnits(transfer.amountMinor, source.currency),
				classification: TRANSFER_CLASSIFICATION_LABELS[classification],
			};

			if (classification === "pure") {
				await transferService.classifyTransfer(householdId, params.id, "pure");
			} else if (classification === "contribution") {
				const memberId = source.holders[0]?.memberId;
				if (!memberId) throw new Error("contribution_member_not_source_owner");
				await fundingService.classifyAsContribution(householdId, params.id, memberId, now, ctx.operationId);
			} else {
				const memberId = destination.holders[0]?.memberId;
				if (!memberId) throw new Error("distribution_member_not_destination_owner");
				await fundingService.classifyAsDistribution(householdId, params.id, memberId, now, ctx.operationId);
			}

			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "transfer_classified",
				subjectType: "transfer",
				subjectId: params.id,
				actorUserId: locals.user!.id,
				summary,
				operationId: ctx.operationId,
			});
			return { source };
		});

		if (isGateConflict(outcome)) {
			return message(form, "Otra operación está en curso. Inténtalo de nuevo.", { status: 409 });
		}
		if (isGateError(outcome)) {
			switch (outcome.error.message) {
				case "transfer_not_found":
					throw error(404, "Transferencia no encontrada");
				case "transfer_already_classified":
				case "transfer_not_posted":
					throw error(409, "Esta transferencia ya tiene una clasificación definitiva");
				case "transfer_classification_not_allowed":
					return message(form, "Esa clasificación no es válida para estas cuentas", { status: 400 });
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
					return message(form, "No se pudo clasificar la transferencia", { status: 400 });
			}
		}

		throw redirect(303, `/cuentas/${outcome.result.source.id}`);
	},
};
