import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import type { ComponentProps } from "svelte";
import AccountDetailPage from "./+page.svelte";

type PageData = ComponentProps<typeof AccountDetailPage>["data"];
type HistoryItem = PageData["history"][number];

beforeAll(() => {
	// jsdom does not implement <dialog> modal behavior
	HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
		this.setAttribute("open", "");
	};
	HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
		this.removeAttribute("open");
	};
});

function account(overrides: Partial<PageData["account"]> = {}): PageData["account"] {
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
		...overrides,
	};
}

const estimatedBalance: PageData["balance"] = {
	kind: "estimated",
	amountMinor: 43000,
	observedAt: "2026-07-01T00:00:00.000Z",
	observationRecordedAt: "2026-07-01T09:00:00.000Z",
	movementCount: 1,
	asOf: "2026-08-05T00:00:00.000Z",
};

function transferItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
	return {
		id: "transfer-t-1",
		kind: "transfer",
		effectiveAt: "2026-08-03T00:00:00.000Z",
		recordedAt: "2026-08-03T10:00:00.000Z",
		orderingKey: "2026-08-03T00:00:00.000Z#t-1",
		transferId: "t-1",
		direction: "in",
		amountMinor: 60000,
		counterpartAccountId: "acc-alex",
		counterpartName: "Cuenta de Alex",
		description: "Aportación mensual",
		classification: "contribution",
		transferStatus: "posted",
		chainRootId: "t-1",
		reversalOfId: null,
		replacesId: null,
		reversedById: null,
		...overrides,
	};
}

function data(overrides: Partial<PageData> = {}): PageData {
	return {
		user: null,
		account: account(),
		balance: estimatedBalance,
		currency: "EUR",
		history: [transferItem()],
		...overrides,
	};
}

describe("AccountDetailPage", () => {
	it("keeps corrective workflows available on a closed account while blocking ordinary activity", () => {
		render(AccountDetailPage, {
			params: { id: "acc-1" },
			data: data({ account: account({ status: "closed" }) }),
			form: undefined as never,
		});

		expect(screen.getByText(/Cuenta cerrada: no acepta nuevas transferencias/)).toBeTruthy();
		expect(screen.getByRole("link", { name: "Observar saldo" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Cerrar cuenta" })).toBeNull();
		expect(screen.getByRole("button", { name: "Reabrir cuenta" })).toBeTruthy();
		expect(screen.getByText("Aportación mensual")).toBeTruthy();
	});

	it("offers edit, activate, and delete actions for drafts", () => {
		render(AccountDetailPage, {
			params: { id: "acc-1" },
			data: data({ account: account({ status: "draft" }) }),
			form: undefined as never,
		});

		expect(screen.getByRole("link", { name: "Editar" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Activar" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Eliminar" })).toBeTruthy();
	});

	it("requires a named confirmation before closing an account", async () => {
		const user = userEvent.setup();
		render(AccountDetailPage, { params: { id: "acc-1" }, data: data(), form: undefined as never });

		const closeButton = screen.getByRole("button", { name: "Cerrar cuenta" });
		expect(closeButton.className).toContain("btn-error");

		await user.click(closeButton);

		const dialog = screen.getByRole("dialog");
		expect(dialog.textContent).toContain("Cerrar cuenta");
		expect(dialog.textContent).toContain("Cuenta común");
		expect(dialog.textContent).toContain("historial se conservará");
	});

	it("submits the lifecycle action only after confirming in the dialog", async () => {
		const user = userEvent.setup();
		const submissions: string[] = [];
		const original = HTMLFormElement.prototype.requestSubmit;
		HTMLFormElement.prototype.requestSubmit = function (this: HTMLFormElement) {
			submissions.push(this.getAttribute("action") ?? "");
		};
		try {
			render(AccountDetailPage, { params: { id: "acc-1" }, data: data(), form: undefined as never });

			await user.click(screen.getByRole("button", { name: "Cerrar cuenta" }));
			expect(submissions).toHaveLength(0);

			const dialog = screen.getByRole("dialog");
			const { within } = await import("@testing-library/svelte");
			await user.click(within(dialog).getByRole("button", { name: "Cerrar cuenta" }));

			expect(submissions).toEqual(["?/close"]);
		} finally {
			HTMLFormElement.prototype.requestSubmit = original;
		}
	});

	it("links unclassified transfers to the classification workflow and posted ones to correction", () => {
		render(AccountDetailPage, {
			params: { id: "acc-1" },
			data: data({ history: [transferItem({ classification: "unclassified", description: "Ingreso suelto" })] }),
			form: undefined as never,
		});

		expect(screen.getByRole("link", { name: "Clasificar" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Corregir" })).toBeTruthy();
	});

	it("keeps original, reversal, and replacement links visible in history", () => {
		render(AccountDetailPage, {
			params: { id: "acc-1" },
			data: data({
				history: [
					transferItem({ transferStatus: "reversed", reversedById: "t-2" }),
					transferItem({
						id: "transfer-t-2",
						transferId: "t-2",
						direction: "out",
						amountMinor: -60000,
						reversalOfId: "t-1",
					}),
					transferItem({ id: "transfer-t-3", transferId: "t-3", amountMinor: 75000, replacesId: "t-1" }),
				],
			}),
			form: undefined as never,
		});

		expect(screen.getByText("Revertida")).toBeTruthy();
		expect(screen.getByText("Reversión")).toBeTruthy();
		expect(screen.getByText("Sustitución")).toBeTruthy();
	});
});
