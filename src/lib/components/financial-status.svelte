<script lang="ts">
	export type FinancialStatus =
		| "planned"
		| "estimated"
		| "paid"
		| "unpaid"
		| "pending"
		| "payment-partial"
		| "settlement-partial"
		| "settlement-not-required"
		| "settled"
		| "overdue"
		| "cancelled"
		| "reversed";

	interface Props {
		status: FinancialStatus;
	}

	const presentations: Record<FinancialStatus, { label: string; className: string }> = {
		planned: { label: "Previsto", className: "text-[var(--color-status-planned)]" },
		estimated: { label: "Estimado", className: "text-[var(--color-status-estimated)]" },
		paid: { label: "Pagado", className: "text-[var(--color-status-paid)]" },
		unpaid: { label: "Sin pagar", className: "text-[var(--color-status-unpaid)]" },
		pending: { label: "Pendiente de compensar", className: "text-[var(--color-status-pending)]" },
		"payment-partial": {
			label: "Pago parcial",
			className: "text-[var(--color-status-payment-partial)]",
		},
		"settlement-partial": {
			label: "Compensado parcialmente",
			className: "text-[var(--color-status-settlement-partial)]",
		},
		"settlement-not-required": {
			label: "No requiere compensación",
			className: "text-[var(--color-status-settlement-not-required)]",
		},
		settled: { label: "Compensado", className: "text-[var(--color-status-settled)]" },
		overdue: { label: "Vencido", className: "text-[var(--color-status-overdue)]" },
		cancelled: { label: "Anulado", className: "text-[var(--color-status-cancelled)]" },
		reversed: { label: "Revertido", className: "text-[var(--color-status-reversed)]" },
	};

	let { status }: Props = $props();
	const presentation = $derived(presentations[status]);
</script>

<span class={["badge h-auto min-h-7 gap-2 whitespace-normal bg-base-200 py-1", presentation.className]}>
	<span class="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true"></span>
	{presentation.label}
</span>
