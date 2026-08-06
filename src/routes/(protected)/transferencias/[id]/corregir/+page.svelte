<script lang="ts">
	import { resolve } from "$app/paths";
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms/client";
	import ConfirmationDialog from "$lib/components/confirmation-dialog.svelte";
	import { formatMinorUnits } from "$lib/accounts/money";
	import { TRANSFER_CLASSIFICATION_LABELS } from "$lib/accounts/terms";
	import { formatDate } from "$lib/format/format";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const { form, errors, enhance, submitting, message } = superForm(untrack(() => data.form));

	let confirming = $state(false);
	let formEl: HTMLFormElement | undefined = $state();

	const attributedMember = $derived(
		data.personalAccounts.find((account) => account.id === $form.fundingAccountId)?.holders[0]?.displayName ??
			data.attributedMemberName ??
			"",
	);

	const confirmation = $derived.by(() => {
		if ($form.mode === "replace") {
			const correctedAmount = $form.amount?.trim() ? $form.amount : "?";
			return {
				title: "Revertir y sustituir",
				recordName: `Original: ${formatMinorUnits(data.transfer.amountMinor, data.source.currency)} · sustitución: ${correctedAmount} € (${$form.effectiveDate})`,
				description:
					"La original permanecerá en el historial, se registrará una reversión y se registrará la transferencia de sustitución con los datos corregidos.",
				confirmLabel: "Confirmar sustitución",
			};
		}
		return {
			title: "Revertir transferencia",
			recordName: `${formatMinorUnits(data.transfer.amountMinor, data.source.currency)} · ${data.source.name} → ${data.destination.name}`,
			description:
				"La original permanecerá en el historial y la reversión quedará registrada con tu usuario y la hora actual.",
			confirmLabel: "Confirmar reversión",
		};
	});
</script>

<svelte:head><title>Corregir transferencia | {site.title}</title></svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<header>
		<h1 class="text-2xl font-bold tracking-tight">Corregir transferencia</h1>
		<p class="text-sm text-[var(--color-text-soft)]">
			{TRANSFER_CLASSIFICATION_LABELS[data.transfer.classification]} · {formatMinorUnits(
				data.transfer.amountMinor,
				data.source.currency,
			)} · {data.source.name} → {data.destination.name} · {formatDate(data.transfer.effectiveAt)}
			{#if data.attributedMemberName}
				· atribuida a {data.attributedMemberName}
			{/if}
		</p>
	</header>

	<div class="alert alert-info" role="status">
		La transferencia original se conservará en el historial. La corrección registrará una reversión y, si la indicas,
		una transferencia de sustitución.
	</div>

	<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
		<div class="card-body gap-4">
			<form bind:this={formEl} method="POST" use:enhance class="flex flex-col gap-4">
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Tipo de corrección</legend>
					<label class="label cursor-pointer justify-start gap-3 whitespace-normal">
						<input type="radio" name="mode" value="reverse" class="radio shrink-0" bind:group={$form.mode} />
						<span class="whitespace-normal">
							<strong>Solo revertir</strong>
							<span class="block text-sm text-[var(--color-text-soft)]">
								El movimiento queda anulado por completo.
							</span>
						</span>
					</label>
					<label class="label cursor-pointer justify-start gap-3 whitespace-normal">
						<input type="radio" name="mode" value="replace" class="radio shrink-0" bind:group={$form.mode} />
						<span class="whitespace-normal">
							<strong>Revertir y sustituir</strong>
							<span class="block text-sm text-[var(--color-text-soft)]">
								Se anula el original y se registra una versión corregida.
							</span>
						</span>
					</label>
					{#if $errors.mode}
						<p class="label text-error">{$errors.mode}</p>
					{/if}
				</fieldset>

				{#if $form.mode === "replace"}
					<label class="fieldset" for="amount">
						<span class="fieldset-legend">Importe corregido ({data.source.currency})</span>
						<input
							id="amount"
							name="amount"
							type="text"
							inputmode="decimal"
							class="input min-h-12 w-full"
							bind:value={$form.amount}
						/>
						{#if $errors.amount}
							<p class="label text-error">{$errors.amount}</p>
						{/if}
					</label>

					<label class="fieldset" for="effectiveDate">
						<span class="fieldset-legend">Fecha corregida</span>
						<input
							id="effectiveDate"
							name="effectiveDate"
							type="date"
							class="input min-h-12 w-full"
							bind:value={$form.effectiveDate}
						/>
						{#if $errors.effectiveDate}
							<p class="label text-error">{$errors.effectiveDate}</p>
						{/if}
					</label>

					<label class="fieldset" for="description">
						<span class="fieldset-legend">Descripción corregida</span>
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

					{#if data.funded}
						<label class="fieldset" for="fundingAccountId">
							<span class="fieldset-legend">
								{data.transfer.classification === "contribution"
									? "Cuenta personal de origen corregida"
									: "Cuenta personal de destino corregida"}
							</span>
							<select
								id="fundingAccountId"
								name="fundingAccountId"
								class="select min-h-12 w-full"
								bind:value={$form.fundingAccountId}
							>
								{#each data.personalAccounts as account (account.id)}
									<option value={account.id}>{account.name}</option>
								{/each}
							</select>
							{#if $errors.fundingAccountId}
								<p class="label text-error">{$errors.fundingAccountId}</p>
							{/if}
						</label>

						<div class="alert alert-info" role="status">
							La sustitución se atribuirá íntegramente a {attributedMember}.
						</div>
					{/if}
				{/if}

				{#if $message}
					<div class="alert alert-error" role="alert">{$message}</div>
				{/if}

				<div class="flex flex-col gap-2 sm:flex-row">
					<a class="btn min-h-12 flex-1 whitespace-normal" href={resolve(`/cuentas/${data.source.id}`)}>Cancelar</a>
					<button
						class="btn btn-error min-h-12 flex-1 whitespace-normal"
						type="button"
						disabled={$submitting}
						onclick={() => (confirming = true)}
					>
						{$form.mode === "replace" ? "Revertir y sustituir" : "Revertir transferencia"}
					</button>
				</div>
			</form>
		</div>
	</div>
</div>

<ConfirmationDialog
	open={confirming}
	title={confirmation.title}
	recordName={confirmation.recordName}
	description={confirmation.description}
	confirmLabel={confirmation.confirmLabel}
	tone="error"
	onconfirm={() => {
		confirming = false;
		formEl?.requestSubmit();
	}}
	oncancel={() => (confirming = false)}
/>
