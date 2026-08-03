import { describe, expect, it } from "vitest";
import { formatLine, formatValue } from "./logfmt";

describe("formatValue", () => {
	it("leaves simple values bare", () => {
		expect(formatValue("GET")).toBe("GET");
		expect(formatValue(200)).toBe("200");
		expect(formatValue(true)).toBe("true");
	});

	it("returns an empty string for null and undefined", () => {
		expect(formatValue(null)).toBe("");
		expect(formatValue(undefined)).toBe("");
	});

	it("quotes values containing spaces, equals, or quotes", () => {
		expect(formatValue("GET /")).toBe('"GET /"');
		expect(formatValue("a=b")).toBe('"a=b"');
		expect(formatValue('a"b')).toBe('"a\\"b"');
	});
});

describe("formatLine", () => {
	it("formats message, level, timestamp, and fields as logfmt", () => {
		const line = formatLine("info", "GET /", { method: "GET", status: 200 }, "2026-01-01T00:00:00.000Z");
		expect(line).toBe('msg="GET /" level=info ts=2026-01-01T00:00:00.000Z method=GET status=200');
	});

	it("omits fields with empty values", () => {
		const line = formatLine("info", "x", { a: "", b: undefined, c: null }, "2026-01-01T00:00:00.000Z");
		expect(line).toBe("msg=x level=info ts=2026-01-01T00:00:00.000Z");
	});
});
