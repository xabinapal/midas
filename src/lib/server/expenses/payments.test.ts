import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountHolderRepository, AccountRepository } from "../accounts/repository";
import type {
	ExpenseRecord,
	ExpenseRepository,
	PaymentAccountEntryRecord,
	PaymentApplicationRecord,
	PaymentApplicationRepository,
	PaymentEntryRepository,
	PaymentRecord,
	PaymentRepository,
} from "./repository";
import { createPaymentService, type PaymentService } from "./payments";

const NOW = "2026-08-06T10:00:00.000Z";
const HOUSEHOLD = "household-1";
const USER = "user-1";

function expenseRecord(overrides: Partial<ExpenseRecord> = {}): ExpenseRecord {
	return {
		id: "expense-1",
		householdId: HOUSEHOLD,
		categoryId: "cat-1",
		reportingPeriodId: "period-1",
		description: "Factura de la luz",
		reference: "luz/2026-08",
		status: "posted",
		plannedAmountMinor: null,
		plannedVersion: 1,
		actualAmountMinor: 10000,
		accountingDate: "2026-08-05",
		dueDate: null,
		serviceStartDate: null,
		serviceEndDate: null,
		allocationMethod: "equal",
		accountHintId: null,
		templateId: null,
		scheduledDueDate: null,
		realizedByExpenseId: null,
		chainRootId: "expense-1",
		replacesId: null,
		reversedById: null,
		actorUserId: USER,
		operationId: null,
		createdAt: NOW,
		updatedAt: NOW,
		...overrides,
	};
}

interface Mocks {
	service: PaymentService;
	paymentStore: PaymentRecord[];
	entryStore: PaymentAccountEntryRecord[];
	applicationStore: PaymentApplicationRecord[];
	payments: PaymentRepository;
	entries: PaymentEntryRepository;
	applications: PaymentApplicationRepository;
}

