import type { Kysely } from "kysely";
import type { Database } from "../database";
import { validateSummary } from "./repository";

export interface ActivityInsertInput {
	householdId: string;
	eventType: string;
	subjectType: string;
	subjectId: string | null;
	actorUserId: string | null;
	summary: Record<string, unknown>;
	operationId?: string | null;
	correctionOfEventId?: string | null;
}

export async function insertValidatedActivity(db: Kysely<Database>, input: ActivityInsertInput): Promise<void> {
	validateSummary(input.summary);
	const nowIso = new Date().toISOString();
	await db
		.insertInto("activity_events")
		.values({
			id: crypto.randomUUID(),
			household_id: input.householdId,
			event_type: input.eventType,
			subject_type: input.subjectType,
			subject_id: input.subjectId,
			actor_user_id: input.actorUserId,
			occurred_at: nowIso,
			recorded_at: nowIso,
			summary: JSON.stringify(input.summary),
			operation_id: input.operationId ?? null,
			correction_of_event_id: input.correctionOfEventId ?? null,
		})
		.execute();
}
