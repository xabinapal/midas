<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import AppNavigation from "$lib/components/app-navigation.svelte";
	import { site } from "$lib/site";
	import type { LayoutProps } from "./$types";

	let { data, children }: LayoutProps = $props();
</script>

<div class="min-h-screen bg-[var(--color-app-base)] text-[var(--color-text)]">
	<AppNavigation currentPath={page.url.pathname} />

	<div class="lg:pl-72">
		<header class="navbar min-h-16 border-b border-[var(--color-divider)] bg-base-100 px-4 sm:px-6 lg:px-8">
			<div class="navbar-start lg:hidden">
				<a class="btn btn-ghost min-h-11 px-2 text-xl font-bold text-primary" href={resolve("/")}>{site.title}</a>
			</div>
			<div class="navbar-end ml-auto gap-2">
				{#if data.user}
					<span class="max-w-[40vw] truncate text-sm text-[var(--color-text-soft)]">{data.user.username}</span>
					<a class="btn btn-ghost min-h-11 px-2" href={resolve("/cambiar-contrasena")} aria-label="Cambiar contraseña">
						<svg
							aria-hidden="true"
							class="size-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<rect x="3" y="11" width="18" height="11" rx="2" />
							<path d="M7 11V7a5 5 0 0 1 10 0v4" />
						</svg>
					</a>
					<a class="btn btn-ghost min-h-11" href={resolve("/logout")}>Cerrar sesión</a>
				{/if}
			</div>
		</header>

		<main class="mx-auto max-w-5xl px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-10">
			{@render children()}
		</main>
	</div>
</div>
