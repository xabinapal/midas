import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ComponentProps } from "svelte";
import type { SuperValidated } from "sveltekit-superforms";
import NewTransferPage from "./+page.svelte";

type PageData = ComponentProps<typeof NewTransferPage>["data"];
type TransferForm = PageData["form"]["data"];

function account(overrides: Partial<PageData["accounts"][number]> = {}): PageData["accounts"][number] {
	return {
		id: "acc-1",
		householdId: "hh-1",
		name: "Cuenta de Alex",
		classification: "personal",
		status: "active",
		currency: "EUR",
		createdAt: "2026-08-01T00:00:00.000Z",
		updatedAt: "2026-08-01T00:00:00.000Z",
		holders: [{ memberId: "m-1", displayName: "Alex" }],
		...overrides,
	};
}

const accounts = [
	account(),
	account({
		id: "acc-2",
		name: "Cuenta común",
		classification: "shared",
		holders: [
			{ memberId: "m-1", displayName: "Alex" },
			{ memberId: "m-2", displayName: "Sam" },
		],
	}),
];

function formData(overrides: Partial<TransferForm> = {}): TransferForm {
	return {
		sourceAccountId: "",
		destinationAccountId: "",
		amount: "",
		effectiveDate: "2026-08-05",
		description: "",
		classification: "unclassified",
		...overrides,
	};
}

function superValidated(
	overrides: Partial<SuperValidated<TransferForm, string>> = {},
): SuperValidated<TransferForm, string> {
	return {
		id: "transfer",
		valid: false,
		posted: false,
		errors: {},
		data: formData(),
		constraints: {},
		...overrides,
	} as SuperValidated<TransferForm, string>;
}

function data(overrides: Partial<PageData> = {}): PageData {
	return { user: null, currency: "EUR", accounts, form: superValidated(), ...overrides };
}

describe("NewTransferPage", () => {
	it("renders accessible Spanish fields", () => {
		render(NewTransferPage, { params: {}, data: data(), form: undefined as never });

		expect(screen.getByLabelText("Cuenta de origen")).toBeTruthy();
		expect(screen.getByLabelText("Cuenta de destino")).toBeTruthy();
		expect(screen.getByLabelText(/Importe/)).toBeTruthy();
		expect(screen.getByLabelText("Fecha")).toBeTruthy();
		expect(screen.getByLabelText(/Descripción/)).toBeTruthy();
		expect(screen.getByLabelText("Clasificación")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Registrar transferencia" })).toBeTruthy();
	});

	it("shows validation errors associated with their fields", () => {
		render(NewTransferPage, {
			params: {},
			data: data({
				form: superValidated({
					posted: true,
					errors: { amount: ["Indica un importe válido mayor que cero (por ejemplo 1.234,56)"] },
				}),
			}),
			form: undefined as never,
		});

		expect(screen.getByText(/Indica un importe válido/)).toBeTruthy();
	});

	it("confirms the attributed member before posting a contribution", async () => {
		const user = userEvent.setup();
		render(NewTransferPage, { params: {}, data: data(), form: undefined as never });

		await user.selectOptions(screen.getByLabelText("Cuenta de origen"), "acc-1");
		await user.selectOptions(screen.getByLabelText("Cuenta de destino"), "acc-2");
		await user.selectOptions(screen.getByLabelText("Clasificación"), "contribution");

		expect(screen.getByText(/La aportación se atribuirá íntegramente a Alex/)).toBeTruthy();
	});

	it("limits classifications to the ones valid for the selected direction", async () => {
		const user = userEvent.setup();
		render(NewTransferPage, { params: {}, data: data(), form: undefined as never });

		await user.selectOptions(screen.getByLabelText("Cuenta de origen"), "acc-1");
		await user.selectOptions(screen.getByLabelText("Cuenta de destino"), "acc-2");

		const options = screen.getByLabelText("Clasificación").querySelectorAll("option");
		const values = [...options].map((option) => option.textContent);
		expect(values).toEqual(["Sin clasificar", "Traspaso", "Aportación"]);
	});
});
