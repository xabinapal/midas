<script lang="ts">
	import { formatDate } from "$lib/format/format";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Actividad | {site.title}</title></svelte:head>

<div class="space-y-6">
	<header>
		<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Actividad</h1>
		<p class="text-sm text-[var(--color-text-soft)]">Historial reciente del hogar.</p>
	</header>

	<div
		class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)] bg-base-100"
	>
		{#each data.events as event (event.id)}
			<div class="p-4">
				<div class="flex items-center justify-between gap-2">
					<p class="font-semibold">
						{data.eventLabels[event.event_type] ?? event.event_type}
					</p>
					<time class="text-sm text-[var(--color-text-muted)]">{formatDate(event.occurred_at)}</time>
				</div>
				{#if event.actor_user_id}
					<p class="text-sm text-[var(--color-text-soft)]">Por: {event.actor_user_id.slice(0, 8)}</p>
				{/if}
			</div>
		{:else}
			<div class="p-8 text-center text-[var(--color-text-soft)]">No hay actividad registrada.</div>
		{/each}
	</div>
</div>
