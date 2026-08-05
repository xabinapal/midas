import type { Migration } from "kysely/migration";
import { users } from "./0001_users";
import { householdMembersAndAccess } from "./0002_household_members_and_access";

export const migrations: Record<string, Migration> = {
	"0001_users": users,
	"0002_household_members_and_access": householdMembersAndAccess,
};
