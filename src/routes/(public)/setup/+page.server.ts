import { redirect } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { setupSchema } from "$lib/auth/setup-schema";
import { performBootstrap } from "$lib/server/bootstrap/service";
import { env } from "$env/dynamic/private";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(303, "/");

	const userCount = await locals.db.selectFrom("users").select("id").limit(1).execute();
	if (userCount.length > 0) redirect(303, "/login");

	return { form: await superValidate(zod4(setupSchema)) };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(setupSchema));
		if (!form.valid) {
			form.data.bootstrapCredential = "";
			form.data.adminPassword = "";
			return message(form, "Revisa los datos indicados", { status: 400 });
		}

		const members = [
			{ displayName: form.data.member1Name.trim(), defaultWeight: 50 },
			{ displayName: form.data.member2Name.trim(), defaultWeight: 50 },
		];
		if (form.data.member3Name?.trim()) {
			members.push({ displayName: form.data.member3Name.trim(), defaultWeight: 0 });
		}

		const result = await performBootstrap(
			locals.db,
			{
				bootstrapCredential: form.data.bootstrapCredential,
				householdName: form.data.householdName.trim(),
				currency: form.data.currency.toUpperCase(),
				timezone: form.data.timezone,
				members,
				adminMemberIndex: 0,
				adminUsername: form.data.adminUsername.toLowerCase(),
				adminPassword: form.data.adminPassword,
			},
			env["BOOTSTRAP_CREDENTIAL"],
		);

		form.data.bootstrapCredential = "";
		form.data.adminPassword = "";

		if (!result.success) {
			return message(form, "No se pudo completar la configuración. Verifica la credencial e inténtalo de nuevo.", {
				status: 400,
			});
		}

		throw redirect(303, "/login");
	},
};
