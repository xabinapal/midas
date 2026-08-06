<script lang="ts">
	import { resolve } from "$app/paths";
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms/client";
	import { ACCOUNT_CLASSIFICATION_LABELS } from "$lib/accounts/terms";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const { form, errors, enhance, submitting, message } = superForm(untrack(() => data.form));
</script>

<svelte:head><title>Editar {data.account.name} | {site.title}</title></svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<header>
		<h1 class="text-2xl font-bold tracking-tight">Editar borrador</h1>
		<p class="text-sm text-[var(--color-text-soft)]">
			{ACCOUNT_CLASSIFICATION_LABELS[data.account.classification]} · solo las cuentas en borrador pueden editarse.
		</p>
	</header>

	<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
		<div class="card-body gap-4">
			<form method="POST" use:enhance class="flex flex-col gap-4">
				<label class="fieldset" for="name">
					<span class="fieldset-legend">Nombre</span>
					<input id="name" name="name" type="text" class="input min-h-12 w-full" bind:value={$form.name} required />
					{#if $errors.name}
						<p class="label text-error">{$errors.name}</p>
					{/if}
				</label>

				<fieldset class="fieldset">
					<legend class="fieldset-legend">{data.account.classification === "personal" ? "Titular" : "Titulares"}</legend
					>
					{#each data.members as member (member.id)}
						<label class="label cursor-pointer justify-start gap-3">
							<input
								type="checkbox"
								name="holderMemberIds"
								value={member.id}
								class="checkbox"
								bind:group={$form.holderMemberIds}
							/>
							<span>{member.displayName}</span>
						</label>
					{/each}
					{#if $errors.holderMemberIds}
						<p class="label text-error">{$errors.holderMemberIds}</p>
					{/if}
				</fieldset>

				{#if $message}
					<div class="alert alert-error" role="alert">{$message}</div>
				{/if}

				<div class="flex gap-2">
					<a class="btn min-h-12 flex-1" href={resolve(`/cuentas/${data.account.id}`)}>Cancelar</a>
					<button class="btn btn-primary min-h-12 flex-1" disabled={$submitting}>
						{$submitting ? "Guardando…" : "Guardar cambios"}
					</button>
				</div>
			</form>
		</div>
	</div>
</div>
