import { z } from "zod";
import type { KeyValueStore } from "../kv";

const CACHE_KEY = "cache:v1:starter-capabilities";
const CACHE_TTL_SECONDS = 300;
const cachedCapabilitiesSchema = z.object({
	generatedAt: z.string().datetime(),
});

interface CacheOptions {
	now?: () => Date;
	onError?: (error: unknown) => void;
}

export async function loadStarterCapabilitiesCache(
	store: KeyValueStore | undefined,
	{ now = () => new Date(), onError = () => undefined }: CacheOptions = {},
) {
	if (!store) return { status: "unavailable" as const, generatedAt: null };

	try {
		const parsed = cachedCapabilitiesSchema.safeParse(await store.get<unknown>(CACHE_KEY));
		if (parsed.success) return { status: "hit" as const, generatedAt: parsed.data.generatedAt };

		const value = { generatedAt: now().toISOString() };
		await store.put(CACHE_KEY, value, { expirationTtl: CACHE_TTL_SECONDS });
		return { status: "miss" as const, generatedAt: value.generatedAt };
	} catch (error) {
		onError(error);
		return { status: "error" as const, generatedAt: null };
	}
}
