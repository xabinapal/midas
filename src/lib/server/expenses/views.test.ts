import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberRepository } from "../household/repository";
import type {
	ExpenseAllocationLineRecord,
	ExpenseAllocationRepository,
	ExpenseCategoryRepository,
	ExpenseRecord,
	PaymentApplicationRecord,
	PaymentApplicationRepository,
} from "./repository";
import { buildExpenseViews, sumPeriodTotals } from "./views";

const NOW = "2026-08-06";
const HOUSEHOLD = "household-1";

function expenseRecord(overrides: Partial<ExpenseRecord> = {}): ExpenseRecord {
	return {
		id: "expense-1",
		householdId: HOUSEHOLD,
		categoryId: "cat-1",
		reportingPeriodId: "period-1",
		description: "Gasto",
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
		actorUserId: null,
		operationId: null,
		createdAt: NOW,
		updatedAt: NOW,
		...overrides,
	};
}

function applicationRecord(overrides: Partial<PaymentApplicationRecord> = {}): PaymentApplicationRecord {
	return {
		id: "app-1",
		householdId: HOUSEHOLD,
		paymentId: "payment-1",
		expenseId: "expense-1",
		amountMinor: 6000,
		status: "active",
		recordedAt: NOW,
		reversedAt: null,
		operationId: null,
		...overrides,
	};
}

interface Mocks {
	applications: PaymentApplicationRecord[];
	allocationLines: ExpenseAllocationLineRecord[];
	repos: {
		categories: ExpenseCategoryRepository;
		allocations: ExpenseAllocationRepository;
		applications: PaymentApplicationRepository;
		members: MemberRepository;
	};
}

function makeMocks(): Mocks {
	const applications: PaymentApplicationRecord[] = [];
	const allocationLines: ExpenseAllocationLineRecord[] = [];
	const repos = {
		categories: {
			findByHousehold: vi.fn(async () => [
				{
					id: "cat-1",
					householdId: HOUSEHOLD,
					name: "Luz",
					slug: "luz",
					ordering: 0,
					isActive: true,
					createdAt: NOW,
					updatedAt: NOW,
					operationId: null,
				},
			]),
		} as unknown as ExpenseCategoryRepository,
		allocations: {
			findByExpenses: vi.fn(async () => allocationLines),
		} as unknown as ExpenseAllocationRepository,
		applications: {
			findActiveByHousehold: vi.fn(async () => applications),
		} as unknown as PaymentApplicationRepository,
		members: {
			findByHousehold: vi.fn(async () => [
				{ id: "m-a", householdId: HOUSEHOLD, displayName: "Alex", isActive: true, defaultWeight: 1 },
			]),
		} as unknown as MemberRepository,
	};
	return { applications, allocationLines, repos };
}

describe("buildExpenseViews", () => {
	let mocks: Mocks;
	beforeEach(() => {
		mocks = makeMocks();
	});

	it("derives paid, unpaid, and payment status from active applications", async () => {
		mocks.applications.push(applicationRecord({ amountMinor: 6000 }));
		const [view] = await buildExpenseViews(mocks.repos, HOUSEHOLD, [expenseRecord()], NOW);
		expect(view).toMatchObject({
			applicableMinor: 10000,
			paidMinor: 6000,
			unpaidMinor: 4000,
			paymentStatus: "partially_paid",
			valueState: "actual",
			categoryName: "Luz",
		});
	});

	it("derives the due state from the household-local date", async () => {
		const [overdue] = await buildExpenseViews(mocks.repos, HOUSEHOLD, [expenseRecord({ dueDate: "2026-08-01" })], NOW);
		expect(overdue!.dueState).toBe("overdue");
		const [upcoming] = await buildExpenseViews(mocks.repos, HOUSEHOLD, [expenseRecord({ dueDate: "2026-08-10" })], NOW);
		expect(upcoming!.dueState).toBe("upcoming");
	});

	it("clamps paid to the applicable amount instead of throwing on over-application", async () => {
		// Defensive mask: corrupted data (paid > applicable) is presented as
		// fully paid rather than crashing the projection.
		mocks.applications.push(applicationRecord({ amountMinor: 12000 }));
		const [view] = await buildExpenseViews(mocks.repos, HOUSEHOLD, [expenseRecord()], NOW);
		expect(view).toMatchObject({ paidMinor: 10000, unpaidMinor: 0, paymentStatus: "paid" });
	});

	it("ignores applications of other expenses", async () => {
		mocks.applications.push(applicationRecord({ expenseId: "expense-other", amountMinor: 6000 }));
		const [view] = await buildExpenseViews(mocks.repos, HOUSEHOLD, [expenseRecord()], NOW);
		expect(view).toMatchObject({ paidMinor: 0, paymentStatus: "unpaid" });
	});

	it("maps allocation lines with member names", async () => {
		mocks.allocationLines.push({
			id: "al-1",
			expenseId: "expense-1",
			memberId: "m-a",
			basis: "actual",
			amountMinor: 10000,
		});
		const [view] = await buildExpenseViews(mocks.repos, HOUSEHOLD, [expenseRecord()], NOW);
		expect(view!.allocations).toEqual([{ memberId: "m-a", memberName: "Alex", basis: "actual", amountMinor: 10000 }]);
	});
});

