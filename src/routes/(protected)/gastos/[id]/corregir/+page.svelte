<script lang="ts">
	import { resolve } from "$app/paths";
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms/client";
	import ConfirmationDialog from "$lib/components/confirmation-dialog.svelte";
	import { formatMinorUnits, parseAmountToMinorUnits } from "$lib/accounts/money";
	import {
		resolveAllocations,
		scaleFixedSelections,
		selectionFromParams,
		type AllocationLine,
	} from "$lib/expenses/allocation";
	import { ALLOCATION_METHOD_LABELS } from "$lib/expenses/terms";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const { form, errors, enhance, submitting, message } = superForm(untrack(() => data.form));

	let confirming = $state(false);
	let formEl: HTMLFormElement | undefined = $state();

	const memberNameById = $derived(
		new Map([...data.members, ...data.storedInactiveMembers].map((member) => [member.id, member.displayName])),
	);
	const defaultWeightByMember = $derived(new Map(data.members.map((member) => [member.id, member.defaultWeight])));

	type AllocationPreview = { kind: "idle" } | { kind: "lines"; lines: AllocationLine[] } | { kind: "error" };

	// The corrected amount re-resolves the reparto live: fixed splits scale
	// proportionally (old amounts act as weights), every other method simply
	// re-resolves against the new total.
	const correctedPreview = $derived.by<AllocationPreview>(() => {
		if ($form.mode !== "replace") return { kind: "idle" };
		const amountMinor = parseAmountToMinorUnits($form.amount ?? "", data.currency);
		if (amountMinor === null || amountMinor <= 0) return { kind: "idle" };
		const method = data.expense.allocationMethod;
		try {
			if (method === "fixed") {
				return {
					kind: "lines",
					lines: scaleFixedSelections(data.allocationParams, amountMinor).map((selection) => ({
						memberId: selection.memberId,
						amountMinor: selection.fixedAmountMinor ?? 0,
					})),
				};
			}
			const selections = selectionFromParams(method, data.allocationParams, defaultWeightByMember);
			return { kind: "lines", lines: resolveAllocations(method, amountMinor, selections) };
		} catch {
			return { kind: "error" };
		}
	});

	const confirmation = $derived.by(() => {
		const recordBase = `«${data.expense.description}» · ${formatMinorUnits(data.applicableMinor, data.currency)}`;
		if ($form.mode === "replace") {
			const parsed = parseAmountToMinorUnits($form.amount ?? "", data.currency);
			const correctedAmount =
				parsed !== null && parsed > 0
					? formatMinorUnits(parsed, data.currency)
					: formatMinorUnits(data.applicableMinor, data.currency);
			return {
				title: "Revertir y registrar la corrección",
				recordName: `${recordBase} · corrección: ${correctedAmount}`,
				description:
					"El gasto original quedará revertido y visible en el historial; sus pagos aplicados se desharán y se registrará el gasto corregido con la misma referencia.",
				confirmLabel: "Confirmar corrección",
			};
		}
		return {
			title: "Revertir gasto",
			recordName: recordBase,
			description: "El gasto original quedará revertido y visible en el historial; sus pagos aplicados se desharán.",
			confirmLabel: "Confirmar reversión",
		};
	});
</script>

<svelte:head><title>Corregir gasto | {site.title}</title></svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<header>
		<h1 class="text-2xl font-bold tracking-tight break-words">Corregir «{data.expense.description}»</h1>
		<p class="text-sm text-[var(--color-text-soft)]">
			{#if data.expense.reference}{data.expense.reference} ·
			{/if}{formatMinorUnits(data.applicableMinor, data.currency)}
		</p>
	</header>

	<div class="alert alert-warning" role="status">
		El gasto original quedará revertido y visible en el historial; sus pagos aplicados se desharán. El pago registrado
		seguirá existiendo con el importe sin aplicar; la cuenta no se devuelve. Podrás volver a aplicarlo desde el detalle
		del pago.
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
								El gasto queda anulado por completo, sin sustitución.
							</span>
						</span>
					</label>
					<label class="label cursor-pointer justify-start gap-3 whitespace-normal">
						<input type="radio" name="mode" value="replace" class="radio shrink-0" bind:group={$form.mode} />
						<span class="whitespace-normal">
							<strong>Revertir y registrar la corrección</strong>
							<span class="block text-sm text-[var(--color-text-soft)]">
								Se anula el original y se registra una versión corregida con la misma referencia.
							</span>
						</span>
					</label>
					{#if $errors.mode}
						<p class="label text-error">{$errors.mode}</p>
					{/if}
				</fieldset>

				{#if $form.mode === "replace"}
					<label class="fieldset" for="amount">
						<span class="fieldset-legend">Importe corregido ({data.currency})</span>
						<input
							id="amount"
							name="amount"
							type="text"
							inputmode="decimal"
							placeholder="0,00"
							class="input min-h-12 w-full"
							bind:value={$form.amount}
						/>
						{#if $errors.amount}
							<p class="label text-error">{$errors.amount}</p>
						{/if}
					</label>

					<label class="fieldset" for="description">
						<span class="fieldset-legend">Descripción corregida (opcional)</span>
						<input
							id="description"
							name="description"
							type="text"
							class="input min-h-12 w-full"
							bind:value={$form.description}
							placeholder={data.expense.description}
						/>
						{#if $errors.description}
							<p class="label text-error">{$errors.description}</p>
						{/if}
					</label>

					{#if correctedPreview.kind === "error"}
						<div class="rounded-box border border-[var(--color-border)] bg-base-200 p-4" role="status">
							<p class="text-sm text-error">Revisa los valores del reparto.</p>
						</div>
					{:else if correctedPreview.kind === "lines"}
						<div class="rounded-box border border-[var(--color-border)] bg-base-200 p-4" aria-live="polite">
							<p class="text-sm font-semibold">
								Reparto · {ALLOCATION_METHOD_LABELS[data.expense.allocationMethod]}
							</p>
							{#if data.expense.allocationMethod === "fixed"}
								<p class="mt-1 text-sm text-[var(--color-text-soft)]">
									El reparto fijo se escala proporcionalmente al nuevo importe.
								</p>
							{/if}
							<ul class="mt-2 space-y-1">
								{#each correctedPreview.lines as line (line.memberId)}
									<li class="flex items-center justify-between gap-2 text-sm">
										<span>{memberNameById.get(line.memberId) ?? line.memberId}</span>
										<data class="tabular-nums" value={line.amountMinor / 100}>
											{formatMinorUnits(line.amountMinor, data.currency)}
										</data>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				{/if}

				{#if $message}
					<div class="alert alert-error" role="alert">{$message}</div>
				{/if}

				<div class="flex flex-col gap-2 sm:flex-row">
					<a class="btn min-h-12 flex-1 whitespace-normal" href={resolve(`/gastos/${data.expense.id}`)}>Cancelar</a>
					<button
						class="btn btn-error min-h-12 flex-1 whitespace-normal"
						type="button"
						disabled={$submitting}
						onclick={() => (confirming = true)}
					>
						{$form.mode === "replace" ? "Revertir y registrar la corrección" : "Revertir gasto"}
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
