import { describe, expect, it, vi } from "vitest";
import type { Kysely } from "kysely";
import type { Database } from "../database";
import { isBootstrapAvailable, performBootstrap, validateBootstrapCredential } from "./service";

const VALID_CREDENTIAL = "a".repeat(33);

describe("isBootstrapAvailable", () => {
	it("is available when no users exist and gate is not complete", () => {
		expect(isBootstrapAvailable(0, "available")).toBe(true);
	});

	it("is unavailable when users already exist", () => {
		expect(isBootstrapAvailable(1, "available")).toBe(false);
	});

	it("is unavailable when gate is complete", () => {
		expect(isBootstrapAvailable(0, "complete")).toBe(false);
	});

	it("is available when gate is held (recoverable)", () => {
		expect(isBootstrapAvailable(0, "held")).toBe(true);
	});
});

describe("validateBootstrapCredential", () => {
	it("accepts a matching credential of sufficient length", () => {
		expect(validateBootstrapCredential(VALID_CREDENTIAL, VALID_CREDENTIAL)).toBe(true);
	});

	it("rejects a mismatched credential", () => {
		expect(validateBootstrapCredential("wrong", VALID_CREDENTIAL)).toBe(false);
	});

	it("rejects when no credential is configured", () => {
		expect(validateBootstrapCredential(VALID_CREDENTIAL, undefined)).toBe(false);
	});

	it("rejects when configured credential is too short", () => {
		expect(validateBootstrapCredential("short", "short")).toBe(false);
	});
});

describe("performBootstrap weight invariants", () => {
	const VALID_INPUT = {
		bootstrapCredential: VALID_CREDENTIAL,
		householdName: "Piso",
		currency: "EUR",
		timezone: "Europe/Madrid",
		members: [
			{ displayName: "Alex", defaultWeight: 50 },
			{ displayName: "Sam", defaultWeight: 50 },
		],
		adminMemberIndex: 0,
		adminUsername: "admin",
		adminPassword: "a-valid-password",
	};

	function chainable(result: unknown) {
		const execute = vi.fn().mockResolvedValue(result);
		const takeFirst = vi.fn().mockResolvedValue(Array.isArray(result) ? result[0] : result);
		const self: Record<string, ReturnType<typeof vi.fn>> = {};
		const make = () => {
			const proxy = new Proxy(self, {
				get: (_t, prop) => {
					if (prop === "execute") return execute;
					if (prop === "executeTakeFirst") return takeFirst;
					if (prop === "then") return undefined;
					return vi.fn(() => make());
				},
			});
			return proxy;
		};
		return make();
	}

	function freshDb() {
		const insertInto = vi.fn(() => chainable(undefined));
		const db = {
			selectFrom: (table: string) => {
				if (table === "users") return chainable([]);
				if (table === "bootstrap_gate") return chainable([{ state: "available" }]);
				return chainable([]);
			},
			insertInto,
			updateTable: () => chainable({ numUpdatedRows: 1n }),
		} as unknown as Kysely<Database>;
		return { db, insertInto };
	}

	it("rejects when every member weight is zero and writes nothing", async () => {
		const { db, insertInto } = freshDb();
		const result = await performBootstrap(
			db,
			{ ...VALID_INPUT, members: VALID_INPUT.members.map((m) => ({ ...m, defaultWeight: 0 })) },
			VALID_CREDENTIAL,
		);
		expect(result.success).toBe(false);
		expect(insertInto).not.toHaveBeenCalled();
	});

	it("rejects a negative member weight and writes nothing", async () => {
		const { db, insertInto } = freshDb();
		const result = await performBootstrap(
			db,
			{
				...VALID_INPUT,
				members: [
					{ displayName: "Alex", defaultWeight: 100 },
					{ displayName: "Sam", defaultWeight: -10 },
				],
			},
			VALID_CREDENTIAL,
		);
		expect(result.success).toBe(false);
		expect(insertInto).not.toHaveBeenCalled();
	});
});
