import { fail } from "@sveltejs/kit";
import { message, setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { categoryFormSchema } from "$lib/expenses/schemas";
import { insertValidatedActivity } from "$lib/server/activity/insert";
import { createExpenseServices } from "$lib/server/expenses/services";
import { isGateConflict, isGateError, withGate } from "$lib/server/operations/with-gate";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	const householdId = locals.user!.householdId;
	const { expenseService, repositories } = createExpenseServices(locals.db);

	const categories = await expenseService.listCategories(householdId);
	const rows = await Promise.all(
		categories.map(async (category) => ({
			...category,
			hasReferences: await repositories.categories.hasExpenseReferences(category.id),
		})),
	);

	return { rows, form: await superValidate(zod4(categoryFormSchema)) };
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const householdId = locals.user!.householdId;
		const form = await superValidate(request, zod4(categoryFormSchema));
		if (!form.valid) return fail(400, { form });

		const { expenseService } = createExpenseServices(locals.db);
		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const category = await expenseService.createCategory(householdId, { name: form.data.name }, now, ctx.operationId);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "category_created",
				subjectType: "category",
				subjectId: category.id,
				actorUserId: locals.user!.id,
				summary: { categoryName: category.name },
				operationId: ctx.operationId,
			});
		});

		if (isGateConflict(outcome)) {
			return message(form, "Otra operación está en curso. Inténtalo de nuevo.", { status: 409 });
		}
		if (isGateError(outcome)) {
			switch (outcome.error.message) {
				case "category_name_taken":
					return setError(form, "name", "Ya existe una categoría activa con ese nombre");
				case "category_slug_taken":
					return setError(form, "name", "Ya existe una categoría con ese identificador");
				case "category_name_required":
					return setError(form, "name", "El nombre es obligatorio");
				default:
					return message(form, "No se pudo crear la categoría", { status: 400 });
			}
		}

		return { form };
	},

	deactivate: async ({ locals, request }) => {
		const formData = await request.formData();
		const categoryId = String(formData.get("categoryId") ?? "");
		if (!categoryId) return fail(400, { success: false, reason: "category_not_found" });

		const householdId = locals.user!.householdId;
		const { expenseService } = createExpenseServices(locals.db);
		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const category = await expenseService.deactivateCategory(householdId, categoryId, now, ctx.operationId);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "category_deactivated",
				subjectType: "category",
				subjectId: categoryId,
				actorUserId: locals.user!.id,
				summary: { categoryName: category.name },
				operationId: ctx.operationId,
			});
		});

		if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
		if (isGateError(outcome)) return { success: false, reason: outcome.error.message };
		return { success: true };
	},

	reactivate: async ({ locals, request }) => {
		const formData = await request.formData();
		const categoryId = String(formData.get("categoryId") ?? "");
		if (!categoryId) return fail(400, { success: false, reason: "category_not_found" });

		const householdId = locals.user!.householdId;
		const { expenseService } = createExpenseServices(locals.db);
		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const category = await expenseService.reactivateCategory(householdId, categoryId, now, ctx.operationId);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "category_reactivated",
				subjectType: "category",
				subjectId: categoryId,
				actorUserId: locals.user!.id,
				summary: { categoryName: category.name },
				operationId: ctx.operationId,
			});
		});

		if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
		if (isGateError(outcome)) return { success: false, reason: outcome.error.message };
		return { success: true };
	},

	rename: async ({ locals, request }) => {
		const formData = await request.formData();
		const categoryId = String(formData.get("categoryId") ?? "");
		const name = String(formData.get("name") ?? "").trim();
		if (!categoryId) return fail(400, { success: false, reason: "category_not_found" });
		if (!name) return fail(400, { success: false, reason: "category_name_required" });

		const householdId = locals.user!.householdId;
		const { expenseService } = createExpenseServices(locals.db);
		const outcome = await withGate(locals.db, householdId, locals.user!.id, async (ctx) => {
			const now = new Date().toISOString();
			const category = await expenseService.renameCategory(householdId, categoryId, name, now, ctx.operationId);
			await insertValidatedActivity(locals.db, {
				householdId,
				eventType: "category_renamed",
				subjectType: "category",
				subjectId: categoryId,
				actorUserId: locals.user!.id,
				summary: { categoryName: category.name },
				operationId: ctx.operationId,
			});
		});

		if (isGateConflict(outcome)) return { success: false, reason: "conflict" };
		if (isGateError(outcome)) return { success: false, reason: outcome.error.message };
		return { success: true };
	},
};
