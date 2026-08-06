/**
 * Stable human-readable expense references. Posted expenses get a
 * household-unique readable reference built from the category slug and the
 * reporting-period slug; collisions append a deterministic ordinal. The
 * reference never changes once assigned, even through correction or
 * category rename.
 *
 * Framework-neutral: no Kysely, no SvelteKit, no bindings.
 */

/** ASCII-folded lowercase slug safe for references and URLs. */
export function slugify(text: string): string {
	const slug = text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
	return slug.length > 0 ? slug : "sin-nombre";
}

export function referenceBase(categorySlug: string, periodSlug: string): string {
	return `${categorySlug}/${periodSlug}`;
}

/**
 * First free reference: the base, then `-2`, `-3`, … The caller passes the
 * household's existing references so the result is deterministic.
 */
export function resolveUniqueReference(base: string, existingReferences: Iterable<string>): string {
	const existing = new Set(existingReferences);
	if (!existing.has(base)) return base;
	for (let ordinal = 2; ; ordinal += 1) {
		const candidate = `${base}-${ordinal}`;
		if (!existing.has(candidate)) return candidate;
	}
}
