<script lang="ts">
	import { resolve } from "$app/paths";
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms/client";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const { form, errors, enhance, submitting, message } = superForm(untrack(() => data.form));
</script>

<svelte:head><title>Nuevo periodo personalizado | {site.title}</title></svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<header>
		<h1 class="text-2xl font-bold tracking-tight">Nuevo periodo personalizado</h1>
		<p class="text-sm text-[var(--color-text-soft)]">
			Los periodos personalizados agrupan gastos fuera de los meses naturales, por ejemplo unas vacaciones.
		</p>
	</header>

	<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
		<div class="card-body gap-4">
			<form method="POST" use:enhance class="flex flex-col gap-4">
				<label class="fieldset" for="label">
					<span class="fieldset-legend">Nombre</span>
					<input
						id="label"
						name="label"
						type="text"
						placeholder="Vacaciones de agosto"
						class="input min-h-12 w-full"
						bind:value={$form.label}
						required
					/>
					{#if $errors.label}
						<p class="label text-error">{$errors.label}</p>
					{/if}
				</label>

				<label class="fieldset" for="startDate">
					<span class="fieldset-legend">Inicio</span>
					<input
						id="startDate"
						name="startDate"
						type="date"
						class="input min-h-12 w-full"
						bind:value={$form.startDate}
						required
					/>
					{#if $errors.startDate}
						<p class="label text-error">{$errors.startDate}</p>
					{/if}
				</label>

				<label class="fieldset" for="endDate">
					<span class="fieldset-legend">Fin</span>
					<input
						id="endDate"
						name="endDate"
						type="date"
						class="input min-h-12 w-full"
						bind:value={$form.endDate}
						required
					/>
					<span class="label text-[var(--color-text-soft)]">
						El gasto del día de fin ya pertenece al siguiente periodo.
					</span>
					{#if $errors.endDate}
						<p class="label text-error">{$errors.endDate}</p>
					{/if}
				</label>

				{#if $message}
					<div class="alert alert-error" role="alert">{$message}</div>
				{/if}

				<div class="flex gap-2">
					<a class="btn min-h-12 flex-1" href={resolve("/gastos")}>Cancelar</a>
					<button class="btn btn-primary min-h-12 flex-1" disabled={$submitting}>
						{$submitting ? "Guardando…" : "Crear periodo"}
					</button>
				</div>
			</form>
		</div>
	</div>
</div>
