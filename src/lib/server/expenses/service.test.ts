import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountRepository } from "../accounts/repository";
import type { MemberRepository } from "../household/repository";
import type {
	ExpenseAllocationLineRecord,
	ExpenseAllocationParamRecord,
	ExpenseAllocationParamRepository,
	ExpenseAllocationRepository,
	ExpenseCategoryRecord,
	ExpenseCategoryRepository,
	ExpenseEvidenceRecord,
	ExpenseEvidenceRepository,
	ExpenseRecord,
	ExpenseRepository,
	PaymentApplicationRecord,
	PaymentApplicationRepository,
	ReportingPeriodRecord,
	ReportingPeriodRepository,
} from "./repository";
import { createExpenseService, type ExpenseService, type PostExpenseInput } from "./service";

const NOW = "2026-08-06T10:00:00.000Z";
const HOUSEHOLD = "household-1";
const USER = "user-1";

function categoryRecord(overrides: Partial<ExpenseCategoryRecord> = {}): ExpenseCategoryRecord {
	return {
		id: "cat-1",
		householdId: HOUSEHOLD,
		name: "Luz",
		slug: "luz",
		ordering: 0,
		isActive: true,
		createdAt: NOW,
		updatedAt: NOW,
		operationId: null,
		...overrides,
	};
}

function periodRecord(overrides: Partial<ReportingPeriodRecord> = {}): ReportingPeriodRecord {
	return {
		id: "period-1",
		householdId: HOUSEHOLD,
		slug: "2026-08",
		label: "Agosto 2026",
		startDate: "2026-08-01",
		endDate: "2026-09-01",
		kind: "standard",
		createdAt: NOW,
		operationId: null,
		...overrides,
	};
}

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
	categories: ExpenseCategoryRepository;
	periods: ReportingPeriodRepository;
	expenses: ExpenseRepository;
	allocations: ExpenseAllocationRepository;
	allocationParams: ExpenseAllocationParamRepository;
	applications: PaymentApplicationRepository;
	evidence: ExpenseEvidenceRepository;
	members: MemberRepository;
	accounts: AccountRepository;
	service: ExpenseService;
	expenseStore: ExpenseRecord[];
	allocationStore: ExpenseAllocationLineRecord[];
	paramStore: ExpenseAllocationParamRecord[];
	applicationStore: PaymentApplicationRecord[];
	evidenceStore: ExpenseEvidenceRecord[];
	categoryStore: ExpenseCategoryRecord[];
}

