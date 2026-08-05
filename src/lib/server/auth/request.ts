import type { Kysely } from "kysely";
import type { Database } from "../database";
import type { AuthenticatedUser } from "../../auth/types";
import {
	digestBearerToken,
	generateBearerToken,
	SESSION_DURATION_SECONDS,
	SESSION_ROTATE_AFTER_SECONDS,
} from "./session-tokens";
import { toAuthenticatedUser } from "./service";
import type { UserRecord } from "./repository";

export const SESSION_COOKIE_NAME = "auth_session";

export function sessionCookieOptions(secure: boolean) {
	return {
		path: "/",
		httpOnly: true,
		sameSite: "lax" as const,
		secure,
		maxAge: SESSION_DURATION_SECONDS,
	};
}

export interface RequestSession {
	user: AuthenticatedUser | null;
	sessionId: string | null;
	clearCookie: boolean;
	rotatedToken?: string;
}

interface SessionRow {
	id: string;
	user_id: string;
	token_digest: string;
	created_at: string;
	rotated_at: string;
	expires_at: string;
}

export async function resolveRequestSession(
	db: Kysely<Database>,
	cookieToken: string | undefined,
	now: number = Math.floor(Date.now() / 1000),
): Promise<RequestSession> {
	if (!cookieToken) return { user: null, sessionId: null, clearCookie: false };

	const digest = await digestBearerToken(cookieToken);

	const session = await db.selectFrom("sessions").selectAll().where("token_digest", "=", digest).executeTakeFirst();

	if (!session) return { user: null, sessionId: null, clearCookie: true };

	const sessionRow = session as unknown as SessionRow;
	const expiresAt = Math.floor(new Date(sessionRow.expires_at).getTime() / 1000);
	if (now >= expiresAt) {
		await db.deleteFrom("sessions").where("token_digest", "=", digest).execute();
		return { user: null, sessionId: null, clearCookie: true };
	}

	const userRecord = (await db
		.selectFrom("users")
		.select([
			"id",
			"username",
			"password_hash as passwordHash",
			"is_active as isActive",
			"household_id as householdId",
			"is_administrator as isAdministrator",
			"requires_password_change as requiresPasswordChange",
			"member_id as memberId",
		])
		.where("id", "=", sessionRow.user_id)
		.where("is_active", "=", 1)
		.executeTakeFirst()) as unknown as UserRecord | undefined;

	if (!userRecord || !userRecord.householdId) {
		await db.deleteFrom("sessions").where("token_digest", "=", digest).execute();
		return { user: null, sessionId: null, clearCookie: true };
	}

	const user = toAuthenticatedUser(userRecord);
	if (!user) {
		return { user: null, sessionId: null, clearCookie: true };
	}

	const rotatedAt = Math.floor(new Date(sessionRow.rotated_at).getTime() / 1000);
	let rotatedToken: string | undefined;
	let effectiveSessionId = sessionRow.id;

	if (now - rotatedAt >= SESSION_ROTATE_AFTER_SECONDS) {
		const rotation = await rotateSession(db, digest, user.id, user.householdId, now);
		rotatedToken = rotation.token;
		effectiveSessionId = rotation.sessionId;
	}

	return {
		user,
		sessionId: effectiveSessionId,
		clearCookie: false,
		rotatedToken,
	};
}

export async function createSession(
	db: Kysely<Database>,
	userId: string,
	householdId: string,
	now: number = Math.floor(Date.now() / 1000),
): Promise<{ token: string; sessionId: string }> {
	const token = generateBearerToken();
	const digest = await digestBearerToken(token);
	const sessionId = crypto.randomUUID();
	const nowIso = new Date(now * 1000).toISOString();
	const expiresIso = new Date((now + SESSION_DURATION_SECONDS) * 1000).toISOString();

	await db
		.insertInto("sessions")
		.values({
			id: sessionId,
			user_id: userId,
			household_id: householdId,
			token_digest: digest,
			created_at: nowIso,
			rotated_at: nowIso,
			expires_at: expiresIso,
		})
		.execute();

	return { token, sessionId };
}

async function rotateSession(
	db: Kysely<Database>,
	oldDigest: string,
	userId: string,
	householdId: string,
	now: number,
): Promise<{ token: string; sessionId: string }> {
	const newToken = generateBearerToken();
	const newDigest = await digestBearerToken(newToken);
	const sessionId = crypto.randomUUID();
	const nowIso = new Date(now * 1000).toISOString();
	const expiresIso = new Date((now + SESSION_DURATION_SECONDS) * 1000).toISOString();

	const oldSession = await db
		.selectFrom("sessions")
		.select("created_at")
		.where("token_digest", "=", oldDigest)
		.executeTakeFirst();

	await db.deleteFrom("sessions").where("token_digest", "=", oldDigest).execute();
	await db
		.insertInto("sessions")
		.values({
			id: sessionId,
			user_id: userId,
			household_id: householdId,
			token_digest: newDigest,
			created_at: oldSession?.created_at ?? nowIso,
			rotated_at: nowIso,
			expires_at: expiresIso,
		})
		.execute();

	return { token: newToken, sessionId };
}

export async function revokeSession(db: Kysely<Database>, sessionId: string): Promise<void> {
	await db.deleteFrom("sessions").where("id", "=", sessionId).execute();
}

export async function revokeAllOtherSessions(
	db: Kysely<Database>,
	userId: string,
	exceptSessionId: string,
): Promise<void> {
	await db.deleteFrom("sessions").where("user_id", "=", userId).where("id", "!=", exceptSessionId).execute();
}
