<script lang="ts">
	import { formatDate } from "$lib/format/format";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Sesiones | {site.title}</title></svelte:head>

<div class="space-y-6">
	<header class="flex items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Sesiones</h1>
			<p class="text-sm text-[var(--color-text-soft)]">Tus sesiones activas en este navegador y otros dispositivos.</p>
		</div>
		{#if data.sessions.length > 1}
			<form method="POST" action="?/revokeAllOthers">
				<button class="btn btn-ghost min-h-12" type="submit">Cerrar las demás</button>
			</form>
		{/if}
	</header>

	{#if form?.success === false && form.reason === "current"}
		<div class="alert alert-warning" role="alert">
			No puedes revocar la sesión actual desde aquí. Usa cerrar sesión.
		</div>
	{/if}

	{#if form?.success === true}
		<div class="alert alert-success" role="status">Sesión revocada.</div>
	{/if}

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
				{#if session.id !== data.currentSessionId}
					<form method="POST" action="?/revoke">
						<input type="hidden" name="sessionId" value={session.id} />
						<button class="btn btn-ghost btn-sm min-h-11" type="submit" aria-label="Revocar sesión">Revocar</button>
					</form>
				{:else}
					<span class="badge badge-sm badge-primary">Actual</span>
				{/if}
			</div>
		{:else}
			<div class="p-8 text-center text-[var(--color-text-soft)]">No hay sesiones activas.</div>
		{/each}
	</div>
</div>
