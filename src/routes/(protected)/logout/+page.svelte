<script lang="ts">
	import { enhance } from "$app/forms";
	import { resolve } from "$app/paths";
	import { site } from "$lib/site";

	let submitting = $state(false);
</script>

<svelte:head><title>Cerrar sesión | {site.title}</title></svelte:head>

<section class="hero min-h-[60vh]">
	<div class="hero-content">
		<div class="card max-w-md border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
			<div class="card-body text-center">
				<h1 class="card-title justify-center text-2xl">¿Quieres cerrar la sesión?</h1>
				<p class="text-[var(--color-text-soft)]">La sesión de este navegador finalizará.</p>
				<div class="card-actions mt-4 justify-center">
					<a class="btn min-h-12" href={resolve("/")}>Cancelar</a>
					<form
						method="POST"
						use:enhance={() => {
							submitting = true;
							return async ({ result }) => {
								if (result.type === "redirect") {
									// Force a hard navigation so the browser discards
									// all client-side state and the deleted cookie
									// is fully processed before the next request.
									window.location.href = result.location;
									return;
								}
								submitting = false;
							};
						}}
					>
						<button class="btn btn-primary min-h-12" disabled={submitting}>
							{submitting ? "Cerrando…" : "Cerrar sesión"}
						</button>
					</form>
				</div>
			</div>
		</div>
	</div>
</section>
