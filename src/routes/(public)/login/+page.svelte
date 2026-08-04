<script lang="ts">
	import LoginForm from "$lib/components/login-form.svelte";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Iniciar sesión | {site.title}</title></svelte:head>

<section class="hero min-h-screen bg-[var(--color-app-base)] px-4 py-8">
	<div class="hero-content w-full min-w-0 !max-w-[calc(100vw-2rem)] flex-col gap-8 p-0 sm:!max-w-md">
		<header class="w-full min-w-0 text-center">
			<p class="mb-2 text-sm font-semibold tracking-widest text-primary uppercase">{site.title}</p>
			<h1 class="break-words text-3xl font-bold tracking-tight">Bienvenido de nuevo</h1>
			<p class="mt-3 text-[var(--color-text-soft)]">Inicia sesión con tu cuenta para continuar.</p>
		</header>

		<div class="card w-full border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
			<div class="card-body gap-6">
				<LoginForm data={data.form} />
			</div>
		</div>
	</div>
</section>
