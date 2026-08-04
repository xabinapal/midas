import { describe, expect, it } from "vitest";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "./request";

describe("session cookie configuration", () => {
	it("configures the cookie name", () => {
		expect(SESSION_COOKIE_NAME).toBe("auth_session");
	});

	it("sets secure cookie options", () => {
		const opts = sessionCookieOptions(true);
		expect(opts).toMatchObject({
			path: "/",
			httpOnly: true,
			sameSite: "lax",
			secure: true,
		});
	});

	it("sets insecure cookie options for dev", () => {
		const opts = sessionCookieOptions(false);
		expect(opts.secure).toBe(false);
	});
});
