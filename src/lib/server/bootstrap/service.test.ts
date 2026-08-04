import { describe, expect, it } from "vitest";
import { isBootstrapAvailable, validateBootstrapCredential } from "./service";

const VALID_CREDENTIAL = "a".repeat(33);

describe("isBootstrapAvailable", () => {
	it("is available when no users exist and gate is not complete", () => {
		expect(isBootstrapAvailable(0, "available")).toBe(true);
	});

	it("is unavailable when users already exist", () => {
		expect(isBootstrapAvailable(1, "available")).toBe(false);
	});

	it("is unavailable when gate is complete", () => {
		expect(isBootstrapAvailable(0, "complete")).toBe(false);
	});

	it("is available when gate is held (recoverable)", () => {
		expect(isBootstrapAvailable(0, "held")).toBe(true);
	});
});

describe("validateBootstrapCredential", () => {
	it("accepts a matching credential of sufficient length", () => {
		expect(validateBootstrapCredential(VALID_CREDENTIAL, VALID_CREDENTIAL)).toBe(true);
	});

	it("rejects a mismatched credential", () => {
		expect(validateBootstrapCredential("wrong", VALID_CREDENTIAL)).toBe(false);
	});

	it("rejects when no credential is configured", () => {
		expect(validateBootstrapCredential(VALID_CREDENTIAL, undefined)).toBe(false);
	});

	it("rejects when configured credential is too short", () => {
		expect(validateBootstrapCredential("short", "short")).toBe(false);
	});
});
