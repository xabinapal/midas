import { fail, redirect } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { loginSchema } from "$lib/auth/login-schema";
import { createUsersRepository } from "$lib/server/auth/repository";
import { createSession, SESSION_COOKIE_NAME, sessionCookieOptions } from "$lib/server/auth/request";
import { safeRedirectPath } from "$lib/server/auth/guard";
import { authenticateUser } from "$lib/server/auth/service";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
	const next = safeRedirectPath(url.searchParams.get("next"));
	if (locals.user) redirect(303, next);

	return { form: await superValidate(zod4(loginSchema)) };
};

export const actions: Actions = {
	default: async ({ cookies, locals, request, url }) => {
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

		const { token } = await createSession(locals.db, user.id, user.householdId);
		cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(url.protocol === "https:"));
		redirect(303, safeRedirectPath(url.searchParams.get("next")));
	},
};
