/**
 * Pure domain vocabulary for expenses, payments, and planning. State is
 * deliberately orthogonal: lifecycle, value, payment, and due dimensions
 * derive independently and compose in the UI instead of collapsing into
 * one overloaded status enum.
 *
 * Framework-neutral: no Kysely, no SvelteKit, no bindings.
 */

export type ExpenseLifecycle = "draft" | "posted" | "cancelled" | "reversed";
export type ExpenseValueState = "estimated" | "actual";
export type ExpensePaymentStatus = "unpaid" | "partially_paid" | "paid";
export type ExpenseDueState = "none" | "upcoming" | "due" | "overdue";
export type PaymentLifecycle = "posted" | "reversed";
export type FundingSource = "member" | "shared";
export type ApplicationStatus = "active" | "reversed";
export type PeriodKind = "standard" | "custom";
export type TemplateCadence = "monthly" | "yearly";
export type TemplateStatus = "active" | "disabled";
export type AllocationBasis = "planned" | "actual";
export type EvidenceStatus = "active" | "removed";

/** Payment status derives from the applied value, never from a stored field. */
export function derivePaymentStatus(amountMinor: number, paidMinor: number): ExpensePaymentStatus {
	if (paidMinor < 0) {
		throw new Error("payment_status_negative");
	}
	if (paidMinor > amountMinor) {
		throw new Error("payment_status_overapplied");
	}
	if (paidMinor === 0) return "unpaid";
	if (paidMinor === amountMinor) return "paid";
	return "partially_paid";
}

/**
 * Due state against the household-local current date (YYYY-MM-DD). Only
 * unpaid or partially paid expenses can be overdue; a future or absent due
 * date is never presented as overdue.
 */
export function deriveDueState(
	dueDate: string | null,
	todayDate: string,
	paymentStatus: ExpensePaymentStatus,
): ExpenseDueState {
	if (!dueDate || paymentStatus === "paid") return "none";
	if (dueDate < todayDate) return "overdue";
	if (dueDate === todayDate) return "due";
	return "upcoming";
}

export function expenseValueState(
	_plannedAmountMinor: number | null,
	actualAmountMinor: number | null,
): ExpenseValueState {
	return actualAmountMinor !== null ? "actual" : "estimated";
}

/** The amount allocations, payment limits, and reports operate on. */
export function applicableAmountMinor(plannedAmountMinor: number | null, actualAmountMinor: number | null): number {
	if (actualAmountMinor !== null) return actualAmountMinor;
	if (plannedAmountMinor !== null) return plannedAmountMinor;
	throw new Error("expense_amount_missing");
}
