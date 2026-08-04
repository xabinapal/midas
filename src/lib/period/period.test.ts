import { describe, expect, it } from "vitest";
import { getPeriodNavigation } from "./period";

const now = new Date("2026-08-04T12:00:00Z");

describe("getPeriodNavigation", () => {
	it("uses the current month when the URL has no period", () => {
		const navigation = getPeriodNavigation(new URL("https://midas.example/"), now);

		expect(navigation.selectedPeriod).toBe("2026-08");
		expect(navigation.previousHref).toBe("/?period=2026-07");
		expect(navigation.nextHref).toBe("/?period=2026-09");
	});

	it("navigates across years for past and future periods", () => {
		const past = getPeriodNavigation(new URL("https://midas.example/?period=2024-12"), now);
		const future = getPeriodNavigation(new URL("https://midas.example/?period=2027-01"), now);

		expect(past.previousHref).toBe("/?period=2024-11");
		expect(past.nextHref).toBe("/?period=2025-01");
		expect(future.previousHref).toBe("/?period=2026-12");
		expect(future.nextHref).toBe("/?period=2027-02");
	});

	it("restores the selected period from reloadable history URLs", () => {
		const originalUrl = new URL("https://midas.example/?period=2026-07");
		const original = getPeriodNavigation(originalUrl, now);
		const forward = getPeriodNavigation(new URL(original.nextHref, originalUrl), now);
		const back = getPeriodNavigation(originalUrl, now);

		expect(forward.selectedPeriod).toBe("2026-08");
		expect(back.selectedPeriod).toBe("2026-07");
		expect(back.currentHref).toBe("/?period=2026-08");
	});

	it("rejects invalid period params and falls back to the current period", () => {
		for (const invalid of ["abc", "2026-13", "2026-00", "", "2026-8", "26-08"]) {
			const navigation = getPeriodNavigation(new URL(`https://midas.example/?period=${invalid}`), now);

			expect(navigation.selectedPeriod).toBe("2026-08");
		}
	});
});
