<script lang="ts">
	import { page } from "$app/state";
	import { resolve } from "$app/paths";
</script>

<section class="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
	<h1 class="text-6xl font-bold text-primary">{page.status}</h1>
	<p class="text-lg opacity-70">{page.error?.message ?? "Unknown error"}</p>

	<a href={resolve("/")} class="btn btn-primary mt-4">Go Home</a>
</section>
