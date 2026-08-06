<script lang="ts">
	import { formatMinorUnits } from "$lib/accounts/money";
	import type { BalanceProjection } from "$lib/accounts/projection";
	import { formatDate } from "$lib/format/format";

	interface Props {
		balance: BalanceProjection;
		currency: string;
		large?: boolean;
	}

	let { balance, currency, large = false }: Props = $props();
</script>

{#if balance.kind === "estimated"}
	<div>
		<data class:text-3xl={large} class="font-bold tracking-tight tabular-nums" value={balance.amountMinor / 100}>
			{formatMinorUnits(balance.amountMinor, currency)}
		</data>
		<p class="text-xs text-[var(--color-text-soft)]">
			Saldo estimado · observado el {formatDate(balance.observedAt)}
			{#if balance.movementCount > 0}
				· {balance.movementCount === 1 ? "1 movimiento posterior" : `${balance.movementCount} movimientos posteriores`}
			{/if}
		</p>
	</div>
{:else}
	<div>
		<p class:text-3xl={large} class="font-bold tracking-tight text-[var(--color-text-soft)]">No registrado</p>
		<p class="text-xs text-[var(--color-text-soft)]">Sin observación de saldo</p>
	</div>
{/if}
