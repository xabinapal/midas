import { z } from "zod";

const USERNAME_PATTERN = /^[a-z0-9._-]+$/;

export function normalizeUsername(username: string): string {
	return username.trim().toLowerCase();
}

export const loginSchema = z.object({
	username: z
		.string()
		.transform(normalizeUsername)
		.pipe(
			z
				.string()
				.min(3, "El nombre de usuario debe tener al menos 3 caracteres")
				.max(64, "El nombre de usuario no puede superar los 64 caracteres")
				.regex(USERNAME_PATTERN, "El nombre de usuario contiene caracteres no permitidos"),
		),
	password: z.string().min(1, "Introduce la contraseña").max(128, "La contraseña no puede superar los 128 caracteres"),
});

export type LoginData = z.infer<typeof loginSchema>;
