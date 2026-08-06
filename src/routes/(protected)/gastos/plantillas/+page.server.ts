import { fail } from "@sveltejs/kit";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { createExpenseServices } from "$lib/server/expenses/services";
import { createHouseholdRepository } from "$lib/server/household/repository";
import { isGateConflict, isGateError, withGate } from "$lib/server/operations/with-gate";
import type { TemplateStatus } from "$lib/expenses/model";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	const householdId = locals.user!.householdId;
	const { planningService, repositories } = createExpenseServices(locals.db);

	const [templates, categories, household] = await Promise.all([
		planningService.listTemplates(householdId),
		repositories.categories.findByHousehold(householdId),
		createHouseholdRepository(locals.db).findById(householdId),
	]);
	const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

	const memberCountByTemplate = new Map<string, number>();
	for (const param of await repositories.templateParams.findByTemplates(templates.map((template) => template.id))) {
		memberCountByTemplate.set(param.templateId, (memberCountByTemplate.get(param.templateId) ?? 0) + 1);
	}

	const rows = templates.map((template) => ({
		template,
		categoryName: categoryNames.get(template.categoryId) ?? "Categoría",
		memberCount: memberCountByTemplate.get(template.id) ?? 0,
	}));

	return { rows, currency: household?.currency ?? "EUR" };
};

async function changeTemplateStatus(locals: App.Locals, request: Request, status: TemplateStatus) {
	const formData = await request.formData();
	const templateId = String(formData.get("templateId") ?? "");
	if (!templateId) return fail(400, { success: false, reason: "template_not_found" });

	const householdId = locals.user!.householdId;
	const { planningService } = createExpenseServices(locals.db);
	const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
		const now = new Date().toISOString();
		const template = await planningService.setTemplateStatus(householdId, templateId, status, now, ctx.operationId);
		await insertValidatedActivity(locals.db, {
			householdId,
			eventType: status === "disabled" ? "template_disabled" : "template_enabled",
			subjectType: "template",
			subjectId: templateId,
			actorUserId: locals.user!.id,
			summary: { templateDescription: template.description },
			operationId: ctx.operationId,
		});
	});

	if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
	if (isGateError(outcome)) return { success: false, reason: outcome.error.message };
	return { success: true };
}

export const actions: Actions = {
	disable: async ({ locals, request }) => changeTemplateStatus(locals, request, "disabled"),
	enable: async ({ locals, request }) => changeTemplateStatus(locals, request, "active"),
};
