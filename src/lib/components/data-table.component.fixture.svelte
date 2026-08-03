<script lang="ts">
	import DataTable from "./data-table.svelte";
	import type { DataTableColumn, DataTableRow } from "./data-table";

	interface PersonRow extends DataTableRow {
		name: string;
		age: number;
	}

	let { rows }: { rows: PersonRow[] } = $props();

	const columns: DataTableColumn<PersonRow>[] = [
		{ key: "name", label: "Name" },
		{ key: "age", label: "Age", align: "end" },
	];
</script>

<DataTable caption="People" {columns} {rows} />
