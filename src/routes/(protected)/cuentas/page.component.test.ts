import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { ComponentProps } from "svelte";
import AccountsPage from "./+page.svelte";

type PageData = ComponentProps<typeof AccountsPage>["data"];

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
		holders: [
			{ memberId: "m-1", displayName: "Alex" },
			{ memberId: "m-2", displayName: "Sam" },
		],
		balance: {
			kind: "estimated",
			amountMinor: 152300,
			observedAt: "2026-07-30T00:00:00.000Z",
			observationRecordedAt: "2026-07-30T10:00:00.000Z",
			movementCount: 3,
			asOf: "2026-08-05T00:00:00.000Z",
		},
		...overrides,
	};
}

function data(overrides: Partial<PageData> = {}): PageData {
	return { user: null, currency: "EUR", accounts: [account()], funding: [], pendingClassification: [], ...overrides };
}

describe("AccountsPage", () => {
	it("lists accounts with Spanish classification, status, holders, and estimated balance", () => {
		render(AccountsPage, { params: {}, data: data(), form: undefined as never });

		expect(screen.getByRole("heading", { name: "Saldos" })).toBeTruthy();
		expect(screen.getByText(/Compartida · Activa · Alex, Sam/)).toBeTruthy();
		expect(screen.getByText(/1523,00/)).toBeTruthy();
		expect(screen.getByRole("link", { name: "Nueva cuenta" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Nueva transferencia" })).toBeTruthy();
	});

	it("shows an unavailable balance as No registrado", () => {
		const unobserved = account({
			id: "acc-2",
			name: "Hucha del hogar",
			balance: { kind: "unavailable", asOf: "2026-08-05T00:00:00.000Z" },
		});

		render(AccountsPage, { params: {}, data: data({ accounts: [unobserved] }), form: undefined as never });

		expect(screen.getByText("No registrado")).toBeTruthy();
	});

	it("explains the empty state with a single primary action", () => {
		render(AccountsPage, { params: {}, data: data({ accounts: [] }), form: undefined as never });

		expect(screen.getByText("Sin cuentas")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Crear la primera cuenta" })).toBeTruthy();
	});

	it("shows net shared funding for arbitrary member allocations", () => {
		render(AccountsPage, {
			params: {},
			data: data({
				funding: [
					{ memberId: "m-1", displayName: "Alex", contributionsMinor: 60000, distributionsMinor: 0, netMinor: 60000 },
					{
						memberId: "m-2",
						displayName: "Sam",
						contributionsMinor: 40000,
						distributionsMinor: 15000,
						netMinor: 25000,
					},
				],
			}),
			form: undefined as never,
		});

		expect(screen.getByRole("heading", { name: "Dinero aportado a cuentas compartidas" })).toBeTruthy();
		expect(screen.getByText(/Aportado 600,00 € · recibido 0,00 €/)).toBeTruthy();
		expect(screen.getByText(/Aportado 400,00 € · recibido 150,00 €/)).toBeTruthy();
	});
});

describe("AccountsPage pending classification", () => {
	it("surfaces unclassified transfers as pending instead of hiding them from funding", () => {
		render(AccountsPage, {
			params: {},
			data: data({
				pendingClassification: [
					{
						id: "t-9",
						description: "Ingreso pendiente de clasificar",
						amountMinor: 3000,
						effectiveAt: "2026-08-03T00:00:00.000Z",
						sourceName: "Cuenta de Sam",
						destinationName: "Cuenta común",
					},
				],
			}),
			form: undefined as never,
		});

		expect(screen.getByRole("alert").textContent).toContain("1 transferencia sin clasificar");
		expect(screen.getByRole("link", { name: "Clasificar" })).toBeTruthy();
	});
});
