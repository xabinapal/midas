import { json } from "@sveltejs/kit";
import { site } from "$lib/site";

export const GET = () =>
	json({
		name: site.title,
		short_name: site.manifest.shortName,
		description: site.description,
		icons: [
			{
				src: "favicon.svg",
				sizes: "any",
				type: "image/svg+xml",
				purpose: "any",
			},
		],
		theme_color: site.themeColor,
		background_color: site.manifest.backgroundColor,
		display: site.manifest.display,
	});
