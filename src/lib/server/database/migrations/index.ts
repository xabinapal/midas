import type { Migration } from "kysely/migration";
import { initial } from "./0001_initial";
import { householdMembersAndAccess } from "./0002_household_members_and_access";

export const migrations: Record<string, Migration> = {
	"0001_initial": initial,
	"0002_household_members_and_access": householdMembersAndAccess,
};