function makeMocks(): Mocks {
	const categoryStore: ExpenseCategoryRecord[] = [categoryRecord()];
	const periodStore: ReportingPeriodRecord[] = [periodRecord()];
	const expenseStore: ExpenseRecord[] = [];
	const allocationStore: ExpenseAllocationLineRecord[] = [];
	const paramStore: ExpenseAllocationParamRecord[] = [];
	const applicationStore: PaymentApplicationRecord[] = [];
	const evidenceStore: ExpenseEvidenceRecord[] = [];

	const categories: ExpenseCategoryRepository = {
		create: vi.fn(async (input, now) => {
			categoryStore.push({
				id: input.id,
				householdId: input.householdId,
				name: input.name,
				slug: input.slug,
				ordering: input.ordering,
				isActive: true,
				createdAt: now,
				updatedAt: now,
				operationId: input.operationId ?? null,
			});
		}),
		findById: vi.fn(async (id) => categoryStore.find((row) => row.id === id)),
		findBySlug: vi.fn(async (householdId, slug) =>
			categoryStore.find((row) => row.householdId === householdId && row.slug === slug),
		),
		findByHousehold: vi.fn(async (householdId) => categoryStore.filter((row) => row.householdId === householdId)),
		update: vi.fn(async (id, fields, now) => {
			const row = categoryStore.find((entry) => entry.id === id);
			if (row) Object.assign(row, fields, { updatedAt: now });
		}),
		setActive: vi.fn(async (id, isActive, now) => {
			const row = categoryStore.find((entry) => entry.id === id);
			if (row) {
				row.isActive = isActive;
				row.updatedAt = now;
			}
		}),
		hasExpenseReferences: vi.fn(async (id) => expenseStore.some((row) => row.categoryId === id)),
	};

	const periods: ReportingPeriodRepository = {
		create: vi.fn(async (input, now) => {
			periodStore.push({
				id: input.id,
				householdId: input.householdId,
				slug: input.slug,
				label: input.label,
				startDate: input.startDate,
				endDate: input.endDate,
				kind: input.kind,
				createdAt: now,
				operationId: input.operationId ?? null,
			});
		}),
		findById: vi.fn(async (id) => periodStore.find((row) => row.id === id)),
		findBySlug: vi.fn(async (householdId, slug) =>
			periodStore.find((row) => row.householdId === householdId && row.slug === slug),
		),
		findVisibleBySlug: vi.fn(async (householdId, slug) =>
			periodStore.find((row) => row.householdId === householdId && row.slug === slug),
		),
		findByHousehold: vi.fn(async (householdId) => periodStore.filter((row) => row.householdId === householdId)),
		reattributeOperation: vi.fn(async (id, operationId) => {
			const row = periodStore.find((entry) => entry.id === id);
			if (row) {
				row.operationId = operationId;
			}
		}),
	};

	const expenses: ExpenseRepository = {
		create: vi.fn(async (input) => {
			expenseStore.push({ ...input });
		}),
		findById: vi.fn(async (id) => expenseStore.find((row) => row.id === id)),
		findVisibleById: vi.fn(async (id) => expenseStore.find((row) => row.id === id)),
		findByOperationId: vi.fn(async (operationId) => expenseStore.find((row) => row.operationId === operationId)),
		listByPeriod: vi.fn(async (householdId, reportingPeriodId) =>
			expenseStore.filter((row) => row.householdId === householdId && row.reportingPeriodId === reportingPeriodId),
		),
		listByHousehold: vi.fn(async (householdId) => expenseStore.filter((row) => row.householdId === householdId)),
		listPostedByHousehold: vi.fn(async (householdId, limit = 200) =>
			expenseStore.filter((row) => row.householdId === householdId && row.status === "posted").slice(0, limit),
		),
		findReferencesLike: vi.fn(async (householdId, base) =>
			expenseStore
				.filter(
					(row) =>
						row.householdId === householdId &&
						row.reference !== null &&
						(row.reference === base || row.reference.startsWith(`${base}-`)),
				)
				.map((row) => row.reference as string),
		),
		findOccurrence: vi.fn(async (templateId, scheduledDueDate) =>
			expenseStore.find((row) => row.templateId === templateId && row.scheduledDueDate === scheduledDueDate),
		),
		findVisibleOccurrence: vi.fn(async (templateId, scheduledDueDate) =>
			expenseStore.find((row) => row.templateId === templateId && row.scheduledDueDate === scheduledDueDate),
		),
		findReplacement: vi.fn(async (replacesId) => expenseStore.find((row) => row.replacesId === replacesId)),
		findByRealizedBy: vi.fn(async (actualExpenseId) =>
			expenseStore.filter((row) => row.realizedByExpenseId === actualExpenseId),
		),
		reattributeOperation: vi.fn(async (id, operationId, now) => {
			const row = expenseStore.find((entry) => entry.id === id);
			if (row) {
				row.operationId = operationId;
				row.updatedAt = now;
			}
		}),
		updateDraft: vi.fn(async (id, fields, now) => {
			const row = expenseStore.find((entry) => entry.id === id);
			if (row) Object.assign(row, fields, { updatedAt: now });
		}),
		updateExpected: vi.fn(async (id, fields, now) => {
			const row = expenseStore.find((entry) => entry.id === id);
			if (row) Object.assign(row, fields, { updatedAt: now });
		}),
		markPosted: vi.fn(),
		markCancelled: vi.fn(async (id, now) => {
			const row = expenseStore.find((entry) => entry.id === id);
			if (row) {
				row.status = "cancelled";
				row.updatedAt = now;
			}
		}),
		markReversed: vi.fn(async (id, reversedById, now) => {
			const row = expenseStore.find((entry) => entry.id === id);
			if (row) {
				row.status = "reversed";
				row.reversedById = reversedById;
				row.updatedAt = now;
			}
		}),
		setActualAmount: vi.fn(async (id, actualAmountMinor, now) => {
			const row = expenseStore.find((entry) => entry.id === id);
			if (row) {
				row.actualAmountMinor = actualAmountMinor;
				row.updatedAt = now;
			}
		}),
		setRealizedBy: vi.fn(async (id, actualExpenseId, now) => {
			const row = expenseStore.find((entry) => entry.id === id);
			if (row) {
				row.realizedByExpenseId = actualExpenseId;
				row.updatedAt = now;
			}
		}),
		remove: vi.fn(async (id) => {
			const index = expenseStore.findIndex((entry) => entry.id === id);
			if (index >= 0) expenseStore.splice(index, 1);
		}),
	};

	const allocations: ExpenseAllocationRepository = {
		replaceLines: vi.fn(async (expenseId, basis, lines) => {
			for (let i = allocationStore.length - 1; i >= 0; i -= 1) {
				if (allocationStore[i]!.expenseId === expenseId && allocationStore[i]!.basis === basis) {
					allocationStore.splice(i, 1);
				}
			}
			for (const line of lines) {
				allocationStore.push({
					id: `alloc-${allocationStore.length}`,
					expenseId,
					memberId: line.memberId,
					basis,
					amountMinor: line.amountMinor,
				});
			}
		}),
		findByExpense: vi.fn(async (expenseId) => allocationStore.filter((row) => row.expenseId === expenseId)),
		findByExpenses: vi.fn(async (expenseIds) => allocationStore.filter((row) => expenseIds.includes(row.expenseId))),
		deleteByExpense: vi.fn(async (expenseId) => {
			for (let i = allocationStore.length - 1; i >= 0; i -= 1) {
				if (allocationStore[i]!.expenseId === expenseId) allocationStore.splice(i, 1);
			}
		}),
	};

	const allocationParams: ExpenseAllocationParamRepository = {
		replaceParams: vi.fn(async (expenseId, params) => {
			for (let i = paramStore.length - 1; i >= 0; i -= 1) {
				if (paramStore[i]!.expenseId === expenseId) paramStore.splice(i, 1);
			}
			for (const param of params) {
				paramStore.push({
					id: `param-${paramStore.length}`,
					expenseId,
					memberId: param.memberId,
					value: param.value,
				});
			}
		}),
		findByExpense: vi.fn(async (expenseId) => paramStore.filter((row) => row.expenseId === expenseId)),
		deleteByExpense: vi.fn(async (expenseId) => {
			for (let i = paramStore.length - 1; i >= 0; i -= 1) {
				if (paramStore[i]!.expenseId === expenseId) paramStore.splice(i, 1);
			}
		}),
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
			const row = applicationStore.find((entry) => entry.id === id);
			if (row) {
				row.status = "reversed";
				row.reversedAt = reversedAt;
			}
		}),
	};

	const evidence: ExpenseEvidenceRepository = {
		add: vi.fn(async (input) => {
			evidenceStore.push({ ...input });
		}),
		findById: vi.fn(async (id) => evidenceStore.find((row) => row.id === id)),
		findActiveByExpense: vi.fn(async (expenseId) =>
			evidenceStore.filter((row) => row.expenseId === expenseId && row.status === "active"),
		),
		deleteByExpense: vi.fn(async (expenseId) => {
			for (let i = evidenceStore.length - 1; i >= 0; i -= 1) {
				if (evidenceStore[i]!.expenseId === expenseId) evidenceStore.splice(i, 1);
			}
		}),
		markRemoved: vi.fn(async (id, removedAt) => {
			const row = evidenceStore.find((entry) => entry.id === id);
			if (row) {
				row.status = "removed";
				row.removedAt = removedAt;
			}
		}),
	};

	const members = {
		findByHousehold: vi.fn(async () => [
			{ id: "m-a", householdId: HOUSEHOLD, displayName: "Alex", isActive: true, defaultWeight: 1 },
			{ id: "m-b", householdId: HOUSEHOLD, displayName: "Sam", isActive: true, defaultWeight: 1 },
			{ id: "m-c", householdId: HOUSEHOLD, displayName: "Jordan", isActive: false, defaultWeight: 1 },
		]),
		findById: vi.fn(async (id: string) =>
			[
				{ id: "m-a", householdId: HOUSEHOLD, displayName: "Alex", isActive: true, defaultWeight: 1 },
				{ id: "m-b", householdId: HOUSEHOLD, displayName: "Sam", isActive: true, defaultWeight: 1 },
				{ id: "m-c", householdId: HOUSEHOLD, displayName: "Jordan", isActive: false, defaultWeight: 1 },
			].find((member) => member.id === id),
		),
	} as unknown as MemberRepository;

	const accounts = {
		findById: vi.fn(async () => undefined),
	} as unknown as AccountRepository;

	const service = createExpenseService(
		{ categories, periods, expenses, allocations, allocationParams, applications, evidence },
		{ members, accounts },
	);

	return {
		categories,
		periods,
		expenses,
		allocations,
		allocationParams,
		applications,
		evidence,
		members,
		accounts,
		service,
		expenseStore,
		allocationStore,
		paramStore,
		applicationStore,
		evidenceStore,
		categoryStore,
	};
}

