<script lang="ts">
	import { enhance } from "$app/forms";
	import { resolve } from "$app/paths";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();
	let submitting = $state(false);
	const activeForm = $derived(form?.form ?? data.form);
</script>

<svelte:head><title>Nuevo miembro | {site.title}</title></svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<header>
		<h1 class="text-2xl font-bold tracking-tight">Nuevo miembro</h1>
		<p class="text-sm text-[var(--color-text-soft)]">Añade una persona al hogar.</p>
	</header>

	<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
		<div class="card-body gap-4">
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
					/>
					{#if activeForm.errors.defaultWeight}
						<p class="label text-error">{activeForm.errors.defaultWeight}</p>
					{/if}
				</label>

				{#if activeForm.message}
					<div class="alert alert-error" role="alert">{activeForm.message}</div>
				{/if}

				<div class="flex gap-2">
					<a class="btn min-h-12 flex-1" href={resolve("/mas/miembros")}>Cancelar</a>
					<button class="btn btn-primary min-h-12 flex-1" disabled={submitting}>
						{submitting ? "Guardando…" : "Crear miembro"}
					</button>
				</div>
			</form>
		</div>
	</div>
</div>
