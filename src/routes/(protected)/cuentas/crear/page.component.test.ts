import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { ComponentProps } from "svelte";
import type { SuperValidated } from "sveltekit-superforms";
import CreateAccountPage from "./+page.svelte";

type PageData = ComponentProps<typeof CreateAccountPage>["data"];
type AccountForm = PageData["form"]["data"];

function superValidated(
	overrides: Partial<SuperValidated<AccountForm, string>> = {},
): SuperValidated<AccountForm, string> {
	return {
		id: "account",
		valid: false,
		posted: false,
		errors: {},
		data: { name: "", classification: "personal", holderMemberIds: [] },
		constraints: {},
		...overrides,
	} as SuperValidated<AccountForm, string>;
}

function data(form = superValidated()): PageData {
	return {
		user: null,
		members: [
			{ id: "m-1", householdId: "hh-1", displayName: "Alex", isActive: true, defaultWeight: 50 },
			{ id: "m-2", householdId: "hh-1", displayName: "Sam", isActive: true, defaultWeight: 50 },
		],
		form,
	};
}

describe("CreateAccountPage", () => {
	it("renders accessible Spanish fields with member choices", () => {
		render(CreateAccountPage, { params: {}, data: data(), form: undefined as never });

		expect(screen.getByLabelText("Nombre")).toBeTruthy();
		expect(screen.getByText("Tipo de cuenta")).toBeTruthy();
		expect(screen.getByLabelText(/Alex/)).toBeTruthy();
		expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeTruthy();
	});

	it("shows form-level server messages", () => {
		render(CreateAccountPage, {
			params: {},
			data: data(superValidated({ posted: true, message: "Una cuenta compartida necesita al menos dos titulares" })),
			form: undefined as never,
		});

		expect(screen.getByRole("alert").textContent).toContain("al menos dos titulares");
	});
});
