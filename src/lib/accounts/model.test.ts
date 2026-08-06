import { describe, expect, it } from "vitest";
import { allowedTransferClassifications, cutoffOrderingKey, isClassificationAllowed, orderingKeyFor } from "./model";

describe("allowedTransferClassifications", () => {
	it("allows personal-to-shared transfers to be unclassified, pure, or contribution", () => {
		expect(allowedTransferClassifications("personal", "shared")).toEqual(["unclassified", "pure", "contribution"]);
	});

	it("allows shared-to-personal transfers to be unclassified or distribution only", () => {
		expect(allowedTransferClassifications("shared", "personal")).toEqual(["unclassified", "distribution"]);
	});

	it("allows shared-to-shared transfers to be unclassified or pure", () => {
		expect(allowedTransferClassifications("shared", "shared")).toEqual(["unclassified", "pure"]);
	});

	it("allows personal-to-personal transfers to be unclassified or pure", () => {
		expect(allowedTransferClassifications("personal", "personal")).toEqual(["unclassified", "pure"]);
	});
});

describe("isClassificationAllowed", () => {
	it("accepts a contribution from personal to shared", () => {
		expect(isClassificationAllowed("personal", "shared", "contribution")).toBe(true);
	});

	it("rejects a contribution from shared to personal", () => {
		expect(isClassificationAllowed("shared", "personal", "contribution")).toBe(false);
	});

	it("rejects a distribution from personal to shared", () => {
		expect(isClassificationAllowed("personal", "shared", "distribution")).toBe(false);
	});

	it("rejects a pure transfer from shared to personal", () => {
		expect(isClassificationAllowed("shared", "personal", "pure")).toBe(false);
	});

	it("accepts an unclassified transfer in every direction", () => {
		expect(isClassificationAllowed("personal", "personal", "unclassified")).toBe(true);
		expect(isClassificationAllowed("shared", "shared", "unclassified")).toBe(true);
	});
});

describe("orderingKeyFor", () => {
	it("combines the effective timestamp and id into a stable lexicographic key", () => {
		const key = orderingKeyFor("2026-08-01T10:00:00.000Z", "abc-123");
		expect(key).toBe("2026-08-01T10:00:00.000Z#abc-123");
	});

	it("orders same-timestamp records deterministically by id", () => {
		const a = orderingKeyFor("2026-08-01T10:00:00.000Z", "aaa");
		const b = orderingKeyFor("2026-08-01T10:00:00.000Z", "bbb");
		expect(a < b).toBe(true);
	});

	it("orders earlier timestamps before later ones", () => {
		const earlier = orderingKeyFor("2026-07-01T10:00:00.000Z", "zzz");
		const later = orderingKeyFor("2026-08-01T10:00:00.000Z", "aaa");
		expect(earlier < later).toBe(true);
	});
});

describe("cutoffOrderingKey", () => {
	it("sorts after every record at the same timestamp", () => {
		const cutoff = cutoffOrderingKey("2026-08-01T10:00:00.000Z");
		expect(orderingKeyFor("2026-08-01T10:00:00.000Z", "fff") < cutoff).toBe(true);
	});

	it("sorts before any later timestamp", () => {
		const cutoff = cutoffOrderingKey("2026-08-01T10:00:00.000Z");
		expect(cutoff < orderingKeyFor("2026-08-01T10:00:00.001Z", "aaa")).toBe(true);
	});
});
