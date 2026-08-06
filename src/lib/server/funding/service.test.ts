import { describe, expect, it, vi } from "vitest";
import { createFundingService } from "./service";
import { insertReversalRows } from "../accounts/transfers";
import type {
	ContributionRepository,
	ContributionRecord,
	DistributionRepository,
	DistributionRecord,
} from "./repository";
import type {
	AccountEntryRepository,
	AccountTransferRepository,
	AccountHolderRepository,
	AccountRecord,
	AccountRepository,
	AccountTransferRecord,
	CreateAccountEntryInput,
} from "../accounts/repository";
import type { MemberRepository, MemberRecord } from "../household/repository";

const NOW = "2026-08-04T12:00:00.000Z";
const LATER = "2026-08-05T09:00:00.000Z";
const EFFECTIVE = "2026-08-03T00:00:00.000Z";

function account(overrides: Partial<AccountRecord> = {}): AccountRecord {
	return {
		id: "acc-1",
		householdId: "hh-1",
		name: "Cuenta",
		classification: "personal",
		status: "active",
		currency: "EUR",
		createdAt: NOW,
		updatedAt: NOW,
		...overrides,
	};
}

function makeAccounts() {
	return [
		account({ id: "acc-alex", name: "Cuenta de Alex", classification: "personal" }),
		account({ id: "acc-sam", name: "Cuenta de Sam", classification: "personal" }),
		account({ id: "acc-shared", name: "Cuenta común", classification: "shared" }),
	];
}

function mockAccounts(list: AccountRecord[]) {
	return {
		findById: vi.fn((id: string) => Promise.resolve(list.find((a) => a.id === id))),
		findByHousehold: vi.fn().mockResolvedValue(list),
		create: vi.fn(),
		rename: vi.fn(),
		updateStatus: vi.fn(),
		remove: vi.fn(),
		hasReferences: vi.fn().mockResolvedValue(false),
	} satisfies AccountRepository;
}

function mockHoldersByAccount(owners: Record<string, string[]>) {
	return {
		addInterval: vi.fn(),
		findByAccount: vi.fn().mockResolvedValue([]),
		currentHolderMemberIds: vi.fn((accountId: string) => Promise.resolve(owners[accountId] ?? [])),
		replaceHolders: vi.fn(),
	} satisfies AccountHolderRepository;
}

function mockMembers(list: MemberRecord[]) {
	return {
		findByHousehold: vi.fn().mockResolvedValue(list),
		findById: vi.fn((id: string) => Promise.resolve(list.find((m) => m.id === id))),
		create: vi.fn(),
		updateActive: vi.fn(),
		updateWeight: vi.fn(),
		countActiveByHousehold: vi.fn().mockResolvedValue(list.length),
		sumActiveWeight: vi.fn().mockResolvedValue(100),
		hasFinancialReferences: vi.fn().mockResolvedValue(false),
		hasActivityReferences: vi.fn().mockResolvedValue(false),
	} satisfies MemberRepository;
}

function member(id: string, overrides: Partial<MemberRecord> = {}): MemberRecord {
	return { id, householdId: "hh-1", displayName: id, isActive: true, defaultWeight: 50, ...overrides };
}

function mockTransfers() {
	const stored: AccountTransferRecord[] = [];
	const pendingOperations = new Set<string>();
	const isVisible = (t: AccountTransferRecord) => !t.operationId || !pendingOperations.has(t.operationId);
	return {
		stored,
		pendingOperations,
		create: vi.fn((input: AccountTransferRecord) => {
			stored.push({ ...input });
			return Promise.resolve();
		}),
		findById: vi.fn((id: string) => Promise.resolve(stored.find((t) => t.id === id))),
		findVisibleById: vi.fn((id: string) => Promise.resolve(stored.find((t) => t.id === id && isVisible(t)))),
		findByOperationId: vi.fn(() => Promise.resolve(undefined)),
		findPostedByHousehold: vi.fn((householdId: string) =>
			Promise.resolve(stored.filter((t) => t.householdId === householdId && t.status === "posted" && isVisible(t))),
		),
		findPostedByAccount: vi.fn(() => Promise.resolve([])),
		updateClassification: vi.fn((id: string, classification: AccountTransferRecord["classification"]) => {
			const found = stored.find((t) => t.id === id);
			if (found) found.classification = classification;
			return Promise.resolve();
		}),
		markReversed: vi.fn((id: string, reversedById: string) => {
			const found = stored.find((t) => t.id === id);
			if (found) {
				found.status = "reversed";
				found.reversedById = reversedById;
			}
			return Promise.resolve();
		}),
	} satisfies AccountTransferRepository & {
		stored: AccountTransferRecord[];
		pendingOperations: Set<string>;
	};
}

