<script lang="ts">
	interface Props {
		open: boolean;
		title: string;
		description: string;
		recordName: string;
		confirmLabel?: string;
		onconfirm: () => void;
		oncancel: () => void;
	}

	let { open, title, description, recordName, confirmLabel = "Confirmar", onconfirm, oncancel }: Props = $props();

	let dialogEl: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) {
			dialogEl.showModal();
		} else if (!open && dialogEl.open) {
			dialogEl.close();
		}
	});
</script>

<dialog bind:this={dialogEl} class="modal" onclose={oncancel} aria-labelledby="confirmation-title">
	<div class="modal-box">
		<h2 id="confirmation-title" class="text-xl font-bold">{title}</h2>
		<p class="mt-4 font-semibold">{recordName}</p>
		<p class="mt-2 text-[var(--color-text-soft)]">{description}</p>
		<div class="modal-action">
			<button class="btn min-h-12" type="button" onclick={oncancel}>Cancelar</button>
			<button class="btn btn-error min-h-12" type="button" onclick={onconfirm}>{confirmLabel}</button>
		</div>
	</div>
	<button class="modal-backdrop" type="button" aria-label="Cerrar confirmación" onclick={oncancel}>Cerrar</button>
</dialog>
