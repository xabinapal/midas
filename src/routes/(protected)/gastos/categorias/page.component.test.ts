import { render, screen } from "@testing-library/svelte";
import { beforeAll, describe, expect, it } from "vitest";
import type { ComponentProps } from "svelte";
import type { SuperValidated } from "sveltekit-superforms";
import CategoriesPage from "./+page.svelte";

type PageData = ComponentProps<typeof CategoriesPage>["data"];
type CategoryForm = PageData["form"]["data"];

beforeAll(() => {
	// jsdom does not implement <dialog> modal behavior
	HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
		this.setAttribute("open", "");
	};
	HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
		this.removeAttribute("open");
	};
});

function row(overrides: Partial<PageData["rows"][number]> = {}): PageData["rows"][number] {
	return {
		id: "cat-1",
		householdId: "hh-1",
		name: "Vivienda",
		slug: "vivienda",
		ordering: 0,
		isActive: true,
		createdAt: "2026-08-01T00:00:00.000Z",
		updatedAt: "2026-08-01T00:00:00.000Z",
		operationId: null,
		hasReferences: false,
		...overrides,
	};
}

function form(overrides: Partial<SuperValidated<CategoryForm, string>> = {}): SuperValidated<CategoryForm, string> {
	return {
		id: "category",
		valid: false,
		posted: false,
		errors: {},
		data: { name: "" },
		constraints: {},
		...overrides,
	} as SuperValidated<CategoryForm, string>;
}

function data(overrides: Partial<PageData> = {}): PageData {
	return {
		user: null,
		rows: [
			row(),
			row({ id: "cat-2", name: "Suministros", slug: "suministros", hasReferences: true }),
			row({ id: "cat-3", name: "Antigua", slug: "antigua", isActive: false, hasReferences: true }),
		],
		form: form(),
		...overrides,
	};
}

describe("CategoriesPage", () => {
	it("renders the create form and the category rows", () => {
		render(CategoriesPage, { params: {}, data: data(), form: undefined as never });

		expect(screen.getByLabelText("Nombre")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Crear categoría" })).toBeTruthy();

		expect(screen.getByText("Vivienda")).toBeTruthy();
		expect(screen.getByText("vivienda")).toBeTruthy();
		expect(screen.getAllByText("En uso")).toHaveLength(2);
	});

	it("offers deactivation only for active categories and marks inactive ones", () => {
		render(CategoriesPage, { params: {}, data: data(), form: undefined as never });

		expect(screen.getAllByRole("button", { name: "Desactivar" })).toHaveLength(2);
		expect(screen.getByText("Desactivada")).toBeTruthy();
	});

	it("offers reactivation only for inactive categories", () => {
		render(CategoriesPage, { params: {}, data: data(), form: undefined as never });

		expect(screen.getByRole("button", { name: "Reactivar" })).toBeTruthy();
		expect(screen.getAllByRole("button", { name: "Reactivar" })).toHaveLength(1);
	});

	it("shows validation errors associated with the name field", () => {
		render(CategoriesPage, {
			params: {},
			data: data({
				form: form({ posted: true, errors: { name: ["Ya existe una categoría activa con ese nombre"] } }),
			}),
			form: undefined as never,
		});

		expect(screen.getByText("Ya existe una categoría activa con ese nombre")).toBeTruthy();
	});
});
