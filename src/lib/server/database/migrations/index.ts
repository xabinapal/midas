import type { Migration } from "kysely/migration";
import { initial } from "./0001_initial";

export const migrations: Record<string, Migration> = {
	"0001_initial": initial,
};
