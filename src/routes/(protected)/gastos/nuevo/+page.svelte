<script lang="ts">
	import { resolve } from "$app/paths";
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms/client";
	import { formatMinorUnits, parseAmountToMinorUnits } from "$lib/accounts/money";
	import {
		resolveAllocations,
		type AllocationLine,
		type AllocationMemberSelection,
		type AllocationMethodKind,
	} from "$lib/expenses/allocation";
	import { ALLOCATION_METHOD_LABELS } from "$lib/expenses/terms";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const { form, errors, enhance, submitting, message } = superForm(untrack(() => data.form));

	const methodOrder: AllocationMethodKind[] = ["equal", "default_weight", "custom_weight", "percentage", "fixed"];

	const memberNameById = $derived(new Map(data.members.map((member) => [member.id, member.displayName])));
	const defaultWeightByMember = $derived(new Map(data.members.map((member) => [member.id, member.defaultWeight])));
	const noActiveAccounts = $derived(data.accounts.length === 0);

	// Per-member values keyed by member id so the live preview and the posted
	// memberValues array stay aligned with the selected memberIds.
	const initialForm = untrack(() => $form);
	let memberValuesById = $state<Record<string, string>>(
		Object.fromEntries(
			untrack(() => data.members).map((member) => {
				const initialIndex = initialForm.memberIds.indexOf(member.id);
				return [member.id, initialForm.memberValues[initialIndex] ?? ""];
			}),
		),
	);

	const needsMemberValues = $derived(
		$form.allocationMethod === "custom_weight" ||
			$form.allocationMethod === "percentage" ||
			$form.allocationMethod === "fixed",
	);

	const memberValueLabel = $derived(
		$form.allocationMethod === "percentage" ? "%" : $form.allocationMethod === "fixed" ? "Importe" : "Peso",
	);

	type AllocationPreview =
		{ kind: "idle" } | { kind: "lines"; lines: AllocationLine[] } | { kind: "error"; text: string };

	const allocationErrorTexts: Record<string, string> = {
		allocation_percentages_unbalanced: "Los porcentajes deben sumar 100%.",
		allocation_weights_unbalanced: "Los pesos deben sumar más que cero.",
		allocation_fixed_unbalanced: "Los importes fijos deben sumar el total del gasto.",
	};

	const allocationPreview = $derived.by<AllocationPreview>(() => {
		const amountMinor = parseAmountToMinorUnits($form.amount ?? "", data.currency);
		if (amountMinor === null || amountMinor <= 0 || $form.memberIds.length === 0) return { kind: "idle" };
		const method = $form.allocationMethod;
		const selections: AllocationMemberSelection[] = $form.memberIds.map((memberId) => {
			const raw = memberValuesById[memberId] ?? "";
			switch (method) {
				case "custom_weight":
					return { memberId, weight: Number(raw || 0) };
				case "percentage":
					return { memberId, basisPoints: Math.round(Number(raw || 0) * 100) };
				case "fixed":
					return { memberId, fixedAmountMinor: parseAmountToMinorUnits(raw || "", data.currency) ?? -1 };
				case "default_weight":
					return { memberId, defaultWeight: defaultWeightByMember.get(memberId) ?? 0 };
				default:
					return { memberId };
			}
		});
		try {
			return { kind: "lines", lines: resolveAllocations(method, amountMinor, selections) };
		} catch (error) {
			const code = error instanceof Error ? error.message : "";
			return { kind: "error", text: allocationErrorTexts[code] ?? "Revisa los valores del reparto." };
		}
	});
</script>

