const MINIMUM_SECRET_BYTES = 32;

export interface AuthEnvironment {
	AUTH_ENABLED?: string;
	AUTH_SECRET?: string;
}

export type AuthConfig = { enabled: false } | { enabled: true; secret: string };

export function readAuthConfig(environment: AuthEnvironment): AuthConfig {
	const enabled = environment.AUTH_ENABLED?.trim().toLowerCase();
	if (enabled === undefined || enabled === "false") return { enabled: false };
	if (enabled !== "true") throw new Error('AUTH_ENABLED must be either "true" or "false"');

	const secret = environment.AUTH_SECRET;
	if (!secret) throw new Error("AUTH_SECRET is required when authentication is enabled");
	if (new TextEncoder().encode(secret).byteLength < MINIMUM_SECRET_BYTES) {
		throw new Error(`AUTH_SECRET must contain at least ${MINIMUM_SECRET_BYTES} bytes`);
	}

	return { enabled: true, secret };
}
