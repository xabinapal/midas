<script lang="ts">
	import { page } from "$app/state";
	import { resolve } from "$app/paths";
	import { site } from "$lib/site";

	const title = $derived(page.status === 404 ? "Página no encontrada" : "No hemos podido completar la solicitud");
	const description = $derived(
		page.status === 404
			? "La página que buscas no existe o ha cambiado de dirección."
			: "Ha ocurrido un error inesperado. Vuelve a intentarlo en unos instantes.",
	);
</script>

<svelte:head><title>{title} | {site.title}</title></svelte:head>

<section class="hero min-h-screen bg-[var(--color-app-base)] px-4 text-center">
	<div class="hero-content max-w-lg flex-col gap-4">
		<p class="text-sm font-bold tracking-widest text-primary uppercase">Error {page.status}</p>
		<h1 class="text-3xl font-bold tracking-tight">{title}</h1>
		<p class="text-lg text-[var(--color-text-soft)]">{description}</p>
		<a href={resolve("/")} class="btn btn-primary mt-4 min-h-12">Volver al resumen</a>
	</div>
</section>
