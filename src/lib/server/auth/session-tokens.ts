const TOKEN_BYTES = 32;

export function generateBearerToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
	return encodeBase64Url(bytes);
}

export async function digestBearerToken(token: string): Promise<string> {
	return digestHex(token);
}

async function digestHex(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return bytesToHex(new Uint8Array(hash));
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function encodeBase64Url(bytes: Uint8Array): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
	let result = "";
	for (let i = 0; i < bytes.length; i += 3) {
		const b1 = bytes[i]!;
		const b2 = bytes[i + 1] ?? 0;
		const b3 = bytes[i + 2] ?? 0;
		result += chars[(b1 >> 2) & 0x3f];
		result += chars[((b1 << 4) | (b2 >> 4)) & 0x3f];
		result += i + 1 < bytes.length ? chars[((b2 << 2) | (b3 >> 6)) & 0x3f] : "";
		result += i + 2 < bytes.length ? chars[b3 & 0x3f] : "";
	}
	return result;
}

export const SESSION_DURATION_SECONDS = 8 * 60 * 60;
export const SESSION_ROTATE_AFTER_SECONDS = 4 * 60 * 60;
