import { describe, expect, it, vi } from "vitest";
import {
	changeOwnPassword,
	adminResetPassword,
	disableUser,
	reactivateUser,
	listSessions,
	revokeUserSession,
	type CredentialsRepository,
	type SessionProjection,
} from "./credentials";
import type { UserRecord, UsersRepository } from "./repository";

const NOW = Math.floor(new Date("2026-08-04T12:00:00.000Z").getTime() / 1000);

function mockUser(overrides: Partial<UserRecord> = {}): UserRecord {
	return {
		id: "user-1",
		username: "developer",
		passwordHash: "stored-hash",
		isActive: 1,
		householdId: "hh-1",
		isAdministrator: 1,
		requiresPasswordChange: 0,
		memberId: "member-1",
		...overrides,
	};
}

function mockCredentials(userMap: Record<string, UserRecord> = {}): CredentialsRepository {
	const sessions: SessionProjection[] = [
		{
			id: "s1",
			createdAt: "2026-08-04T08:00:00.000Z",
			rotatedAt: "2026-08-04T08:00:00.000Z",
			expiresAt: "2026-08-04T16:00:00.000Z",
		},
		{
			id: "s2",
			createdAt: "2026-08-04T06:00:00.000Z",
			rotatedAt: "2026-08-04T06:00:00.000Z",
			expiresAt: "2026-08-04T14:00:00.000Z",
		},
	];
	return {
		findUserById: vi.fn((id: string) => Promise.resolve(userMap[id] ?? mockUser({ id }))),
		updatePassword: vi.fn(),
		updateActive: vi.fn(),
		countActiveAdministrators: vi.fn().mockResolvedValue(2),
		deleteSessionsByUser: vi.fn(),
		findSessionsByUser: vi.fn().mockResolvedValue(sessions),
		deleteSessionById: vi.fn(),
	};
}

function mockUsersRepo(): UsersRepository {
	return {
		findCredentialsByUsername: vi.fn(),
		findUserById: vi.fn(),
	};
}

describe("changeOwnPassword", () => {
	it("verifies current password and updates hash", async () => {
		const creds = mockCredentials({ "user-1": mockUser() });
		const verify = vi.fn().mockResolvedValue(true);
		const hash = vi.fn().mockResolvedValue("new-hash");

		const result = await changeOwnPassword(
			creds,
			mockUsersRepo(),
			"user-1",
			"current-pass",
			"new-password-12",
			"s1",
			"hh-1",
			NOW,
			verify,
			hash,
		);

		expect(result).not.toBeNull();
		expect(verify).toHaveBeenCalledWith("current-pass", "stored-hash");
		expect(hash).toHaveBeenCalledWith("new-password-12");
		expect(creds.updatePassword).toHaveBeenCalledWith("user-1", "new-hash", false, expect.any(String));
	});

	it("returns null for incorrect current password", async () => {
		const creds = mockCredentials({ "user-1": mockUser() });
		const verify = vi.fn().mockResolvedValue(false);

		const result = await changeOwnPassword(
			creds,
			mockUsersRepo(),
			"user-1",
			"wrong",
			"new-password-12",
			"s1",
			"hh-1",
			NOW,
			verify,
		);

		expect(result).toBeNull();
		expect(creds.updatePassword).not.toHaveBeenCalled();
	});

	it("returns null for inactive user", async () => {
		const creds = mockCredentials({ "user-1": mockUser({ isActive: 0 }) });
		const verify = vi.fn().mockResolvedValue(true);

		const result = await changeOwnPassword(
			creds,
			mockUsersRepo(),
			"user-1",
			"current",
			"new-password-12",
			"s1",
			"hh-1",
			NOW,
			verify,
		);

		expect(result).toBeNull();
	});

	it("revokes all other sessions on success", async () => {
		const creds = mockCredentials({ "user-1": mockUser() });
		const verify = vi.fn().mockResolvedValue(true);

		await changeOwnPassword(creds, mockUsersRepo(), "user-1", "current", "new-password-12", "s1", "hh-1", NOW, verify);

		expect(creds.deleteSessionsByUser).toHaveBeenCalledWith("user-1");
	});
});