describe("sumPeriodTotals", () => {
	function viewOf(expense: ExpenseRecord, paidMinor = 0) {
		const applicable = expense.actualAmountMinor ?? expense.plannedAmountMinor ?? 0;
		return {
			expense,
			categoryName: "Luz",
			categorySlug: "luz",
			valueState: (expense.actualAmountMinor !== null ? "actual" : "estimated") as "actual" | "estimated",
			applicableMinor: applicable,
			paidMinor,
			unpaidMinor: applicable - paidMinor,
			paymentStatus: (paidMinor === 0 ? "unpaid" : paidMinor === applicable ? "paid" : "partially_paid") as
				"unpaid" | "paid" | "partially_paid",
			dueState: "none" as const,
			allocations: [],
		};
	}

	it("excludes unrealized estimates from paid and unpaid totals", () => {
		const totals = sumPeriodTotals([
			viewOf(expenseRecord({ id: "e-1", plannedAmountMinor: 90000, actualAmountMinor: null }), 30000),
		]);
		expect(totals).toEqual({ expectedMinor: 90000, actualMinor: 0, paidMinor: 0, unpaidMinor: 0 });
	});

	it("counts actual expenses with their payments", () => {
		const totals = sumPeriodTotals([viewOf(expenseRecord({ actualAmountMinor: 10000 }), 6000)]);
		expect(totals).toEqual({ expectedMinor: 0, actualMinor: 10000, paidMinor: 6000, unpaidMinor: 4000 });
	});

	it("counts an actualized occurrence's baseline once in expected totals", () => {
		const totals = sumPeriodTotals([viewOf(expenseRecord({ plannedAmountMinor: 8000, actualAmountMinor: 9100 }))]);
		expect(totals).toEqual({ expectedMinor: 8000, actualMinor: 9100, paidMinor: 0, unpaidMinor: 9100 });
	});

	it("counts a matched pair once: expected baseline plus actual realization", () => {
		const totals = sumPeriodTotals([
			viewOf(
				expenseRecord({
					id: "expected-1",
					plannedAmountMinor: 8000,
					actualAmountMinor: null,
					realizedByExpenseId: "actual-1",
				}),
			),
			viewOf(expenseRecord({ id: "actual-1", actualAmountMinor: 9100 }), 9100),
		]);
		expect(totals).toEqual({ expectedMinor: 8000, actualMinor: 9100, paidMinor: 9100, unpaidMinor: 0 });
	});

	it("excludes cancelled and reversed expenses entirely", () => {
		const totals = sumPeriodTotals([
			viewOf(expenseRecord({ id: "e-1", status: "cancelled", plannedAmountMinor: 5000, actualAmountMinor: null })),
			viewOf(expenseRecord({ id: "e-2", status: "reversed", actualAmountMinor: 7000 })),
			viewOf(expenseRecord({ id: "e-3", actualAmountMinor: 1000 })),
		]);
		expect(totals).toEqual({ expectedMinor: 0, actualMinor: 1000, paidMinor: 0, unpaidMinor: 1000 });
	});

	it("excludes drafts from every total", () => {
		const totals = sumPeriodTotals([
			viewOf(expenseRecord({ id: "e-1", status: "draft", plannedAmountMinor: null, actualAmountMinor: 5000 })),
			viewOf(expenseRecord({ id: "e-2", actualAmountMinor: 1000 })),
		]);
		expect(totals).toEqual({ expectedMinor: 0, actualMinor: 1000, paidMinor: 0, unpaidMinor: 1000 });
	});
});
