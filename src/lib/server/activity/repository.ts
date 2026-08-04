import type { Kysely } from "kysely";
import type { Database } from "../database";

export interface ActivityEventInput {
	id: string;
	householdId: string;
	eventType: string;
	subjectType: string;
	subjectId: string | null;
	actorUserId: string | null;
	occurredAt: string;
	summary: Record<string, unknown>;
	operationId?: string | null;
	correctionOfEventId?: string | null;
}

export interface ActivityEventRecord {
	id: string;
	householdId: string;
	eventType: string;
	subjectType: string;
	subjectId: string | null;
	actorUserId: string | null;
	occurredAt: string;
	recordedAt: string;
	summary: Record<string, unknown>;
}

export interface ActivityHistoryFilters {
	actorUserId?: string;
	eventType?: string;
	subjectId?: string;
}

export interface ActivityRepository {
	append(event: ActivityEventInput, now: string): Promise<void>;
	findByHousehold(householdId: string, filters?: ActivityHistoryFilters): Promise<ActivityEventRecord[]>;
}

const PROHIBITED_SUMMARY_KEYS = [
	"password",
	"passwordHash",
	"temporaryPassword",
	"bearerToken",
	"tokenDigest",
	"cookie",
	"authSecret",
	"authorizationHeader",
	"requestBody",
] as const;

export function validateSummary(summary: Record<string, unknown>): void {
	for (const key of Object.keys(summary)) {
		if (PROHIBITED_SUMMARY_KEYS.includes(key as (typeof PROHIBITED_SUMMARY_KEYS)[number])) {
			throw new Error(`Activity event summary must not contain key: ${key}`);
		}
	}
}

export function createActivityRepository(db: Kysely<Database>): ActivityRepository {
	return {
		async append(event, now) {
			validateSummary(event.summary);
			await db
				.insertInto("activity_events")
				.values({
					id: event.id,
					household_id: event.householdId,
					event_type: event.eventType,
					subject_type: event.subjectType,
					subject_id: event.subjectId,
					actor_user_id: event.actorUserId,
					occurred_at: event.occurredAt,
					recorded_at: now,
					summary: JSON.stringify(event.summary),
					operation_id: event.operationId ?? null,
					correction_of_event_id: event.correctionOfEventId ?? null,
				})
				.execute();
		},

		async findByHousehold(householdId, filters) {
			let query = db.selectFrom("activity_events").selectAll().where("household_id", "=", householdId);

			if (filters?.actorUserId) {
				query = query.where("actor_user_id", "=", filters.actorUserId);
			}
			if (filters?.eventType) {
				query = query.where("event_type", "=", filters.eventType);
			}
			if (filters?.subjectId) {
				query = query.where("subject_id", "=", filters.subjectId);
			}

			const rows = await query.orderBy("occurred_at", "desc").orderBy("recorded_at", "desc").execute();
			return rows.map((row) => ({
				id: row.id,
				householdId: row.household_id,
				eventType: row.event_type,
				subjectType: row.subject_type,
				subjectId: row.subject_id,
				actorUserId: row.actor_user_id,
				occurredAt: row.occurred_at,
				recordedAt: row.recorded_at,
				summary: JSON.parse(row.summary) as Record<string, unknown>,
			}));
		},
	};
}
