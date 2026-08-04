import { z } from "zod";

export const setupSchema = z
	.object({
		bootstrapCredential: z.string().min(32, "La credencial de configuración debe tener al menos 32 caracteres"),
		householdName: z.string().min(1, "El nombre del hogar es obligatorio").max(100),
		currency: z.string().length(3, "Usa un código de moneda ISO de 3 letras"),
		timezone: z.string().min(1),
		member1Name: z.string().min(1, "El nombre del primer miembro es obligatorio").max(100),
		member2Name: z.string().min(1, "El nombre del segundo miembro es obligatorio").max(100),
		member3Name: z.string().max(100).optional(),
		adminUsername: z
			.string()
			.min(3, "El nombre de usuario debe tener al menos 3 caracteres")
			.max(64)
			.regex(/^[a-z0-9._-]+$/, "Solo minúsculas, números, puntos, guiones y guiones bajos"),
		adminPassword: z.string().min(12, "La contraseña debe tener al menos 12 caracteres").max(128),
	})
	.refine((d) => d.member1Name.trim() !== d.member2Name.trim(), {
		message: "Los nombres de los miembros deben ser diferentes",
		path: ["member2Name"],
	});

export type SetupData = z.infer<typeof setupSchema>;
