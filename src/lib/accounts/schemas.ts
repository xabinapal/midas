import { z } from "zod";

/**
 * Shared form schemas for account and funding workflows. Keep them at
 * module scope so both the load and the action validate identically.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const accountSchema = z.object({
	name: z.string().min(1, "El nombre es obligatorio").max(100),
	classification: z.enum(["personal", "shared"]),
	holderMemberIds: z.array(z.string()).min(1, "Selecciona al menos un titular"),
});

export const accountEditSchema = z.object({
	name: z.string().min(1, "El nombre es obligatorio").max(100),
	holderMemberIds: z.array(z.string()).min(1, "Selecciona al menos un titular"),
});

export const transferSchema = z.object({
	sourceAccountId: z.string().min(1, "Selecciona la cuenta de origen"),
	destinationAccountId: z.string().min(1, "Selecciona la cuenta de destino"),
	amount: z.string().min(1, "El importe es obligatorio"),
	effectiveDate: z.string().regex(DATE_PATTERN, "Indica una fecha válida"),
	description: z.string().max(200).default(""),
	classification: z.enum(["unclassified", "pure", "contribution", "distribution"]).default("unclassified"),
});

export const observationSchema = z.object({
	amount: z.string().min(1, "El saldo observado es obligatorio"),
	effectiveDate: z.string().regex(DATE_PATTERN, "Indica una fecha válida"),
});

export const classifyTransferSchema = z.object({
	classification: z.enum(["pure", "contribution", "distribution"]),
});

export const correctionSchema = z
	.object({
		mode: z.enum(["reverse", "replace"]),
		amount: z.string().optional(),
		effectiveDate: z.string().optional(),
		description: z.string().max(200).optional(),
		fundingAccountId: z.string().optional(),
	})
	.superRefine((value, ctx) => {
		if (value.mode === "replace") {
			if (!value.amount || value.amount.trim().length === 0) {
				ctx.addIssue({ code: "custom", path: ["amount"], message: "El importe corregido es obligatorio" });
			}
			if (!value.effectiveDate || !DATE_PATTERN.test(value.effectiveDate)) {
				ctx.addIssue({ code: "custom", path: ["effectiveDate"], message: "Indica una fecha válida" });
			}
		}
	});

/** Converts a household-local date input value into an effective timestamp. */
export function effectiveAtFromDateInput(date: string): string {
	return `${date}T00:00:00.000Z`;
}

/**
 * Today's date-input value in the household's configured timezone, so the
 * default date matches the user's calendar even around midnight.
 */
export function todayDateInput(timezone: string): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}
