<script lang="ts">
	import { resolve } from "$app/paths";
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms/client";
	import ConfirmationDialog from "$lib/components/confirmation-dialog.svelte";
	import FinancialStatus from "$lib/components/financial-status.svelte";
	import { formatMinorUnits } from "$lib/accounts/money";
	import {
		ALLOCATION_METHOD_LABELS,
		EXPENSE_LIFECYCLE_LABELS,
		FUNDING_SOURCE_LABELS,
		paymentStatusToChip,
	} from "$lib/expenses/terms";
	import { formatDate } from "$lib/format/format";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();

	const {
		form: evidenceData,
		errors: evidenceErrors,
		enhance: evidenceEnhance,
		submitting: evidenceSubmitting,
		message: evidenceMessage,
	} = superForm(untrack(() => data.evidenceForm));
	const {
		form: linkData,
		errors: linkErrors,
		enhance: linkEnhance,
		submitting: linkSubmitting,
		message: linkMessage,
	} = superForm(untrack(() => data.linkForm));

	type PendingConfirmation =
		| { kind: "cancel" }
		| { kind: "deleteDraft" }
		| { kind: "reverse" }
		| { kind: "unlink" }
		| { kind: "removeEvidence"; evidenceId: string };

	let pending = $state<PendingConfirmation | null>(null);
	let lifecycleFormEl: HTMLFormElement | undefined = $state();
	let removeEvidenceFormEl: HTMLFormElement | undefined = $state();

	const expense = $derived(data.expense);
	const view = $derived(data.view);

	const applicableBasis = $derived(view.valueState === "actual" ? "actual" : "planned");
	const applicableLines = $derived(view.allocations.filter((line) => line.basis === applicableBasis));
	const plannedLines = $derived(view.allocations.filter((line) => line.basis === "planned"));
	const showPlannedLines = $derived(
		view.valueState === "actual" && expense.plannedAmountMinor !== null && plannedLines.length > 0,
	);

	const canUnlink = $derived(data.linkedActual !== null && expense.status === "posted" && data.payments.length === 0);
	const paymentsBlockEdit = $derived(
		expense.status === "posted" && view.valueState === "estimated" && data.payments.length > 0 && !data.flags.canEdit,
	);

	const confirmationText = $derived.by(() => {
		if (!pending) return null;
		const recordName = `${expense.description}${expense.reference ? ` · ${expense.reference}` : ""}`;
		switch (pending.kind) {
			case "cancel":
				return {
					title: "Anular gasto previsto",
					description:
						"El gasto previsto quedará anulado y dejará de contar en los totales del periodo. Esta acción no se puede deshacer.",
					confirmLabel: "Anular gasto",
					action: "?/cancel",
					recordName,
				};
			case "deleteDraft":
				return {
					title: "Eliminar borrador",
					description: "El borrador se eliminará de forma permanente. Esta acción no se puede deshacer.",
					confirmLabel: "Eliminar",
					action: "?/deleteDraft",
					recordName,
				};
			case "reverse":
				return {
					title: "Revertir gasto",
					description:
						"El gasto original quedará revertido y visible en el historial; sus pagos aplicados se desharán. " +
						"El pago registrado seguirá existiendo con el importe sin aplicar; la cuenta no se devuelve. " +
						"Podrás volver a aplicarlo desde el detalle del pago.",
					confirmLabel: "Revertir gasto",
					action: "?/reverse",
					recordName,
				};
			case "unlink":
				return {
					title: "Desvincular gasto real",
					description: `Se deshará la vinculación con «${data.linkedActual?.description ?? ""}». El gasto previsto volverá a ser editable.`,
					confirmLabel: "Desvincular",
					action: "?/unlink",
					recordName,
				};
			case "removeEvidence": {
				const evidenceId = pending.evidenceId;
				const item = data.evidence.find((entry) => entry.id === evidenceId);
				return {
					title: "Retirar justificante",
					description:
						"El enlace dejará de mostrarse en el gasto, pero la retirada quedará registrada en el historial del hogar.",
					confirmLabel: "Retirar",
					action: "?/removeEvidence",
					recordName: item?.label ?? "Justificante",
				};
			}
		}
	});

	const reasonMessages: Record<string, string> = {
		conflict: "Otra operación está en curso. Inténtalo de nuevo.",
		expense_not_found: "Gasto no encontrado.",
		expense_not_cancellable: "Este gasto ya no se puede anular.",
		expense_not_correctable: "Este gasto ya no admite correcciones.",
		expense_already_reversed: "Este gasto ya está revertido.",
		expense_not_unlinkable: "Este gasto ya no se puede desvincular.",
		expense_not_draft: "Solo los borradores admiten esta acción.",
		evidence_not_found: "El justificante ya no está disponible.",
	};

	const actionFailure = $derived(form && "success" in form && form.success === false ? form : null);

	function confirmPending() {
		if (!pending) return;
		if (pending.kind === "removeEvidence") {
			removeEvidenceFormEl?.requestSubmit();
		} else {
			lifecycleFormEl?.requestSubmit();
		}
		pending = null;
	}
