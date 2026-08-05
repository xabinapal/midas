<script lang="ts">
	import { formatDate } from "$lib/format/format";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	function parseSummary(raw: string): Record<string, string> {
		try {
			const parsed = JSON.parse(raw) as Record<string, unknown>;
			const result: Record<string, string> = {};
			for (const [key, value] of Object.entries(parsed)) {
				if (typeof value === "string" || typeof value === "number") {
					result[key] = String(value);
				}
			}
			return result;
		} catch {
			return {};
		}
	}

	const summaryLabels: Record<string, string> = {
		action: "Acción",
		memberName: "Miembro",
		username: "Usuario",
		householdName: "Hogar",
		memberCount: "N.º de miembros",
		target: "Objetivo",
	};
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
				{#if event.actor_username}
					<p class="text-sm text-[var(--color-text-soft)]">Por: {event.actor_username}</p>
				{:else}
					<p class="text-sm text-[var(--color-text-muted)]">Sistema</p>
				{/if}
				{#if event.summary && event.summary !== "{}"}
					{@const details = parseSummary(event.summary)}
					{#if Object.keys(details).length > 0}
						<dl class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
							{#each Object.entries(details) as [key, value] (key)}
								<div class="flex gap-1">
									<dt class="text-[var(--color-text-muted)]">{summaryLabels[key] ?? key}:</dt>
									<dd class="text-[var(--color-text-soft)]">{value}</dd>
								</div>
							{/each}
						</dl>
					{/if}
				{/if}
			</div>
		{:else}
			<div class="p-8 text-center text-[var(--color-text-soft)]">No hay actividad registrada.</div>
		{/each}
	</div>
</div>
