import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { ComponentProps } from "svelte";
import type { SuperValidated } from "sveltekit-superforms";
import ExpenseDetailPage from "./+page.svelte";

type PageData = ComponentProps<typeof ExpenseDetailPage>["data"];
type EvidenceFormData = PageData["evidenceForm"]["data"];
type LinkFormData = PageData["linkForm"]["data"];

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

function view(overrides: Partial<PageData["view"]> = {}): PageData["view"] {
	return {
		expense: expense(),
		categoryName: "Suministros",
		categorySlug: "suministros",
		valueState: "estimated",
		applicableMinor: 10000,
		paidMinor: 4000,
		unpaidMinor: 6000,
		paymentStatus: "partially_paid",
		dueState: "upcoming",
		allocations: [
			{ memberId: "m-1", memberName: "Alex", basis: "planned", amountMinor: 5000 },
			{ memberId: "m-2", memberName: "Sam", basis: "planned", amountMinor: 5000 },
		],
		...overrides,
	};
}

function flags(overrides: Partial<PageData["flags"]> = {}): PageData["flags"] {
	return {
		canEdit: true,
		canActualize: true,
		canCancel: true,
		canPay: true,
		canCorrect: false,
		isDraft: false,
		...overrides,
	};
}

function evidenceForm(
	overrides: Partial<SuperValidated<EvidenceFormData, string>> = {},
): SuperValidated<EvidenceFormData, string> {
	return {
		id: "evidence",
		valid: false,
		posted: false,
		errors: {},
		data: { label: "", url: "", note: "" },
		constraints: {},
		...overrides,
	} as SuperValidated<EvidenceFormData, string>;
}

function linkForm(overrides: Partial<SuperValidated<LinkFormData, string>> = {}): SuperValidated<LinkFormData, string> {
	return {
		id: "link",
		valid: false,
		posted: false,
		errors: {},
		data: { actualExpenseId: "" },
		constraints: {},
		...overrides,
	} as SuperValidated<LinkFormData, string>;
}

function data(overrides: Partial<PageData> = {}): PageData {
	return {
		user: null,
		expense: expense(),
		view: view(),
		currency: "EUR",
		period: {
			id: "per-1",
			householdId: "hh-1",
			slug: "2026-08",
			label: "Agosto 2026",
			startDate: "2026-08-01",
			endDate: "2026-09-01",
			kind: "standard",
			createdAt: "2026-08-01T00:00:00.000Z",
			operationId: null,
		},
		accountHintName: null,
		payments: [
			{
				applicationId: "app-1",
				paymentId: "pay-1",
				amountMinor: 4000,
				paymentDescription: "Pago luz julio",
				effectiveAt: "2026-08-02T00:00:00.000Z",
				fundingSource: "shared",
				accountName: "Cuenta común",
			},
		],
		reversedApplications: [],
		linkedActual: null,
		evidence: [
			{
				id: "ev-1",
				expenseId: "exp-1",
				householdId: "hh-1",
				label: "Factura PDF",
				url: "https://example.com/factura.pdf",
				note: null,
				status: "active",
				createdBy: null,
				createdAt: "2026-08-02T00:00:00.000Z",
				removedAt: null,
				operationId: null,
			},
		],
		activity: [],
		eventLabels: {},
		matchCandidates: [],
		chain: [],
		flags: flags(),
		evidenceForm: evidenceForm(),
		linkForm: linkForm(),
		...overrides,
	};
}

describe("ExpenseDetailPage", () => {
	it("renders the expense header with reference and status chips", () => {
		render(ExpenseDetailPage, { params: { id: "exp-1" }, data: data(), form: undefined as never });

		expect(screen.getByRole("heading", { name: "Factura de la luz" })).toBeTruthy();
		expect(screen.getByText("SUM-2026-08-01")).toBeTruthy();
		expect(screen.getByText("Pago parcial")).toBeTruthy();
		expect(screen.getByText("Estimado")).toBeTruthy();
		expect(screen.getAllByText(/100,00 €/).length).toBeGreaterThan(0);
	});

	it("renders allocation rows and the applied payments", () => {
		render(ExpenseDetailPage, { params: { id: "exp-1" }, data: data(), form: undefined as never });

		expect(screen.getByText("Alex")).toBeTruthy();
		expect(screen.getByText("Sam")).toBeTruthy();
		expect(screen.getAllByText(/50,00 €/).length).toBeGreaterThan(0);
		expect(screen.getByText("Pago luz julio")).toBeTruthy();
		expect(screen.getByText(/Fondos comunes/)).toBeTruthy();
		expect(screen.getByText(/Cuenta común/)).toBeTruthy();
	});

	it("links evidence with safe external attributes", () => {
		render(ExpenseDetailPage, { params: { id: "exp-1" }, data: data(), form: undefined as never });

		const link = screen.getByRole("link", { name: /Factura PDF/ });
		expect(link.getAttribute("href")).toBe("https://example.com/factura.pdf");
		expect(link.getAttribute("target")).toBe("_blank");
		expect(link.getAttribute("rel")).toBe("noopener noreferrer external");
		expect(link.textContent).toContain("(se abre en una pestaña nueva)");
	});

	it("shows the actions available for an editable expected expense", () => {
		render(ExpenseDetailPage, { params: { id: "exp-1" }, data: data(), form: undefined as never });

		expect(screen.getByRole("link", { name: "Registrar pago" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Editar" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Confirmar importe real" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Anular" })).toBeTruthy();
	});

	it("a cancelled expense shows Anulado and hides payment and lifecycle actions", () => {
		render(ExpenseDetailPage, {
			params: { id: "exp-1" },
			data: data({
				expense: expense({ status: "cancelled" }),
				view: view({
					expense: expense({ status: "cancelled" }),
					paidMinor: 0,
					unpaidMinor: 10000,
					paymentStatus: "unpaid",
					dueState: "none",
				}),
				flags: flags({ canEdit: false, canActualize: false, canCancel: false, canPay: false }),
			}),
			form: undefined as never,
		});

		expect(screen.getByText("Anulado")).toBeTruthy();
		expect(screen.queryByRole("link", { name: "Registrar pago" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Anular" })).toBeNull();
		expect(screen.queryByRole("link", { name: "Editar" })).toBeNull();
	});
});
