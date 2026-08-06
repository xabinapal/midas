import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import AccountBalance from "./account-balance.svelte";

describe("AccountBalance", () => {
	it("shows the estimated amount with its observation date and later movement count", () => {
		render(AccountBalance, {
			balance: {
				kind: "estimated",
				amountMinor: 43000,
				observedAt: "2026-07-01T00:00:00.000Z",
				observationRecordedAt: "2026-07-01T09:00:00.000Z",
				movementCount: 2,
				asOf: "2026-08-05T00:00:00.000Z",
			},
			currency: "EUR",
		});

		expect(screen.getByText(/430,00/)).toBeTruthy();
		expect(screen.getByText(/Saldo estimado · observado el/)).toBeTruthy();
		expect(screen.getByText(/2 movimientos posteriores/)).toBeTruthy();
	});

	it("shows an unavailable balance as No registrado instead of zero", () => {
		render(AccountBalance, {
			balance: { kind: "unavailable", asOf: "2026-08-05T00:00:00.000Z" },
			currency: "EUR",
		});

		expect(screen.getByText("No registrado")).toBeTruthy();
		expect(screen.getByText("Sin observación de saldo")).toBeTruthy();
		expect(screen.queryByText(/0,00/)).toBeNull();
	});
});
