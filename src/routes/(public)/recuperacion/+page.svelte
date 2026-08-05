<script lang="ts">
	import { enhance } from "$app/forms";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();
	let submitting = $state(false);
	const activeForm = $derived(form?.form ?? data.form);
</script>

<svelte:head><title>Recuperación | {site.title}</title></svelte:head>

<section class="hero min-h-screen bg-[var(--color-app-base)] px-4 py-8">
	<div class="hero-content w-full min-w-0 max-w-md flex-col gap-6 p-0">
		<header class="w-full text-center">
			<h1 class="break-words text-3xl font-bold tracking-tight">Recuperación del operador</h1>
			<p class="mt-3 text-[var(--color-text-soft)]">Reactiva una cuenta de administrador bloqueada.</p>
		</header>

		<div class="card w-full border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
			<div class="card-body gap-4">
				<form
					method="POST"
					use:enhance={() => {
						submitting = true;
						return async ({ update }) => {
							submitting = false;
							await update();
						};
					}}
					class="flex flex-col gap-4"
				>
					<label class="fieldset" for="recoveryCredential">
						<span class="fieldset-legend">Credencial de recuperación</span>
						<input
							id="recoveryCredential"
							name="recoveryCredential"
							type="password"
							class="input min-h-12 w-full"
							bind:value={data.form.data.recoveryCredential}
							autocomplete="off"
							required
						/>
						{#if activeForm.errors.recoveryCredential}
							<p class="label text-error">{activeForm.errors.recoveryCredential}</p>
						{/if}
					</label>

					<label class="fieldset" for="adminUsername">
						<span class="fieldset-legend">Administrador objetivo</span>
						<input
							id="adminUsername"
							name="adminUsername"
							type="text"
							class="input min-h-12 w-full"
							bind:value={data.form.data.adminUsername}
							autocomplete="username"
							required
						/>
						{#if activeForm.errors.adminUsername}
							<p class="label text-error">{activeForm.errors.adminUsername}</p>
						{/if}
					</label>

					<label class="fieldset" for="tempPassword">
						<span class="fieldset-legend">Contraseña temporal</span>
						<input
							id="tempPassword"
							name="tempPassword"
							type="password"
							class="input min-h-12 w-full"
							bind:value={data.form.data.tempPassword}
							autocomplete="new-password"
							required
						/>
						{#if activeForm.errors.tempPassword}
							<p class="label text-error">{activeForm.errors.tempPassword}</p>
						{/if}
					</label>

					{#if activeForm.message}
						<div class="alert alert-error" role="alert">{activeForm.message}</div>
					{/if}

					<button class="btn btn-primary min-h-12 w-full" disabled={submitting}>
						{submitting ? "Procesando…" : "Recuperar acceso"}
					</button>
				</form>
			</div>
		</div>
	</div>
</section>
