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
		const table = screen.getByRole("table", { name: "People" });

		expect(within(table).getAllByRole("row")).toHaveLength(6);
		expect(screen.queryByText("Radia")).toBeNull();

		await user.click(screen.getByRole("button", { name: "Next" }));
		expect(screen.getByText("Radia")).toBeTruthy();
		expect(screen.getByText("Page 2 of 2")).toBeTruthy();
	});

	it("wires filtering and accessible sort state", async () => {
		const user = userEvent.setup();
		render(DataTableFixture, { rows });

		await user.type(screen.getByRole("searchbox", { name: "Search" }), "barbara");
		expect(screen.getByText("Barbara")).toBeTruthy();
		expect(screen.queryByText("Ada")).toBeNull();
		expect(screen.getByText("1 row")).toBeTruthy();

		const ageHeader = screen.getByRole("columnheader", { name: "Age" });
		await user.click(within(ageHeader).getByRole("button", { name: "Age" }));
		expect(ageHeader.getAttribute("aria-sort")).toBe("ascending");
		expect(document.querySelectorAll("[aria-sort]")).toHaveLength(1);
	});

	it("disables pagination when reactive rows become empty", async () => {
		const user = userEvent.setup();
		const view = render(DataTableFixture, { rows });
		await user.click(screen.getByRole("button", { name: "Next" }));

		await view.rerender({ rows: [] });

		expect(screen.getByText("No matching rows")).toBeTruthy();
		expect(screen.getByText("Page 0 of 0")).toBeTruthy();
		expect(screen.getByRole<HTMLButtonElement>("button", { name: "Previous" }).disabled).toBe(true);
		expect(screen.getByRole<HTMLButtonElement>("button", { name: "Next" }).disabled).toBe(true);
	});
});
