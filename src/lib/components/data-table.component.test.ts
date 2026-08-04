import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import DataTableFixture from "./data-table.component.fixture.svelte";

const rows = [
	{ id: "1", name: "Ada", age: 36 },
	{ id: "2", name: "Barbara", age: 42 },
	{ id: "3", name: "Edsger", age: 41 },
	{ id: "4", name: "Grace", age: 37 },
	{ id: "5", name: "Margaret", age: 35 },
	{ id: "6", name: "Radia", age: 38 },
];

describe("DataTable", () => {
	it("provides an accessible name and paginates rows", async () => {
		const user = userEvent.setup();
		render(DataTableFixture, { rows });
		const table = screen.getByRole("table", { name: "Personas" });

		expect(within(table).getAllByRole("row")).toHaveLength(6);
		expect(screen.queryByText("Radia")).toBeNull();

		await user.click(screen.getByRole("button", { name: "Siguiente" }));
		expect(screen.getByText("Radia")).toBeTruthy();
		expect(screen.getByText("Página 2 de 2")).toBeTruthy();
	});

	it("wires filtering and accessible sort state", async () => {
		const user = userEvent.setup();
		render(DataTableFixture, { rows });

		await user.type(screen.getByRole("searchbox", { name: "Buscar" }), "barbara");
		expect(screen.getByText("Barbara")).toBeTruthy();
		expect(screen.queryByText("Ada")).toBeNull();
		expect(screen.getByText("1 fila")).toBeTruthy();

		const ageHeader = screen.getByRole("columnheader", { name: "Edad" });
		await user.click(within(ageHeader).getByRole("button", { name: "Edad" }));
		expect(ageHeader.getAttribute("aria-sort")).toBe("ascending");
		expect(document.querySelectorAll("[aria-sort]")).toHaveLength(1);
	});

	it("disables pagination when reactive rows become empty", async () => {
		const user = userEvent.setup();
		const view = render(DataTableFixture, { rows });
		await user.click(screen.getByRole("button", { name: "Siguiente" }));

		await view.rerender({ rows: [] });

		expect(screen.getByText("No hay filas coincidentes")).toBeTruthy();
		expect(screen.getByText("Página 0 de 0")).toBeTruthy();
		expect(screen.getByRole<HTMLButtonElement>("button", { name: "Anterior" }).disabled).toBe(true);
		expect(screen.getByRole<HTMLButtonElement>("button", { name: "Siguiente" }).disabled).toBe(true);
	});
});
