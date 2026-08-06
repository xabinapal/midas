<script lang="ts">
	import { resolve } from "$app/paths";
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
						{data.eventLabels[event.eventType] ?? event.eventType}
					</p>
					<time class="text-sm text-[var(--color-text-muted)]">{formatDate(event.occurredAt)}</time>
				</div>
				{#if event.actorUsername}
					<p class="text-sm text-[var(--color-text-soft)]">
						Por: {event.actorUsername}{#if event.actorIsActive === false}
							<span class="text-[var(--color-text-muted)]">(inactivo)</span>
						{/if}
					</p>
				{:else}
					<p class="text-sm text-[var(--color-text-muted)]">Sistema</p>
				{/if}
				{#if event.details.length > 0}
					<dl class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
						{#each event.details as detail (detail.label)}
							<div class="flex gap-1">
								<dt class="text-[var(--color-text-muted)]">{detail.label}:</dt>
								<dd class="text-[var(--color-text-soft)]">{detail.value}</dd>
							</div>
						{/each}
					</dl>
				{/if}
				{#if event.subjectLink}
					<a
						class="link mt-1 inline-flex min-h-11 items-center text-sm"
						href={event.subjectLink.kind === "expense"
							? resolve(`/gastos/${event.subjectLink.id}`)
							: event.subjectLink.kind === "payment"
								? resolve(`/pagos/${event.subjectLink.id}`)
								: resolve(`/cuentas/${event.subjectLink.id}`)}
					>
						Ver registro
					</a>
				{/if}
			</div>
		{:else}
			<div class="p-8 text-center text-[var(--color-text-soft)]">No hay actividad registrada.</div>
		{/each}
	</div>
</div>