function baseInput(overrides: Partial<PostExpenseInput> = {}): PostExpenseInput {
	return {
		categoryId: "cat-1",
		reportingPeriodId: "period-1",
		description: "Factura de la luz",
		actualAmountMinor: 10000,
		accountingDate: "2026-08-05",
		allocation: { method: "equal", members: [{ memberId: "m-a" }, { memberId: "m-b" }] },
		...overrides,
	};
}

describe("category lifecycle", () => {
	let mocks: Mocks;
	beforeEach(() => {
		mocks = makeMocks();
	});

	it("creates a category with a stable slug", async () => {
		const category = await mocks.service.createCategory(HOUSEHOLD, { name: "Comunicación móvil" }, NOW, "op-1");
		expect(category.slug).toBe("comunicacion-movil");
		expect(category.isActive).toBe(true);
	});

	it("rejects a duplicate active display name", async () => {
		await expect(mocks.service.createCategory(HOUSEHOLD, { name: "luz" }, NOW, "op-1")).rejects.toThrowError(
			"category_name_taken",
		);
	});

	it("deactivates a referenced category instead of deleting it", async () => {
		mocks.expenseStore.push(expenseRecord());
		const deactivated = await mocks.service.deactivateCategory(HOUSEHOLD, "cat-1", NOW, "op-1");
		expect(deactivated.isActive).toBe(false);
		// Historical expense display still resolves the category.
		expect(mocks.categoryStore.find((row) => row.id === "cat-1")).toBeDefined();
	});

	it("rejects posting into an inactive category", async () => {
		mocks.categoryStore[0]!.isActive = false;
		await expect(mocks.service.postExpense(HOUSEHOLD, baseInput(), USER, NOW, "op-1")).rejects.toThrowError(
			"category_inactive",
		);
	});

	it("reactivates a deactivated category", async () => {
		mocks.categoryStore[0]!.isActive = false;
		const reactivated = await mocks.service.reactivateCategory(HOUSEHOLD, "cat-1", NOW, "op-1");
		expect(reactivated.isActive).toBe(true);
	});

	it("recreating a deactivated category's slug reactivates it instead of trapping the name", async () => {
		mocks.categoryStore[0]!.isActive = false;
		const recreated = await mocks.service.createCategory(HOUSEHOLD, { name: "LUZ" }, NOW, "op-1");
		expect(recreated.id).toBe("cat-1");
		expect(recreated.isActive).toBe(true);
		expect(mocks.categoryStore).toHaveLength(1);
	});

	it("rejects creating a slug owned by an active category", async () => {
		await expect(mocks.service.createCategory(HOUSEHOLD, { name: "LUZ" }, NOW, "op-1")).rejects.toThrowError(
			"category_name_taken",
		);
	});
});

