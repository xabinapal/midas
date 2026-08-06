import type { PageServerLoad } from "./$types";
import { buildActivityDetails, EVENT_LABELS, subjectLink } from "$lib/server/activity/display";
import { visibleToProjection } from "$lib/server/operations/visibility";

export const load: PageServerLoad = async ({ locals, url }) => {
	const householdId = locals.user!.householdId;
	const eventType = url.searchParams.get("tipo") ?? undefined;
	const actorUserId = url.searchParams.get("actor") ?? undefined;

	let query = locals.db
		.selectFrom("activity_events")
		.leftJoin("operation_roots", "operation_roots.id", "activity_events.operation_id")
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
		.where("activity_events.household_id", "=", householdId)
		.where((eb) => visibleToProjection(eb, "activity_events.operation_id"));

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
		subjectLink: subjectLink(row.subject_type, row.subject_id),
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
