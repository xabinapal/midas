import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ComponentProps } from "svelte";
import type { SuperValidated } from "sveltekit-superforms";
import NewExpensePage from "./+page.svelte";

type PageData = ComponentProps<typeof NewExpensePage>["data"];
type ExpenseForm = PageData["form"]["data"];

const categories: PageData["categories"] = [
	{
		id: "cat-1",
		householdId: "hh-1",
		name: "Suministros",
		slug: "suministros",
		ordering: 0,
		isActive: true,
		createdAt: "2026-08-01T00:00:00.000Z",
		updatedAt: "2026-08-01T00:00:00.000Z",
		operationId: null,
	},
];

const accounts: PageData["accounts"] = [
	{
		id: "acc-1",
		householdId: "hh-1",
		name: "Cuenta común",
		classification: "shared",
		status: "active",
		currency: "EUR",
		createdAt: "2026-08-01T00:00:00.000Z",
		updatedAt: "2026-08-01T00:00:00.000Z",
		holders: [
			{ memberId: "m-1", displayName: "Alex" },
			{ memberId: "m-2", displayName: "Sam" },
		],
	},
];

const members: PageData["members"] = [
	{ id: "m-1", householdId: "hh-1", displayName: "Alex", isActive: true, defaultWeight: 1 },
	{ id: "m-2", householdId: "hh-1", displayName: "Sam", isActive: true, defaultWeight: 1 },
];

const periods: PageData["periods"] = [
	{
		id: "per-1",
		householdId: "hh-1",
		slug: "2026-08",
		label: "Agosto de 2026",
		startDate: "2026-08-01",
		endDate: "2026-08-31",
		kind: "standard",
		createdAt: "2026-08-01T00:00:00.000Z",
		operationId: null,
	},
];

function formData(overrides: Partial<ExpenseForm> = {}): ExpenseForm {
	return {
		description: "",
		categoryId: "",
		reportingPeriodId: "per-1",
		amount: "",
		valueKind: "actual",
		accountingDate: "2026-08-05",
		dueDate: "",
		serviceStartDate: "",
		serviceEndDate: "",
		accountHintId: "",
		allocationMethod: "equal",
		memberIds: ["m-1", "m-2"],
		memberValues: [],
		paid: false,
		paymentAccountId: "",
		paymentDate: "2026-08-05",
		...overrides,
	};
}

function superValidated(
	overrides: Partial<SuperValidated<ExpenseForm, string>> = {},
): SuperValidated<ExpenseForm, string> {
	return {
		id: "expense",
		valid: false,
		posted: false,
		errors: {},
		data: formData(),
		constraints: {},
		...overrides,
	} as SuperValidated<ExpenseForm, string>;
}

function data(overrides: Partial<PageData> = {}): PageData {
	return {
		user: null,
		currency: "EUR",
		categories,
		accounts,
		members,
		periods,
		form: superValidated(),
		...overrides,
	};
}

describe("NewExpensePage", () => {
	it("renders accessible Spanish fields", () => {
		render(NewExpensePage, { params: {}, data: data(), form: undefined as never });

		expect(screen.getByLabelText("Descripción")).toBeTruthy();
		expect(screen.getByLabelText("Importe (EUR)")).toBeTruthy();
		expect(screen.getByLabelText("Categoría")).toBeTruthy();
		expect(screen.getByLabelText("Periodo")).toBeTruthy();
		expect(screen.getByLabelText("Fecha del gasto")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Registrar gasto" })).toBeTruthy();
	});

	it("shows validation errors associated with their fields", () => {
		render(NewExpensePage, {
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

	it("reveals payment fields only when the expense is marked as paid", async () => {
		const user = userEvent.setup();
		render(NewExpensePage, { params: {}, data: data(), form: undefined as never });

		expect(screen.queryByLabelText("Cuenta del pago")).toBeNull();

		await user.click(screen.getByRole("checkbox", { name: "Ya está pagado" }));

		expect(screen.getByLabelText("Cuenta del pago")).toBeTruthy();
		expect(screen.getByLabelText("Fecha del pago")).toBeTruthy();
	});

	it("shows the resolved allocation preview for both members", async () => {
		const user = userEvent.setup();
		render(NewExpensePage, { params: {}, data: data(), form: undefined as never });

		await user.type(screen.getByLabelText("Importe (EUR)"), "100");

		expect(await screen.findByText(/Reparto · A partes iguales/)).toBeTruthy();
		expect(screen.getAllByText(/50,00/)).toHaveLength(2);
	});

	it("offers every allocation method with its Spanish label", () => {
		render(NewExpensePage, { params: {}, data: data(), form: undefined as never });

		const options = screen.getByLabelText("Método de reparto").querySelectorAll("option");
		const values = [...options].map((option) => option.textContent);
		expect(values).toEqual([
			"A partes iguales",
			"Pesos del hogar",
			"Pesos personalizados",
			"Porcentajes",
			"Importes fijos",
		]);
	});
});
