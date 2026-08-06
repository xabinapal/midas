import { describe, expect, it, vi } from "vitest";
import { foldEntriesIntoChains } from "./balance";
import { orderingKeyFor } from "$lib/accounts/model";
import { createTransferService, insertReversalRows } from "./transfers";
import type {
	AccountEntryRepository,
	AccountRecord,
	AccountRepository,
	AccountTransferRecord,
	AccountTransferRepository,
	CreateAccountEntryInput,
} from "./repository";

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

function mockTransfers(initial: AccountTransferRecord[] = []) {
	const stored = [...initial];
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
		findByOperationId: vi.fn((operationId: string) =>
			Promise.resolve(stored.find((t) => t.operationId === operationId)),
		),
		findPostedByHousehold: vi.fn((householdId: string) =>
			Promise.resolve(stored.filter((t) => t.householdId === householdId && t.status === "posted" && isVisible(t))),
		),
		findPostedByAccount: vi.fn((accountId: string) =>
			Promise.resolve(
				stored.filter((t) => isVisible(t) && (t.sourceAccountId === accountId || t.destinationAccountId === accountId)),
			),
		),
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
	} satisfies AccountTransferRepository & { stored: AccountTransferRecord[]; pendingOperations: Set<string> };
}

function mockEntries() {
	const stored: CreateAccountEntryInput[] = [];
	const repo: AccountEntryRepository & { stored: CreateAccountEntryInput[] } = {
		stored,
		appendMany: vi.fn((entries: CreateAccountEntryInput[]) => {
			stored.push(...entries);
			return Promise.resolve();
		}),
		findByAccount: vi.fn((accountId: string) =>
			Promise.resolve(
				stored.filter((e) => e.accountId === accountId).map((e) => ({ operationId: null, ...e }) as never),
			),
		),
		findByAccountAfter: vi.fn((accountId: string) =>
			Promise.resolve(
				stored.filter((e) => e.accountId === accountId).map((e) => ({ operationId: null, ...e }) as never),
			),
		),
	};
	return repo;
}

const makeTwoAccounts = () => [
	account({ id: "acc-src", classification: "personal" }),
	account({ id: "acc-dst", classification: "shared", name: "Común" }),
];

const baseInput = {
	sourceAccountId: "acc-src",
	destinationAccountId: "acc-dst",
	amountMinor: 10000,
	effectiveAt: EFFECTIVE,
	description: "Traspaso",
	classification: "pure" as const,
};

describe("transferService.postTransfer", () => {
	it("projects exactly one debit and one credit from a single authoritative row", async () => {
		const transfers = mockTransfers();
		const entries = mockEntries();
		const service = createTransferService(mockAccounts(makeTwoAccounts()), transfers, entries);

		const posted = await service.postTransfer("hh-1", baseInput, NOW, "op-1");

		expect(posted.status).toBe("posted");
		expect(posted.chainRootId).toBe(posted.id);
		expect(posted.orderingKey).toBe(orderingKeyFor(EFFECTIVE, posted.id));
		expect(entries.appendMany).toHaveBeenCalledTimes(1);
		expect(entries.stored).toHaveLength(2);
		expect(entries.stored).toContainEqual(
			expect.objectContaining({ accountId: "acc-src", amountMinor: -10000, transferId: posted.id }),
		);
		expect(entries.stored).toContainEqual(
			expect.objectContaining({ accountId: "acc-dst", amountMinor: 10000, transferId: posted.id }),
		);
	});

	it("rejects a transfer whose source and destination are the same account", async () => {
		const service = createTransferService(mockAccounts(makeTwoAccounts()), mockTransfers(), mockEntries());

		await expect(service.postTransfer("hh-1", { ...baseInput, destinationAccountId: "acc-src" }, NOW)).rejects.toThrow(
			"transfer_accounts_identical",
		);
	});

	it("rejects non-positive or non-integer amounts", async () => {
		const service = createTransferService(mockAccounts(makeTwoAccounts()), mockTransfers(), mockEntries());

		await expect(service.postTransfer("hh-1", { ...baseInput, amountMinor: 0 }, NOW)).rejects.toThrow(
			"transfer_amount_not_positive",
		);
		await expect(service.postTransfer("hh-1", { ...baseInput, amountMinor: -5 }, NOW)).rejects.toThrow(
			"transfer_amount_not_positive",
		);
		await expect(service.postTransfer("hh-1", { ...baseInput, amountMinor: 10.5 }, NOW)).rejects.toThrow(
			"transfer_amount_not_positive",
		);
	});

	it("rejects posting against a closed or draft account", async () => {
		const closedSource = [account({ id: "acc-src", status: "closed" }), account({ id: "acc-dst" })];
		const service = createTransferService(mockAccounts(closedSource), mockTransfers(), mockEntries());
		await expect(service.postTransfer("hh-1", baseInput, NOW)).rejects.toThrow("account_closed");

		const draftDestination = [account({ id: "acc-src" }), account({ id: "acc-dst", status: "draft" })];
		const service2 = createTransferService(mockAccounts(draftDestination), mockTransfers(), mockEntries());
		await expect(service2.postTransfer("hh-1", baseInput, NOW)).rejects.toThrow("account_not_active");
	});

	it("rejects accounts from another household", async () => {
		const foreign = [account({ id: "acc-src", householdId: "hh-2" }), account({ id: "acc-dst" })];
		const service = createTransferService(mockAccounts(foreign), mockTransfers(), mockEntries());

		await expect(service.postTransfer("hh-1", baseInput, NOW)).rejects.toThrow("account_not_found");
	});

	it("rejects funding classifications at the plain transfer boundary", async () => {
		const service = createTransferService(mockAccounts(makeTwoAccounts()), mockTransfers(), mockEntries());

		await expect(
			service.postTransfer("hh-1", { ...baseInput, classification: "contribution" as never }, NOW),
		).rejects.toThrow("transfer_classification_not_allowed");
	});

	it("is idempotent for a replayed operation", async () => {
		const transfers = mockTransfers();
		const entries = mockEntries();
		const service = createTransferService(mockAccounts(makeTwoAccounts()), transfers, entries);

		const first = await service.postTransfer("hh-1", baseInput, NOW, "op-1");
		const replay = await service.postTransfer("hh-1", baseInput, NOW, "op-1");

		expect(replay.id).toBe(first.id);
		expect(entries.stored).toHaveLength(2);
		expect(transfers.stored).toHaveLength(1);
	});
});

