import { describe, expect, it, vi } from "vitest";
import type { UsersRepository } from "./repository";
import { authenticateUser } from "./service";

const VALID_CREDENTIALS = {
	id: "user-1",
	username: "developer",
	passwordHash: "stored-hash",
	isActive: 1 as const,
	householdId: "household-1",
	isAdministrator: 1 as const,
	requiresPasswordChange: 0 as const,
	memberId: "member-1",
};

function createRepository(credentials: typeof VALID_CREDENTIALS | undefined): UsersRepository {
	return {
		findCredentialsByUsername: vi.fn().mockResolvedValue(credentials),
		findUserById: vi.fn().mockResolvedValue(credentials),
	};
}

describe("authenticateUser", () => {
	it("normalizes the username and returns the safe user projection", async () => {
		const repository = createRepository(VALID_CREDENTIALS);
		const verify = vi.fn().mockResolvedValue(true);

		await expect(authenticateUser(repository, " Developer ", "secret", verify)).resolves.toEqual({
			id: "user-1",
			username: "developer",
			householdId: "household-1",
			isAdministrator: true,
			requiresPasswordChange: false,
			memberId: "member-1",
		});
		expect(repository.findCredentialsByUsername).toHaveBeenCalledWith("developer");
		expect(verify).toHaveBeenCalledWith("secret", "stored-hash");
	});

	it("performs a password check and returns the same failure for unknown users", async () => {
		const repository = createRepository(undefined);
		const verify = vi.fn().mockResolvedValue(false);

		await expect(authenticateUser(repository, "missing", "secret", verify)).resolves.toBeNull();
		expect(verify).toHaveBeenCalledOnce();
		expect(verify.mock.calls[0]?.[1]).toMatch(/^pbkdf2-sha256\$600000\$/);
	});

	it("rejects an incorrect password", async () => {
		const repository = createRepository(VALID_CREDENTIALS);

		await expect(authenticateUser(repository, "developer", "wrong", async () => false)).resolves.toBeNull();
	});
});
