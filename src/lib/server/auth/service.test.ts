import { describe, expect, it, vi } from "vitest";
import type { UsersRepository } from "./repository";
import { authenticateUser } from "./service";

describe("authenticateUser", () => {
	it("normalizes the username and returns only the safe user projection", async () => {
		const repository: UsersRepository = {
			findCredentialsByUsername: vi.fn().mockResolvedValue({
				id: "user-1",
				username: "developer",
				passwordHash: "stored-hash",
			}),
		};
		const verify = vi.fn().mockResolvedValue(true);

		await expect(authenticateUser(repository, " Developer ", "secret", verify)).resolves.toEqual({
			id: "user-1",
			username: "developer",
		});
		expect(repository.findCredentialsByUsername).toHaveBeenCalledWith("developer");
		expect(verify).toHaveBeenCalledWith("secret", "stored-hash");
	});

	it("performs a password check and returns the same failure for unknown users", async () => {
		const repository: UsersRepository = { findCredentialsByUsername: vi.fn().mockResolvedValue(undefined) };
		const verify = vi.fn().mockResolvedValue(false);

		await expect(authenticateUser(repository, "missing", "secret", verify)).resolves.toBeNull();
		expect(verify).toHaveBeenCalledOnce();
		expect(verify.mock.calls[0]?.[1]).toMatch(/^pbkdf2-sha256\$600000\$/);
	});

	it("rejects an incorrect password", async () => {
		const repository: UsersRepository = {
			findCredentialsByUsername: vi.fn().mockResolvedValue({
				id: "user-1",
				username: "developer",
				passwordHash: "stored-hash",
			}),
		};

		await expect(authenticateUser(repository, "developer", "wrong", async () => false)).resolves.toBeNull();
	});
});
