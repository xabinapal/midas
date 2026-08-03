import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
		exclude: ["src/**/*.component.test.ts"],
		environment: "node",
	},
});