</script>

<svelte:head><title>{expense.description} | {site.title}</title></svelte:head>

<div class="space-y-6">
	<header class="space-y-2">
		<p class="text-sm"><a class="link" href={resolve("/gastos")}>← Gastos</a></p>
		<h1 class="text-2xl font-bold tracking-tight break-words sm:text-3xl">{expense.description}</h1>
		<div class="flex flex-wrap items-center gap-2">
			{#if expense.reference}
				<span class="badge badge-outline h-auto min-h-7 py-1">{expense.reference}</span>
			{/if}
			{#if expense.status === "cancelled"}
				<FinancialStatus status="cancelled" />
			{:else if expense.status === "reversed"}
				<FinancialStatus status="reversed" />
			{:else if expense.status === "draft"}
				<span class="badge badge-outline h-auto min-h-7 py-1">{EXPENSE_LIFECYCLE_LABELS.draft}</span>
			{:else}
				<FinancialStatus status={paymentStatusToChip(view.paymentStatus)} />
				{#if view.dueState === "overdue"}
					<FinancialStatus status="overdue" />
				{/if}
				{#if view.valueState === "estimated"}
					<FinancialStatus status="estimated" />
				{/if}
			{/if}
		</div>
		<p class="text-sm text-[var(--color-text-soft)]">
			{view.categoryName}
			{#if data.period}
				· {data.period.label}
			{/if}
		</p>
	</header>

	{#if actionFailure}
		<div class="alert alert-warning" role="alert">
			{reasonMessages[actionFailure.reason ?? ""] ?? "No se pudo completar la acción."}
		</div>
	{/if}

	<section class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
		<div class="card-body gap-2">
			<h2 class="card-title text-lg">{view.valueState === "actual" ? "Importe real" : "Importe previsto"}</h2>
			<data class="text-3xl font-bold tracking-tight tabular-nums" value={view.applicableMinor / 100}>
				{formatMinorUnits(view.applicableMinor, data.currency)}
			</data>
			{#if view.valueState === "actual" && expense.plannedAmountMinor !== null}
				<dl class="mt-1 space-y-1 text-sm">
					<div class="flex justify-between gap-4">
						<dt class="text-[var(--color-text-soft)]">Importe previsto</dt>
						<dd class="tabular-nums">{formatMinorUnits(expense.plannedAmountMinor, data.currency)}</dd>
					</div>
					<div class="flex justify-between gap-4">
						<dt class="text-[var(--color-text-soft)]">Importe real</dt>
						<dd class="tabular-nums">{formatMinorUnits(view.applicableMinor, data.currency)}</dd>
					</div>
				</dl>
			{/if}
			{#if view.paidMinor > 0}
				<dl class="mt-1 space-y-1 text-sm">
					<div class="flex justify-between gap-4">
						<dt class="text-[var(--color-text-soft)]">Pagado</dt>
						<dd class="tabular-nums">{formatMinorUnits(view.paidMinor, data.currency)}</dd>
					</div>
					<div class="flex justify-between gap-4">
						<dt class="text-[var(--color-text-soft)]">Pendiente</dt>
						<dd class="tabular-nums">{formatMinorUnits(view.unpaidMinor, data.currency)}</dd>
					</div>
				</dl>
			{/if}
		</div>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-bold">Detalles</h2>
		<dl
			class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)] bg-base-100"
		>
			<div class="flex flex-wrap justify-between gap-2 p-4">
				<dt class="text-[var(--color-text-soft)]">Fecha del gasto</dt>
				<dd class="tabular-nums">{formatDate(expense.accountingDate)}</dd>
			</div>
			<div class="flex flex-wrap justify-between gap-2 p-4">
				<dt class="text-[var(--color-text-soft)]">Vencimiento</dt>
				<dd class="tabular-nums">{expense.dueDate ? formatDate(expense.dueDate) : "—"}</dd>
			</div>
			<div class="flex flex-wrap justify-between gap-2 p-4">
				<dt class="text-[var(--color-text-soft)]">Periodo de servicio</dt>
				<dd class="tabular-nums">
					{expense.serviceStartDate && expense.serviceEndDate
						? `${formatDate(expense.serviceStartDate)} → ${formatDate(expense.serviceEndDate)}`
						: "—"}
				</dd>
			</div>
			<div class="flex flex-wrap justify-between gap-2 p-4">
				<dt class="text-[var(--color-text-soft)]">Cuenta habitual</dt>
				<dd>{data.accountHintName ?? "—"}</dd>
			</div>
			<div class="flex flex-wrap justify-between gap-2 p-4">
				<dt class="text-[var(--color-text-soft)]">Método de reparto</dt>
				<dd>{ALLOCATION_METHOD_LABELS[expense.allocationMethod]}</dd>
			</div>
		</dl>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-bold">Reparto</h2>
		<div
			class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)] bg-base-100"
		>
			{#each applicableLines as line (line.memberId)}
				<div class="flex items-center justify-between gap-3 p-4">
					<span>{line.memberName}</span>
					<data class="font-semibold tabular-nums" value={line.amountMinor / 100}>
						{formatMinorUnits(line.amountMinor, data.currency)}
					</data>
				</div>
			{/each}
		</div>
		{#if showPlannedLines}
			<details class="collapse collapse-arrow border border-[var(--color-border)] bg-base-100">
				<summary class="collapse-title min-h-12 font-semibold">Reparto previsto original</summary>
				<div class="collapse-content">
					<div class="divide-y divide-[var(--color-divider)]">
						{#each plannedLines as line (line.memberId)}
							<div class="flex items-center justify-between gap-3 py-2">
								<span class="text-sm">{line.memberName}</span>
								<data class="text-sm tabular-nums" value={line.amountMinor / 100}>
									{formatMinorUnits(line.amountMinor, data.currency)}
								</data>
							</div>
						{/each}
					</div>
				</div>
			</details>
		{/if}
	</section>

	<section class="space-y-3">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h2 class="text-xl font-bold">Pagos</h2>
			{#if data.flags.canPay}
				<a class="btn btn-primary min-h-12" href={resolve(`/gastos/${expense.id}/pagar`)}>Registrar pago</a>
			{/if}
		</div>
		{#if data.payments.length === 0}
			<p class="text-[var(--color-text-soft)]">Todavía no hay pagos aplicados a este gasto.</p>
		{:else}
			<div
				class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)] bg-base-100"
			>
				{#each data.payments as payment (payment.applicationId)}
					<div class="flex flex-wrap items-center justify-between gap-3 p-4">
						<div class="min-w-0">
							<p class="font-semibold break-words">{payment.paymentDescription}</p>
							<p class="text-sm text-[var(--color-text-soft)]">
								{FUNDING_SOURCE_LABELS[payment.fundingSource]} · {formatDate(payment.effectiveAt)} · {payment.accountName}
							</p>
						</div>
						<div class="flex shrink-0 items-center gap-2">
							<data class="font-bold tabular-nums" value={payment.amountMinor / 100}>
								{formatMinorUnits(payment.amountMinor, data.currency)}
							</data>
							<a class="btn btn-ghost btn-sm min-h-11" href={resolve(`/pagos/${payment.paymentId}`)}>Ver pago</a>
						</div>
					</div>
				{/each}
			</div>
		{/if}
		{#if data.reversedApplications.length > 0}
			<div class="space-y-2">
				<h3 class="text-sm font-semibold text-[var(--color-text-soft)]">Aplicaciones revertidas</h3>
				<ul
					class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)] bg-base-100 text-[var(--color-text-soft)]"
				>
					{#each data.reversedApplications as application (application.applicationId)}
						<li class="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
							<span class="min-w-0 break-words">{application.paymentDescription}</span>
							<span class="flex shrink-0 items-center gap-2">
								<data class="tabular-nums" value={application.amountMinor / 100}>
									{formatMinorUnits(application.amountMinor, data.currency)}
								</data>
								<a class="link" href={resolve(`/pagos/${application.paymentId}`)}>Ver pago</a>
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-bold">Justificantes</h2>
		{#if data.evidence.length === 0}
			<p class="text-[var(--color-text-soft)]">Todavía no hay justificantes enlazados.</p>
		{:else}
			<div
				class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)] bg-base-100"
			>
				{#each data.evidence as item (item.id)}
					<div class="flex flex-wrap items-center justify-between gap-3 p-4">
						<div class="min-w-0">
							<a
								class="link font-semibold break-words"
								href={item.url}
								target="_blank"
								rel="noopener noreferrer external"
							>
								{item.label}<svg
									aria-hidden="true"
									class="mb-0.5 ml-1 inline size-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M13.5 6H18m0 0v4.5m0-4.5L10.5 13.5M18 13.5V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V7.5A1.5 1.5 0 0 1 6 6h4.5"
									/>
								</svg><span class="sr-only">(se abre en una pestaña nueva)</span>
							</a>
							{#if item.note}
								<p class="text-sm text-[var(--color-text-soft)]">{item.note}</p>
							{/if}
						</div>
						<button
							class="btn btn-ghost btn-sm min-h-11"
							onclick={() => (pending = { kind: "removeEvidence", evidenceId: item.id })}
						>
							Retirar
						</button>
					</div>
				{/each}
			</div>
		{/if}

		{#if expense.status === "posted" || expense.status === "draft"}
			<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
				<div class="card-body gap-4">
					<h3 class="card-title text-base">Enlazar justificante</h3>
					<form method="POST" action="?/addEvidence" use:evidenceEnhance class="flex flex-col gap-4">
						<label class="fieldset" for="evidence-label">
							<span class="fieldset-legend">Nombre del enlace</span>
							<input
								id="evidence-label"
								name="label"
								type="text"
								class="input min-h-12 w-full"
								bind:value={$evidenceData.label}
								required
							/>
							{#if $evidenceErrors.label}
								<p class="label text-error">{$evidenceErrors.label}</p>
							{/if}
						</label>
						<label class="fieldset" for="evidence-url">
							<span class="fieldset-legend">URL</span>
							<input
								id="evidence-url"
								name="url"
								type="url"
								placeholder="https://…"
								class="input min-h-12 w-full"
								bind:value={$evidenceData.url}
								required
							/>
							{#if $evidenceErrors.url}
								<p class="label text-error">{$evidenceErrors.url}</p>
							{/if}
						</label>
						<label class="fieldset" for="evidence-note">
							<span class="fieldset-legend">Nota (opcional)</span>
							<input
								id="evidence-note"
								name="note"
								type="text"
								class="input min-h-12 w-full"
								bind:value={$evidenceData.note}
							/>
							{#if $evidenceErrors.note}
								<p class="label text-error">{$evidenceErrors.note}</p>
							{/if}
						</label>
						{#if $evidenceMessage}
							<div class="alert alert-info" role="status">{$evidenceMessage}</div>
						{/if}
						<button class="btn min-h-12 self-start" disabled={$evidenceSubmitting}>
							{$evidenceSubmitting ? "Guardando…" : "Añadir justificante"}
						</button>
					</form>
				</div>
			</div>
		{/if}
	</section>

	{#if expense.status === "posted" && view.valueState === "estimated" && (data.linkedActual !== null || data.flags.canEdit)}
		<section class="space-y-3">
			<h2 class="text-xl font-bold">Vinculación con gasto real</h2>
			{#if data.linkedActual}
				<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
					<div class="card-body gap-3">
						<div class="min-w-0">
							<p class="font-semibold break-words">{data.linkedActual.description}</p>
							<p class="mt-1 flex flex-wrap items-center gap-2">
								{#if data.linkedActual.reference}
									<span class="badge badge-outline h-auto min-h-7 py-1">{data.linkedActual.reference}</span>
								{/if}
								<data class="font-bold tabular-nums" value={data.linkedActual.amountMinor / 100}>
									{formatMinorUnits(data.linkedActual.amountMinor, data.currency)}
								</data>
							</p>
						</div>
						<p class="text-sm text-[var(--color-text-soft)]">
							Vinculado al gasto real; el importe previsto queda como referencia.
						</p>
						<div class="flex flex-wrap gap-2">
							<a class="btn min-h-12" href={resolve(`/gastos/${data.linkedActual.id}`)}>Ver gasto real</a>
							{#if canUnlink}
								<button class="btn btn-error min-h-12" onclick={() => (pending = { kind: "unlink" })}>
									Desvincular
								</button>
							{/if}
						</div>
					</div>
				</div>
			{:else if data.flags.canEdit}
				<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
					<div class="card-body gap-4">
						<p class="text-sm text-[var(--color-text-soft)]">
							Vincula este previsto con la factura real ya registrada; el importe previsto queda como referencia.
						</p>
						{#if data.matchCandidates.length === 0}
							<p class="text-sm text-[var(--color-text-muted)]">No hay gastos reales disponibles para vincular.</p>
						{:else}
							<form method="POST" action="?/linkActual" use:linkEnhance class="flex flex-col gap-4">
								<label class="fieldset" for="actualExpenseId">
									<span class="fieldset-legend">Gasto real</span>
									<select
										id="actualExpenseId"
										name="actualExpenseId"
										class="select min-h-12 w-full"
										bind:value={$linkData.actualExpenseId}
										required
									>
										<option value="" disabled>Selecciona el gasto real</option>
										{#each data.matchCandidates as candidate (candidate.id)}
											<option value={candidate.id}>
												{candidate.description}{candidate.reference ? ` · ${candidate.reference}` : ""} · {formatMinorUnits(
													candidate.actualAmountMinor,
													data.currency,
												)}
											</option>
										{/each}
									</select>
									{#if $linkErrors.actualExpenseId}
										<p class="label text-error">{$linkErrors.actualExpenseId}</p>
									{/if}
								</label>
								{#if $linkMessage}
									<div class="alert alert-info" role="status">{$linkMessage}</div>
								{/if}
								<button class="btn btn-primary min-h-12 self-start" disabled={$linkSubmitting}>
									{$linkSubmitting ? "Vinculando…" : "Vincular con gasto real"}
								</button>
							</form>
						{/if}
					</div>
				</div>
			{/if}
		</section>
	{/if}

	{#if data.flags.canEdit || data.flags.canCorrect || data.flags.isDraft || paymentsBlockEdit}
		<section class="space-y-3">
			<h2 class="text-xl font-bold">Acciones</h2>
			{#if paymentsBlockEdit}
				<p class="text-sm text-[var(--color-text-soft)]">
					Con pagos aplicados no se puede confirmar el importe real ni editar el gasto; revierte primero la aplicación
					desde el detalle del pago.
				</p>
			{/if}
			<div class="flex flex-wrap gap-2">
				{#if data.flags.isDraft}
					<a class="btn min-h-12" href={resolve(`/gastos/${expense.id}/editar`)}>Editar borrador</a>
					<button class="btn btn-error min-h-12" onclick={() => (pending = { kind: "deleteDraft" })}>
						Eliminar borrador
					</button>
				{:else}
					{#if data.flags.canEdit}
						<a class="btn min-h-12" href={resolve(`/gastos/${expense.id}/editar`)}>Editar</a>
						<a class="btn min-h-12" href={resolve(`/gastos/${expense.id}/confirmar`)}>Confirmar importe real</a>
						<button class="btn btn-error min-h-12" onclick={() => (pending = { kind: "cancel" })}>Anular</button>
					{/if}
					{#if data.flags.canCorrect}
						<a class="btn min-h-12" href={resolve(`/gastos/${expense.id}/corregir`)}>Corregir</a>
						<button class="btn btn-error min-h-12" onclick={() => (pending = { kind: "reverse" })}>Revertir</button>
					{/if}
				{/if}
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
							<p class="font-semibold break-words">
								{sibling.description}
								{#if sibling.reference}
									<span class="badge badge-sm badge-outline">{sibling.reference}</span>
								{/if}
							</p>
							<p class="text-sm text-[var(--color-text-soft)]">
								{#if sibling.status === "reversed"}
									Original revertido
								{:else if sibling.replacesId === expense.id}
									Sustitución vigente
								{:else}
									{EXPENSE_LIFECYCLE_LABELS[sibling.status]}
								{/if}
							</p>
						</div>
						<a class="btn btn-ghost btn-sm min-h-11" href={resolve(`/gastos/${sibling.id}`)}>Ver gasto</a>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<section class="space-y-3">
		<h2 class="text-xl font-bold">Historial</h2>
		{#if data.activity.length === 0}
			<p class="text-[var(--color-text-soft)]">Todavía no hay actividad registrada para este gasto.</p>
		{:else}
			<div
				class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)] bg-base-100"
			>
				{#each data.activity as event (event.id)}
					<div class="p-4">
						<div class="flex items-center justify-between gap-2">
							<p class="font-semibold">{data.eventLabels[event.eventType] ?? event.eventType}</p>
							<time class="text-sm text-[var(--color-text-muted)]">{formatDate(event.occurredAt)}</time>
						</div>
						{#if event.details.length > 0}
							<dl class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
								{#each event.details as detail (detail.label)}
									<div class="flex gap-1">
										<dt class="text-[var(--color-text-muted)]">{detail.label}:</dt>
										<dd class="text-[var(--color-text-soft)]">{detail.value}</dd>
									</div>
								{/each}
							</dl>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

<form bind:this={lifecycleFormEl} method="POST" action={confirmationText?.action ?? ""} class="hidden"></form>
<form bind:this={removeEvidenceFormEl} method="POST" action="?/removeEvidence" class="hidden">
	<input type="hidden" name="evidenceId" value={pending?.kind === "removeEvidence" ? pending.evidenceId : ""} />
</form>

{#if confirmationText}
	<ConfirmationDialog
		open={pending !== null}
		title={confirmationText.title}
		recordName={confirmationText.recordName}
		description={confirmationText.description}
		confirmLabel={confirmationText.confirmLabel}
		tone="error"
		onconfirm={confirmPending}
		oncancel={() => (pending = null)}
	/>
{/if}
