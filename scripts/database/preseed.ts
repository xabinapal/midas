import type { Kysely } from "kysely";
import { hashPassword } from "../../src/lib/server/auth/password";
import type { Database } from "../../src/lib/server/database/schema";

const APPLICATION_TABLES_IN_DELETE_ORDER = ["users"] as const satisfies readonly (keyof Database)[];

export const DEVELOPMENT_USERNAME = "developer";
export const DEVELOPMENT_PASSWORD = "development-password";

export interface PreseedResult {
	users: number;
	username: string;
}

export interface PreseedOptions {
	createId?: () => string;
	now?: () => Date;
	salt?: Uint8Array<ArrayBuffer>;
}

export async function preseedDatabase(
	db: Kysely<Database>,
	{ createId = () => crypto.randomUUID(), now = () => new Date(), salt }: PreseedOptions = {},
): Promise<PreseedResult> {
	for (const table of APPLICATION_TABLES_IN_DELETE_ORDER) {
		await db.deleteFrom(table).execute();
	}

	const timestamp = now().toISOString();
	await db
		.insertInto("users")
		.values({
			id: createId(),
			username: DEVELOPMENT_USERNAME,
			password_hash: await hashPassword(DEVELOPMENT_PASSWORD, salt),
			household_id: null,
			member_id: null,
			is_active: 1,
			is_administrator: 0,
			requires_password_change: 0,
			created_at: timestamp,
			updated_at: timestamp,
		})
		.execute();

	return { users: 1, username: DEVELOPMENT_USERNAME };
}
