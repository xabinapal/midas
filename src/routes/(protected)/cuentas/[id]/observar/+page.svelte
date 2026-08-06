<script lang="ts">
	import { resolve } from "$app/paths";
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms/client";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const { form, errors, enhance, submitting, message } = superForm(untrack(() => data.form));
</script>

<svelte:head><title>Observar saldo · {data.account.name} | {site.title}</title></svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<header>
		<h1 class="text-2xl font-bold tracking-tight">Observar saldo</h1>
		<p class="text-sm text-[var(--color-text-soft)]">
			Anota el saldo que ves en {data.account.name}. Midas lo usará como referencia del saldo estimado; no se sincroniza
			con el banco.
		</p>
	</header>

	<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
		<div class="card-body gap-4">
			<form method="POST" use:enhance class="flex flex-col gap-4">
				<label class="fieldset" for="amount">
					<span class="fieldset-legend">Saldo observado ({data.account.currency})</span>
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

				<label class="fieldset" for="effectiveDate">
					<span class="fieldset-legend">Fecha de la observación</span>
					<input
						id="effectiveDate"
						name="effectiveDate"
						type="date"
						class="input min-h-12 w-full"
						bind:value={$form.effectiveDate}
						required
					/>
					{#if $errors.effectiveDate}
						<p class="label text-error">{$errors.effectiveDate}</p>
					{/if}
				</label>

				{#if $message}
					<div class="alert alert-error" role="alert">{$message}</div>
				{/if}

				<div class="flex gap-2">
					<a class="btn min-h-12 flex-1" href={resolve(`/cuentas/${data.account.id}`)}>Cancelar</a>
					<button class="btn btn-primary min-h-12 flex-1" disabled={$submitting}>
						{$submitting ? "Guardando…" : "Registrar observación"}
					</button>
				</div>
			</form>
		</div>
	</div>
</div>
