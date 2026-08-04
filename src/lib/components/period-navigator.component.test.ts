import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import PeriodNavigator from "./period-navigator.svelte";

describe("PeriodNavigator", () => {
	it("links the previous, current, and next periods in URL state", () => {
		render(PeriodNavigator, {
			url: new URL("https://midas.example/?period=2026-07"),
			currentDate: new Date("2026-08-04T12:00:00Z"),
		});

		expect(screen.getByText("Julio de 2026")).toBeTruthy();
		expect(screen.getByRole<HTMLAnchorElement>("link", { name: "Mes anterior" }).getAttribute("href")).toBe(
			"/?period=2026-06",
		);
		expect(screen.getByRole<HTMLAnchorElement>("link", { name: "Ir al mes actual" }).getAttribute("href")).toBe(
			"/?period=2026-08",
		);
		expect(screen.getByRole<HTMLAnchorElement>("link", { name: "Mes siguiente" }).getAttribute("href")).toBe(
			"/?period=2026-08",
		);
	});

	it("presents a future period without forcing the current month", () => {
		render(PeriodNavigator, {
			url: new URL("https://midas.example/?period=2027-01"),
			currentDate: new Date("2026-08-04T12:00:00Z"),
		});

		expect(screen.getByText("Enero de 2027")).toBeTruthy();
	});
});
