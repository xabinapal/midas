<script lang="ts">
	import { formatCurrency } from "$lib/format/format";

	interface Props {
		value: number;
		currency: string;
		large?: boolean;
	}

	let { value, currency, large = false }: Props = $props();
</script>

<data class:text-3xl={large} class="font-bold tracking-tight tabular-nums" {value}>
	{formatCurrency(value, currency)}
</data>
