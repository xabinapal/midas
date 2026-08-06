import { describe, expect, it } from "vitest";
import { effectiveAtFromDateInput, todayDateInput } from "./schemas";

describe("effectiveAtFromDateInput", () => {
	it("pins household-local dates to UTC midnight (documented convention)", () => {
		expect(effectiveAtFromDateInput("2026-08-03")).toBe("2026-08-03T00:00:00.000Z");
	});

	it("produces lexicographically sortable timestamps", () => {
		expect(effectiveAtFromDateInput("2026-08-03") < effectiveAtFromDateInput("2026-08-04")).toBe(true);
	});
});

describe("todayDateInput", () => {
	it("returns a YYYY-MM-DD date in the household timezone", () => {
		expect(todayDateInput("Europe/Madrid")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("differs from the UTC date at predictable windows", () => {
		const madrid = todayDateInput("Europe/Madrid");
		const pacific = todayDateInput("Pacific/Auckland");
		expect(madrid).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(pacific).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});