describe("postExpense", () => {
	let mocks: Mocks;
	beforeEach(() => {
		mocks = makeMocks();
	});

	it("posts an unpaid actual expense with resolved allocations", async () => {
		const expense = await mocks.service.postExpense(HOUSEHOLD, baseInput(), USER, NOW, "op-1");
		expect(expense.status).toBe("posted");
		expect(expense.reference).toBe("luz/2026-08");
		const lines = await mocks.allocations.findByExpense(expense.id);
		expect(lines.reduce((sum, line) => sum + line.amountMinor, 0)).toBe(10000);
		expect(lines.map((line) => line.basis)).toEqual(["actual", "actual"]);
	});

	it("replays a retried posting by operation", async () => {
		const first = await mocks.service.postExpense(HOUSEHOLD, baseInput(), USER, NOW, "op-1");
		const second = await mocks.service.postExpense(HOUSEHOLD, baseInput(), USER, NOW, "op-1");
		expect(second.id).toBe(first.id);
		expect(mocks.expenseStore).toHaveLength(1);
	});

	it("appends a deterministic collision suffix to references", async () => {
		mocks.expenseStore.push(expenseRecord());
		const second = await mocks.service.postExpense(HOUSEHOLD, baseInput(), USER, NOW, "op-1");
		expect(second.reference).toBe("luz/2026-08-2");
	});

	it("rejects an unbalanced fixed allocation", async () => {
		await expect(
			mocks.service.postExpense(
				HOUSEHOLD,
				baseInput({
					allocation: {
						method: "fixed",
						members: [
							{ memberId: "m-a", fixedAmountMinor: 6000 },
							{ memberId: "m-b", fixedAmountMinor: 3000 },
						],
					},
				}),
				USER,
				NOW,
				"op-1",
			),
		).rejects.toThrowError("allocation_fixed_unbalanced");
	});

	it("rejects inactive members in the allocation subset", async () => {
		await expect(
			mocks.service.postExpense(
				HOUSEHOLD,
				baseInput({ allocation: { method: "equal", members: [{ memberId: "m-c" }] } }),
				USER,
				NOW,
				"op-1",
			),
		).rejects.toThrowError("allocation_member_not_active");
	});

	it("rejects an invalid service span", async () => {
		await expect(
			mocks.service.postExpense(
				HOUSEHOLD,
				baseInput({ serviceStartDate: "2026-09-01", serviceEndDate: "2026-08-01" }),
				USER,
				NOW,
				"op-1",
			),
		).rejects.toThrowError("service_span_invalid");
	});

	it("creates drafts without a reference", async () => {
		const draft = await mocks.service.postExpense(HOUSEHOLD, baseInput({ draft: true }), USER, NOW, "op-1");
		expect(draft.status).toBe("draft");
		expect(draft.reference).toBeNull();
	});
});

