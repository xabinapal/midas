<script lang="ts">
	import { resolve } from "$app/paths";
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms/client";
	import ConfirmationDialog from "$lib/components/confirmation-dialog.svelte";
	import FinancialStatus from "$lib/components/financial-status.svelte";
	import { formatMinorUnits, parseAmountToMinorUnits } from "$lib/accounts/money";
	import { FUNDING_SOURCE_LABELS } from "$lib/expenses/terms";
	import { formatDate } from "$lib/format/format";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();

	const {
		form: applyForm,
		errors: applyErrors,
		enhance: applyEnhance,
		submitting: applySubmitting,
		message: applyMessage,
	} = superForm(untrack(() => data.applyForm));

	const {
		form: correctForm,
		errors: correctErrors,
		enhance: correctEnhance,
		submitting: correctSubmitting,
		message: correctMessage,
	} = superForm(untrack(() => data.correctForm));

	let reversingApplicationId = $state<string | null>(null);
	let reverseFormEl: HTMLFormElement | undefined = $state();
	let confirmingCorrection = $state(false);
	let correctFormEl: HTMLFormElement | undefined = $state();

	const posted = $derived(data.payment.status === "posted");

	const reversingApplication = $derived(
		data.applications.find((application) => application.applicationId === reversingApplicationId) ?? null,
	);

	const reasonMessages: Record<string, string> = {
		conflict: "Otra operación está en curso. Inténtalo de nuevo.",
		application_not_found: "La aplicación ya no está disponible.",
		payment_not_posted: "El pago está revertido.",
		payment_not_found: "Pago no encontrado.",
	};

	const correctionConfirmation = $derived.by(() => {
		if ($correctForm.mode === "replace") {
			const parsed = parseAmountToMinorUnits($correctForm.amount ?? "", data.currency);
			const correctedAmount =
				parsed !== null && parsed > 0
					? formatMinorUnits(parsed, data.currency)
					: formatMinorUnits(data.payment.amountMinor, data.currency);
			return {
				title: "Revertir y sustituir",
				recordName: `Original: ${formatMinorUnits(data.payment.amountMinor, data.currency)} · sustitución: ${correctedAmount}`,
				description:
					"El pago original quedará revertido; sus aplicaciones se desharán y se registrará el pago corregido.",
				confirmLabel: "Confirmar sustitución",
			};
		}
		return {
			title: "Revertir pago",
			recordName: `${formatMinorUnits(data.payment.amountMinor, data.currency)} · ${data.payment.description}`,
			description: "El pago original quedará revertido; sus aplicaciones se desharán y el dinero volverá a la cuenta.",
			confirmLabel: "Confirmar reversión",
		};
	});
</script>

<svelte:head><title>{data.payment.description} | {site.title}</title></svelte:head>

