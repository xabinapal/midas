<script lang="ts">
	import { formatPercentage } from "$lib/format/format";

	interface Props {
		value: number;
	}

	let { value }: Props = $props();
</script>

<data class="font-semibold tabular-nums" {value}>{formatPercentage(value)}</data>
