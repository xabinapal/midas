<script lang="ts">
	import { resolve } from "$app/paths";

	interface Props {
		currentPath: string;
	}

	type NavigationIcon = "summary" | "expenses" | "balances" | "more";

	interface Destination {
		label: string;
		icon: NavigationIcon;
		href?: "/" | "/mas" | "/cuentas" | "/gastos";
	}

	const destinations: Destination[] = [
		{ label: "Resumen", icon: "summary", href: "/" },
		{ label: "Gastos", icon: "expenses", href: "/gastos" },
		{ label: "Saldos", icon: "balances", href: "/cuentas" },
		{ label: "Más", icon: "more", href: "/mas" },
	];

	let { currentPath }: Props = $props();

	function isActive(href: string): boolean {
		if (href === "/") return currentPath === "/";
		if (currentPath === href || currentPath.startsWith(`${href}/`)) return true;
		// Transfer workflows belong to the Saldos section
		if (href === "/cuentas" && currentPath.startsWith("/transferencias")) return true;
		// Payment workflows belong to the Gastos section
		return href === "/gastos" && currentPath.startsWith("/pagos");
	}
</script>

{#snippet navigationIcon(icon: NavigationIcon)}
	<svg
		aria-hidden="true"
		class="size-5 shrink-0"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
	>
		{#if icon === "summary"}
			<path d="M4 4h6v7H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 15h6v5H4z" />
		{:else if icon === "expenses"}
			<path d="M4 7h16M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
			<path d="M8 12h3M8 16h6" />
		{:else if icon === "balances"}
			<path d="M4 7h16M7 12h10M9 17h6" />
		{:else}
			<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
			<circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
			<circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
		{/if}
	</svg>
{/snippet}

<nav
	class="dock dock-lg fixed right-0 bottom-0 left-0 z-30 border-t border-[var(--color-divider)] bg-base-100 pb-[env(safe-area-inset-bottom)] lg:hidden"
	aria-label="Navegación móvil"
>
	{#each destinations.slice(0, 2) as destination (destination.label)}
		{#if destination.href}
			<a
				class:font-bold={isActive(destination.href)}
				class:text-primary={isActive(destination.href)}
				href={resolve(destination.href)}
				aria-current={isActive(destination.href) ? "page" : undefined}
			>
				{@render navigationIcon(destination.icon)}
				<span class="dock-label whitespace-normal">{destination.label}</span>
			</a>
		{:else}
			<button class="min-w-11 text-[var(--color-disabled-text)]" type="button" aria-disabled="true">
				{@render navigationIcon(destination.icon)}
				<span class="dock-label whitespace-normal">{destination.label}</span>
			</button>
		{/if}
	{/each}

	<div class="relative flex min-w-11 justify-center">
		<a
			class="btn btn-primary btn-circle min-h-12 min-w-12 -translate-y-3 shadow-[var(--shadow-raised)]"
			href={resolve("/gastos/nuevo")}
			aria-label="Añadir gasto"
		>
			<svg aria-hidden="true" class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
				<path d="M12 5v14M5 12h14" />
			</svg>
		</a>
		<span class="dock-label whitespace-normal">Añadir</span>
	</div>

	{#each destinations.slice(2) as destination (destination.label)}
		{#if destination.href}
			<a
				class:font-bold={isActive(destination.href)}
				class:text-primary={isActive(destination.href)}
				href={resolve(destination.href)}
				aria-current={isActive(destination.href) ? "page" : undefined}
			>
				{@render navigationIcon(destination.icon)}
				<span class="dock-label whitespace-normal">{destination.label}</span>
			</a>
		{:else}
			<button class="min-w-11 text-[var(--color-disabled-text)]" type="button" aria-disabled="true">
				{@render navigationIcon(destination.icon)}
				<span class="dock-label whitespace-normal">{destination.label}</span>
			</button>
		{/if}
	{/each}
</nav>

<nav
	class="fixed inset-y-0 left-0 z-20 hidden w-72 flex-col border-r border-[var(--color-divider)] bg-base-100 p-6 lg:flex"
	aria-label="Navegación de escritorio"
>
	<a class="mb-8 flex min-h-11 items-center text-2xl font-bold text-primary" href={resolve("/")}>Midas</a>
	<a class="btn btn-primary mb-6 min-h-12 w-full rounded-box" href={resolve("/gastos/nuevo")}>
		<svg aria-hidden="true" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
			<path d="M12 5v14M5 12h14" />
		</svg>
		Añadir gasto
	</a>
	<ul class="menu w-full gap-2 p-0">
		{#each destinations as destination (destination.label)}
			<li>
				{#if destination.href}
					<a
						class="flex min-h-12 items-center gap-3 rounded-box"
						class:menu-active={isActive(destination.href)}
						href={resolve(destination.href)}
						aria-current={isActive(destination.href) ? "page" : undefined}
					>
						{@render navigationIcon(destination.icon)}
						<span>{destination.label}</span>
					</a>
				{:else}
					<button
						class="flex min-h-12 items-center gap-3 rounded-box text-[var(--color-disabled-text)]"
						type="button"
						aria-disabled="true"
					>
						{@render navigationIcon(destination.icon)}
						<span>{destination.label}</span>
					</button>
				{/if}
			</li>
		{/each}
	</ul>
</nav>
