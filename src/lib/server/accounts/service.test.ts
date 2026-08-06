import { describe, expect, it, vi } from "vitest";
import { createAccountService } from "./service";
import type { AccountRecord } from "./repository";
import type { AccountRepository, AccountHolderRepository } from "./repository";
import type { HouseholdRepository, MemberRepository, MemberRecord } from "../household/repository";

const NOW = "2026-08-04T12:00:00.000Z";

function mockHouseholds() {
	return {
		findById: vi.fn().mockResolvedValue({
			id: "hh-1",
			name: "Piso",
			currency: "EUR",
			timezone: "Europe/Madrid",
			locale: "es-ES",
			version: "v1",
			createdAt: NOW,
			updatedAt: NOW,
		}),
		create: vi.fn(),
		countUsersByHousehold: vi.fn().mockResolvedValue(2),
	} satisfies HouseholdRepository;
}

function member(id: string, overrides: Partial<MemberRecord> = {}): MemberRecord {
	return { id, householdId: "hh-1", displayName: `Miembro ${id}`, isActive: true, defaultWeight: 50, ...overrides };
}

function mockMembers(list: MemberRecord[]) {
	return {
		findByHousehold: vi.fn().mockResolvedValue(list),
		findById: vi.fn((id: string) => Promise.resolve(list.find((m) => m.id === id))),
		create: vi.fn(),
		updateActive: vi.fn(),
		updateWeight: vi.fn(),
		countActiveByHousehold: vi.fn().mockResolvedValue(list.filter((m) => m.isActive).length),
		sumActiveWeight: vi.fn().mockResolvedValue(100),
		hasFinancialReferences: vi.fn().mockResolvedValue(false),
		hasActivityReferences: vi.fn().mockResolvedValue(false),
	} satisfies MemberRepository;
}

function account(overrides: Partial<AccountRecord> = {}): AccountRecord {
	return {
		id: "acc-1",
		householdId: "hh-1",
		name: "Cuenta",
		classification: "personal",
		status: "draft",
		currency: "EUR",
		createdAt: NOW,
		updatedAt: NOW,
		...overrides,
	};
}

function mockAccounts(existing: AccountRecord | undefined = account()) {
	let stored: AccountRecord | undefined = existing;
	return {
		findById: vi.fn((id: string) => Promise.resolve(stored && stored.id === id ? stored : undefined)),
		findByHousehold: vi.fn(() => Promise.resolve(stored ? [stored] : [])),
		create: vi.fn(
			(input: {
				id: string;
				householdId: string;
				name: string;
				classification: AccountRecord["classification"];
				currency: string;
			}) => {
				stored = { ...input, status: "draft", createdAt: NOW, updatedAt: NOW };
				return Promise.resolve();
			},
		),
		rename: vi.fn(),
		updateStatus: vi.fn(),
		remove: vi.fn(),
		hasReferences: vi.fn().mockResolvedValue(false),
	} satisfies AccountRepository;
}

function mockHolders(current: string[] = []) {
	return {
		addInterval: vi.fn(),
		findByAccount: vi.fn().mockResolvedValue([]),
		currentHolderMemberIds: vi.fn().mockResolvedValue(current),
		replaceHolders: vi.fn(),
	} satisfies AccountHolderRepository;
}

