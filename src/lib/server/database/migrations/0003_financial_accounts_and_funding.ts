import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";

export const financialAccountsAndFunding: Migration = {
	async up(db: Kysely<any>): Promise<void> {
		// Financial accounts: explicit personal/shared classification, draft →
		// active → closed lifecycle, household currency in minor units.
		await db.schema
			.createTable("accounts")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("household_id", "text", (col) => col.notNull().references("households.id"))
			.addColumn("name", "text", (col) => col.notNull())
			.addColumn("classification", "text", (col) => col.notNull())
			.addColumn("status", "text", (col) => col.notNull().defaultTo("draft"))
			.addColumn("currency", "text", (col) => col.notNull())
			.addColumn("created_at", "text", (col) => col.notNull())
			.addColumn("updated_at", "text", (col) => col.notNull())
			.execute();

		await db.schema
			.createIndex("idx_accounts_household")
			.ifNotExists()
			.on("accounts")
			.columns(["household_id", "status"])
			.execute();

		// Effective-dated holder intervals; personal accounts keep exactly one
		// open interval, shared accounts at least two.
		await db.schema
			.createTable("account_holder_intervals")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("account_id", "text", (col) => col.notNull().references("accounts.id"))
			.addColumn("member_id", "text", (col) => col.notNull().references("members.id"))
			.addColumn("effective_from", "text", (col) => col.notNull())
			.addColumn("effective_to", "text")
			.addColumn("operation_id", "text", (col) => col.references("operation_roots.id"))
			.execute();

		await db.schema
			.createIndex("idx_account_holder_intervals_account")
			.ifNotExists()
			.on("account_holder_intervals")
			.columns(["account_id", "effective_from"])
			.execute();

		await db.schema
			.createIndex("idx_account_holder_intervals_member")
			.ifNotExists()
			.on("account_holder_intervals")
			.column("member_id")
			.execute();

		// Dated manual balance observations; corrections invalidate and
		// optionally replace, never negate.
		await db.schema
			.createTable("balance_observations")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("account_id", "text", (col) => col.notNull().references("accounts.id"))
			.addColumn("amount_minor", "integer", (col) => col.notNull())
			.addColumn("effective_at", "text", (col) => col.notNull())
			.addColumn("ordering_key", "text", (col) => col.notNull())
			.addColumn("recorded_at", "text", (col) => col.notNull())
			.addColumn("status", "text", (col) => col.notNull().defaultTo("valid"))
			.addColumn("replaces_observation_id", "text", (col) => col.references("balance_observations.id"))
			.addColumn("invalidated_at", "text")
			.addColumn("operation_id", "text", (col) => col.references("operation_roots.id"))
			.execute();

		await db.schema
			.createIndex("idx_balance_observations_account")
			.ifNotExists()
			.on("balance_observations")
			.columns(["account_id", "ordering_key"])
			.execute();

		// One authoritative posted movement between two distinct accounts.
		// Reversals and replacements link back and inherit the chain root and
		// ordering key of the original.
		await db.schema
			.createTable("account_transfers")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("household_id", "text", (col) => col.notNull().references("households.id"))
			.addColumn("source_account_id", "text", (col) => col.notNull().references("accounts.id"))
			.addColumn("destination_account_id", "text", (col) => col.notNull().references("accounts.id"))
			.addColumn("amount_minor", "integer", (col) => col.notNull())
			.addColumn("effective_at", "text", (col) => col.notNull())
			.addColumn("ordering_key", "text", (col) => col.notNull())
			.addColumn("recorded_at", "text", (col) => col.notNull())
			.addColumn("description", "text", (col) => col.notNull().defaultTo(""))
			.addColumn("classification", "text", (col) => col.notNull().defaultTo("unclassified"))
			.addColumn("status", "text", (col) => col.notNull().defaultTo("posted"))
			.addColumn("chain_root_id", "text", (col) => col.notNull().references("account_transfers.id"))
			.addColumn("reversal_of_id", "text", (col) => col.references("account_transfers.id"))
			.addColumn("replaces_id", "text", (col) => col.references("account_transfers.id"))
			.addColumn("reversed_by_id", "text", (col) => col.references("account_transfers.id"))
			.addColumn("operation_id", "text", (col) => col.references("operation_roots.id"))
			.addColumn("created_at", "text", (col) => col.notNull())
			.execute();

		await db.schema
			.createIndex("idx_account_transfers_household")
			.ifNotExists()
			.on("account_transfers")
			.columns(["household_id", "recorded_at"])
			.execute();

		await db.schema
			.createIndex("idx_account_transfers_source")
			.ifNotExists()
			.on("account_transfers")
			.column("source_account_id")
			.execute();

		await db.schema
			.createIndex("idx_account_transfers_destination")
			.ifNotExists()
			.on("account_transfers")
			.column("destination_account_id")
			.execute();

		await db.schema
			.createIndex("idx_account_transfers_operation")
			.ifNotExists()
			.on("account_transfers")
			.column("operation_id")
			.execute();

		// Exact debit/credit projections derived from each transfer row.
		await db.schema
			.createTable("account_entries")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("account_id", "text", (col) => col.notNull().references("accounts.id"))
			.addColumn("transfer_id", "text", (col) => col.notNull().references("account_transfers.id"))
			.addColumn("chain_root_id", "text", (col) => col.notNull())
			.addColumn("amount_minor", "integer", (col) => col.notNull())
			.addColumn("effective_at", "text", (col) => col.notNull())
			.addColumn("ordering_key", "text", (col) => col.notNull())
			.addColumn("recorded_at", "text", (col) => col.notNull())
			.addColumn("operation_id", "text", (col) => col.references("operation_roots.id"))
			.execute();

		await db.schema
			.createIndex("idx_account_entries_account")
			.ifNotExists()
			.on("account_entries")
			.columns(["account_id", "ordering_key"])
			.execute();

		await db.schema
			.createIndex("idx_account_entries_transfer")
			.ifNotExists()
			.on("account_entries")
			.column("transfer_id")
			.execute();

		// Contributions: personal-to-shared value attributed to one member.
		await db.schema
			.createTable("contributions")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("household_id", "text", (col) => col.notNull().references("households.id"))
			.addColumn("transfer_id", "text", (col) => col.notNull().references("account_transfers.id"))
			.addColumn("member_id", "text", (col) => col.notNull().references("members.id"))
			.addColumn("amount_minor", "integer", (col) => col.notNull())
			.addColumn("status", "text", (col) => col.notNull().defaultTo("posted"))
			.addColumn("recorded_at", "text", (col) => col.notNull())
			.addColumn("operation_id", "text", (col) => col.references("operation_roots.id"))
			.execute();

		// Exactly one funding classification per transfer
		await db.schema
			.createIndex("idx_contributions_transfer")
			.ifNotExists()
			.on("contributions")
			.column("transfer_id")
			.unique()
			.execute();

		await db.schema
			.createIndex("idx_contributions_household")
			.ifNotExists()
			.on("contributions")
			.columns(["household_id", "recorded_at"])
			.execute();

		await db.schema
			.createTable("contribution_allocations")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("contribution_id", "text", (col) => col.notNull().references("contributions.id"))
			.addColumn("member_id", "text", (col) => col.notNull().references("members.id"))
			.addColumn("amount_minor", "integer", (col) => col.notNull())
			.execute();

		await db.schema
			.createIndex("idx_contribution_allocations_contribution")
			.ifNotExists()
			.on("contribution_allocations")
			.column("contribution_id")
			.execute();

		await db.schema
			.createIndex("idx_contribution_allocations_member")
			.ifNotExists()
			.on("contribution_allocations")
			.column("member_id")
			.execute();

		// Distributions: shared-to-personal value returned to one member.
		await db.schema
			.createTable("distributions")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("household_id", "text", (col) => col.notNull().references("households.id"))
			.addColumn("transfer_id", "text", (col) => col.notNull().references("account_transfers.id"))
			.addColumn("member_id", "text", (col) => col.notNull().references("members.id"))
			.addColumn("amount_minor", "integer", (col) => col.notNull())
			.addColumn("status", "text", (col) => col.notNull().defaultTo("posted"))
			.addColumn("recorded_at", "text", (col) => col.notNull())
			.addColumn("operation_id", "text", (col) => col.references("operation_roots.id"))
			.execute();

		await db.schema
			.createIndex("idx_distributions_transfer")
			.ifNotExists()
			.on("distributions")
			.column("transfer_id")
			.unique()
			.execute();

		await db.schema
			.createIndex("idx_distributions_household")
			.ifNotExists()
			.on("distributions")
			.columns(["household_id", "recorded_at"])
			.execute();

		await db.schema
			.createTable("distribution_allocations")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("distribution_id", "text", (col) => col.notNull().references("distributions.id"))
			.addColumn("member_id", "text", (col) => col.notNull().references("members.id"))
			.addColumn("amount_minor", "integer", (col) => col.notNull())
			.execute();

		await db.schema
			.createIndex("idx_distribution_allocations_distribution")
			.ifNotExists()
			.on("distribution_allocations")
			.column("distribution_id")
			.execute();

		await db.schema
			.createIndex("idx_distribution_allocations_member")
			.ifNotExists()
			.on("distribution_allocations")
			.column("member_id")
			.execute();
	},

	async down(db: Kysely<any>): Promise<void> {
		await db.schema.dropIndex("idx_distribution_allocations_member").ifExists().execute();
		await db.schema.dropIndex("idx_distribution_allocations_distribution").ifExists().execute();
		await db.schema.dropTable("distribution_allocations").ifExists().execute();
		await db.schema.dropIndex("idx_distributions_household").ifExists().execute();
		await db.schema.dropIndex("idx_distributions_transfer").ifExists().execute();
		await db.schema.dropTable("distributions").ifExists().execute();
		await db.schema.dropIndex("idx_contribution_allocations_member").ifExists().execute();
		await db.schema.dropIndex("idx_contribution_allocations_contribution").ifExists().execute();
		await db.schema.dropTable("contribution_allocations").ifExists().execute();
		await db.schema.dropIndex("idx_contributions_household").ifExists().execute();
		await db.schema.dropIndex("idx_contributions_transfer").ifExists().execute();
		await db.schema.dropTable("contributions").ifExists().execute();
		await db.schema.dropIndex("idx_account_entries_transfer").ifExists().execute();
		await db.schema.dropIndex("idx_account_entries_account").ifExists().execute();
		await db.schema.dropTable("account_entries").ifExists().execute();
		await db.schema.dropIndex("idx_account_transfers_operation").ifExists().execute();
		await db.schema.dropIndex("idx_account_transfers_destination").ifExists().execute();
		await db.schema.dropIndex("idx_account_transfers_source").ifExists().execute();
		await db.schema.dropIndex("idx_account_transfers_household").ifExists().execute();
		await db.schema.dropTable("account_transfers").ifExists().execute();
		await db.schema.dropIndex("idx_balance_observations_account").ifExists().execute();
		await db.schema.dropTable("balance_observations").ifExists().execute();
		await db.schema.dropIndex("idx_account_holder_intervals_member").ifExists().execute();
		await db.schema.dropIndex("idx_account_holder_intervals_account").ifExists().execute();
		await db.schema.dropTable("account_holder_intervals").ifExists().execute();
		await db.schema.dropIndex("idx_accounts_household").ifExists().execute();
		await db.schema.dropTable("accounts").ifExists().execute();
	},
};
