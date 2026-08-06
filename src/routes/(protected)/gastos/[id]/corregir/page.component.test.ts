import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ComponentProps } from "svelte";
import type { SuperValidated } from "sveltekit-superforms";
import CorrectExpensePage from "./+page.svelte";

type PageData = ComponentProps<typeof CorrectExpensePage>["data"];
type CorrectionForm = PageData["form"]["data"];

function expense(overrides: Partial<PageData["expense"]> = {}): PageData["expense"] {
	return {
		id: "exp-1",
		householdId: "hh-1",
		categoryId: "cat-1",
		reportingPeriodId: "per-1",
		description: "Factura de la luz",
		reference: "SUM-2026-08-01",
		status: "posted",
		plannedAmountMinor: null,
		plannedVersion: 1,
		actualAmountMinor: 10000,
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

function formData(overrides: Partial<CorrectionForm> = {}): CorrectionForm {
	return { mode: "reverse", amount: "", description: "", ...overrides };
}

function superValidated(
	overrides: Partial<SuperValidated<CorrectionForm, string>> = {},
): SuperValidated<CorrectionForm, string> {
	return {
		id: "correction",
		valid: false,
		posted: false,
		errors: {},
		data: formData(),
		constraints: {},
		...overrides,
	} as SuperValidated<CorrectionForm, string>;
}

function data(overrides: Partial<PageData> = {}): PageData {
	return {
		user: null,
		expense: expense(),
		currency: "EUR",
		applicableMinor: 10000,
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

describe("CorrectExpensePage", () => {
	it("warns naming the record and offers both correction modes", () => {
		render(CorrectExpensePage, { params: { id: "exp-1" }, data: data(), form: undefined as never });

		expect(screen.getByRole("heading", { name: /Corregir «Factura de la luz»/ })).toBeTruthy();
		expect(screen.getByRole("status").textContent).toContain("quedará revertido y visible en el historial");
		expect(screen.getByRole("radio", { name: /Solo revertir/ })).toBeTruthy();
		expect(screen.getByRole("radio", { name: /Revertir y registrar la corrección/ })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Revertir gasto" })).toBeTruthy();
	});

	it("reveals the corrected amount input in replace mode", async () => {
		const user = userEvent.setup();
		render(CorrectExpensePage, { params: { id: "exp-1" }, data: data(), form: undefined as never });

		expect(screen.queryByLabelText(/Importe corregido/)).toBeNull();
		await user.click(screen.getByRole("radio", { name: /Revertir y registrar la corrección/ }));

		expect(screen.getByLabelText(/Importe corregido/)).toBeTruthy();
		expect(screen.getByLabelText(/Descripción corregida/)).toBeTruthy();
	});
});
