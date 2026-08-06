import { todayDateInput } from "$lib/accounts/schemas";
import { formatPeriod } from "$lib/format/format";
import { getPeriodNavigation } from "$lib/period/period";
import { createAccountServices } from "$lib/server/accounts/services";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import type { ReportingPeriodRecord } from "$lib/server/expenses/repository";
import { createExpenseServices } from "$lib/server/expenses/services";
import { buildExpenseViews, sumPeriodTotals } from "$lib/server/expenses/views";
import { isGateConflict, isGateError, withGate } from "$lib/server/operations/with-gate";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
	const householdId = locals.user!.householdId;
	const { planningService, repositories } = createExpenseServices(locals.db);
	const household = await createAccountServices(locals.db).repositories.households.findById(householdId);
	const currency = household?.currency ?? "EUR";
	const currentDate = todayDateInput(household?.timezone ?? "Europe/Madrid");

	const navigation = getPeriodNavigation(url);
	const customSlug = url.searchParams.get("periodo");

	const allPeriods = await planningService.listPeriods(householdId);
	const customPeriods = allPeriods.filter((candidate) => candidate.kind === "custom");

	let period: ReportingPeriodRecord | undefined;
	let isCustomPeriod = false;
	let materializationFailures: { description: string; reason: string }[] = [];

	if (customSlug) {
		// Custom periods never generate occurrences; they only group expenses.
		period = customPeriods.find((candidate) => candidate.slug === customSlug);
		isCustomPeriod = period !== undefined;
	}

	if (!period) {
		const materialization = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const result = await planningService.materializeStandardPeriod(
				householdId,
				navigation.selectedPeriod,
				locals.user!.id,
				new Date().toISOString(),
				ctx.operationId,
			);
			if (result.created.length > 0) {
				await insertValidatedActivity(locals.db, {
					householdId,
					eventType: "occurrence_generated",
					subjectType: "reporting_period",
					subjectId: result.period.id,
					actorUserId: locals.user!.id,
					summary: { periodLabel: result.period.label, occurrenceCount: result.created.length },
					operationId: ctx.operationId,
				});
			}
			return result;
		});

		if (!isGateConflict(materialization) && !isGateError(materialization)) {
			period = materialization.result.period;
			if (materialization.result.failures.length > 0) {
				const templates = await planningService.listTemplates(householdId);
				const descriptionById = new Map(templates.map((template) => [template.id, template.description]));
				materializationFailures = materialization.result.failures.map((failure) => ({
					description: descriptionById.get(failure.templateId) ?? "una plantilla",
					reason: failure.reason,
				}));
			}
		} else {
			// The page must still render; generation retries on the next open.
			period = await repositories.periods.findBySlug(householdId, navigation.selectedPeriod);
			if (!period) {
				const ensured = await withGate(locals.db, householdId, locals.user!.id, async (ctx) =>
					planningService.ensureStandardPeriod(
						householdId,
						navigation.selectedPeriod,
						new Date().toISOString(),
						ctx.operationId,
					),
				);
				if (!isGateConflict(ensured) && !isGateError(ensured)) {
					period = ensured.result;
				} else {
					period = await repositories.periods.findBySlug(householdId, navigation.selectedPeriod);
				}
			}
		}
	}

	const expenses = period ? await repositories.expenses.listByPeriod(householdId, period.id) : [];
	const views = await buildExpenseViews(
		{
			categories: repositories.categories,
			allocations: repositories.allocations,
			applications: repositories.applications,
			members: repositories.members,
		},
		householdId,
		expenses,
		currentDate,
	);

	return {
		views,
		totals: sumPeriodTotals(views),
		periodLabel: period?.label ?? formatPeriod(navigation.selectedPeriod),
		periodSlug: period?.slug ?? navigation.selectedPeriod,
		isCustomPeriod,
		materializationFailures,
		navigation,
		customPeriods,
		currency,
		currentDate,
	};
};
