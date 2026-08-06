import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ComponentProps } from "svelte";
import type { SuperValidated } from "sveltekit-superforms";
import PayExpensePage from "./+page.svelte";

type PageData = ComponentProps<typeof PayExpensePage>["data"];
type PaymentForm = PageData["form"]["data"];

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

function formData(overrides: Partial<PaymentForm> = {}): PaymentForm {
	return {
		accountId: "",
		amount: "60",
		effectiveDate: "2026-08-05",
		description: "Factura de la luz",
		applicationAmount: "60",
		...overrides,
	};
}

function superValidated(
	overrides: Partial<SuperValidated<PaymentForm, string>> = {},
): SuperValidated<PaymentForm, string> {
	return {
		id: "payment",
		valid: false,
		posted: false,
		errors: {},
		data: formData(),
		constraints: {},
		...overrides,
	} as SuperValidated<PaymentForm, string>;
}

function data(overrides: Partial<PageData> = {}): PageData {
	return {
		user: null,
		expense: expense(),
		currency: "EUR",
		unpaidMinor: 6000,
		accounts,
		form: superValidated(),
		...overrides,
	};
}

describe("PayExpensePage", () => {
	it("shows the unpaid helper and accessible fields", () => {
		render(PayExpensePage, { params: { id: "exp-1" }, data: data(), form: undefined as never });

		expect(screen.getByRole("heading", { name: "Registrar pago" })).toBeTruthy();
		expect(screen.getByText(/Quedan por pagar 60,00 €/)).toBeTruthy();
		expect(screen.getByLabelText("Cuenta del pago")).toBeTruthy();
		expect(screen.getByLabelText(/Importe del pago/)).toBeTruthy();
		expect(screen.getByLabelText("Fecha")).toBeTruthy();
		expect(screen.getByLabelText("Concepto")).toBeTruthy();
		expect(screen.getByLabelText(/Importe aplicado a este gasto/)).toBeTruthy();
		expect(screen.getByRole("button", { name: "Registrar pago" })).toBeTruthy();
	});

	it("shows validation errors associated with the amount", () => {
		render(PayExpensePage, {
			params: { id: "exp-1" },
			data: data({ form: superValidated({ posted: true, errors: { amount: ["El importe es obligatorio"] } }) }),
			form: undefined as never,
		});

		expect(screen.getByText("El importe es obligatorio")).toBeTruthy();
	});

	it("explains the funder attribution for a personal account", async () => {
		const user = userEvent.setup();
		render(PayExpensePage, { params: { id: "exp-1" }, data: data(), form: undefined as never });

		await user.selectOptions(screen.getByLabelText("Cuenta del pago"), "acc-1");

		expect(screen.getByText(/El pago se atribuirá a Alex/)).toBeTruthy();
	});
});
