import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { ComponentProps } from "svelte";
import type { SuperValidated } from "sveltekit-superforms";
import ClassifyPage from "./+page.svelte";

type PageData = ComponentProps<typeof ClassifyPage>["data"];
type ClassifyForm = PageData["form"]["data"];

function superValidated(
	overrides: Partial<SuperValidated<ClassifyForm, string>> = {},
): SuperValidated<ClassifyForm, string> {
	return {
		id: "classify",
		valid: false,
		posted: false,
		errors: {},
		data: { classification: undefined as never },
		constraints: {},
		...overrides,
	} as SuperValidated<ClassifyForm, string>;
}

function data(overrides: Partial<PageData> = {}): PageData {
	return {
		user: null,
		transfer: {
			id: "t-1",
			householdId: "hh-1",
			sourceAccountId: "acc-1",
			destinationAccountId: "acc-2",
			amountMinor: 3000,
			effectiveAt: "2026-08-03T00:00:00.000Z",
			orderingKey: "2026-08-03T00:00:00.000Z#t-1",
			recordedAt: "2026-08-03T10:00:00.000Z",
			description: "Ingreso pendiente",
			classification: "unclassified",
			status: "posted",
			chainRootId: "t-1",
			reversalOfId: null,
			replacesId: null,
			reversedById: null,
			operationId: null,
			createdAt: "2026-08-03T10:00:00.000Z",
		},
		source: {
			id: "acc-1",
			householdId: "hh-1",
			name: "Cuenta de Alex",
			classification: "personal",
			status: "active",
			currency: "EUR",
			createdAt: "2026-08-01T00:00:00.000Z",
			updatedAt: "2026-08-01T00:00:00.000Z",
			holders: [{ memberId: "m-1", displayName: "Alex" }],
		},
		destination: {
			id: "acc-2",
			householdId: "hh-1",
			name: "Cuenta común",
			classification: "shared",
			status: "active",
			currency: "EUR",
			createdAt: "2026-08-01T00:00:00.000Z",
			updatedAt: "2026-08-01T00:00:00.000Z",
			holders: [],
		},
		allowed: ["pure", "contribution"],
		attributedMemberName: "Alex",
		form: superValidated(),
		...overrides,
	};
}

describe("ClassifyPage", () => {
	it("offers only the allowed terminal classifications with Spanish explanations", () => {
		render(ClassifyPage, { params: { id: "t-1" }, data: data(), form: undefined as never });

		expect(screen.getByText("Traspaso")).toBeTruthy();
		expect(screen.getByText("Aportación")).toBeTruthy();
		expect(screen.queryByText("Distribución")).toBeNull();
		expect(screen.getByText(/30,00/)).toBeTruthy();
		expect(screen.getByRole("button", { name: "Confirmar clasificación" })).toBeTruthy();
	});

	it("confirms the attributed member when contribution is chosen", async () => {
		const { default: userEvent } = await import("@testing-library/user-event");
		const user = userEvent.setup();
		render(ClassifyPage, { params: { id: "t-1" }, data: data(), form: undefined as never });

		await user.click(screen.getByLabelText(/Aportación/));

		expect(screen.getByText(/Se atribuirá íntegramente a Alex/)).toBeTruthy();
	});
});
