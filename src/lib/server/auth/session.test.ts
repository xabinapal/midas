import { describe, expect, it } from "vitest";
import { SESSION_DURATION_SECONDS, createSessionToken, shouldRefreshSession, verifySessionToken } from "./session";

const secret = "test-session-secret-with-at-least-32-bytes";
const user = { id: "user-1", username: "developer" };
const now = 1_700_000_000;

describe("JWT sessions", () => {
	it("round-trips a signed user session", async () => {
		const token = await createSessionToken(user, secret, now);

		await expect(verifySessionToken(token, secret, now + 60)).resolves.toEqual({
			user,
			issuedAt: now,
			expiresAt: now + SESSION_DURATION_SECONDS,
		});
	});

	it("rejects tampered and expired sessions", async () => {
		const token = await createSessionToken(user, secret, now);
		const [header, payload, signature] = token.split(".") as [string, string, string];
		const tamperedSignature = `${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;

		await expect(verifySessionToken(`${header}.${payload}.${tamperedSignature}`, secret, now + 1)).resolves.toBeNull();
		await expect(verifySessionToken(token, secret, now + SESSION_DURATION_SECONDS)).resolves.toBeNull();
	});

	it("refreshes sessions only after half of their lifetime", () => {
		const session = { user, issuedAt: now, expiresAt: now + SESSION_DURATION_SECONDS };

		expect(shouldRefreshSession(session, now + SESSION_DURATION_SECONDS / 2 - 1)).toBe(false);
		expect(shouldRefreshSession(session, now + SESSION_DURATION_SECONDS / 2)).toBe(true);
	});
});
