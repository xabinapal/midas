import type { AllocationMethodKind } from "./allocation";
import type {
	ExpenseDueState,
	ExpenseLifecycle,
	ExpensePaymentStatus,
	ExpenseValueState,
	FundingSource,
	TemplateCadence,
	TemplateStatus,
} from "./model";

/**
 * Approved Spanish vocabulary for the expense and planning capability.
 * Keep every visible label here so the UI never invents its own wording.
 */

export const EXPENSE_VALUE_LABELS: Record<ExpenseValueState, string> = {
	estimated: "Estimado",
	actual: "Importe real",
};

export const EXPENSE_PAYMENT_STATUS_LABELS: Record<ExpensePaymentStatus, string> = {
	unpaid: "Sin pagar",
	partially_paid: "Pago parcial",
	paid: "Pagado",
};

export const EXPENSE_DUE_LABELS: Record<ExpenseDueState, string> = {
	none: "",
	upcoming: "Con vencimiento",
	due: "Vence hoy",
	overdue: "Vencido",
};

export const EXPENSE_LIFECYCLE_LABELS: Record<ExpenseLifecycle, string> = {
	draft: "Borrador",
	posted: "Registrado",
	cancelled: "Anulado",
	reversed: "Revertido",
};

export const ALLOCATION_METHOD_LABELS: Record<AllocationMethodKind, string> = {
	equal: "A partes iguales",
	default_weight: "Pesos del hogar",
	custom_weight: "Pesos personalizados",
	percentage: "Porcentajes",
	fixed: "Importes fijos",
};

export const FUNDING_SOURCE_LABELS: Record<FundingSource, string> = {
	member: "Pago personal",
	shared: "Fondos comunes",
};

export const TEMPLATE_CADENCE_LABELS: Record<TemplateCadence, string> = {
	monthly: "Mensual",
	yearly: "Anual",
};

export const TEMPLATE_STATUS_LABELS: Record<TemplateStatus, string> = {
	active: "Activa",
	disabled: "Desactivada",
};

/** Maps the domain due/payment/value dimensions to financial-status chips. */
export function paymentStatusToChip(status: ExpensePaymentStatus): "unpaid" | "payment-partial" | "paid" {
	if (status === "partially_paid") return "payment-partial";
	return status;
}
