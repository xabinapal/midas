import { describe, expect, it } from "vitest";
import { loginSchema } from "./login-schema";

describe("loginSchema", () => {
	it("normalizes valid usernames without changing passwords", () => {
		expect(loginSchema.parse({ username: "  Developer  ", password: "  exact password  " })).toEqual({
			username: "developer",
			password: "  exact password  ",
		});
	});

	it.each(["ab", "contains spaces", "invalid@name", "a".repeat(65)])("rejects invalid username %j", (username) => {
		expect(loginSchema.safeParse({ username, password: "password" }).success).toBe(false);
	});
});
