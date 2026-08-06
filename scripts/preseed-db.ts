import { getPlatformProxy } from "wrangler";
import { preseedDatabase } from "./database/preseed.ts";
import { createDatabase, runMigrations } from "../src/lib/server/database/index.ts";

const proxy = await getPlatformProxy({ configPath: "wrangler.jsonc", remoteBindings: false });

try {
	const db = createDatabase(proxy.env.DB);
	try {
		await runMigrations(db);
		const result = await preseedDatabase(db);

		console.log(
			`Development database preseeded: ${result.households} household, ${result.members} members, ${result.users} users (${result.username}), ${result.accounts} accounts, ${result.transfers} transfers, ${result.expenses} expenses, ${result.payments} payments.`,
		);
	} finally {
		await db.destroy();
	}
} finally {
	await proxy.dispose();
}
