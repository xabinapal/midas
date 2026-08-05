import { describe, expect, it, vi } from "vitest";
import { createMemberService, createHouseholdService } from "./service";
import type { HouseholdRepository, MemberRepository, MemberRecord } from "./repository";

const NOW = "2026-08-04T12:00:00.000Z";

function mockHousehold(exists = true) {
	return {
		findById: vi.fn().mockResolvedValue(
			exists
				? {
						id: "hh-1",
						name: "Piso",
						currency: "EUR",
						timezone: "Europe/Madrid",
						locale: "es-ES",
						version: "v1",
						createdAt: NOW,
						updatedAt: NOW,
					}
				: undefined,
		),
		create: vi.fn(),
		countUsersByHousehold: vi.fn().mockResolvedValue(2),
	} satisfies HouseholdRepository;
}

function mockMember(overrides: Partial<MemberRecord & { activeCount: number }> = {}) {
	const member: MemberRecord = {
		id: "member-1",
		householdId: "hh-1",
		displayName: "Alex",
		isActive: true,
		defaultWeight: 50,
		...overrides,
	};
	return {
		findByHousehold: vi.fn().mockResolvedValue([member]),
		findById: vi.fn().mockResolvedValue(member),
		create: vi.fn(),
		updateActive: vi.fn(),
		updateWeight: vi.fn(),
		countActiveByHousehold: vi.fn().mockResolvedValue(overrides.activeCount ?? 3),
		hasFinancialReferences: vi.fn().mockResolvedValue(false),
		hasActivityReferences: vi.fn().mockResolvedValue(false),
	} satisfies MemberRepository;
}

describe("memberService", () => {
	it("creates a member in an existing household", async () => {
		const members = mockMember();
		const households = mockHousehold();
		members.findById = vi.fn().mockResolvedValue({
			id: "created-id",
			householdId: "hh-1",
			displayName: "Sam",
			isActive: true,
			defaultWeight: 30,
		});
		const service = createMemberService(members, households);

		const result = await service.createMember("hh-1", { displayName: " Sam ", defaultWeight: 30 }, NOW);

		expect(result.displayName).toBe("Sam");
		expect(members.create).toHaveBeenCalledWith(
			expect.objectContaining({ householdId: "hh-1", displayName: "Sam", defaultWeight: 30 }),
			NOW,
		);
	});

	it("rejects creating a member in a non-existent household", async () => {
		const members = mockMember();
		const households = mockHousehold(false);
		const service = createMemberService(members, households);

		await expect(service.createMember("missing", { displayName: "Sam", defaultWeight: 0 }, NOW)).rejects.toThrow(
			"Household not found",
		);
	});

	it("rejects an empty display name", async () => {
		const service = createMemberService(mockMember(), mockHousehold());

		await expect(service.createMember("hh-1", { displayName: "  ", defaultWeight: 0 }, NOW)).rejects.toThrow(
			"display name",
		);
	});

	it("rejects a negative default weight", async () => {
		const service = createMemberService(mockMember(), mockHousehold());

		await expect(service.createMember("hh-1", { displayName: "Sam", defaultWeight: -5 }, NOW)).rejects.toThrow(
			"non-negative",
		);
	});

	it("prevents deactivating a member when only two active remain", async () => {
		const members = mockMember({ activeCount: 2 });
		const service = createMemberService(members, mockHousehold());

		await expect(service.deactivateMember("member-1", NOW)).rejects.toThrow("at least two");
		expect(members.updateActive).not.toHaveBeenCalled();
	});

	it("allows deactivating when more than two active members exist", async () => {
		const members = mockMember({ activeCount: 4 });
		const service = createMemberService(members, mockHousehold());

		await service.deactivateMember("member-1", NOW);

		expect(members.updateActive).toHaveBeenCalledWith("member-1", false, NOW);
	});

	it("is idempotent when deactivating an already-inactive member", async () => {
		const members = mockMember({ isActive: false } as Partial<MemberRecord>);
		const service = createMemberService(members, mockHousehold());

		await service.deactivateMember("member-1", NOW);

		expect(members.updateActive).not.toHaveBeenCalled();
	});
});

describe("householdService", () => {
	it("returns the household when found", async () => {
		const service = createHouseholdService(mockHousehold(true));

		const result = await service.getHousehold("hh-1");

		expect(result).not.toBeNull();
		expect(result?.currency).toBe("EUR");
	});

	it("returns null when household not found", async () => {
		const service = createHouseholdService(mockHousehold(false));

		expect(await service.getHousehold("missing")).toBeNull();
	});
});
