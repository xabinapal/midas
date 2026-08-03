import { describe, expect, it } from "vitest";
import type { Migration } from "kysely/migration";
import { assertMigrationsResettable, assertSuccessfulMigrationResults } from "./reset";

const migration = (down?: Migration["down"]): Migration => ({
	up: async () => undefined,
	down,
});

describe("assertMigrationsResettable", () => {
	it("accepts migrations with down methods", () => {
		expect(() =>
			assertMigrationsResettable({
				"0001_initial": migration(async () => undefined),
			}),
		).not.toThrow();
	});

	it("rejects migrations without down methods", () => {
		expect(() =>
			assertMigrationsResettable({
				"0001_initial": migration(async () => undefined),
				"0002_irreversible": migration(),
			}),
		).toThrow("0002_irreversible");
	});
});

describe("assertSuccessfulMigrationResults", () => {
	it("rejects non-success migration results", () => {
		expect(() =>
			assertSuccessfulMigrationResults({
				results: [{ migrationName: "0001_initial", direction: "Down", status: "NotExecuted" }],
			}),
		).toThrow("0001_initial");
	});

	it("rethrows migration errors", () => {
		const error = new Error("rollback failed");
		expect(() => assertSuccessfulMigrationResults({ error })).toThrow(error);
	});
});
