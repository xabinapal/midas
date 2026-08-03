import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { KVNamespace } from "@cloudflare/workers-types";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { resetCache } from "../../scripts/cache/reset";
import { createKeyValueStore } from "../../src/lib/server/kv";

describe.sequential("KV integration", () => {
	let proxy: PlatformProxy<{ KV: KVNamespace }>;
	let namespace: KVNamespace;
	let store: ReturnType<typeof createKeyValueStore>;

	beforeAll(async () => {
		proxy = await getPlatformProxy({
			configPath: "wrangler.jsonc",
			persist: false,
			remoteBindings: false,
		});
		namespace = proxy.env.KV;
		store = createKeyValueStore(namespace, "app");
	});

	beforeEach(async () => {
		await resetCache(namespace);
		await namespace.delete("app:preferences:v1:theme");
	});

	afterAll(async () => {
		await proxy?.dispose();
	});

	it("reads and writes scoped JSON through the real Wrangler binding", async () => {
		await store.put("cache:v1:capabilities", { generatedAt: "2026-08-03T00:00:00.000Z" }, { expirationTtl: 300 });

		await expect(store.get<{ generatedAt: string }>("cache:v1:capabilities")).resolves.toEqual({
			generatedAt: "2026-08-03T00:00:00.000Z",
		});
	});

	it("deletes scoped values through the real Wrangler binding", async () => {
		await store.put("cache:v1:capabilities", { generatedAt: "2026-08-03T00:00:00.000Z" });

		await store.delete("cache:v1:capabilities");

		await expect(store.get("cache:v1:capabilities")).resolves.toBeNull();
	});

	it("clears every cache key while retaining non-cache application data", async () => {
		await store.put("cache:v1:first", { value: 1 });
		await store.put("cache:v1:second", { value: 2 });
		await store.put("preferences:v1:theme", { theme: "dark" });

		await expect(resetCache(namespace)).resolves.toBe(2);
		await expect(store.get("cache:v1:first")).resolves.toBeNull();
		await expect(store.get("cache:v1:second")).resolves.toBeNull();
		await expect(store.get("preferences:v1:theme")).resolves.toEqual({ theme: "dark" });
	});
});
