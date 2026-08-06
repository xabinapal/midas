import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";

export const expensesAndPlanning: Migration = {
	async up(db: Kysely<any>): Promise<void> {
		// Expense categories: stable slug per household, active lifecycle, never
		// hard-deleted once referenced.
		await db.schema
			.createTable("expense_categories")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("household_id", "text", (col) => col.notNull().references("households.id"))
			.addColumn("name", "text", (col) => col.notNull())
			.addColumn("slug", "text", (col) => col.notNull())
			.addColumn("ordering", "integer", (col) => col.notNull().defaultTo(0))
			.addColumn("is_active", "integer", (col) => col.notNull().defaultTo(1))
			.addColumn("created_at", "text", (col) => col.notNull())
			.addColumn("updated_at", "text", (col) => col.notNull())
			.addColumn("operation_id", "text", (col) => col.references("operation_roots.id"))
			.execute();

		await db.schema
			.createIndex("idx_expense_categories_household_slug")
			.ifNotExists()
			.on("expense_categories")
			.columns(["household_id", "slug"])
			.unique()
			.execute();

		await db.schema
			.createIndex("idx_expense_categories_household")
			.ifNotExists()
			.on("expense_categories")
			.columns(["household_id", "is_active"])
			.execute();

		// Reporting periods: one standard calendar month per household/slug plus
		// optional explicitly labeled custom periods. End date is exclusive.
		await db.schema
			.createTable("reporting_periods")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("household_id", "text", (col) => col.notNull().references("households.id"))
			.addColumn("slug", "text", (col) => col.notNull())
			.addColumn("label", "text", (col) => col.notNull())
			.addColumn("start_date", "text", (col) => col.notNull())
			.addColumn("end_date", "text", (col) => col.notNull())
			.addColumn("kind", "text", (col) => col.notNull().defaultTo("standard"))
			.addColumn("created_at", "text", (col) => col.notNull())
			.addColumn("operation_id", "text", (col) => col.references("operation_roots.id"))
			.execute();

		await db.schema
			.createIndex("idx_reporting_periods_household_slug")
			.ifNotExists()
			.on("reporting_periods")
			.columns(["household_id", "slug"])
			.unique()
			.execute();

		await db.schema
			.createIndex("idx_reporting_periods_household_start")
			.ifNotExists()
			.on("reporting_periods")
			.columns(["household_id", "start_date"])
			.execute();

		// Recurring templates: prospective cadence definitions; edits never
		// rewrite already generated occurrences.
		await db.schema
			.createTable("recurring_templates")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("household_id", "text", (col) => col.notNull().references("households.id"))
			.addColumn("category_id", "text", (col) => col.notNull().references("expense_categories.id"))
			.addColumn("description", "text", (col) => col.notNull())
			.addColumn("estimated_amount_minor", "integer", (col) => col.notNull())
			.addColumn("cadence", "text", (col) => col.notNull())
			.addColumn("interval_count", "integer", (col) => col.notNull().defaultTo(1))
			.addColumn("start_date", "text", (col) => col.notNull())
			.addColumn("end_date", "text")
			.addColumn("due_day", "integer")
			.addColumn("service_span_months", "integer")
			.addColumn("account_hint_id", "text", (col) => col.references("accounts.id"))
			.addColumn("allocation_method", "text", (col) => col.notNull())
			.addColumn("status", "text", (col) => col.notNull().defaultTo("active"))
			.addColumn("created_at", "text", (col) => col.notNull())
			.addColumn("updated_at", "text", (col) => col.notNull())
			.addColumn("operation_id", "text", (col) => col.references("operation_roots.id"))
			.execute();

		await db.schema
			.createIndex("idx_recurring_templates_household")
			.ifNotExists()
			.on("recurring_templates")
			.columns(["household_id", "status"])
			.execute();

		// Template allocation method parameters: the selected member subset
		// (value NULL for equal/default-weight) plus weights or basis points.
		await db.schema
			.createTable("recurring_template_allocation_params")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("template_id", "text", (col) => col.notNull().references("recurring_templates.id"))
			.addColumn("member_id", "text", (col) => col.notNull().references("members.id"))
			.addColumn("value", "real")
			.execute();

		await db.schema
			.createIndex("idx_recurring_template_allocation_params_template")
			.ifNotExists()
			.on("recurring_template_allocation_params")
			.column("template_id")
			.execute();

		// Expenses: consumption recognized independently from payment. Planned
		// and actual amounts coexist after actualization; the human reference
		// stays stable through correction. Corrections link through
		// replaces/reversed-by and share one chain root.
		await db.schema
			.createTable("expenses")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("household_id", "text", (col) => col.notNull().references("households.id"))
			.addColumn("category_id", "text", (col) => col.notNull().references("expense_categories.id"))
			.addColumn("reporting_period_id", "text", (col) => col.notNull().references("reporting_periods.id"))
			.addColumn("description", "text", (col) => col.notNull())
			.addColumn("reference", "text")
			.addColumn("status", "text", (col) => col.notNull().defaultTo("draft"))
			.addColumn("planned_amount_minor", "integer")
			.addColumn("planned_version", "integer", (col) => col.notNull().defaultTo(1))
			.addColumn("actual_amount_minor", "integer")
			.addColumn("accounting_date", "text", (col) => col.notNull())
			.addColumn("due_date", "text")
			.addColumn("service_start_date", "text")
			.addColumn("service_end_date", "text")
			.addColumn("allocation_method", "text", (col) => col.notNull())
			.addColumn("account_hint_id", "text", (col) => col.references("accounts.id"))
			.addColumn("template_id", "text", (col) => col.references("recurring_templates.id"))
			.addColumn("scheduled_due_date", "text")
			.addColumn("realized_by_expense_id", "text", (col) => col.references("expenses.id"))
			.addColumn("chain_root_id", "text", (col) => col.notNull().references("expenses.id"))
			.addColumn("replaces_id", "text", (col) => col.references("expenses.id"))
			.addColumn("reversed_by_id", "text", (col) => col.references("expenses.id"))
			.addColumn("actor_user_id", "text")
			.addColumn("operation_id", "text", (col) => col.references("operation_roots.id"))
			.addColumn("created_at", "text", (col) => col.notNull())
			.addColumn("updated_at", "text", (col) => col.notNull())
			.execute();

		await db.schema
			.createIndex("idx_expenses_household_period")
			.ifNotExists()
			.on("expenses")
			.columns(["household_id", "reporting_period_id"])
			.execute();

		await db.schema
			.createIndex("idx_expenses_household_reference")
			.ifNotExists()
			.on("expenses")
			.columns(["household_id", "reference"])
			.execute();

		await db.schema
			.createIndex("idx_expenses_household_accounting_date")
			.ifNotExists()
			.on("expenses")
			.columns(["household_id", "accounting_date"])
			.execute();

		await db.schema.createIndex("idx_expenses_category").ifNotExists().on("expenses").column("category_id").execute();

		await db.schema
			.createIndex("idx_expenses_household_status")
			.ifNotExists()
			.on("expenses")
			.columns(["household_id", "status"])
			.execute();

		// Canonical occurrence identity: one expected expense per template and
		// scheduled due date, enforced for idempotent generation.
		await db.schema
			.createIndex("idx_expenses_template_occurrence")
			.ifNotExists()
			.on("expenses")
			.columns(["template_id", "scheduled_due_date"])
			.execute();

		await db.schema.createIndex("idx_expenses_operation").ifNotExists().on("expenses").column("operation_id").execute();

		// Resolved allocation lines: authoritative minor-unit amounts per
		// basis (planned baseline and actual).
		await db.schema
			.createTable("expense_allocations")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("expense_id", "text", (col) => col.notNull().references("expenses.id"))
			.addColumn("member_id", "text", (col) => col.notNull().references("members.id"))
			.addColumn("basis", "text", (col) => col.notNull())
			.addColumn("amount_minor", "integer", (col) => col.notNull())
			.execute();

		await db.schema
			.createIndex("idx_expense_allocations_expense")
			.ifNotExists()
			.on("expense_allocations")
			.columns(["expense_id", "basis"])
			.execute();

		await db.schema
			.createIndex("idx_expense_allocations_member")
			.ifNotExists()
			.on("expense_allocations")
			.column("member_id")
			.execute();

		// Allocation method metadata for explanation and pre-posting edits;
		// never recalculates stored lines when household defaults change.
		await db.schema
			.createTable("expense_allocation_params")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("expense_id", "text", (col) => col.notNull().references("expenses.id"))
			.addColumn("member_id", "text", (col) => col.notNull().references("members.id"))
			.addColumn("value", "real")
			.execute();

		await db.schema
			.createIndex("idx_expense_allocation_params_expense")
			.ifNotExists()
			.on("expense_allocation_params")
			.column("expense_id")
			.execute();

		// Payments: one account outflow each, with explicit funding source.
		// Reversals and replacements mirror the transfer chain protocol.
		await db.schema
			.createTable("payments")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("household_id", "text", (col) => col.notNull().references("households.id"))
			.addColumn("account_id", "text", (col) => col.notNull().references("accounts.id"))
			.addColumn("amount_minor", "integer", (col) => col.notNull())
			.addColumn("description", "text", (col) => col.notNull())
			.addColumn("effective_at", "text", (col) => col.notNull())
			.addColumn("ordering_key", "text", (col) => col.notNull())
			.addColumn("recorded_at", "text", (col) => col.notNull())
			.addColumn("funding_source", "text", (col) => col.notNull())
			.addColumn("funder_member_id", "text", (col) => col.references("members.id"))
			.addColumn("status", "text", (col) => col.notNull().defaultTo("posted"))
			.addColumn("chain_root_id", "text", (col) => col.notNull().references("payments.id"))
			.addColumn("reversal_of_id", "text", (col) => col.references("payments.id"))
			.addColumn("replaces_id", "text", (col) => col.references("payments.id"))
			.addColumn("reversed_by_id", "text", (col) => col.references("payments.id"))
			.addColumn("actor_user_id", "text")
			.addColumn("operation_id", "text", (col) => col.references("operation_roots.id"))
			.addColumn("created_at", "text", (col) => col.notNull())
			.execute();

		await db.schema
			.createIndex("idx_payments_household")
			.ifNotExists()
			.on("payments")
			.columns(["household_id", "recorded_at"])
			.execute();

		await db.schema
			.createIndex("idx_payments_account")
			.ifNotExists()
			.on("payments")
			.columns(["account_id", "ordering_key"])
			.execute();

		await db.schema.createIndex("idx_payments_operation").ifNotExists().on("payments").column("operation_id").execute();

		// The singular account effect of each payment. Reversal rows restore
		// the value with the same chain root and ordering key.
		await db.schema
			.createTable("payment_account_entries")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("account_id", "text", (col) => col.notNull().references("accounts.id"))
			.addColumn("payment_id", "text", (col) => col.notNull().references("payments.id"))
			.addColumn("chain_root_id", "text", (col) => col.notNull())
			.addColumn("amount_minor", "integer", (col) => col.notNull())
			.addColumn("effective_at", "text", (col) => col.notNull())
			.addColumn("ordering_key", "text", (col) => col.notNull())
			.addColumn("recorded_at", "text", (col) => col.notNull())
			.addColumn("operation_id", "text", (col) => col.references("operation_roots.id"))
			.execute();

		await db.schema
			.createIndex("idx_payment_account_entries_account")
			.ifNotExists()
			.on("payment_account_entries")
			.columns(["account_id", "ordering_key"])
			.execute();

		await db.schema
			.createIndex("idx_payment_account_entries_payment")
			.ifNotExists()
			.on("payment_account_entries")
			.column("payment_id")
			.execute();

		// Many-to-many applications of payment value to expenses. Applications
		// never create account entries; reversal flips status and restores
		// unapplied value.
		await db.schema
			.createTable("payment_applications")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("household_id", "text", (col) => col.notNull().references("households.id"))
			.addColumn("payment_id", "text", (col) => col.notNull().references("payments.id"))
			.addColumn("expense_id", "text", (col) => col.notNull().references("expenses.id"))
			.addColumn("amount_minor", "integer", (col) => col.notNull())
			.addColumn("status", "text", (col) => col.notNull().defaultTo("active"))
			.addColumn("recorded_at", "text", (col) => col.notNull())
			.addColumn("reversed_at", "text")
			.addColumn("operation_id", "text", (col) => col.references("operation_roots.id"))
			.execute();

		await db.schema
			.createIndex("idx_payment_applications_expense")
			.ifNotExists()
			.on("payment_applications")
			.columns(["expense_id", "status"])
			.execute();

		await db.schema
			.createIndex("idx_payment_applications_payment")
			.ifNotExists()
			.on("payment_applications")
			.columns(["payment_id", "status"])
			.execute();

		await db.schema
			.createIndex("idx_payment_applications_household")
			.ifNotExists()
			.on("payment_applications")
			.columns(["household_id", "recorded_at"])
			.execute();

		// Evidence references: safe external HTTPS links, never binary blobs.
		await db.schema
			.createTable("expense_evidence")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("expense_id", "text", (col) => col.notNull().references("expenses.id"))
			.addColumn("household_id", "text", (col) => col.notNull().references("households.id"))
			.addColumn("label", "text", (col) => col.notNull())
			.addColumn("url", "text", (col) => col.notNull())
			.addColumn("note", "text")
			.addColumn("status", "text", (col) => col.notNull().defaultTo("active"))
			.addColumn("created_by", "text")
			.addColumn("created_at", "text", (col) => col.notNull())
			.addColumn("removed_at", "text")
			.addColumn("operation_id", "text", (col) => col.references("operation_roots.id"))
			.execute();

		await db.schema
			.createIndex("idx_expense_evidence_expense")
			.ifNotExists()
			.on("expense_evidence")
			.columns(["expense_id", "status"])
			.execute();
	},

	async down(db: Kysely<any>): Promise<void> {
		await db.schema.dropIndex("idx_expense_evidence_expense").ifExists().execute();
		await db.schema.dropTable("expense_evidence").ifExists().execute();
		await db.schema.dropIndex("idx_payment_applications_household").ifExists().execute();
		await db.schema.dropIndex("idx_payment_applications_payment").ifExists().execute();
		await db.schema.dropIndex("idx_payment_applications_expense").ifExists().execute();
		await db.schema.dropTable("payment_applications").ifExists().execute();
		await db.schema.dropIndex("idx_payment_account_entries_payment").ifExists().execute();
		await db.schema.dropIndex("idx_payment_account_entries_account").ifExists().execute();
		await db.schema.dropTable("payment_account_entries").ifExists().execute();
		await db.schema.dropIndex("idx_payments_operation").ifExists().execute();
		await db.schema.dropIndex("idx_payments_account").ifExists().execute();
		await db.schema.dropIndex("idx_payments_household").ifExists().execute();
		await db.schema.dropTable("payments").ifExists().execute();
		await db.schema.dropIndex("idx_expense_allocation_params_expense").ifExists().execute();
		await db.schema.dropTable("expense_allocation_params").ifExists().execute();
		await db.schema.dropIndex("idx_expense_allocations_member").ifExists().execute();
		await db.schema.dropIndex("idx_expense_allocations_expense").ifExists().execute();
		await db.schema.dropTable("expense_allocations").ifExists().execute();
		await db.schema.dropIndex("idx_expenses_operation").ifExists().execute();
		await db.schema.dropIndex("idx_expenses_template_occurrence").ifExists().execute();
		await db.schema.dropIndex("idx_expenses_household_status").ifExists().execute();
		await db.schema.dropIndex("idx_expenses_category").ifExists().execute();
		await db.schema.dropIndex("idx_expenses_household_accounting_date").ifExists().execute();
		await db.schema.dropIndex("idx_expenses_household_reference").ifExists().execute();
		await db.schema.dropIndex("idx_expenses_household_period").ifExists().execute();
		await db.schema.dropTable("expenses").ifExists().execute();
		await db.schema.dropIndex("idx_recurring_template_allocation_params_template").ifExists().execute();
		await db.schema.dropTable("recurring_template_allocation_params").ifExists().execute();
		await db.schema.dropIndex("idx_recurring_templates_household").ifExists().execute();
		await db.schema.dropTable("recurring_templates").ifExists().execute();
		await db.schema.dropIndex("idx_reporting_periods_household_start").ifExists().execute();
		await db.schema.dropIndex("idx_reporting_periods_household_slug").ifExists().execute();
		await db.schema.dropTable("reporting_periods").ifExists().execute();
		await db.schema.dropIndex("idx_expense_categories_household").ifExists().execute();
		await db.schema.dropIndex("idx_expense_categories_household_slug").ifExists().execute();
		await db.schema.dropTable("expense_categories").ifExists().execute();
	},
};
