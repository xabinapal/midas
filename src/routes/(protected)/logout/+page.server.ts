import { redirect } from "@sveltejs/kit";
import { SESSION_COOKIE_NAME } from "$lib/server/auth/request";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.auth.enabled) redirect(303, "/");
	return {};
};

export const actions: Actions = {
	default: ({ cookies, locals }) => {
		cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
		locals.user = null;
		redirect(303, "/login");
	},
};
