<!-- eslint-disable svelte/no-navigation-without-resolve -->
<script lang="ts">
	import { formatPeriod } from "$lib/format/format";
	import { getPeriodNavigation } from "$lib/period/period";

	interface Props {
		url: URL;
		currentDate?: Date;
	}

	let { url, currentDate = new Date() }: Props = $props();

	const navigation = $derived(getPeriodNavigation(url, currentDate));
	const periodLabel = $derived(formatPeriod(navigation.selectedPeriod));
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -->
<section class="flex flex-col items-center gap-2" aria-label="Periodo contable">
	<div class="join w-full max-w-md" aria-label="Seleccionar periodo">
		<a
			class="btn join-item min-h-12 min-w-12 bg-base-100 px-3"
			href={navigation.previousHref}
			aria-label="Mes anterior"
		>
			<svg aria-hidden="true" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="m15 18-6-6 6-6" />
			</svg>
		</a>
		<time
			class="btn join-item pointer-events-none min-h-12 flex-1 bg-base-100 px-2 text-center"
			datetime={navigation.selectedPeriod}
			aria-live="polite"
		>
			{periodLabel}
		</time>
		<a class="btn join-item min-h-12 min-w-12 bg-base-100 px-3" href={navigation.nextHref} aria-label="Mes siguiente">
			<svg aria-hidden="true" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="m9 18 6-6-6-6" />
			</svg>
		</a>
	</div>

	<a
		class="link link-primary min-h-11 content-center px-3 text-sm"
		href={navigation.currentHref}
		aria-label="Ir al mes actual"
		aria-current={navigation.selectedPeriod === navigation.currentPeriod ? "date" : undefined}
	>
		Mes actual
	</a>
</section>