describe("draft and expected editing", () => {
	let mocks: Mocks;
	beforeEach(() => {
		mocks = makeMocks();
	});

	it("edits and deletes drafts", async () => {
		mocks.expenseStore.push(expenseRecord({ id: "draft-1", status: "draft", reference: null }));
		await mocks.service.editDraftExpense(
			HOUSEHOLD,
			"draft-1",
			baseInput({ description: "Actualizada", actualAmountMinor: 5000 }),
			NOW,
			"op-1",
		);
		expect(mocks.expenseStore[0]!.description).toBe("Actualizada");
		await mocks.service.deleteDraftExpense(HOUSEHOLD, "draft-1", NOW, "op-2");
		expect(mocks.expenseStore).toHaveLength(0);
	});

	it("rejects editing a posted expense as a draft", async () => {
		mocks.expenseStore.push(expenseRecord());
		await expect(mocks.service.editDraftExpense(HOUSEHOLD, "expense-1", baseInput(), NOW, "op-1")).rejects.toThrowError(
			"expense_not_draft",
		);
	});

	it("edits an unpaid expected occurrence with a version bump", async () => {
		mocks.expenseStore.push(expenseRecord({ plannedAmountMinor: 8000, actualAmountMinor: null, plannedVersion: 1 }));
		mocks.paramStore.push(
			{ id: "p-1", expenseId: "expense-1", memberId: "m-a", value: null },
			{ id: "p-2", expenseId: "expense-1", memberId: "m-b", value: null },
		);
		const updated = await mocks.service.editExpectedExpense(
			HOUSEHOLD,
			"expense-1",
			{ plannedAmountMinor: 9000 },
			NOW,
			"op-1",
		);
		expect(updated.plannedAmountMinor).toBe(9000);
		expect(updated.plannedVersion).toBe(2);
	});

	it("rejects editing an expected occurrence that has payments", async () => {
		mocks.expenseStore.push(expenseRecord({ plannedAmountMinor: 8000, actualAmountMinor: null }));
		mocks.applicationStore.push({
			id: "app-1",
			householdId: HOUSEHOLD,
			paymentId: "payment-1",
			expenseId: "expense-1",
			amountMinor: 1000,
			status: "active",
			recordedAt: NOW,
			reversedAt: null,
			operationId: null,
		});
		await expect(
			mocks.service.editExpectedExpense(HOUSEHOLD, "expense-1", { plannedAmountMinor: 9000 }, NOW, "op-1"),
		).rejects.toThrowError("expense_not_editable");
	});

	it("cancels an unpaid expected occurrence", async () => {
		mocks.expenseStore.push(expenseRecord({ plannedAmountMinor: 8000, actualAmountMinor: null }));
		const cancelled = await mocks.service.cancelExpectedExpense(HOUSEHOLD, "expense-1", NOW, "op-1");
		expect(cancelled.status).toBe("cancelled");
	});

	it("rejects cancelling an actual expense", async () => {
		mocks.expenseStore.push(expenseRecord());
		await expect(mocks.service.cancelExpectedExpense(HOUSEHOLD, "expense-1", NOW, "op-1")).rejects.toThrowError(
			"expense_not_cancellable",
		);
	});

	it("edits a default-weight expected expense using current household weights", async () => {
		mocks.expenseStore.push(
			expenseRecord({ plannedAmountMinor: 8000, actualAmountMinor: null, allocationMethod: "default_weight" }),
		);
		mocks.paramStore.push(
			{ id: "p-1", expenseId: "expense-1", memberId: "m-a", value: null },
			{ id: "p-2", expenseId: "expense-1", memberId: "m-b", value: null },
		);
		const updated = await mocks.service.editExpectedExpense(
			HOUSEHOLD,
			"expense-1",
			{ dueDate: "2026-08-20" },
			NOW,
			"op-1",
		);
		expect(updated.dueDate).toBe("2026-08-20");
		const lines = (await mocks.allocations.findByExpense("expense-1")).filter((line) => line.basis === "planned");
		expect(lines.reduce((sum, line) => sum + line.amountMinor, 0)).toBe(8000);
	});

	it("edits a fixed-allocation expected expense without touching the split", async () => {
		mocks.expenseStore.push(
			expenseRecord({ plannedAmountMinor: 8000, actualAmountMinor: null, allocationMethod: "fixed" }),
		);
		mocks.paramStore.push(
			{ id: "p-1", expenseId: "expense-1", memberId: "m-a", value: 5000 },
			{ id: "p-2", expenseId: "expense-1", memberId: "m-b", value: 3000 },
		);
		const updated = await mocks.service.editExpectedExpense(
			HOUSEHOLD,
			"expense-1",
			{ dueDate: "2026-08-20" },
			NOW,
			"op-1",
		);
		expect(updated.dueDate).toBe("2026-08-20");
		const lines = (await mocks.allocations.findByExpense("expense-1")).filter((line) => line.basis === "planned");
		expect(lines.map((line) => [line.memberId, line.amountMinor])).toEqual([
			["m-a", 5000],
			["m-b", 3000],
		]);
	});

	it("rejects a whitespace-only description", async () => {
		mocks.expenseStore.push(expenseRecord({ plannedAmountMinor: 8000, actualAmountMinor: null }));
		mocks.paramStore.push({ id: "p-1", expenseId: "expense-1", memberId: "m-a", value: null });
		await expect(
			mocks.service.editExpectedExpense(HOUSEHOLD, "expense-1", { description: "   " }, NOW, "op-1"),
		).rejects.toThrowError("expense_description_required");
	});
});

describe("estimate actualization", () => {
	let mocks: Mocks;
	beforeEach(() => {
		mocks = makeMocks();
	});

	it("freezes the planned baseline and stores actual allocations", async () => {
		mocks.expenseStore.push(
			expenseRecord({ plannedAmountMinor: 8000, actualAmountMinor: null, allocationMethod: "equal" }),
		);
		mocks.paramStore.push(
			{ id: "p-1", expenseId: "expense-1", memberId: "m-a", value: null },
			{ id: "p-2", expenseId: "expense-1", memberId: "m-b", value: null },
		);
		const actual = await mocks.service.actualizeExpense(
			HOUSEHOLD,
			"expense-1",
			{ actualAmountMinor: 9100 },
			NOW,
			"op-1",
		);
		expect(actual.plannedAmountMinor).toBe(8000);
		expect(actual.actualAmountMinor).toBe(9100);
		const lines = await mocks.allocations.findByExpense("expense-1");
		const actualLines = lines.filter((line) => line.basis === "actual");
		expect(actualLines.reduce((sum, line) => sum + line.amountMinor, 0)).toBe(9100);
	});

	it("preserves identity and reference through actualization", async () => {
		mocks.expenseStore.push(expenseRecord({ plannedAmountMinor: 8000, actualAmountMinor: null }));
		mocks.paramStore.push(
			{ id: "p-1", expenseId: "expense-1", memberId: "m-a", value: null },
			{ id: "p-2", expenseId: "expense-1", memberId: "m-b", value: null },
		);
		const actual = await mocks.service.actualizeExpense(
			HOUSEHOLD,
			"expense-1",
			{ actualAmountMinor: 9100 },
			NOW,
			"op-1",
		);
		expect(actual.id).toBe("expense-1");
		expect(actual.reference).toBe("luz/2026-08");
	});

	it("rejects actualization when a payment is applied", async () => {
		mocks.expenseStore.push(expenseRecord({ plannedAmountMinor: 8000, actualAmountMinor: null }));
		mocks.applicationStore.push({
			id: "app-1",
			householdId: HOUSEHOLD,
			paymentId: "payment-1",
			expenseId: "expense-1",
			amountMinor: 4000,
			status: "active",
			recordedAt: NOW,
			reversedAt: null,
			operationId: null,
		});
		await expect(
			mocks.service.actualizeExpense(HOUSEHOLD, "expense-1", { actualAmountMinor: 9100 }, NOW, "op-1"),
		).rejects.toThrowError("expense_has_payments");
	});

	it("rejects actualizing an already actual expense", async () => {
		mocks.expenseStore.push(expenseRecord());
		await expect(
			mocks.service.actualizeExpense(HOUSEHOLD, "expense-1", { actualAmountMinor: 9100 }, NOW, "op-1"),
		).rejects.toThrowError("expense_not_actualizable");
	});

	it("actualizes a default-weight estimate with current weights", async () => {
		mocks.expenseStore.push(
			expenseRecord({ plannedAmountMinor: 8000, actualAmountMinor: null, allocationMethod: "default_weight" }),
		);
		mocks.paramStore.push(
			{ id: "p-1", expenseId: "expense-1", memberId: "m-a", value: null },
			{ id: "p-2", expenseId: "expense-1", memberId: "m-b", value: null },
		);
		const actual = await mocks.service.actualizeExpense(
			HOUSEHOLD,
			"expense-1",
			{ actualAmountMinor: 9000 },
			NOW,
			"op-1",
		);
		expect(actual.actualAmountMinor).toBe(9000);
		const lines = (await mocks.allocations.findByExpense("expense-1")).filter((line) => line.basis === "actual");
		expect(lines.reduce((sum, line) => sum + line.amountMinor, 0)).toBe(9000);
	});

	it("actualizes a fixed-allocation estimate keeping the stored split", async () => {
		mocks.expenseStore.push(
			expenseRecord({ plannedAmountMinor: 8000, actualAmountMinor: null, allocationMethod: "fixed" }),
		);
		mocks.paramStore.push(
			{ id: "p-1", expenseId: "expense-1", memberId: "m-a", value: 5000 },
			{ id: "p-2", expenseId: "expense-1", memberId: "m-b", value: 3000 },
		);
		const actual = await mocks.service.actualizeExpense(
			HOUSEHOLD,
			"expense-1",
			{ actualAmountMinor: 8000 },
			NOW,
			"op-1",
		);
		expect(actual.actualAmountMinor).toBe(8000);
	});
});

