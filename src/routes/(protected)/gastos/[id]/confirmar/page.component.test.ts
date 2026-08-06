import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { ComponentProps } from "svelte";
import type { SuperValidated } from "sveltekit-superforms";
import ActualizeExpensePage from "./+page.svelte";

type PageData = ComponentProps<typeof ActualizeExpensePage>["data"];
type ActualizeForm = PageData["form"]["data"];

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

function formData(overrides: Partial<ActualizeForm> = {}): ActualizeForm {
	return { amount: "", ...overrides };
}

function superValidated(
	overrides: Partial<SuperValidated<ActualizeForm, string>> = {},
): SuperValidated<ActualizeForm, string> {
	return {
		id: "actualize",
		valid: false,
		posted: false,
		errors: {},
		data: formData(),
		constraints: {},
		...overrides,
	} as SuperValidated<ActualizeForm, string>;
}

function data(overrides: Partial<PageData> = {}): PageData {
	return {
		user: null,
		expense: expense(),
		currency: "EUR",
		plannedAmountMinor: 10000,
		plannedLines: [
			{ memberId: "m-1", memberName: "Alex", basis: "planned", amountMinor: 5000 },
			{ memberId: "m-2", memberName: "Sam", basis: "planned", amountMinor: 5000 },
		],
		allocationMethod: "equal",
		allocationParams: [
			{ memberId: "m-1", value: null },
			{ memberId: "m-2", value: null },
		],
		members: [
			{ id: "m-1", householdId: "hh-1", displayName: "Alex", isActive: true, defaultWeight: 1 },
			{ id: "m-2", householdId: "hh-1", displayName: "Sam", isActive: true, defaultWeight: 1 },
		],
		form: superValidated(),
		...overrides,
	};
}

describe("ActualizeExpensePage", () => {
	it("shows the planned amount as reference with an accessible amount field", () => {
		render(ActualizeExpensePage, { params: { id: "exp-1" }, data: data(), form: undefined as never });

		expect(screen.getByRole("heading", { name: "Confirmar importe real" })).toBeTruthy();
		expect(screen.getByText(/100,00 €/)).toBeTruthy();
		expect(screen.getByText("Alex")).toBeTruthy();
		expect(screen.getByLabelText(/Importe real/)).toBeTruthy();
		expect(screen.getByRole("button", { name: "Confirmar importe real" })).toBeTruthy();
	});

	it("warns that the action cannot be undone", () => {
		render(ActualizeExpensePage, { params: { id: "exp-1" }, data: data(), form: undefined as never });

		expect(screen.getByText(/esta acción no se puede deshacer/)).toBeTruthy();
	});

	it("shows validation errors associated with the amount", () => {
		render(ActualizeExpensePage, {
			params: { id: "exp-1" },
			data: data({ form: superValidated({ posted: true, errors: { amount: ["El importe real es obligatorio"] } }) }),
			form: undefined as never,
		});

		expect(screen.getByText("El importe real es obligatorio")).toBeTruthy();
	});
});
