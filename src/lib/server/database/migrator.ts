import { Migrator, type MigrationResultSet } from "kysely/migration";
import type { Kysely } from "kysely";
import type { Database } from "./schema";
import { migrations } from "./migrations";
import { assertSuccessfulMigrationResults } from "./reset";

export function createMigrator(db: Kysely<Database>): Migrator {
	return new Migrator({
		db,
		provider: {
			async getMigrations() {
				return migrations;
			},
		},
		disableTransactions: true,
	});
}

export async function runMigrations(db: Kysely<Database>): Promise<MigrationResultSet> {
	const migrator = createMigrator(db);
	const result = await migrator.migrateToLatest();
	assertSuccessfulMigrationResults(result);
	return result;
}
