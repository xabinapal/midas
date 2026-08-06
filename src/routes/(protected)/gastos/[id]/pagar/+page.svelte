<script lang="ts">
	import { resolve } from "$app/paths";
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms/client";
	import { formatMinorUnits } from "$lib/accounts/money";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const { form, errors, enhance, submitting, message } = superForm(untrack(() => data.form));

	const selectedAccount = $derived(data.accounts.find((account) => account.id === $form.accountId));
</script>

<svelte:head><title>Registrar pago | {site.title}</title></svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<header>
		<h1 class="text-2xl font-bold tracking-tight">Registrar pago</h1>
		<p class="text-sm text-[var(--color-text-soft)]">
			{data.expense.description} · Quedan por pagar {formatMinorUnits(data.unpaidMinor, data.currency)}
		</p>
	</header>

	{#if data.accounts.length === 0}
		<div class="alert alert-info" role="status">
			Necesitas una cuenta activa para registrar un pago.
			<a class="link" href={resolve("/cuentas/crear")}>Crea una cuenta</a>
		</div>
	{:else}
		<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
			<div class="card-body gap-4">
				<form method="POST" use:enhance class="flex flex-col gap-4">
					<label class="fieldset" for="accountId">
						<span class="fieldset-legend">Cuenta del pago</span>
						<select
							id="accountId"
							name="accountId"
							class="select min-h-12 w-full"
							bind:value={$form.accountId}
							required
						>
							<option value="" disabled>Selecciona la cuenta</option>
							{#each data.accounts as account (account.id)}
								<option value={account.id}>{account.name}</option>
							{/each}
						</select>
						{#if $errors.accountId}
							<p class="label text-error">{$errors.accountId}</p>
						{/if}
					</label>

					<label class="fieldset" for="amount">
						<span class="fieldset-legend">Importe del pago ({data.currency})</span>
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
						<span class="fieldset-legend">Concepto</span>
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

					<label class="fieldset" for="applicationAmount">
						<span class="fieldset-legend">Importe aplicado a este gasto ({data.currency})</span>
						<input
							id="applicationAmount"
							name="applicationAmount"
							type="text"
							inputmode="decimal"
							placeholder="0,00"
							class="input min-h-12 w-full"
							bind:value={$form.applicationAmount}
						/>
						<span class="label text-[var(--color-text-soft)]">
							Puede ser menor si parte del pago cubre otros gastos.
						</span>
						{#if $errors.applicationAmount}
							<p class="label text-error">{$errors.applicationAmount}</p>
						{/if}
					</label>

					{#if selectedAccount}
						<div class="alert alert-info" role="status">
							{selectedAccount.classification === "personal"
								? `El pago se atribuirá a ${selectedAccount.holders[0]?.displayName ?? ""}.`
								: "El pago se registrará con fondos comunes."}
						</div>
					{/if}

					{#if $message}
						<div class="alert alert-error" role="alert">{$message}</div>
					{/if}

					<div class="flex gap-2">
						<a class="btn min-h-12 flex-1" href={resolve(`/gastos/${data.expense.id}`)}>Cancelar</a>
						<button class="btn btn-primary min-h-12 flex-1" disabled={$submitting}>
							{$submitting ? "Registrando…" : "Registrar pago"}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
