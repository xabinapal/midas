import type { AuthenticatedUser } from "../../auth/types";
import { normalizeUsername } from "../../auth/login-schema";
import { verifyPassword } from "./password";
import type { UsersRepository } from "./repository";

const DUMMY_PASSWORD_HASH = "pbkdf2-sha256$600000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export async function authenticateUser(
	repository: UsersRepository,
	username: string,
	password: string,
	verify: (password: string, storedHash: string) => Promise<boolean> = verifyPassword,
): Promise<AuthenticatedUser | null> {
	const credentials = await repository.findCredentialsByUsername(normalizeUsername(username));
	const valid = await verify(password, credentials?.passwordHash ?? DUMMY_PASSWORD_HASH);
	if (!credentials || !valid) return null;

	return { id: credentials.id, username: credentials.username };
}
