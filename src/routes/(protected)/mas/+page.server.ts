import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	return {
		isAdministrator: locals.user?.isAdministrator ?? false,
	};
};
