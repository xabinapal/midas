import { Kysely } from "kysely";
import type { D1Database } from "@cloudflare/workers-types";
import { D1Dialect } from "./d1-dialect";
import type { Database } from "./schema";

export function createDatabase(database: D1Database): Kysely<Database> {
	return new Kysely<Database>({
		dialect: new D1Dialect({ database }),
	});
}
