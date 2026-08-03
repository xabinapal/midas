import type { KVNamespace } from "@cloudflare/workers-types";
import { describe, expect, it, vi } from "vitest";
import { resetCache } from "./reset";

describe("resetCache", () => {
	it("processes every cursor page and deletes only listed cache keys", async () => {
		const list = vi
			.fn()
			.mockResolvedValueOnce({
				cursor: "next-page",
				keys: [{ name: "app:cache:v1:first" }, { name: "app:cache:v1:second" }],
				list_complete: false,
			})
			.mockResolvedValueOnce({
				keys: [{ name: "app:cache:v1:third" }],
				list_complete: true,
			});
		const deleteKey = vi.fn().mockResolvedValue(undefined);
		const namespace = { delete: deleteKey, list } as unknown as KVNamespace;

		await expect(resetCache(namespace)).resolves.toBe(3);

		expect(list).toHaveBeenNthCalledWith(1, { cursor: undefined, prefix: "app:cache:" });
		expect(list).toHaveBeenNthCalledWith(2, { cursor: "next-page", prefix: "app:cache:" });
		expect(deleteKey.mock.calls.map(([key]) => key)).toEqual([
			"app:cache:v1:first",
			"app:cache:v1:second",
			"app:cache:v1:third",
		]);
		expect(deleteKey).not.toHaveBeenCalledWith("app:preferences:v1:theme");
	});
});
