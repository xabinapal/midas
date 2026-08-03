import { getPlatformProxy } from "wrangler";
import { createDatabase, runMigrations } from "../src/lib/server/database/index.ts";

const proxy = await getPlatformProxy({ configPath: "wrangler.jsonc", remoteBindings: false });

try {
	const db = createDatabase(proxy.env.DB);
	try {
		const result = await runMigrations(db);

		const applied = result.results?.filter((migration) => migration.status === "Success") ?? [];

		if (applied.length === 0) {
			console.log("No pending migrations. Database is up to date.");
		} else {
			for (const migration of applied) {
				console.log(`Applied migration: ${migration.migrationName}`);
			}
		}
	} finally {
		await db.destroy();
	}
} finally {
	await proxy.dispose();
}
