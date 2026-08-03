import { NO_MIGRATIONS } from "kysely/migration";
import { getPlatformProxy } from "wrangler";
import { createDatabase, createMigrator } from "../src/lib/server/database/index.ts";
import { migrations } from "../src/lib/server/database/migrations/index.ts";
import { assertMigrationsResettable, assertSuccessfulMigrationResults } from "../src/lib/server/database/reset.ts";

assertMigrationsResettable(migrations);
const proxy = await getPlatformProxy({ configPath: "wrangler.jsonc", remoteBindings: false });

try {
	const db = createDatabase(proxy.env.DB);
	try {
		const migrator = createMigrator(db);

		const rolledBack = await migrator.migrateTo(NO_MIGRATIONS);
		assertSuccessfulMigrationResults(rolledBack);

		const reApplied = await migrator.migrateToLatest();
		assertSuccessfulMigrationResults(reApplied);

		const applied = reApplied.results?.filter((migration) => migration.status === "Success") ?? [];

		if (applied.length === 0) {
			console.log("Database reset. No migrations to re-apply.");
		} else {
			console.log("Database reset from scratch:");
			for (const migration of applied) {
				console.log(`  Re-applied: ${migration.migrationName}`);
			}
		}
	} finally {
		await db.destroy();
	}
} finally {
	await proxy.dispose();
}
