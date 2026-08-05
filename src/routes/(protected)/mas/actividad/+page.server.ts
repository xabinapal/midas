import type { PageServerLoad } from "./$types";
import { buildActivityDetails } from "$lib/server/activity/display";

const EVENT_LABELS: Record<string, string> = {
	bootstrap_completed: "Configuración inicial completada",
	password_changed: "Contraseña cambiada",
	member_created: "Miembro creado",
	member_deactivated: "Miembro desactivado",
	member_reactivated: "Miembro reactivado",
	member_updated: "Miembro actualizado",
	member_deleted: "Miembro eliminado",
	user_created: "Usuario creado",
	user_disabled: "Usuario desactivado",
	user_reactivated: "Usuario reactivado",
	user_member_link_changed: "Asociación de miembro cambiada",
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
		.leftJoin("users as actor", "actor.id", "activity_events.actor_user_id")
		.leftJoin("users as subject_user", (join) =>
			join.onRef("subject_user.id", "=", "activity_events.subject_id").on("activity_events.subject_type", "=", "user"),
		)
		.leftJoin("members as subject_member", (join) =>
			join
				.onRef("subject_member.id", "=", "activity_events.subject_id")
				.on("activity_events.subject_type", "=", "member"),
		)
		.select([
			"activity_events.id",
			"activity_events.event_type",
			"activity_events.subject_type",
			"activity_events.subject_id",
			"activity_events.actor_user_id",
			"activity_events.occurred_at",
			"activity_events.summary",
			"actor.username as actor_username",
			"actor.is_active as actor_is_active",
			"subject_user.username as subject_username",
			"subject_member.display_name as subject_member_name",
		])
		.where("activity_events.household_id", "=", householdId);

	if (eventType) query = query.where("activity_events.event_type", "=", eventType);
	if (actorUserId) query = query.where("activity_events.actor_user_id", "=", actorUserId);

	const rows = await query
		.orderBy("activity_events.occurred_at", "desc")
		.orderBy("activity_events.id", "desc")
		.limit(50)
		.execute();

	const events = rows.map((row) => ({
		id: row.id,
		eventType: row.event_type,
		occurredAt: row.occurred_at,
		actorUsername: row.actor_username,
		actorIsActive: row.actor_is_active === null ? null : row.actor_is_active === 1,
		details: buildActivityDetails({
			subjectType: row.subject_type,
			subjectId: row.subject_id,
			actorUserId: row.actor_user_id,
			summary: row.summary,
			subjectUsername: row.subject_username,
			subjectMemberName: row.subject_member_name,
		}),
	}));

	return { events, eventLabels: EVENT_LABELS };
};
