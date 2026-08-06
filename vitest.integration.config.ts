import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL("./src/lib", import.meta.url)),
			"$app/environment": fileURLToPath(new URL("./tests/integration/stubs/app-environment.ts", import.meta.url)),
		},
	},
	test: {
		include: ["tests/integration/**/*.test.ts"],
		environment: "node",
		fileParallelism: false,
	},
});
