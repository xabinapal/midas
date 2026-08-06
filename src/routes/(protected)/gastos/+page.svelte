<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { formatMinorUnits } from "$lib/accounts/money";
	import EmptyState from "$lib/components/empty-state.svelte";
	import FinancialStatus from "$lib/components/financial-status.svelte";
	import PeriodNavigator from "$lib/components/period-navigator.svelte";
	import { paymentStatusToChip } from "$lib/expenses/terms";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const failureReasonTexts: Record<string, string> = {
		category_inactive: "la categoría está desactivada",
		template_members_empty: "los miembros del reparto están desactivados",
		account_not_found: "la cuenta habitual ya no existe",
	};

	function failureReasonText(reason: string): string {
		return failureReasonTexts[reason] ?? "revisa su configuración";
	}

	const addExpenseHref = $derived(
		data.isCustomPeriod
			? resolve(`/gastos/nuevo?periodo=${data.periodSlug}`)
			: resolve(`/gastos/nuevo?period=${data.periodSlug}`),
	);
</script>

<svelte:head><title>Gastos | {site.title}</title></svelte:head>

<div class="space-y-6">
	<header>
		<h1 class="text-2xl font-bold tracking-tight">Gastos</h1>
		<p class="text-sm text-[var(--color-text-soft)]">Registra y sigue los gastos del hogar, pagados o no.</p>
	</header>

	<nav class="flex flex-wrap gap-2" aria-label="Secciones de gastos">
		<a class="btn btn-ghost btn-sm min-h-11" href={resolve("/gastos/categorias")}>Categorías</a>
		<a class="btn btn-ghost btn-sm min-h-11" href={resolve("/gastos/plantillas")}>Plantillas</a>
		<a class="btn btn-ghost btn-sm min-h-11" href={resolve("/gastos/periodos/nueva")}>Nuevo periodo</a>
	</nav>

	{#if data.materializationFailures.length > 0}
		<div class="alert alert-warning" role="alert">
			<div class="flex flex-col gap-2">
				<ul class="list-disc space-y-1 pl-5">
					{#each data.materializationFailures as failure (failure.description + failure.reason)}
						<li>La plantilla «{failure.description}» no pudo generarse: {failureReasonText(failure.reason)}.</li>
					{/each}
				</ul>
				<a class="link" href={resolve("/gastos/plantillas")}>Revisar plantillas</a>
			</div>
		</div>
	{/if}

	{#if data.isCustomPeriod}
		<section class="flex flex-col items-center gap-2" aria-label="Periodo contable">
			<p class="btn pointer-events-none min-h-12 w-full max-w-md bg-base-100 text-lg font-bold">{data.periodLabel}</p>
			<a class="link link-primary min-h-11 content-center px-3 text-sm" href={resolve("/gastos")}>
				Volver al mes actual
			</a>
		</section>
	{:else}
		<PeriodNavigator url={page.url} />
	{/if}

	<section
		class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]"
		aria-label={`Totales de ${data.periodLabel}`}
	>
		<div class="card-body gap-4">
			<h2 class="card-title text-lg">Totales de {data.periodLabel}</h2>
			<dl class="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<div>
					<dt class="text-sm text-[var(--color-text-soft)]">Previsto</dt>
					<dd class="text-lg font-bold tabular-nums">{formatMinorUnits(data.totals.expectedMinor, data.currency)}</dd>
				</div>
				<div>
					<dt class="text-sm text-[var(--color-text-soft)]">Real</dt>
					<dd class="text-lg font-bold tabular-nums">{formatMinorUnits(data.totals.actualMinor, data.currency)}</dd>
				</div>
				<div>
					<dt class="text-sm text-[var(--color-text-soft)]">Pagado</dt>
					<dd class="text-lg font-bold tabular-nums">{formatMinorUnits(data.totals.paidMinor, data.currency)}</dd>
				</div>
				<div>
					<dt class="text-sm text-[var(--color-text-soft)]">Sin pagar</dt>
					<dd class="text-lg font-bold tabular-nums">{formatMinorUnits(data.totals.unpaidMinor, data.currency)}</dd>
				</div>
			</dl>
		</div>
	</section>

	<a class="btn btn-primary min-h-12 w-full sm:w-auto" href={addExpenseHref}>Añadir gasto</a>

	<section aria-label="Gastos del periodo">
		{#if data.views.length === 0}
			<EmptyState title="Sin gastos" description="No hay gastos registrados en este periodo." />
		{:else}
			<div
				class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)] bg-base-100"
			>
				{#each data.views as view (view.expense.id)}
					<a
						class="flex min-h-12 flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-base-200"
						href={resolve(`/gastos/${view.expense.id}`)}
					>
						<div class="min-w-0">
							<p class="font-semibold break-words">{view.expense.description}</p>
							<p class="text-sm text-[var(--color-text-soft)]">
								{#if view.expense.reference}{view.expense.reference} ·
								{/if}{view.categoryName}
							</p>
							<div class="mt-1 flex flex-wrap gap-1">
								{#if view.expense.status === "cancelled"}
									<FinancialStatus status="cancelled" />
								{:else if view.expense.status === "reversed"}
									<FinancialStatus status="reversed" />
								{:else}
									<FinancialStatus status={paymentStatusToChip(view.paymentStatus)} />
									{#if view.dueState === "overdue"}
										<FinancialStatus status="overdue" />
									{/if}
									{#if view.valueState === "estimated"}
										<FinancialStatus status="planned" />
									{/if}
								{/if}
							</div>
						</div>
						<div class="shrink-0 text-right">
							<data class="font-bold tabular-nums" value={view.applicableMinor / 100}>
								{formatMinorUnits(view.applicableMinor, data.currency)}
							</data>
							{#if view.paymentStatus === "partially_paid"}
								<p class="text-sm text-[var(--color-text-soft)] tabular-nums">
									Queda por pagar {formatMinorUnits(view.unpaidMinor, data.currency)}
								</p>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</section>

	{#if data.customPeriods.length > 0}
		<section class="space-y-2" aria-label="Periodos personalizados">
			<h2 class="text-sm font-semibold text-[var(--color-text-soft)]">Periodos personalizados</h2>
			<ul class="flex flex-wrap gap-2">
				{#each data.customPeriods as period (period.id)}
					<li>
						<a
							class="btn btn-ghost btn-sm min-h-11"
							href={resolve(`/gastos?periodo=${period.slug}`)}
							aria-current={data.isCustomPeriod && data.periodSlug === period.slug ? "page" : undefined}
						>
							{period.label}
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