describe("expected versus actual matching", () => {
	let mocks: Mocks;
	beforeEach(() => {
		mocks = makeMocks();
	});

	it("links a separate actual expense to one expected occurrence", async () => {
		mocks.expenseStore.push(
			expenseRecord({ id: "expected-1", plannedAmountMinor: 8000, actualAmountMinor: null, reference: "luz/2026-08" }),
			expenseRecord({ id: "actual-1", reference: "luz/2026-08-2" }),
		);
		const linked = await mocks.service.linkActualExpense(HOUSEHOLD, "expected-1", "actual-1", NOW, "op-1");
		expect(linked.realizedByExpenseId).toBe("actual-1");
		expect(linked.plannedAmountMinor).toBe(8000);
	});

	it("rejects matching an already matched occurrence", async () => {
		mocks.expenseStore.push(
			expenseRecord({
				id: "expected-1",
				plannedAmountMinor: 8000,
				actualAmountMinor: null,
				realizedByExpenseId: "actual-0",
			}),
			expenseRecord({ id: "actual-1" }),
		);
		await expect(
			mocks.service.linkActualExpense(HOUSEHOLD, "expected-1", "actual-1", NOW, "op-1"),
		).rejects.toThrowError("expense_not_matchable");
	});

	it("rejects matching with an estimated expense", async () => {
		mocks.expenseStore.push(
			expenseRecord({ id: "expected-1", plannedAmountMinor: 8000, actualAmountMinor: null }),
			expenseRecord({ id: "expected-2", plannedAmountMinor: 3000, actualAmountMinor: null }),
		);
		await expect(
			mocks.service.linkActualExpense(HOUSEHOLD, "expected-1", "expected-2", NOW, "op-1"),
		).rejects.toThrowError("expense_not_actual");
	});

	it("rejects matching with an actualized occurrence (one realization, one plan)", async () => {
		mocks.expenseStore.push(
			expenseRecord({ id: "expected-1", plannedAmountMinor: 8000, actualAmountMinor: null }),
			expenseRecord({ id: "actualized-1", plannedAmountMinor: 4000, actualAmountMinor: 4350 }),
		);
		await expect(
			mocks.service.linkActualExpense(HOUSEHOLD, "expected-1", "actualized-1", NOW, "op-1"),
		).rejects.toThrowError("expense_not_actual");
	});

	it("ignores reversed matchers when checking double matching", async () => {
		mocks.expenseStore.push(
			expenseRecord({
				id: "expected-old",
				plannedAmountMinor: 8000,
				actualAmountMinor: null,
				status: "reversed",
				realizedByExpenseId: "actual-1",
			}),
			expenseRecord({ id: "expected-1", plannedAmountMinor: 8000, actualAmountMinor: null }),
			expenseRecord({ id: "actual-1" }),
		);
		const linked = await mocks.service.linkActualExpense(HOUSEHOLD, "expected-1", "actual-1", NOW, "op-1");
		expect(linked.realizedByExpenseId).toBe("actual-1");
	});

	it("unlinks a matched occurrence so it becomes editable again", async () => {
		mocks.expenseStore.push(
			expenseRecord({
				id: "expected-1",
				plannedAmountMinor: 8000,
				actualAmountMinor: null,
				realizedByExpenseId: "actual-1",
			}),
		);
		const unlinked = await mocks.service.unlinkActualExpense(HOUSEHOLD, "expected-1", NOW, "op-1");
		expect(unlinked.realizedByExpenseId).toBeNull();
		mocks.paramStore.push({ id: "p-1", expenseId: "expected-1", memberId: "m-a", value: null });
		const edited = await mocks.service.editExpectedExpense(
			HOUSEHOLD,
			"expected-1",
			{ plannedAmountMinor: 9000 },
			NOW,
			"op-2",
		);
		expect(edited.plannedAmountMinor).toBe(9000);
	});

	it("rejects unlinking an unmatched occurrence", async () => {
		mocks.expenseStore.push(expenseRecord({ id: "expected-1", plannedAmountMinor: 8000, actualAmountMinor: null }));
		await expect(mocks.service.unlinkActualExpense(HOUSEHOLD, "expected-1", NOW, "op-1")).rejects.toThrowError(
			"expense_not_unlinkable",
		);
	});
});

