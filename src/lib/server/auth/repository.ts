import type { Kysely } from "kysely";
import type { Database } from "../database";

export interface UserRecord {
	id: string;
	username: string;
	passwordHash: string;
	isActive: 0 | 1;
	householdId: string | null;
	isAdministrator: 0 | 1;
	requiresPasswordChange: 0 | 1;
	memberId: string | null;
}

export interface UsersRepository {
	findCredentialsByUsername(username: string): Promise<UserRecord | undefined>;
	findUserById(id: string): Promise<UserRecord | undefined>;
}

const USER_COLUMNS = [
	"id",
	"username",
	"password_hash as passwordHash",
	"is_active as isActive",
	"household_id as householdId",
	"is_administrator as isAdministrator",
	"requires_password_change as requiresPasswordChange",
	"member_id as memberId",
] as const;

export function createUsersRepository(db: Kysely<Database>): UsersRepository {
	return {
		findCredentialsByUsername(username) {
			return db
				.selectFrom("users")
				.select(USER_COLUMNS)
				.where("username", "=", username)
				.where("is_active", "=", 1)
				.executeTakeFirst() as Promise<UserRecord | undefined>;
		},

		findUserById(id) {
			return db.selectFrom("users").select(USER_COLUMNS).where("id", "=", id).executeTakeFirst() as Promise<
				UserRecord | undefined
			>;
		},
	};
}
