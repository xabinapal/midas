import type { UserRecord, UsersRepository } from "./repository";
import { verifyPassword, hashPassword } from "./password";
import { logger } from "../logger";

export interface CredentialsRepository {
	findUserById(id: string): Promise<UserRecord | undefined>;
	updatePassword(userId: string, passwordHash: string, requiresChange: boolean, now: string): Promise<void>;
	updateActive(userId: string, isActive: boolean, now: string): Promise<void>;
	countActiveAdministrators(householdId: string): Promise<number>;
	deleteSessionsByUser(userId: string): Promise<void>;
	findSessionsByUser(userId: string): Promise<SessionProjection[]>;
	deleteSessionById(sessionId: string): Promise<void>;
}

export interface SessionProjection {
	id: string;
	createdAt: string;
	rotatedAt: string;
	expiresAt: string;
}

export interface PasswordChangeResult {
	rotatedToken: string;
}

const DUMMY_PASSWORD_HASH = "pbkdf2-sha256$600000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export async function changeOwnPassword(
	credentials: CredentialsRepository,
	_users: UsersRepository,
	userId: string,
	currentPassword: string,
	newPassword: string,
	_sessionId: string,
	_householdId: string,
	now: number,
	verify: (password: string, storedHash: string) => Promise<boolean> = verifyPassword,
	hash: (password: string) => Promise<string> = hashPassword,
): Promise<PasswordChangeResult | null> {
	const user = await credentials.findUserById(userId);
	if (!user || !user.isActive) return null;

	const valid = await verify(currentPassword, user.passwordHash ?? DUMMY_PASSWORD_HASH);
	if (!valid) return null;

	const newHash = await hash(newPassword);
	const nowIso = new Date(now * 1000).toISOString();
	await credentials.updatePassword(userId, newHash, false, nowIso);
	await credentials.deleteSessionsByUser(userId);

	return { rotatedToken: "rotation-not-implemented-in-unit" };
}

export async function adminResetPassword(
	credentials: CredentialsRepository,
	adminUserId: string,
	targetUserId: string,
	temporaryPassword: string,
	now: number,
	hash: (password: string) => Promise<string> = hashPassword,
): Promise<boolean> {
	const admin = await credentials.findUserById(adminUserId);
	if (!admin || !admin.isActive || !admin.isAdministrator) return false;

	const target = await credentials.findUserById(targetUserId);
	if (!target || !target.householdId || target.householdId !== admin.householdId) return false;

	const tempHash = await hash(temporaryPassword);
	const nowIso = new Date(now * 1000).toISOString();
	await credentials.updatePassword(targetUserId, tempHash, true, nowIso);
	await credentials.deleteSessionsByUser(targetUserId);

	logger.info("password reset by administrator", { adminUserId, targetUserId });
	return true;
}

export async function disableUser(
	credentials: CredentialsRepository,
	adminUserId: string,
	targetUserId: string,
	now: number,
): Promise<{ success: boolean; reason?: string }> {
	const admin = await credentials.findUserById(adminUserId);
	if (!admin || !admin.isActive || !admin.isAdministrator) {
		return { success: false, reason: "unauthorized" };
	}

	const target = await credentials.findUserById(targetUserId);
	if (!target || !target.householdId || target.householdId !== admin.householdId) {
		return { success: false, reason: "not_found" };
	}

	if (target.isAdministrator) {
		const adminCount = await credentials.countActiveAdministrators(target.householdId);
		if (adminCount <= 1) {
			return { success: false, reason: "last_administrator" };
		}
	}

	const nowIso = new Date(now * 1000).toISOString();
	await credentials.updateActive(targetUserId, false, nowIso);
	await credentials.deleteSessionsByUser(targetUserId);

	logger.info("user disabled", { adminUserId, targetUserId });
	return { success: true };
}

export async function reactivateUser(
	credentials: CredentialsRepository,
	adminUserId: string,
	targetUserId: string,
	now: number,
): Promise<boolean> {
	const admin = await credentials.findUserById(adminUserId);
	if (!admin || !admin.isActive || !admin.isAdministrator) return false;

	const target = await credentials.findUserById(targetUserId);
	if (!target || !target.householdId || target.householdId !== admin.householdId) return false;

	const nowIso = new Date(now * 1000).toISOString();
	await credentials.updateActive(targetUserId, true, nowIso);

	logger.info("user reactivated", { adminUserId, targetUserId });
	return true;
}

export async function listSessions(credentials: CredentialsRepository, userId: string): Promise<SessionProjection[]> {
	return credentials.findSessionsByUser(userId);
}

export async function revokeUserSession(
	credentials: CredentialsRepository,
	_userId: string,
	sessionId: string,
): Promise<boolean> {
	await credentials.deleteSessionById(sessionId);
	return true;
}
