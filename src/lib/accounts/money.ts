/**
 * Minor-unit money helpers. Midas stores every monetary value as a signed
 * integer of minor units in the household currency. The minor-unit exponent
 * derives from the currency's ISO 4217 default fraction digits (2 for EUR,
 * 0 for JPY, 3 for KWD). Framework-neutral and safe on both server and
 * client.
 */

const exponentCache = new Map<string, number>();

export function minorUnitFactor(currency: string): number {
	let exponent = exponentCache.get(currency);
	if (exponent === undefined) {
		exponent =
			new Intl.NumberFormat("es-ES", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
		exponentCache.set(currency, exponent);
	}
	return 10 ** exponent;
}

/**
 * Domain cap: minor units must stay inside the safe-integer range so stored
 * records never lose precision. Inputs beyond this are rejected, not rounded.
 */
const MAX_MINOR_UNITS = Number.MAX_SAFE_INTEGER;

export function formatMinorUnits(amountMinor: number, currency: string): string {
	return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(
		amountMinor / minorUnitFactor(currency),
	);
}

const AMOUNT_PATTERN = /^(-?)(\d[\d.,]*)?$/;

/**
 * Parses a user-typed amount into minor units of the given currency. Accepts
 * decimal comma or point, and es-ES thousands dots. A single dot followed by
 * exactly three digits reads as a thousands separator ("1.234" → 123400
 * minor units in EUR); otherwise the separator is decimal. Returns null for
 * anything invalid or with more decimals than the currency allows.
 */
export function parseAmountToMinorUnits(input: string, currency = "EUR"): number | null {
	const text = input.trim();
	if (!AMOUNT_PATTERN.test(text) || text === "-" || text === "") {
		return null;
	}

	const negative = text.startsWith("-");
	const digits = negative ? text.slice(1) : text;
	if (!/^\d[\d.,]*$/.test(digits)) {
		return null;
	}

	const lastComma = digits.lastIndexOf(",");
	const lastDot = digits.lastIndexOf(".");
	let integerPart: string;
	let fractionalPart: string;

	if (lastComma >= 0 && lastDot >= 0) {
		if (lastComma < lastDot) return null;
		integerPart = digits.slice(0, lastComma).replaceAll(".", "");
		fractionalPart = digits.slice(lastComma + 1);
	} else if (lastComma >= 0) {
		if (digits.indexOf(",") !== lastComma) return null;
		integerPart = digits.slice(0, lastComma);
		fractionalPart = digits.slice(lastComma + 1);
	} else if (lastDot >= 0) {
		const groups = digits.split(".");
		const looksLikeThousands = groups.length > 2 || (groups.length === 2 && groups[1]!.length === 3);
		if (looksLikeThousands) {
			if (groups.slice(1).some((group) => group.length !== 3)) return null;
			integerPart = groups.join("");
			fractionalPart = "";
		} else {
			integerPart = groups[0]!;
			fractionalPart = groups[1] ?? "";
		}
	} else {
		integerPart = digits;
		fractionalPart = "";
	}

	const factor = minorUnitFactor(currency);
	const exponent = Math.log10(factor);
	if (integerPart === "" || fractionalPart.length > exponent) {
		return null;
	}

	const minor =
		Number.parseInt(integerPart, 10) * factor + Number.parseInt(fractionalPart.padEnd(exponent, "0") || "0", 10);
	if (minor > MAX_MINOR_UNITS) {
		return null;
	}
	return negative ? -minor : minor;
}
