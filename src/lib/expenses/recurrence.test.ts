import { describe, expect, it } from "vitest";
import { monthRangeForPeriod, scheduledDueDatesWithin, serviceSpanFor } from "./recurrence";

describe("monthRangeForPeriod", () => {
	it("returns the inclusive start and exclusive end of a month", () => {
		expect(monthRangeForPeriod("2026-08")).toEqual({ start: "2026-08-01", end: "2026-09-01" });
	});

	it("crosses the year boundary in December", () => {
		expect(monthRangeForPeriod("2026-12")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
	});
});

describe("scheduledDueDatesWithin", () => {
	it("generates one date per interval month", () => {
		const dates = scheduledDueDatesWithin(
			{ cadence: "monthly", intervalCount: 1, startDate: "2026-01-10" },
			"2026-08-01",
			"2026-09-01",
		);
		expect(dates).toEqual(["2026-08-10"]);
	});

	it("supports interval months", () => {
		// Quarterly: Jan, Apr, Jul, Oct — nothing in August, one in July.
		const july = scheduledDueDatesWithin(
			{ cadence: "monthly", intervalCount: 3, startDate: "2026-01-15" },
			"2026-07-01",
			"2026-08-01",
		);
		expect(july).toEqual(["2026-07-15"]);
		const august = scheduledDueDatesWithin(
			{ cadence: "monthly", intervalCount: 3, startDate: "2026-01-15" },
			"2026-08-01",
			"2026-09-01",
		);
		expect(august).toEqual([]);
	});

	it("supports yearly cadence with intervals", () => {
		const dates = scheduledDueDatesWithin(
			{ cadence: "yearly", intervalCount: 1, startDate: "2025-03-05" },
			"2027-03-01",
			"2027-04-01",
		);
		expect(dates).toEqual(["2027-03-05"]);
		const none = scheduledDueDatesWithin(
			{ cadence: "yearly", intervalCount: 2, startDate: "2025-03-05" },
			"2026-03-01",
			"2026-04-01",
		);
		expect(none).toEqual([]);
	});

	it("clamps the due day to the month length", () => {
		const dates = scheduledDueDatesWithin(
			{ cadence: "monthly", intervalCount: 1, startDate: "2026-01-31" },
			"2026-02-01",
			"2026-03-01",
		);
		expect(dates).toEqual(["2026-02-28"]);
	});

	it("honours an explicit due-day rule", () => {
		const dates = scheduledDueDatesWithin(
			{ cadence: "monthly", intervalCount: 1, startDate: "2026-01-03", dueDay: 25 },
			"2026-08-01",
			"2026-09-01",
		);
		expect(dates).toEqual(["2026-08-25"]);
	});

	it("stops at the active interval end date", () => {
		const dates = scheduledDueDatesWithin(
			{ cadence: "monthly", intervalCount: 1, startDate: "2026-01-10", endDate: "2026-06-30" },
			"2026-08-01",
			"2026-09-01",
		);
		expect(dates).toEqual([]);
	});

	it("never schedules before the template start date", () => {
		const dates = scheduledDueDatesWithin(
			{ cadence: "monthly", intervalCount: 1, startDate: "2026-08-20" },
			"2026-08-01",
			"2026-09-01",
		);
		expect(dates).toEqual(["2026-08-20"]);
		const earlier = scheduledDueDatesWithin(
			{ cadence: "monthly", intervalCount: 1, startDate: "2026-08-20" },
			"2026-07-01",
			"2026-08-01",
		);
		expect(earlier).toEqual([]);
	});
});

describe("serviceSpanFor", () => {
	it("builds a span from the first day of the due month", () => {
		expect(serviceSpanFor("2026-08-15", 12)).toEqual({ start: "2026-08-01", end: "2027-08-01" });
	});

	it("returns null without a span rule", () => {
		expect(serviceSpanFor("2026-08-15", null)).toBeNull();
	});
});