describe("accountService.createAccount", () => {
	it("stores a personal account with its sole member owner and household currency", async () => {
		const accounts = mockAccounts(undefined);
		const holders = mockHolders();
		const service = createAccountService(accounts, holders, mockMembers([member("m-1")]), mockHouseholds());

		const created = await service.createAccount(
			"hh-1",
			{ name: "Cuenta de Alex", classification: "personal", holderMemberIds: ["m-1"] },
			NOW,
			"op-1",
		);

		expect(created.currency).toBe("EUR");
		expect(created.status).toBe("draft");
		expect(created.classification).toBe("personal");
		expect(accounts.create).toHaveBeenCalledWith(
			expect.objectContaining({ householdId: "hh-1", currency: "EUR" }),
			NOW,
		);
		expect(holders.addInterval).toHaveBeenCalledTimes(1);
		expect(holders.addInterval).toHaveBeenCalledWith(
			expect.objectContaining({ memberId: "m-1", effectiveFrom: NOW, operationId: "op-1" }),
		);
	});

	it("rejects a personal account without exactly one owner", async () => {
		const service = createAccountService(
			mockAccounts(undefined),
			mockHolders(),
			mockMembers([member("m-1")]),
			mockHouseholds(),
		);

		await expect(
			service.createAccount("hh-1", { name: "X", classification: "personal", holderMemberIds: [] }, NOW),
		).rejects.toThrow("personal_account_requires_single_owner");
		await expect(
			service.createAccount("hh-1", { name: "X", classification: "personal", holderMemberIds: ["m-1", "m-2"] }, NOW),
		).rejects.toThrow("personal_account_requires_single_owner");
	});

	it("rejects a shared account with fewer than two household members", async () => {
		const service = createAccountService(
			mockAccounts(undefined),
			mockHolders(),
			mockMembers([member("m-1")]),
			mockHouseholds(),
		);

		await expect(
			service.createAccount("hh-1", { name: "Común", classification: "shared", holderMemberIds: ["m-1"] }, NOW),
		).rejects.toThrow("shared_account_requires_two_holders");
	});

	it("creates a shared account with two holders", async () => {
		const holders = mockHolders();
		const service = createAccountService(
			mockAccounts(undefined),
			holders,
			mockMembers([member("m-1"), member("m-2")]),
			mockHouseholds(),
		);

		const created = await service.createAccount(
			"hh-1",
			{ name: "Cuenta común", classification: "shared", holderMemberIds: ["m-1", "m-2"] },
			NOW,
		);

		expect(created.classification).toBe("shared");
		expect(holders.addInterval).toHaveBeenCalledTimes(2);
	});

	it("rejects holders that do not belong to the household", async () => {
		const foreign = member("m-9", { householdId: "hh-2" });
		const service = createAccountService(
			mockAccounts(undefined),
			mockHolders(),
			mockMembers([member("m-1"), foreign]),
			mockHouseholds(),
		);

		await expect(
			service.createAccount("hh-1", { name: "Común", classification: "shared", holderMemberIds: ["m-1", "m-9"] }, NOW),
		).rejects.toThrow("holder_not_household_member");
	});

	it("rejects inactive members as new holders", async () => {
		const inactive = member("m-2", { isActive: false });
		const service = createAccountService(
			mockAccounts(undefined),
			mockHolders(),
			mockMembers([member("m-1"), inactive]),
			mockHouseholds(),
		);

		await expect(
			service.createAccount("hh-1", { name: "Común", classification: "shared", holderMemberIds: ["m-1", "m-2"] }, NOW),
		).rejects.toThrow("holder_not_active");
	});

	it("rejects an empty account name", async () => {
		const service = createAccountService(
			mockAccounts(undefined),
			mockHolders(),
			mockMembers([member("m-1")]),
			mockHouseholds(),
		);

		await expect(
			service.createAccount("hh-1", { name: "  ", classification: "personal", holderMemberIds: ["m-1"] }, NOW),
		).rejects.toThrow("account_name_required");
	});
});