function mockEntries() {
	const stored: CreateAccountEntryInput[] = [];
	return {
		stored,
		appendMany: vi.fn((items: CreateAccountEntryInput[]) => {
			stored.push(...items);
			return Promise.resolve();
		}),
		findByAccount: vi.fn().mockResolvedValue([]),
		findByAccountAfter: vi.fn().mockResolvedValue([]),
	} satisfies AccountEntryRepository & { stored: CreateAccountEntryInput[] };
}

function mockContributions(transfers: ReturnType<typeof mockTransfers>) {
	const stored: ContributionRecord[] = [];
	const pendingOperations = new Set<string>();
	const isVisible = (c: ContributionRecord) => !c.operationId || !pendingOperations.has(c.operationId);
	return {
		stored,
		pendingOperations,
		create: vi.fn((input: Omit<ContributionRecord, "status" | "operationId"> & { operationId?: string | null }) => {
			stored.push({ status: "posted", operationId: null, ...input } as ContributionRecord);
			return Promise.resolve();
		}),
		findByTransferId: vi.fn((transferId: string) => Promise.resolve(stored.find((c) => c.transferId === transferId))),
		findVisibleByTransferId: vi.fn((transferId: string) =>
			Promise.resolve(stored.find((c) => c.transferId === transferId && isVisible(c))),
		),
		reattributeOperation: vi.fn((id: string, operationId: string, recordedAt: string) => {
			const found = stored.find((c) => c.id === id);
			if (found) {
				found.operationId = operationId;
				found.recordedAt = recordedAt;
			}
			return Promise.resolve();
		}),
		markReversed: vi.fn((id: string) => {
			const found = stored.find((c) => c.id === id);
			if (found) found.status = "reversed";
			return Promise.resolve();
		}),
		postedAllocations: vi.fn((householdId: string) =>
			Promise.resolve(
				stored
					.filter((c) => c.householdId === householdId && c.status === "posted")
					.map((c) => ({
						memberId: c.memberId,
						amountMinor: c.amountMinor,
						effectiveAt: transfers.stored.find((t) => t.id === c.transferId)?.effectiveAt ?? c.recordedAt,
					})),
			),
		),
	} satisfies ContributionRepository & { stored: ContributionRecord[]; pendingOperations: Set<string> };
}

function mockDistributions(transfers: ReturnType<typeof mockTransfers>) {
	const stored: DistributionRecord[] = [];
	const pendingOperations = new Set<string>();
	const isVisible = (d: DistributionRecord) => !d.operationId || !pendingOperations.has(d.operationId);
	return {
		stored,
		pendingOperations,
		create: vi.fn((input: Omit<DistributionRecord, "status" | "operationId"> & { operationId?: string | null }) => {
			stored.push({ status: "posted", operationId: null, ...input } as DistributionRecord);
			return Promise.resolve();
		}),
		findByTransferId: vi.fn((transferId: string) => Promise.resolve(stored.find((d) => d.transferId === transferId))),
		findVisibleByTransferId: vi.fn((transferId: string) =>
			Promise.resolve(stored.find((d) => d.transferId === transferId && isVisible(d))),
		),
		reattributeOperation: vi.fn((id: string, operationId: string, recordedAt: string) => {
			const found = stored.find((d) => d.id === id);
			if (found) {
				found.operationId = operationId;
				found.recordedAt = recordedAt;
			}
			return Promise.resolve();
		}),
		markReversed: vi.fn((id: string) => {
			const found = stored.find((d) => d.id === id);
			if (found) found.status = "reversed";
			return Promise.resolve();
		}),
		postedAllocations: vi.fn((householdId: string) =>
			Promise.resolve(
				stored
					.filter((d) => d.householdId === householdId && d.status === "posted")
					.map((d) => ({
						memberId: d.memberId,
						amountMinor: d.amountMinor,
						effectiveAt: transfers.stored.find((t) => t.id === d.transferId)?.effectiveAt ?? d.recordedAt,
					})),
			),
		),
	} satisfies DistributionRepository & { stored: DistributionRecord[]; pendingOperations: Set<string> };
}

