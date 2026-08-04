<script lang="ts">
	import { formatDate } from "$lib/format/format";

	interface Props {
		value: Date | string;
	}

	let { value }: Props = $props();
	const dateTime = $derived(typeof value === "string" ? value : value.toISOString());
</script>

<time class="tabular-nums" datetime={dateTime}>{formatDate(value)}</time>
