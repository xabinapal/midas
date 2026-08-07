import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { ComponentProps } from "svelte";
import type { SuperValidated } from "sveltekit-superforms";
import EditExpensePage from "./+page.svelte";

type PageData = ComponentProps<typeof EditExpensePage>["data"];
type EditForm = PageData["form"]["data"];

function expense(overrides: Partial<PageData["expense"]> = {}): PageData["expense"] {
	return {
		id: "exp-1",
		householdId: "hh-1",
		categoryId: "cat-1",
		reportingPeriodId: "per-1",
		description: "Factura de la luz",
		reference: "SUM-2026-08-01",
		status: "posted",
		plannedAmountMinor: 10000,
		plannedVersion: 1,
		actualAmountMinor: null,
		accountingDate: "2026-08-01",
		dueDate: "2026-08-15",
		serviceStartDate: null,
		serviceEndDate: null,
		allocationMethod: "equal",
		accountHintId: null,
		templateId: null,
		scheduledDueDate: null,
		realizedByExpenseId: null,
		chainRootId: "exp-1",
		replacesId: null,
		reversedById: null,
		actorUserId: null,
		operationId: null,
		createdAt: "2026-08-01T00:00:00.000Z",
		updatedAt: "2026-08-01T00:00:00.000Z",
		...overrides,
	};
}

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

function formData(overrides: Partial<EditForm> = {}): EditForm {
	return {
		description: "Factura de la luz",
		amount: "100",
		dueDate: "2026-08-15",
		categoryId: "cat-1",
		reportingPeriodId: "per-1",
		serviceStartDate: "",
		serviceEndDate: "",
		accountHintId: "",
		allocationMethod: "equal",
		memberIds: ["m-1", "m-2"],
		memberValues: [],
		...overrides,
	};
}

function superValidated(overrides: Partial<SuperValidated<EditForm, string>> = {}): SuperValidated<EditForm, string> {
	return {
		id: "edit",
		valid: false,
		posted: false,
		errors: {},
		data: formData(),
		constraints: {},
		...overrides,
	} as SuperValidated<EditForm, string>;
}

function data(overrides: Partial<PageData> = {}): PageData {
	return {
		user: null,
		expense: expense(),
		isDraft: false,
		currency: "EUR",
		periods,
		accounts,
		members,
		categories,
		storedInactiveMembers: [],
		form: superValidated(),
		...overrides,
	};
}

describe("EditExpensePage", () => {
	it("renders accessible Spanish fields and the submit", () => {
		render(EditExpensePage, { params: { id: "exp-1" }, data: data(), form: undefined as never });

		expect(screen.getByRole("heading", { name: "Editar gasto previsto" })).toBeTruthy();
		expect(screen.getByLabelText("Descripción")).toBeTruthy();
		expect(screen.getByLabelText(/Importe previsto/)).toBeTruthy();
		expect(screen.getByLabelText(/Vencimiento/)).toBeTruthy();
		expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeTruthy();
	});

	it("renders the Periodo select and the live allocation preview", () => {
		render(EditExpensePage, { params: { id: "exp-1" }, data: data(), form: undefined as never });

		expect(screen.getByLabelText("Periodo")).toBeTruthy();
		expect(screen.getByText(/Reparto · A partes iguales/)).toBeTruthy();
		expect(screen.getAllByText(/50,00/)).toHaveLength(2);
	});

	it("titles the form as a draft editor for drafts", () => {
		render(EditExpensePage, {
			params: { id: "exp-1" },
			data: data({ isDraft: true, expense: expense({ status: "draft", reference: null }) }),
			form: undefined as never,
		});

		expect(screen.getByRole("heading", { name: "Editar borrador" })).toBeTruthy();
	});

	it("shows validation errors associated with their fields", () => {
		render(EditExpensePage, {
			params: { id: "exp-1" },
			data: data({
				form: superValidated({ posted: true, errors: { description: ["La descripción es obligatoria"] } }),
			}),
			form: undefined as never,
		});

		expect(screen.getByText("La descripción es obligatoria")).toBeTruthy();
	});
});
