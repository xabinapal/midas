import { describe, expect, it } from "vitest";
import { validateSummary } from "./repository";

describe("activity summary validation", () => {
	it("accepts safe summary keys", () => {
		expect(() => validateSummary({ action: "created", targetName: "Alex", count: 3 })).not.toThrow();
	});

	it("rejects password in summary", () => {
		expect(() => validateSummary({ password: "secret" })).toThrow("password");
	});

	it("rejects passwordHash in summary", () => {
		expect(() => validateSummary({ passwordHash: "abc123" })).toThrow("passwordHash");
	});

	it("rejects bearerToken in summary", () => {
		expect(() => validateSummary({ bearerToken: "xyz" })).toThrow("bearerToken");
	});

	it("rejects tokenDigest in summary", () => {
		expect(() => validateSummary({ tokenDigest: "deadbeef" })).toThrow("tokenDigest");
	});

	it("rejects cookie in summary", () => {
		expect(() => validateSummary({ cookie: "session=abc" })).toThrow("cookie");
	});

	it("rejects authSecret in summary", () => {
		expect(() => validateSummary({ authSecret: "super-secret" })).toThrow("authSecret");
	});

	it("rejects authorizationHeader in summary", () => {
		expect(() => validateSummary({ authorizationHeader: "Bearer xyz" })).toThrow("authorizationHeader");
	});

	it("rejects requestBody in summary", () => {
		expect(() => validateSummary({ requestBody: "{}" })).toThrow("requestBody");
	});

	it("rejects temporaryPassword in summary", () => {
		expect(() => validateSummary({ temporaryPassword: "temp123" })).toThrow("temporaryPassword");
	});
});
