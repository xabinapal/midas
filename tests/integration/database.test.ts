import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import type { Kysely } from "kysely";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { DEVELOPMENT_PASSWORD, DEVELOPMENT_USERNAME, preseedDatabase } from "../../scripts/database/preseed";
import { createUsersRepository } from "../../src/lib/server/auth/repository";
import { verifyPassword } from "../../src/lib/server/auth/password";
import { digestBearerToken } from "../../src/lib/server/auth/session-tokens";
import { createDatabase } from "../../src/lib/server/database/db";
import { initial } from "../../src/lib/server/database/migrations/0001_initial";
import { householdMembersAndAccess } from "../../src/lib/server/database/migrations/0002_household_members_and_access";
import { runMigrations } from "../../src/lib/server/database/migrator";
import type { Database } from "../../src/lib/server/database/schema";

const ALL_TABLES = [
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

function sequentialId() {
	let n = 0;
	return () => `id-${++n}`;
}

describe.sequential("D1 integration", () => {
	let proxy: PlatformProxy<{ DB: D1Database }>;
	let db: Kysely<Database>;

	beforeAll(async () => {
		proxy = await getPlatformProxy({
			configPath: "wrangler.jsonc",
			persist: false,
			remoteBindings: false,
		});
		db = createDatabase(proxy.env.DB);
		await runMigrations(db);
	});

	beforeEach(async () => {
		for (const table of ALL_TABLES) {
			await db.deleteFrom(table).execute();
		}
	});

	afterAll(async () => {
		await db?.destroy();
		await proxy?.dispose();
	});

	it("clears application tables before inserting useful development data", async () => {
		await db
			.insertInto("users")
			.values({
				id: "stale-user",
				username: "stale",
				password_hash: "not-a-real-hash",
				household_id: null,
				member_id: null,
				is_active: 1,
				is_administrator: 0,
				requires_password_change: 0,
				created_at: "2026-01-01T00:00:00.000Z",
				updated_at: "2026-01-01T00:00:00.000Z",
			})
			.execute();

		const result = await preseedDatabase(db, {
			createId: sequentialId(),
			now: () => new Date("2026-08-03T12:00:00.000Z"),
			salt: new Uint8Array(16).fill(7),
		});

		const users = await db.selectFrom("users").selectAll().execute();
		expect(users).toHaveLength(2);
		expect(users[0]).toMatchObject({
			username: DEVELOPMENT_USERNAME,
			is_administrator: 1,
			created_at: "2026-08-03T12:00:00.000Z",
		});
		expect(users[0]?.password_hash).not.toBe(DEVELOPMENT_PASSWORD);
		await expect(verifyPassword(DEVELOPMENT_PASSWORD, users[0]!.password_hash)).resolves.toBe(true);
		expect(result).toMatchObject({ households: 1, members: 3, users: 2, username: DEVELOPMENT_USERNAME });
	});

	it("executes the Kysely users repository", async () => {
		await preseedDatabase(db);

		await expect(createUsersRepository(db).findCredentialsByUsername(DEVELOPMENT_USERNAME)).resolves.toMatchObject({
			username: DEVELOPMENT_USERNAME,
			householdId: expect.any(String),
		});
	});

	it("enforces canonical username uniqueness", async () => {
		await preseedDatabase(db, { createId: sequentialId() });

		await expect(
			db
				.insertInto("users")
				.values({
					id: "duplicate-user",
					username: DEVELOPMENT_USERNAME,
					password_hash: "duplicate-hash",
					household_id: null,
					member_id: null,
					is_active: 1,
					is_administrator: 0,
					requires_password_change: 0,
					created_at: "2026-08-03T12:00:00.000Z",
					updated_at: "2026-08-03T12:00:00.000Z",
				})
				.execute(),
		).rejects.toThrow();
	});

	it("keeps the initial migration replay-safe", async () => {
		await initial.up(db);
		await initial.up(db);

		await expect(db.selectFrom("users").selectAll().execute()).resolves.toEqual([]);
	});

	it("discovers tables and views for migrations", async () => {
		await db.schema.createView("users_view").as(db.selectFrom("users").selectAll()).execute();

		try {
			const tables = await db.introspection.getTables({ withInternalKyselyTables: true });
			expect(tables.find(({ name }) => name === "users")).toMatchObject({ isView: false });
			expect(tables.find(({ name }) => name === "users_view")).toMatchObject({ isView: true });
		} finally {
			await db.schema.dropView("users_view").ifExists().execute();
		}
	});

	it("rejects unsupported general schema introspection", async () => {
		await expect(db.introspection.getTables()).rejects.toThrow("Full D1 schema introspection is unavailable");
	});

	it("keeps the household migration replay-safe", async () => {
		await householdMembersAndAccess.up(db);
		await householdMembersAndAccess.up(db);

		await expect(db.selectFrom("households").selectAll().execute()).resolves.toEqual([]);
	});

	it("reverses the household migration cleanly", async () => {
		await householdMembersAndAccess.down!(db);

		await expect(db.selectFrom("sessions").selectAll().execute()).rejects.toThrow();
		await expect(db.selectFrom("households").selectAll().execute()).rejects.toThrow();

		await householdMembersAndAccess.up(db);
	});

	it("enforces session token digest uniqueness", async () => {
		const ts = "2026-08-04T12:00:00.000Z";
		await db
			.insertInto("households")
			.values({
				id: "hh-1",
				name: "Test",
				currency: "EUR",
				timezone: "Europe/Madrid",
				locale: "es-ES",
				version: "v1",
				created_at: ts,
				updated_at: ts,
			})
			.execute();
		await db
			.insertInto("users")
			.values({
				id: "u1",
				username: "test",
				password_hash: "hash",
				household_id: "hh-1",
				member_id: null,
				is_active: 1,
				is_administrator: 0,
				requires_password_change: 0,
				created_at: ts,
				updated_at: ts,
			})
			.execute();

		const digest = "deadbeef";
		await db
			.insertInto("sessions")
			.values({
				id: "s1",
				user_id: "u1",
				household_id: "hh-1",
				token_digest: digest,
				created_at: ts,
				rotated_at: ts,
				expires_at: ts,
			})
			.execute();

		await expect(
			db
				.insertInto("sessions")
				.values({
					id: "s2",
					user_id: "u1",
					household_id: "hh-1",
					token_digest: digest,
					created_at: ts,
					rotated_at: ts,
					expires_at: ts,
				})
				.execute(),
		).rejects.toThrow();
	});

	it("looks up a session by bearer token digest", async () => {
		const ts = "2026-08-04T12:00:00.000Z";
		await db
			.insertInto("households")
			.values({
				id: "hh-1",
				name: "Test",
				currency: "EUR",
				timezone: "Europe/Madrid",
				locale: "es-ES",
				version: "v1",
				created_at: ts,
				updated_at: ts,
			})
			.execute();
		await db
			.insertInto("users")
			.values({
				id: "u1",
				username: "test",
				password_hash: "hash",
				household_id: "hh-1",
				member_id: null,
				is_active: 1,
				is_administrator: 0,
				requires_password_change: 0,
				created_at: ts,
				updated_at: ts,
			})
			.execute();

		const token = "test-bearer-token-for-digest";
		const digest = await digestBearerToken(token);
		await db
			.insertInto("sessions")
			.values({
				id: "s1",
				user_id: "u1",
				household_id: "hh-1",
				token_digest: digest,
				created_at: ts,
				rotated_at: ts,
				expires_at: "2099-01-01T00:00:00.000Z",
			})
			.execute();

		const found = await db.selectFrom("sessions").selectAll().where("token_digest", "=", digest).executeTakeFirst();

		expect(found).toBeDefined();
		expect(found?.user_id).toBe("u1");
	});

	it("verifies preseed creates complete household structure", async () => {
		await preseedDatabase(db, { createId: sequentialId() });

		const households = await db.selectFrom("households").selectAll().execute();
		expect(households).toHaveLength(1);
		expect(households[0]?.currency).toBe("EUR");

		const members = await db.selectFrom("members").selectAll().execute();
		expect(members).toHaveLength(3);
		expect(members.filter((m) => m.is_active === 1)).toHaveLength(2);

		const users = await db.selectFrom("users").selectAll().execute();
		expect(users).toHaveLength(2);
		expect(users.filter((u) => u.is_administrator === 1)).toHaveLength(1);

		const gate = await db.selectFrom("bootstrap_gate").selectAll().executeTakeFirst();
		expect(gate?.state).toBe("complete");
	});
});
