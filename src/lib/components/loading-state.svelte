<script lang="ts">
	interface Props {
		label?: string;
		rows?: number;
	}

	let { label = "Cargando", rows = 3 }: Props = $props();
	const rowIndexes = $derived([...Array(rows).keys()]);
</script>

<section class="space-y-3" aria-busy="true" aria-label={label}>
	<span class="sr-only">{label}</span>
	{#each rowIndexes as index (index)}
		<div class="skeleton h-14 w-full rounded-box"></div>
	{/each}
</section>
