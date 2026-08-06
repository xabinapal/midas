import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { ComponentProps } from "svelte";
import type { SuperValidated } from "sveltekit-superforms";
import NewTemplatePage from "./+page.svelte";

type PageData = ComponentProps<typeof NewTemplatePage>["data"];
type TemplateForm = PageData["form"]["data"];

function category(overrides: Partial<PageData["categories"][number]> = {}): PageData["categories"][number] {
	return {
		id: "cat-1",
		householdId: "hh-1",
		name: "Vivienda",
		slug: "vivienda",
		ordering: 0,
		isActive: true,
		createdAt: "2026-08-01T00:00:00.000Z",
		updatedAt: "2026-08-01T00:00:00.000Z",
		operationId: null,
		...overrides,
	};
}

function account(overrides: Partial<PageData["accounts"][number]> = {}): PageData["accounts"][number] {
	return {
		id: "acc-1",
		householdId: "hh-1",
		name: "Cuenta común",
		classification: "shared",
		status: "active",
		currency: "EUR",
		createdAt: "2026-08-01T00:00:00.000Z",
		updatedAt: "2026-08-01T00:00:00.000Z",
		...overrides,
	};
}

function member(overrides: Partial<PageData["members"][number]> = {}): PageData["members"][number] {
	return {
		id: "m-1",
		householdId: "hh-1",
		displayName: "Alex",
		isActive: true,
		defaultWeight: 1,
		...overrides,
	};
}

function formData(overrides: Partial<TemplateForm> = {}): TemplateForm {
	return {
		description: "",
		categoryId: "",
		amount: "",
		cadence: "monthly",
		intervalCount: "1",
		startDate: "2026-08-06",
		endDate: "",
		dueDay: "",
		serviceSpanMonths: "",
		accountHintId: "",
		allocationMethod: "equal",
		memberIds: ["m-1", "m-2"],
		memberValues: [],
		...overrides,
	};
}

function form(overrides: Partial<SuperValidated<TemplateForm, string>> = {}): SuperValidated<TemplateForm, string> {
	return {
		id: "template",
		valid: false,
		posted: false,
		errors: {},
		data: formData(),
		constraints: {},
		...overrides,
	} as SuperValidated<TemplateForm, string>;
}

function data(overrides: Partial<PageData> = {}): PageData {
	return {
		user: null,
		categories: [category()],
		accounts: [account()],
		members: [member(), member({ id: "m-2", displayName: "Sam" })],
		currency: "EUR",
		form: form(),
		...overrides,
	};
}

describe("NewTemplatePage", () => {
	it("renders accessible Spanish fields", () => {
		render(NewTemplatePage, { params: {}, data: data(), form: undefined as never });

		expect(screen.getByLabelText("Descripción")).toBeTruthy();
		expect(screen.getByLabelText("Categoría")).toBeTruthy();
		expect(screen.getByLabelText(/Importe/)).toBeTruthy();
		expect(screen.getByLabelText("Periodicidad")).toBeTruthy();
		expect(screen.getByLabelText("Primera fecha")).toBeTruthy();
		expect(screen.getByLabelText("Reparto")).toBeTruthy();
		expect(screen.getByLabelText("Alex")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Crear plantilla" })).toBeTruthy();
	});

	it("shows validation errors associated with the amount field", () => {
		render(NewTemplatePage, {
			params: {},
			data: data({
				form: form({
					posted: true,
					errors: { amount: ["Indica un importe válido mayor que cero (por ejemplo 1.234,56)"] },
				}),
			}),
			form: undefined as never,
		});

		expect(screen.getByText(/Indica un importe válido/)).toBeTruthy();
	});

	it("never offers fixed amounts as an allocation method", () => {
		render(NewTemplatePage, { params: {}, data: data(), form: undefined as never });

		const options = screen.getByLabelText("Reparto").querySelectorAll("option");
		const values = [...options].map((option) => option.textContent);
		expect(values).toEqual(["A partes iguales", "Pesos del hogar", "Pesos personalizados", "Porcentajes"]);
		expect(values).not.toContain("Importes fijos");
	});

	it("explains that edits do not alter already generated expenses", () => {
		render(NewTemplatePage, { params: {}, data: data(), form: undefined as never });

		expect(screen.getByText(/cambiarla después no altera los ya generados/)).toBeTruthy();
	});

	it("shows the no-categories guard instead of the form when no active categories exist", () => {
		render(NewTemplatePage, { params: {}, data: data({ categories: [] }), form: undefined as never });

		expect(screen.getByText(/No hay categorías activas/)).toBeTruthy();
		expect(screen.getByRole("link", { name: "Crea primero una categoría" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Crear plantilla" })).toBeNull();
	});
});
