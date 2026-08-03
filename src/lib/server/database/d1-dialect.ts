import type { DatabaseIntrospector, DatabaseMetadataOptions, Kysely } from "kysely";
import { D1Dialect as KyselyD1Dialect } from "kysely-d1";

interface SqliteTable {
	name: string;
	type: "table" | "view";
}

class D1MigrationIntrospector implements DatabaseIntrospector {
	readonly #db: Kysely<any>;

	constructor(db: Kysely<any>) {
		this.#db = db;
	}

	async getSchemas() {
		return [];
	}

	async getTables(options: DatabaseMetadataOptions = { withInternalKyselyTables: false }) {
		if (!options.withInternalKyselyTables) {
			throw new Error("Full D1 schema introspection is unavailable through the Workers binding");
		}

		const tables = (await this.#db
			.selectFrom("sqlite_master")
			.where("type", "in", ["table", "view"])
			.where("name", "not like", "sqlite_%")
			.select(["name", "type"])
			.orderBy("name")
			.execute()) as SqliteTable[];

		return tables.map((table) => ({
			name: table.name,
			isView: table.type === "view",
			isForeign: false,
			columns: [],
		}));
	}
}

export class D1Dialect extends KyselyD1Dialect {
	override createIntrospector(db: Kysely<any>): DatabaseIntrospector {
		return new D1MigrationIntrospector(db);
	}
}
