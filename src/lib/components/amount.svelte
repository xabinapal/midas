<script lang="ts">
	import { formatMinorUnits } from "$lib/accounts/money";

	interface Props {
		valueMinor: number;
		currency: string;
		large?: boolean;
	}

	let { valueMinor, currency, large = false }: Props = $props();
</script>

<data class:text-3xl={large} class="font-bold tracking-tight tabular-nums" value={valueMinor / 100}>
	{formatMinorUnits(valueMinor, currency)}
</data>
