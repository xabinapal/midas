import { describe, expect, it } from "vitest";
import { validateEvidenceUrl } from "./evidence";

describe("validateEvidenceUrl", () => {
	it("accepts a plain HTTPS reference", () => {
		const result = validateEvidenceUrl("https://facturas.example.com/2026/08/luz.pdf");
		expect(result).toEqual({ ok: true, normalizedUrl: "https://facturas.example.com/2026/08/luz.pdf" });
	});

	it("rejects non-HTTPS schemes", () => {
		expect(validateEvidenceUrl("http://facturas.example.com/luz.pdf")).toMatchObject({
			ok: false,
			reason: "insecure_scheme",
		});
		expect(validateEvidenceUrl("ftp://facturas.example.com/luz.pdf")).toMatchObject({
			ok: false,
			reason: "insecure_scheme",
		});
		expect(validateEvidenceUrl("javascript:alert(1)")).toMatchObject({ ok: false, reason: "insecure_scheme" });
	});

	it("rejects user information", () => {
		expect(validateEvidenceUrl("https://user:pass@facturas.example.com/luz.pdf")).toMatchObject({
			ok: false,
			reason: "userinfo_not_allowed",
		});
		expect(validateEvidenceUrl("https://user@facturas.example.com/luz.pdf")).toMatchObject({
			ok: false,
			reason: "userinfo_not_allowed",
		});
	});

	it("rejects credential-like query parameters", () => {
		expect(validateEvidenceUrl("https://x.example/f.pdf?token=abc123")).toMatchObject({
			ok: false,
			reason: "credential_query_not_allowed",
		});
		expect(validateEvidenceUrl("https://x.example/f.pdf?sig=abc123")).toMatchObject({
			ok: false,
			reason: "credential_query_not_allowed",
		});
		expect(validateEvidenceUrl("https://x.example/f.pdf?password=hunter2")).toMatchObject({
			ok: false,
			reason: "credential_query_not_allowed",
		});
	});

	it("accepts benign query parameters", () => {
		const result = validateEvidenceUrl("https://x.example/f.pdf?pagina=2&vista=completa");
		expect(result.ok).toBe(true);
	});

	it("rejects credentials embedded in fragments", () => {
		expect(validateEvidenceUrl("https://x.example/f.pdf#token=abc123")).toMatchObject({
			ok: false,
			reason: "credential_fragment_not_allowed",
		});
	});

	it("accepts benign fragments", () => {
		const result = validateEvidenceUrl("https://x.example/f.pdf#pagina-3");
		expect(result.ok).toBe(true);
	});

	it("rejects unparseable input", () => {
		expect(validateEvidenceUrl("not a url")).toMatchObject({ ok: false, reason: "invalid_url" });
		expect(validateEvidenceUrl("")).toMatchObject({ ok: false, reason: "invalid_url" });
	});
});
