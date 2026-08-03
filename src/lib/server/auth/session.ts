import type { AuthenticatedUser } from "../../auth/types";
import { decodeBase64Url, decodeText, encodeBase64Url, encodeText } from "./encoding";

export const SESSION_DURATION_SECONDS = 8 * 60 * 60;
const SESSION_REFRESH_AFTER_SECONDS = SESSION_DURATION_SECONDS / 2;

const header = encodeBase64Url(encodeText(JSON.stringify({ alg: "HS256", typ: "JWT" })));

interface SessionPayload {
	sub: string;
	username: string;
	iat: number;
	exp: number;
}

export interface VerifiedSession {
	user: AuthenticatedUser;
	issuedAt: number;
	expiresAt: number;
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey("raw", encodeText(secret), { name: "HMAC", hash: "SHA-256" }, false, [
		"sign",
		"verify",
	]);
}

function isSessionPayload(value: unknown): value is SessionPayload {
	if (typeof value !== "object" || value === null) return false;
	const payload = value as Partial<SessionPayload>;
	return (
		typeof payload.sub === "string" &&
		payload.sub.length > 0 &&
		typeof payload.username === "string" &&
		payload.username.length > 0 &&
		Number.isInteger(payload.iat) &&
		Number.isInteger(payload.exp)
	);
}

export async function createSessionToken(
	user: AuthenticatedUser,
	secret: string,
	now: number = Math.floor(Date.now() / 1000),
): Promise<string> {
	const payload = encodeBase64Url(
		encodeText(
			JSON.stringify({ sub: user.id, username: user.username, iat: now, exp: now + SESSION_DURATION_SECONDS }),
		),
	);
	const unsignedToken = `${header}.${payload}`;
	const signature = await crypto.subtle.sign("HMAC", await importSigningKey(secret), encodeText(unsignedToken));
	return `${unsignedToken}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(
	token: string,
	secret: string,
	now: number = Math.floor(Date.now() / 1000),
): Promise<VerifiedSession | null> {
	const [encodedHeader, encodedPayload, encodedSignature, extra] = token.split(".");
	if (encodedHeader !== header || !encodedPayload || !encodedSignature || extra) return null;

	try {
		const unsignedToken = `${encodedHeader}.${encodedPayload}`;
		const valid = await crypto.subtle.verify(
			"HMAC",
			await importSigningKey(secret),
			decodeBase64Url(encodedSignature),
			encodeText(unsignedToken),
		);
		if (!valid) return null;

		const payload: unknown = JSON.parse(decodeText(decodeBase64Url(encodedPayload)));
		if (!isSessionPayload(payload) || payload.iat > now || payload.exp <= now) return null;
		if (payload.exp - payload.iat !== SESSION_DURATION_SECONDS) return null;

		return {
			user: { id: payload.sub, username: payload.username },
			issuedAt: payload.iat,
			expiresAt: payload.exp,
		};
	} catch {
		return null;
	}
}

export function shouldRefreshSession(session: VerifiedSession, now: number = Math.floor(Date.now() / 1000)): boolean {
	return now - session.issuedAt >= SESSION_REFRESH_AFTER_SECONDS;
}
