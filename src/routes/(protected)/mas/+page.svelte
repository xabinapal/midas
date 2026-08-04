<script lang="ts">
	import { resolve } from "$app/paths";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const items = [
		{
			href: resolve("/mas/miembros"),
			label: "Miembros",
			description: "Gestiona los miembros del hogar",
			icon: "members",
		},
		{
			href: resolve("/mas/sesiones"),
			label: "Sesiones",
			description: "Revisa y cierra tus sesiones activas",
			icon: "sessions",
		},
		{
			href: resolve("/mas/actividad"),
			label: "Actividad",
			description: "Historial de cambios del hogar",
			icon: "activity",
		},
	];
	const adminItems = [
		{
			href: resolve("/mas/usuarios"),
			label: "Usuarios",
			description: "Crea, desactiva y restablece usuarios",
			icon: "users",
		},
	];
</script>

<svelte:head><title>Más | {site.title}</title></svelte:head>

<div class="space-y-6">
	<header class="flex flex-col gap-2">
		<h1 class="text-3xl font-bold tracking-tight sm:text-4xl">Más</h1>
		<p class="text-[var(--color-text-soft)]">Gestión del hogar y la cuenta.</p>
	</header>

	<section class="space-y-3">
		<h2 class="text-xl font-bold">Hogar</h2>
		<div class="grid gap-3 sm:grid-cols-2">
			{#each items as item (item.label)}
				<a
					href={item.href}
					class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)] transition-transform hover:scale-[1.01]"
				>
					<div class="card-body gap-1">
						<h3 class="card-title text-lg">{item.label}</h3>
						<p class="text-sm text-[var(--color-text-soft)]">{item.description}</p>
					</div>
				</a>
			{/each}
		</div>
	</section>

	{#if data.isAdministrator}
		<section class="space-y-3">
			<h2 class="text-xl font-bold">Administración</h2>
			<div class="grid gap-3 sm:grid-cols-2">
				{#each adminItems as item (item.label)}
					<a
						href={item.href}
						class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)] transition-transform hover:scale-[1.01]"
					>
						<div class="card-body gap-1">
							<h3 class="card-title text-lg">{item.label}</h3>
							<p class="text-sm text-[var(--color-text-soft)]">{item.description}</p>
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/if}
</div>