function makeMocks(): Mocks {
	const paymentStore: PaymentRecord[] = [];
	const entryStore: PaymentAccountEntryRecord[] = [];
	const applicationStore: PaymentApplicationRecord[] = [];
	const expenseStore: ExpenseRecord[] = [
		expenseRecord(),
		expenseRecord({ id: "expense-2", reference: "luz/2026-08-2" }),
		expenseRecord({ id: "expense-draft", status: "draft", reference: null, actualAmountMinor: 5000 }),
		expenseRecord({
			id: "expense-matched",
			plannedAmountMinor: 4000,
			actualAmountMinor: null,
			realizedByExpenseId: "expense-1",
		}),
	];

	const payments: PaymentRepository = {
		create: vi.fn(async (input) => {
			paymentStore.push({ ...input });
		}),
		findById: vi.fn(async (id) => paymentStore.find((row) => row.id === id)),
		findVisibleById: vi.fn(async (id) => paymentStore.find((row) => row.id === id)),
		findByOperationId: vi.fn(async (operationId) => paymentStore.find((row) => row.operationId === operationId)),
		findReversalOf: vi.fn(async (paymentId) => paymentStore.find((row) => row.reversalOfId === paymentId)),
		findReplacement: vi.fn(async (replacesId) => paymentStore.find((row) => row.replacesId === replacesId)),
		listByAccount: vi.fn(async (accountId) => paymentStore.filter((row) => row.accountId === accountId)),
		listByHousehold: vi.fn(async (householdId) => paymentStore.filter((row) => row.householdId === householdId)),
		markReversed: vi.fn(async (id, reversedById) => {
			const row = paymentStore.find((entry) => entry.id === id);
			if (row) {
				row.status = "reversed";
				row.reversedById = reversedById;
			}
		}),
	};

	const entries: PaymentEntryRepository = {
		appendMany: vi.fn(async (rows) => {
			entryStore.push(...rows);
		}),
		findByAccount: vi.fn(async (accountId) => entryStore.filter((row) => row.accountId === accountId)),
		findByAccountAfter: vi.fn(async (accountId, orderingKey) =>
			entryStore.filter((row) => row.accountId === accountId && row.orderingKey > orderingKey),
		),
	};

	const applications: PaymentApplicationRepository = {
		create: vi.fn(async (input) => {
			applicationStore.push({ ...input });
		}),
		findById: vi.fn(async (id) => applicationStore.find((row) => row.id === id)),
		findActiveByExpense: vi.fn(async (expenseId) =>
			applicationStore.filter((row) => row.expenseId === expenseId && row.status === "active"),
		),
		findByExpense: vi.fn(async (expenseId) => applicationStore.filter((row) => row.expenseId === expenseId)),
		findActiveByPayment: vi.fn(async (paymentId) =>
			applicationStore.filter((row) => row.paymentId === paymentId && row.status === "active"),
		),
		findActiveByHousehold: vi.fn(async (householdId) =>
			applicationStore.filter((row) => row.householdId === householdId && row.status === "active"),
		),
		markReversed: vi.fn(async (id, reversedAt) => {
			// Mirrors the repository's status='active' guard: replayed reversals
			// do not move the reversed_at timestamp.
			const row = applicationStore.find((entry) => entry.id === id && entry.status === "active");
			if (row) {
				row.status = "reversed";
				row.reversedAt = reversedAt;
			}
		}),
	};

	const expenses: ExpenseRepository = {
		findVisibleById: vi.fn(async (id) => expenseStore.find((row) => row.id === id)),
		findById: vi.fn(async (id) => expenseStore.find((row) => row.id === id)),
	} as unknown as ExpenseRepository;

	const accounts = {
		findById: vi.fn(async (id: string) =>
			[
				{
					id: "account-personal",
					householdId: HOUSEHOLD,
					name: "Cuenta de Alex",
					classification: "personal" as const,
					status: "active" as const,
					currency: "EUR",
					createdAt: NOW,
					updatedAt: NOW,
				},
				{
					id: "account-shared",
					householdId: HOUSEHOLD,
					name: "Cuenta común",
					classification: "shared" as const,
					status: "active" as const,
					currency: "EUR",
					createdAt: NOW,
					updatedAt: NOW,
				},
				{
					id: "account-closed",
					householdId: HOUSEHOLD,
					name: "Cuenta antigua",
					classification: "personal" as const,
					status: "closed" as const,
					currency: "EUR",
					createdAt: NOW,
					updatedAt: NOW,
				},
				{
					id: "account-joint",
					householdId: HOUSEHOLD,
					name: "Cuenta compartida mal clasificada",
					classification: "personal" as const,
					status: "active" as const,
					currency: "EUR",
					createdAt: NOW,
					updatedAt: NOW,
				},
			].find((account) => account.id === id),
		),
	} as unknown as AccountRepository;

	const holders = {
		currentHolderMemberIds: vi.fn(async (accountId: string) => {
			if (accountId === "account-personal") return ["m-a"];
			if (accountId === "account-closed") return ["m-c"];
			if (accountId === "account-joint") return ["m-a", "m-b"];
			return ["m-a", "m-b"];
		}),
	} as unknown as AccountHolderRepository;

	const service = createPaymentService({ payments, entries, applications, expenses }, { accounts, holders });

	return { service, paymentStore, entryStore, applicationStore, payments, entries, applications };
}