describe("transferService.classifyTransfer", () => {
	it("moves an unclassified posted transfer to pure", async () => {
		const transfers = mockTransfers();
		const service = createTransferService(mockAccounts(makeTwoAccounts()), transfers, mockEntries());
		const posted = await service.postTransfer("hh-1", { ...baseInput, classification: "unclassified" }, NOW);

		await service.classifyTransfer("hh-1", posted.id, "pure");

		expect(transfers.updateClassification).toHaveBeenCalledWith(posted.id, "pure");
	});

	it("treats reclassifying to the same terminal meaning as an idempotent no-op", async () => {
		const transfers = mockTransfers();
		const service = createTransferService(mockAccounts(makeTwoAccounts()), transfers, mockEntries());
		const posted = await service.postTransfer("hh-1", baseInput, NOW);

		const result = await service.classifyTransfer("hh-1", posted.id, "pure");

		expect(result.classification).toBe("pure");
		expect(transfers.updateClassification).not.toHaveBeenCalled();
	});

	it("rejects reclassifying to a different terminal meaning", async () => {
		const transfers = mockTransfers();
		const service = createTransferService(mockAccounts(makeTwoAccounts()), transfers, mockEntries());
		const posted = await service.postTransfer("hh-1", { ...baseInput, classification: "unclassified" }, NOW);
		transfers.stored[0]!.classification = "distribution";

		await expect(service.classifyTransfer("hh-1", posted.id, "pure")).rejects.toThrow("transfer_already_classified");
	});
});

describe("transferService.reverseTransfer", () => {
	async function postedTransfer() {
		const transfers = mockTransfers();
		const entries = mockEntries();
		const service = createTransferService(mockAccounts(makeTwoAccounts()), transfers, entries);
		const original = await service.postTransfer("hh-1", baseInput, NOW);
		return { transfers, entries, service, original };
	}

	it("negates both account projections exactly and keeps history linked", async () => {
		const { transfers, entries, service, original } = await postedTransfer();

		const reversal = await service.reverseTransfer("hh-1", original.id, LATER, "op-2");

		expect(reversal.reversalOfId).toBe(original.id);
		expect(reversal.sourceAccountId).toBe(original.destinationAccountId);
		expect(reversal.destinationAccountId).toBe(original.sourceAccountId);
		expect(reversal.amountMinor).toBe(original.amountMinor);
		expect(reversal.orderingKey).toBe(original.orderingKey);
		expect(reversal.chainRootId).toBe(original.chainRootId);
		expect(reversal.recordedAt).toBe(LATER);
		expect(transfers.markReversed).toHaveBeenCalledWith(original.id, reversal.id);

		const chains = foldEntriesIntoChains(entries.stored.map((e) => ({ ...e, operationId: null }) as never));
		expect(chains).toHaveLength(1);
		expect(chains[0]!.netMinor).toBe(0);
	});

	it("rejects reversing an already-reversed transfer", async () => {
		const { service, original } = await postedTransfer();
		await service.reverseTransfer("hh-1", original.id, LATER);

		await expect(service.reverseTransfer("hh-1", original.id, LATER)).rejects.toThrow("transfer_already_reversed");
	});

	it("rejects reversing a funded transfer through the plain path", async () => {
		const transfers = mockTransfers();
		const service = createTransferService(mockAccounts(makeTwoAccounts()), transfers, mockEntries());
		const original = await service.postTransfer("hh-1", baseInput, NOW);
		transfers.stored[0]!.classification = "contribution";

		await expect(service.reverseTransfer("hh-1", original.id, LATER)).rejects.toThrow(
			"transfer_has_funding_classification",
		);
	});

	it("allows corrections against accounts that have since been closed", async () => {
		const list = makeTwoAccounts();
		const accounts = mockAccounts(list);
		const transfers = mockTransfers();
		const service = createTransferService(accounts, transfers, mockEntries());
		const original = await service.postTransfer("hh-1", baseInput, NOW);
		list[0]!.status = "closed";

		const reversal = await service.reverseTransfer("hh-1", original.id, LATER);

		expect(reversal.status).toBe("posted");
	});
});

