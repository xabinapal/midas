<script lang="ts">
	import { resolve } from "$app/paths";
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms/client";
	import TemplateAllocationFields from "$lib/components/template-allocation-fields.svelte";
	import { TEMPLATE_CADENCE_LABELS } from "$lib/expenses/terms";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const { form, errors, enhance, submitting, message } = superForm(untrack(() => data.form));

	const cadences = Object.keys(TEMPLATE_CADENCE_LABELS) as (keyof typeof TEMPLATE_CADENCE_LABELS)[];
</script>

<svelte:head><title>Nueva plantilla | {site.title}</title></svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<header>
		<h1 class="text-2xl font-bold tracking-tight">Nueva plantilla</h1>
		<p class="text-sm text-[var(--color-text-soft)]">Una plantilla genera gastos previstos de forma recurrente.</p>
	</header>

	{#if data.categories.length === 0}
		<div class="alert alert-info" role="status">
			No hay categorías activas.
			<a class="link" href={resolve("/gastos/categorias")}>Crea primero una categoría</a>
		</div>
	{:else}
		<div class="alert alert-info" role="status">
			La plantilla genera gastos previstos al abrir cada periodo; cambiarla después no altera los ya generados.
		</div>

		<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
			<div class="card-body gap-4">
				<form method="POST" use:enhance class="flex flex-col gap-4">
					<label class="fieldset" for="description">
						<span class="fieldset-legend">Descripción</span>
						<input
							id="description"
							name="description"
							type="text"
							class="input min-h-12 w-full"
							bind:value={$form.description}
							required
						/>
						{#if $errors.description}
							<p class="label text-error">{$errors.description}</p>
						{/if}
					</label>

					<label class="fieldset" for="categoryId">
						<span class="fieldset-legend">Categoría</span>
						<select
							id="categoryId"
							name="categoryId"
							class="select min-h-12 w-full"
							bind:value={$form.categoryId}
							required
						>
							<option value="" disabled>Selecciona una categoría</option>
							{#each data.categories as category (category.id)}
								<option value={category.id}>{category.name}</option>
							{/each}
						</select>
						{#if $errors.categoryId}
							<p class="label text-error">{$errors.categoryId}</p>
						{/if}
					</label>

					<label class="fieldset" for="amount">
						<span class="fieldset-legend">Importe estimado ({data.currency})</span>
						<input
							id="amount"
							name="amount"
							type="text"
							inputmode="decimal"
							placeholder="0,00"
							class="input min-h-12 w-full"
							bind:value={$form.amount}
							required
						/>
						{#if $errors.amount}
							<p class="label text-error">{$errors.amount}</p>
						{/if}
					</label>

					<label class="fieldset" for="cadence">
						<span class="fieldset-legend">Periodicidad</span>
						<select id="cadence" name="cadence" class="select min-h-12 w-full" bind:value={$form.cadence}>
							{#each cadences as cadence (cadence)}
								<option value={cadence}>{TEMPLATE_CADENCE_LABELS[cadence]}</option>
							{/each}
						</select>
						{#if $errors.cadence}
							<p class="label text-error">{$errors.cadence}</p>
						{/if}
					</label>

					<label class="fieldset" for="intervalCount">
						<span class="fieldset-legend">Cada</span>
						<input
							id="intervalCount"
							name="intervalCount"
							type="number"
							min="1"
							step="1"
							class="input min-h-12 w-full"
							bind:value={$form.intervalCount}
							required
						/>
						<span class="label text-[var(--color-text-soft)]">
							Por ejemplo 2 para {$form.cadence === "monthly" ? "cada dos meses" : "cada dos años"}.
						</span>
						{#if $errors.intervalCount}
							<p class="label text-error">{$errors.intervalCount}</p>
						{/if}
					</label>

					<label class="fieldset" for="startDate">
						<span class="fieldset-legend">Primera fecha</span>
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
						<span class="fieldset-legend">Fin de la recurrencia (opcional)</span>
						<input id="endDate" name="endDate" type="date" class="input min-h-12 w-full" bind:value={$form.endDate} />
						{#if $errors.endDate}
							<p class="label text-error">{$errors.endDate}</p>
						{/if}
					</label>

					<label class="fieldset" for="dueDay">
						<span class="fieldset-legend">Regla de vencimiento: día del mes (opcional)</span>
						<input
							id="dueDay"
							name="dueDay"
							type="number"
							min="1"
							max="31"
							step="1"
							class="input min-h-12 w-full"
							bind:value={$form.dueDay}
						/>
						{#if $errors.dueDay}
							<p class="label text-error">{$errors.dueDay}</p>
						{/if}
					</label>

					<label class="fieldset" for="serviceSpanMonths">
						<span class="fieldset-legend">Meses de servicio cubierto (opcional)</span>
						<input
							id="serviceSpanMonths"
							name="serviceSpanMonths"
							type="number"
							min="1"
							step="1"
							class="input min-h-12 w-full"
							bind:value={$form.serviceSpanMonths}
						/>
						<span class="label text-[var(--color-text-soft)]">Por ejemplo 12 para un seguro anual.</span>
						{#if $errors.serviceSpanMonths}
							<p class="label text-error">{$errors.serviceSpanMonths}</p>
						{/if}
					</label>

					<label class="fieldset" for="accountHintId">
						<span class="fieldset-legend">Cuenta habitual (opcional)</span>
						<select
							id="accountHintId"
							name="accountHintId"
							class="select min-h-12 w-full"
							bind:value={$form.accountHintId}
						>
							<option value="">Sin cuenta habitual</option>
							{#each data.accounts as account (account.id)}
								<option value={account.id}>{account.name}</option>
							{/each}
						</select>
						{#if $errors.accountHintId}
							<p class="label text-error">{$errors.accountHintId}</p>
						{/if}
					</label>

					<TemplateAllocationFields
						members={data.members}
						bind:method={$form.allocationMethod}
						bind:memberIds={$form.memberIds}
						initialValues={{}}
						methodError={$errors.allocationMethod}
						memberError={$errors.memberIds?._errors}
					/>

					{#if $message}
						<div class="alert alert-error" role="alert">{$message}</div>
					{/if}

					<div class="flex gap-2">
						<a class="btn min-h-12 flex-1" href={resolve("/gastos/plantillas")}>Cancelar</a>
						<button class="btn btn-primary min-h-12 flex-1" disabled={$submitting}>
							{$submitting ? "Guardando…" : "Crear plantilla"}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
