import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { ComponentProps } from "svelte";
import type { SuperValidated } from "sveltekit-superforms";
import ObservePage from "./+page.svelte";

type PageData = ComponentProps<typeof ObservePage>["data"];
type ObserveForm = PageData["form"]["data"];

function superValidated(
	overrides: Partial<SuperValidated<ObserveForm, string>> = {},
): SuperValidated<ObserveForm, string> {
	return {
		id: "observation",
		valid: false,
		posted: false,
		errors: {},
		data: { amount: "", effectiveDate: "2026-08-05" },
		constraints: {},
		...overrides,
	} as SuperValidated<ObserveForm, string>;
}

function data(form = superValidated()): PageData {
	return {
		user: null,
		account: {
			id: "acc-1",
			householdId: "hh-1",
			name: "Cuenta común",
			classification: "shared",
			status: "active",
			currency: "EUR",
			createdAt: "2026-08-01T00:00:00.000Z",
			updatedAt: "2026-08-01T00:00:00.000Z",
			holders: [],
		},
		form,
	};
}

describe("ObservePage", () => {
	it("renders honest-balance guidance and fields", () => {
		render(ObservePage, { params: { id: "acc-1" }, data: data(), form: undefined as never });

		expect(screen.getByLabelText(/Saldo observado/)).toBeTruthy();
		expect(screen.getByLabelText("Fecha de la observación")).toBeTruthy();
		expect(screen.getByText(/no se sincroniza con el banco/i)).toBeTruthy();
		expect(screen.getByRole("button", { name: "Registrar observación" })).toBeTruthy();
	});

	it("shows field validation errors", () => {
		render(ObservePage, {
			params: { id: "acc-1" },
			data: data(
				superValidated({ posted: true, errors: { amount: ["Indica un importe válido (por ejemplo 1.234,56)"] } }),
			),
			form: undefined as never,
		});

		expect(screen.getByText(/Indica un importe válido/)).toBeTruthy();
	});
});