function setup() {
	const accountsList = makeAccounts();
	const transfers = mockTransfers();
	const entries = mockEntries();
	const contributions = mockContributions(transfers);
	const distributions = mockDistributions(transfers);
	const holders = mockHoldersByAccount({
		"acc-alex": ["m-alex"],
		"acc-sam": ["m-sam"],
		"acc-shared": ["m-alex", "m-sam"],
	});
	const members = mockMembers([member("m-alex"), member("m-sam")]);
	const service = createFundingService(
		{ accounts: mockAccounts(accountsList), transfers, entries },
		{ contributions, distributions },
		{ holders, members },
	);
	return { service, transfers, entries, contributions, distributions };
}

const alexContribution = {
	sourceAccountId: "acc-alex",
	destinationAccountId: "acc-shared",
	amountMinor: 6000,
	effectiveAt: EFFECTIVE,
	description: "Aportación de Alex",
	memberId: "m-alex",
};

describe("fundingService.postContribution", () => {
	it("posts one contribution transfer attributed in full to the personal source owner", async () => {
		const { service, transfers, entries, contributions } = setup();

		const { transfer, contribution } = await service.postContribution("hh-1", alexContribution, NOW, "op-1");

		expect(transfer.classification).toBe("contribution");
		expect(contribution.memberId).toBe("m-alex");
		expect(contribution.amountMinor).toBe(6000);
		expect(contribution.transferId).toBe(transfer.id);
		expect(contributions.create).toHaveBeenCalledWith(
			expect.objectContaining({ amountMinor: 6000 }),
			expect.any(String),
		);
		expect(entries.stored.filter((e) => e.transferId === transfer.id)).toHaveLength(2);
		expect(transfers.stored).toHaveLength(1);
	});

	it("rejects a contribution naming a member other than the source owner", async () => {
		const { service } = setup();

		await expect(service.postContribution("hh-1", { ...alexContribution, memberId: "m-sam" }, NOW)).rejects.toThrow(
			"contribution_member_not_source_owner",
		);
	});

	it("rejects a contribution from a shared source account", async () => {
		const { service } = setup();

		await expect(
			service.postContribution(
				"hh-1",
				{ ...alexContribution, sourceAccountId: "acc-shared", destinationAccountId: "acc-alex" },
				NOW,
			),
		).rejects.toThrow("transfer_classification_not_allowed");
	});
});

describe("fundingService.postDistribution", () => {
	const samDistribution = {
		sourceAccountId: "acc-shared",
		destinationAccountId: "acc-sam",
		amountMinor: 2000,
		effectiveAt: EFFECTIVE,
		description: "Distribución para Sam",
		memberId: "m-sam",
	};

	it("posts one distribution transfer attributed in full to the personal destination owner", async () => {
		const { service, distributions } = setup();

		const { transfer, distribution } = await service.postDistribution("hh-1", samDistribution, NOW);

		expect(transfer.classification).toBe("distribution");
		expect(distribution.memberId).toBe("m-sam");
		expect(distribution.amountMinor).toBe(2000);
		expect(distributions.stored).toHaveLength(1);
	});

	it("rejects a distribution naming a member other than the destination owner", async () => {
		const { service } = setup();

		await expect(service.postDistribution("hh-1", { ...samDistribution, memberId: "m-alex" }, NOW)).rejects.toThrow(
			"distribution_member_not_destination_owner",
		);
	});
});

