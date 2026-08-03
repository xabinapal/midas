import { describe, expect, it, vi } from "vitest";
import type { KeyValueStore } from "$lib/server/kv";
import { loadStarterCapabilitiesCache } from "./starter-capabilities";

const NOW = new Date("2026-08-03T12:00:00.000Z");

function createStore(): KeyValueStore {
	return {
		get: vi.fn(),
		put: vi.fn(),
		delete: vi.fn(),
	};
}

describe("loadStarterCapabilitiesCache", () => {
	it("reports an unavailable binding", async () => {
		await expect(loadStarterCapabilitiesCache(undefined, { now: () => NOW })).resolves.toEqual({
			status: "unavailable",
			generatedAt: null,
		});
	});

	it("returns a valid cached value", async () => {
		const store = createStore();
		vi.mocked(store.get).mockResolvedValue({ generatedAt: "2026-08-03T11:59:00.000Z" });

		await expect(loadStarterCapabilitiesCache(store, { now: () => NOW })).resolves.toEqual({
			status: "hit",
			generatedAt: "2026-08-03T11:59:00.000Z",
		});
		expect(store.put).not.toHaveBeenCalled();
	});

	it.each([null, {}, { generatedAt: 7 }, { generatedAt: "not-a-date" }])(
		"replaces missing or malformed cache value %#",
		async (cached) => {
			const store = createStore();
			vi.mocked(store.get).mockResolvedValue(cached);

			await expect(loadStarterCapabilitiesCache(store, { now: () => NOW })).resolves.toEqual({
				status: "miss",
				generatedAt: NOW.toISOString(),
			});
			expect(store.put).toHaveBeenCalledWith(
				"cache:v1:starter-capabilities",
				{ generatedAt: NOW.toISOString() },
				{ expirationTtl: 300 },
			);
		},
	);

	it("degrades safely and reports storage errors", async () => {
		const store = createStore();
		const error = new Error("KV unavailable");
		vi.mocked(store.get).mockRejectedValue(error);
		const onError = vi.fn();

		await expect(loadStarterCapabilitiesCache(store, { now: () => NOW, onError })).resolves.toEqual({
			status: "error",
			generatedAt: null,
		});
		expect(onError).toHaveBeenCalledWith(error);
	});

	it("reports cache write failures", async () => {
		const store = createStore();
		const error = new Error("KV write failed");
		vi.mocked(store.get).mockResolvedValue(null);
		vi.mocked(store.put).mockRejectedValue(error);
		const onError = vi.fn();

		await expect(loadStarterCapabilitiesCache(store, { now: () => NOW, onError })).resolves.toEqual({
			status: "error",
			generatedAt: null,
		});
		expect(onError).toHaveBeenCalledWith(error);
	});
});
