import type { Kysely } from "kysely";
import { hashPassword } from "../../src/lib/server/auth/password";
import type { Database } from "../../src/lib/server/database/schema";

const APPLICATION_TABLES_IN_DELETE_ORDER = [
	"consumed_recovery_credentials",
	"activity_events",
	"sessions",
	"member_intervals",
	"members",
	"users",
	"operation_roots",
	"household_command_gates",
	"households",
	"bootstrap_gate",
] as const satisfies readonly (keyof Database)[];

export const DEVELOPMENT_USERNAME = "developer";
export const DEVELOPMENT_PASSWORD = "development-password";

export interface PreseedResult {
	households: number;
	members: number;
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
	const householdId = createId();
	const adminMemberId = createId();
	const regularMemberId = createId();
	const inactiveMemberId = createId();

	await db
		.insertInto("bootstrap_gate")
		.values({
			id: 1,
			state: "complete",
			operation_id: null,
			lease_expires_at: null,
			completed_at: timestamp,
		})
		.execute();

	await db
		.insertInto("households")
		.values({
			id: householdId,
			name: "Piso",
			currency: "EUR",
			timezone: "Europe/Madrid",
			locale: "es-ES",
			version: createId(),
			created_at: timestamp,
			updated_at: timestamp,
		})
		.execute();

	await db
		.insertInto("members")
		.values([
			{
				id: adminMemberId,
				household_id: householdId,
				display_name: "Alex",
				is_active: 1,
				created_at: timestamp,
				updated_at: timestamp,
			},
			{
				id: regularMemberId,
				household_id: householdId,
				display_name: "Sam",
				is_active: 1,
				created_at: timestamp,
				updated_at: timestamp,
			},
			{
				id: inactiveMemberId,
				household_id: householdId,
				display_name: "Jordan",
				is_active: 0,
				created_at: timestamp,
				updated_at: timestamp,
			},
		])
		.execute();

	const passwordHash = await hashPassword(DEVELOPMENT_PASSWORD, salt);

	await db
		.insertInto("users")
		.values([
			{
				id: createId(),
				username: DEVELOPMENT_USERNAME,
				password_hash: passwordHash,
				household_id: householdId,
				member_id: adminMemberId,
				is_active: 1,
				is_administrator: 1,
				requires_password_change: 0,
				created_at: timestamp,
				updated_at: timestamp,
			},
			{
				id: createId(),
				username: "user",
				password_hash: passwordHash,
				household_id: householdId,
				member_id: regularMemberId,
				is_active: 1,
				is_administrator: 0,
				requires_password_change: 0,
				created_at: timestamp,
				updated_at: timestamp,
			},
		])
		.execute();

	return { households: 1, members: 3, users: 2, username: DEVELOPMENT_USERNAME };
}