describe("fundingService.getNetFunding", () => {
	it("nets posted contributions minus distributions per member", async () => {
		const { service } = setup();
		await service.postContribution("hh-1", { ...alexContribution, amountMinor: 12000 }, NOW);
		await service.postDistribution(
			"hh-1",
			{
				sourceAccountId: "acc-shared",
				destinationAccountId: "acc-alex",
				amountMinor: 2000,
				effectiveAt: EFFECTIVE,
				description: "Distribución",
				memberId: "m-alex",
			},
			NOW,
		);

		const totals = await service.getNetFunding("hh-1");

		const alex = totals.find((t) => t.memberId === "m-alex");
		expect(alex).toMatchObject({ contributionsMinor: 12000, distributionsMinor: 2000, netMinor: 10000 });
	});

	it("attributes multiple members through separate single-member transfers", async () => {
		const { service, transfers } = setup();
		await service.postContribution("hh-1", alexContribution, NOW);
		await service.postContribution(
			"hh-1",
			{
				sourceAccountId: "acc-sam",
				destinationAccountId: "acc-shared",
				amountMinor: 4000,
				effectiveAt: EFFECTIVE,
				description: "Aportación de Sam",
				memberId: "m-sam",
			},
			NOW,
		);

		expect(transfers.stored).toHaveLength(2);
		const totals = await service.getNetFunding("hh-1");
		expect(totals.find((t) => t.memberId === "m-alex")).toMatchObject({ netMinor: 6000 });
		expect(totals.find((t) => t.memberId === "m-sam")).toMatchObject({ netMinor: 4000 });
	});

	it("excludes reversed funding from totals", async () => {
		const { service } = setup();
		const { transfer } = await service.postContribution("hh-1", alexContribution, NOW);
		await service.correctFundingTransfer("hh-1", transfer.id, null, LATER, "op-9");

		const totals = await service.getNetFunding("hh-1");

		expect(totals.find((t) => t.memberId === "m-alex")?.netMinor ?? 0).toBe(0);
	});

	it("applies historical cutoffs to allocations", async () => {
		const { service } = setup();
		await service.postContribution("hh-1", alexContribution, NOW);
		await service.postContribution(
			"hh-1",
			{ ...alexContribution, amountMinor: 9000, effectiveAt: "2026-09-01T00:00:00.000Z" },
			NOW,
		);

		const totals = await service.getNetFunding("hh-1", { to: "2026-08-31T23:59:59.000Z" });

		expect(totals.find((t) => t.memberId === "m-alex")).toMatchObject({ contributionsMinor: 6000 });
	});
});

describe("fundingService.classifyAsContribution", () => {
	it("moves an unclassified personal-to-shared transfer to a contribution", async () => {
		const { service, transfers, contributions } = setup();
		const { postClassifiedTransfer } = await import("../accounts/transfers");
		const transfer = await postClassifiedTransfer(
			{
				accounts: mockAccounts(makeAccounts()),
				transfers,
				entries: mockEntries(),
			},
			"hh-1",
			{
				sourceAccountId: "acc-alex",
				destinationAccountId: "acc-shared",
				amountMinor: 5000,
				effectiveAt: EFFECTIVE,
				description: "Pendiente de clasificar",
			},
			"unclassified",
			NOW,
			null,
		);

		const contribution = await service.classifyAsContribution("hh-1", transfer.id, "m-alex", NOW);

		expect(transfers.stored.find((t) => t.id === transfer.id)?.classification).toBe("contribution");
		expect(contribution.memberId).toBe("m-alex");
		expect(contributions.stored).toHaveLength(1);
	});

	it("returns idempotently when the funding classification is already applied and visible", async () => {
		const { service, contributions } = setup();
		const { transfer, contribution } = await service.postContribution("hh-1", alexContribution, NOW);

		const resumed = await service.classifyAsContribution("hh-1", transfer.id, "m-alex", NOW, "op-retry");

		expect(resumed.id).toBe(contribution.id);
		expect(contributions.reattributeOperation).not.toHaveBeenCalled();
		expect(contributions.stored).toHaveLength(1);
	});

	it("adopts an invisible funding row left by a crashed classify attempt", async () => {
		const { service, transfers, contributions } = setup();
		const { transfer, contribution } = await service.postContribution("hh-1", alexContribution, NOW, "op-failed");
		contributions.pendingOperations.add("op-failed");
		transfers.pendingOperations.add("op-failed");
		// The transfer itself is invisible, so flip the simulation: make only the funding row invisible
		transfers.pendingOperations.delete("op-failed");
		transfers.stored.find((t) => t.id === transfer.id)!.operationId = null;

		const resumed = await service.classifyAsContribution("hh-1", transfer.id, "m-alex", NOW, "op-resume");

		expect(resumed.id).toBe(contribution.id);
		expect(contributions.reattributeOperation).toHaveBeenCalledWith(contribution.id, "op-resume", NOW);
		expect(contributions.stored).toHaveLength(1);
	});

	it("rejects classifying to a different terminal meaning", async () => {
		const { service } = setup();
		const { transfer } = await service.postContribution("hh-1", alexContribution, NOW);

		await expect(service.classifyAsDistribution("hh-1", transfer.id, "m-sam", NOW)).rejects.toThrow(
			"transfer_already_classified",
		);
	});
});

