const locale = "es-ES";

export function formatCurrency(value: number, currency: string): string {
	return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
}

export function formatDate(value: Date | string): string {
	const date = typeof value === "string" ? new Date(value) : value;
	return new Intl.DateTimeFormat(locale, {
		day: "2-digit",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	}).format(date);
}

export function formatNumber(value: number): string {
	return new Intl.NumberFormat(locale).format(value);
}

export function formatPercentage(value: number): string {
	return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(value);
}

export function formatPeriod(period: string): string {
	const formatted = new Intl.DateTimeFormat("es-ES", {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(`${period}-01T00:00:00Z`));
	return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
