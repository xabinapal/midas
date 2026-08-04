import type { LayoutServerLoad } from "./$types";

export const prerender = false;

export const load: LayoutServerLoad = ({ locals }) => ({
	user: locals.user,
});