describe("postPayment", () => {
	let mocks: Mocks;
	beforeEach(() => {
		mocks = makeMocks();
	});

	it("records the sole member owner as funder for personal accounts", async () => {
		const payment = await mocks.service.postPayment(
			HOUSEHOLD,
			{
				accountId: "account-personal",
				amountMinor: 10000,
				effectiveAt: "2026-08-05T00:00:00.000Z",
				description: "Iberdrola",
			},
			USER,
			NOW,
			"op-1",
		);
		expect(payment.fundingSource).toBe("member");
		expect(payment.funderMemberId).toBe("m-a");
	});

	it("debits the account exactly once", async () => {
		const payment = await mocks.service.postPayment(
			HOUSEHOLD,
			{
				accountId: "account-personal",
				amountMinor: 10000,
				effectiveAt: "2026-08-05T00:00:00.000Z",
				description: "Iberdrola",
			},
			USER,
			NOW,
			"op-1",
		);
		const accountEntries = await mocks.entries.findByAccount("account-personal");
		expect(accountEntries).toHaveLength(1);
		expect(accountEntries[0]!.amountMinor).toBe(-10000);
		expect(accountEntries[0]!.paymentId).toBe(payment.id);
	});

	it("records shared funding for shared accounts without inferring a member", async () => {
		const payment = await mocks.service.postPayment(
			HOUSEHOLD,
			{
				accountId: "account-shared",
				amountMinor: 5000,
				effectiveAt: "2026-08-05T00:00:00.000Z",
				description: "Compra común",
			},
			USER,
			NOW,
			"op-1",
		);
		expect(payment.fundingSource).toBe("shared");
		expect(payment.funderMemberId).toBeNull();
	});

	it("rejects payments from closed accounts", async () => {
		await expect(
			mocks.service.postPayment(
				HOUSEHOLD,
				{
					accountId: "account-closed",
					amountMinor: 5000,
					effectiveAt: "2026-08-05T00:00:00.000Z",
					description: "Iberdrola",
				},
				USER,
				NOW,
				"op-1",
			),
		).rejects.toThrowError("account_closed");
	});

	it("rejects non-positive amounts", async () => {
		await expect(
			mocks.service.postPayment(
				HOUSEHOLD,
				{ accountId: "account-shared", amountMinor: 0, effectiveAt: "2026-08-05T00:00:00.000Z", description: "X" },
				USER,
				NOW,
				"op-1",
			),
		).rejects.toThrowError("payment_amount_not_positive");
	});

	it("replays a retried posting by operation", async () => {
		const input = {
			accountId: "account-shared",
			amountMinor: 5000,
			effectiveAt: "2026-08-05T00:00:00.000Z",
			description: "Compra común",
		};
		const first = await mocks.service.postPayment(HOUSEHOLD, input, USER, NOW, "op-1");
		const second = await mocks.service.postPayment(HOUSEHOLD, input, USER, NOW, "op-1");
		expect(second.id).toBe(first.id);
		expect(mocks.paymentStore).toHaveLength(1);
		expect(mocks.entryStore).toHaveLength(1);
	});
});

describe("payment applications", () => {
	let mocks: Mocks;
	beforeEach(() => {
		mocks = makeMocks();
	});

	async function postSharedPayment(amountMinor: number): Promise<PaymentRecord> {
		return mocks.service.postPayment(
			HOUSEHOLD,
			{ accountId: "account-shared", amountMinor, effectiveAt: "2026-08-05T00:00:00.000Z", description: "Compra" },
			USER,
			NOW,
			"op-1",
		);
	}

	it("applies one payment to several expenses with a single account effect", async () => {
		const payment = await postSharedPayment(10000);
		const created = await mocks.service.applyPayment(
			HOUSEHOLD,
			payment.id,
			[
				{ expenseId: "expense-1", amountMinor: 6000 },
				{ expenseId: "expense-2", amountMinor: 4000 },
			],
			NOW,
			"op-2",
		);
		expect(created).toHaveLength(2);
		// Still exactly one account entry: applications move no money.
		expect(mocks.entryStore).toHaveLength(1);
	});

	it("rejects an application above the expense unpaid amount", async () => {
		const payment = await postSharedPayment(20000);
		await expect(
			mocks.service.applyPayment(HOUSEHOLD, payment.id, [{ expenseId: "expense-1", amountMinor: 10001 }], NOW, "op-2"),
		).rejects.toThrowError("application_exceeds_unpaid");
		expect(mocks.applicationStore).toHaveLength(0);
	});

	it("rejects applications to a satisfied (matched) expected expense", async () => {
		const payment = await postSharedPayment(5000);
		await expect(
			mocks.service.applyPayment(
				HOUSEHOLD,
				payment.id,
				[{ expenseId: "expense-matched", amountMinor: 1000 }],
				NOW,
				"op-2",
			),
		).rejects.toThrowError("expense_already_satisfied");
		expect(mocks.applicationStore).toHaveLength(0);
	});

	it("rejects applications above the payment unapplied value", async () => {
		const payment = await postSharedPayment(5000);
		await expect(
			mocks.service.applyPayment(
				HOUSEHOLD,
				payment.id,
				[
					{ expenseId: "expense-1", amountMinor: 4000 },
					{ expenseId: "expense-2", amountMinor: 4000 },
				],
				NOW,
				"op-2",
			),
		).rejects.toThrowError("application_exceeds_unapplied");
		expect(mocks.applicationStore).toHaveLength(0);
	});

	it("rejects applications to drafts, cancelled, or reversed expenses", async () => {
		const payment = await postSharedPayment(5000);
		await expect(
			mocks.service.applyPayment(
				HOUSEHOLD,
				payment.id,
				[{ expenseId: "expense-draft", amountMinor: 100 }],
				NOW,
				"op-2",
			),
		).rejects.toThrowError("expense_not_posted");
		expect(mocks.applicationStore).toHaveLength(0);
	});

	it("tracks unapplied value across sequential applications", async () => {
		const payment = await postSharedPayment(10000);
		await mocks.service.applyPayment(
			HOUSEHOLD,
			payment.id,
			[{ expenseId: "expense-1", amountMinor: 6000 }],
			NOW,
			"op-2",
		);
		const view = await mocks.service.getPaymentView(HOUSEHOLD, payment.id);
		expect(view.unappliedMinor).toBe(4000);
		await expect(
			mocks.service.applyPayment(HOUSEHOLD, payment.id, [{ expenseId: "expense-2", amountMinor: 4001 }], NOW, "op-3"),
		).rejects.toThrowError("application_exceeds_unapplied");
	});

	it("recalculates paid value when an application is reversed", async () => {
		const payment = await postSharedPayment(6000);
		const [application] = await mocks.service.applyPayment(
			HOUSEHOLD,
			payment.id,
			[{ expenseId: "expense-1", amountMinor: 6000 }],
			NOW,
			"op-2",
		);
		await mocks.service.reverseApplication(HOUSEHOLD, application!.id, NOW, "op-3");
		const active = await mocks.applications.findActiveByExpense("expense-1");
		expect(active).toHaveLength(0);
		// Reversal is idempotent.
		await mocks.service.reverseApplication(HOUSEHOLD, application!.id, NOW, "op-4");
		expect(mocks.applicationStore[0]!.status).toBe("reversed");
	});
});

