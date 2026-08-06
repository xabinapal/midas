import type { Migration } from "kysely/migration";
import { users } from "./0001_users";
import { householdMembersAndAccess } from "./0002_household_members_and_access";
import { financialAccountsAndFunding } from "./0003_financial_accounts_and_funding";
import { expensesAndPlanning } from "./0004_expenses_and_planning";

export const migrations: Record<string, Migration> = {
	"0001_users": users,
	"0002_household_members_and_access": householdMembersAndAccess,
	"0003_financial_accounts_and_funding": financialAccountsAndFunding,
	"0004_expenses_and_planning": expensesAndPlanning,
};