describe("fundingService.correctFundingTransfer", () => {
	it("reverses the funding record and its transfer together and posts a corrected replacement", async () => {
		const { service, transfers, contributions } = setup();
		const { transfer, contribution } = await service.postContribution("hh-1", alexContribution, NOW);

		const { reversal, replacement } = await service.correctFundingTransfer(
			"hh-1",
			transfer.id,
			{ amountMinor: 6500, effectiveAt: EFFECTIVE, description: "Aportación corregida", memberId: "m-alex" },
			LATER,
			"op-7",
		);

		expect(contributions.stored.find((c) => c.id === contribution.id)?.status).toBe("reversed");
		expect(transfers.stored.find((t) => t.id === transfer.id)?.status).toBe("reversed");
		expect(reversal.reversalOfId).toBe(transfer.id);
		expect(reversal.orderingKey).toBe(transfer.orderingKey);
		expect(replacement).not.toBeNull();
		expect(replacement!.transfer.replacesId).toBe(transfer.id);
		expect(replacement!.transfer.chainRootId).toBe(transfer.chainRootId);
		expect(replacement!.contribution!.amountMinor).toBe(6500);

		const totals = await service.getNetFunding("hh-1");
		expect(totals.find((t) => t.memberId === "m-alex")).toMatchObject({ contributionsMinor: 6500 });
	});

	it("preserves the original attribution in history when the member is corrected", async () => {
		const { service, contributions } = setup();
		const { transfer, contribution } = await service.postContribution("hh-1", alexContribution, NOW);

		await service.correctFundingTransfer("hh-1", transfer.id, null, LATER);

		const original = contributions.stored.find((c) => c.id === contribution.id);
		expect(original).toMatchObject({ memberId: "m-alex", amountMinor: 6000, status: "reversed" });
	});
});

describe("sumNetFunding", () => {
	it("excludes pure and unclassified transfers from funding end to end", async () => {
		const { service, contributions, distributions } = setup();
		const { createTransferService } = await import("../accounts/transfers");
		const transferService = createTransferService(mockAccounts(makeAccounts()), mockTransfers(), mockEntries());
		await transferService.postTransfer(
			"hh-1",
			{
				sourceAccountId: "acc-alex",
				destinationAccountId: "acc-shared",
				amountMinor: 7000,
				effectiveAt: EFFECTIVE,
				description: "Traspaso interno",
				classification: "pure",
			},
			NOW,
		);

		const totals = await service.getNetFunding("hh-1");

		expect(totals).toEqual([]);
		expect(contributions.stored).toHaveLength(0);
		expect(distributions.stored).toHaveLength(0);
	});

	it("keeps stored allocations unchanged when household defaults change", async () => {
		const members = mockMembers([member("m-alex"), member("m-sam")]);
		const transfers = mockTransfers();
		const contributions = mockContributions(transfers);
		const service = createFundingService(
			{ accounts: mockAccounts(makeAccounts()), transfers, entries: mockEntries() },
			{ contributions, distributions: mockDistributions(transfers) },
			{
				holders: mockHoldersByAccount({
					"acc-alex": ["m-alex"],
					"acc-sam": ["m-sam"],
					"acc-shared": ["m-alex", "m-sam"],
				}),
				members,
			},
		);
		await service.postContribution("hh-1", alexContribution, NOW);

		// Defaults change after posting: the stored allocation must not move
		members.findById = vi.fn((id: string) => Promise.resolve(member(id, { defaultWeight: 999 })));
		members.sumActiveWeight = vi.fn().mockResolvedValue(1998);

		const totals = await service.getNetFunding("hh-1");

		expect(totals.find((t) => t.memberId === "m-alex")).toMatchObject({ contributionsMinor: 6000, netMinor: 6000 });
	});
});

