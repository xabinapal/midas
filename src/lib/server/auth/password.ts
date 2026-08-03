import { decodeBase64Url, encodeBase64Url, encodeText } from "./encoding";

const ALGORITHM = "pbkdf2-sha256";
const ITERATIONS = 600_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

async function derivePassword(password: string, salt: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
	const key = await crypto.subtle.importKey("raw", encodeText(password), "PBKDF2", false, ["deriveBits"]);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", hash: "SHA-256", iterations: ITERATIONS, salt },
		key,
		HASH_BITS,
	);
	return new Uint8Array(bits);
}

function equalBytes(left: Uint8Array<ArrayBuffer>, right: Uint8Array<ArrayBuffer>): boolean {
	if (left.byteLength !== right.byteLength) return false;

	let difference = 0;
	for (let index = 0; index < left.byteLength; index += 1) {
		difference |= left[index]! ^ right[index]!;
	}
	return difference === 0;
}

export async function hashPassword(password: string, salt?: Uint8Array<ArrayBuffer>): Promise<string> {
	const actualSalt = salt ?? crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	if (actualSalt.byteLength !== SALT_BYTES) throw new Error(`Password salts must contain ${SALT_BYTES} bytes`);

	const hash = await derivePassword(password, actualSalt);
	return `${ALGORITHM}$${ITERATIONS}$${encodeBase64Url(actualSalt)}$${encodeBase64Url(hash)}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
	const [algorithm, iterations, encodedSalt, encodedHash, extra] = storedHash.split("$");
	if (algorithm !== ALGORITHM || iterations !== String(ITERATIONS) || !encodedSalt || !encodedHash || extra)
		return false;

	try {
		const salt = decodeBase64Url(encodedSalt);
		const expected = decodeBase64Url(encodedHash);
		if (salt.byteLength !== SALT_BYTES || expected.byteLength !== HASH_BITS / 8) return false;

		return equalBytes(await derivePassword(password, salt), expected);
	} catch {
		return false;
	}
}
