import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";

export const initial: Migration = {
	async up(db: Kysely<any>): Promise<void> {
		await db.schema
			.createTable("users")
			.ifNotExists()
			.addColumn("id", "text", (column) => column.primaryKey())
			.addColumn("username", "text", (column) => column.notNull().unique())
			.addColumn("password_hash", "text", (column) => column.notNull())
			.addColumn("created_at", "text", (column) => column.notNull())
			.addColumn("updated_at", "text", (column) => column.notNull())
			.execute();
	},
	async down(db: Kysely<any>): Promise<void> {
		await db.schema.dropTable("users").ifExists().execute();
	},
};
