export interface PeriodNavigation {
	selectedPeriod: string;
	currentPeriod: string;
	previousHref: string;
	currentHref: string;
	nextHref: string;
}

const PERIOD_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function periodFromDate(date: Date): string {
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function shiftPeriod(period: string, months: number): string {
	const year = Number(period.slice(0, 4));
	const month = Number(period.slice(5, 7));
	return periodFromDate(new Date(Date.UTC(year, month - 1 + months, 1)));
}

function hrefForPeriod(url: URL, period: string): string {
	const target = new URL(url);
	target.searchParams.set("period", period);
	return `${target.pathname}${target.search}${target.hash}`;
}

export function getPeriodNavigation(url: URL, now = new Date()): PeriodNavigation {
	const currentPeriod = periodFromDate(now);
	const requestedPeriod = url.searchParams.get("period");
	const selectedPeriod = requestedPeriod && PERIOD_PATTERN.test(requestedPeriod) ? requestedPeriod : currentPeriod;

	return {
		selectedPeriod,
		currentPeriod,
		previousHref: hrefForPeriod(url, shiftPeriod(selectedPeriod, -1)),
		currentHref: hrefForPeriod(url, currentPeriod),
		nextHref: hrefForPeriod(url, shiftPeriod(selectedPeriod, 1)),
	};
}
