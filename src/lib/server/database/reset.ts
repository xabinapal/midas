import type { Migration, MigrationResultSet } from "kysely/migration";

export function assertMigrationsResettable(migrations: Record<string, Migration>): void {
	const irreversible = Object.entries(migrations)
		.filter(([, migration]) => migration.down === undefined)
		.map(([name]) => name);

	if (irreversible.length > 0) {
		throw new Error(`Database reset requires down methods for: ${irreversible.join(", ")}`);
	}
}

export function assertSuccessfulMigrationResults(result: MigrationResultSet): void {
	if (result.error) throw result.error;

	const incomplete = result.results?.filter(({ status }) => status !== "Success") ?? [];
	if (incomplete.length > 0) {
		throw new Error(`Migrations did not complete: ${incomplete.map(({ migrationName }) => migrationName).join(", ")}`);
	}
}
