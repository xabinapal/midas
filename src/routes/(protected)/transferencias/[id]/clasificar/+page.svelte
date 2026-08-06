<script lang="ts">
	import { resolve } from "$app/paths";
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms/client";
	import { formatMinorUnits } from "$lib/accounts/money";
	import { TRANSFER_CLASSIFICATION_LABELS } from "$lib/accounts/terms";
	import { formatDate } from "$lib/format/format";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const { form, errors, enhance, submitting, message } = superForm(untrack(() => data.form));

	const classificationDescriptions = $derived.by<Record<string, string>>(() => ({
		pure: "Un movimiento interno que no cambia el dinero aportado por nadie.",
		contribution: `Dinero aportado al hogar${data.attributedMemberName ? ` por ${data.attributedMemberName}` : ""}.`,
		distribution: `Dinero devuelto del hogar${data.attributedMemberName ? ` a ${data.attributedMemberName}` : ""}.`,
	}));
</script>

<svelte:head><title>Clasificar transferencia | {site.title}</title></svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<header>
		<h1 class="text-2xl font-bold tracking-tight">Clasificar transferencia</h1>
		<p class="text-sm text-[var(--color-text-soft)]">
			{formatMinorUnits(data.transfer.amountMinor, data.source.currency)} · {data.source.name} → {data.destination.name} ·
			{formatDate(data.transfer.effectiveAt)}
		</p>
	</header>

	<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
		<div class="card-body gap-4">
			<form method="POST" use:enhance class="flex flex-col gap-4">
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Clasificación definitiva</legend>
					{#each data.allowed as classification (classification)}
						<label class="label cursor-pointer justify-start gap-3 whitespace-normal">
							<input
								type="radio"
								name="classification"
								value={classification}
								class="radio shrink-0"
								bind:group={$form.classification}
								required
							/>
							<span class="whitespace-normal">
								<strong>{TRANSFER_CLASSIFICATION_LABELS[classification]}</strong>
								<span class="block text-sm text-[var(--color-text-soft)]">
									{classificationDescriptions[classification]}
								</span>
							</span>
						</label>
					{/each}
					{#if $errors.classification}
						<p class="label text-error">{$errors.classification}</p>
					{/if}
				</fieldset>

				{#if data.attributedMemberName && ($form.classification === "contribution" || $form.classification === "distribution")}
					<div class="alert alert-info" role="status">
						Se atribuirá íntegramente a {data.attributedMemberName}. La clasificación no se puede cambiar después.
					</div>
				{/if}

				{#if $message}
					<div class="alert alert-error" role="alert">{$message}</div>
				{/if}

				<div class="flex gap-2">
					<a class="btn min-h-12 flex-1" href={resolve(`/cuentas/${data.source.id}`)}>Cancelar</a>
					<button class="btn btn-primary min-h-12 flex-1" disabled={$submitting}>
						{$submitting ? "Guardando…" : "Confirmar clasificación"}
					</button>
				</div>
			</form>
		</div>
	</div>
</div>
