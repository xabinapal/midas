<script lang="ts">
	import { resolve } from "$app/paths";
	import ConfirmationDialog from "$lib/components/confirmation-dialog.svelte";
	import EmptyState from "$lib/components/empty-state.svelte";
	import { formatMinorUnits } from "$lib/accounts/money";
	import { TEMPLATE_CADENCE_LABELS, TEMPLATE_STATUS_LABELS } from "$lib/expenses/terms";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();

	let disablingId = $state<string | null>(null);
	let disableFormEl: HTMLFormElement | undefined = $state();

	const disabling = $derived(data.rows.find((row) => row.template.id === disablingId) ?? null);

	const reasonMessages: Record<string, string> = {
		conflict: "Otra operación está en curso. Inténtalo de nuevo.",
		template_not_found: "La plantilla ya no está disponible.",
	};

	function cadenceText(template: PageProps["data"]["rows"][number]["template"]): string {
		const label = TEMPLATE_CADENCE_LABELS[template.cadence];
		if (template.intervalCount <= 1) return label;
		return `${label} · cada ${template.intervalCount} ${template.cadence === "monthly" ? "meses" : "años"}`;
	}
</script>

<svelte:head><title>Plantillas de gastos recurrentes | {site.title}</title></svelte:head>

<div class="space-y-6">
	<header class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<p class="text-sm"><a class="link" href={resolve("/gastos")}>← Gastos</a></p>
			<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Plantillas de gastos recurrentes</h1>
			<p class="text-sm text-[var(--color-text-soft)]">
				Cada plantilla genera gastos previstos al abrir el periodo que le corresponde.
			</p>
		</div>
		<a class="btn btn-primary min-h-12" href={resolve("/gastos/plantillas/nueva")}>Nueva plantilla</a>
	</header>

	{#if form && "success" in form && form.success === false}
		<div class="alert alert-warning" role="alert">
			{reasonMessages[form.reason ?? ""] ?? "No se pudo completar la acción."}
		</div>
	{/if}

	{#if data.rows.length === 0}
		<EmptyState title="Sin plantillas" description="Crea una plantilla para generar gastos previstos cada mes o año.">
			{#snippet action()}
				<a class="btn btn-primary min-h-12" href={resolve("/gastos/plantillas/nueva")}>Crear la primera plantilla</a>
			{/snippet}
		</EmptyState>
	{:else}
		<div
			class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)] bg-base-100"
		>
			{#each data.rows as row (row.template.id)}
				<div class="flex flex-wrap items-center justify-between gap-3 p-4">
					<div class="min-w-0">
						<p class="font-semibold break-words">
							{row.template.description}
							<span
								class="badge badge-sm"
								class:badge-outline={row.template.status === "active"}
								class:badge-ghost={row.template.status !== "active"}
							>
								{TEMPLATE_STATUS_LABELS[row.template.status]}
							</span>
						</p>
						<p class="text-sm text-[var(--color-text-soft)] tabular-nums">
							{row.categoryName} · {cadenceText(row.template)} · {formatMinorUnits(
								row.template.estimatedAmountMinor,
								data.currency,
							)}
						</p>
					</div>
					<div class="flex shrink-0 flex-wrap gap-2">
						<a class="btn btn-ghost btn-sm min-h-11" href={resolve(`/gastos/plantillas/${row.template.id}/editar`)}>
							Editar
						</a>
						{#if row.template.status === "active"}
							<button class="btn btn-ghost btn-sm min-h-11" onclick={() => (disablingId = row.template.id)}>
								Desactivar
							</button>
						{:else}
							<form method="POST" action="?/enable">
								<input type="hidden" name="templateId" value={row.template.id} />
								<button class="btn btn-ghost btn-sm min-h-11" type="submit">Reactivar</button>
							</form>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<form bind:this={disableFormEl} method="POST" action="?/disable" class="hidden">
	<input type="hidden" name="templateId" value={disablingId ?? ""} />
</form>

{#if disabling}
	<ConfirmationDialog
		open={disablingId !== null}
		title="Desactivar plantilla"
		recordName={disabling.template.description}
		description="La plantilla dejará de generar gastos previstos; los gastos ya generados se conservan."
		confirmLabel="Desactivar"
		tone="error"
		onconfirm={() => {
			disableFormEl?.requestSubmit();
			disablingId = null;
		}}
		oncancel={() => (disablingId = null)}
	/>
{/if}
