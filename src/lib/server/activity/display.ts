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
};

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
