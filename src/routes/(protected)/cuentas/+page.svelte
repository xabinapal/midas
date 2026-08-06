<script lang="ts">
	import { resolve } from "$app/paths";
	import AccountBalance from "$lib/components/account-balance.svelte";
	import EmptyState from "$lib/components/empty-state.svelte";
	import { formatMinorUnits } from "$lib/accounts/money";
	import { ACCOUNT_CLASSIFICATION_LABELS, ACCOUNT_STATUS_LABELS } from "$lib/accounts/terms";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Saldos | {site.title}</title></svelte:head>

<div class="space-y-6">
	<header class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Saldos</h1>
			<p class="text-sm text-[var(--color-text-soft)]">Cuentas del hogar y dinero aportado.</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<a class="btn min-h-12" href={resolve("/transferencias/nueva")}>Nueva transferencia</a>
			<a class="btn btn-primary min-h-12" href={resolve("/cuentas/crear")}>Nueva cuenta</a>
		</div>
	</header>

	{#if data.accounts.length === 0}
		<EmptyState
			title="Sin cuentas"
			description="Registra las cuentas personales y compartidas desde las que paga el hogar para seguir los saldos y las aportaciones."
		>
			{#snippet action()}
				<a class="btn btn-primary min-h-12" href={resolve("/cuentas/crear")}>Crear la primera cuenta</a>
			{/snippet}
		</EmptyState>
	{:else}
		<div
			class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)] bg-base-100"
		>
			{#each data.accounts as account (account.id)}
				<a class="flex items-center justify-between gap-4 p-4" href={resolve(`/cuentas/${account.id}`)}>
					<div class="min-w-0">
						<p class="font-semibold break-words">{account.name}</p>
						<p class="text-sm text-[var(--color-text-soft)]">
							{ACCOUNT_CLASSIFICATION_LABELS[account.classification]} · {ACCOUNT_STATUS_LABELS[account.status]}
							{#if account.holders.length > 0}
								· {account.holders.map((holder) => holder.displayName).join(", ")}
							{/if}
						</p>
					</div>
					<div class="shrink-0 text-right">
						{#if account.status === "draft"}
							<span class="badge badge-outline">Borrador · sin movimientos</span>
						{:else}
							<AccountBalance balance={account.balance} currency={data.currency} />
						{/if}
					</div>
				</a>
			{/each}
		</div>
	{/if}

	{#if data.pendingClassification.length > 0}
		<div class="alert alert-warning" role="alert">
			<span>
				{data.pendingClassification.length === 1
					? "Hay 1 transferencia sin clasificar: no cuenta como aportación ni distribución hasta que la clasifiques."
					: `Hay ${data.pendingClassification.length} transferencias sin clasificar: no cuentan como aportación ni distribución hasta que las clasifiques.`}
			</span>
		</div>
		<div
			class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)] bg-base-100"
		>
			{#each data.pendingClassification as pending (pending.id)}
				<div class="flex flex-wrap items-center justify-between gap-3 p-4">
					<div class="min-w-0">
						<p class="font-semibold break-words">
							{pending.description || "Transferencia"} · {formatMinorUnits(pending.amountMinor, data.currency)}
						</p>
						<p class="text-sm text-[var(--color-text-soft)]">
							{pending.sourceName} → {pending.destinationName}
						</p>
					</div>
					<a class="btn btn-ghost btn-sm min-h-11" href={resolve(`/transferencias/${pending.id}/clasificar`)}>
						Clasificar
					</a>
				</div>
			{/each}
		</div>
	{/if}

	{#if data.funding.length > 0}
		<section class="space-y-3">
			<h2 class="text-xl font-bold">Dinero aportado a cuentas compartidas</h2>
			<div class="grid gap-3 sm:grid-cols-2">
				{#each data.funding as totals (totals.memberId)}
					<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
						<div class="card-body gap-1">
							<h3 class="card-title text-lg">{totals.displayName}</h3>
							<data class="text-2xl font-bold tabular-nums" value={totals.netMinor / 100}>
								{formatMinorUnits(totals.netMinor, data.currency)}
							</data>
							<p class="text-sm text-[var(--color-text-soft)]">
								Aportado {formatMinorUnits(totals.contributionsMinor, data.currency)} · recibido {formatMinorUnits(
									totals.distributionsMinor,
									data.currency,
								)}
							</p>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
</div>
