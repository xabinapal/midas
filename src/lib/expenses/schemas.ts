import { z } from "zod";

/**
 * Shared form schemas for expense, payment, category, and planning
 * workflows. Keep them at module scope so both the load and the action
 * validate identically.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const expenseFormSchema = z
	.object({
		description: z.string().min(1, "La descripción es obligatoria").max(200),
		categoryId: z.string().min(1, "Selecciona una categoría"),
		reportingPeriodId: z.string().min(1, "Selecciona un periodo"),
		amount: z.string().min(1, "El importe es obligatorio"),
		valueKind: z.enum(["actual", "estimated"]).default("actual"),
		accountingDate: z.string().regex(DATE_PATTERN, "Indica una fecha válida"),
		dueDate: z.string().optional(),
		serviceStartDate: z.string().optional(),
		serviceEndDate: z.string().optional(),
		accountHintId: z.string().optional(),
		allocationMethod: z.enum(["equal", "default_weight", "custom_weight", "percentage", "fixed"]).default("equal"),
		memberIds: z
			.array(z.string())
			.min(1, "Selecciona al menos un miembro")
			.max(64, "Demasiados miembros seleccionados"),
		// Per-member values keyed by position for weight/percentage/fixed methods.
		memberValues: z.array(z.string()).max(64, "Demasiados valores de reparto").default([]),
		paid: z.boolean().default(false),
		paymentAccountId: z.string().optional(),
		paymentDate: z.string().optional(),
	})
	.superRefine((value, ctx) => {
		if (value.dueDate && !DATE_PATTERN.test(value.dueDate)) {
			ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Indica una fecha válida" });
		}
		const start = value.serviceStartDate?.trim() ?? "";
		const end = value.serviceEndDate?.trim() ?? "";
		if (start || end) {
			if (!DATE_PATTERN.test(start) || !DATE_PATTERN.test(end)) {
				ctx.addIssue({ code: "custom", path: ["serviceStartDate"], message: "Indica un periodo de servicio válido" });
			} else if (start >= end) {
				ctx.addIssue({
					code: "custom",
					path: ["serviceEndDate"],
					message: "El fin del servicio debe ser posterior al inicio",
				});
			}
		}
		if (value.paid) {
			if (!value.paymentAccountId) {
				ctx.addIssue({ code: "custom", path: ["paymentAccountId"], message: "Selecciona la cuenta del pago" });
			}
			if (!value.paymentDate || !DATE_PATTERN.test(value.paymentDate)) {
				ctx.addIssue({ code: "custom", path: ["paymentDate"], message: "Indica la fecha del pago" });
			}
		}
	});

export const expectedEditSchema = z
	.object({
		description: z.string().min(1, "La descripción es obligatoria").max(200),
		amount: z.string().min(1, "El importe previsto es obligatorio"),
		dueDate: z.string().optional(),
		// Drafts may switch category; posted expected expenses keep theirs.
		categoryId: z.string().optional(),
		reportingPeriodId: z.string().optional(),
		serviceStartDate: z.string().optional(),
		serviceEndDate: z.string().optional(),
		accountHintId: z.string().optional(),
		allocationMethod: z.enum(["equal", "default_weight", "custom_weight", "percentage", "fixed"]).default("equal"),
		memberIds: z
			.array(z.string())
			.min(1, "Selecciona al menos un miembro")
			.max(64, "Demasiados miembros seleccionados"),
		memberValues: z.array(z.string()).max(64, "Demasiados valores de reparto").default([]),
	})
	.superRefine((value, ctx) => {
		if (value.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(value.dueDate)) {
			ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Indica una fecha válida" });
		}
		const start = value.serviceStartDate?.trim() ?? "";
		const end = value.serviceEndDate?.trim() ?? "";
		if (start || end) {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
				ctx.addIssue({ code: "custom", path: ["serviceStartDate"], message: "Indica un periodo de servicio válido" });
			} else if (start >= end) {
				ctx.addIssue({
					code: "custom",
					path: ["serviceEndDate"],
					message: "El fin del servicio debe ser posterior al inicio",
				});
			}
		}
	});

export const actualizeSchema = z.object({
	amount: z.string().min(1, "El importe real es obligatorio"),
});

export const paymentFormSchema = z.object({
	accountId: z.string().min(1, "Selecciona la cuenta del pago"),
	amount: z.string().min(1, "El importe es obligatorio"),
	effectiveDate: z.string().regex(DATE_PATTERN, "Indica una fecha válida"),
	description: z.string().min(1, "El concepto del pago es obligatorio").max(200),
	applicationAmount: z.string().optional(),
});

export const applicationFormSchema = z.object({
	expenseId: z.string().min(1, "Selecciona un gasto"),
	amount: z.string().min(1, "El importe es obligatorio"),
});

export const categoryFormSchema = z.object({
	name: z.string().min(1, "El nombre es obligatorio").max(100),
});

export const customPeriodSchema = z
	.object({
		label: z.string().min(1, "El nombre del periodo es obligatorio").max(100),
		startDate: z.string().regex(DATE_PATTERN, "Indica una fecha válida"),
		endDate: z.string().regex(DATE_PATTERN, "Indica una fecha válida"),
	})
	.superRefine((value, ctx) => {
		if (value.startDate >= value.endDate) {
			ctx.addIssue({ code: "custom", path: ["endDate"], message: "El fin debe ser posterior al inicio" });
		}
	});

export const templateFormSchema = z
	.object({
		description: z.string().min(1, "La descripción es obligatoria").max(200),
		categoryId: z.string().min(1, "Selecciona una categoría"),
		amount: z.string().min(1, "El importe estimado es obligatorio"),
		cadence: z.enum(["monthly", "yearly"]).default("monthly"),
		intervalCount: z.string().default("1"),
		startDate: z.string().regex(DATE_PATTERN, "Indica una fecha válida"),
		endDate: z.string().optional(),
		dueDay: z.string().optional(),
		serviceSpanMonths: z.string().optional(),
		accountHintId: z.string().optional(),
		allocationMethod: z.enum(["equal", "default_weight", "custom_weight", "percentage"]).default("equal"),
		memberIds: z
			.array(z.string())
			.min(1, "Selecciona al menos un miembro")
			.max(64, "Demasiados miembros seleccionados"),
		memberValues: z.array(z.string()).max(64, "Demasiados valores de reparto").default([]),
	})
	.superRefine((value, ctx) => {
		if (value.endDate) {
			if (!DATE_PATTERN.test(value.endDate)) {
				ctx.addIssue({ code: "custom", path: ["endDate"], message: "Indica una fecha válida" });
			} else if (value.endDate < value.startDate) {
				ctx.addIssue({ code: "custom", path: ["endDate"], message: "El fin debe ser posterior al inicio" });
			}
		}
		if (value.dueDay) {
			const day = Number(value.dueDay);
			if (!Number.isInteger(day) || day < 1 || day > 31) {
				ctx.addIssue({ code: "custom", path: ["dueDay"], message: "Indica un día del mes entre 1 y 31" });
			}
		}
		if (value.serviceSpanMonths) {
			const months = Number(value.serviceSpanMonths);
			if (!Number.isInteger(months) || months <= 0) {
				ctx.addIssue({ code: "custom", path: ["serviceSpanMonths"], message: "Indica un número de meses válido" });
			}
		}
	});

export const expenseCorrectionSchema = z
	.object({
		mode: z.enum(["reverse", "replace"]),
		amount: z.string().optional(),
		description: z.string().max(200).optional(),
	})
	.superRefine((value, ctx) => {
		if (value.mode === "replace" && (!value.amount || value.amount.trim().length === 0)) {
			ctx.addIssue({ code: "custom", path: ["amount"], message: "El importe corregido es obligatorio" });
		}
	});

export const paymentCorrectionSchema = z
	.object({
		mode: z.enum(["reverse", "replace"]),
		amount: z.string().optional(),
		description: z.string().max(200).optional(),
		accountId: z.string().optional(),
		effectiveDate: z.string().optional(),
	})
	.superRefine((value, ctx) => {
		if (value.mode === "replace") {
			if (!value.amount || value.amount.trim().length === 0) {
				ctx.addIssue({ code: "custom", path: ["amount"], message: "El importe corregido es obligatorio" });
			}
			if (!value.accountId || value.accountId.trim().length === 0) {
				ctx.addIssue({ code: "custom", path: ["accountId"], message: "Selecciona la cuenta del pago" });
			}
			if (!value.effectiveDate || !DATE_PATTERN.test(value.effectiveDate)) {
				ctx.addIssue({ code: "custom", path: ["effectiveDate"], message: "Indica una fecha válida" });
			}
		}
	});

export const evidenceFormSchema = z.object({
	label: z.string().min(1, "El nombre del enlace es obligatorio").max(100),
	url: z.string().min(1, "La URL es obligatoria").max(500),
	note: z.string().max(200).optional(),
});

export const linkActualSchema = z.object({
	actualExpenseId: z.string().min(1, "Selecciona el gasto real"),
});
