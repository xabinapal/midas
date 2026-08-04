import type { AuthenticatedUser } from "../../auth/types";
import { normalizeUsername } from "../../auth/login-schema";
import { verifyPassword } from "./password";
import type { UserRecord, UsersRepository } from "./repository";

const DUMMY_PASSWORD_HASH = "pbkdf2-sha256$600000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export function toAuthenticatedUser(record: UserRecord): AuthenticatedUser | null {
	if (!record.householdId) return null;
	return {
		id: record.id,
		username: record.username,
		householdId: record.householdId,
		isAdministrator: record.isAdministrator === 1,
		requiresPasswordChange: record.requiresPasswordChange === 1,
		memberId: record.memberId,
	};
}

export async function authenticateUser(
	repository: UsersRepository,
	username: string,
	password: string,
	verify: (password: string, storedHash: string) => Promise<boolean> = verifyPassword,
): Promise<AuthenticatedUser | null> {
	const credentials = await repository.findCredentialsByUsername(normalizeUsername(username));
	const valid = await verify(password, credentials?.passwordHash ?? DUMMY_PASSWORD_HASH);
	if (!credentials || !valid) return null;

	return toAuthenticatedUser(credentials);
}
