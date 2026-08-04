import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user?.isAdministrator) {
		throw error(403, "No tienes permiso de administrador");
	}
	const users = await locals.db
		.selectFrom("users")
		.select(["id", "username", "is_active", "is_administrator", "requires_password_change", "member_id", "created_at"])
		.where("household_id", "=", locals.user.householdId)
		.orderBy("username", "asc")
		.execute();
	return { users, currentUserId: locals.user.id };
};
