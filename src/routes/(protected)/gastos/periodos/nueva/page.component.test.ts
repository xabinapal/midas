import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { ComponentProps } from "svelte";
import type { SuperValidated } from "sveltekit-superforms";
import NewPeriodPage from "./+page.svelte";

type PageData = ComponentProps<typeof NewPeriodPage>["data"];
type PeriodForm = PageData["form"]["data"];

function form(overrides: Partial<SuperValidated<PeriodForm, string>> = {}): SuperValidated<PeriodForm, string> {
	return {
		id: "period",
		valid: false,
		posted: false,
		errors: {},
		data: { label: "", startDate: "", endDate: "" },
		constraints: {},
		...overrides,
	} as SuperValidated<PeriodForm, string>;
}

function data(overrides: Partial<PageData> = {}): PageData {
	return { user: null, form: form(), ...overrides };
}

describe("NewPeriodPage", () => {
	it("renders accessible fields and helper copy", () => {
		render(NewPeriodPage, { params: {}, data: data(), form: undefined as never });

		expect(screen.getByLabelText("Nombre")).toBeTruthy();
		expect(screen.getByLabelText("Inicio")).toBeTruthy();
		expect(screen.getByLabelText(/^Fin/)).toBeTruthy();
		expect(screen.getByRole("button", { name: "Crear periodo" })).toBeTruthy();
		expect(screen.getByText(/agrupan gastos fuera de los meses naturales/)).toBeTruthy();
		expect(screen.getByText(/El gasto del día de fin ya pertenece al siguiente periodo/)).toBeTruthy();
	});

	it("shows validation errors associated with their fields", () => {
		render(NewPeriodPage, {
			params: {},
			data: data({
				form: form({ posted: true, errors: { endDate: ["El fin debe ser posterior al inicio"] } }),
			}),
			form: undefined as never,
		});

		expect(screen.getByText("El fin debe ser posterior al inicio")).toBeTruthy();
	});
});
