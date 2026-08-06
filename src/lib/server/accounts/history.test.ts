import { describe, expect, it } from "vitest";
import { buildAccountHistory } from "./history";
import { orderingKeyFor } from "$lib/accounts/model";
import type { AccountTransferRecord, BalanceObservationRecord } from "./repository";

const T1 = "2026-07-01T10:00:00.000Z";
const T2 = "2026-07-15T10:00:00.000Z";

function transfer(overrides: Partial<AccountTransferRecord> = {}): AccountTransferRecord {
	return {
		id: "t-1",
		householdId: "hh-1",
		sourceAccountId: "acc-1",
		destinationAccountId: "acc-2",
		amountMinor: 5000,
		effectiveAt: T1,
		orderingKey: orderingKeyFor(T1, "t-1"),
		recordedAt: T1,
		description: "Traspaso",
		classification: "pure",
		status: "posted",
		chainRootId: "t-1",
		reversalOfId: null,
		replacesId: null,
		reversedById: null,
		operationId: null,
		createdAt: T1,
		...overrides,
	};
}

function observation(overrides: Partial<BalanceObservationRecord> = {}): BalanceObservationRecord {
	return {
		id: "obs-1",
		accountId: "acc-1",
		amountMinor: 50000,
		effectiveAt: T2,
		orderingKey: orderingKeyFor(T2, "obs-1"),
		recordedAt: T2,
		status: "valid",
		replacesObservationId: null,
		invalidatedAt: null,
		operationId: null,
		...overrides,
	};
}

const names = new Map([
	["acc-1", "Cuenta común"],
	["acc-2", "Cuenta de Alex"],
]);

describe("buildAccountHistory", () => {
	it("signs amounts by direction and resolves counterpart names", () => {
		const incoming = transfer({ sourceAccountId: "acc-2", destinationAccountId: "acc-1" });
		const outgoing = transfer({ id: "t-2", sourceAccountId: "acc-1", destinationAccountId: "acc-2" });

		const items = buildAccountHistory({
			accountId: "acc-1",
			transfers: [incoming, outgoing],
			observations: [],
			accountNames: names,
		});

		expect(items.find((i) => i.transferId === "t-1")).toMatchObject({
			direction: "in",
			amountMinor: 5000,
			counterpartName: "Cuenta de Alex",
		});
		expect(items.find((i) => i.transferId === "t-2")).toMatchObject({
			direction: "out",
			amountMinor: -5000,
			counterpartName: "Cuenta de Alex",
		});
	});

	it("falls back to the raw account id when the counterpart name is unknown", () => {
		const items = buildAccountHistory({
			accountId: "acc-1",
			transfers: [transfer({ destinationAccountId: "acc-9" })],
			observations: [],
			accountNames: names,
		});

		expect(items[0]!.counterpartName).toBe("acc-9");
	});

	it("orders by effective key desc, then recordedAt desc, then id desc", () => {
		const older = transfer({ id: "t-1" });
		const newer = transfer({ id: "t-2", effectiveAt: T2, orderingKey: orderingKeyFor(T2, "t-2") });
		const tieA = transfer({ id: "t-3", effectiveAt: T2, orderingKey: orderingKeyFor(T2, "t-2"), recordedAt: T2 });
		const sameKey = observation({ orderingKey: orderingKeyFor(T2, "t-2"), recordedAt: T2 });

		const items = buildAccountHistory({
			accountId: "acc-1",
			transfers: [older, tieA, newer],
			observations: [sameKey],
			accountNames: names,
		});

		expect(items.map((i) => i.id)).toEqual(["transfer-t-3", "observation-obs-1", "transfer-t-2", "transfer-t-1"]);
	});

	it("preserves correction links on every item", () => {
		const reversed = transfer({ status: "reversed", reversedById: "t-2" });
		const reversal = transfer({ id: "t-2", reversalOfId: "t-1", recordedAt: T2 });
		const replacement = transfer({ id: "t-3", replacesId: "t-1", recordedAt: T2 });

		const items = buildAccountHistory({
			accountId: "acc-1",
			transfers: [reversed, reversal, replacement],
			observations: [],
			accountNames: names,
		});

		expect(items.find((i) => i.transferId === "t-1")).toMatchObject({
			transferStatus: "reversed",
			reversedById: "t-2",
		});
		expect(items.find((i) => i.transferId === "t-2")).toMatchObject({ reversalOfId: "t-1" });
		expect(items.find((i) => i.transferId === "t-3")).toMatchObject({ replacesId: "t-1" });
	});

	it("exposes the actor projection from the operation root", () => {
		const actors = new Map([
			["op-1", { username: "developer", isActive: true }],
			["op-2", { username: "user", isActive: false }],
		]);
		const items = buildAccountHistory({
			accountId: "acc-1",
			transfers: [transfer({ operationId: "op-1" })],
			observations: [observation({ operationId: "op-2" })],
			accountNames: names,
			actors,
		});

		expect(items.find((i) => i.transferId === "t-1")).toMatchObject({
			actorUsername: "developer",
			actorIsActive: true,
		});
		expect(items.find((i) => i.observationId === "obs-1")).toMatchObject({
			actorUsername: "user",
			actorIsActive: false,
		});
	});

	it("leaves the actor null when the operation has no user or no root", () => {
		const items = buildAccountHistory({
			accountId: "acc-1",
			transfers: [transfer()],
			observations: [],
			accountNames: names,
			actors: new Map(),
		});

		expect(items[0]).toMatchObject({ actorUsername: null, actorIsActive: null });
	});
});
