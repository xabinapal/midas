<script lang="ts">
	import { untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import type { LoginData } from "$lib/auth/login-schema";

	let { data }: { data: SuperValidated<LoginData, string> } = $props();
	const { form, errors, enhance, message, submitting } = superForm(untrack(() => data));
</script>

<form method="POST" use:enhance class="flex flex-col gap-4">
	<label class="fieldset" for="username">
		<span class="fieldset-legend">Username</span>
		<input
			id="username"
			name="username"
			type="text"
			autocomplete="username"
			class="input w-full"
			class:input-error={$errors.username}
			bind:value={$form.username}
			aria-invalid={$errors.username ? "true" : undefined}
			aria-describedby={$errors.username ? "username-errors" : undefined}
			required
		/>
		{#if $errors.username}
			<p id="username-errors" class="label text-error">{$errors.username.join(", ")}</p>
		{/if}
	</label>

	<label class="fieldset" for="password">
		<span class="fieldset-legend">Password</span>
		<input
			id="password"
			name="password"
			type="password"
			autocomplete="current-password"
			class="input w-full"
			class:input-error={$errors.password}
			bind:value={$form.password}
			aria-invalid={$errors.password ? "true" : undefined}
			aria-describedby={$errors.password ? "password-errors" : undefined}
			required
		/>
		{#if $errors.password}
			<p id="password-errors" class="label text-error">{$errors.password.join(", ")}</p>
		{/if}
	</label>

	{#if $message}
		<div class="alert alert-error" role="alert">{$message}</div>
	{/if}

	<button class="btn btn-primary w-full" disabled={$submitting}>
		{$submitting ? "Signing in..." : "Sign in"}
	</button>
</form>
