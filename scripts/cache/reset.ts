import type { KVNamespace } from "@cloudflare/workers-types";

const CACHE_PREFIX = "app:cache:";

export async function resetCache(namespace: KVNamespace): Promise<number> {
	let cursor: string | undefined;
	let deleted = 0;

	do {
		const page = await namespace.list({ prefix: CACHE_PREFIX, cursor });
		await Promise.all(page.keys.map(({ name }) => namespace.delete(name)));
		deleted += page.keys.length;
		cursor = page.list_complete ? undefined : page.cursor;
	} while (cursor);

	return deleted;
}
