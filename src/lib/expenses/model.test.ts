import { describe, expect, it } from "vitest";
import { applicableAmountMinor, deriveDueState, derivePaymentStatus, expenseValueState } from "./model";

describe("derivePaymentStatus", () => {
	it("is unpaid when nothing is applied", () => {
		expect(derivePaymentStatus(10000, 0)).toBe("unpaid");
	});

	it("is partially paid below the full amount", () => {
		expect(derivePaymentStatus(10000, 6000)).toBe("partially_paid");
		expect(derivePaymentStatus(10000, 9999)).toBe("partially_paid");
	});

	it("is paid at the exact amount", () => {
		expect(derivePaymentStatus(10000, 10000)).toBe("paid");
	});

	it("rejects over-application and negative values", () => {
		expect(() => derivePaymentStatus(10000, 10001)).toThrowError("payment_status_overapplied");
		expect(() => derivePaymentStatus(10000, -1)).toThrowError("payment_status_negative");
	});
});

describe("deriveDueState", () => {
	it("has no due state without a due date", () => {
		expect(deriveDueState(null, "2026-08-06", "unpaid")).toBe("none");
	});

	it("is upcoming for a future due date", () => {
		expect(deriveDueState("2026-08-10", "2026-08-06", "unpaid")).toBe("upcoming");
	});

	it("is due on the due date itself", () => {
		expect(deriveDueState("2026-08-06", "2026-08-06", "unpaid")).toBe("due");
	});

	it("is overdue for an unpaid expense past its due date", () => {
		expect(deriveDueState("2026-08-01", "2026-08-06", "unpaid")).toBe("overdue");
		expect(deriveDueState("2026-08-01", "2026-08-06", "partially_paid")).toBe("overdue");
	});

	it("is never overdue once paid", () => {
		expect(deriveDueState("2026-08-01", "2026-08-06", "paid")).toBe("none");
	});

	it("never presents a future due date as overdue", () => {
		expect(deriveDueState("2027-01-01", "2026-08-06", "partially_paid")).toBe("upcoming");
	});
});

describe("expenseValueState and applicableAmountMinor", () => {
	it("is estimated while no actual amount exists", () => {
		expect(expenseValueState(5000, null)).toBe("estimated");
		expect(applicableAmountMinor(5000, null)).toBe(5000);
	});

	it("is actual once an actual amount exists and applies it", () => {
		expect(expenseValueState(5000, 4800)).toBe("actual");
		expect(applicableAmountMinor(5000, 4800)).toBe(4800);
	});

	it("supports an actual-only expense without a planned amount", () => {
		expect(expenseValueState(null, 4800)).toBe("actual");
		expect(applicableAmountMinor(null, 4800)).toBe(4800);
	});

	it("rejects an expense with no amount at all", () => {
		expect(() => applicableAmountMinor(null, null)).toThrowError("expense_amount_missing");
	});
});
