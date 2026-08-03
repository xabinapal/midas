import type { AuthenticatedUser } from "../../auth/types";
import type { AuthConfig } from "./config";
import { SESSION_DURATION_SECONDS, createSessionToken, shouldRefreshSession, verifySessionToken } from "./session";

export const SESSION_COOKIE_NAME = "auth_session";

export interface RequestSession {
	user: AuthenticatedUser | null;
	clearCookie: boolean;
	refreshedToken?: string;
}

export function sessionCookieOptions(secure: boolean) {
	return {
		path: "/",
		httpOnly: true,
		sameSite: "lax" as const,
		secure,
		maxAge: SESSION_DURATION_SECONDS,
	};
}

export async function resolveRequestSession(
	config: AuthConfig,
	token: string | undefined,
	now: number = Math.floor(Date.now() / 1000),
): Promise<RequestSession> {
	if (!config.enabled) return { user: null, clearCookie: token !== undefined };
	if (!token) return { user: null, clearCookie: false };

	const session = await verifySessionToken(token, config.secret, now);
	if (!session) return { user: null, clearCookie: true };

	return {
		user: session.user,
		clearCookie: false,
		refreshedToken: shouldRefreshSession(session, now)
			? await createSessionToken(session.user, config.secret, now)
			: undefined,
	};
}
