export type DataTableValue = string | number | boolean | null | undefined;

export interface DataTableRow {
	id: string;
}

export interface DataTableColumn<Row extends DataTableRow> {
	key: Extract<keyof Row, string>;
	label: string;
	align?: "start" | "end";
	format?: (value: Row[keyof Row], row: Row) => DataTableValue;
}
