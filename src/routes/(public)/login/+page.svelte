<script lang="ts">
	import LoginForm from "$lib/components/login-form.svelte";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();
</script>

<section class="hero min-h-[calc(100vh-2rem)]">
	<div class="hero-content w-full max-w-md flex-col gap-8">
		<header class="text-center">
			<p class="mb-2 text-sm font-semibold tracking-widest text-primary uppercase">{site.title}</p>
			<h1 class="text-4xl font-bold">Welcome back</h1>
			<p class="mt-3 opacity-70">Sign in with your internal account to continue.</p>
		</header>

		<div class="card w-full bg-base-200 shadow-xl">
			<div class="card-body gap-6">
				<LoginForm data={data.form} />
			</div>
		</div>
	</div>
</section>