describe("adminResetPassword", () => {
	it("resets target password and forces change", async () => {
		const admin = mockUser({ id: "admin-1", isAdministrator: 1 });
		const target = mockUser({ id: "target-1", isAdministrator: 0 });
		const creds = mockCredentials({ "admin-1": admin, "target-1": target });
		const hash = vi.fn().mockResolvedValue("temp-hash");

		const result = await adminResetPassword(creds, "admin-1", "target-1", "temp-pass-12345", NOW, hash);

		expect(result).toBe(true);
		expect(creds.updatePassword).toHaveBeenCalledWith("target-1", "temp-hash", true, expect.any(String));
		expect(creds.deleteSessionsByUser).toHaveBeenCalledWith("target-1");
	});

	it("rejects non-administrator reset", async () => {
		const regular = mockUser({ id: "user-1", isAdministrator: 0 });
		const target = mockUser({ id: "target-1" });
		const creds = mockCredentials({ "user-1": regular, "target-1": target });

		const result = await adminResetPassword(creds, "user-1", "target-1", "temp-pass-12345", NOW);

		expect(result).toBe(false);
		expect(creds.updatePassword).not.toHaveBeenCalled();
	});

	it("rejects cross-household reset", async () => {
		const admin = mockUser({ id: "admin-1", householdId: "hh-1" });
		const target = mockUser({ id: "target-1", householdId: "hh-2" });
		const creds = mockCredentials({ "admin-1": admin, "target-1": target });

		const result = await adminResetPassword(creds, "admin-1", "target-1", "temp-pass-12345", NOW);

		expect(result).toBe(false);
	});
});

describe("disableUser", () => {
	it("disables a regular user and revokes sessions", async () => {
		const admin = mockUser({ id: "admin-1", isAdministrator: 1 });
		const target = mockUser({ id: "target-1", isAdministrator: 0 });
		const creds = mockCredentials({ "admin-1": admin, "target-1": target });

		const result = await disableUser(creds, "admin-1", "target-1", NOW);

		expect(result.success).toBe(true);
		expect(creds.updateActive).toHaveBeenCalledWith("target-1", false, expect.any(String));
		expect(creds.deleteSessionsByUser).toHaveBeenCalledWith("target-1");
	});

	it("prevents disabling the last administrator", async () => {
		const admin = mockUser({ id: "admin-1", isAdministrator: 1 });
		const target = mockUser({ id: "target-1", isAdministrator: 1, householdId: "hh-1" });
		const creds = mockCredentials({ "admin-1": admin, "target-1": target });
		creds.countActiveAdministrators = vi.fn().mockResolvedValue(1);

		const result = await disableUser(creds, "admin-1", "target-1", NOW);

		expect(result.success).toBe(false);
		expect(result.reason).toBe("last_administrator");
		expect(creds.updateActive).not.toHaveBeenCalled();
	});

	it("rejects non-administrator disable attempt", async () => {
		const regular = mockUser({ id: "user-1", isAdministrator: 0 });
		const target = mockUser({ id: "target-1" });
		const creds = mockCredentials({ "user-1": regular, "target-1": target });

		const result = await disableUser(creds, "user-1", "target-1", NOW);

		expect(result.success).toBe(false);
		expect(result.reason).toBe("unauthorized");
	});

	it("allows disabling an administrator when others exist", async () => {
		const admin = mockUser({ id: "admin-1", isAdministrator: 1 });
		const target = mockUser({ id: "target-1", isAdministrator: 1 });
		const creds = mockCredentials({ "admin-1": admin, "target-1": target });
		creds.countActiveAdministrators = vi.fn().mockResolvedValue(3);

		const result = await disableUser(creds, "admin-1", "target-1", NOW);

		expect(result.success).toBe(true);
	});
});

describe("reactivateUser", () => {
	it("reactivates a disabled user", async () => {
		const admin = mockUser({ id: "admin-1", isAdministrator: 1 });
		const target = mockUser({ id: "target-1", isActive: 0 });
		const creds = mockCredentials({ "admin-1": admin, "target-1": target });

		const result = await reactivateUser(creds, "admin-1", "target-1", NOW);

		expect(result).toBe(true);
		expect(creds.updateActive).toHaveBeenCalledWith("target-1", true, expect.any(String));
	});

	it("rejects non-administrator reactivation", async () => {
		const regular = mockUser({ id: "user-1", isAdministrator: 0 });
		const creds = mockCredentials({ "user-1": regular });

		expect(await reactivateUser(creds, "user-1", "target-1", NOW)).toBe(false);
	});
});

describe("session management", () => {
	it("lists sessions without exposing digests", async () => {
		const creds = mockCredentials();
		const sessions = await listSessions(creds, "user-1");

		expect(sessions).toHaveLength(2);
		for (const session of sessions) {
			expect(session).not.toHaveProperty("tokenDigest");
			expect(session).not.toHaveProperty("token_digest");
		}
	});

	it("revokes a specific session by id", async () => {
		const creds = mockCredentials();

		const result = await revokeUserSession(creds, "user-1", "s2");

		expect(result).toBe(true);
		expect(creds.deleteSessionById).toHaveBeenCalledWith("s2");
	});
});
