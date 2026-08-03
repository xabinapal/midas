import { describe, expect, it } from "vitest";
import { resolveRequestSession, sessionCookieOptions } from "./request";
import { SESSION_DURATION_SECONDS, createSessionToken, verifySessionToken } from "./session";

const secret = "test-session-secret-with-at-least-32-bytes";
const user = { id: "user-1", username: "developer" };
const now = 1_700_000_000;

describe("resolveRequestSession", () => {
	it("uses hardened cookie attributes", () => {
		expect(sessionCookieOptions(true)).toMatchObject({
			path: "/",
			httpOnly: true,
			sameSite: "lax",
			secure: true,
			maxAge: SESSION_DURATION_SECONDS,
		});
	});

	it("ignores authentication and clears stale cookies when disabled", async () => {
		await expect(resolveRequestSession({ enabled: false }, "stale-token", now)).resolves.toEqual({
			user: null,
			clearCookie: true,
		});
	});

	it("clears invalid session cookies", async () => {
		await expect(resolveRequestSession({ enabled: true, secret }, "invalid-token", now)).resolves.toEqual({
			user: null,
			clearCookie: true,
		});
	});

	it("renews a valid session after half its lifetime", async () => {
		const original = await createSessionToken(user, secret, now);
		const refreshedAt = now + SESSION_DURATION_SECONDS / 2;
		const result = await resolveRequestSession({ enabled: true, secret }, original, refreshedAt);

		expect(result.user).toEqual(user);
		expect(result.clearCookie).toBe(false);
		expect(result.refreshedToken).toBeDefined();
		await expect(verifySessionToken(result.refreshedToken!, secret, refreshedAt)).resolves.toMatchObject({
			user,
			issuedAt: refreshedAt,
		});
	});
});
