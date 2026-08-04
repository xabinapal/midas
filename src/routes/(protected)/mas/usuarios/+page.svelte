<script lang="ts">
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Usuarios | {site.title}</title></svelte:head>

<div class="space-y-6">
	<header>
		<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Usuarios</h1>
		<p class="text-sm text-[var(--color-text-soft)]">Cuentas con acceso al hogar.</p>
	</header>

	<div
		class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)] bg-base-100"
	>
		{#each data.users as user (user.id)}
			<div class="flex items-center justify-between gap-4 p-4">
				<div>
					<div class="flex items-center gap-2">
						<p class="font-semibold">{user.username}</p>
						{#if user.is_administrator === 1}
							<span class="badge badge-sm badge-primary">Admin</span>
						{/if}
						{#if user.id === data.currentUserId}
							<span class="badge badge-sm badge-ghost">Tú</span>
						{/if}
					</div>
					<p class="text-sm text-[var(--color-text-soft)]">
						{user.is_active === 1 ? "Activo" : "Desactivado"}
						{#if user.requires_password_change === 1}
							· Cambio pendiente
						{/if}
					</p>
				</div>
			</div>
		{/each}
	</div>
</div>
