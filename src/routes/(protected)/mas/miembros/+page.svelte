<script lang="ts">
	import { resolve } from "$app/paths";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Miembros | {site.title}</title></svelte:head>

<div class="space-y-6">
	<header class="flex items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Miembros</h1>
			<p class="text-sm text-[var(--color-text-soft)]">Personas que forman parte del hogar.</p>
		</div>
		<a class="btn btn-primary min-h-12" href={resolve("/mas/miembros/crear")}>Añadir miembro</a>
	</header>

	{#if form?.success === false && form.reason === "last_members"}
		<div class="alert alert-warning" role="alert">
			No se puede desactivar: el hogar necesita al menos dos miembros activos.
		</div>
	{/if}
	{#if form?.success === false && form.reason === "last_weight"}
		<div class="alert alert-warning" role="alert">
			No se puede desactivar: el peso total de reparto de los miembros activos debe ser mayor que cero.
		</div>
	{/if}

	<div
		class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)] bg-base-100"
	>
		{#each data.members as member (member.id)}
			<div class="flex items-center justify-between gap-4 p-4">
				<a class="flex items-center gap-3" href={resolve(`/mas/miembros/${member.id}`)}>
					<div class="avatar avatar-placeholder">
						<div class="size-10 rounded-full bg-base-200 text-center leading-10">{member.displayName.charAt(0)}</div>
					</div>
					<div>
						<p class="font-semibold">{member.displayName}</p>
						<p class="text-sm text-[var(--color-text-soft)]">
							{member.isActive ? "Activo" : "Inactivo"}
						</p>
					</div>
				</a>
				<div class="flex gap-2">
					<a class="btn btn-ghost btn-sm min-h-11" href={resolve(`/mas/miembros/${member.id}`)}>Editar</a>
					{#if member.isActive}
						<form method="POST" action="?/deactivate">
							<input type="hidden" name="memberId" value={member.id} />
							<button class="btn btn-ghost btn-sm min-h-11" type="submit">Desactivar</button>
						</form>
					{:else}
						<form method="POST" action="?/reactivate">
							<input type="hidden" name="memberId" value={member.id} />
							<button class="btn btn-ghost btn-sm min-h-11" type="submit">Reactivar</button>
						</form>
					{/if}
				</div>
			</div>
		{:else}
			<div class="p-8 text-center text-[var(--color-text-soft)]">No hay miembros registrados.</div>
		{/each}
	</div>
</div>
