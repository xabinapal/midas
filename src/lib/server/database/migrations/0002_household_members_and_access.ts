import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";

export const householdMembersAndAccess: Migration = {
	async up(db: Kysely<any>): Promise<void> {
		// Singleton bootstrap gate — one-time setup protection
		await db.schema
			.createTable("bootstrap_gate")
			.ifNotExists()
			.addColumn("id", "integer", (col) => col.primaryKey().defaultTo(1))
			.addColumn("state", "text", (col) => col.notNull().defaultTo("available"))
			.addColumn("operation_id", "text")
			.addColumn("lease_expires_at", "text")
			.addColumn("completed_at", "text")
			.execute();

		await db.schema
			.createTable("households")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("name", "text", (col) => col.notNull())
			.addColumn("currency", "text", (col) => col.notNull())
			.addColumn("timezone", "text", (col) => col.notNull().defaultTo("Europe/Madrid"))
			.addColumn("locale", "text", (col) => col.notNull().defaultTo("es-ES"))
			.addColumn("version", "text", (col) => col.notNull())
			.addColumn("created_at", "text", (col) => col.notNull())
			.addColumn("updated_at", "text", (col) => col.notNull())
			.execute();

		// Per-household command gate for replay-safe operations
		await db.schema
			.createTable("household_command_gates")
			.ifNotExists()
			.addColumn("household_id", "text", (col) => col.primaryKey().references("households.id"))
			.addColumn("operation_id", "text", (col) => col.notNull())
			.addColumn("expected_version", "text", (col) => col.notNull())
			.addColumn("lease_expires_at", "text", (col) => col.notNull())
			.execute();

		await db.schema
			.createTable("operation_roots")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("household_id", "text", (col) => col.notNull().references("households.id"))
			.addColumn("actor_user_id", "text")
			.addColumn("operation_type", "text", (col) => col.notNull())
			.addColumn("payload_fingerprint", "text", (col) => col.notNull())
			.addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
			.addColumn("result_type", "text")
			.addColumn("created_at", "text", (col) => col.notNull())
			.addColumn("completed_at", "text")
			.execute();

		await db.schema
			.createIndex("idx_operation_roots_household")
			.ifNotExists()
			.on("operation_roots")
			.column("household_id")
			.execute();

		await db.schema
			.createTable("members")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("household_id", "text", (col) => col.notNull().references("households.id"))
			.addColumn("display_name", "text", (col) => col.notNull())
			.addColumn("is_active", "integer", (col) => col.notNull().defaultTo(1))
			.addColumn("created_at", "text", (col) => col.notNull())
			.addColumn("updated_at", "text", (col) => col.notNull())
			.execute();

		await db.schema.createIndex("idx_members_household").ifNotExists().on("members").column("household_id").execute();

		// Effective-dated member intervals for default weights and active state
		await db.schema
			.createTable("member_intervals")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("member_id", "text", (col) => col.notNull().references("members.id"))
			.addColumn("effective_from", "text", (col) => col.notNull())
			.addColumn("default_weight", "integer", (col) => col.notNull().defaultTo(0))
			.addColumn("is_active", "integer", (col) => col.notNull().defaultTo(1))
			.addColumn("operation_id", "text", (col) => col.references("operation_roots.id"))
			.execute();

		await db.schema
			.createIndex("idx_member_intervals_member")
			.ifNotExists()
			.on("member_intervals")
			.columns(["member_id", "effective_from"])
			.execute();

		// Users table gains household/member/lifecycle columns.
		// ALTER TABLE ADD COLUMN has no IF NOT EXISTS in SQLite, so wrap each
		// in a conditional try to make the migration replay-safe.
		for (const col of [
			{
				name: "household_id",
				def: (c: ReturnType<typeof db.schema.alterTable>) => c.addColumn("household_id", "text"),
			},
			{ name: "member_id", def: (c: ReturnType<typeof db.schema.alterTable>) => c.addColumn("member_id", "text") },
			{
				name: "is_active",
				def: (c: ReturnType<typeof db.schema.alterTable>) =>
					c.addColumn("is_active", "integer", (col) => col.notNull().defaultTo(1)),
			},
			{
				name: "is_administrator",
				def: (c: ReturnType<typeof db.schema.alterTable>) =>
					c.addColumn("is_administrator", "integer", (col) => col.notNull().defaultTo(0)),
			},
			{
				name: "requires_password_change",
				def: (c: ReturnType<typeof db.schema.alterTable>) =>
					c.addColumn("requires_password_change", "integer", (col) => col.notNull().defaultTo(0)),
			},
		]) {
			try {
				await col.def(db.schema.alterTable("users")).execute();
			} catch {
				// Column already exists — replay-safe
			}
		}

		// Revocable sessions — stores only SHA-256 digest, never the bearer token
		await db.schema
			.createTable("sessions")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("user_id", "text", (col) => col.notNull().references("users.id"))
			.addColumn("household_id", "text", (col) => col.notNull().references("households.id"))
			.addColumn("token_digest", "text", (col) => col.notNull().unique())
			.addColumn("created_at", "text", (col) => col.notNull())
			.addColumn("rotated_at", "text", (col) => col.notNull())
			.addColumn("expires_at", "text", (col) => col.notNull())
			.execute();

		await db.schema.createIndex("idx_sessions_user").ifNotExists().on("sessions").column("user_id").execute();

		await db.schema.createIndex("idx_sessions_digest").ifNotExists().on("sessions").column("token_digest").execute();

		// Append-only activity events
		await db.schema
			.createTable("activity_events")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("household_id", "text", (col) => col.notNull().references("households.id"))
			.addColumn("event_type", "text", (col) => col.notNull())
			.addColumn("subject_type", "text", (col) => col.notNull())
			.addColumn("subject_id", "text")
			.addColumn("actor_user_id", "text")
			.addColumn("occurred_at", "text", (col) => col.notNull())
			.addColumn("recorded_at", "text", (col) => col.notNull())
			.addColumn("summary", "text", (col) => col.notNull().defaultTo("{}"))
			.addColumn("operation_id", "text", (col) => col.references("operation_roots.id"))
			.addColumn("correction_of_event_id", "text")
			.execute();

		await db.schema
			.createIndex("idx_activity_events_household")
			.ifNotExists()
			.on("activity_events")
			.columns(["household_id", "occurred_at"])
			.execute();

		await db.schema
			.createIndex("idx_activity_events_subject")
			.ifNotExists()
			.on("activity_events")
			.columns(["subject_type", "subject_id"])
			.execute();

		await db.schema
			.createIndex("idx_activity_events_actor")
			.ifNotExists()
			.on("activity_events")
			.column("actor_user_id")
			.execute();

		// Consumed recovery credentials — single-use tracking
		await db.schema
			.createTable("consumed_recovery_credentials")
			.ifNotExists()
			.addColumn("digest", "text", (col) => col.primaryKey())
			.addColumn("consumed_at", "text", (col) => col.notNull())
			.addColumn("target_user_id", "text")
			.addColumn("operation_id", "text")
			.execute();
	},

	async down(db: Kysely<any>): Promise<void> {
		await db.schema.dropTable("consumed_recovery_credentials").ifExists().execute();
		await db.schema.dropIndex("idx_activity_events_actor").ifExists().execute();
		await db.schema.dropIndex("idx_activity_events_subject").ifExists().execute();
		await db.schema.dropIndex("idx_activity_events_household").ifExists().execute();
		await db.schema.dropTable("activity_events").ifExists().execute();
		await db.schema.dropIndex("idx_sessions_digest").ifExists().execute();
		await db.schema.dropIndex("idx_sessions_user").ifExists().execute();
		await db.schema.dropTable("sessions").ifExists().execute();
		await db.schema.alterTable("users").dropColumn("requires_password_change").execute();
		await db.schema.alterTable("users").dropColumn("is_administrator").execute();
		await db.schema.alterTable("users").dropColumn("is_active").execute();
		await db.schema.alterTable("users").dropColumn("member_id").execute();
		await db.schema.alterTable("users").dropColumn("household_id").execute();
		await db.schema.dropIndex("idx_member_intervals_member").ifExists().execute();
		await db.schema.dropTable("member_intervals").ifExists().execute();
		await db.schema.dropIndex("idx_members_household").ifExists().execute();
		await db.schema.dropTable("members").ifExists().execute();
		await db.schema.dropIndex("idx_operation_roots_household").ifExists().execute();
		await db.schema.dropTable("operation_roots").ifExists().execute();
		await db.schema.dropTable("household_command_gates").ifExists().execute();
		await db.schema.dropTable("households").ifExists().execute();
		await db.schema.dropTable("bootstrap_gate").ifExists().execute();
	},
};
