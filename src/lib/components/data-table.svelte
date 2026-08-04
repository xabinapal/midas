<script lang="ts" generics="Row extends DataTableRow">
	import { untrack } from "svelte";
	import { toStore } from "svelte/store";
	import { createTable } from "@humanspeak/svelte-headless-table";
	import { addPagination, addSortBy, addTableFilter } from "@humanspeak/svelte-headless-table/plugins";
	import type { DataTableColumn, DataTableRow } from "./data-table";

	let {
		caption,
		columns,
		rows,
		searchLabel = "Buscar",
		initialPageSize = 5,
	}: {
		caption: string;
		columns: DataTableColumn<Row>[];
		rows: Row[];
		searchLabel?: string;
		initialPageSize?: 5 | 10 | 20;
	} = $props();
	const initialColumns = untrack(() => columns.map((column) => ({ ...column })));

	const source = toStore(() => rows);
	const table = createTable(source, {
		filter: addTableFilter({
			fn: ({ filterValue, value }) => value.toLowerCase().includes(filterValue.toLowerCase()),
		}),
		sort: addSortBy({ disableMultiSort: true }),
		page: addPagination({ initialPageSize: untrack(() => initialPageSize) }),
	});
	const tableColumns = table.createColumns(
		initialColumns.map((column) =>
			table.column({
				header: column.label,
				accessor: (row) => row[column.key],
				id: column.key,
			}),
		),
	);
	const {
		pageRows,
		rows: filteredRows,
		pluginStates,
	} = table.createViewModel(tableColumns, {
		rowDataId: (row) => row.id,
	});
	const { filterValue } = pluginStates.filter;
	const { sortKeys } = pluginStates.sort;
	const { pageIndex, pageSize, pageCount, hasPreviousPage, hasNextPage } = pluginStates.page;

	function sortOrder(columnKey: string) {
		return $sortKeys.find((key) => key.id === columnKey)?.order;
	}

	function toggleSort(columnKey: string) {
		sortKeys.toggleId(columnKey, { multiSort: false });
		pageIndex.set(0);
	}

	function cellValue(row: Row, column: DataTableColumn<Row>) {
		const value = row[column.key];
		return column.format ? column.format(value, row) : value;
	}
</script>

<div class="flex w-full flex-col gap-4">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<label class="fieldset grow sm:max-w-xs">
			<span class="fieldset-legend">{searchLabel}</span>
			<input
				type="search"
				class="input w-full"
				placeholder="Filtrar filas…"
				bind:value={$filterValue}
				oninput={() => pageIndex.set(0)}
			/>
		</label>

		<label class="fieldset">
			<span class="fieldset-legend">Filas por página</span>
			<select class="select" bind:value={$pageSize} onchange={() => pageIndex.set(0)}>
				<option value={5}>5</option>
				<option value={10}>10</option>
				<option value={20}>20</option>
			</select>
		</label>
	</div>

	<div class="overflow-x-auto rounded-box border border-base-300">
		<table class="table table-zebra">
			<caption class="sr-only">{caption}</caption>
			<thead>
				<tr>
					{#each initialColumns as column (column.key)}
						<th
							scope="col"
							class:text-right={column.align === "end"}
							aria-sort={sortOrder(column.key) === "asc"
								? "ascending"
								: sortOrder(column.key) === "desc"
									? "descending"
									: undefined}
						>
							<button
								type="button"
								class="btn btn-ghost btn-sm"
								class:ml-auto={column.align === "end"}
								onclick={() => toggleSort(column.key)}
							>
								{column.label}
								<span aria-hidden="true">
									{#if sortOrder(column.key) === "asc"}
										&uarr;
									{:else if sortOrder(column.key) === "desc"}
										&darr;
									{:else}
										&varr;
									{/if}
								</span>
							</button>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each $pageRows as row (row.id)}
					<tr>
						{#each initialColumns as column (column.key)}
							<td class:text-right={column.align === "end"}>{cellValue(row.original, column)}</td>
						{/each}
					</tr>
				{:else}
					<tr>
						<td colspan={initialColumns.length} class="py-8 text-center opacity-70">No hay filas coincidentes</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="flex flex-wrap items-center justify-between gap-4">
		<p class="text-sm opacity-70" aria-live="polite">
			{$filteredRows.length}
			{$filteredRows.length === 1 ? "fila" : "filas"}
		</p>
		<div class="flex items-center gap-3">
			<span class="text-sm">
				Página {$pageCount === 0 ? 0 : $pageIndex + 1} de {$pageCount}
			</span>
			<div class="join">
				<button
					type="button"
					class="btn join-item"
					disabled={$pageCount === 0 || !$hasPreviousPage}
					onclick={() => pageIndex.update((index) => index - 1)}
				>
					Anterior
				</button>
				<button
					type="button"
					class="btn join-item"
					disabled={$pageCount === 0 || !$hasNextPage}
					onclick={() => pageIndex.update((index) => index + 1)}
				>
					Siguiente
				</button>
			</div>
		</div>
	</div>
</div>
