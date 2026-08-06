import {
	applicableAmountMinor,
	deriveDueState,
	derivePaymentStatus,
	expenseValueState,
	type ExpenseDueState,
	type ExpensePaymentStatus,
	type ExpenseValueState,
} from "$lib/expenses/model";
import type {
	ExpenseAllocationLineRecord,
	ExpenseCategoryRepository,
	ExpenseAllocationRepository,
	ExpenseRecord,
	PaymentApplicationRecord,
	PaymentApplicationRepository,
} from "./repository";
import type { MemberRepository } from "../household/repository";

/**
 * Read-side projections for expense screens. Views compose the orthogonal
 * value, payment, and due dimensions from stored records; nothing here
 * writes state.
 */

export interface ExpenseAllocationView {
	memberId: string;
	memberName: string;
	basis: "planned" | "actual";
	amountMinor: number;
}

export interface ExpenseView {
	expense: ExpenseRecord;
	categoryName: string;
	categorySlug: string;
	valueState: ExpenseValueState;
	applicableMinor: number;
	paidMinor: number;
	unpaidMinor: number;
	paymentStatus: ExpensePaymentStatus;
	dueState: ExpenseDueState;
	allocations: ExpenseAllocationView[];
}

interface ViewRepos {
	categories: ExpenseCategoryRepository;
	allocations: ExpenseAllocationRepository;
	applications: PaymentApplicationRepository;
	members: MemberRepository;
}

export async function buildExpenseViews(
	repos: ViewRepos,
	householdId: string,
	expenses: ExpenseRecord[],
	todayDate: string,
): Promise<ExpenseView[]> {
	if (expenses.length === 0) return [];
	const [categories, members, householdApplications, allocationLines] = await Promise.all([
		repos.categories.findByHousehold(householdId),
		repos.members.findByHousehold(householdId),
		repos.applications.findActiveByHousehold(householdId),
		repos.allocations.findByExpenses(expenses.map((expense) => expense.id)),
	]);

	const categoryById = new Map(categories.map((category) => [category.id, category]));
	const memberNameById = new Map(members.map((member) => [member.id, member.displayName]));
	const paidByExpense = new Map<string, number>();
	for (const application of householdApplications) {
		paidByExpense.set(application.expenseId, (paidByExpense.get(application.expenseId) ?? 0) + application.amountMinor);
	}
	const linesByExpense = new Map<string, ExpenseAllocationLineRecord[]>();
	for (const line of allocationLines) {
		const lines = linesByExpense.get(line.expenseId) ?? [];
		lines.push(line);
		linesByExpense.set(line.expenseId, lines);
	}

	return expenses.map((expense) => {
		const applicable = applicableAmountMinor(expense.plannedAmountMinor, expense.actualAmountMinor);
		const paid = Math.min(paidByExpense.get(expense.id) ?? 0, applicable);
		const paymentStatus = derivePaymentStatus(applicable, paid);
		return {
			expense,
			categoryName: categoryById.get(expense.categoryId)?.name ?? expense.categoryId,
			categorySlug: categoryById.get(expense.categoryId)?.slug ?? "",
			valueState: expenseValueState(expense.plannedAmountMinor, expense.actualAmountMinor),
			applicableMinor: applicable,
			paidMinor: paid,
			unpaidMinor: applicable - paid,
			paymentStatus,
			dueState: deriveDueState(expense.dueDate, todayDate, paymentStatus),
			allocations: (linesByExpense.get(expense.id) ?? []).map((line) => ({
				memberId: line.memberId,
				memberName: memberNameById.get(line.memberId) ?? line.memberId,
				basis: line.basis,
				amountMinor: line.amountMinor,
			})),
		};
	});
}

export interface PaymentApplicationView {
	application: PaymentApplicationRecord;
	expenseDescription: string;
	expenseReference: string | null;
}
/**
 * Period totals. Expected (unrealized) values contribute only to the
 * expected figure — they are not obligations yet, so they never enter
 * paid/unpaid totals. Actual values drive paid/unpaid. Matched and
 * actualized expectations count their planned baseline once.
 */
export interface PeriodTotals {
	expectedMinor: number;
	actualMinor: number;
	paidMinor: number;
	unpaidMinor: number;
}

export function sumPeriodTotals(views: ExpenseView[]): PeriodTotals {
	let expectedMinor = 0;
	let actualMinor = 0;
	let paidMinor = 0;
	let unpaidMinor = 0;
	for (const view of views) {
		if (view.expense.status === "draft" || view.expense.status === "cancelled" || view.expense.status === "reversed") {
			continue;
		}
		if (view.valueState === "estimated") {
			expectedMinor += view.expense.plannedAmountMinor ?? 0;
			// Estimated expenses are excluded from paid totals until realized.
			continue;
		}
		actualMinor += view.applicableMinor;
		// An actualized occurrence contributes its planned baseline to
		// expected totals once, never as a second expected cost.
		if (view.expense.plannedAmountMinor !== null) {
			expectedMinor += view.expense.plannedAmountMinor;
		}
		paidMinor += view.paidMinor;
		unpaidMinor += view.unpaidMinor;
	}
	return { expectedMinor, actualMinor, paidMinor, unpaidMinor };
}
