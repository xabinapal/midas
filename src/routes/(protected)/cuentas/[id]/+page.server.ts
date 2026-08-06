import { error, fail } from "@sveltejs/kit";
import { createAccountServices } from "$lib/server/accounts/services";
import { buildAccountHistory, type HistoryActor } from "$lib/server/accounts/history";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { isGateConflict, isGateError, withGate } from "$lib/server/operations/with-gate";
import { formatMinorUnits } from "$lib/accounts/money";
import type { Actions, PageServerLoad } from "./$types";

async function loadAccountDetail(locals: App.Locals, accountId: string) {
	const householdId = locals.user!.householdId;
	const { accountService, observationService, transferService, repositories } = createAccountServices(locals.db);

	const account = await accountService.getAccount(householdId, accountId).catch(() => null);
	if (!account) {
		throw error(404, "Cuenta no encontrada");
	}
	const household = await repositories.households.findById(householdId);
	const currency = household?.currency ?? "EUR";
	const cutoff = new Date().toISOString();

	const [balance, transfers, observationHistory, allAccounts] = await Promise.all([
		observationService.getEstimatedBalance(householdId, accountId, cutoff),
		transferService.listTransfersByAccount(householdId, accountId),
		repositories.observations.findHistoryByAccount(accountId),
		repositories.accounts.findByHousehold(householdId),
	]);

	const accountNames = new Map(allAccounts.map((row) => [row.id, row.name]));

	const operationIds = [
		...new Set(
			[...transfers.map((t) => t.operationId), ...observationHistory.map((o) => o.operationId)].filter(
				(id): id is string => id !== null,
			),
		),
	];
	const actors = new Map<string, HistoryActor>();
	if (operationIds.length > 0) {
		const rows = await locals.db
			.selectFrom("operation_roots")
			.leftJoin("users", "users.id", "operation_roots.actor_user_id")
			.select(["operation_roots.id as operation_id", "users.username as username", "users.is_active as is_active"])
			.where("operation_roots.id", "in", operationIds)
			.execute();
		for (const row of rows) {
			if (row.username) {
				actors.set(row.operation_id, { username: row.username, isActive: row.is_active === 1 });
			}
		}
	}

	const history = buildAccountHistory({ accountId, transfers, observations: observationHistory, accountNames, actors });

	return { account, balance, currency, history };
}

export const load: PageServerLoad = async ({ locals, params }) => {
	return loadAccountDetail(locals, params.id);
};

async function guardedMutation(
	locals: App.Locals,
	accountId: string,
	mutation: (ctx: { operationId: string }) => Promise<{ eventType: string; summary: Record<string, unknown> }>,
): Promise<{ success: boolean; reason?: string }> {
	const householdId = locals.user!.householdId;
	const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
		const result = await mutation(ctx);
		await insertValidatedActivity(locals.db, {
			householdId,
			eventType: result.eventType,
			subjectType: "account",
			subjectId: accountId,
			actorUserId: locals.user!.id,
			summary: result.summary,
			operationId: ctx.operationId,
		});
		return result;
	});

	if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
	if (isGateError(outcome)) return { success: false, reason: outcome.error.message };
	return { success: true };
}

export const actions: Actions = {
	activate: async ({ locals, params }) => {
		const { accountService } = createAccountServices(locals.db);
		return guardedMutation(locals, params.id, async () => {
			const now = new Date().toISOString();
			const account = await accountService.getAccount(locals.user!.householdId, params.id);
			await accountService.activateAccount(locals.user!.householdId, params.id, now);
			return { eventType: "account_activated", summary: { accountName: account.name } };
		});
	},

	close: async ({ locals, params }) => {
		const { accountService } = createAccountServices(locals.db);
		return guardedMutation(locals, params.id, async () => {
			const now = new Date().toISOString();
			const account = await accountService.getAccount(locals.user!.householdId, params.id);
			await accountService.closeAccount(locals.user!.householdId, params.id, now);
			return { eventType: "account_closed", summary: { accountName: account.name } };
		});
	},

	reopen: async ({ locals, params }) => {
		const { accountService } = createAccountServices(locals.db);
		return guardedMutation(locals, params.id, async () => {
			const now = new Date().toISOString();
			const account = await accountService.getAccount(locals.user!.householdId, params.id);
			await accountService.reopenAccount(locals.user!.householdId, params.id, now);
			return { eventType: "account_reopened", summary: { accountName: account.name } };
		});
	},

	deleteDraft: async ({ locals, params }) => {
		const { accountService } = createAccountServices(locals.db);
		return guardedMutation(locals, params.id, async () => {
			const account = await accountService.getAccount(locals.user!.householdId, params.id);
			await accountService.deleteDraftAccount(locals.user!.householdId, params.id);
			return { eventType: "account_deleted", summary: { accountName: account.name } };
		});
	},

	invalidateObservation: async ({ locals, params, request }) => {
		const formData = await request.formData();
		const observationId = String(formData.get("observationId") ?? "");
		if (!observationId) return fail(400, { success: false, reason: "observation_not_found" });

		const householdId = locals.user!.householdId;
		const { observationService, accountService, repositories } = createAccountServices(locals.db);

		// The observation must belong to this page's account; otherwise the
		// audit event would name the wrong account as subject.
		const target = await repositories.observations.findById(observationId);
		if (!target || target.accountId !== params.id) {
			return { success: false, reason: "observation_not_found" };
		}

		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const account = await accountService.getAccount(householdId, params.id).catch(() => null);
			if (!account) throw new Error("account_not_found");
			const { invalidated } = await observationService.invalidateObservation(
				householdId,
				observationId,
				null,
				now,
				ctx.operationId,
			);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "balance_observation_invalidated",
				subjectType: "account",
				subjectId: params.id,
				actorUserId: locals.user!.id,
				summary: {
					accountName: account.name,
					amount: formatMinorUnits(target.amountMinor, account.currency),
				},
				operationId: ctx.operationId,
			});
			return invalidated;
		});

		if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
		if (isGateError(outcome))
			return {
				success: false,
				reason: outcome.error.message === "account_not_found" ? "observation_not_found" : outcome.error.message,
			};
		return { success: true };
	},
};