describe("fundingService crash resume", () => {
	it("heals a half-applied classification whose funding row was never inserted", async () => {
		const { service, transfers, contributions } = setup();
		const { postClassifiedTransfer } = await import("../accounts/transfers");
		const transfer = await postClassifiedTransfer(
			{ accounts: mockAccounts(makeAccounts()), transfers, entries: mockEntries() },
			"hh-1",
			{
				sourceAccountId: "acc-alex",
				destinationAccountId: "acc-shared",
				amountMinor: 5000,
				effectiveAt: EFFECTIVE,
				description: "Pendiente",
			},
			"unclassified",
			NOW,
			null,
		);
		// Simulate a crashed classify: classification flipped visible, no funding row
		await transfers.updateClassification(transfer.id, "contribution");

		const contribution = await service.classifyAsContribution("hh-1", transfer.id, "m-alex", LATER, "op-heal");

		expect(contribution.transferId).toBe(transfer.id);
		expect(contributions.stored).toHaveLength(1);
	});

	it("resumes a half-applied funding correction without duplicating the reversal", async () => {
		const { service, transfers, contributions } = setup();
		const { transfer, contribution } = await service.postContribution("hh-1", alexContribution, NOW, "op-1");

		// Simulate a crash after the funding record was flipped but before the reversal completed
		const crashed = await insertReversalRows(
			{ accounts: mockAccounts(makeAccounts()), transfers, entries: mockEntries() },
			transfer,
			NOW,
			"op-failed",
		);
		await transfers.markReversed(transfer.id, crashed.id);
		await contributions.markReversed(contribution.id);
		transfers.pendingOperations.add("op-failed");

		const { reversal } = await service.correctFundingTransfer("hh-1", transfer.id, null, LATER, "op-retry");

		expect(reversal.id).not.toBe(crashed.id);
		expect(transfers.stored.find((t) => t.id === transfer.id)!.reversedById).toBe(reversal.id);
		expect(contributions.stored.find((c) => c.id === contribution.id)!.status).toBe("reversed");
	});

	it("flips the original transfer and funding record only after reversal rows exist", async () => {
		const { service, transfers, contributions } = setup();
		const { transfer } = await service.postContribution("hh-1", alexContribution, NOW);

		await service.correctFundingTransfer("hh-1", transfer.id, null, LATER, "op-2");

		const transferFlip = transfers.markReversed.mock.invocationCallOrder[0]!;
		const fundingFlip = contributions.markReversed.mock.invocationCallOrder[0]!;
		const reversalInsert = transfers.create.mock.invocationCallOrder[1]!;
		expect(reversalInsert).toBeLessThan(transferFlip);
		expect(transferFlip).toBeLessThan(fundingFlip);
	});

	it("corrects funding for a deactivated member (historical correction stays available)", async () => {
		const members = mockMembers([member("m-alex"), member("m-sam")]);
		const transfers = mockTransfers();
		const contributions = mockContributions(transfers);
		const service = createFundingService(
			{ accounts: mockAccounts(makeAccounts()), transfers, entries: mockEntries() },
			{ contributions, distributions: mockDistributions(transfers) },
			{
				holders: mockHoldersByAccount({
					"acc-alex": ["m-alex"],
					"acc-sam": ["m-sam"],
					"acc-shared": ["m-alex", "m-sam"],
				}),
				members,
			},
		);
		const { transfer } = await service.postContribution("hh-1", alexContribution, NOW);
		members.findById = vi.fn((id: string) => Promise.resolve(member(id, { isActive: id !== "m-alex" ? true : false })));

		const { replacement } = await service.correctFundingTransfer(
			"hh-1",
			transfer.id,
			{ amountMinor: 6500, effectiveAt: EFFECTIVE, description: "Corregida", memberId: "m-alex" },
			LATER,
			"op-3",
		);

		expect(replacement).not.toBeNull();
	});
});