describe("evidence references", () => {
	let mocks: Mocks;
	beforeEach(() => {
		mocks = makeMocks();
	});

	it("attaches a safe HTTPS reference", async () => {
		mocks.expenseStore.push(expenseRecord());
		const record = await mocks.service.addEvidence(
			HOUSEHOLD,
			"expense-1",
			{ label: "Factura de agosto", url: "https://facturas.example.com/2026/08/luz.pdf", note: null },
			USER,
			NOW,
			"op-1",
		);
		expect(record.status).toBe("active");
		expect(record.url).toBe("https://facturas.example.com/2026/08/luz.pdf");
	});

	it("rejects unsafe URLs", async () => {
		mocks.expenseStore.push(expenseRecord());
		await expect(
			mocks.service.addEvidence(
				HOUSEHOLD,
				"expense-1",
				{ label: "Factura", url: "https://user:pass@facturas.example.com/luz.pdf", note: null },
				USER,
				NOW,
				"op-1",
			),
		).rejects.toThrowError("evidence_url_not_allowed");
	});

	it("marks a removed reference instead of erasing it", async () => {
		mocks.expenseStore.push(expenseRecord());
		mocks.evidenceStore.push({
			id: "ev-1",
			expenseId: "expense-1",
			householdId: HOUSEHOLD,
			label: "Factura",
			url: "https://facturas.example.com/luz.pdf",
			note: null,
			status: "active",
			createdBy: USER,
			createdAt: NOW,
			removedAt: null,
			operationId: null,
		});
		await mocks.service.removeEvidence(HOUSEHOLD, "ev-1", NOW, "op-1");
		expect(mocks.evidenceStore[0]!.status).toBe("removed");
		expect(mocks.evidenceStore[0]!.removedAt).toBe(NOW);
	});
});

