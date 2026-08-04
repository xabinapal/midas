<script lang="ts">
	import "../app.css";

	import { APP_BASE_URL } from "$env/static/public";
	import { site } from "$lib/site";
	import type { LayoutProps } from "./$types";

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>{site.title}</title>

	<meta charset="utf-8" />
	<meta name="robots" content={site.indexable ? "index,follow" : "noindex,nofollow"} />
	<meta name="viewport" content="width=device-width, initial-scale=1" />

	<meta name="title" content={site.title} />
	<meta name="description" content={site.description} />
	<meta name="author" content={site.author} />
	<meta name="keywords" content={site.keywords} />
	<meta name="theme-color" content={site.themeColor} />

	<link rel="canonical" href={APP_BASE_URL} />
	<link rel="icon" type="image/svg+xml" href="{APP_BASE_URL}/favicon.svg" />
	<link rel="manifest" href="{APP_BASE_URL}/site.webmanifest" />
</svelte:head>

{@render children()}
