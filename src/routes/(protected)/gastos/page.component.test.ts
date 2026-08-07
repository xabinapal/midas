import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { ComponentProps } from "svelte";
import ExpensesPage from "./+page.svelte";

type PageData = ComponentProps<typeof ExpensesPage>["data"];
type ExpenseView = PageData["views"][number];

function expenseRecord(overrides: Partial<ExpenseView["expense"]> = {}): ExpenseView["expense"] {
	return {
		id: "exp-1",
		householdId: "hh-1",
		categoryId: "cat-1",
		reportingPeriodId: "per-1",
		description: "Factura de la luz",
		reference: "SUM-2026-08",
		status: "posted",
		plannedAmountMinor: null,
		plannedVersion: 1,
		actualAmountMinor: 10000,
		accountingDate: "2026-08-03",
		dueDate: null,
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
		actorUserId: "user-1",
		operationId: null,
		createdAt: "2026-08-03T00:00:00.000Z",
		updatedAt: "2026-08-03T00:00:00.000Z",
		...overrides,
	};
}

function expenseView(overrides: Partial<ExpenseView> = {}): ExpenseView {
	return {
		expense: expenseRecord(),
		categoryName: "Suministros",
		categorySlug: "suministros",
		valueState: "actual",
		applicableMinor: 10000,
		paidMinor: 3000,
		unpaidMinor: 7000,
		paymentStatus: "partially_paid",
		dueState: "none",
		allocations: [],
		...overrides,
	};
}

const partiallyPaid = expenseView();
const cancelled = expenseView({
	expense: expenseRecord({
		id: "exp-2",
		description: "Suscripción anulada",
		reference: "SUM-2026-08-2",
		status: "cancelled",
		plannedAmountMinor: 5000,
		actualAmountMinor: null,
	}),
	valueState: "estimated",
	applicableMinor: 5000,
	paidMinor: 0,
	unpaidMinor: 5000,
	paymentStatus: "unpaid",
});

function data(overrides: Partial<PageData> = {}): PageData {
	return {
		user: null,
		views: [partiallyPaid, cancelled],
		totals: { expectedMinor: 0, actualMinor: 10000, paidMinor: 3000, unpaidMinor: 7000 },
		periodLabel: "Agosto de 2026",
		periodSlug: "2026-08",
		isCustomPeriod: false,
		materializationFailures: [],
		navigation: {
			selectedPeriod: "2026-08",
			currentPeriod: "2026-08",
			previousHref: "/gastos?period=2026-07",
			currentHref: "/gastos?period=2026-08",
			nextHref: "/gastos?period=2026-09",
		},
		customPeriods: [],
		currency: "EUR",
		currentDate: "2026-08-05",
		...overrides,
	};
}

describe("ExpensesPage", () => {
	it("renders the period totals and each expense with its payment chip", () => {
		render(ExpensesPage, { params: {}, data: data(), form: undefined as never });

		expect(screen.getByRole("heading", { name: "Gastos" })).toBeTruthy();
		expect(screen.getByText("Previsto")).toBeTruthy();
		expect(screen.getByText("Real")).toBeTruthy();
		expect(screen.getByText("Pagado")).toBeTruthy();
		expect(screen.getByText("Sin pagar")).toBeTruthy();

		expect(screen.getByRole("link", { name: /Factura de la luz/ })).toBeTruthy();
		expect(screen.getByText("Pago parcial")).toBeTruthy();
		expect(screen.getByText(/Queda por pagar 70,00/)).toBeTruthy();
		expect(screen.getByRole("link", { name: /Suscripción anulada/ })).toBeTruthy();
		expect(screen.getByText("Anulado")).toBeTruthy();
	});

	it("shows the empty state when the period has no expenses", () => {
		render(ExpensesPage, { params: {}, data: data({ views: [] }), form: undefined as never });

		expect(screen.getByText("Sin gastos")).toBeTruthy();
		expect(screen.getByText("No hay gastos registrados en este periodo.")).toBeTruthy();
	});

	it("warns when a recurring template could not generate its expense", () => {
		render(ExpensesPage, {
			params: {},
			data: data({ materializationFailures: [{ description: "Luz", reason: "category_inactive" }] }),
			form: undefined as never,
		});

		expect(screen.getByText(/La plantilla «Luz» no pudo generarse: la categoría está desactivada\./)).toBeTruthy();
		const reviewLink = screen.getByRole("link", { name: "Revisar plantillas" });
		expect(reviewLink.getAttribute("href")).toContain("/gastos/plantillas");
	});
});