describe("expense correction", () => {
	let mocks: Mocks;
	beforeEach(() => {
		mocks = makeMocks();
	});

	it("reverses applications and the original before posting a replacement", async () => {
		mocks.expenseStore.push(expenseRecord());
		mocks.applicationStore.push({
			id: "app-1",
			householdId: HOUSEHOLD,
			paymentId: "payment-1",
			expenseId: "expense-1",
			amountMinor: 10000,
			status: "active",
			recordedAt: NOW,
			reversedAt: null,
			operationId: null,
		});
		const { reversal, replacement } = await mocks.service.correctExpense(
			HOUSEHOLD,
			"expense-1",
			baseInput({ actualAmountMinor: 12000 }),
			USER,
			NOW,
			"op-1",
		);
		expect(reversal.status).toBe("reversed");
		expect(replacement).not.toBeNull();
		expect(replacement!.replacesId).toBe("expense-1");
		expect(replacement!.chainRootId).toBe("expense-1");
		expect(mocks.applicationStore[0]!.status).toBe("reversed");
	});

	it("keeps the original reference on the replacement", async () => {
		mocks.expenseStore.push(expenseRecord());
		const { replacement } = await mocks.service.correctExpense(
			HOUSEHOLD,
			"expense-1",
			baseInput({ actualAmountMinor: 12000 }),
			USER,
			NOW,
			"op-1",
		);
		expect(replacement!.reference).toBe("luz/2026-08");
	});

	it("supports reversal without replacement", async () => {
		mocks.expenseStore.push(expenseRecord());
		const { reversal, replacement } = await mocks.service.correctExpense(
			HOUSEHOLD,
			"expense-1",
			null,
			USER,
			NOW,
			"op-1",
		);
		expect(reversal.status).toBe("reversed");
		expect(replacement).toBeNull();
	});

	it("resumes a half-applied correction", async () => {
		mocks.expenseStore.push(expenseRecord({ status: "reversed", reversedById: null }));
		const { reversal, replacement } = await mocks.service.correctExpense(
			HOUSEHOLD,
			"expense-1",
			baseInput({ actualAmountMinor: 12000 }),
			USER,
			NOW,
			"op-1",
		);
		expect(reversal.id).toBe("expense-1");
		expect(replacement).not.toBeNull();
	});

	it("rejects correcting an already corrected expense", async () => {
		mocks.expenseStore.push(
			expenseRecord({ status: "reversed", reversedById: "replacement-1" }),
			expenseRecord({ id: "replacement-1", replacesId: "expense-1", chainRootId: "expense-1" }),
		);
		await expect(mocks.service.correctExpense(HOUSEHOLD, "expense-1", null, USER, NOW, "op-1")).rejects.toThrowError(
			"expense_already_reversed",
		);
	});

	it("rejects correcting a plain unpaid expected expense (cancel instead)", async () => {
		mocks.expenseStore.push(expenseRecord({ plannedAmountMinor: 8000, actualAmountMinor: null }));
		await expect(mocks.service.correctExpense(HOUSEHOLD, "expense-1", null, USER, NOW, "op-1")).rejects.toThrowError(
			"expense_not_correctable",
		);
	});

	it("keeps the frozen planned baseline when correcting an actualized expense", async () => {
		mocks.expenseStore.push(expenseRecord({ plannedAmountMinor: 8000, actualAmountMinor: 9100, plannedVersion: 3 }));
		mocks.allocationStore.push(
			{ id: "al-1", expenseId: "expense-1", memberId: "m-a", basis: "planned", amountMinor: 4000 },
			{ id: "al-2", expenseId: "expense-1", memberId: "m-b", basis: "planned", amountMinor: 4000 },
			{ id: "al-3", expenseId: "expense-1", memberId: "m-a", basis: "actual", amountMinor: 4550 },
			{ id: "al-4", expenseId: "expense-1", memberId: "m-b", basis: "actual", amountMinor: 4550 },
		);
		mocks.paramStore.push(
			{ id: "p-1", expenseId: "expense-1", memberId: "m-a", value: null },
			{ id: "p-2", expenseId: "expense-1", memberId: "m-b", value: null },
		);
		const { replacement } = await mocks.service.correctExpense(
			HOUSEHOLD,
			"expense-1",
			baseInput({ plannedAmountMinor: 8000, actualAmountMinor: 9500 }),
			USER,
			NOW,
			"op-1",
		);
		expect(replacement).not.toBeNull();
		expect(replacement!.plannedAmountMinor).toBe(8000);
		expect(replacement!.actualAmountMinor).toBe(9500);
		expect(replacement!.plannedVersion).toBe(3);
		const lines = await mocks.allocations.findByExpense(replacement!.id);
		const plannedLines = lines.filter((line) => line.basis === "planned");
		expect(plannedLines.reduce((sum, line) => sum + line.amountMinor, 0)).toBe(8000);
		const actualLines = lines.filter((line) => line.basis === "actual");
		expect(actualLines.reduce((sum, line) => sum + line.amountMinor, 0)).toBe(9500);
	});

	it("releases the expected↔actual match when either side is corrected", async () => {
		mocks.expenseStore.push(
			expenseRecord({ id: "actual-1" }),
			expenseRecord({
				id: "expected-1",
				plannedAmountMinor: 8000,
				actualAmountMinor: null,
				realizedByExpenseId: "actual-1",
			}),
		);
		await mocks.service.correctExpense(HOUSEHOLD, "actual-1", null, USER, NOW, "op-1");
		const expected = mocks.expenseStore.find((row) => row.id === "expected-1")!;
		expect(expected.realizedByExpenseId).toBeNull();
	});

	it("reattributes a crashed attempt's invisible replacement on resume", async () => {
		mocks.expenseStore.push(
			expenseRecord({ status: "reversed", reversedById: "replacement-1" }),
			expenseRecord({ id: "replacement-1", replacesId: "expense-1", chainRootId: "expense-1", operationId: "op-dead" }),
		);
		// The replacement is invisible: the mock's findVisibleById hides rows
		// bound to the dead operation.
		(mocks.expenses.findVisibleById as ReturnType<typeof vi.fn>).mockImplementation(async (id: string) =>
			mocks.expenseStore.find((row) => row.id === id && row.operationId !== "op-dead"),
		);
		const { replacement } = await mocks.service.correctExpense(
			HOUSEHOLD,
			"expense-1",
			baseInput({ actualAmountMinor: 12000 }),
			USER,
			NOW,
			"op-new",
		);
		expect(replacement!.id).toBe("replacement-1");
		expect(replacement!.operationId).toBe("op-new");
		expect(mocks.expenseStore.find((row) => row.id === "replacement-1")!.operationId).toBe("op-new");
	});
});

describe("occurrence insertion (real port)", () => {
	it("inserts a default-weight occurrence resolving generation-time weights", async () => {
		const mocks = makeMocks();
		const occurrence = await mocks.service.insertOccurrence(
			HOUSEHOLD,
			{
				categoryId: "cat-1",
				reportingPeriodId: "period-1",
				description: "Seguro del hogar",
				plannedAmountMinor: 120000,
				accountingDate: "2026-08-15",
				dueDate: "2026-08-15",
				serviceStartDate: null,
				serviceEndDate: null,
				accountHintId: null,
				allocationMethod: "default_weight",
				allocationParams: [
					{ memberId: "m-a", value: 1 },
					{ memberId: "m-b", value: 2 },
				],
				templateId: "template-1",
				scheduledDueDate: "2026-08-15",
			},
			USER,
			NOW,
			"op-1",
		);
		const lines = await mocks.allocations.findByExpense(occurrence.id);
		expect(lines.reduce((sum, line) => sum + line.amountMinor, 0)).toBe(120000);
		expect(lines.find((line) => line.memberId === "m-b")!.amountMinor).toBe(80000);
	});
});
