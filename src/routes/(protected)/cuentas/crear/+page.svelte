<script lang="ts">
	import { resolve } from "$app/paths";
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms/client";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const { form, errors, enhance, submitting, message } = superForm(untrack(() => data.form));

	let classification = $derived($form.classification ?? "personal");
</script>

<svelte:head><title>Nueva cuenta | {site.title}</title></svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<header>
		<h1 class="text-2xl font-bold tracking-tight">Nueva cuenta</h1>
		<p class="text-sm text-[var(--color-text-soft)]">La cuenta se crea en borrador; actívala cuando quieras usarla.</p>
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
					<legend class="fieldset-legend">Tipo de cuenta</legend>
					<label class="label cursor-pointer justify-start gap-3">
						<input
							type="radio"
							name="classification"
							value="personal"
							class="radio"
							bind:group={$form.classification}
						/>
						<span>Personal · un único titular</span>
					</label>
					<label class="label cursor-pointer justify-start gap-3">
						<input type="radio" name="classification" value="shared" class="radio" bind:group={$form.classification} />
						<span>Compartida · al menos dos titulares</span>
					</label>
				</fieldset>

				<fieldset class="fieldset">
					<legend class="fieldset-legend">{classification === "personal" ? "Titular" : "Titulares"}</legend>
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
					{#if classification === "personal"}
						<p class="label text-[var(--color-text-soft)]">Selecciona exactamente un titular.</p>
					{/if}
					{#if $errors.holderMemberIds}
						<p class="label text-error">{$errors.holderMemberIds}</p>
					{/if}
				</fieldset>

				{#if $message}
					<div class="alert alert-error" role="alert">{$message}</div>
				{/if}

				<div class="flex gap-2">
					<a class="btn min-h-12 flex-1" href={resolve("/cuentas")}>Cancelar</a>
					<button class="btn btn-primary min-h-12 flex-1" disabled={$submitting}>
						{$submitting ? "Guardando…" : "Crear cuenta"}
					</button>
				</div>
			</form>
		</div>
	</div>
</div>
