import { describe, expect, it } from "vitest";
import { referenceBase, resolveUniqueReference, slugify } from "./references";

describe("slugify", () => {
	it("normalizes Spanish text to a stable slug", () => {
		expect(slugify("Luz y agua")).toBe("luz-y-agua");
		expect(slugify("Comunicación móvil")).toBe("comunicacion-movil");
		expect(slugify("  Seguro   del Hogar  ")).toBe("seguro-del-hogar");
	});

	it("strips characters that are unsafe in references", () => {
		expect(slugify("Internet/TV (fibra)")).toBe("internet-tv-fibra");
	});

	it("falls back to a placeholder for empty input", () => {
		expect(slugify("   ")).toBe("sin-nombre");
	});
});

describe("referenceBase", () => {
	it("combines category and period slugs", () => {
		expect(referenceBase("luz", "2026-08")).toBe("luz/2026-08");
	});
});

describe("resolveUniqueReference", () => {
	it("uses the base reference when free", () => {
		expect(resolveUniqueReference("luz/2026-08", new Set())).toBe("luz/2026-08");
	});

	it("appends a deterministic ordinal on collision", () => {
		const existing = new Set(["luz/2026-08"]);
		expect(resolveUniqueReference("luz/2026-08", existing)).toBe("luz/2026-08-2");
	});

	it("skips occupied ordinals", () => {
		const existing = new Set(["luz/2026-08", "luz/2026-08-2", "luz/2026-08-3"]);
		expect(resolveUniqueReference("luz/2026-08", existing)).toBe("luz/2026-08-4");
	});
});
