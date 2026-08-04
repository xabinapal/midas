import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
	const householdId = locals.user!.householdId;
	const eventType = url.searchParams.get("tipo") ?? undefined;
	const actorUserId = url.searchParams.get("actor") ?? undefined;

	let query = locals.db
		.selectFrom("activity_events")
		.select(["id", "event_type", "subject_type", "subject_id", "actor_user_id", "occurred_at", "summary"])
		.where("household_id", "=", householdId);

	if (eventType) query = query.where("event_type", "=", eventType);
	if (actorUserId) query = query.where("actor_user_id", "=", actorUserId);

	const events = await query.orderBy("occurred_at", "desc").limit(50).execute();

	const eventLabels: Record<string, string> = {
		bootstrap_completed: "Configuración inicial completada",
		password_changed: "Contraseña cambiada",
		member_created: "Miembro creado",
		member_deactivated: "Miembro desactivado",
		member_reactivated: "Miembro reactivado",
		user_created: "Usuario creado",
		user_disabled: "Usuario desactivado",
		user_reactivated: "Usuario reactivado",
		password_reset: "Contraseña restablecida",
	};

	return { events, eventLabels };
};
