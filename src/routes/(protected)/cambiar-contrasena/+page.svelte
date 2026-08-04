<script lang="ts">
	import { enhance } from "$app/forms";
	import { resolve } from "$app/paths";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Cambiar contraseña | {site.title}</title></svelte:head>

<section class="hero min-h-screen bg-[var(--color-app-base)] px-4 py-8">
	<div class="hero-content w-full min-w-0 max-w-md flex-col gap-6 p-0">
		<header class="w-full text-center">
			<h1 class="break-words text-3xl font-bold tracking-tight">
				{data.forced ? "Contraseña temporal" : "Cambiar contraseña"}
			</h1>
			<p class="mt-3 text-[var(--color-text-soft)]">
				{data.forced
					? "Debes elegir una nueva contraseña antes de continuar."
					: "Elige una contraseña nueva para tu cuenta."}
			</p>
		</header>

		<div class="card w-full border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
			<div class="card-body gap-4">
				<form
					method="POST"
					use:enhance={() => {
						submitting = true;
						return async ({ result, update }) => {
							submitting = false;
							if (result.type === "redirect") return;
							await update();
						};
					}}
					class="flex flex-col gap-4"
				>
					<label class="fieldset" for="currentPassword">
						<span class="fieldset-legend">Contraseña actual</span>
						<input
							id="currentPassword"
							name="currentPassword"
							type="password"
							autocomplete="current-password"
							class="input min-h-12 w-full"
							class:input-error={data.form.errors.currentPassword}
							bind:value={data.form.data.currentPassword}
							aria-invalid={data.form.errors.currentPassword ? "true" : undefined}
							required
						/>
						{#if data.form.errors.currentPassword}
							<p class="label text-error">{data.form.errors.currentPassword}</p>
						{/if}
					</label>

					<label class="fieldset" for="newPassword">
						<span class="fieldset-legend">Nueva contraseña</span>
						<input
							id="newPassword"
							name="newPassword"
							type="password"
							autocomplete="new-password"
							class="input min-h-12 w-full"
							class:input-error={data.form.errors.newPassword}
							bind:value={data.form.data.newPassword}
							aria-invalid={data.form.errors.newPassword ? "true" : undefined}
							required
						/>
						{#if data.form.errors.newPassword}
							<p class="label text-error">{data.form.errors.newPassword}</p>
						{/if}
					</label>

					<label class="fieldset" for="confirmPassword">
						<span class="fieldset-legend">Confirma la nueva contraseña</span>
						<input
							id="confirmPassword"
							name="confirmPassword"
							type="password"
							autocomplete="new-password"
							class="input min-h-12 w-full"
							class:input-error={data.form.errors.confirmPassword}
							bind:value={data.form.data.confirmPassword}
							aria-invalid={data.form.errors.confirmPassword ? "true" : undefined}
							required
						/>
						{#if data.form.errors.confirmPassword}
							<p class="label text-error">{data.form.errors.confirmPassword}</p>
						{/if}
					</label>

					{#if data.form.message}
						<div class="alert alert-error" role="alert">{data.form.message}</div>
					{/if}

					<div class="flex gap-2">
						{#if !data.forced}
							<a class="btn min-h-12 flex-1" href={resolve("/")}>Cancelar</a>
						{/if}
						<button class="btn btn-primary min-h-12 flex-1" disabled={submitting}>
							{submitting ? "Guardando…" : "Guardar contraseña"}
						</button>
					</div>
				</form>

				{#if data.forced}
					<a class="link link-hover text-center text-sm text-[var(--color-text-soft)]" href={resolve("/logout")}>
						Cerrar sesión
					</a>
				{/if}
			</div>
		</div>
	</div>
</section>
