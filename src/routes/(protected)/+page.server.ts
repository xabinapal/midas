import { loadStarterCapabilitiesCache } from "$lib/server/cache/starter-capabilities";
import { logger } from "$lib/server/logger";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	const cache = loadStarterCapabilitiesCache(locals.kv, {
		onError(error) {
			logger.warn("kv cache unavailable", {
				error: error instanceof Error ? error.message : String(error),
			});
		},
	});

	logger.debug("page data loaded");
	return { cache };
};
