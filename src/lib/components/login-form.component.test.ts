import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { SuperValidated } from "sveltekit-superforms";
import type { LoginData } from "$lib/auth/login-schema";
import LoginForm from "./login-form.svelte";

const form = {
	id: "login",
	valid: false,
	posted: true,
	errors: {},
	data: { username: "developer", password: "" },
	constraints: {
		username: { required: true },
		password: { required: true },
	},
	message: "El nombre de usuario o la contraseña no son correctos",
} satisfies SuperValidated<LoginData, string>;

describe("LoginForm", () => {
	it("renders accessible credential fields", () => {
		render(LoginForm, { data: form });

		expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Nombre de usuario" }).value).toBe("developer");
		expect(screen.getByLabelText<HTMLInputElement>("Contraseña").type).toBe("password");
		expect(screen.getByRole<HTMLButtonElement>("button", { name: "Iniciar sesión" }).disabled).toBe(false);
	});

	it("announces generic credential failures", () => {
		render(LoginForm, { data: form });

		expect(screen.getByRole("alert").textContent).toContain("El nombre de usuario o la contraseña no son correctos");
	});
});
