import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import type { Kysely } from "kysely";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { DEVELOPMENT_PASSWORD, DEVELOPMENT_USERNAME, preseedDatabase } from "../../scripts/database/preseed";
import { createUsersRepository } from "../../src/lib/server/auth/repository";
import { verifyPassword } from "../../src/lib/server/auth/password";
import { createDatabase } from "../../src/lib/server/database/db";
import { initial } from "../../src/lib/server/database/migrations/0001_initial";
import { runMigrations } from "../../src/lib/server/database/migrator";
import type { Database } from "../../src/lib/server/database/schema";

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
		await db.deleteFrom("users").execute();
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
				created_at: "2026-01-01T00:00:00.000Z",
				updated_at: "2026-01-01T00:00:00.000Z",
			})
			.execute();

		const result = await preseedDatabase(db, {
			createId: () => "development-user",
			now: () => new Date("2026-08-03T12:00:00.000Z"),
			salt: new Uint8Array(16).fill(7),
		});

		const users = await db.selectFrom("users").selectAll().execute();
		expect(users).toHaveLength(1);
		expect(users[0]).toMatchObject({
			id: "development-user",
			username: DEVELOPMENT_USERNAME,
			created_at: "2026-08-03T12:00:00.000Z",
			updated_at: "2026-08-03T12:00:00.000Z",
		});
		expect(users[0]?.password_hash).not.toBe(DEVELOPMENT_PASSWORD);
		await expect(verifyPassword(DEVELOPMENT_PASSWORD, users[0]!.password_hash)).resolves.toBe(true);
		expect(result).toEqual({ users: 1, username: DEVELOPMENT_USERNAME });
	});

	it("executes the Kysely users repository", async () => {
		await preseedDatabase(db);

		await expect(createUsersRepository(db).findCredentialsByUsername(DEVELOPMENT_USERNAME)).resolves.toMatchObject({
			username: DEVELOPMENT_USERNAME,
		});
	});

	it("enforces canonical username uniqueness", async () => {
		await preseedDatabase(db, { createId: () => "development-user" });

		await expect(
			db
				.insertInto("users")
				.values({
					id: "duplicate-user",
					username: DEVELOPMENT_USERNAME,
					password_hash: "duplicate-hash",
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
});
