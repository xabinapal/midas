import { describe, expect, it } from "vitest";
import { formatMinorUnits, parseAmountToMinorUnits } from "./money";

describe("parseAmountToMinorUnits", () => {
	it("parses an integer amount", () => {
		expect(parseAmountToMinorUnits("12")).toBe(1200);
	});

	it("parses a decimal comma", () => {
		expect(parseAmountToMinorUnits("12,34")).toBe(1234);
		expect(parseAmountToMinorUnits("0,05")).toBe(5);
	});

	it("parses a decimal point", () => {
		expect(parseAmountToMinorUnits("12.34")).toBe(1234);
	});

	it("parses es-ES thousands separators", () => {
		expect(parseAmountToMinorUnits("1.234")).toBe(123400);
		expect(parseAmountToMinorUnits("1.234,56")).toBe(123456);
		expect(parseAmountToMinorUnits("1.234.567,89")).toBe(123456789);
	});

	it("parses negative amounts for balance observations", () => {
		expect(parseAmountToMinorUnits("-5,00")).toBe(-500);
		expect(parseAmountToMinorUnits("-1.234,56")).toBe(-123456);
	});

	it("rejects more than two decimal places", () => {
		expect(parseAmountToMinorUnits("1,234")).toBeNull();
		expect(parseAmountToMinorUnits("1.2345")).toBeNull();
	});

	it("rejects amounts beyond the safe-integer range instead of rounding", () => {
		expect(parseAmountToMinorUnits("9007199254740993,00")).toBeNull();
		expect(parseAmountToMinorUnits("99999999999999999")).toBeNull();
	});

	it("rejects invalid input", () => {
		expect(parseAmountToMinorUnits("")).toBeNull();
		expect(parseAmountToMinorUnits("abc")).toBeNull();
		expect(parseAmountToMinorUnits("1,2.3")).toBeNull();
		expect(parseAmountToMinorUnits("12,34,56")).toBeNull();
		expect(parseAmountToMinorUnits("--5")).toBeNull();
	});

	it("trims surrounding whitespace", () => {
		expect(parseAmountToMinorUnits("  7,5 ")).toBe(750);
	});
});

describe("currency exponents", () => {
	it("derives the minor-unit factor from the currency exponent", () => {
		expect(parseAmountToMinorUnits("12", "EUR")).toBe(1200);
		expect(parseAmountToMinorUnits("12", "JPY")).toBe(12);
		expect(parseAmountToMinorUnits("12,345", "KWD")).toBe(12345);
	});

	it("rejects decimals beyond the currency exponent", () => {
		expect(parseAmountToMinorUnits("12,5", "JPY")).toBeNull();
		expect(parseAmountToMinorUnits("1,2345", "KWD")).toBeNull();
	});

	it("formats with the currency exponent", () => {
		expect(formatMinorUnits(1200, "EUR")).toContain("12,00");
		expect(formatMinorUnits(12, "JPY")).toContain("12");
		expect(formatMinorUnits(12, "JPY")).not.toContain("12,00");
	});
});

describe("formatMinorUnits", () => {
	it("formats minor units with es-ES currency rules", () => {
		expect(formatMinorUnits(1234, "EUR")).toContain("12,34");
		expect(formatMinorUnits(-500, "EUR")).toContain("5,00");
		expect(formatMinorUnits(0, "EUR")).toContain("0,00");
	});
});
