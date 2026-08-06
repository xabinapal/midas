<script lang="ts">
	import { resolve } from "$app/paths";
	import AccountBalance from "$lib/components/account-balance.svelte";
	import ConfirmationDialog from "$lib/components/confirmation-dialog.svelte";
	import EmptyState from "$lib/components/empty-state.svelte";
	import { formatMinorUnits } from "$lib/accounts/money";
	import {
		ACCOUNT_CLASSIFICATION_LABELS,
		ACCOUNT_STATUS_LABELS,
		TRANSFER_CLASSIFICATION_LABELS,
		TRANSFER_STATUS_LABELS,
	} from "$lib/accounts/terms";
	import { formatDate } from "$lib/format/format";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();

	type PendingConfirmation =
		| { kind: "activate" }
		| { kind: "close" }
		| { kind: "reopen" }
		| { kind: "delete" }
		| { kind: "invalidate"; observationId: string };

	let pending = $state<PendingConfirmation | null>(null);
	let invalidateFormEl: HTMLFormElement | undefined = $state();
	let lifecycleFormEl: HTMLFormElement | undefined = $state();

	const confirmationText = $derived.by(() => {
		if (!pending) return null;
		switch (pending.kind) {
			case "activate":
				return {
					title: "Activar cuenta",
					description: "La cuenta podrá usarse para nuevas transferencias y observaciones de saldo.",
					confirmLabel: "Activar",
					action: "?/activate",
					tone: "primary" as const,
					recordName: data.account.name,
				};
			case "close":
				return {
					title: "Cerrar cuenta",
					description:
						"La cuenta dejará de aceptar nuevas transferencias, pero su historial se conservará y seguirá disponible para correcciones.",
					confirmLabel: "Cerrar cuenta",
					action: "?/close",
					tone: "error" as const,
					recordName: data.account.name,
				};
			case "reopen":
				return {
					title: "Reabrir cuenta",
					description: "La cuenta volverá a estar activa y la reapertura quedará registrada en la actividad del hogar.",
					confirmLabel: "Reabrir",
					action: "?/reopen",
					tone: "primary" as const,
					recordName: data.account.name,
				};
			case "delete":
				return {
					title: "Eliminar borrador",
					description: "El borrador se eliminará de forma permanente. Esta acción no se puede deshacer.",
					confirmLabel: "Eliminar",
					action: "?/deleteDraft",
					tone: "error" as const,
					recordName: data.account.name,
				};
			case "invalidate": {
				const observationId = pending.observationId;
				const item = data.history.find((entry) => entry.observationId === observationId);
				const amount = formatMinorUnits(item?.amountMinor ?? 0, data.currency);
				const date = item ? formatDate(item.effectiveAt) : "";
				return {
					title: "Invalidar observación",
					description:
						"La observación dejará de usarse para el saldo estimado, pero quedará conservada en el historial de la cuenta. Después puedes registrar una nueva observación.",
					confirmLabel: "Invalidar",
					action: "?/invalidateObservation",
					tone: "error" as const,
					recordName: `Observación de saldo · ${amount} · ${date}`,
				};
			}
		}
	});

	const reasonMessages: Record<string, string> = {
		conflict: "Otra operación está en curso. Inténtalo de nuevo.",
		account_not_found: "Cuenta no encontrada.",
		account_not_draft: "Solo las cuentas en borrador admiten esta acción.",
		account_not_closed: "Solo una cuenta cerrada puede reabrirse.",
		account_closed: "La cuenta ya está cerrada.",
		account_referenced: "La cuenta tiene movimientos registrados: ciérrala en lugar de eliminarla.",
		personal_account_requires_single_owner: "Una cuenta personal necesita exactamente un titular.",
		shared_account_requires_two_holders: "Una cuenta compartida necesita al menos dos titulares.",
		observation_not_found: "La observación ya no está disponible.",
	};

	function confirmPending() {
		if (!pending) return;
		if (pending.kind === "invalidate") {
			invalidateFormEl?.requestSubmit();
		} else {
			lifecycleFormEl?.requestSubmit();
		}
		pending = null;
	}
</script>

<svelte:head><title>{data.account.name} | {site.title}</title></svelte:head>

