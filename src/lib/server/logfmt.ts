export type LogLevel = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

export function formatValue(value: unknown): string {
	let str: string;

	if (value === null || value === undefined) {
		return "";
	}
	if (typeof value === "number" || typeof value === "boolean") {
		str = String(value);
	} else if (typeof value === "string") {
		str = value;
	} else {
		str = JSON.stringify(value);
	}

	if (/[\s="]/.test(str)) {
		return `"${str.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
	}
	return str;
}

export function formatLine(
	level: LogLevel,
	msg: string,
	fields: Fields,
	ts: string = new Date().toISOString(),
): string {
	const parts = [`msg=${formatValue(msg)}`, `level=${level}`, `ts=${ts}`];
	for (const [key, value] of Object.entries(fields)) {
		const formatted = formatValue(value);
		if (formatted !== "") {
			parts.push(`${key}=${formatted}`);
		}
	}
	return parts.join(" ");
}
