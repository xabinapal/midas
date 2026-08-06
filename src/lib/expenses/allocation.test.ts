import { describe, expect, it } from "vitest";
import { resolveAllocations, type AllocationMemberSelection } from "./allocation";

const member = (id: string, extra: Partial<AllocationMemberSelection> = {}): AllocationMemberSelection => ({
	memberId: id,
	...extra,
});

describe("resolveAllocations", () => {
	describe("common validation", () => {
		it("rejects a non-positive total", () => {
			expect(() => resolveAllocations("equal", 0, [member("a")])).toThrowError("allocation_total_not_positive");
			expect(() => resolveAllocations("equal", -100, [member("a")])).toThrowError("allocation_total_not_positive");
		});

		it("rejects a non-integer total", () => {
			expect(() => resolveAllocations("equal", 100.5, [member("a")])).toThrowError("allocation_total_not_positive");
		});

		it("rejects an empty member subset", () => {
			expect(() => resolveAllocations("equal", 100, [])).toThrowError("allocation_members_empty");
		});

		it("rejects duplicate members", () => {
			expect(() => resolveAllocations("equal", 100, [member("a"), member("a")])).toThrowError(
				"allocation_members_duplicated",
			);
		});
	});

	describe("equal allocation", () => {
		it("splits evenly when the total divides exactly", () => {
			const lines = resolveAllocations("equal", 9000, [member("b"), member("a"), member("c")]);
			expect(lines).toEqual([
				{ memberId: "a", amountMinor: 3000 },
				{ memberId: "b", amountMinor: 3000 },
				{ memberId: "c", amountMinor: 3000 },
			]);
		});

		it("assigns the remaining cent by stable member-identifier order", () => {
			// Members are deliberately unordered: the tie resolves by identifier.
			const lines = resolveAllocations("equal", 100, [member("c"), member("a"), member("b")]);
			expect(lines).toEqual([
				{ memberId: "a", amountMinor: 34 },
				{ memberId: "b", amountMinor: 33 },
				{ memberId: "c", amountMinor: 33 },
			]);
		});

		it("allocates only the selected subset", () => {
			const lines = resolveAllocations("equal", 5000, [member("b"), member("d")]);
			expect(lines).toEqual([
				{ memberId: "b", amountMinor: 2500 },
				{ memberId: "d", amountMinor: 2500 },
			]);
		});

		it("allows zero shares when members outnumber the cents", () => {
			const lines = resolveAllocations("equal", 1, [member("a"), member("b")]);
			expect(lines).toEqual([
				{ memberId: "a", amountMinor: 1 },
				{ memberId: "b", amountMinor: 0 },
			]);
		});
	});

	describe("weight allocation", () => {
		it("resolves default weights proportionally", () => {
			const lines = resolveAllocations("default_weight", 10000, [
				member("a", { defaultWeight: 1 }),
				member("b", { defaultWeight: 3 }),
			]);
			expect(lines).toEqual([
				{ memberId: "a", amountMinor: 2500 },
				{ memberId: "b", amountMinor: 7500 },
			]);
		});

		it("resolves custom relative weights proportionally", () => {
			const lines = resolveAllocations("custom_weight", 10000, [
				member("a", { weight: 2 }),
				member("b", { weight: 1 }),
			]);
			expect(lines).toEqual([
				{ memberId: "a", amountMinor: 6667 },
				{ memberId: "b", amountMinor: 3333 },
			]);
		});

		it("rejects a selected subset whose weights total zero", () => {
			expect(() =>
				resolveAllocations("default_weight", 10000, [
					member("a", { defaultWeight: 0 }),
					member("b", { defaultWeight: 0 }),
				]),
			).toThrowError("allocation_weights_unbalanced");
		});

		it("rejects negative weights", () => {
			expect(() => resolveAllocations("custom_weight", 10000, [member("a", { weight: -1 })])).toThrowError(
				"allocation_weight_negative",
			);
		});

		it("treats a missing weight as zero", () => {
			const lines = resolveAllocations("custom_weight", 1000, [member("a"), member("b", { weight: 1 })]);
			expect(lines).toEqual([
				{ memberId: "a", amountMinor: 0 },
				{ memberId: "b", amountMinor: 1000 },
			]);
		});

		it("applies largest remainder with stable tie-breaking", () => {
			// total 100, weights 1/1/1: exact 33.33 each; one leftover unit goes to
			// the first member identifier among the equal fractional remainders.
			const lines = resolveAllocations("custom_weight", 100, [
				member("c", { weight: 1 }),
				member("a", { weight: 1 }),
				member("b", { weight: 1 }),
			]);
			expect(lines).toEqual([
				{ memberId: "a", amountMinor: 34 },
				{ memberId: "b", amountMinor: 33 },
				{ memberId: "c", amountMinor: 33 },
			]);
		});

		it("assigns leftovers by descending fractional remainder", () => {
			// total 10, weights 5/3/2: exact 5 / 3 / 2 — no remainder; craft a
			// fractional case: total 100, weights 6/3/1 → 60/30/10 exact; use
			// weights 7/2/1 with total 101 → 70.7/20.2/10.1 → floors 70/20/10,
			// leftover 1 goes to the highest remainder (a: 0.7).
			const lines = resolveAllocations("custom_weight", 101, [
				member("a", { weight: 7 }),
				member("b", { weight: 2 }),
				member("c", { weight: 1 }),
			]);
			expect(lines).toEqual([
				{ memberId: "a", amountMinor: 71 },
				{ memberId: "b", amountMinor: 20 },
				{ memberId: "c", amountMinor: 10 },
			]);
		});
	});

	describe("percentage allocation", () => {
		it("resolves basis points proportionally", () => {
			const lines = resolveAllocations("percentage", 12345, [
				member("a", { basisPoints: 5000 }),
				member("b", { basisPoints: 5000 }),
			]);
			// 6172.5 each → floors 6172/6172, leftover 1 to stable identifier.
			expect(lines).toEqual([
				{ memberId: "a", amountMinor: 6173 },
				{ memberId: "b", amountMinor: 6172 },
			]);
		});

		it("rejects percentages that do not total 10000 basis points", () => {
			expect(() =>
				resolveAllocations("percentage", 10000, [
					member("a", { basisPoints: 5000 }),
					member("b", { basisPoints: 4000 }),
				]),
			).toThrowError("allocation_percentages_unbalanced");
		});

		it("rejects negative basis points", () => {
			expect(() =>
				resolveAllocations("percentage", 10000, [
					member("a", { basisPoints: -100 }),
					member("b", { basisPoints: 10100 }),
				]),
			).toThrowError("allocation_percentage_negative");
		});

		it("rejects non-integer basis points", () => {
			expect(() =>
				resolveAllocations("percentage", 10000, [
					member("a", { basisPoints: 5000.5 }),
					member("b", { basisPoints: 4999.5 }),
				]),
			).toThrowError("allocation_percentage_not_integer");
		});

		it("supports a zero-percentage member inside a balanced selection", () => {
			const lines = resolveAllocations("percentage", 1000, [
				member("a", { basisPoints: 0 }),
				member("b", { basisPoints: 10000 }),
			]);
			expect(lines).toEqual([
				{ memberId: "a", amountMinor: 0 },
				{ memberId: "b", amountMinor: 1000 },
			]);
		});
	});

	describe("fixed allocation", () => {
		it("stores the exact fixed amounts", () => {
			const lines = resolveAllocations("fixed", 9000, [
				member("a", { fixedAmountMinor: 6000 }),
				member("b", { fixedAmountMinor: 3000 }),
			]);
			expect(lines).toEqual([
				{ memberId: "a", amountMinor: 6000 },
				{ memberId: "b", amountMinor: 3000 },
			]);
		});

		it("rejects fixed amounts that do not sum to the total", () => {
			expect(() =>
				resolveAllocations("fixed", 9000, [
					member("a", { fixedAmountMinor: 6000 }),
					member("b", { fixedAmountMinor: 2000 }),
				]),
			).toThrowError("allocation_fixed_unbalanced");
		});

		it("rejects negative or non-integer fixed amounts", () => {
			expect(() => resolveAllocations("fixed", 100, [member("a", { fixedAmountMinor: -1 })])).toThrowError(
				"allocation_fixed_negative",
			);
			expect(() => resolveAllocations("fixed", 100, [member("a", { fixedAmountMinor: 99.5 })])).toThrowError(
				"allocation_fixed_not_integer",
			);
		});
	});

	describe("exact-sum property", () => {
		const totals = [1, 2, 3, 100, 101, 9999, 123456789];
		const subsets: AllocationMemberSelection[][] = [
			[member("a")],
			[member("a"), member("b")],
			[member("a"), member("b"), member("c"), member("d")],
		];

		for (const total of totals) {
			for (const subset of subsets) {
				it(`equal split of ${total} across ${subset.length} members sums exactly`, () => {
					const lines = resolveAllocations("equal", total, subset);
					expect(lines.reduce((sum, line) => sum + line.amountMinor, 0)).toBe(total);
					for (const line of lines) {
						expect(Number.isInteger(line.amountMinor)).toBe(true);
						expect(line.amountMinor).toBeGreaterThanOrEqual(0);
					}
				});
			}
		}

		it("weighted splits always sum exactly", () => {
			for (const total of totals) {
				const lines = resolveAllocations("custom_weight", total, [
					member("a", { weight: 7 }),
					member("b", { weight: 3 }),
					member("c", { weight: 11 }),
					member("d", { weight: 1 }),
				]);
				expect(lines.reduce((sum, line) => sum + line.amountMinor, 0)).toBe(total);
			}
		});
	});
});
