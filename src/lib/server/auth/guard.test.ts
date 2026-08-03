import { describe, expect, it } from "vitest";
import { createLoginRedirect, protectedRouteKind, safeRedirectPath } from "./guard";

describe("authentication route guards", () => {
	it.each([
		["/(protected)", "page"],
		["/(protected)/settings", "page"],
		["/(protected-api)/api/session", "api"],
		["/(public)/login", undefined],
		["/robots.txt", undefined],
		[null, undefined],
	] as const)("classifies route %s", (routeId, expected) => {
		expect(protectedRouteKind(routeId)).toBe(expected);
	});

	it("preserves the requested local page in the login redirect", () => {
		expect(createLoginRedirect(new URL("https://example.test/settings?tab=profile"))).toBe(
			"/login?next=%2Fsettings%3Ftab%3Dprofile",
		);
	});

	it.each([null, "", "https://evil.test", "//evil.test", "/\\evil.test"])(
		"rejects unsafe post-login redirect %j",
		(value) => {
			expect(safeRedirectPath(value)).toBe("/");
		},
	);

	it("accepts same-origin paths", () => {
		expect(safeRedirectPath("/settings?tab=profile#security")).toBe("/settings?tab=profile#security");
	});
});
