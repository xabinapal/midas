<script lang="ts">
	import { resolve } from "$app/paths";
	import { site } from "$lib/site";
	import type { LayoutProps } from "./$types";

	let { data, children }: LayoutProps = $props();
</script>

<nav class="navbar mb-4 rounded-box bg-base-200 px-4" aria-label="Primary navigation">
	<div class="navbar-start">
		<a class="btn btn-ghost text-lg" href={resolve("/")}>{site.title}</a>
	</div>
	<div class="navbar-end gap-2">
		{#if data.authEnabled && data.user}
			<span class="hidden text-sm opacity-70 sm:inline">{data.user.username}</span>
			<a class="btn btn-ghost btn-sm" href={resolve("/logout")}>Log out</a>
		{:else}
			<span class="badge badge-ghost">Authentication disabled</span>
		{/if}
	</div>
</nav>

{@render children()}
