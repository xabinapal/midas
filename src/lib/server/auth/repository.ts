import type { Kysely } from "kysely";
import type { Database } from "../database";

export interface UserCredentials {
	id: string;
	username: string;
	passwordHash: string;
}

export interface UsersRepository {
	findCredentialsByUsername(username: string): Promise<UserCredentials | undefined>;
}

export function createUsersRepository(db: Kysely<Database>): UsersRepository {
	return {
		findCredentialsByUsername(username) {
			return db
				.selectFrom("users")
				.select(["id", "username", "password_hash as passwordHash"])
				.where("username", "=", username)
				.executeTakeFirst();
		},
	};
}
