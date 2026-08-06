<script lang="ts">
	import { resolve } from "$app/paths";
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms/client";
	import { allowedTransferClassifications, type TransferClassification } from "$lib/accounts/model";
	import { TRANSFER_CLASSIFICATION_LABELS } from "$lib/accounts/terms";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const { form, errors, enhance, submitting, message } = superForm(untrack(() => data.form));

	const sourceAccount = $derived(data.accounts.find((account) => account.id === $form.sourceAccountId));
	const destinationAccount = $derived(data.accounts.find((account) => account.id === $form.destinationAccountId));

	const allowedClassifications = $derived<TransferClassification[]>(
		sourceAccount && destinationAccount
			? allowedTransferClassifications(sourceAccount.classification, destinationAccount.classification)
			: ["unclassified", "pure"],
	);

	$effect(() => {
		if (!allowedClassifications.includes($form.classification as TransferClassification)) {
			$form.classification = "unclassified";
		}
	});

	const destinationOptions = $derived(data.accounts.filter((account) => account.id !== $form.sourceAccountId));

	const attributedMemberName = $derived.by(() => {
		if ($form.classification === "contribution") {
			return sourceAccount?.holders[0]?.displayName;
		}
		if ($form.classification === "distribution") {
			return destinationAccount?.holders[0]?.displayName;
		}
		return undefined;
	});
</script>

<svelte:head><title>Nueva transferencia | {site.title}</title></svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<header>
		<h1 class="text-2xl font-bold tracking-tight">Nueva transferencia</h1>
		<p class="text-sm text-[var(--color-text-soft)]">
			Mueve dinero entre cuentas del hogar. Una transferencia no es un gasto.
		</p>
	</header>

	{#if data.accounts.length < 2}
		<div class="alert alert-info" role="status">
			Necesitas al menos dos cuentas activas para registrar una transferencia.
			<a class="link" href={resolve("/cuentas/crear")}>Crea una cuenta</a>
		</div>
	{:else}
		<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
			<div class="card-body gap-4">
				<form method="POST" use:enhance class="flex flex-col gap-4">
					<label class="fieldset" for="sourceAccountId">
						<span class="fieldset-legend">Cuenta de origen</span>
						<select
							id="sourceAccountId"
							name="sourceAccountId"
							class="select min-h-12 w-full"
							bind:value={$form.sourceAccountId}
							required
						>
							<option value="" disabled>Selecciona el origen</option>
							{#each data.accounts as account (account.id)}
								<option value={account.id}>{account.name}</option>
							{/each}
						</select>
						{#if $errors.sourceAccountId}
							<p class="label text-error">{$errors.sourceAccountId}</p>
						{/if}
					</label>

					<label class="fieldset" for="destinationAccountId">
						<span class="fieldset-legend">Cuenta de destino</span>
						<select
							id="destinationAccountId"
							name="destinationAccountId"
							class="select min-h-12 w-full"
							bind:value={$form.destinationAccountId}
							required
						>
							<option value="" disabled>Selecciona el destino</option>
							{#each destinationOptions as account (account.id)}
								<option value={account.id}>{account.name}</option>
							{/each}
						</select>
						{#if $errors.destinationAccountId}
							<p class="label text-error">{$errors.destinationAccountId}</p>
						{/if}
					</label>

					<label class="fieldset" for="amount">
						<span class="fieldset-legend">Importe ({data.currency})</span>
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
						<span class="fieldset-legend">Fecha</span>
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

					<label class="fieldset" for="description">
						<span class="fieldset-legend">Descripción (opcional)</span>
						<input
							id="description"
							name="description"
							type="text"
							class="input min-h-12 w-full"
							bind:value={$form.description}
						/>
						{#if $errors.description}
							<p class="label text-error">{$errors.description}</p>
						{/if}
					</label>

					<label class="fieldset" for="classification">
						<span class="fieldset-legend">Clasificación</span>
						<select
							id="classification"
							name="classification"
							class="select min-h-12 w-full"
							bind:value={$form.classification}
						>
							{#each allowedClassifications as classification (classification)}
								<option value={classification}>{TRANSFER_CLASSIFICATION_LABELS[classification]}</option>
							{/each}
						</select>
						{#if $errors.classification}
							<p class="label text-error">{$errors.classification}</p>
						{/if}
					</label>

					{#if attributedMemberName}
						<div class="alert alert-info" role="status">
							{$form.classification === "contribution"
								? `La aportación se atribuirá íntegramente a ${attributedMemberName}.`
								: `La distribución se atribuirá íntegramente a ${attributedMemberName}.`}
						</div>
					{/if}

					{#if $message}
						<div class="alert alert-error" role="alert">{$message}</div>
					{/if}

					<div class="flex gap-2">
						<a class="btn min-h-12 flex-1" href={resolve("/cuentas")}>Cancelar</a>
						<button class="btn btn-primary min-h-12 flex-1" disabled={$submitting}>
							{$submitting ? "Guardando…" : "Registrar transferencia"}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
