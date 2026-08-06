<script lang="ts">
	import { resolve } from "$app/paths";
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms/client";
	import { formatMinorUnits, parseAmountToMinorUnits } from "$lib/accounts/money";
	import { resolveAllocations, selectionFromParams, type AllocationLine } from "$lib/expenses/allocation";
	import { ALLOCATION_METHOD_LABELS } from "$lib/expenses/terms";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const { form, errors, enhance, submitting, message } = superForm(untrack(() => data.form));

	const memberNameById = $derived(new Map(data.members.map((member) => [member.id, member.displayName])));
	const defaultWeightByMember = $derived(new Map(data.members.map((member) => [member.id, member.defaultWeight])));

	type AllocationPreview =
		{ kind: "idle" } | { kind: "lines"; lines: AllocationLine[] } | { kind: "error"; text: string };

	const allocationErrorTexts: Record<string, string> = {
		allocation_percentages_unbalanced: "Los porcentajes deben sumar 100%.",
		allocation_weights_unbalanced: "Los pesos deben sumar más que cero.",
		allocation_fixed_unbalanced: "Los importes fijos deben sumar el total del gasto.",
	};

	// The reparto of the actual amount is recalculated live from the stored
	// allocation params, mirroring what the server resolves on confirm.
	const actualPreview = $derived.by<AllocationPreview>(() => {
		const amountMinor = parseAmountToMinorUnits($form.amount ?? "", data.currency);
		if (amountMinor === null || amountMinor <= 0) return { kind: "idle" };
		try {
			const selections = selectionFromParams(data.allocationMethod, data.allocationParams, defaultWeightByMember);
			return { kind: "lines", lines: resolveAllocations(data.allocationMethod, amountMinor, selections) };
		} catch (error) {
			const code = error instanceof Error ? error.message : "";
			return { kind: "error", text: allocationErrorTexts[code] ?? "Revisa los valores del reparto." };
		}
	});
</script>

<svelte:head><title>Confirmar importe real | {site.title}</title></svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<header>
		<h1 class="text-2xl font-bold tracking-tight">Confirmar importe real</h1>
		<p class="text-sm text-[var(--color-text-soft)]">{data.expense.description}</p>
	</header>

	<div class="alert alert-info" role="status">
		El importe previsto queda guardado como referencia para comparar; esta acción no se puede deshacer.
	</div>

	<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
		<div class="card-body gap-4">
			<dl class="space-y-1 text-sm">
				<div class="flex justify-between gap-4">
					<dt class="text-[var(--color-text-soft)]">Importe previsto</dt>
					<dd class="font-semibold tabular-nums">{formatMinorUnits(data.plannedAmountMinor, data.currency)}</dd>
				</div>
			</dl>

			{#if data.plannedLines.length > 0}
				<div
					class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)]"
				>
					{#each data.plannedLines as line (line.memberId)}
						<div class="flex items-center justify-between gap-3 p-3">
							<span class="text-sm">{line.memberName}</span>
							<data class="text-sm tabular-nums" value={line.amountMinor / 100}>
								{formatMinorUnits(line.amountMinor, data.currency)}
							</data>
						</div>
					{/each}
				</div>
			{/if}

			<form method="POST" use:enhance class="flex flex-col gap-4">
				<label class="fieldset" for="amount">
					<span class="fieldset-legend">Importe real ({data.currency})</span>
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

				{#if actualPreview.kind === "error"}
					<div class="rounded-box border border-[var(--color-border)] bg-base-200 p-4" role="status">
						<p class="text-sm text-error">{actualPreview.text}</p>
					</div>
				{:else if actualPreview.kind === "lines"}
					<div class="rounded-box border border-[var(--color-border)] bg-base-200 p-4" aria-live="polite">
						<p class="text-sm font-semibold">Reparto · {ALLOCATION_METHOD_LABELS[data.allocationMethod]}</p>
						<ul class="mt-2 space-y-1">
							{#each actualPreview.lines as line (line.memberId)}
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

				{#if $message}
					<div class="alert alert-error" role="alert">{$message}</div>
				{/if}

				<div class="flex gap-2">
					<a class="btn min-h-12 flex-1" href={resolve(`/gastos/${data.expense.id}`)}>Cancelar</a>
					<button class="btn btn-primary min-h-12 flex-1" disabled={$submitting}>
						{$submitting ? "Confirmando…" : "Confirmar importe real"}
					</button>
				</div>
			</form>
		</div>
	</div>
</div>