<svelte:head><title>Nuevo gasto | {site.title}</title></svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<header>
		<h1 class="text-2xl font-bold tracking-tight">Nuevo gasto</h1>
		<p class="text-sm text-[var(--color-text-soft)]">
			Registra un gasto del hogar. Pagarlo es opcional y puede hacerse después.
		</p>
	</header>

	{#if data.categories.length === 0}
		<div class="alert alert-info" role="status">
			No hay categorías activas.
			<a class="link" href={resolve("/gastos/categorias")}>Crea primero una categoría</a>
		</div>
	{:else}
		<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
			<div class="card-body gap-4">
				<form method="POST" use:enhance class="flex flex-col gap-4">
					<label class="fieldset" for="description">
						<span class="fieldset-legend">Descripción</span>
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

					<label class="fieldset" for="categoryId">
						<span class="fieldset-legend">Categoría</span>
						<select
							id="categoryId"
							name="categoryId"
							class="select min-h-12 w-full"
							bind:value={$form.categoryId}
							required
						>
							<option value="" disabled>Selecciona una categoría</option>
							{#each data.categories as category (category.id)}
								<option value={category.id}>{category.name}</option>
							{/each}
						</select>
						{#if $errors.categoryId}
							<p class="label text-error">{$errors.categoryId}</p>
						{/if}
					</label>

					<label class="fieldset" for="reportingPeriodId">
						<span class="fieldset-legend">Periodo</span>
						<select
							id="reportingPeriodId"
							name="reportingPeriodId"
							class="select min-h-12 w-full"
							bind:value={$form.reportingPeriodId}
							required
						>
							<option value="" disabled>Selecciona un periodo</option>
							{#each data.periods as period (period.id)}
								<option value={period.id}>{period.label}</option>
							{/each}
						</select>
						{#if $errors.reportingPeriodId}
							<p class="label text-error">{$errors.reportingPeriodId}</p>
						{/if}
					</label>

					<fieldset class="fieldset">
						<legend class="fieldset-legend">Tipo de importe</legend>
						<label class="flex min-h-12 cursor-pointer items-center gap-3" for="valueKindActual">
							<input
								id="valueKindActual"
								type="radio"
								name="valueKind"
								class="radio"
								value="actual"
								bind:group={$form.valueKind}
							/>
							<span>Importe real</span>
						</label>
						<label class="flex min-h-12 cursor-pointer items-center gap-3" for="valueKindEstimated">
							<input
								id="valueKindEstimated"
								type="radio"
								name="valueKind"
								class="radio"
								value="estimated"
								bind:group={$form.valueKind}
							/>
							<span>Estimado (previsto)</span>
						</label>
						{#if $errors.valueKind}
							<p class="label text-error">{$errors.valueKind}</p>
						{/if}
					</fieldset>

					<label class="fieldset" for="accountingDate">
						<span class="fieldset-legend">Fecha del gasto</span>
						<input
							id="accountingDate"
							name="accountingDate"
							type="date"
							class="input min-h-12 w-full"
							bind:value={$form.accountingDate}
							required
						/>
						{#if $errors.accountingDate}
							<p class="label text-error">{$errors.accountingDate}</p>
						{/if}
					</label>

					<label class="flex min-h-12 cursor-pointer items-center gap-3" for="paid">
						<input
							id="paid"
							name="paid"
							type="checkbox"
							class="toggle"
							bind:checked={$form.paid}
							disabled={noActiveAccounts}
							aria-disabled={noActiveAccounts}
						/>
						<span>Ya está pagado</span>
					</label>

					{#if noActiveAccounts}
						<div class="alert alert-info" role="status">
							No hay cuentas activas para registrar el pago.
							<a class="link" href={resolve("/cuentas/crear")}>Crea una cuenta</a>.
						</div>
					{:else if $form.paid}
						<label class="fieldset" for="paymentAccountId">
							<span class="fieldset-legend">Cuenta del pago</span>
							<select
								id="paymentAccountId"
								name="paymentAccountId"
								class="select min-h-12 w-full"
								bind:value={$form.paymentAccountId}
							>
								<option value="" disabled>Selecciona la cuenta</option>
								{#each data.accounts as account (account.id)}
									<option value={account.id}>{account.name}</option>
								{/each}
							</select>
							{#if $errors.paymentAccountId}
								<p class="label text-error">{$errors.paymentAccountId}</p>
							{/if}
						</label>

						<label class="fieldset" for="paymentDate">
							<span class="fieldset-legend">Fecha del pago</span>
							<input
								id="paymentDate"
								name="paymentDate"
								type="date"
								class="input min-h-12 w-full"
								bind:value={$form.paymentDate}
							/>
							{#if $errors.paymentDate}
								<p class="label text-error">{$errors.paymentDate}</p>
							{/if}
						</label>
					{/if}

					<details class="collapse collapse-arrow rounded-box border border-[var(--color-border)]">
						<summary class="collapse-title min-h-12 text-sm font-semibold">
							Más opciones (vencimiento, servicio, cuenta habitual)
						</summary>
						<div class="collapse-content flex flex-col gap-4">
							<label class="fieldset" for="dueDate">
								<span class="fieldset-legend">Vencimiento (opcional)</span>
								<input
									id="dueDate"
									name="dueDate"
									type="date"
									class="input min-h-12 w-full"
									bind:value={$form.dueDate}
								/>
								{#if $errors.dueDate}
									<p class="label text-error">{$errors.dueDate}</p>
								{/if}
							</label>
							<label class="fieldset" for="serviceStartDate">
								<span class="fieldset-legend">Inicio del servicio (opcional)</span>
								<input
									id="serviceStartDate"
									name="serviceStartDate"
									type="date"
									class="input min-h-12 w-full"
									bind:value={$form.serviceStartDate}
								/>
								{#if $errors.serviceStartDate}
									<p class="label text-error">{$errors.serviceStartDate}</p>
								{/if}
							</label>
							<label class="fieldset" for="serviceEndDate">
								<span class="fieldset-legend">Fin del servicio (opcional)</span>
								<input
									id="serviceEndDate"
									name="serviceEndDate"
									type="date"
									class="input min-h-12 w-full"
									bind:value={$form.serviceEndDate}
								/>
								{#if $errors.serviceEndDate}
									<p class="label text-error">{$errors.serviceEndDate}</p>
								{/if}
							</label>
							<label class="fieldset" for="accountHintId">
								<span class="fieldset-legend">Cuenta habitual (opcional)</span>
								<select
									id="accountHintId"
									name="accountHintId"
									class="select min-h-12 w-full"
									bind:value={$form.accountHintId}
								>
									<option value="">Sin cuenta habitual</option>
									{#each data.accounts as account (account.id)}
										<option value={account.id}>{account.name}</option>
									{/each}
								</select>
								{#if $errors.accountHintId}
									<p class="label text-error">{$errors.accountHintId}</p>
								{/if}
							</label>
						</div>
					</details>

					<fieldset class="fieldset">
						<legend class="fieldset-legend">Reparto</legend>
						<label class="fieldset" for="allocationMethod">
							<span class="fieldset-legend">Método de reparto</span>
							<select
								id="allocationMethod"
								name="allocationMethod"
								class="select min-h-12 w-full"
								bind:value={$form.allocationMethod}
							>
								{#each methodOrder as method (method)}
									<option value={method}>{ALLOCATION_METHOD_LABELS[method]}</option>
								{/each}
							</select>
							{#if $errors.allocationMethod}
								<p class="label text-error">{$errors.allocationMethod}</p>
							{/if}
						</label>

						<div class="flex flex-col gap-2">
							{#each data.members as member (member.id)}
								<div class="flex flex-wrap items-center gap-3">
									<label class="flex min-h-12 flex-1 cursor-pointer items-center gap-3" for={`member-${member.id}`}>
										<input
											id={`member-${member.id}`}
											type="checkbox"
											name="memberIds"
											class="checkbox"
											value={member.id}
											bind:group={$form.memberIds}
										/>
										<span>{member.displayName}</span>
									</label>
									{#if needsMemberValues && $form.memberIds.includes(member.id)}
										<label class="flex items-center gap-2" for={`member-value-${member.id}`}>
											<span class="text-sm text-[var(--color-text-soft)]">
												{memberValueLabel} ({member.displayName})
											</span>
											<input
												id={`member-value-${member.id}`}
												name="memberValues"
												type="text"
												inputmode="decimal"
												placeholder={$form.allocationMethod === "fixed" ? "0,00" : "0"}
												class="input min-h-12 w-28"
												bind:value={memberValuesById[member.id]}
											/>
										</label>
									{/if}
								</div>
							{/each}
						</div>
						{#if $errors.memberIds}
							<p class="label text-error">{$errors.memberIds}</p>
						{/if}

						{#if allocationPreview.kind === "error"}
							<div class="mt-2 rounded-box border border-[var(--color-border)] bg-base-200 p-4" role="status">
								<p class="text-sm text-error">{allocationPreview.text}</p>
							</div>
						{:else if allocationPreview.kind === "lines"}
							<div class="mt-2 rounded-box border border-[var(--color-border)] bg-base-200 p-4" aria-live="polite">
								<p class="text-sm font-semibold">Reparto · {ALLOCATION_METHOD_LABELS[$form.allocationMethod]}</p>
								<ul class="mt-2 space-y-1">
									{#each allocationPreview.lines as line (line.memberId)}
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
					</fieldset>

					{#if $message}
						<div class="alert alert-error" role="alert">{$message}</div>
					{/if}

					<div class="flex gap-2">
						<a class="btn min-h-12 flex-1" href={resolve("/gastos")}>Cancelar</a>
						<button class="btn btn-primary min-h-12 flex-1" disabled={$submitting}>
							{$submitting ? "Guardando…" : "Registrar gasto"}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
