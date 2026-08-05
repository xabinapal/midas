<script lang="ts">
	import { enhance } from "$app/forms";
	import { site } from "$lib/site";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();
	let showCreate = $state(false);
	let resetTarget = $state<string | null>(null);
	let tempPassword = $state("");
</script>

<svelte:head><title>Usuarios | {site.title}</title></svelte:head>

<div class="space-y-6">
	<header class="flex items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Usuarios</h1>
			<p class="text-sm text-[var(--color-text-soft)]">Cuentas con acceso al hogar.</p>
		</div>
		<button
			class="btn btn-primary min-h-12"
			type="button"
			onclick={() => {
				showCreate = !showCreate;
			}}
		>
			{showCreate ? "Cancelar" : "Nuevo usuario"}
		</button>
	</header>

	{#if form?.success === false}
		<div class="alert alert-error" role="alert">
			{form.reason === "last_administrator"
				? "No se puede realizar esta acción sobre el último administrador."
				: (form.reason ?? "Operación no permitida.")}
		</div>
	{/if}

	{#if form?.success === true}
		<div class="alert alert-success" role="status">Operación completada.</div>
	{/if}

	{#if showCreate}
		<div class="card border border-[var(--color-border)] bg-base-100 shadow-[var(--shadow-raised)]">
			<div class="card-body gap-4">
				<h2 class="text-lg font-bold">Crear usuario</h2>
				<form
					method="POST"
					action="?/create"
					use:enhance={() => {
						return async ({ update }) => {
							showCreate = false;
							await update();
						};
					}}
					class="flex flex-col gap-4"
				>
					<label class="fieldset" for="username">
						<span class="fieldset-legend">Nombre de usuario</span>
						<input
							id="username"
							name="username"
							type="text"
							class="input min-h-12 w-full"
							bind:value={data.createForm.data.username}
							autocomplete="username"
							required
						/>
						{#if data.createForm.errors.username}
							<p class="label text-error">{data.createForm.errors.username}</p>
						{/if}
					</label>

					<label class="fieldset" for="tempPassword">
						<span class="fieldset-legend">Contraseña temporal</span>
						<input
							id="tempPassword"
							name="tempPassword"
							type="password"
							class="input min-h-12 w-full"
							bind:value={data.createForm.data.tempPassword}
							autocomplete="new-password"
							required
						/>
						{#if data.createForm.errors.tempPassword}
							<p class="label text-error">{data.createForm.errors.tempPassword}</p>
						{/if}
					</label>

					{#if data.availableMembers.length > 0}
						<label class="fieldset" for="memberId">
							<span class="fieldset-legend">Miembro asociado (opcional)</span>
							<select id="memberId" name="memberId" class="select min-h-12 w-full">
								<option value="">Sin miembro</option>
								{#each data.availableMembers as member (member.id)}
									<option value={member.id}>{member.display_name}</option>
								{/each}
							</select>
						</label>
					{/if}

					{#if data.createForm.message}
						<div class="alert alert-error" role="alert">{data.createForm.message}</div>
					{/if}

					<button class="btn btn-primary min-h-12" type="submit">Crear usuario</button>
				</form>
			</div>
		</div>
	{/if}

	<div
		class="divide-y divide-[var(--color-divider)] overflow-hidden rounded-box border border-[var(--color-border)] bg-base-100"
	>
		{#each data.users as user (user.id)}
			<div class="space-y-3 p-4">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div>
						<div class="flex flex-wrap items-center gap-2">
							<p class="font-semibold">{user.username}</p>
							{#if user.is_administrator === 1}
								<span class="badge badge-sm badge-primary">Administrador</span>
							{/if}
							{#if user.id === data.currentUserId}
								<span class="badge badge-sm badge-ghost">Tú</span>
							{/if}
							{#if user.is_active === 0}
								<span class="badge badge-sm badge-ghost">Desactivado</span>
							{/if}
							{#if user.requires_password_change === 1}
								<span class="badge badge-sm badge-warning">Cambio pendiente</span>
							{/if}
						</div>
					</div>
					<div class="flex flex-wrap gap-2">
						{#if user.id !== data.currentUserId}
							{#if user.is_active === 1}
								<form method="POST" action="?/disable">
									<input type="hidden" name="userId" value={user.id} />
									<button class="btn btn-ghost btn-sm min-h-11" type="submit">Desactivar</button>
								</form>
								<form method="POST" action="?/toggleAdmin">
									<input type="hidden" name="userId" value={user.id} />
									<input type="hidden" name="makeAdmin" value={user.is_administrator === 1 ? "false" : "true"} />
									<button class="btn btn-ghost btn-sm min-h-11" type="submit">
										{user.is_administrator === 1 ? "Quitar admin" : "Hacer admin"}
									</button>
								</form>
								<button
									class="btn btn-ghost btn-sm min-h-11"
									type="button"
									onclick={() => {
										resetTarget = resetTarget === user.id ? null : user.id;
										tempPassword = "";
									}}
								>
									Restablecer contraseña
								</button>
							{:else}
								<form method="POST" action="?/reactivate">
									<input type="hidden" name="userId" value={user.id} />
									<button class="btn btn-ghost btn-sm min-h-11" type="submit">Reactivar</button>
								</form>
							{/if}
						{/if}
					</div>
				</div>

				{#if resetTarget === user.id}
					<form
						method="POST"
						action="?/resetPassword"
						use:enhance={() => {
							return async ({ update }) => {
								resetTarget = null;
								await update();
							};
						}}
						class="flex flex-col gap-2 rounded-box bg-base-200 p-3 sm:flex-row"
					>
						<input type="hidden" name="userId" value={user.id} />
						<input
							name="tempPassword"
							type="password"
							class="input min-h-12 flex-1"
							bind:value={tempPassword}
							placeholder="Contraseña temporal (mín. 12 caracteres)"
							autocomplete="new-password"
						/>
						<div class="flex gap-2">
							<button class="btn btn-primary btn-sm min-h-11" type="submit">Confirmar</button>
							<button
								class="btn btn-ghost btn-sm min-h-11"
								type="button"
								onclick={() => {
									resetTarget = null;
								}}>Cancelar</button
							>
						</div>
					</form>
				{/if}
			</div>
		{/each}
	</div>
</div>
