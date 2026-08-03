import { getPlatformProxy } from "wrangler";
import { resetCache } from "./cache/reset.ts";

const proxy = await getPlatformProxy({ configPath: "wrangler.jsonc", remoteBindings: false });

try {
	const deleted = await resetCache(proxy.env.KV);
	console.log(`Local cache reset: deleted ${deleted} ${deleted === 1 ? "entry" : "entries"}.`);
} finally {
	await proxy.dispose();
}
