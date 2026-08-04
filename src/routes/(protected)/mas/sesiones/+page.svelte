<script lang="ts">
	import { formatDate } from "$lib/format/format";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Sesiones | {site.title}</title></svelte:head>

<div class="space-y-6">
	<header>
		<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Sesiones</h1>
		<p class="text-sm text-[var(--color-text-soft)]">Tus sesiones activas en este navegador y otros dispositivos.</p>
	</header>

	<div
		class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)] bg-base-100"
	>
		{#each data.sessions as session (session.id)}
			<div class="flex items-center justify-between gap-4 p-4">
				<div>
					<p class="font-semibold">
						{session.id === data.currentSessionId ? "Esta sesión" : "Sesión"}
					</p>
					<p class="text-sm text-[var(--color-text-soft)]">
						Iniciada: {formatDate(session.created_at)} · Expira: {formatDate(session.expires_at)}
					</p>
				</div>
			</div>
		{:else}
			<div class="p-8 text-center text-[var(--color-text-soft)]">No hay sesiones activas.</div>
		{/each}
	</div>
</div>
