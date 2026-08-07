import { formatPeriod } from "$lib/format/format";
import type { AllocationMethodKind } from "$lib/expenses/allocation";
import type { PeriodKind, TemplateCadence, TemplateStatus } from "$lib/expenses/model";
import { monthRangeForPeriod, scheduledDueDatesWithin, serviceSpanFor } from "$lib/expenses/recurrence";
import { resolveUniqueReference, slugify } from "$lib/expenses/references";
import { logger } from "../logger";
import type { AccountRepository } from "../accounts/repository";
import type { MemberRepository } from "../household/repository";
import type {
	ExpenseCategoryRepository,
	ExpenseRecord,
	ExpenseRepository,
	RecurringTemplateRecord,
	RecurringTemplateRepository,
	ReportingPeriodRecord,
	ReportingPeriodRepository,
	TemplateAllocationParamRepository,
} from "./repository";
import type { OccurrenceInsertInput } from "./service";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface TemplateInput {
	categoryId: string;
	description: string;
	estimatedAmountMinor: number;
	cadence: TemplateCadence;
	intervalCount: number;
	startDate: string;
	endDate?: string | null;
	dueDay?: number | null;
	serviceSpanMonths?: number | null;
	accountHintId?: string | null;
	allocationMethod: AllocationMethodKind;
	allocationParams: { memberId: string; value: number | null }[];
}

export interface MaterializationFailure {
	templateId: string;
	reason: string;
}

export interface MaterializationResult {
	period: ReportingPeriodRecord;
	created: ExpenseRecord[];
	failures: MaterializationFailure[];
}

export interface OccurrencePort {
	insertOccurrence(
		householdId: string,
		input: OccurrenceInsertInput,
		actorUserId: string,
		now: string,
		operationId: string | null,
	): Promise<ExpenseRecord>;
}

interface PlanningDeps {
	periods: ReportingPeriodRepository;
	templates: RecurringTemplateRepository;
	templateParams: TemplateAllocationParamRepository;
	expenses: ExpenseRepository;
}

interface CatalogDeps {
	categories: ExpenseCategoryRepository;
	members: MemberRepository;
	accounts: AccountRepository;
}

export interface PlanningService {
	ensureStandardPeriod(
		householdId: string,
		periodSlug: string,
		now: string,
		operationId: string | null,
	): Promise<ReportingPeriodRecord>;
	createCustomPeriod(
		householdId: string,
		input: { label: string; startDate: string; endDate: string },
		now: string,
		operationId: string | null,
	): Promise<ReportingPeriodRecord>;
	listPeriods(householdId: string): Promise<ReportingPeriodRecord[]>;
	createTemplate(
		householdId: string,
		input: TemplateInput,
		now: string,
		operationId: string | null,
	): Promise<RecurringTemplateRecord>;
	updateTemplate(
		householdId: string,
		templateId: string,
		input: TemplateInput,
		now: string,
		operationId: string | null,
	): Promise<RecurringTemplateRecord>;
	setTemplateStatus(
		householdId: string,
		templateId: string,
		status: TemplateStatus,
		now: string,
		operationId: string | null,
	): Promise<RecurringTemplateRecord>;
	listTemplates(householdId: string): Promise<RecurringTemplateRecord[]>;
	materializeStandardPeriod(
		householdId: string,
		periodSlug: string,
		actorUserId: string,
		now: string,
		operationId: string | null,
	): Promise<MaterializationResult>;
}

