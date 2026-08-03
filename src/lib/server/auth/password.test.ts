import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
	it("stores a salted PBKDF2 hash and verifies the exact password", async () => {
		const hash = await hashPassword("correct horse battery staple", new Uint8Array(16).fill(7));

		expect(hash).toMatch(/^pbkdf2-sha256\$600000\$/);
		await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
		await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
	});

	it("rejects malformed or unsupported hashes", async () => {
		await expect(verifyPassword("password", "sha256$1$salt$hash")).resolves.toBe(false);
		await expect(verifyPassword("password", "pbkdf2-sha256$1$salt$hash")).resolves.toBe(false);
	});
});
