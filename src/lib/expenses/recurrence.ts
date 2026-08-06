/**
 * Pure recurrence arithmetic for recurring expense templates. Dates are
 * household-local calendar days (YYYY-MM-DD); ranges are start-inclusive
 * and end-exclusive, matching reporting-period semantics.
 *
 * Framework-neutral: no Kysely, no SvelteKit, no bindings.
 */

import type { TemplateCadence } from "./model";

export interface RecurrenceRule {
	cadence: TemplateCadence;
	/** Positive interval between scheduled occurrences. */
	intervalCount: number;
	/** First scheduled due date; earlier dates never schedule. */
	startDate: string;
	/** Optional last day on which an occurrence may schedule. */
	endDate?: string | null;
	/** Day-of-month override; defaults to the start date's day. */
	dueDay?: number | null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(date: string): { year: number; month: number; day: number } {
	if (!DATE_PATTERN.test(date)) {
		throw new Error("invalid_date");
	}
	return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)) };
}

function formatDate(year: number, month: number, day: number): string {
	return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Inclusive start and exclusive end calendar dates of a `YYYY-MM` month. */
export function monthRangeForPeriod(period: string): { start: string; end: string } {
	const { year, month } = parseDate(`${period}-01`);
	const endYear = month === 12 ? year + 1 : year;
	const endMonth = month === 12 ? 1 : month + 1;
	return { start: formatDate(year, month, 1), end: formatDate(endYear, endMonth, 1) };
}

function clampDay(year: number, month: number, day: number): number {
	return Math.min(day, daysInMonth(year, month));
}

function addInterval(startDate: string, steps: number, cadence: TemplateCadence, dueDay: number): string {
	const { year, month } = parseDate(startDate);
	const monthsPerStep = cadence === "monthly" ? 1 : 12;
	const totalMonths = month - 1 + steps * monthsPerStep;
	const targetYear = year + Math.floor(totalMonths / 12);
	const targetMonth = (totalMonths % 12) + 1;
	return formatDate(targetYear, targetMonth, clampDay(targetYear, targetMonth, dueDay));
}

/**
 * Scheduled due dates of the rule that fall inside [rangeStart, rangeEnd).
 * Iteration is bounded: it stops at the range end, at the rule end date,
 * or at a hard safety cap.
 */
export function scheduledDueDatesWithin(rule: RecurrenceRule, rangeStart: string, rangeEnd: string): string[] {
	if (rule.intervalCount <= 0 || !Number.isInteger(rule.intervalCount)) {
		throw new Error("recurrence_interval_not_positive");
	}
	const dueDay = rule.dueDay ?? parseDate(rule.startDate).day;
	const dates: string[] = [];
	const MAX_STEPS = 5000;
	for (let step = 0; step < MAX_STEPS; step += 1) {
		const candidate = addInterval(rule.startDate, step * rule.intervalCount, rule.cadence, dueDay);
		if (candidate >= rangeEnd) break;
		if (rule.endDate && candidate > rule.endDate) break;
		if (candidate < rangeStart) continue;
		if (candidate < rule.startDate) continue;
		dates.push(candidate);
	}
	return dates;
}

/**
 * Service span of a generated occurrence: from the first day of the due
 * month for the configured number of months. Returns null without a rule.
 */
export function serviceSpanFor(dueDate: string, spanMonths: number | null): { start: string; end: string } | null {
	if (spanMonths === null) return null;
	const { year, month } = parseDate(dueDate);
	const start = formatDate(year, month, 1);
	const totalMonths = month - 1 + spanMonths;
	const endYear = year + Math.floor(totalMonths / 12);
	const endMonth = (totalMonths % 12) + 1;
	return { start, end: formatDate(endYear, endMonth, 1) };
}
