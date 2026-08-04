import { fail, redirect } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { z } from "zod";
import { createMemberRepository, createHouseholdRepository } from "$lib/server/household/repository";
import { createMemberService } from "$lib/server/household/service";
import type { Actions, PageServerLoad } from "./$types";

const memberSchema = z.object({
	displayName: z.string().min(1, "El nombre es obligatorio").max(100),
	defaultWeight: z.coerce.number().int().min(0, "El peso debe ser positivo").default(0),
});

export const load: PageServerLoad = async () => {
	return { form: await superValidate(zod4(memberSchema)) };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const form = await superValidate(request, zod4(memberSchema));
		if (!form.valid) return fail(400, { form });

		const db = locals.db;
		const members = createMemberRepository(db);
		const households = createHouseholdRepository(db);
		const service = createMemberService(members, households);

		try {
			await service.createMember(
				locals.user!.householdId,
				{ displayName: form.data.displayName, defaultWeight: form.data.defaultWeight },
				new Date().toISOString(),
			);
		} catch {
			return message(form, "No se pudo crear el miembro", { status: 400 });
		}

		throw redirect(303, "/mas/miembros");
	},
};
