import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import type { ComponentProps } from "svelte";
import type { SuperValidated } from "sveltekit-superforms";
import PaymentDetailPage from "./+page.svelte";

type PageData = ComponentProps<typeof PaymentDetailPage>["data"];
type ApplyForm = PageData["applyForm"]["data"];
type CorrectForm = PageData["correctForm"]["data"];

beforeAll(() => {
	// jsdom does not implement <dialog> modal behavior
	HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
		this.setAttribute("open", "");
	};
	HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
		this.removeAttribute("open");
	};
});

function payment(overrides: Partial<PageData["payment"]> = {}): PageData["payment"] {
	return {
		id: "pay-1",
		householdId: "hh-1",
		accountId: "acc-1",
		amountMinor: 60000,
		description: "Pago colegio julio",
		effectiveAt: "2026-08-02T00:00:00.000Z",
		orderingKey: "2026-08-02T00:00:00.000Z#pay-1",
		recordedAt: "2026-08-02T09:00:00.000Z",
		fundingSource: "shared",
		funderMemberId: null,
		status: "posted",
		chainRootId: "pay-1",
		reversalOfId: null,
		replacesId: null,
		reversedById: null,
		actorUserId: "user-1",
		operationId: null,
		createdAt: "2026-08-02T09:00:00.000Z",
		...overrides,
	};
}

function applyForm(overrides: Partial<SuperValidated<ApplyForm, string>> = {}): SuperValidated<ApplyForm, string> {
	return {
		id: "apply",
		valid: false,
		posted: false,
		errors: {},
		data: { expenseId: "", amount: "" },
		constraints: {},
		...overrides,
	} as SuperValidated<ApplyForm, string>;
}

function account(overrides: Partial<PageData["accounts"][number]> = {}): PageData["accounts"][number] {
	return {
		id: "acc-1",
		householdId: "hh-1",
		name: "Cuenta común",
		classification: "shared",
		status: "active",
		currency: "EUR",
		createdAt: "2026-08-01T00:00:00.000Z",
		updatedAt: "2026-08-01T00:00:00.000Z",
		...overrides,
	};
}

function correctForm(
	overrides: Partial<SuperValidated<CorrectForm, string>> = {},
): SuperValidated<CorrectForm, string> {
	return {
		id: "correct",
		valid: false,
		posted: false,
		errors: {},
		data: { mode: "reverse", accountId: "acc-1", effectiveDate: "2026-08-02" },
		constraints: {},
		...overrides,
	} as SuperValidated<CorrectForm, string>;
}

function data(overrides: Partial<PageData> = {}): PageData {
	return {
		user: null,
		payment: payment(),
		accountName: "Cuenta común",
		funderMemberName: null,
		currency: "EUR",
		unappliedMinor: 40000,
		applications: [
			{
				applicationId: "app-1",
				expenseId: "exp-1",
				expenseDescription: "Libros de texto",
				expenseReference: "LIB-2026-08",
				amountMinor: 20000,
			},
		],
		candidates: [
			{ id: "exp-2", description: "Comedor escolar", reference: "COM-2026-08", unpaidMinor: 40000 },
			{ id: "exp-3", description: "Actividades", reference: null, unpaidMinor: 15000 },
		],
		accounts: [account()],
		chain: [],
		applyForm: applyForm(),
		correctForm: correctForm(),
		...overrides,
	};
}

describe("PaymentDetailPage", () => {
	it("renders payment info, unapplied amount, applications, apply form, and correction section", () => {
		render(PaymentDetailPage, { params: { id: "pay-1" }, data: data(), form: undefined as never });

		expect(screen.getByRole("heading", { name: "Pago colegio julio" })).toBeTruthy();
		expect(screen.getByText(/Cuenta común · Fondos comunes/)).toBeTruthy();
		expect(screen.getByText(/Sin aplicar:/)).toBeTruthy();

		const expenseLink = screen.getByRole("link", { name: "Libros de texto" });
		expect(expenseLink.getAttribute("href")).toContain("/gastos/exp-1");
		expect(screen.getByText("LIB-2026-08")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Revertir" })).toBeTruthy();

		expect(screen.getByLabelText("Gasto")).toBeTruthy();
		expect(screen.getByText(/Comedor escolar · COM-2026-08 · quedan 400,00/)).toBeTruthy();
		expect(screen.getByLabelText(/Importe a aplicar/)).toBeTruthy();
		expect(screen.getByRole("button", { name: "Aplicar pago" })).toBeTruthy();

		expect(screen.getByRole("heading", { name: "Corrección" })).toBeTruthy();
		expect(screen.getAllByText(/El pago original quedará revertido/).length).toBeGreaterThan(0);
		expect(screen.getByRole("radio", { name: /Solo revertir/ })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Revertir pago" })).toBeTruthy();
	});

	it("hides the apply and correction workflows on a reversed payment", () => {
		render(PaymentDetailPage, {
			params: { id: "pay-1" },
			data: data({ payment: payment({ status: "reversed" }), unappliedMinor: 0, candidates: [] }),
			form: undefined as never,
		});

		expect(screen.getByText("Revertido")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Aplicar pago" })).toBeNull();
		expect(screen.queryByRole("heading", { name: "Corrección" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Revertir" })).toBeNull();
		expect(screen.queryByText(/Sin aplicar:/)).toBeNull();
	});

	it("shows reversal context instead of the plain empty state on a reversed payment", () => {
		render(PaymentDetailPage, {
			params: { id: "pay-1" },
			data: data({
				payment: payment({ status: "reversed", reversedById: "pay-2" }),
				unappliedMinor: 0,
				applications: [],
				candidates: [],
			}),
			form: undefined as never,
		});

		expect(screen.getByText("Pago revertido; sus aplicaciones quedaron deshechas.")).toBeTruthy();
		expect(screen.queryByText("Este pago todavía no está aplicado a ningún gasto.")).toBeNull();
	});

	it("keeps the plain empty state on a posted payment without applications", () => {
		render(PaymentDetailPage, {
			params: { id: "pay-1" },
			data: data({ applications: [] }),
			form: undefined as never,
		});

		expect(screen.getByText("Este pago todavía no está aplicado a ningún gasto.")).toBeTruthy();
		expect(screen.queryByText("Pago revertido; sus aplicaciones quedaron deshechas.")).toBeNull();
	});

	it("reveals account, date, and amount inputs in replace mode", async () => {
		const user = userEvent.setup();
		render(PaymentDetailPage, { params: { id: "pay-1" }, data: data(), form: undefined as never });

		expect(screen.queryByLabelText("Cuenta del pago")).toBeNull();
		expect(screen.queryByLabelText("Fecha del pago")).toBeNull();
		expect(screen.queryByLabelText(/Importe corregido/)).toBeNull();

		await user.click(screen.getByRole("radio", { name: /Revertir y sustituir/ }));

		expect(screen.getByLabelText("Cuenta del pago")).toBeTruthy();
		expect(screen.getByLabelText("Fecha del pago")).toBeTruthy();
		expect(screen.getByLabelText(/Importe corregido/)).toBeTruthy();
	});
});
