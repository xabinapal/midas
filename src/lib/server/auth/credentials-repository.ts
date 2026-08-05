import type { Kysely } from "kysely";
import type { Database } from "../database";
import type { CredentialsRepository, SessionProjection } from "./credentials";
import type { UserRecord } from "./repository";

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

export function createCredentialsRepository(db: Kysely<Database>): CredentialsRepository {
	return {
		async findUserById(id) {
			return db.selectFrom("users").select(USER_COLUMNS).where("id", "=", id).executeTakeFirst() as Promise<
				UserRecord | undefined
			>;
		},

		async updatePassword(userId, passwordHash, requiresChange, now) {
			await db
				.updateTable("users")
				.set({ password_hash: passwordHash, requires_password_change: requiresChange ? 1 : 0, updated_at: now })
				.where("id", "=", userId)
				.execute();
		},

		async updateActive(userId, isActive, now) {
			await db
				.updateTable("users")
				.set({ is_active: isActive ? 1 : 0, updated_at: now })
				.where("id", "=", userId)
				.execute();
		},

		async countActiveAdministrators(householdId) {
			const rows = await db
				.selectFrom("users")
				.select("id")
				.where("household_id", "=", householdId)
				.where("is_active", "=", 1)
				.where("is_administrator", "=", 1)
				.execute();
			return rows.length;
		},

		async deleteSessionsByUser(userId) {
			await db.deleteFrom("sessions").where("user_id", "=", userId).execute();
		},

		async findSessionsByUser(userId) {
			const rows = await db
				.selectFrom("sessions")
				.select(["id", "created_at", "rotated_at", "expires_at"])
				.where("user_id", "=", userId)
				.orderBy("created_at", "desc")
				.execute();
			return rows.map((r) => ({
				id: r.id,
				createdAt: r.created_at,
				rotatedAt: r.rotated_at,
				expiresAt: r.expires_at,
			})) satisfies SessionProjection[];
		},

		async deleteSessionById(sessionId) {
			await db.deleteFrom("sessions").where("id", "=", sessionId).execute();
		},
	};
}
