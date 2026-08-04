<script lang="ts">
	import { enhance } from "$app/forms";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Configuración inicial | {site.title}</title></svelte:head>

<section class="hero min-h-screen bg-[var(--color-app-base)] px-4 py-8">
	<div class="hero-content w-full min-w-0 max-w-lg flex-col gap-6 p-0">
		<header class="w-full text-center">
			<p class="mb-2 text-sm font-semibold tracking-widest text-primary uppercase">{site.title}</p>
			<h1 class="break-words text-3xl font-bold tracking-tight">Configuración inicial</h1>
			<p class="mt-3 text-[var(--color-text-soft)]">Crea tu hogar, los primeros miembros y el usuario administrador.</p>
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
					<div class="divider text-sm text-[var(--color-text-soft)]">Credencial de configuración</div>

					<label class="fieldset" for="bootstrapCredential">
						<span class="fieldset-legend">Credencial</span>
						<input
							id="bootstrapCredential"
							name="bootstrapCredential"
							type="password"
							class="input min-h-12 w-full"
							class:input-error={data.form.errors.bootstrapCredential}
							bind:value={data.form.data.bootstrapCredential}
							autocomplete="off"
							required
						/>
						{#if data.form.errors.bootstrapCredential}
							<p class="label text-error">{data.form.errors.bootstrapCredential}</p>
						{/if}
					</label>

					<div class="divider text-sm text-[var(--color-text-soft)]">Hogar</div>

					<label class="fieldset" for="householdName">
						<span class="fieldset-legend">Nombre del hogar</span>
						<input
							id="householdName"
							name="householdName"
							type="text"
							class="input min-h-12 w-full"
							bind:value={data.form.data.householdName}
							placeholder="Piso, Casa..."
							required
						/>
						{#if data.form.errors.householdName}
							<p class="label text-error">{data.form.errors.householdName}</p>
						{/if}
					</label>

					<input type="hidden" name="currency" bind:value={data.form.data.currency} />
					<input type="hidden" name="timezone" bind:value={data.form.data.timezone} />

					<div class="divider text-sm text-[var(--color-text-soft)]">Miembros</div>

					<label class="fieldset" for="member1Name">
						<span class="fieldset-legend">Primer miembro (administrador)</span>
						<input
							id="member1Name"
							name="member1Name"
							type="text"
							class="input min-h-12 w-full"
							bind:value={data.form.data.member1Name}
							required
						/>
					</label>

					<label class="fieldset" for="member2Name">
						<span class="fieldset-legend">Segundo miembro</span>
						<input
							id="member2Name"
							name="member2Name"
							type="text"
							class="input min-h-12 w-full"
							bind:value={data.form.data.member2Name}
							required
						/>
						{#if data.form.errors.member2Name}
							<p class="label text-error">{data.form.errors.member2Name}</p>
						{/if}
					</label>

					<label class="fieldset" for="member3Name">
						<span class="fieldset-legend">Tercer miembro (opcional)</span>
						<input
							id="member3Name"
							name="member3Name"
							type="text"
							class="input min-h-12 w-full"
							bind:value={data.form.data.member3Name}
						/>
					</label>

					<div class="divider text-sm text-[var(--color-text-soft)]">Administrador</div>

					<label class="fieldset" for="adminUsername">
						<span class="fieldset-legend">Nombre de usuario</span>
						<input
							id="adminUsername"
							name="adminUsername"
							type="text"
							class="input min-h-12 w-full"
							bind:value={data.form.data.adminUsername}
							autocomplete="username"
							required
						/>
						{#if data.form.errors.adminUsername}
							<p class="label text-error">{data.form.errors.adminUsername}</p>
						{/if}
					</label>

					<label class="fieldset" for="adminPassword">
						<span class="fieldset-legend">Contraseña</span>
						<input
							id="adminPassword"
							name="adminPassword"
							type="password"
							class="input min-h-12 w-full"
							bind:value={data.form.data.adminPassword}
							autocomplete="new-password"
							required
						/>
						{#if data.form.errors.adminPassword}
							<p class="label text-error">{data.form.errors.adminPassword}</p>
						{/if}
					</label>

					{#if data.form.message}
						<div class="alert alert-error" role="alert">{data.form.message}</div>
					{/if}

					<button class="btn btn-primary min-h-12 w-full" disabled={submitting}>
						{submitting ? "Configurando…" : "Crear hogar"}
					</button>
				</form>
			</div>
		</div>
	</div>
</section>
