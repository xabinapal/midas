import { describe, expect, it, vi } from "vitest";
import type { KVNamespace } from "@cloudflare/workers-types";
import { createKeyValueStore } from "./store";

function createNamespaceMock() {
	const get = vi.fn();
	const put = vi.fn();
	const deleteValue = vi.fn();
	const namespace = { get, put, delete: deleteValue } as unknown as KVNamespace;
	return { namespace, get, put, deleteValue };
}

describe("createKeyValueStore", () => {
	it("reads scoped JSON values", async () => {
		const { namespace, get } = createNamespaceMock();
		get.mockResolvedValue({ userId: "user-1" });
		const store = createKeyValueStore(namespace, "sessions");

		await expect(store.get<{ userId: string }>("token-1")).resolves.toEqual({ userId: "user-1" });
		expect(get).toHaveBeenCalledWith("sessions:token-1", "json");
	});

	it("writes scoped JSON values with expiration options", async () => {
		const { namespace, put } = createNamespaceMock();
		const store = createKeyValueStore(namespace, "cache");

		await store.put("capabilities", { generatedAt: "2026-08-03T00:00:00.000Z" }, { expirationTtl: 300 });

		expect(put).toHaveBeenCalledWith(
			"cache:capabilities",
			JSON.stringify({ generatedAt: "2026-08-03T00:00:00.000Z" }),
			{ expirationTtl: 300 },
		);
	});

	it("deletes scoped values", async () => {
		const { namespace, deleteValue } = createNamespaceMock();
		const store = createKeyValueStore(namespace, "sessions");

		await store.delete("token-1");

		expect(deleteValue).toHaveBeenCalledWith("sessions:token-1");
	});
});
