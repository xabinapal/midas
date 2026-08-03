export type ProtectedRouteKind = "page" | "api";

function routeBelongsToGroup(routeId: string, group: string): boolean {
	return routeId === `/${group}` || routeId.startsWith(`/${group}/`);
}

export function protectedRouteKind(routeId: string | null): ProtectedRouteKind | undefined {
	if (!routeId) return undefined;
	if (routeBelongsToGroup(routeId, "(protected)")) return "page";
	if (routeBelongsToGroup(routeId, "(protected-api)")) return "api";
	return undefined;
}

export function createLoginRedirect(url: URL): string {
	return `/login?next=${encodeURIComponent(`${url.pathname}${url.search}`)}`;
}

export function safeRedirectPath(value: string | null): string {
	if (!value) return "/";

	try {
		const base = new URL("https://local.invalid");
		const target = new URL(value, base);
		if (target.origin !== base.origin || !value.startsWith("/")) return "/";
		return `${target.pathname}${target.search}${target.hash}`;
	} catch {
		return "/";
	}
}
