<script lang="ts">
	import { page } from "$app/state";
	import EmptyState from "$lib/components/empty-state.svelte";
	import PeriodNavigator from "$lib/components/period-navigator.svelte";
	import { site } from "$lib/site";
</script>

<svelte:head><title>Resumen | {site.title}</title></svelte:head>

<div class="space-y-8">
	<header class="flex flex-col gap-2">
		<p class="text-sm font-semibold text-primary">Tu hogar, mes a mes</p>
		<h1 class="text-3xl font-bold tracking-tight sm:text-4xl">Resumen</h1>
		<p class="max-w-prose text-[var(--color-text-soft)]">Consulta cada periodo desde una vista clara y compartida.</p>
	</header>

	<PeriodNavigator url={page.url} />

	<EmptyState
		title="Todavía no hay datos para este periodo"
		description="Los gastos, saldos y movimientos aparecerán aquí cuando estén disponibles."
	/>
</div>
