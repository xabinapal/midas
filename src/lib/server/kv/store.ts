import type { KVNamespace, KVNamespacePutOptions } from "@cloudflare/workers-types";

export interface KeyValueStore {
	get<Value>(key: string): Promise<Value | null>;
	put<Value>(key: string, value: Value, options?: KVNamespacePutOptions): Promise<void>;
	delete(key: string): Promise<void>;
}

export function createKeyValueStore(namespace: KVNamespace, prefix: string): KeyValueStore {
	const scopedKey = (key: string) => `${prefix}:${key}`;

	return {
		get: <Value>(key: string) => namespace.get<Value>(scopedKey(key), "json"),
		put: (key, value, options) => namespace.put(scopedKey(key), JSON.stringify(value), options),
		delete: (key) => namespace.delete(scopedKey(key)),
	};
}
