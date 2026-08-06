import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { ComponentProps } from "svelte";
import type { SuperValidated } from "sveltekit-superforms";
import EditAccountPage from "./+page.svelte";

type PageData = ComponentProps<typeof EditAccountPage>["data"];
type EditForm = PageData["form"]["data"];

function superValidated(overrides: Partial<SuperValidated<EditForm, string>> = {}): SuperValidated<EditForm, string> {
	return {
		id: "edit-account",
		valid: false,
		posted: false,
		errors: {},
		data: { name: "Cuenta común", holderMemberIds: ["m-1", "m-2"] },
		constraints: {},
		...overrides,
	} as SuperValidated<EditForm, string>;
}

function data(form = superValidated()): PageData {
	return {
		user: null,
		account: {
			id: "acc-1",
			householdId: "hh-1",
			name: "Cuenta común",
			classification: "shared",
			status: "draft",
			currency: "EUR",
			createdAt: "2026-08-01T00:00:00.000Z",
			updatedAt: "2026-08-01T00:00:00.000Z",
			holders: [
				{ memberId: "m-1", displayName: "Alex" },
				{ memberId: "m-2", displayName: "Sam" },
			],
		},
		members: [
			{ id: "m-1", householdId: "hh-1", displayName: "Alex", isActive: true, defaultWeight: 50 },
			{ id: "m-2", householdId: "hh-1", displayName: "Sam", isActive: true, defaultWeight: 50 },
		],
		form,
	};
}

describe("EditAccountPage", () => {
	it("renders draft fields with current holders preselected", () => {
		render(EditAccountPage, { params: { id: "acc-1" }, data: data(), form: undefined as never });

		expect(screen.getByLabelText<HTMLInputElement>("Nombre").value).toBe("Cuenta común");
		expect(screen.getByText(/solo las cuentas en borrador/)).toBeTruthy();
		expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeTruthy();
	});

	it("shows form-level server messages", () => {
		render(EditAccountPage, {
			params: { id: "acc-1" },
			data: data(superValidated({ posted: true, message: "No se pudo guardar la cuenta" })),
			form: undefined as never,
		});

		expect(screen.getByRole("alert").textContent).toContain("No se pudo guardar la cuenta");
	});
});
