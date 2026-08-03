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
				.min(3, "Username must contain at least 3 characters")
				.max(64, "Username must contain at most 64 characters")
				.regex(USERNAME_PATTERN, "Username contains unsupported characters"),
		),
	password: z.string().min(1, "Password is required").max(128, "Password must contain at most 128 characters"),
});

export type LoginData = z.infer<typeof loginSchema>;
