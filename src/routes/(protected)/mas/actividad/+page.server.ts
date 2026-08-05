import type { PageServerLoad } from "./$types";

const EVENT_LABELS: Record<string, string> = {
	bootstrap_completed: "Configuración inicial completada",
	password_changed: "Contraseña cambiada",
	member_created: "Miembro creado",
	member_deactivated: "Miembro desactivado",
	member_reactivated: "Miembro reactivado",
	user_created: "Usuario creado",
	user_disabled: "Usuario desactivado",
	user_reactivated: "Usuario reactivado",
	password_reset: "Contraseña restablecida",
	admin_granted: "Permisos de administrador concedidos",
	admin_revoked: "Permisos de administrador revocados",
	session_created: "Sesión iniciada",
	session_revoked: "Sesión cerrada",
	operator_recovery: "Recuperación del operador",
};

export const load: PageServerLoad = async ({ locals, url }) => {
	const householdId = locals.user!.householdId;
	const eventType = url.searchParams.get("tipo") ?? undefined;
	const actorUserId = url.searchParams.get("actor") ?? undefined;

	let query = locals.db
		.selectFrom("activity_events")
		.innerJoin("users as actor", "actor.id", "activity_events.actor_user_id")
		.select([
			"activity_events.id",
			"activity_events.event_type",
			"activity_events.subject_type",
			"activity_events.subject_id",
			"activity_events.actor_user_id",
			"activity_events.occurred_at",
			"activity_events.summary",
			"actor.username as actor_username",
		])
		.where("activity_events.household_id", "=", householdId);

	if (eventType) query = query.where("activity_events.event_type", "=", eventType);
	if (actorUserId) query = query.where("activity_events.actor_user_id", "=", actorUserId);

	const events = await query.orderBy("activity_events.occurred_at", "desc").limit(50).execute();

	return { events, eventLabels: EVENT_LABELS };
};
