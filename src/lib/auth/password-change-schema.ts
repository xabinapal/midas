import { z } from "zod";

export const passwordChangeSchema = z
	.object({
		currentPassword: z.string().min(1, "Introduce tu contraseña actual"),
		newPassword: z
			.string()
			.min(12, "La nueva contraseña debe tener al menos 12 caracteres")
			.max(128, "La contraseña no puede superar los 128 caracteres"),
		confirmPassword: z.string().min(1, "Confirma la nueva contraseña"),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Las contraseñas no coinciden",
		path: ["confirmPassword"],
	});

export type PasswordChangeData = z.infer<typeof passwordChangeSchema>;
