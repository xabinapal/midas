<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		kind?: "info" | "success" | "warning" | "error";
		children: Snippet;
	}

	let { kind = "info", children }: Props = $props();
	const kindClass = $derived(`alert-${kind}`);
</script>

<div class={["alert", kindClass]} role={kind === "error" ? "alert" : "status"}>
	{@render children()}
</div>
