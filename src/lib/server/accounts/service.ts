import type { AccountClassification } from "$lib/accounts/model";
import type { AccountHolderRepository, AccountRecord, AccountRepository } from "./repository";
import type { HouseholdRepository, MemberRepository } from "../household/repository";

export interface CreateAccountOptions {
	name: string;
	classification: AccountClassification;
	holderMemberIds: string[];
}

export interface AccountHolderView {
	memberId: string;
	displayName: string;
}

export interface AccountView extends AccountRecord {
	holders: AccountHolderView[];
}

export interface AccountService {
	createAccount(
		householdId: string,
		options: CreateAccountOptions,
		now: string,
		operationId?: string | null,
	): Promise<AccountRecord>;
	renameAccount(householdId: string, accountId: string, name: string, now: string): Promise<void>;
	updateDraftAccount(
		householdId: string,
		accountId: string,
		options: { name: string; holderMemberIds: string[] },
		now: string,
		operationId?: string | null,
	): Promise<void>;
	updateDraftHolders(
		householdId: string,
		accountId: string,
		memberIds: string[],
		now: string,
		operationId?: string | null,
	): Promise<void>;
	activateAccount(householdId: string, accountId: string, now: string): Promise<void>;
	closeAccount(householdId: string, accountId: string, now: string): Promise<void>;
	reopenAccount(householdId: string, accountId: string, now: string): Promise<void>;
	deleteDraftAccount(householdId: string, accountId: string): Promise<void>;
	listAccounts(householdId: string): Promise<AccountView[]>;
	getAccount(householdId: string, accountId: string): Promise<AccountView>;
}

export function createAccountService(
	accounts: AccountRepository,
	holders: AccountHolderRepository,
	members: MemberRepository,
	households: HouseholdRepository,
): AccountService {
	async function validateHolders(
		householdId: string,
		classification: AccountClassification,
		holderMemberIds: string[],
	): Promise<void> {
		const unique = [...new Set(holderMemberIds)];
		if (classification === "personal" && unique.length !== 1) {
			throw new Error("personal_account_requires_single_owner");
		}
		if (classification === "shared" && unique.length < 2) {
			throw new Error("shared_account_requires_two_holders");
		}
		for (const memberId of unique) {
			const member = await members.findById(memberId);
			if (!member || member.householdId !== householdId) {
				throw new Error("holder_not_household_member");
			}
			if (!member.isActive) {
				throw new Error("holder_not_active");
			}
		}
	}

	async function requireAccount(householdId: string, accountId: string): Promise<AccountRecord> {
		const account = await accounts.findById(accountId);
		if (!account || account.householdId !== householdId) {
			throw new Error("account_not_found");
		}
		return account;
	}

	async function validateCurrentHolders(account: AccountRecord): Promise<void> {
		const current = await holders.currentHolderMemberIds(account.id);
		if (account.classification === "personal" && current.length !== 1) {
			throw new Error("personal_account_requires_single_owner");
		}
		if (account.classification === "shared" && current.length < 2) {
			throw new Error("shared_account_requires_two_holders");
		}
	}

	async function toView(account: AccountRecord): Promise<AccountView> {
		const memberIds = await holders.currentHolderMemberIds(account.id);
		const holderViews: AccountHolderView[] = [];
		for (const memberId of memberIds) {
			const member = await members.findById(memberId);
			holderViews.push({ memberId, displayName: member?.displayName ?? memberId });
		}
		return { ...account, holders: holderViews };
	}

	return {
		async createAccount(householdId, options, now, operationId = null) {
			const name = options.name.trim();
			if (name.length === 0) {
				throw new Error("account_name_required");
			}
			const household = await households.findById(householdId);
			if (!household) {
				throw new Error("household_not_found");
			}
			await validateHolders(householdId, options.classification, options.holderMemberIds);

			const id = crypto.randomUUID();
			await accounts.create(
				{
					id,
					householdId,
					name,
					classification: options.classification,
					currency: household.currency,
				},
				now,
			);
			for (const memberId of new Set(options.holderMemberIds)) {
				await holders.addInterval({
					id: crypto.randomUUID(),
					accountId: id,
					memberId,
					effectiveFrom: now,
					operationId,
				});
			}
			const created = await accounts.findById(id);
			if (!created) throw new Error("account_not_found");
			return created;
		},

		async renameAccount(householdId, accountId, name, now) {
			const account = await requireAccount(householdId, accountId);
			if (account.status === "closed") {
				throw new Error("account_closed");
			}
			const trimmed = name.trim();
			if (trimmed.length === 0) {
				throw new Error("account_name_required");
			}
			await accounts.rename(accountId, trimmed, now);
		},

		async updateDraftHolders(householdId, accountId, memberIds, now, operationId = null) {
			const account = await requireAccount(householdId, accountId);
			if (account.status !== "draft") {
				throw new Error("account_not_draft");
			}
			await validateHolders(householdId, account.classification, memberIds);
			await holders.replaceHolders(accountId, [...new Set(memberIds)], now, operationId);
		},

		async updateDraftAccount(householdId, accountId, options, now, operationId = null) {
			// Validate everything before writing anything: a rejected edit must
			// leave both the name and the holder set untouched.
			const account = await requireAccount(householdId, accountId);
			if (account.status !== "draft") {
				throw new Error("account_not_draft");
			}
			const trimmed = options.name.trim();
			if (trimmed.length === 0) {
				throw new Error("account_name_required");
			}
			await validateHolders(householdId, account.classification, options.holderMemberIds);
			await accounts.rename(accountId, trimmed, now);
			await holders.replaceHolders(accountId, [...new Set(options.holderMemberIds)], now, operationId);
		},

		async activateAccount(householdId, accountId, now) {
			const account = await requireAccount(householdId, accountId);
			if (account.status !== "draft") {
				throw new Error("account_not_draft");
			}
			await validateCurrentHolders(account);
			await accounts.updateStatus(accountId, "active", now);
		},

		async closeAccount(householdId, accountId, now) {
			const account = await requireAccount(householdId, accountId);
			if (account.status === "closed") {
				throw new Error("account_closed");
			}
			await accounts.updateStatus(accountId, "closed", now);
		},

		async reopenAccount(householdId, accountId, now) {
			const account = await requireAccount(householdId, accountId);
			if (account.status !== "closed") {
				throw new Error("account_not_closed");
			}
			await validateCurrentHolders(account);
			await accounts.updateStatus(accountId, "active", now);
		},

		async deleteDraftAccount(householdId, accountId) {
			const account = await requireAccount(householdId, accountId);
			if (account.status !== "draft") {
				throw new Error("account_not_draft");
			}
			if (await accounts.hasReferences(accountId)) {
				throw new Error("account_referenced");
			}
			await accounts.remove(accountId);
		},

		async listAccounts(householdId) {
			const rows = await accounts.findByHousehold(householdId);
			return Promise.all(rows.map(toView));
		},

		async getAccount(householdId, accountId) {
			const account = await requireAccount(householdId, accountId);
			return toView(account);
		},
	};
}
