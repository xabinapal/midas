import { render, screen } from "@testing-library/svelte";
import { beforeAll, describe, expect, it } from "vitest";
import type { ComponentProps } from "svelte";
import TemplatesPage from "./+page.svelte";

type PageData = ComponentProps<typeof TemplatesPage>["data"];
type TemplateRow = PageData["rows"][number];

beforeAll(() => {
	// jsdom does not implement <dialog> modal behavior
	HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
		this.setAttribute("open", "");
	};
	HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
		this.removeAttribute("open");
	};
});

function row(overrides: Partial<TemplateRow["template"]> = {}, categoryName = "Vivienda"): TemplateRow {
	return {
		template: {
			id: "tpl-1",
			householdId: "hh-1",
			categoryId: "cat-1",
			description: "Alquiler",
			estimatedAmountMinor: 90000,
			cadence: "monthly",
			intervalCount: 1,
			startDate: "2026-01-05",
			endDate: null,
			dueDay: 5,
			serviceSpanMonths: null,
			accountHintId: null,
			allocationMethod: "equal",
			status: "active",
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
			operationId: null,
			...overrides,
		},
		categoryName,
		memberCount: 2,
	};
}

function data(overrides: Partial<PageData> = {}): PageData {
	return {
		user: null,
		currency: "EUR",
		rows: [
			row(),
			row({ id: "tpl-2", description: "Seguro del hogar", cadence: "yearly", intervalCount: 2 }, "Vivienda"),
			row({ id: "tpl-3", description: "Antigua cuota", status: "disabled" }, "Ocio"),
		],
		...overrides,
	};
}

describe("TemplatesPage", () => {
	it("renders template rows with cadence labels, amounts, and status actions", () => {
		render(TemplatesPage, { params: {}, data: data(), form: undefined as never });

		expect(screen.getByText("Alquiler")).toBeTruthy();
		expect(screen.getByText(/Vivienda · Mensual · 900,00/)).toBeTruthy();
		expect(screen.getByText(/Anual · cada 2 años · 900,00/)).toBeTruthy();

		expect(screen.getAllByText("Activa")).toHaveLength(2);
		expect(screen.getByText("Desactivada")).toBeTruthy();

		const editLinks = screen.getAllByRole("link", { name: "Editar" });
		expect(editLinks[0]!.getAttribute("href")).toContain("/gastos/plantillas/tpl-1/editar");

		expect(screen.getAllByRole("button", { name: "Desactivar" })).toHaveLength(2);
		expect(screen.getByRole("button", { name: "Reactivar" })).toBeTruthy();
	});

	it("renders the empty state when there are no templates", () => {
		render(TemplatesPage, { params: {}, data: data({ rows: [] }), form: undefined as never });

		expect(screen.getByText("Sin plantillas")).toBeTruthy();
		expect(screen.getByText(/Crea una plantilla para generar gastos previstos cada mes o año/)).toBeTruthy();
		expect(screen.getAllByRole("link", { name: /Nueva plantilla|Crear la primera plantilla/ }).length).toBeGreaterThan(
			0,
		);
	});
});
