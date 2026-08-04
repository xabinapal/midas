import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import AppNavigation from "./app-navigation.svelte";

const destinationNames = ["Resumen", "Gastos", "Saldos", "Más"];

describe("AppNavigation", () => {
	it("exposes equivalent mobile and desktop destinations", () => {
		render(AppNavigation, { currentPath: "/" });

		for (const navigationName of ["Navegación móvil", "Navegación de escritorio"]) {
			const navigation = screen.getByRole("navigation", { name: navigationName });

			for (const destinationName of destinationNames) {
				const role = destinationName === "Resumen" ? "link" : "button";
				expect(within(navigation).getByRole(role, { name: destinationName })).toBeTruthy();
			}
			expect(within(navigation).getByRole("button", { name: "Añadir gasto" })).toBeTruthy();
		}
	});

	it("identifies only the active destination", () => {
		render(AppNavigation, { currentPath: "/" });
		const mobileNavigation = screen.getByRole("navigation", { name: "Navegación móvil" });

		expect(within(mobileNavigation).getByRole("link", { name: "Resumen" }).getAttribute("aria-current")).toBe("page");
		expect(within(mobileNavigation).getByRole("button", { name: "Añadir gasto" }).hasAttribute("aria-current")).toBe(
			false,
		);
	});

	it("keeps every mobile action keyboard reachable in visual order", async () => {
		const user = userEvent.setup();
		render(AppNavigation, { currentPath: "/" });
		const expectedNames = ["Resumen", "Gastos", "Añadir gasto", "Saldos", "Más"];

		for (const expectedName of expectedNames) {
			await user.tab();
			expect(document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent?.trim()).toBe(
				expectedName,
			);
		}
	});
});