describe("accountService lifecycle", () => {
	it("activates a draft account after revalidating holders", async () => {
		const accounts = mockAccounts(account({ status: "draft" }));
		const service = createAccountService(
			accounts,
			mockHolders(["m-1"]),
			mockMembers([member("m-1")]),
			mockHouseholds(),
		);

		await service.activateAccount("hh-1", "acc-1", NOW);

		expect(accounts.updateStatus).toHaveBeenCalledWith("acc-1", "active", NOW);
	});

	it("rejects activating a shared account that lost a holder", async () => {
		const accounts = mockAccounts(account({ status: "draft", classification: "shared" }));
		const service = createAccountService(
			accounts,
			mockHolders(["m-1"]),
			mockMembers([member("m-1")]),
			mockHouseholds(),
		);

		await expect(service.activateAccount("hh-1", "acc-1", NOW)).rejects.toThrow("shared_account_requires_two_holders");
	});

	it("closes an active account while preserving history", async () => {
		const accounts = mockAccounts(account({ status: "active" }));
		const service = createAccountService(
			accounts,
			mockHolders(["m-1"]),
			mockMembers([member("m-1")]),
			mockHouseholds(),
		);

		await service.closeAccount("hh-1", "acc-1", NOW);

		expect(accounts.updateStatus).toHaveBeenCalledWith("acc-1", "closed", NOW);
		expect(accounts.remove).not.toHaveBeenCalled();
	});

	it("reopens a closed account when holder constraints still hold", async () => {
		const accounts = mockAccounts(account({ status: "closed" }));
		const service = createAccountService(
			accounts,
			mockHolders(["m-1"]),
			mockMembers([member("m-1")]),
			mockHouseholds(),
		);

		await service.reopenAccount("hh-1", "acc-1", NOW);

		expect(accounts.updateStatus).toHaveBeenCalledWith("acc-1", "active", NOW);
	});

	it("rejects reopening an account that is not closed", async () => {
		const accounts = mockAccounts(account({ status: "active" }));
		const service = createAccountService(
			accounts,
			mockHolders(["m-1"]),
			mockMembers([member("m-1")]),
			mockHouseholds(),
		);

		await expect(service.reopenAccount("hh-1", "acc-1", NOW)).rejects.toThrow("account_not_closed");
	});

	it("deletes an unreferenced draft account", async () => {
		const accounts = mockAccounts(account({ status: "draft" }));
		const service = createAccountService(
			accounts,
			mockHolders(["m-1"]),
			mockMembers([member("m-1")]),
			mockHouseholds(),
		);

		await service.deleteDraftAccount("hh-1", "acc-1");

		expect(accounts.remove).toHaveBeenCalledWith("acc-1");
	});

	it("rejects deleting a referenced account", async () => {
		const accounts = mockAccounts(account({ status: "draft" }));
		accounts.hasReferences = vi.fn().mockResolvedValue(true);
		const service = createAccountService(
			accounts,
			mockHolders(["m-1"]),
			mockMembers([member("m-1")]),
			mockHouseholds(),
		);

		await expect(service.deleteDraftAccount("hh-1", "acc-1")).rejects.toThrow("account_referenced");
		expect(accounts.remove).not.toHaveBeenCalled();
	});

	it("rejects deleting an active account instead of closing it", async () => {
		const accounts = mockAccounts(account({ status: "active" }));
		const service = createAccountService(
			accounts,
			mockHolders(["m-1"]),
			mockMembers([member("m-1")]),
			mockHouseholds(),
		);

		await expect(service.deleteDraftAccount("hh-1", "acc-1")).rejects.toThrow("account_not_draft");
	});
	it("replaces holders of a draft account and rejects holder edits once active", async () => {
		const accounts = mockAccounts(account({ status: "draft", classification: "shared" }));
		const holders = mockHolders(["m-1", "m-2"]);
		const members = mockMembers([member("m-1"), member("m-2"), member("m-3")]);
		const service = createAccountService(accounts, holders, members, mockHouseholds());

		await service.updateDraftHolders("hh-1", "acc-1", ["m-1", "m-3"], NOW, "op-2");
		expect(holders.replaceHolders).toHaveBeenCalledWith("acc-1", ["m-1", "m-3"], NOW, "op-2");

		const active = mockAccounts(account({ status: "active", classification: "shared" }));
		const activeService = createAccountService(active, holders, members, mockHouseholds());
		await expect(activeService.updateDraftHolders("hh-1", "acc-1", ["m-1", "m-3"], NOW)).rejects.toThrow(
			"account_not_draft",
		);
	});

	it("validates a draft edit fully before writing anything", async () => {
		const accounts = mockAccounts(account({ status: "draft", classification: "shared" }));
		const holders = mockHolders(["m-1", "m-2"]);
		const members = mockMembers([member("m-1"), member("m-2")]);
		const service = createAccountService(accounts, holders, members, mockHouseholds());

		await expect(
			service.updateDraftAccount("hh-1", "acc-1", { name: "Nuevo nombre", holderMemberIds: ["m-1"] }, NOW),
		).rejects.toThrow("shared_account_requires_two_holders");
		expect(accounts.rename).not.toHaveBeenCalled();
		expect(holders.replaceHolders).not.toHaveBeenCalled();

		await service.updateDraftAccount("hh-1", "acc-1", { name: "Nuevo nombre", holderMemberIds: ["m-1", "m-2"] }, NOW);
		expect(accounts.rename).toHaveBeenCalledWith("acc-1", "Nuevo nombre", NOW);
		expect(holders.replaceHolders).toHaveBeenCalledWith("acc-1", ["m-1", "m-2"], NOW, null);
	});
});

describe("accountService household scoping", () => {
	it("rejects access to another household's account", async () => {
		const foreignAccount = account({ householdId: "hh-2" });
		const accounts = mockAccounts(foreignAccount);
		const service = createAccountService(
			accounts,
			mockHolders(["m-1"]),
			mockMembers([member("m-1")]),
			mockHouseholds(),
		);

		await expect(service.closeAccount("hh-1", "acc-1", NOW)).rejects.toThrow("account_not_found");
		await expect(service.getAccount("hh-1", "acc-1")).rejects.toThrow("account_not_found");
	});

	it("renames an active account but never a closed one", async () => {
		const accounts = mockAccounts(account({ status: "active" }));
		const service = createAccountService(
			accounts,
			mockHolders(["m-1"]),
			mockMembers([member("m-1")]),
			mockHouseholds(),
		);

		await service.renameAccount("hh-1", "acc-1", "Nuevo nombre", NOW);
		expect(accounts.rename).toHaveBeenCalledWith("acc-1", "Nuevo nombre", NOW);

		const closed = mockAccounts(account({ status: "closed" }));
		const closedService = createAccountService(
			closed,
			mockHolders(["m-1"]),
			mockMembers([member("m-1")]),
			mockHouseholds(),
		);
		await expect(closedService.renameAccount("hh-1", "acc-1", "X", NOW)).rejects.toThrow("account_closed");
	});
});
