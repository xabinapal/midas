import { site } from "$lib/site";
import type { RequestHandler } from "./$types";

const body = site.indexable ? "User-agent: *\nAllow: /\n" : "User-agent: *\nDisallow: /\n";

export const GET: RequestHandler = () => {
	return new Response(body, {
		headers: { "content-type": "text/plain; charset=utf-8" },
	});
};