<div class="space-y-6">
	<header class="space-y-1">
		<p class="text-sm"><a class="link" href={resolve("/gastos")}>← Gastos</a></p>
		<div class="flex flex-wrap items-center gap-2">
			<h1 class="text-2xl font-bold tracking-tight break-words sm:text-3xl">{data.payment.description}</h1>
			<span class="badge badge-outline">Pago</span>
			{#if !posted}
				<FinancialStatus status="reversed" />
			{/if}
		</div>
		<p class="text-sm text-[var(--color-text-soft)]">
			{data.accountName} · {FUNDING_SOURCE_LABELS[data.payment.fundingSource]}{#if data.funderMemberName}
				· {data.funderMemberName}{/if}
			· {formatDate(data.payment.effectiveAt)} · registrado el {formatDate(data.payment.recordedAt)}
		</p>
	</header>

	{#if form && "success" in form && form.success === false}
		<div class="alert alert-warning" role="alert">
			{reasonMessages[form.reason ?? ""] ?? "No se pudo completar la acción."}
		</div>
	{/if}

	<section class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
		<div class="card-body gap-2">
			<h2 class="card-title text-lg">Importe del pago</h2>
			<data class="text-2xl font-bold tabular-nums" value={data.payment.amountMinor / 100}>
				{formatMinorUnits(data.payment.amountMinor, data.currency)}
			</data>
			{#if posted}
				<p class="text-sm text-[var(--color-text-soft)]">
					Sin aplicar:
					<data class="font-bold tabular-nums" value={data.unappliedMinor / 100}>
						{formatMinorUnits(data.unappliedMinor, data.currency)}
					</data>
				</p>
			{/if}
		</div>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-bold">Aplicado a gastos</h2>
		{#if data.applications.length === 0}
			{#if posted}
				<p class="text-[var(--color-text-soft)]">Este pago todavía no está aplicado a ningún gasto.</p>
			{:else}
				<p class="text-[var(--color-text-soft)]">Pago revertido; sus aplicaciones quedaron deshechas.</p>
			{/if}
		{:else}
			<div
				class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)] bg-base-100"
			>
				{#each data.applications as application (application.applicationId)}
					<div class="flex flex-wrap items-center justify-between gap-3 p-4">
						<div class="min-w-0">
							<a class="link font-semibold break-words" href={resolve(`/gastos/${application.expenseId}`)}>
								{application.expenseDescription}
							</a>
							{#if application.expenseReference}
								<p class="text-sm text-[var(--color-text-soft)]">{application.expenseReference}</p>
							{/if}
						</div>
						<div class="flex shrink-0 items-center gap-2">
							<data class="font-bold tabular-nums" value={application.amountMinor / 100}>
								{formatMinorUnits(application.amountMinor, data.currency)}
							</data>
							{#if posted}
								<button
									class="btn btn-ghost btn-sm min-h-11"
									onclick={() => (reversingApplicationId = application.applicationId)}
								>
									Revertir
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	{#if posted && data.unappliedMinor > 0 && data.candidates.length > 0}
		<section class="space-y-3">
			<h2 class="text-xl font-bold">Aplicar a gastos</h2>
			<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
				<div class="card-body gap-4">
					<form method="POST" action="?/apply" use:applyEnhance class="flex flex-col gap-4">
						<label class="fieldset" for="expenseId">
							<span class="fieldset-legend">Gasto</span>
							<select
								id="expenseId"
								name="expenseId"
								class="select min-h-12 w-full"
								bind:value={$applyForm.expenseId}
								required
							>
								<option value="" disabled>Selecciona un gasto</option>
								{#each data.candidates as candidate (candidate.id)}
									<option value={candidate.id}>
										{candidate.description}{candidate.reference ? ` · ${candidate.reference}` : ""} · quedan {formatMinorUnits(
											candidate.unpaidMinor,
											data.currency,
										)}
									</option>
								{/each}
							</select>
							{#if $applyErrors.expenseId}
								<p class="label text-error">{$applyErrors.expenseId}</p>
							{/if}
						</label>

						<label class="fieldset" for="amount">
							<span class="fieldset-legend">Importe a aplicar ({data.currency})</span>
							<input
								id="amount"
								name="amount"
								type="text"
								inputmode="decimal"
								placeholder="0,00"
								class="input min-h-12 w-full"
								bind:value={$applyForm.amount}
								required
							/>
							{#if $applyErrors.amount}
								<p class="label text-error">{$applyErrors.amount}</p>
							{/if}
						</label>

						{#if $applyMessage}
							<div class="alert alert-error" role="alert">{$applyMessage}</div>
						{/if}

						<button class="btn btn-primary min-h-12" disabled={$applySubmitting}>
							{$applySubmitting ? "Guardando…" : "Aplicar pago"}
						</button>
					</form>
				</div>
			</div>
		</section>
	{/if}

	{#if posted}
		<section class="space-y-3">
			<h2 class="text-xl font-bold">Corrección</h2>
			<div class="alert alert-info" role="status">
				El pago original quedará revertido; sus aplicaciones se desharán y el dinero volverá a la cuenta.
			</div>
			<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
				<div class="card-body gap-4">
					<form
						bind:this={correctFormEl}
						method="POST"
						action="?/correct"
						use:correctEnhance
						class="flex flex-col gap-4"
					>
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Tipo de corrección</legend>
							<label class="label cursor-pointer justify-start gap-3 whitespace-normal">
								<input type="radio" name="mode" value="reverse" class="radio shrink-0" bind:group={$correctForm.mode} />
								<span class="whitespace-normal">
									<strong>Solo revertir</strong>
									<span class="block text-sm text-[var(--color-text-soft)]">El pago queda anulado por completo.</span>
								</span>
							</label>
							<label class="label cursor-pointer justify-start gap-3 whitespace-normal">
								<input type="radio" name="mode" value="replace" class="radio shrink-0" bind:group={$correctForm.mode} />
								<span class="whitespace-normal">
									<strong>Revertir y sustituir</strong>
									<span class="block text-sm text-[var(--color-text-soft)]">
										Se anula el original y se registra un pago corregido.
									</span>
								</span>
							</label>
							{#if $correctErrors.mode}
								<p class="label text-error">{$correctErrors.mode}</p>
							{/if}
						</fieldset>

						{#if $correctForm.mode === "replace"}
							<label class="fieldset" for="correctAccount">
								<span class="fieldset-legend">Cuenta del pago</span>
								<select
									id="correctAccount"
									name="accountId"
									class="select min-h-12 w-full"
									bind:value={$correctForm.accountId}
								>
									{#each data.accounts as account (account.id)}
										<option value={account.id}>{account.name}</option>
									{/each}
								</select>
								{#if $correctErrors.accountId}
									<p class="label text-error">{$correctErrors.accountId}</p>
								{/if}
							</label>

							<label class="fieldset" for="correctEffectiveDate">
								<span class="fieldset-legend">Fecha del pago</span>
								<input
									id="correctEffectiveDate"
									name="effectiveDate"
									type="date"
									class="input min-h-12 w-full"
									bind:value={$correctForm.effectiveDate}
								/>
								{#if $correctErrors.effectiveDate}
									<p class="label text-error">{$correctErrors.effectiveDate}</p>
								{/if}
							</label>

							<label class="fieldset" for="correctAmount">
								<span class="fieldset-legend">Importe corregido ({data.currency})</span>
								<input
									id="correctAmount"
									name="amount"
									type="text"
									inputmode="decimal"
									class="input min-h-12 w-full"
									bind:value={$correctForm.amount}
								/>
								{#if $correctErrors.amount}
									<p class="label text-error">{$correctErrors.amount}</p>
								{/if}
							</label>

							<label class="fieldset" for="correctDescription">
								<span class="fieldset-legend">Descripción corregida (opcional)</span>
								<input
									id="correctDescription"
									name="description"
									type="text"
									class="input min-h-12 w-full"
									placeholder={data.payment.description}
									bind:value={$correctForm.description}
								/>
								{#if $correctErrors.description}
									<p class="label text-error">{$correctErrors.description}</p>
								{/if}
							</label>
						{/if}

						{#if $correctMessage}
							<div class="alert alert-error" role="alert">{$correctMessage}</div>
						{/if}

						<button
							class="btn btn-error min-h-12 whitespace-normal"
							type="button"
							disabled={$correctSubmitting}
							onclick={() => (confirmingCorrection = true)}
						>
							{$correctForm.mode === "replace" ? "Revertir y sustituir" : "Revertir pago"}
						</button>
					</form>
				</div>
			</div>
		</section>
	{/if}

	{#if data.chain.length > 0}
		<section class="space-y-3">
			<h2 class="text-xl font-bold">Cadena de correcciones</h2>
			<div
				class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)] bg-base-100"
			>
				{#each data.chain as sibling (sibling.id)}
					<div class="flex flex-wrap items-center justify-between gap-3 p-4">
						<div class="min-w-0">
							<p class="font-semibold break-words">{sibling.label}</p>
							<p class="text-sm text-[var(--color-text-soft)]">registrado el {formatDate(sibling.recordedAt)}</p>
						</div>
						<div class="flex shrink-0 items-center gap-2">
							<data class="font-bold tabular-nums" value={sibling.amountMinor / 100}>
								{formatMinorUnits(sibling.amountMinor, data.currency)}
							</data>
							<a class="btn btn-ghost btn-sm min-h-11" href={resolve(`/pagos/${sibling.id}`)}>Ver pago</a>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
</div>

{#if posted}
	<form bind:this={reverseFormEl} method="POST" action="?/reverseApplication" class="hidden">
		<input type="hidden" name="applicationId" value={reversingApplicationId ?? ""} />
	</form>

	{#if reversingApplication}
		<ConfirmationDialog
			open={reversingApplicationId !== null}
			title="Revertir aplicación"
			recordName={`${reversingApplication.expenseDescription} · ${formatMinorUnits(reversingApplication.amountMinor, data.currency)}`}
			description="La aplicación se deshará: el gasto volverá a quedar pendiente y el importe regresará al pago sin aplicar."
			confirmLabel="Revertir aplicación"
			tone="error"
			onconfirm={() => {
				reverseFormEl?.requestSubmit();
				reversingApplicationId = null;
			}}
			oncancel={() => (reversingApplicationId = null)}
		/>
	{/if}

	<ConfirmationDialog
		open={confirmingCorrection}
		title={correctionConfirmation.title}
		recordName={correctionConfirmation.recordName}
		description={correctionConfirmation.description}
		confirmLabel={correctionConfirmation.confirmLabel}
		tone="error"
		onconfirm={() => {
			confirmingCorrection = false;
			correctFormEl?.requestSubmit();
		}}
		oncancel={() => (confirmingCorrection = false)}
	/>
{/if}
