import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, formatNumber, formatPercentage, formatPeriod } from "./format";

describe("es-ES format boundaries", () => {
	it("formats household currency and numbers", () => {
		expect(formatCurrency(12345.5, "EUR")).toBe("12.345,50 €");
		expect(formatNumber(12345.6)).toBe("12.345,6");
	});

	it("formats percentages from decimal ratios", () => {
		expect(formatPercentage(0.125)).toBe("12,5 %");
	});

	it("formats dates and accounting periods", () => {
		expect(formatDate("2026-08-04T12:00:00Z")).toBe("04 ago 2026");
		expect(formatPeriod("2026-08")).toBe("Agosto de 2026");
	});
});
