import { describe, expect, it, vi } from "vitest";
import { createObservationService, foldEntriesIntoChains, projectEstimatedBalance } from "./balance";
import { orderingKeyFor } from "$lib/accounts/model";
import type { AccountEntryRecord, BalanceObservationRecord } from "./repository";

const T0 = "2026-06-01T10:00:00.000Z";
const T1 = "2026-07-01T10:00:00.000Z";
const T2 = "2026-07-15T10:00:00.000Z";
const T3 = "2026-08-01T10:00:00.000Z";
const CUTOFF = "2026-08-05T00:00:00.000Z";

function observation(overrides: Partial<BalanceObservationRecord> = {}): BalanceObservationRecord {
	return {
		id: "obs-1",
		accountId: "acc-1",
		amountMinor: 50000,
		effectiveAt: T0,
		orderingKey: orderingKeyFor(T0, "obs-1"),
		recordedAt: T0,
		status: "valid",
		replacesObservationId: null,
		invalidatedAt: null,
		operationId: null,
		...overrides,
	};
}

function entry(overrides: Partial<AccountEntryRecord> = {}): AccountEntryRecord {
	return {
		id: "entry-1",
		accountId: "acc-1",
		transferId: "transfer-1",
		chainRootId: "transfer-1",
		amountMinor: 1000,
		effectiveAt: T1,
		orderingKey: orderingKeyFor(T1, "transfer-1"),
		recordedAt: T1,
		operationId: null,
		...overrides,
	};
}

describe("foldEntriesIntoChains", () => {
	it("nets a reversal against its original within one chain", () => {
		const original = entry({ id: "e1", transferId: "t1", chainRootId: "t1", amountMinor: 500 });
		const reversal = entry({ id: "e2", transferId: "t2", chainRootId: "t1", amountMinor: -500 });

		const chains = foldEntriesIntoChains([original, reversal]);

		expect(chains).toHaveLength(1);
		expect(chains[0]!.chainRootId).toBe("t1");
		expect(chains[0]!.netMinor).toBe(0);
	});

	it("nets original, reversal, and replacement to the restated effect", () => {
		const chains = foldEntriesIntoChains([
			entry({ id: "e1", transferId: "t1", chainRootId: "t1", amountMinor: 500 }),
			entry({ id: "e2", transferId: "t2", chainRootId: "t1", amountMinor: -500 }),
			entry({ id: "e3", transferId: "t3", chainRootId: "t1", amountMinor: 700 }),
		]);

		expect(chains).toHaveLength(1);
		expect(chains[0]!.netMinor).toBe(700);
	});

	it("keeps distinct chains separate", () => {
		const chains = foldEntriesIntoChains([
			entry({ id: "e1", chainRootId: "t1", amountMinor: 500 }),
			entry({
				id: "e2",
				transferId: "t9",
				chainRootId: "t9",
				amountMinor: -200,
				orderingKey: orderingKeyFor(T2, "t9"),
			}),
		]);

		expect(chains).toHaveLength(2);
	});
});

