<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		title: string;
		description: string;
		action?: Snippet;
	}

	let { title, description, action }: Props = $props();
</script>

<section class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
	<div class="card-body items-start gap-3">
		<h2 class="card-title text-xl">{title}</h2>
		<p class="text-[var(--color-text-soft)]">{description}</p>
		{#if action}
			<div class="card-actions mt-1">{@render action()}</div>
		{/if}
	</div>
</section>
