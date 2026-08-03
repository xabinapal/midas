import type { LayoutServerLoad } from "./$types";

export const prerender = false;

export const load: LayoutServerLoad = ({ locals }) => ({
	authEnabled: locals.auth.enabled,
	user: locals.user,
});