describe("projectEstimatedBalance", () => {
	it("returns an unavailable balance when the account has no valid observation", () => {
		const projection = projectEstimatedBalance({ observations: [], entries: [entry()], cutoff: CUTOFF });

		expect(projection.kind).toBe("unavailable");
		expect(projection).not.toMatchObject({ amountMinor: 0 });
	});

	it("exposes the first observed balance with its observation timestamp", () => {
		const projection = projectEstimatedBalance({ observations: [observation()], entries: [], cutoff: CUTOFF });

		expect(projection).toMatchObject({
			kind: "estimated",
			amountMinor: 50000,
			observedAt: T0,
			movementCount: 0,
		});
	});

	it("adds posted debits and credits effective after the observation", () => {
		const debit = entry({ id: "e1", transferId: "t1", chainRootId: "t1", amountMinor: -10000 });
		const credit = entry({
			id: "e2",
			transferId: "t2",
			chainRootId: "t2",
			amountMinor: 3000,
			orderingKey: orderingKeyFor(T2, "t2"),
		});

		const projection = projectEstimatedBalance({
			observations: [observation()],
			entries: [debit, credit],
			cutoff: CUTOFF,
		});

		expect(projection).toMatchObject({ kind: "estimated", amountMinor: 43000, observedAt: T0, movementCount: 2 });
	});

	it("ignores movements anchored at or before the latest observation", () => {
		const laterObservation = observation({
			id: "obs-2",
			amountMinor: 8000,
			effectiveAt: T2,
			orderingKey: orderingKeyFor(T2, "obs-2"),
			recordedAt: T3,
		});
		const beforeAnchor = entry({ amountMinor: -9999 });

		const projection = projectEstimatedBalance({
			observations: [observation(), laterObservation],
			entries: [beforeAnchor],
			cutoff: CUTOFF,
		});

		expect(projection).toMatchObject({ kind: "estimated", amountMinor: 8000, observedAt: T2 });
	});

	it("folds a later-recorded reversal into its original chain so the estimate nets to zero", () => {
		const key = orderingKeyFor(T1, "t1");
		const original = entry({ id: "e1", transferId: "t1", chainRootId: "t1", amountMinor: 500, orderingKey: key });
		const reversal = entry({
			id: "e2",
			transferId: "t2",
			chainRootId: "t1",
			amountMinor: -500,
			orderingKey: key,
			recordedAt: T3,
		});

		const projection = projectEstimatedBalance({
			observations: [observation()],
			entries: [original, reversal],
			cutoff: CUTOFF,
		});

		expect(projection).toMatchObject({ kind: "estimated", amountMinor: 50000, movementCount: 0 });
	});

	it("restates a corrected chain to its replacement effect", () => {
		const key = orderingKeyFor(T1, "t1");
		const original = entry({ id: "e1", transferId: "t1", chainRootId: "t1", amountMinor: 500, orderingKey: key });
		const reversal = entry({ id: "e2", transferId: "t2", chainRootId: "t1", amountMinor: -500, orderingKey: key });
		const replacement = entry({ id: "e3", transferId: "t3", chainRootId: "t1", amountMinor: 700, orderingKey: key });

		const projection = projectEstimatedBalance({
			observations: [observation()],
			entries: [original, reversal, replacement],
			cutoff: CUTOFF,
		});

		expect(projection).toMatchObject({ kind: "estimated", amountMinor: 50700, movementCount: 1 });
	});

	it("excludes a non-zero chain whose same-time key sorts before the observation anchor", () => {
		const sameTime = T1;
		const anchoredObservation = observation({
			id: "obs-z",
			amountMinor: 9000,
			effectiveAt: sameTime,
			orderingKey: orderingKeyFor(sameTime, "obs-z"),
		});
		const key = orderingKeyFor(sameTime, "t1");
		const original = entry({ id: "e1", transferId: "t1", chainRootId: "t1", amountMinor: 400, orderingKey: key });
		const reversal = entry({
			id: "e2",
			transferId: "t2",
			chainRootId: "t1",
			amountMinor: -400,
			orderingKey: key,
			recordedAt: T3,
		});

		const projection = projectEstimatedBalance({
			observations: [anchoredObservation],
			entries: [original, reversal],
			cutoff: CUTOFF,
		});

		expect(projection).toMatchObject({ kind: "estimated", amountMinor: 9000 });
	});

	it("excludes a same-time chain with a smaller key and includes one with a greater key", () => {
		const sameTime = T1;
		const anchoredObservation = observation({
			id: "obs-m",
			amountMinor: 9000,
			effectiveAt: sameTime,
			orderingKey: orderingKeyFor(sameTime, "obs-m"),
		});
		const before = entry({
			id: "e-before",
			transferId: "a-aaa",
			chainRootId: "a-aaa",
			amountMinor: 111,
			orderingKey: orderingKeyFor(sameTime, "a-aaa"),
		});
		const after = entry({
			id: "e-after",
			transferId: "z-zzz",
			chainRootId: "z-zzz",
			amountMinor: 222,
			orderingKey: orderingKeyFor(sameTime, "z-zzz"),
		});

		const projection = projectEstimatedBalance({
			observations: [anchoredObservation],
			entries: [before, after],
			cutoff: CUTOFF,
		});

		// "a-aaa" sorts before "obs-m" (excluded), "z-zzz" sorts after (included)
		expect(projection).toMatchObject({ kind: "estimated", amountMinor: 9222, movementCount: 1 });
	});

	it("anchors on the later-recorded observation at equal effective timestamps", () => {
		const sameTime = T1;
		const morning = observation({
			id: "obs-bbb",
			amountMinor: 50000,
			effectiveAt: sameTime,
			orderingKey: orderingKeyFor(sameTime, "obs-bbb"),
			recordedAt: T1,
		});
		const evening = observation({
			id: "obs-aaa",
			amountMinor: 52000,
			effectiveAt: sameTime,
			orderingKey: orderingKeyFor(sameTime, "obs-aaa"),
			recordedAt: T3,
		});

		const projection = projectEstimatedBalance({ observations: [morning, evening], entries: [], cutoff: CUTOFF });

		expect(projection).toMatchObject({ kind: "estimated", amountMinor: 52000, observationRecordedAt: T3 });
	});

	it("excludes observations and movements after the requested cutoff", () => {
		const lateObservation = observation({
			id: "obs-late",
			amountMinor: 1,
			effectiveAt: T3,
			orderingKey: orderingKeyFor(T3, "obs-late"),
		});
		const lateEntry = entry({
			id: "e-late",
			transferId: "t-late",
			chainRootId: "t-late",
			amountMinor: 777,
			orderingKey: orderingKeyFor(T3, "t-late"),
		});
		const historicalCutoff = T2;

		const projection = projectEstimatedBalance({
			observations: [observation(), lateObservation],
			entries: [lateEntry],
			cutoff: historicalCutoff,
		});

		expect(projection).toMatchObject({ kind: "estimated", amountMinor: 50000, observedAt: T0, asOf: historicalCutoff });
	});

	it("discloses the observation recording time so staleness can be shown", () => {
		const stale = observation({ recordedAt: T0, effectiveAt: T0 });
		const projection = projectEstimatedBalance({ observations: [stale], entries: [entry()], cutoff: CUTOFF });

		expect(projection.kind).toBe("estimated");
		if (projection.kind === "estimated") {
			expect(projection.observationRecordedAt).toBe(T0);
			expect(projection.movementCount).toBe(1);
		}
	});
});

