import js from "@eslint/js";
import tseslint from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";
import { fileURLToPath } from "node:url";

export default tseslint.config(
	{
		ignores: [
			"build/",
			".svelte-kit/",
			"dist/",
			"node_modules/",
			".wrangler/",
			".env",
			".env.*",
			"!.env.example",
			"package-lock.json",
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	...svelte.configs["flat/recommended"],
	...svelte.configs["flat/prettier"],
	prettierConfig,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
		},
	},
	{
		files: ["**/*.d.ts"],
		rules: {
			"@typescript-eslint/no-empty-object-type": "off",
		},
	},
	{
		files: ["src/lib/server/database/migrations/**/*.ts", "src/lib/server/database/d1-dialect.ts"],
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
		},
	},
	{
		files: ["**/*.svelte"],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser,
				project: "./tsconfig.json",
				tsconfigRootDir: fileURLToPath(new URL(".", import.meta.url)),
				extraFileExtensions: [".svelte"],
			},
		},
	},
);
