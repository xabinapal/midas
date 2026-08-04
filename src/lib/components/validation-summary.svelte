<script lang="ts">
	interface Props {
		errors: string[];
	}

	let { errors }: Props = $props();
</script>

{#if errors.length > 1}
	<section class="alert alert-error items-start" role="alert" aria-labelledby="validation-summary-title">
		<div>
			<h2 id="validation-summary-title" class="font-bold">Revisa los datos indicados</h2>
			<ul class="mt-2 list-disc space-y-1 pl-5">
				{#each errors as error, index (index)}
					<li>{error}</li>
				{/each}
			</ul>
		</div>
	</section>
{/if}
