import { describe, expect, it } from "vitest";
import { readAuthConfig } from "./config";

describe("readAuthConfig", () => {
	it("disables authentication when the flag is absent or false", () => {
		expect(readAuthConfig({})).toEqual({ enabled: false });
		expect(readAuthConfig({ AUTH_ENABLED: "false" })).toEqual({ enabled: false });
	});

	it("requires a strong signing secret when authentication is enabled", () => {
		expect(readAuthConfig({ AUTH_ENABLED: "true", AUTH_SECRET: "a".repeat(32) })).toEqual({
			enabled: true,
			secret: "a".repeat(32),
		});

		expect(() => readAuthConfig({ AUTH_ENABLED: "true" })).toThrow("AUTH_SECRET");
		expect(() => readAuthConfig({ AUTH_ENABLED: "true", AUTH_SECRET: "too-short" })).toThrow("32 bytes");
	});

	it("rejects ambiguous enabled values", () => {
		expect(() => readAuthConfig({ AUTH_ENABLED: "yes" })).toThrow("AUTH_ENABLED");
	});
});
