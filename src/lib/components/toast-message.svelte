<script lang="ts">
	interface Props {
		message: string;
		kind?: "info" | "success" | "warning" | "error";
	}

	let { message, kind = "success" }: Props = $props();
	const kindClass = $derived(`alert-${kind}`);
</script>

<div class="toast toast-end z-50" aria-live="polite">
	<div class={["alert", kindClass]} role="status">
		<span>{message}</span>
	</div>
</div>
