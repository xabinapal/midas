<script lang="ts">
	import { resolve } from "$app/paths";
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms/client";
	import ConfirmationDialog from "$lib/components/confirmation-dialog.svelte";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();

	const { form: createForm, errors, enhance, submitting, message } = superForm(untrack(() => data.form));

	let deactivatingId = $state<string | null>(null);
	let deactivateFormEl: HTMLFormElement | undefined = $state();
	let renamingId = $state<string | null>(null);
	let renameValue = $state("");

	const deactivating = $derived(data.rows.find((row) => row.id === deactivatingId) ?? null);

	function startRename(row: { id: string; name: string }) {
		renamingId = row.id;
		renameValue = row.name;
	}

	const reasonMessages: Record<string, string> = {
		conflict: "Otra operación está en curso. Inténtalo de nuevo.",
		category_not_found: "La categoría ya no está disponible.",
		category_name_taken: "Ya existe una categoría activa con ese nombre.",
		category_name_required: "El nombre es obligatorio.",
	};
</script>

<svelte:head><title>Categorías | {site.title}</title></svelte:head>

<div class="space-y-6">
	<header class="space-y-1">
		<p class="text-sm"><a class="link" href={resolve("/gastos")}>← Gastos</a></p>
		<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Categorías</h1>
		<p class="text-sm text-[var(--color-text-soft)]">Las categorías agrupan los gastos del hogar.</p>
	</header>

	{#if form && "success" in form && form.success === false}
		<div class="alert alert-warning" role="alert">
			{reasonMessages[form.reason ?? ""] ?? "No se pudo completar la acción."}
		</div>
	{/if}

	<section class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
		<div class="card-body gap-4">
			<h2 class="card-title text-lg">Nueva categoría</h2>
			<form method="POST" action="?/create" use:enhance class="flex flex-col gap-4">
				<label class="fieldset" for="name">
					<span class="fieldset-legend">Nombre</span>
					<input
						id="name"
						name="name"
						type="text"
						class="input min-h-12 w-full"
						bind:value={$createForm.name}
						required
					/>
					{#if $errors.name}
						<p class="label text-error">{$errors.name}</p>
					{/if}
				</label>

				{#if $message}
					<div class="alert alert-error" role="alert">{$message}</div>
				{/if}

				<button class="btn btn-primary min-h-12 self-start" disabled={$submitting}>
					{$submitting ? "Guardando…" : "Crear categoría"}
				</button>
			</form>
		</div>
	</section>

	<section class="space-y-3">
		{#if data.rows.length === 0}
			<p class="text-[var(--color-text-soft)]">Todavía no hay categorías.</p>
		{:else}
			<div
				class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)] bg-base-100"
			>
				{#each data.rows as row (row.id)}
					<div class="flex flex-wrap items-center justify-between gap-3 p-4">
						{#if renamingId === row.id}
							<form method="POST" action="?/rename" class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
								<input type="hidden" name="categoryId" value={row.id} />
								<label class="min-w-0 flex-1" for="rename-{row.id}">
									<span class="sr-only">Nuevo nombre</span>
									<input
										id="rename-{row.id}"
										name="name"
										type="text"
										class="input min-h-12 w-full"
										bind:value={renameValue}
										required
									/>
								</label>
								<button class="btn btn-primary btn-sm min-h-11" type="submit">Guardar</button>
								<button class="btn btn-ghost btn-sm min-h-11" type="button" onclick={() => (renamingId = null)}>
									Cancelar
								</button>
							</form>
						{:else}
							<div class="min-w-0">
								<p class="font-semibold break-words">
									{row.name}
									{#if !row.isActive}
										<span class="badge badge-sm badge-ghost">Desactivada</span>
									{/if}
								</p>
								<p class="text-sm text-[var(--color-text-soft)]">{row.slug}</p>
								{#if row.hasReferences}
									<p class="text-sm text-[var(--color-text-muted)]">En uso</p>
								{/if}
							</div>
							<div class="flex shrink-0 items-center gap-1">
								<button class="btn btn-ghost btn-sm min-h-11" onclick={() => startRename(row)}>Renombrar</button>
								{#if row.isActive}
									<button class="btn btn-ghost btn-sm min-h-11" onclick={() => (deactivatingId = row.id)}>
										Desactivar
									</button>
								{:else}
									<form method="POST" action="?/reactivate">
										<input type="hidden" name="categoryId" value={row.id} />
										<button class="btn btn-ghost btn-sm min-h-11" type="submit">Reactivar</button>
									</form>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

<form bind:this={deactivateFormEl} method="POST" action="?/deactivate" class="hidden">
	<input type="hidden" name="categoryId" value={deactivatingId ?? ""} />
</form>

{#if deactivating}
	<ConfirmationDialog
		open={deactivatingId !== null}
		title="Desactivar categoría"
		recordName={deactivating.name}
		description="La categoría dejará de estar disponible para nuevos gastos. Puedes reactivarla cuando quieras; los gastos históricos siempre la muestran."
		confirmLabel="Desactivar"
		tone="error"
		onconfirm={() => {
			deactivateFormEl?.requestSubmit();
			deactivatingId = null;
		}}
		oncancel={() => (deactivatingId = null)}
	/>
{/if}
