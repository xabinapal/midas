import { fail, redirect } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { loginSchema } from "$lib/auth/login-schema";
import { createUsersRepository } from "$lib/server/auth/repository";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "$lib/server/auth/request";
import { safeRedirectPath } from "$lib/server/auth/guard";
import { authenticateUser } from "$lib/server/auth/service";
import { createSessionToken } from "$lib/server/auth/session";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
	const next = safeRedirectPath(url.searchParams.get("next"));
	if (!locals.auth.enabled || locals.user) redirect(303, next);

	return { form: await superValidate(zod4(loginSchema)) };
};

export const actions: Actions = {
	default: async ({ cookies, locals, request, url }) => {
		if (!locals.auth.enabled) redirect(303, "/");

		const form = await superValidate(request, zod4(loginSchema));
		if (!form.valid) {
			form.data.password = "";
			return fail(400, { form });
		}

		const user = await authenticateUser(createUsersRepository(locals.db), form.data.username, form.data.password);
		if (!user) {
			form.data.password = "";
			return message(form, "El nombre de usuario o la contraseña no son correctos", { status: 401 });
		}

		cookies.set(
			SESSION_COOKIE_NAME,
			await createSessionToken(user, locals.auth.secret),
			sessionCookieOptions(url.protocol === "https:"),
		);
		redirect(303, safeRedirectPath(url.searchParams.get("next")));
	},
};
