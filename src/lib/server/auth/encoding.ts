const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function encodeText(value: string): Uint8Array<ArrayBuffer> {
	return textEncoder.encode(value);
}

export function decodeText(value: Uint8Array<ArrayBuffer>): string {
	return textDecoder.decode(value);
}

export function encodeBase64Url(value: Uint8Array<ArrayBuffer>): string {
	let binary = "";
	for (const byte of value) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
	if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url value");

	const padded = value
		.replaceAll("-", "+")
		.replaceAll("_", "/")
		.padEnd(Math.ceil(value.length / 4) * 4, "=");
	const binary = atob(padded);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
