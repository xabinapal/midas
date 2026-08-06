<script lang="ts">
	import { untrack } from "svelte";
	import { ALLOCATION_METHOD_LABELS } from "$lib/expenses/terms";

	type TemplateAllocationMethod = "equal" | "default_weight" | "custom_weight" | "percentage";

	interface MemberOption {
		id: string;
		displayName: string;
	}

	interface Props {
		members: MemberOption[];
		method: TemplateAllocationMethod;
		memberIds: string[];
		/** Prefill per member identifier for weight/percentage methods. */
		initialValues: Record<string, string>;
		methodError?: string[];
		memberError?: string[];
	}

	let {
		members,
		method = $bindable(),
		memberIds = $bindable(),
		initialValues,
		methodError,
		memberError,
	}: Props = $props();

	// Templates never offer fixed amounts: they cannot rebalance when the
	// estimated amount changes between generation runs.
	const methods: TemplateAllocationMethod[] = ["equal", "default_weight", "custom_weight", "percentage"];

	// Values live keyed by member: unchecking one member never shifts the
	// values of the rest. Submission order follows document order, which the
	// server aligns with the checked member identifiers.
	let valuesByMember = $state<Record<string, string>>(untrack(() => ({ ...initialValues })));

	const needsValues = $derived(method === "custom_weight" || method === "percentage");
	const valueLabel = $derived(method === "percentage" ? "Porcentaje" : "Peso");
</script>

<div class="flex flex-col gap-4">
	<label class="fieldset" for="allocationMethod">
		<span class="fieldset-legend">Reparto</span>
		<select id="allocationMethod" name="allocationMethod" class="select min-h-12 w-full" bind:value={method}>
			{#each methods as option (option)}
				<option value={option}>{ALLOCATION_METHOD_LABELS[option]}</option>
			{/each}
		</select>
		{#if methodError && methodError.length > 0}
			<p class="label text-error">{methodError}</p>
		{/if}
	</label>

	<fieldset class="fieldset">
		<legend class="fieldset-legend">Miembros del reparto</legend>
		<div class="flex flex-col gap-1">
			{#each members as member (member.id)}
				{@const selected = memberIds.includes(member.id)}
				<div class="flex flex-wrap items-center gap-x-4">
					<label class="label min-h-11 cursor-pointer items-center justify-start gap-3">
						<input type="checkbox" name="memberIds" value={member.id} class="checkbox" bind:group={memberIds} />
						<span>{member.displayName}</span>
					</label>
					{#if needsValues && selected}
						<label class="label min-h-11 items-center gap-2" for="member-value-{member.id}">
							<span class="text-sm text-[var(--color-text-soft)]">{valueLabel}</span>
							<input
								id="member-value-{member.id}"
								name="memberValues"
								type="text"
								inputmode="decimal"
								class="input min-h-11 w-28"
								bind:value={valuesByMember[member.id]}
							/>
							{#if method === "percentage"}
								<span aria-hidden="true">%</span>
							{/if}
						</label>
					{/if}
				</div>
			{/each}
		</div>
		{#if memberError && memberError.length > 0}
			<p class="label text-error">{memberError}</p>
		{/if}
	</fieldset>
</div>
