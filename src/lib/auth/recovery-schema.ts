import { z } from "zod";
import { normalizeUsername } from "./login-schema";

export const recoverySchema = z.object({
	recoveryCredential: z.string().min(32, "La credencial de recuperación debe tener al menos 32 caracteres"),
	adminUsername: z.string().min(3, "Indica el nombre del administrador").max(64).transform(normalizeUsername),
	tempPassword: z.string().min(12, "La contraseña temporal debe tener al menos 12 caracteres").max(128),
});

export type RecoveryData = z.infer<typeof recoverySchema>;