describe("observationService.invalidateObservation", () => {
	const HOUSEHOLD = "hh-1";

	function mockAccountRepo() {
		return {
			findById: vi.fn().mockResolvedValue({
				id: "acc-1",
				householdId: HOUSEHOLD,
				name: "Cuenta",
				classification: "personal",
				status: "active",
				currency: "EUR",
				createdAt: T0,
				updatedAt: T0,
			}),
			findByHousehold: vi.fn(),
			create: vi.fn(),
			rename: vi.fn(),
			updateStatus: vi.fn(),
			remove: vi.fn(),
			hasReferences: vi.fn(),
		};
	}

	function mockObservationRepo(existing: BalanceObservationRecord | undefined) {
		const pendingOperations = new Set<string>();
		const stored = existing ? [existing] : [];
		const isVisible = (o: BalanceObservationRecord) => !o.operationId || !pendingOperations.has(o.operationId);
		return {
			stored,
			pendingOperations,
			append: vi.fn().mockResolvedValue(undefined),
			findById: vi.fn((id: string) => Promise.resolve(stored.find((o) => o.id === id))),
			findVisibleById: vi.fn((id: string) => Promise.resolve(stored.find((o) => o.id === id && isVisible(o)))),
			findValidByAccount: vi.fn().mockResolvedValue([]),
			findLatestValid: vi.fn().mockResolvedValue(undefined),
			findHistoryByAccount: vi.fn().mockResolvedValue([]),
			findReplacement: vi.fn((replacesId: string) =>
				Promise.resolve(stored.find((o) => o.replacesObservationId === replacesId)),
			),
			findVisibleReplacement: vi.fn((replacesId: string) =>
				Promise.resolve(stored.find((o) => o.replacesObservationId === replacesId && isVisible(o))),
			),
			reattributeOperation: vi.fn().mockResolvedValue(undefined),
			markInvalidated: vi.fn((id: string, invalidatedAt: string) => {
				const found = stored.find((o) => o.id === id);
				if (found) {
					found.status = "invalidated";
					found.invalidatedAt = invalidatedAt;
				}
				return Promise.resolve();
			}),
		};
	}

	function validObservation(overrides: Partial<BalanceObservationRecord> = {}): BalanceObservationRecord {
		return observation({ status: "valid", ...overrides });
	}

	it("validates the replacement before invalidating the anchor", async () => {
		const observations = mockObservationRepo(validObservation());
		const service = createObservationService(mockAccountRepo(), observations, {
			findByAccount: vi.fn(),
			findByAccountAfter: vi.fn().mockResolvedValue([]),
		});

		await expect(
			service.invalidateObservation(HOUSEHOLD, "obs-1", { accountId: "acc-1", amountMinor: 10.5, effectiveAt: T1 }, T2),
		).rejects.toThrow("observation_amount_not_integer");
		expect(observations.markInvalidated).not.toHaveBeenCalled();

		await expect(
			service.invalidateObservation(HOUSEHOLD, "obs-1", { accountId: "acc-2", amountMinor: 100, effectiveAt: T1 }, T2),
		).rejects.toThrow("observation_replacement_account_mismatch");
		expect(observations.markInvalidated).not.toHaveBeenCalled();
	});

	it("appends the replacement before the visible invalidation flip", async () => {
		const observations = mockObservationRepo(validObservation());
		const service = createObservationService(mockAccountRepo(), observations, {
			findByAccount: vi.fn(),
			findByAccountAfter: vi.fn().mockResolvedValue([]),
		});

		await service.invalidateObservation(
			HOUSEHOLD,
			"obs-1",
			{ accountId: "acc-1", amountMinor: 51000, effectiveAt: T1 },
			T2,
			"op-1",
		);

		expect(observations.append.mock.invocationCallOrder[0]!).toBeLessThan(
			observations.markInvalidated.mock.invocationCallOrder[0]!,
		);
		expect(observations.append).toHaveBeenCalledWith(
			expect.objectContaining({ amountMinor: 51000, replacesObservationId: "obs-1" }),
		);
	});

	it("rejects re-invalidating an already-replaced observation", async () => {
		const original = validObservation({ status: "invalidated" });
		const replacement = validObservation({ id: "obs-2", replacesObservationId: "obs-1" });
		const observations = mockObservationRepo(original);
		observations.stored.push(replacement);
		const service = createObservationService(mockAccountRepo(), observations, {
			findByAccount: vi.fn(),
			findByAccountAfter: vi.fn().mockResolvedValue([]),
		});

		await expect(service.invalidateObservation(HOUSEHOLD, "obs-1", null, T2)).rejects.toThrow("observation_not_found");
	});

	it("adopts a replacement left invisible by a failed operation", async () => {
		const original = validObservation({ status: "invalidated" });
		const orphan = validObservation({ id: "obs-2", replacesObservationId: "obs-1", operationId: "op-failed" });
		const observations = mockObservationRepo(original);
		observations.stored.push(orphan);
		observations.pendingOperations.add("op-failed");
		const service = createObservationService(mockAccountRepo(), observations, {
			findByAccount: vi.fn(),
			findByAccountAfter: vi.fn().mockResolvedValue([]),
		});

		const result = await service.invalidateObservation(HOUSEHOLD, "obs-1", null, T2, "op-retry");

		expect(observations.reattributeOperation).toHaveBeenCalledWith("obs-2", "op-retry", T2);
		expect(result.replacement?.id).toBe("obs-2");
	});

	it("is idempotent when the invalidation already happened without a replacement", async () => {
		const observations = mockObservationRepo(validObservation({ status: "invalidated" }));
		const service = createObservationService(mockAccountRepo(), observations, {
			findByAccount: vi.fn(),
			findByAccountAfter: vi.fn().mockResolvedValue([]),
		});

		const result = await service.invalidateObservation(HOUSEHOLD, "obs-1", null, T2);

		expect(result.replacement).toBeNull();
		expect(observations.markInvalidated).not.toHaveBeenCalled();
	});

	it("appends a fresh replacement when the invalidation happened without one", async () => {
		const observations = mockObservationRepo(validObservation({ status: "invalidated" }));
		const service = createObservationService(mockAccountRepo(), observations, {
			findByAccount: vi.fn(),
			findByAccountAfter: vi.fn().mockResolvedValue([]),
		});

		const result = await service.invalidateObservation(
			HOUSEHOLD,
			"obs-1",
			{ accountId: "acc-1", amountMinor: 50500, effectiveAt: T1 },
			T2,
			"op-2",
		);

		expect(result.replacement?.amountMinor).toBe(50500);
		expect(observations.append).toHaveBeenCalledTimes(1);
	});
	it("adopts a matching invisible replacement instead of appending a duplicate", async () => {
		const original = validObservation({ id: "obs-1" });
		const orphan = validObservation({
			id: "obs-2",
			replacesObservationId: "obs-1",
			amountMinor: 51000,
			effectiveAt: T1,
			operationId: "op-failed",
		});
		const observations = mockObservationRepo(original);
		observations.stored.push(orphan);
		observations.pendingOperations.add("op-failed");
		const service = createObservationService(mockAccountRepo(), observations, {
			findByAccount: vi.fn(),
			findByAccountAfter: vi.fn().mockResolvedValue([]),
		});

		const result = await service.invalidateObservation(
			HOUSEHOLD,
			"obs-1",
			{ accountId: "acc-1", amountMinor: 51000, effectiveAt: T1 },
			T2,
			"op-resume",
		);

		expect(result.replacement?.id).toBe("obs-2");
		expect(observations.reattributeOperation).toHaveBeenCalledWith("obs-2", "op-resume", T2);
		expect(observations.append).not.toHaveBeenCalled();
		expect(observations.markInvalidated).toHaveBeenCalledWith("obs-1", T2);
	});

	it("rejects resuming when a visible replacement already exists", async () => {
		const original = validObservation({ id: "obs-1", status: "invalidated" });
		const visible = validObservation({ id: "obs-3", replacesObservationId: "obs-1" });
		const orphan = validObservation({ id: "obs-2", replacesObservationId: "obs-1", operationId: "op-failed" });
		const observations = mockObservationRepo(original);
		observations.stored.push(orphan, visible);
		observations.pendingOperations.add("op-failed");
		const service = createObservationService(mockAccountRepo(), observations, {
			findByAccount: vi.fn(),
			findByAccountAfter: vi.fn().mockResolvedValue([]),
		});

		await expect(service.invalidateObservation(HOUSEHOLD, "obs-1", null, T2)).rejects.toThrow("observation_not_found");
		expect(observations.reattributeOperation).not.toHaveBeenCalled();
	});
});