describe("transferService.correctTransfer", () => {
	it("appends a reversal and a replacement that inherits the original ordering key", async () => {
		const transfers = mockTransfers();
		const entries = mockEntries();
		const service = createTransferService(mockAccounts(makeTwoAccounts()), transfers, entries);
		const original = await service.postTransfer("hh-1", baseInput, NOW);

		const { reversal, replacement } = await service.correctTransfer(
			"hh-1",
			original.id,
			{ amountMinor: 12000, effectiveAt: EFFECTIVE, description: "Traspaso corregido" },
			LATER,
			"op-3",
		);

		expect(reversal.reversalOfId).toBe(original.id);
		expect(replacement).not.toBeNull();
		expect(replacement!.replacesId).toBe(original.id);
		expect(replacement!.orderingKey).toBe(original.orderingKey);
		expect(replacement!.chainRootId).toBe(original.chainRootId);
		expect(replacement!.amountMinor).toBe(12000);

		const chains = foldEntriesIntoChains(entries.stored.map((e) => ({ ...e, operationId: null }) as never));
		expect(chains).toHaveLength(1);
		expect(chains[0]!.netMinor).toBe(0);
		const dstChains = foldEntriesIntoChains(
			entries.stored.filter((e) => e.accountId === "acc-dst").map((e) => ({ ...e, operationId: null }) as never),
		);
		expect(dstChains[0]!.netMinor).toBe(12000);
	});

	it("appends only a reversal when no replacement is supplied", async () => {
		const transfers = mockTransfers();
		const service = createTransferService(mockAccounts(makeTwoAccounts()), transfers, mockEntries());
		const original = await service.postTransfer("hh-1", baseInput, NOW);

		const { replacement } = await service.correctTransfer("hh-1", original.id, null, LATER);

		expect(replacement).toBeNull();
		expect(transfers.stored).toHaveLength(2);
	});
});

describe("transferService crash resume", () => {
	async function postedTransfer() {
		const transfers = mockTransfers();
		const entries = mockEntries();
		const service = createTransferService(mockAccounts(makeTwoAccounts()), transfers, entries);
		const original = await service.postTransfer("hh-1", baseInput, NOW);
		return { transfers, entries, service, original };
	}

	it("resumes a half-applied correction whose reversal never completed", async () => {
		const { transfers, service, original } = await postedTransfer();

		// Simulate a crashed first attempt: reversal rows exist under a failed
		// operation, and the original was already flipped visible.
		const crashedReversal = await insertReversalRows(
			{ accounts: mockAccounts(makeTwoAccounts()), transfers, entries: mockEntries() },
			original,
			NOW,
			"op-failed",
		);
		await transfers.markReversed(original.id, crashedReversal.id);
		transfers.pendingOperations.add("op-failed");

		const reversal = await service.reverseTransfer("hh-1", original.id, LATER, "op-retry");

		expect(reversal.id).not.toBe(crashedReversal.id);
		const updated = transfers.stored.find((t) => t.id === original.id)!;
		expect(updated.reversedById).toBe(reversal.id);
	});

	it("still rejects correcting a transfer whose reversal completed", async () => {
		const { service, original } = await postedTransfer();
		await service.reverseTransfer("hh-1", original.id, LATER);

		await expect(service.reverseTransfer("hh-1", original.id, LATER)).rejects.toThrow("transfer_already_reversed");
		await expect(service.correctTransfer("hh-1", original.id, null, LATER)).rejects.toThrow(
			"transfer_already_reversed",
		);
	});

	it("applies the visible reversed flip only after the reversal rows exist", async () => {
		const { transfers, entries, service, original } = await postedTransfer();

		await service.reverseTransfer("hh-1", original.id, LATER, "op-9");

		const createOrder = transfers.create.mock.invocationCallOrder[0]!;
		const flipOrder = transfers.markReversed.mock.invocationCallOrder[0]!;
		expect(vi.mocked(entries.appendMany).mock.invocationCallOrder[0]!).toBeLessThan(flipOrder);
		expect(createOrder).toBeLessThan(flipOrder);
	});

	it("never loads invisible transfers whose posting operation failed", async () => {
		const transfers = mockTransfers();
		const service = createTransferService(mockAccounts(makeTwoAccounts()), transfers, mockEntries());
		const original = await service.postTransfer("hh-1", baseInput, NOW, "op-1");
		transfers.pendingOperations.add("op-1");

		await expect(service.getTransfer("hh-1", original.id)).rejects.toThrow("transfer_not_found");
		await expect(service.correctTransfer("hh-1", original.id, null, LATER)).rejects.toThrow("transfer_not_found");
	});
});