describe("fundingService member re-attribution", () => {
	it("posts a linked replacement attributed to a different member through their account", async () => {
		const { service, contributions } = setup();
		const { transfer, contribution } = await service.postContribution("hh-1", alexContribution, NOW);

		const { reversal, replacement } = await service.correctFundingTransfer(
			"hh-1",
			transfer.id,
			{
				amountMinor: 6000,
				effectiveAt: EFFECTIVE,
				description: "Aportación corregida a Sam",
				memberId: "m-sam",
				accountId: "acc-sam",
			},
			LATER,
			"op-attr",
		);

		expect(reversal.reversalOfId).toBe(transfer.id);
		expect(replacement).not.toBeNull();
		expect(replacement!.transfer.sourceAccountId).toBe("acc-sam");
		expect(replacement!.transfer.chainRootId).toBe(transfer.chainRootId);
		expect(replacement!.transfer.replacesId).toBe(transfer.id);
		expect(replacement!.contribution).toMatchObject({ memberId: "m-sam", amountMinor: 6000 });
		expect(contributions.stored.find((c) => c.id === contribution.id)).toMatchObject({
			memberId: "m-alex",
			status: "reversed",
		});

		const totals = await service.getNetFunding("hh-1");
		expect(totals.find((t) => t.memberId === "m-alex")?.netMinor ?? 0).toBe(0);
		expect(totals.find((t) => t.memberId === "m-sam")).toMatchObject({ contributionsMinor: 6000 });
	});

	it("rejects re-attribution when the member does not own the chosen account", async () => {
		const { service } = setup();
		const { transfer } = await service.postContribution("hh-1", alexContribution, NOW);

		await expect(
			service.correctFundingTransfer(
				"hh-1",
				transfer.id,
				{ amountMinor: 6000, effectiveAt: EFFECTIVE, description: "X", memberId: "m-sam", accountId: "acc-alex" },
				LATER,
			),
		).rejects.toThrow("contribution_member_not_source_owner");
	});
});

describe("fundingService classify crash windows", () => {
	it("adopts an invisible funding row when the classification flip never happened", async () => {
		const { service, transfers, contributions } = setup();
		const { postClassifiedTransfer } = await import("../accounts/transfers");
		const transfer = await postClassifiedTransfer(
			{ accounts: mockAccounts(makeAccounts()), transfers, entries: mockEntries() },
			"hh-1",
			{
				sourceAccountId: "acc-alex",
				destinationAccountId: "acc-shared",
				amountMinor: 5000,
				effectiveAt: EFFECTIVE,
				description: "Pendiente",
			},
			"unclassified",
			NOW,
			null,
		);
		// Crash simulation: funding row inserted (invisible), classification never flipped
		contributions.stored.push({
			id: "c-crashed",
			householdId: "hh-1",
			transferId: transfer.id,
			memberId: "m-alex",
			amountMinor: 5000,
			status: "posted",
			recordedAt: NOW,
			operationId: "op-failed",
		});
		contributions.pendingOperations.add("op-failed");

		const resumed = await service.classifyAsContribution("hh-1", transfer.id, "m-alex", LATER, "op-resume");

		expect(resumed.id).toBe("c-crashed");
		expect(contributions.reattributeOperation).toHaveBeenCalledWith("c-crashed", "op-resume", LATER);
		expect(contributions.stored).toHaveLength(1);
		expect(transfers.stored.find((t) => t.id === transfer.id)!.classification).toBe("contribution");
	});

	it("rejects adopting a row attributed to a different member", async () => {
		const { service, transfers } = setup();
		const { transfer } = await service.postContribution("hh-1", alexContribution, NOW);
		transfers.stored.find((t) => t.id === transfer.id)!.operationId = null;

		await expect(service.classifyAsContribution("hh-1", transfer.id, "m-sam", NOW)).rejects.toThrow(
			"contribution_member_not_source_owner",
		);
	});
});
