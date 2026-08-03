<script lang="ts">
	import DataTable from "$lib/components/data-table.svelte";
	import type { DataTableColumn, DataTableRow } from "$lib/components/data-table";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	interface CapabilityRow extends DataTableRow {
		capability: string;
		library: string;
		layer: string;
	}

	const capabilities: CapabilityRow[] = [
		{ id: "routing", capability: "Routing", library: "SvelteKit", layer: "Application" },
		{ id: "forms", capability: "Forms", library: "Superforms + Zod", layer: "Application" },
		{
			id: "tables",
			capability: "Data tables",
			library: "Svelte Headless Table",
			layer: "Application",
		},
		{ id: "database", capability: "Database", library: "Kysely + D1", layer: "Data" },
		{ id: "authentication", capability: "Authentication", library: "PBKDF2 + JWT", layer: "Security" },
		{ id: "key-value", capability: "Key-value storage", library: "Cloudflare KV", layer: "Data" },
		{ id: "styles", capability: "Components", library: "daisyUI", layer: "Interface" },
		{ id: "css", capability: "Styling", library: "Tailwind CSS", layer: "Interface" },
		{ id: "runtime", capability: "Runtime", library: "Cloudflare Workers", layer: "Platform" },
		{ id: "testing", capability: "Testing", library: "Vitest + Testing Library", layer: "Quality" },
	];
	const capabilityColumns: DataTableColumn<CapabilityRow>[] = [
		{ key: "capability", label: "Capability" },
		{ key: "library", label: "Library" },
		{ key: "layer", label: "Layer" },
	];

	let { data }: PageProps = $props();

	type CacheResult = Awaited<typeof data.cache>;

	function cacheDescription(cache: CacheResult) {
		switch (cache.status) {
			case "hit":
			case "miss":
				return `cached ${cache.generatedAt}`;
			case "error":
				return "cache request failed";
			case "unavailable":
				return "binding unavailable";
		}
	}
</script>

<section class="flex flex-col items-center justify-center gap-6 py-16 text-center">
	<h1 class="text-4xl font-bold text-primary">{site.title}</h1>
	<p class="max-w-prose text-lg opacity-70">{site.description}</p>

	<div class="flex flex-wrap justify-center gap-2">
		<span class="badge badge-outline badge-primary">SvelteKit</span>
		<span class="badge badge-outline badge-primary">Svelte 5</span>
		<span class="badge badge-outline badge-primary">Tailwind CSS</span>
		<span class="badge badge-outline badge-primary">daisyUI</span>
		<span class="badge badge-outline badge-primary">Cloudflare D1</span>
		<span class="badge badge-outline badge-primary">Cloudflare KV</span>
	</div>

	<div class="stats stats-vertical bg-base-200 shadow-lg sm:stats-horizontal">
		<div class="stat">
			<div class="stat-title">Authentication</div>
			<div class="stat-value text-primary">{data.authEnabled ? "enabled" : "disabled"}</div>
			<div class="stat-desc">{data.user ? `signed in as ${data.user.username}` : "public access"}</div>
		</div>
		<div class="stat">
			<div class="stat-title">KV cache</div>
			{#await data.cache}
				<div class="stat-value text-primary">loading</div>
				<div class="stat-desc">checking cache</div>
			{:then cache}
				<div class="stat-value text-primary uppercase">{cache.status}</div>
				<div class="stat-desc">{cacheDescription(cache)}</div>
			{/await}
		</div>
	</div>

	<div class="divider"></div>

	<div class="flex w-full flex-col gap-4 text-left">
		<div>
			<h2 class="text-2xl font-bold">Starter capabilities</h2>
			<p class="opacity-70">Filter, sort, and paginate the included application stack.</p>
		</div>
		<DataTable
			caption="Starter capabilities"
			columns={capabilityColumns}
			rows={capabilities}
			searchLabel="Filter capabilities"
		/>
	</div>
</section>