describe("payment reversal and correction", () => {
	let mocks: Mocks;
	beforeEach(() => {
		mocks = makeMocks();
	});

	it("reverses the account effect and active applications", async () => {
		const payment = await mocks.service.postPayment(
			HOUSEHOLD,
			{
				accountId: "account-shared",
				amountMinor: 6000,
				effectiveAt: "2026-08-05T00:00:00.000Z",
				description: "Compra",
			},
			USER,
			NOW,
			"op-1",
		);
		await mocks.service.applyPayment(
			HOUSEHOLD,
			payment.id,
			[{ expenseId: "expense-1", amountMinor: 6000 }],
			NOW,
			"op-2",
		);
		const { reversal } = await mocks.service.correctPayment(HOUSEHOLD, payment.id, null, USER, NOW, "op-3");

		expect(reversal.reversalOfId).toBe(payment.id);
		expect(reversal.chainRootId).toBe(payment.chainRootId);
		expect(mocks.applicationStore[0]!.status).toBe("reversed");

		const entries = await mocks.entries.findByAccount("account-shared");
		expect(entries).toHaveLength(2);
		const chainNet = entries.reduce((sum, entry) => sum + entry.amountMinor, 0);
		expect(chainNet).toBe(0);
		// The reversal keeps the original effective ordering for restated reports.
		expect(entries[1]!.orderingKey).toBe(entries[0]!.orderingKey);
		expect(entries[1]!.effectiveAt).toBe(entries[0]!.effectiveAt);
	});

	it("posts a replacement payment inside the same chain", async () => {
		const payment = await mocks.service.postPayment(
			HOUSEHOLD,
			{
				accountId: "account-shared",
				amountMinor: 6000,
				effectiveAt: "2026-08-05T00:00:00.000Z",
				description: "Compra",
			},
			USER,
			NOW,
			"op-1",
		);
		const { reversal, replacement } = await mocks.service.correctPayment(
			HOUSEHOLD,
			payment.id,
			{
				accountId: "account-shared",
				amountMinor: 7500,
				effectiveAt: "2026-08-05T00:00:00.000Z",
				description: "Compra corregida",
			},
			USER,
			NOW,
			"op-2",
		);
		expect(reversal.status).toBe("posted");
		expect(replacement).not.toBeNull();
		expect(replacement!.replacesId).toBe(payment.id);
		expect(replacement!.chainRootId).toBe(payment.chainRootId);
		expect(mocks.paymentStore.find((row) => row.id === payment.id)!.status).toBe("reversed");
	});

	it("rejects correcting an effectively reversed payment", async () => {
		const payment = await mocks.service.postPayment(
			HOUSEHOLD,
			{
				accountId: "account-shared",
				amountMinor: 6000,
				effectiveAt: "2026-08-05T00:00:00.000Z",
				description: "Compra",
			},
			USER,
			NOW,
			"op-1",
		);
		await mocks.service.correctPayment(HOUSEHOLD, payment.id, null, USER, NOW, "op-2");
		await expect(mocks.service.correctPayment(HOUSEHOLD, payment.id, null, USER, NOW, "op-3")).rejects.toThrowError(
			"payment_already_reversed",
		);
	});

	it("heals a crashed correction by inserting fresh reversal rows", async () => {
		mocks.paymentStore.push({
			id: "payment-1",
			householdId: HOUSEHOLD,
			accountId: "account-shared",
			amountMinor: 6000,
			description: "Compra",
			effectiveAt: "2026-08-05T00:00:00.000Z",
			orderingKey: "2026-08-05T00:00:00.000Z#payment-1",
			recordedAt: NOW,
			fundingSource: "shared",
			funderMemberId: null,
			status: "posted",
			chainRootId: "payment-1",
			reversalOfId: null,
			replacesId: null,
			reversedById: null,
			actorUserId: USER,
			operationId: null,
			createdAt: NOW,
		});
		// Orphaned reversal rows from a crashed attempt: invisible forever
		// because their operation never completed.
		mocks.paymentStore.push({
			id: "reversal-orphan",
			householdId: HOUSEHOLD,
			accountId: "account-shared",
			amountMinor: 6000,
			description: "Compra",
			effectiveAt: "2026-08-05T00:00:00.000Z",
			orderingKey: "2026-08-05T00:00:00.000Z#payment-1",
			recordedAt: NOW,
			fundingSource: "shared",
			funderMemberId: null,
			status: "posted",
			chainRootId: "payment-1",
			reversalOfId: "payment-1",
			replacesId: null,
			reversedById: null,
			actorUserId: USER,
			operationId: "op-dead",
			createdAt: NOW,
		});
		(mocks.payments.findVisibleById as ReturnType<typeof vi.fn>).mockImplementation(async (id: string) =>
			mocks.paymentStore.find((row) => row.id === id && row.operationId !== "op-dead"),
		);

		const { reversal } = await mocks.service.correctPayment(HOUSEHOLD, "payment-1", null, USER, NOW, "op-2");

		expect(reversal.id).not.toBe("reversal-orphan");
		expect(reversal.operationId).toBe("op-2");
		expect(mocks.paymentStore.find((row) => row.id === "payment-1")!.reversedById).toBe(reversal.id);
		expect(mocks.entryStore.filter((entry) => entry.paymentId === reversal.id)).toHaveLength(1);
	});

	it("rejects a replacement whose funding source no longer resolves", async () => {
		const payment = await mocks.service.postPayment(
			HOUSEHOLD,
			{
				accountId: "account-shared",
				amountMinor: 6000,
				effectiveAt: "2026-08-05T00:00:00.000Z",
				description: "Compra",
			},
			USER,
			NOW,
			"op-1",
		);
		await expect(
			mocks.service.correctPayment(
				HOUSEHOLD,
				payment.id,
				{
					accountId: "account-joint",
					amountMinor: 6000,
					effectiveAt: "2026-08-05T00:00:00.000Z",
					description: "Compra",
				},
				USER,
				NOW,
				"op-2",
			),
		).rejects.toThrowError("payment_funder_not_found");
		// The rejected replacement leaves the posted payment untouched.
		expect(mocks.paymentStore.find((row) => row.id === payment.id)!.status).toBe("posted");
		expect(mocks.paymentStore).toHaveLength(1);
	});
});
