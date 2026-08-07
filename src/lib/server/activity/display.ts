/**
 * Maps a stored activity event to the safe human-readable detail rows shown
 * on the audit page. Summary names (written at event time) take precedence;
 * names joined from the current subject row act as a fallback for events
 * written before summaries carried display names.
 */

export interface ActivityDisplayInput {
	subjectType: string | null;
	subjectId: string | null;
	actorUserId: string | null;
	summary: string;
	subjectUsername?: string | null;
	subjectMemberName?: string | null;
}

export interface ActivityDetail {
	label: string;
	value: string;
}

const SUMMARY_LABELS: Record<string, string> = {
	username: "Usuario",
	memberName: "Miembro",
	householdName: "Hogar",
	memberCount: "N.º de miembros",
	defaultWeight: "Peso de reparto",
	target: "Usuario",
	accountName: "Cuenta",
	sourceAccountName: "Cuenta origen",
	destinationAccountName: "Cuenta destino",
	amount: "Importe",
	classification: "Clasificación",
	observedAt: "Fecha de observación",
	categoryName: "Categoría",
	expenseDescription: "Gasto",
	expenseReference: "Referencia",
	periodLabel: "Periodo",
	plannedAmount: "Importe previsto",
	actualAmount: "Importe real",
	paymentDescription: "Pago",
	fundingSource: "Origen de fondos",
	appliedAmount: "Importe aplicado",
	unappliedAmount: "Importe sin aplicar",
	templateDescription: "Plantilla",
	evidenceLabel: "Justificante",
	occurrenceCount: "Ocurrencias generadas",
};

/**
 * The single registry of Spanish activity event labels, shared by the audit
 * page and per-record history sections.
 */
export const EVENT_LABELS: Record<string, string> = {
	bootstrap_completed: "Configuración inicial completada",
	password_changed: "Contraseña cambiada",
	member_created: "Miembro creado",
	member_deactivated: "Miembro desactivado",
	member_reactivated: "Miembro reactivado",
	member_updated: "Miembro actualizado",
	member_deleted: "Miembro eliminado",
	user_created: "Usuario creado",
	user_disabled: "Usuario desactivado",
	user_reactivated: "Usuario reactivado",
	user_member_link_changed: "Asociación de miembro cambiada",
	password_reset: "Contraseña restablecida",
	admin_granted: "Permisos de administrador concedidos",
	admin_revoked: "Permisos de administrador revocados",
	session_created: "Sesión iniciada",
	session_revoked: "Sesión cerrada",
	operator_recovery: "Recuperación del operador",
	account_created: "Cuenta creada",
	account_updated: "Cuenta actualizada",
	account_activated: "Cuenta activada",
	account_closed: "Cuenta cerrada",
	account_reopened: "Cuenta reabierta",
	account_deleted: "Cuenta eliminada",
	transfer_posted: "Transferencia registrada",
	transfer_classified: "Transferencia clasificada",
	transfer_reversed: "Transferencia revertida",
	transfer_corrected: "Transferencia corregida",
	contribution_posted: "Aportación registrada",
	contribution_reversed: "Aportación revertida",
	contribution_corrected: "Aportación corregida",
	distribution_posted: "Distribución registrada",
	distribution_reversed: "Distribución revertida",
	distribution_corrected: "Distribución corregida",
	balance_observation_recorded: "Saldo observado",
	balance_observation_invalidated: "Observación invalidada",
	category_created: "Categoría creada",
	category_renamed: "Categoría renombrada",
	category_deactivated: "Categoría desactivada",
	category_reactivated: "Categoría reactivada",
	reporting_period_created: "Periodo creado",
	expense_posted: "Gasto registrado",
	expense_updated: "Gasto actualizado",
	expense_cancelled: "Gasto anulado",
	expense_actualized: "Importe real confirmado",
	expense_matched: "Gasto previsto vinculado",
	expense_unmatched: "Gasto previsto desvinculado",
	expense_reversed: "Gasto revertido",
	expense_corrected: "Gasto corregido",
	expense_deleted: "Borrador eliminado",
	evidence_added: "Justificante enlazado",
	evidence_removed: "Justificante retirado",
	payment_posted: "Pago registrado",
	payment_applied: "Pago aplicado",
	payment_application_reversed: "Aplicación revertida",
	payment_reversed: "Pago revertido",
	payment_corrected: "Pago corregido",
	template_created: "Plantilla creada",
	template_updated: "Plantilla actualizada",
	template_disabled: "Plantilla desactivada",
	template_enabled: "Plantilla reactivada",
	occurrence_generated: "Ocurrencia generada",
};

/** Detail-screen routes an activity subject links to, when one exists. */
export interface ActivitySubjectLink {
	kind: "expense" | "payment" | "account" | "member" | "template";
	id: string;
}

export function subjectLink(subjectType: string | null, subjectId: string | null): ActivitySubjectLink | null {
	if (!subjectId) return null;
	switch (subjectType) {
		case "expense":
			return { kind: "expense", id: subjectId };
		case "payment":
			return { kind: "payment", id: subjectId };
		case "account":
			return { kind: "account", id: subjectId };
		case "member":
			return { kind: "member", id: subjectId };
		case "template":
			return { kind: "template", id: subjectId };
		default:
			return null;
	}
}

const HIDDEN_KEYS = new Set(["action", "memberId", "targetUserId"]);

function parseSummary(raw: string): Record<string, string> {
	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(raw) as Record<string, unknown>;
	} catch {
		return {};
	}
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(parsed)) {
		if (HIDDEN_KEYS.has(key)) continue;
		if (typeof value === "string" || typeof value === "number") {
			result[key] = String(value);
		}
	}
	return result;
}

export function buildActivityDetails(input: ActivityDisplayInput): ActivityDetail[] {
	const summary = parseSummary(input.summary);
	const details: ActivityDetail[] = [];

	const namesUser = summary["username"] !== undefined || summary["target"] !== undefined;
	if (input.subjectUsername && input.subjectId !== input.actorUserId && !namesUser) {
		details.push({ label: SUMMARY_LABELS["username"]!, value: input.subjectUsername });
	}
	if (input.subjectMemberName && summary["memberName"] === undefined) {
		details.push({ label: SUMMARY_LABELS["memberName"]!, value: input.subjectMemberName });
	}

	for (const [key, value] of Object.entries(summary)) {
		details.push({ label: SUMMARY_LABELS[key] ?? key, value });
	}
	return details;
}