export function createPlanningService(
	deps: PlanningDeps,
	catalog: CatalogDeps,
	occurrences: OccurrencePort,
): PlanningService {
	async function validateTemplateInput(householdId: string, input: TemplateInput) {
		const category = await catalog.categories.findById(input.categoryId);
		if (!category || category.householdId !== householdId) {
			throw new Error("category_not_found");
		}
		if (!category.isActive) {
			throw new Error("category_inactive");
		}
		if (!input.description.trim()) {
			throw new Error("expense_description_required");
		}
		if (!Number.isInteger(input.estimatedAmountMinor) || input.estimatedAmountMinor <= 0) {
			throw new Error("expense_amount_not_positive");
		}
		if (!Number.isInteger(input.intervalCount) || input.intervalCount <= 0) {
			throw new Error("recurrence_interval_not_positive");
		}
		if (!DATE_PATTERN.test(input.startDate)) {
			throw new Error("template_dates_invalid");
		}
		const endDate = input.endDate ?? null;
		if (endDate !== null && (!DATE_PATTERN.test(endDate) || endDate < input.startDate)) {
			throw new Error("template_dates_invalid");
		}
		const dueDay = input.dueDay ?? null;
		if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
			throw new Error("template_due_day_invalid");
		}
		const spanMonths = input.serviceSpanMonths ?? null;
		if (spanMonths !== null && (!Number.isInteger(spanMonths) || spanMonths <= 0)) {
			throw new Error("template_span_invalid");
		}
		// Fixed amounts cannot rebalance when the estimated amount changes
		// between generation runs, so templates stay proportional.
		if (input.allocationMethod === "fixed") {
			throw new Error("template_method_not_supported");
		}
		if (input.accountHintId) {
			const account = await catalog.accounts.findById(input.accountHintId);
			if (!account || account.householdId !== householdId) {
				throw new Error("account_not_found");
			}
		}
		if (input.allocationParams.length === 0) {
			throw new Error("allocation_members_empty");
		}
		for (const param of input.allocationParams) {
			const member = await catalog.members.findById(param.memberId);
			if (!member || member.householdId !== householdId) {
				throw new Error("allocation_member_not_found");
			}
			if (!member.isActive) {
				throw new Error("allocation_member_not_active");
			}
		}
		if (input.allocationMethod === "percentage") {
			const total = input.allocationParams.reduce((sum, param) => sum + (param.value ?? 0), 0);
			if (total !== 10000) {
				throw new Error("allocation_percentages_unbalanced");
			}
		}
		if (input.allocationMethod === "custom_weight") {
			const total = input.allocationParams.reduce((sum, param) => sum + (param.value ?? 0), 0);
			if (total <= 0) {
				throw new Error("allocation_weights_unbalanced");
			}
		}
	}

	return {
		async ensureStandardPeriod(householdId, periodSlug, now, operationId) {
			if (!PERIOD_PATTERN.test(periodSlug)) {
				throw new Error("period_slug_invalid");
			}
			const existing = await deps.periods.findBySlug(householdId, periodSlug);
			if (existing) {
				const visible = await deps.periods.findVisibleBySlug(householdId, periodSlug);
				if (visible) return existing;
				// Adopt an invisible period from a crashed creation attempt so
				// completing this operation publishes it.
				await deps.periods.reattributeOperation(existing.id, operationId, now);
				return { ...existing, operationId };
			}
			const { start, end } = monthRangeForPeriod(periodSlug);
			const record: ReportingPeriodRecord = {
				id: crypto.randomUUID(),
				householdId,
				slug: periodSlug,
				label: formatPeriod(periodSlug),
				startDate: start,
				endDate: end,
				kind: "standard",
				createdAt: now,
				operationId,
			};
			await deps.periods.create(record, now);
			return record;
		},

		async createCustomPeriod(householdId, input, now, operationId) {
			const label = input.label.trim();
			if (!label) {
				throw new Error("period_label_required");
			}
			if (
				!DATE_PATTERN.test(input.startDate) ||
				!DATE_PATTERN.test(input.endDate) ||
				input.startDate >= input.endDate
			) {
				throw new Error("period_dates_invalid");
			}
			const existing = await deps.periods.findByHousehold(householdId);
			const slug = resolveUniqueReference(
				slugify(label),
				existing.map((period) => period.slug),
			);
			const record: ReportingPeriodRecord = {
				id: crypto.randomUUID(),
				householdId,
				slug,
				label,
				startDate: input.startDate,
				endDate: input.endDate,
				kind: "custom" satisfies PeriodKind,
				createdAt: now,
				operationId,
			};
			await deps.periods.create(record, now);
			return record;
		},

		async listPeriods(householdId) {
			// Display paths never see periods of crashed creation operations.
			return deps.periods.findVisibleByHousehold(householdId);
		},

		async createTemplate(householdId, input, now, operationId) {
			await validateTemplateInput(householdId, input);
			const id = crypto.randomUUID();
			const record: RecurringTemplateRecord = {
				id,
				householdId,
				categoryId: input.categoryId,
				description: input.description.trim(),
				estimatedAmountMinor: input.estimatedAmountMinor,
				cadence: input.cadence,
				intervalCount: input.intervalCount,
				startDate: input.startDate,
				endDate: input.endDate ?? null,
				dueDay: input.dueDay ?? null,
				serviceSpanMonths: input.serviceSpanMonths ?? null,
				accountHintId: input.accountHintId ?? null,
				allocationMethod: input.allocationMethod,
				status: "active",
				createdAt: now,
				updatedAt: now,
				operationId,
			};
			await deps.templates.create(record, now);
			await deps.templateParams.replaceParams(id, input.allocationParams);
			return record;
		},

		async updateTemplate(householdId, templateId, input, now, operationId) {
			void operationId;
			const template = await deps.templates.findVisibleById(templateId);
			if (!template || template.householdId !== householdId) {
				throw new Error("template_not_found");
			}
			await validateTemplateInput(householdId, input);
			// Template edits are prospective: generated occurrences never change.
			await deps.templates.update(
				templateId,
				{
					categoryId: input.categoryId,
					description: input.description.trim(),
					estimatedAmountMinor: input.estimatedAmountMinor,
					cadence: input.cadence,
					intervalCount: input.intervalCount,
					startDate: input.startDate,
					endDate: input.endDate ?? null,
					dueDay: input.dueDay ?? null,
					serviceSpanMonths: input.serviceSpanMonths ?? null,
					accountHintId: input.accountHintId ?? null,
					allocationMethod: input.allocationMethod,
				},
				now,
			);
			await deps.templateParams.replaceParams(templateId, input.allocationParams);
			return { ...template, ...input, description: input.description.trim(), updatedAt: now };
		},

		async setTemplateStatus(householdId, templateId, status, now, operationId) {
			void operationId;
			const template = await deps.templates.findVisibleById(templateId);
			if (!template || template.householdId !== householdId) {
				throw new Error("template_not_found");
			}
			await deps.templates.setStatus(templateId, status, now);
			return { ...template, status, updatedAt: now };
		},

		async listTemplates(householdId) {
			return deps.templates.findByHousehold(householdId);
		},

		async materializeStandardPeriod(householdId, periodSlug, actorUserId, now, operationId) {
			if (!PERIOD_PATTERN.test(periodSlug)) {
				throw new Error("period_slug_invalid");
			}
			const period = await this.ensureStandardPeriod(householdId, periodSlug, now, operationId);
			const { start, end } = monthRangeForPeriod(periodSlug);
			const templates = (await deps.templates.findByHousehold(householdId)).filter(
				(template) => template.status === "active",
			);
			const members = await catalog.members.findByHousehold(householdId);
			const activeMembers = new Map(members.filter((member) => member.isActive).map((member) => [member.id, member]));

			const created: ExpenseRecord[] = [];
			const failures: MaterializationFailure[] = [];

			for (const template of templates) {
				try {
					const dueDates = scheduledDueDatesWithin(
						{
							cadence: template.cadence,
							intervalCount: template.intervalCount,
							startDate: template.startDate,
							endDate: template.endDate,
							dueDay: template.dueDay,
						},
						start,
						end,
					);
					if (dueDates.length === 0) continue;
					const params = await deps.templateParams.findByTemplate(template.id);
					// The stored subset resolves against the members active today;
					// default weights read current values at generation time.
					const allocationParams = params
						.filter((param) => activeMembers.has(param.memberId))
						.map((param) => ({
							memberId: param.memberId,
							value:
								template.allocationMethod === "default_weight"
									? (activeMembers.get(param.memberId)?.defaultWeight ?? 0)
									: param.value,
						}));
					if (allocationParams.length === 0) {
						throw new Error("template_members_empty");
					}

					for (const dueDate of dueDates) {
						// Canonical identity: at most one occurrence per template and
						// scheduled due date, regardless of retries or period views.
						const existing = await deps.expenses.findOccurrence(template.id, dueDate);
						if (existing) {
							const visible = await deps.expenses.findVisibleOccurrence(template.id, dueDate);
							if (visible) continue;
							// Adopt an invisible occurrence from a crashed generation
							// attempt; completing this operation publishes it.
							await deps.expenses.reattributeOperation(existing.id, operationId, now);
							created.push({ ...existing, operationId });
							continue;
						}
						const span = serviceSpanFor(dueDate, template.serviceSpanMonths);
						const occurrence = await occurrences.insertOccurrence(
							householdId,
							{
								categoryId: template.categoryId,
								reportingPeriodId: period.id,
								description: template.description,
								plannedAmountMinor: template.estimatedAmountMinor,
								accountingDate: dueDate,
								dueDate,
								serviceStartDate: span?.start ?? null,
								serviceEndDate: span?.end ?? null,
								accountHintId: template.accountHintId,
								allocationMethod: template.allocationMethod,
								allocationParams,
								templateId: template.id,
								scheduledDueDate: dueDate,
							},
							actorUserId,
							now,
							operationId,
						);
						created.push(occurrence);
					}
				} catch (error) {
					// One failing template must not block the others; the period
					// stays viewable and generation retries on the next open.
					const reason = error instanceof Error ? error.message : String(error);
					logger.warn("template occurrence generation failed", { templateId: template.id, reason });
					failures.push({ templateId: template.id, reason });
				}
			}

			return { period, created, failures };
		},
	};
}
