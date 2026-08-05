import { describe, expect, it } from "vitest";
import { buildActivityDetails } from "./display";

const base = {
	subjectType: "user" as string | null,
	subjectId: "subject-1",
	actorUserId: "actor-1",
	subjectUsername: null as string | null,
	subjectMemberName: null as string | null,
};

describe("buildActivityDetails", () => {
	it("renders summary names with Spanish labels", () => {
		const details = buildActivityDetails({ ...base, summary: JSON.stringify({ username: "sam", memberName: "Sam" }) });
		expect(details).toEqual([
			{ label: "Usuario", value: "sam" },
			{ label: "Miembro", value: "Sam" },
		]);
	});

	it("drops redundant action keys from legacy events", () => {
		const details = buildActivityDetails({ ...base, summary: JSON.stringify({ action: "login" }) });
		expect(details).toEqual([]);
	});

	it("drops raw identifier keys from legacy events", () => {
		const details = buildActivityDetails({
			...base,
			summary: JSON.stringify({ memberId: "none", targetUserId: "u-9" }),
		});
		expect(details).toEqual([]);
	});

	it("maps the legacy target key to the user label", () => {
		const details = buildActivityDetails({ ...base, summary: JSON.stringify({ target: "admin" }) });
		expect(details).toEqual([{ label: "Usuario", value: "admin" }]);
	});

	it("falls back to the joined subject username when the summary lacks it", () => {
		const details = buildActivityDetails({
			...base,
			summary: JSON.stringify({ action: "disable" }),
			subjectUsername: "sam",
		});
		expect(details).toEqual([{ label: "Usuario", value: "sam" }]);
	});

	it("does not duplicate the subject username when the summary already names the user", () => {
		const details = buildActivityDetails({
			...base,
			summary: JSON.stringify({ username: "sam" }),
			subjectUsername: "sam",
		});
		expect(details).toEqual([{ label: "Usuario", value: "sam" }]);
	});

	it("skips the subject fallback for self-subject events", () => {
		const details = buildActivityDetails({
			...base,
			subjectId: "actor-1",
			summary: "{}",
			subjectUsername: "sam",
		});
		expect(details).toEqual([]);
	});

	it("falls back to the joined member name for member subjects", () => {
		const details = buildActivityDetails({
			...base,
			subjectType: "member",
			summary: JSON.stringify({ action: "deactivate" }),
			subjectMemberName: "Jordan",
		});
		expect(details).toEqual([{ label: "Miembro", value: "Jordan" }]);
	});

	it("keeps unknown summary keys with their raw label", () => {
		const details = buildActivityDetails({
			...base,
			summary: JSON.stringify({ householdName: "Piso", memberCount: 3 }),
		});
		expect(details).toEqual([
			{ label: "Hogar", value: "Piso" },
			{ label: "N.º de miembros", value: "3" },
		]);
	});

	it("returns no details for an invalid summary payload", () => {
		const details = buildActivityDetails({ ...base, summary: "not-json" });
		expect(details).toEqual([]);
	});
});
