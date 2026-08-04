import type { HouseholdRecord, MemberRecord, HouseholdRepository, MemberRepository } from "./repository";

export interface CreateMemberOptions {
	displayName: string;
	defaultWeight: number;
}

export interface MemberService {
	createMember(householdId: string, options: CreateMemberOptions, now: string): Promise<MemberRecord>;
	deactivateMember(memberId: string, now: string): Promise<void>;
	getMembers(householdId: string): Promise<MemberRecord[]>;
}

export function createMemberService(members: MemberRepository, households: HouseholdRepository): MemberService {
	return {
		async createMember(householdId, options, now) {
			if (options.displayName.trim().length === 0) {
				throw new Error("Member display name is required");
			}
			if (options.defaultWeight < 0) {
				throw new Error("Default weight must be non-negative");
			}
			const household = await households.findById(householdId);
			if (!household) {
				throw new Error("Household not found");
			}

			const id = crypto.randomUUID();
			await members.create(
				{
					id,
					householdId,
					displayName: options.displayName.trim(),
					defaultWeight: options.defaultWeight,
				},
				now,
			);
			const created = await members.findById(id);
			if (!created) throw new Error("Failed to retrieve created member");
			return created;
		},

		async deactivateMember(memberId, now) {
			const member = await members.findById(memberId);
			if (!member) throw new Error("Member not found");
			if (!member.isActive) return;

			const activeCount = await members.countActiveByHousehold(member.householdId);
			if (activeCount <= 2) {
				throw new Error("Cannot deactivate member: household requires at least two active members");
			}

			await members.updateActive(memberId, false, now);
		},

		async getMembers(householdId) {
			return members.findByHousehold(householdId);
		},
	};
}

export interface HouseholdService {
	getHousehold(id: string): Promise<HouseholdRecord | null>;
}

export function createHouseholdService(households: HouseholdRepository): HouseholdService {
	return {
		async getHousehold(id) {
			const household = await households.findById(id);
			return household ?? null;
		},
	};
}
