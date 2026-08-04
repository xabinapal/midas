import { render, screen, within } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import AppNavigation from "./app-navigation.svelte";
import FinancialStatus from "./financial-status.svelte";
import LoadingState from "./loading-state.svelte";
import ToastMessage from "./toast-message.svelte";

describe("foundation presentation states", () => {
	it("presents payment and settlement as independent text labels", () => {
		render(FinancialStatus, { status: "paid" });
		render(FinancialStatus, { status: "pending" });

		expect(screen.getByText("Pagado")).toBeTruthy();
		expect(screen.getByText("Pendiente de compensar")).toBeTruthy();
	});

	it("keeps complete Spanish navigation labels at a narrow viewport", () => {
		Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
		render(AppNavigation, { currentPath: "/" });
		const navigation = screen.getByRole("navigation", { name: "Navegación móvil" });

		for (const label of ["Resumen", "Gastos", "Añadir", "Saldos", "Más"]) {
			const visibleLabel = within(navigation).getByText(label);
			expect(visibleLabel.classList.contains("whitespace-normal")).toBe(true);
			expect(visibleLabel.classList.contains("truncate")).toBe(false);
		}
	});

	it("announces live feedback without depending on animation", () => {
		render(ToastMessage, { message: "Gasto guardado" });
		render(LoadingState, { label: "Cargando gastos" });

		expect(screen.getByRole("status").textContent).toContain("Gasto guardado");
		expect(screen.getByLabelText("Cargando gastos").getAttribute("aria-busy")).toBe("true");
		expect(document.querySelector(".skeleton")?.className).not.toContain("animate-");
	});
});
