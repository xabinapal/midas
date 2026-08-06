import type { PageServerLoad } from "./$types";
import { createAccountServices } from "$lib/server/accounts/services";
import type { BalanceProjection } from "$lib/accounts/projection";

export const load: PageServerLoad = async ({ locals }) => {
	const householdId = locals.user!.householdId;
	const { accountService, observationService, fundingService, repositories } = createAccountServices(locals.db);

	const household = await repositories.households.findById(householdId);
	const currency = household?.currency ?? "EUR";
	const cutoff = new Date().toISOString();

	const accounts = await accountService.listAccounts(householdId);
	const accountsWithBalances = await Promise.all(
		accounts.map(async (account) => {
			const balance: BalanceProjection = await observationService.getEstimatedBalance(householdId, account.id, cutoff);
			return { ...account, balance };
		}),
	);

	const [fundingTotals, members, postedTransfers] = await Promise.all([
		fundingService.getNetFunding(householdId),
		repositories.members.findByHousehold(householdId),
		repositories.transfers.findPostedByHousehold(householdId),
	]);
	const memberNames = new Map(members.map((member) => [member.id, member.displayName]));
	const funding = fundingTotals.map((totals) => ({
		...totals,
		displayName: memberNames.get(totals.memberId) ?? totals.memberId,
	}));

	const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
	const pendingClassification = postedTransfers
		.filter(
			(transfer) =>
				transfer.status === "posted" && transfer.classification === "unclassified" && !transfer.reversedById,
		)
		.map((transfer) => ({
			id: transfer.id,
			description: transfer.description,
			amountMinor: transfer.amountMinor,
			effectiveAt: transfer.effectiveAt,
			sourceName: accountNames.get(transfer.sourceAccountId) ?? transfer.sourceAccountId,
			destinationName: accountNames.get(transfer.destinationAccountId) ?? transfer.destinationAccountId,
		}));

	return { accounts: accountsWithBalances, currency, funding, pendingClassification };
};