<div class="space-y-6">
	<header class="flex flex-wrap items-start justify-between gap-3">
		<div class="min-w-0">
			<p class="text-sm"><a class="link" href={resolve("/cuentas")}>← Saldos</a></p>
			<h1 class="text-2xl font-bold tracking-tight break-words sm:text-3xl">{data.account.name}</h1>
			<p class="text-sm text-[var(--color-text-soft)]">
				{ACCOUNT_CLASSIFICATION_LABELS[data.account.classification]} · {ACCOUNT_STATUS_LABELS[data.account.status]}
				{#if data.account.holders.length > 0}
					· {data.account.holders.map((holder) => holder.displayName).join(", ")}
				{/if}
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			{#if data.account.status === "draft"}
				<a class="btn min-h-12" href={resolve(`/cuentas/${data.account.id}/editar`)}>Editar</a>
				<button class="btn btn-primary min-h-12" onclick={() => (pending = { kind: "activate" })}>Activar</button>
				<button class="btn btn-error min-h-12" onclick={() => (pending = { kind: "delete" })}>Eliminar</button>
			{:else if data.account.status === "active"}
				<a class="btn min-h-12" href={resolve(`/cuentas/${data.account.id}/observar`)}>Observar saldo</a>
				<button class="btn btn-error min-h-12" onclick={() => (pending = { kind: "close" })}>Cerrar cuenta</button>
			{:else}
				<a class="btn min-h-12" href={resolve(`/cuentas/${data.account.id}/observar`)}>Observar saldo</a>
				<button class="btn min-h-12" onclick={() => (pending = { kind: "reopen" })}>Reabrir cuenta</button>
			{/if}
		</div>
	</header>

	{#if form?.success === false}
		<div class="alert alert-warning" role="alert">
			{reasonMessages[form.reason ?? ""] ?? "No se pudo completar la acción."}
		</div>
	{/if}

	{#if data.account.status === "closed"}
		<div class="alert alert-info" role="status">
			Cuenta cerrada: no acepta nuevas transferencias, pero su historial se conserva y admite correcciones y
			observaciones de saldo.
		</div>
	{/if}

	<section class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
		<div class="card-body gap-2">
			<h2 class="card-title text-lg">Saldo disponible</h2>
			<AccountBalance balance={data.balance} currency={data.currency} large />
		</div>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-bold">Historial</h2>
		{#if data.history.length === 0}
			<EmptyState
				title="Sin movimientos"
				description="Todavía no hay transferencias ni observaciones de saldo en esta cuenta."
			/>
		{:else}
			<div
				class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)] bg-base-100"
			>
				{#each data.history as item (item.id)}
					<div class="flex flex-wrap items-center justify-between gap-3 p-4">
						<div class="min-w-0">
							{#if item.kind === "observation"}
								<p class="font-semibold">
									Observación de saldo · {formatMinorUnits(item.amountMinor ?? 0, data.currency)}
									{#if item.observationStatus === "invalidated"}
										<span class="badge badge-sm badge-ghost">Invalidada</span>
									{/if}
								</p>
								<p class="text-sm text-[var(--color-text-soft)]">
									Observado el {formatDate(item.effectiveAt)} · registrado el {formatDate(item.recordedAt)}
									{#if item.replacesObservationId}
										· sustituye a una observación anterior
									{/if}
									{#if item.actorUsername}
										· por {item.actorUsername}{#if item.actorIsActive === false}
											<span class="text-[var(--color-text-muted)]">(inactivo)</span>
										{/if}
									{/if}
								</p>
							{:else}
								<p class="font-semibold break-words">
									{item.description || TRANSFER_CLASSIFICATION_LABELS[item.classification ?? "unclassified"]}
									<span class="badge badge-sm badge-outline"
										>{TRANSFER_CLASSIFICATION_LABELS[item.classification ?? "unclassified"]}</span
									>
									{#if item.transferStatus === "reversed"}
										<span class="badge badge-sm badge-ghost">{TRANSFER_STATUS_LABELS.reversed}</span>
									{/if}
									{#if item.reversalOfId}
										<span class="badge badge-sm badge-ghost">Reversión</span>
									{/if}
									{#if item.replacesId}
										<span class="badge badge-sm badge-ghost">Sustitución</span>
									{/if}
								</p>
								<p class="text-sm text-[var(--color-text-soft)]">
									{item.direction === "out" ? "Hacia" : "Desde"}
									{item.counterpartName} · {formatDate(item.effectiveAt)}
									{#if item.actorUsername}
										· por {item.actorUsername}{#if item.actorIsActive === false}
											<span class="text-[var(--color-text-muted)]">(inactivo)</span>
										{/if}
									{/if}
								</p>
							{/if}
						</div>
						<div class="flex shrink-0 items-center gap-2">
							{#if item.kind === "transfer"}
								<data
									class="font-bold tabular-nums"
									class:text-success={item.direction === "in" && item.transferStatus !== "reversed"}
									value={(item.amountMinor ?? 0) / 100}
								>
									{item.direction === "in" ? "+" : "−"}{formatMinorUnits(
										Math.abs(item.amountMinor ?? 0),
										data.currency,
									)}
								</data>
								{#if data.account.status !== "closed" || item.transferStatus === "posted"}
									{#if item.transferStatus === "posted" && !item.reversedById && !item.reversalOfId}
										{#if item.classification === "unclassified"}
											<a
												class="btn btn-ghost btn-sm min-h-11"
												href={resolve(`/transferencias/${item.transferId}/clasificar`)}
											>
												Clasificar
											</a>
										{/if}
										<a
											class="btn btn-ghost btn-sm min-h-11"
											href={resolve(`/transferencias/${item.transferId}/corregir`)}
										>
											Corregir
										</a>
									{/if}
								{/if}
							{:else if item.observationStatus === "valid"}
								<button
									class="btn btn-ghost btn-sm min-h-11"
									onclick={() => (pending = { kind: "invalidate", observationId: item.observationId ?? "" })}
								>
									Invalidar
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

<form bind:this={lifecycleFormEl} method="POST" action={confirmationText?.action ?? ""} class="hidden"></form>
<form bind:this={invalidateFormEl} method="POST" action="?/invalidateObservation" class="hidden">
	<input type="hidden" name="observationId" value={pending?.kind === "invalidate" ? pending.observationId : ""} />
</form>

{#if confirmationText}
	<ConfirmationDialog
		open={pending !== null}
		title={confirmationText.title}
		recordName={confirmationText.recordName}
		description={confirmationText.description}
		confirmLabel={confirmationText.confirmLabel}
		tone={confirmationText.tone}
		onconfirm={confirmPending}
		oncancel={() => (pending = null)}
	/>
{/if}
