/**
 * Safe evidence references. Expenses link to externally hosted invoices or
 * receipts; Midas never fetches, proxies, or stores the binary. URLs are
 * parsed and anything that could smuggle credentials into a rendered link
 * is rejected.
 *
 * Framework-neutral: no Kysely, no SvelteKit, no bindings.
 */

export type EvidenceUrlResult = { ok: true; normalizedUrl: string } | { ok: false; reason: string };

const CREDENTIAL_KEY_PATTERN =
	/^(token|access_token|refresh_token|api_key|apikey|key|secret|password|passwd|pwd|credential|credentials|auth|authorization|signature|sig|session|sessionid|session_id|jwt|bearer)$/i;

function hasCredentialParams(params: URLSearchParams): boolean {
	for (const key of params.keys()) {
		if (CREDENTIAL_KEY_PATTERN.test(key)) return true;
	}
	return false;
}

export function validateEvidenceUrl(raw: string): EvidenceUrlResult {
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		return { ok: false, reason: "invalid_url" };
	}
	if (url.protocol !== "https:") {
		return { ok: false, reason: "insecure_scheme" };
	}
	if (url.username !== "" || url.password !== "") {
		return { ok: false, reason: "userinfo_not_allowed" };
	}
	if (hasCredentialParams(url.searchParams)) {
		return { ok: false, reason: "credential_query_not_allowed" };
	}
	const fragment = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
	if (fragment.includes("=") && hasCredentialParams(new URLSearchParams(fragment))) {
		return { ok: false, reason: "credential_fragment_not_allowed" };
	}
	return { ok: true, normalizedUrl: url.toString() };
}
