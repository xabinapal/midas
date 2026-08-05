<script lang="ts">
	import { enhance } from "$app/forms";
	import { resolve } from "$app/paths";
	import { site } from "$lib/site";
	import ConfirmationDialog from "$lib/components/confirmation-dialog.svelte";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();
	let submitting = $state(false);
	let deleteDialogOpen = $state(false);
	let deleteFormEl: HTMLFormElement | undefined = $state();
	const activeForm = $derived(form?.form ?? data.form);
</script>

<svelte:head><title>{data.member.displayName} | {site.title}</title></svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<header>
		<a href={resolve("/mas/miembros")} class="link link-hover text-sm text-[var(--color-text-soft)]">← Miembros</a>
		<h1 class="mt-2 text-2xl font-bold tracking-tight">{data.member.displayName}</h1>
		<p class="text-sm text-[var(--color-text-soft)]">{data.member.isActive ? "Activo" : "Inactivo"}</p>
	</header>

	<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
		<div class="card-body gap-4">
			<h2 class="text-lg font-bold">Editar miembro</h2>
			<form
				method="POST"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						submitting = false;
						await update();
					};
				}}
				class="flex flex-col gap-4"
			>
				<label class="fieldset" for="displayName">
					<span class="fieldset-legend">Nombre</span>
					<input
						id="displayName"
						name="displayName"
						type="text"
						class="input min-h-12 w-full"
						bind:value={data.form.data.displayName}
						required
					/>
					{#if activeForm.errors.displayName}
						<p class="label text-error">{activeForm.errors.displayName}</p>
					{/if}
				</label>

				<label class="fieldset" for="defaultWeight">
					<span class="fieldset-legend">Peso de reparto por defecto</span>
					<input
						id="defaultWeight"
						name="defaultWeight"
						type="number"
						min="0"
						class="input min-h-12 w-full"
						bind:value={data.form.data.defaultWeight}
						required
					/>
					{#if activeForm.errors.defaultWeight}
						<p class="label text-error">{activeForm.errors.defaultWeight}</p>
					{/if}
				</label>

				<div class="flex gap-2">
					<a class="btn min-h-12 flex-1" href={resolve("/mas/miembros")}>Cancelar</a>
					<button class="btn btn-primary min-h-12 flex-1" disabled={submitting}>
						{submitting ? "Guardando…" : "Guardar"}
					</button>
				</div>
			</form>

			{#if data.linkedUsers.length > 0}
				<div class="divider text-sm text-[var(--color-text-soft)]">Usuarios asociados</div>
				<ul class="space-y-2">
					{#each data.linkedUsers as linkedUser (linkedUser.id)}
						<li class="flex items-center justify-between text-sm">
							<span>{linkedUser.username}</span>
							<span class="badge badge-sm badge-ghost">{linkedUser.is_active === 1 ? "Activo" : "Desactivado"}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>

	<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
		<div class="card-body gap-4">
			<h2 class="text-lg font-bold">Eliminar miembro</h2>
			<p class="text-sm text-[var(--color-text-soft)]">
				Solo se puede eliminar un miembro sin usuarios asociados ni referencias en el historial.
			</p>
			{#if form?.deleteResult?.success === false}
				<div class="alert alert-warning" role="alert">
					{#if form.deleteResult.reason === "has_references"}
						No se puede eliminar: el miembro tiene usuarios asociados o referencias en el historial.
					{:else}
						No se pudo eliminar el miembro. Inténtalo de nuevo.
					{/if}
				</div>
			{/if}
			<form
				method="POST"
				action="?/delete"
				bind:this={deleteFormEl}
				use:enhance={() => {
					return async ({ update }) => {
						await update();
					};
				}}
			>
				<button class="btn btn-error min-h-12 w-full" type="button" onclick={() => (deleteDialogOpen = true)}>
					Eliminar miembro
				</button>
			</form>
		</div>
	</div>

	<ConfirmationDialog
		open={deleteDialogOpen}
		title="Eliminar miembro"
		description="Esta acción es permanente y no se puede deshacer."
		recordName={data.member.displayName}
		confirmLabel="Eliminar"
		onconfirm={() => {
			deleteDialogOpen = false;
			deleteFormEl?.requestSubmit();
		}}
		oncancel={() => (deleteDialogOpen = false)}
	/>
</div>
