import type { Kysely } from "kysely";
import type { Database } from "../database";
import { visibleToProjection } from "../operations/visibility";
import type { AllocationMethodKind } from "$lib/expenses/allocation";
import type {
	AllocationBasis,
	ApplicationStatus,
	EvidenceStatus,
	ExpenseLifecycle,
	FundingSource,
	PeriodKind,
	TemplateCadence,
	TemplateStatus,
} from "$lib/expenses/model";

export interface ExpenseCategoryRecord {
	id: string;
	householdId: string;
	name: string;
	slug: string;
	ordering: number;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
	operationId: string | null;
}

export interface CreateExpenseCategoryInput {
	id: string;
	householdId: string;
	name: string;
	slug: string;
	ordering: number;
	operationId?: string | null;
}

export interface ReportingPeriodRecord {
	id: string;
	householdId: string;
	slug: string;
	label: string;
	startDate: string;
	endDate: string;
	kind: PeriodKind;
	createdAt: string;
	operationId: string | null;
}

export interface CreateReportingPeriodInput {
	id: string;
	householdId: string;
	slug: string;
	label: string;
	startDate: string;
	endDate: string;
	kind: PeriodKind;
	operationId?: string | null;
}

export interface RecurringTemplateRecord {
	id: string;
	householdId: string;
	categoryId: string;
	description: string;
	estimatedAmountMinor: number;
	cadence: TemplateCadence;
	intervalCount: number;
	startDate: string;
	endDate: string | null;
	dueDay: number | null;
	serviceSpanMonths: number | null;
	accountHintId: string | null;
	allocationMethod: AllocationMethodKind;
	status: TemplateStatus;
	createdAt: string;
	updatedAt: string;
	operationId: string | null;
}

export interface CreateRecurringTemplateInput {
	id: string;
	householdId: string;
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
	operationId?: string | null;
}

export interface UpdateRecurringTemplateFields {
	categoryId: string;
	description: string;
	estimatedAmountMinor: number;
	cadence: TemplateCadence;
	intervalCount: number;
	startDate: string;
	endDate: string | null;
	dueDay: number | null;
	serviceSpanMonths: number | null;
	accountHintId: string | null;
	allocationMethod: AllocationMethodKind;
}

export interface TemplateAllocationParamRecord {
	id: string;
	templateId: string;
	memberId: string;
	value: number | null;
}

export interface ExpenseRecord {
	id: string;
	householdId: string;
	categoryId: string;
	reportingPeriodId: string;
	description: string;
	reference: string | null;
	status: ExpenseLifecycle;
	plannedAmountMinor: number | null;
	plannedVersion: number;
	actualAmountMinor: number | null;
	accountingDate: string;
	dueDate: string | null;
	serviceStartDate: string | null;
	serviceEndDate: string | null;
	allocationMethod: AllocationMethodKind;
	accountHintId: string | null;
	templateId: string | null;
	scheduledDueDate: string | null;
	realizedByExpenseId: string | null;
	chainRootId: string;
	replacesId: string | null;
	reversedById: string | null;
	actorUserId: string | null;
	operationId: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface UpdateExpectedExpenseFields {
	description?: string;
	plannedAmountMinor?: number;
	plannedVersion?: number;
	dueDate?: string | null;
	reportingPeriodId?: string;
	serviceStartDate?: string | null;
	serviceEndDate?: string | null;
	accountHintId?: string | null;
	allocationMethod?: AllocationMethodKind;
}

export interface UpdateDraftExpenseFields {
	categoryId: string;
	reportingPeriodId: string;
	description: string;
	plannedAmountMinor: number | null;
	actualAmountMinor: number | null;
	accountingDate: string;
	dueDate: string | null;
	serviceStartDate: string | null;
	serviceEndDate: string | null;
	accountHintId: string | null;
	allocationMethod: AllocationMethodKind;
}

export interface ExpenseAllocationLineRecord {
	id: string;
	expenseId: string;
	memberId: string;
	basis: AllocationBasis;
	amountMinor: number;
}

export interface ExpenseAllocationParamRecord {
	id: string;
	expenseId: string;
	memberId: string;
	value: number | null;
}

export interface PaymentRecord {
	id: string;
	householdId: string;
	accountId: string;
	amountMinor: number;
	description: string;
	effectiveAt: string;
	orderingKey: string;
	recordedAt: string;
	fundingSource: FundingSource;
	funderMemberId: string | null;
	status: "posted" | "reversed";
	chainRootId: string;
	reversalOfId: string | null;
	replacesId: string | null;
	reversedById: string | null;
	actorUserId: string | null;
	operationId: string | null;
	createdAt: string;
}

export interface PaymentAccountEntryRecord {
	id: string;
	accountId: string;
	paymentId: string;
	chainRootId: string;
	amountMinor: number;
	effectiveAt: string;
	orderingKey: string;
	recordedAt: string;
	operationId: string | null;
}

export interface PaymentApplicationRecord {
	id: string;
	householdId: string;
	paymentId: string;
	expenseId: string;
	amountMinor: number;
	status: ApplicationStatus;
	recordedAt: string;
	reversedAt: string | null;
	operationId: string | null;
}

export interface ExpenseEvidenceRecord {
	id: string;
	expenseId: string;
	householdId: string;
	label: string;
	url: string;
	note: string | null;
	status: EvidenceStatus;
	createdBy: string | null;
	createdAt: string;
	removedAt: string | null;
	operationId: string | null;
}

export interface ExpenseCategoryRepository {
	create(input: CreateExpenseCategoryInput, now: string): Promise<void>;
	findById(id: string): Promise<ExpenseCategoryRecord | undefined>;
	findByHousehold(householdId: string): Promise<ExpenseCategoryRecord[]>;
	update(id: string, fields: { name?: string; ordering?: number }, now: string): Promise<void>;
	setActive(id: string, isActive: boolean, now: string): Promise<void>;
	hasExpenseReferences(id: string): Promise<boolean>;
}

export interface ReportingPeriodRepository {
	create(input: CreateReportingPeriodInput, now: string): Promise<void>;
	findById(id: string): Promise<ReportingPeriodRecord | undefined>;
	findBySlug(householdId: string, slug: string): Promise<ReportingPeriodRecord | undefined>;
	findVisibleBySlug(householdId: string, slug: string): Promise<ReportingPeriodRecord | undefined>;
	/** Raw list, including invisible rows: for slug-uniqueness checks only. */
	findByHousehold(householdId: string): Promise<ReportingPeriodRecord[]>;
	findVisibleByHousehold(householdId: string): Promise<ReportingPeriodRecord[]>;
	reattributeOperation(id: string, operationId: string | null, now: string): Promise<void>;
}

export interface RecurringTemplateRepository {
	create(input: CreateRecurringTemplateInput, now: string): Promise<void>;
	findById(id: string): Promise<RecurringTemplateRecord | undefined>;
	findVisibleById(id: string): Promise<RecurringTemplateRecord | undefined>;
	findByHousehold(householdId: string): Promise<RecurringTemplateRecord[]>;
	update(id: string, fields: UpdateRecurringTemplateFields, now: string): Promise<void>;
	setStatus(id: string, status: TemplateStatus, now: string): Promise<void>;
}

export interface TemplateAllocationParamRepository {
	replaceParams(templateId: string, params: { memberId: string; value: number | null }[]): Promise<void>;
	findByTemplate(templateId: string): Promise<TemplateAllocationParamRecord[]>;
	findByTemplates(templateIds: string[]): Promise<TemplateAllocationParamRecord[]>;
}

export interface ExpenseRepository {
	create(input: ExpenseRecord): Promise<void>;
	findById(id: string): Promise<ExpenseRecord | undefined>;
	findVisibleById(id: string): Promise<ExpenseRecord | undefined>;
	findByOperationId(operationId: string): Promise<ExpenseRecord | undefined>;
	listByPeriod(householdId: string, reportingPeriodId: string): Promise<ExpenseRecord[]>;
	listPostedByHousehold(householdId: string, limit?: number): Promise<ExpenseRecord[]>;
	listByChainRoot(chainRootId: string): Promise<ExpenseRecord[]>;
	findReferencesLike(householdId: string, base: string): Promise<string[]>;
	findOccurrence(templateId: string, scheduledDueDate: string): Promise<ExpenseRecord | undefined>;
	findVisibleOccurrence(templateId: string, scheduledDueDate: string): Promise<ExpenseRecord | undefined>;
	findByRealizedBy(actualExpenseId: string): Promise<ExpenseRecord[]>;
	updateDraft(id: string, fields: UpdateDraftExpenseFields, now: string): Promise<void>;
	updateExpected(id: string, fields: UpdateExpectedExpenseFields, now: string): Promise<void>;
	markCancelled(id: string, now: string): Promise<void>;
	markReversed(id: string, reversedById: string | null, now: string): Promise<void>;
	setActualAmount(id: string, actualAmountMinor: number, now: string): Promise<void>;
	setRealizedBy(id: string, actualExpenseId: string | null, now: string): Promise<void>;
	reattributeOperation(id: string, operationId: string | null, now: string): Promise<void>;
	remove(id: string): Promise<void>;
}

export interface ExpenseAllocationRepository {
	replaceLines(
		expenseId: string,
		basis: AllocationBasis,
		lines: { memberId: string; amountMinor: number }[],
	): Promise<void>;
	findByExpense(expenseId: string): Promise<ExpenseAllocationLineRecord[]>;
	findByExpenses(expenseIds: string[]): Promise<ExpenseAllocationLineRecord[]>;
	deleteByExpense(expenseId: string): Promise<void>;
}

export interface ExpenseAllocationParamRepository {
	replaceParams(expenseId: string, params: { memberId: string; value: number | null }[]): Promise<void>;
	findByExpense(expenseId: string): Promise<ExpenseAllocationParamRecord[]>;
	deleteByExpense(expenseId: string): Promise<void>;
}

export interface PaymentRepository {
	create(input: PaymentRecord): Promise<void>;
	findById(id: string): Promise<PaymentRecord | undefined>;
	findVisibleById(id: string): Promise<PaymentRecord | undefined>;
	findByOperationId(operationId: string): Promise<PaymentRecord | undefined>;
	findReversalOf(paymentId: string): Promise<PaymentRecord | undefined>;
	findReplacement(replacesId: string): Promise<PaymentRecord | undefined>;
	listByAccount(accountId: string): Promise<PaymentRecord[]>;
	listByHousehold(householdId: string): Promise<PaymentRecord[]>;
	markReversed(id: string, reversedById: string): Promise<void>;
}

export interface PaymentEntryRepository {
	appendMany(entries: PaymentAccountEntryRecord[]): Promise<void>;
	findByAccount(accountId: string): Promise<PaymentAccountEntryRecord[]>;
	findByAccountAfter(accountId: string, orderingKey: string): Promise<PaymentAccountEntryRecord[]>;
}

export interface PaymentApplicationRepository {
	create(input: PaymentApplicationRecord): Promise<void>;
	findById(id: string): Promise<PaymentApplicationRecord | undefined>;
	findVisibleById(id: string): Promise<PaymentApplicationRecord | undefined>;
	findActiveByExpense(expenseId: string): Promise<PaymentApplicationRecord[]>;
	findActiveByPayment(paymentId: string): Promise<PaymentApplicationRecord[]>;
	findActiveByHousehold(householdId: string): Promise<PaymentApplicationRecord[]>;
	findByExpense(expenseId: string): Promise<PaymentApplicationRecord[]>;
	markReversed(id: string, reversedAt: string): Promise<void>;
}

export interface ExpenseEvidenceRepository {
	add(input: ExpenseEvidenceRecord): Promise<void>;
	findById(id: string): Promise<ExpenseEvidenceRecord | undefined>;
	findActiveByExpense(expenseId: string): Promise<ExpenseEvidenceRecord[]>;
	deleteByExpense(expenseId: string): Promise<void>;
	markRemoved(id: string, removedAt: string): Promise<void>;
}

function toCategory(row: {
	id: string;
	household_id: string;
	name: string;
	slug: string;
	ordering: number;
	is_active: 0 | 1;
	created_at: string;
	updated_at: string;
	operation_id: string | null;
}): ExpenseCategoryRecord {
	return {
		id: row.id,
		householdId: row.household_id,
		name: row.name,
		slug: row.slug,
		ordering: row.ordering,
		isActive: row.is_active === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		operationId: row.operation_id,
	};
}

export function createExpenseCategoryRepository(db: Kysely<Database>): ExpenseCategoryRepository {
	return {
		async create(input, now) {
			await db
				.insertInto("expense_categories")
				.values({
					id: input.id,
					household_id: input.householdId,
					name: input.name,
					slug: input.slug,
					ordering: input.ordering,
					is_active: 1,
					created_at: now,
					updated_at: now,
					operation_id: input.operationId ?? null,
				})
				.execute();
		},

		async findById(id) {
			const row = await db.selectFrom("expense_categories").selectAll().where("id", "=", id).executeTakeFirst();
			return row ? toCategory(row) : undefined;
		},

		async findByHousehold(householdId) {
			const rows = await db
				.selectFrom("expense_categories")
				.selectAll()
				.where("household_id", "=", householdId)
				.orderBy("ordering", "asc")
				.orderBy("name", "asc")
				.execute();
			return rows.map(toCategory);
		},

		async update(id, fields, now) {
			await db
				.updateTable("expense_categories")
				.set({ name: fields.name, ordering: fields.ordering, updated_at: now })
				.where("id", "=", id)
				.execute();
		},

		async setActive(id, isActive, now) {
			await db
				.updateTable("expense_categories")
				.set({ is_active: isActive ? 1 : 0, updated_at: now })
				.where("id", "=", id)
				.execute();
		},

		async hasExpenseReferences(id) {
			const row = await db.selectFrom("expenses").select("id").where("category_id", "=", id).executeTakeFirst();
			return row !== undefined;
		},
	};
}

function toPeriod(row: {
	id: string;
	household_id: string;
	slug: string;
	label: string;
	start_date: string;
	end_date: string;
	kind: string;
	created_at: string;
	operation_id: string | null;
}): ReportingPeriodRecord {
	return {
		id: row.id,
		householdId: row.household_id,
		slug: row.slug,
		label: row.label,
		startDate: row.start_date,
		endDate: row.end_date,
		kind: row.kind as PeriodKind,
		createdAt: row.created_at,
		operationId: row.operation_id,
	};
}

export function createReportingPeriodRepository(db: Kysely<Database>): ReportingPeriodRepository {
	return {
		async create(input, now) {
			await db
				.insertInto("reporting_periods")
				.values({
					id: input.id,
					household_id: input.householdId,
					slug: input.slug,
					label: input.label,
					start_date: input.startDate,
					end_date: input.endDate,
					kind: input.kind,
					created_at: now,
					operation_id: input.operationId ?? null,
				})
				.execute();
		},

		async findById(id) {
			const row = await db.selectFrom("reporting_periods").selectAll().where("id", "=", id).executeTakeFirst();
			return row ? toPeriod(row) : undefined;
		},

		async findBySlug(householdId, slug) {
			const row = await db
				.selectFrom("reporting_periods")
				.selectAll()
				.where("household_id", "=", householdId)
				.where("slug", "=", slug)
				.executeTakeFirst();
			return row ? toPeriod(row) : undefined;
		},

		async findVisibleBySlug(householdId, slug) {
			const row = await db
				.selectFrom("reporting_periods")
				.leftJoin("operation_roots", "operation_roots.id", "reporting_periods.operation_id")
				.selectAll("reporting_periods")
				.where("reporting_periods.household_id", "=", householdId)
				.where("reporting_periods.slug", "=", slug)
				.where((eb) => visibleToProjection(eb, "reporting_periods.operation_id"))
				.executeTakeFirst();
			return row ? toPeriod(row) : undefined;
		},

		async findByHousehold(householdId) {
			const rows = await db
				.selectFrom("reporting_periods")
				.selectAll()
				.where("household_id", "=", householdId)
				.orderBy("start_date", "desc")
				.execute();
			return rows.map(toPeriod);
		},

		async findVisibleByHousehold(householdId) {
			const rows = await db
				.selectFrom("reporting_periods")
				.leftJoin("operation_roots", "operation_roots.id", "reporting_periods.operation_id")
				.selectAll("reporting_periods")
				.where("reporting_periods.household_id", "=", householdId)
				.where((eb) => visibleToProjection(eb, "reporting_periods.operation_id"))
				.orderBy("reporting_periods.start_date", "desc")
				.execute();
			return rows.map(toPeriod);
		},

		async reattributeOperation(id, operationId, now) {
			void now;
			await db.updateTable("reporting_periods").set({ operation_id: operationId }).where("id", "=", id).execute();
		},
	};
}

function toTemplate(row: {
	id: string;
	household_id: string;
	category_id: string;
	description: string;
	estimated_amount_minor: number;
	cadence: string;
	interval_count: number;
	start_date: string;
	end_date: string | null;
	due_day: number | null;
	service_span_months: number | null;
	account_hint_id: string | null;
	allocation_method: string;
	status: string;
	created_at: string;
	updated_at: string;
	operation_id: string | null;
}): RecurringTemplateRecord {
	return {
		id: row.id,
		householdId: row.household_id,
		categoryId: row.category_id,
		description: row.description,
		estimatedAmountMinor: row.estimated_amount_minor,
		cadence: row.cadence as TemplateCadence,
		intervalCount: row.interval_count,
		startDate: row.start_date,
		endDate: row.end_date,
		dueDay: row.due_day,
		serviceSpanMonths: row.service_span_months,
		accountHintId: row.account_hint_id,
		allocationMethod: row.allocation_method as AllocationMethodKind,
		status: row.status as TemplateStatus,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		operationId: row.operation_id,
	};
}

export function createRecurringTemplateRepository(db: Kysely<Database>): RecurringTemplateRepository {
	return {
		async create(input, now) {
			await db
				.insertInto("recurring_templates")
				.values({
					id: input.id,
					household_id: input.householdId,
					category_id: input.categoryId,
					description: input.description,
					estimated_amount_minor: input.estimatedAmountMinor,
					cadence: input.cadence,
					interval_count: input.intervalCount,
					start_date: input.startDate,
					end_date: input.endDate ?? null,
					due_day: input.dueDay ?? null,
					service_span_months: input.serviceSpanMonths ?? null,
					account_hint_id: input.accountHintId ?? null,
					allocation_method: input.allocationMethod,
					status: "active",
					created_at: now,
					updated_at: now,
					operation_id: input.operationId ?? null,
				})
				.execute();
		},

		async findById(id) {
			const row = await db.selectFrom("recurring_templates").selectAll().where("id", "=", id).executeTakeFirst();
			return row ? toTemplate(row) : undefined;
		},

		async findVisibleById(id) {
			const row = await db
				.selectFrom("recurring_templates")
				.leftJoin("operation_roots", "operation_roots.id", "recurring_templates.operation_id")
				.selectAll("recurring_templates")
				.where("recurring_templates.id", "=", id)
				.where((eb) => visibleToProjection(eb, "recurring_templates.operation_id"))
				.executeTakeFirst();
			return row ? toTemplate(row) : undefined;
		},

		async findByHousehold(householdId) {
			const rows = await db
				.selectFrom("recurring_templates")
				.leftJoin("operation_roots", "operation_roots.id", "recurring_templates.operation_id")
				.selectAll("recurring_templates")
				.where("recurring_templates.household_id", "=", householdId)
				.where((eb) => visibleToProjection(eb, "recurring_templates.operation_id"))
				.orderBy("recurring_templates.created_at", "asc")
				.execute();
			return rows.map(toTemplate);
		},

		async update(id, fields, now) {
			await db
				.updateTable("recurring_templates")
				.set({
					category_id: fields.categoryId,
					description: fields.description,
					estimated_amount_minor: fields.estimatedAmountMinor,
					cadence: fields.cadence,
					interval_count: fields.intervalCount,
					start_date: fields.startDate,
					end_date: fields.endDate,
					due_day: fields.dueDay,
					service_span_months: fields.serviceSpanMonths,
					account_hint_id: fields.accountHintId,
					allocation_method: fields.allocationMethod,
					updated_at: now,
				})
				.where("id", "=", id)
				.execute();
		},

		async setStatus(id, status, now) {
			await db.updateTable("recurring_templates").set({ status, updated_at: now }).where("id", "=", id).execute();
		},
	};
}

export function createTemplateAllocationParamRepository(db: Kysely<Database>): TemplateAllocationParamRepository {
	return {
		async replaceParams(templateId, params) {
			await db.deleteFrom("recurring_template_allocation_params").where("template_id", "=", templateId).execute();
			if (params.length === 0) return;
			await db
				.insertInto("recurring_template_allocation_params")
				.values(
					params.map((param) => ({
						id: crypto.randomUUID(),
						template_id: templateId,
						member_id: param.memberId,
						value: param.value,
					})),
				)
				.execute();
		},

		async findByTemplate(templateId) {
			const rows = await db
				.selectFrom("recurring_template_allocation_params")
				.selectAll()
				.where("template_id", "=", templateId)
				.orderBy("member_id", "asc")
				.execute();
			return rows.map((row) => ({
				id: row.id,
				templateId: row.template_id,
				memberId: row.member_id,
				value: row.value,
			}));
		},

		async findByTemplates(templateIds) {
			if (templateIds.length === 0) return [];
			const rows = await db
				.selectFrom("recurring_template_allocation_params")
				.selectAll()
				.where("template_id", "in", templateIds)
				.orderBy("member_id", "asc")
				.execute();
			return rows.map((row) => ({
				id: row.id,
				templateId: row.template_id,
				memberId: row.member_id,
				value: row.value,
			}));
		},
	};
}

function toExpense(row: {
	id: string;
	household_id: string;
	category_id: string;
	reporting_period_id: string;
	description: string;
	reference: string | null;
	status: string;
	planned_amount_minor: number | null;
	planned_version: number;
	actual_amount_minor: number | null;
	accounting_date: string;
	due_date: string | null;
	service_start_date: string | null;
	service_end_date: string | null;
	allocation_method: string;
	account_hint_id: string | null;
	template_id: string | null;
	scheduled_due_date: string | null;
	realized_by_expense_id: string | null;
	chain_root_id: string;
	replaces_id: string | null;
	reversed_by_id: string | null;
	actor_user_id: string | null;
	operation_id: string | null;
	created_at: string;
	updated_at: string;
}): ExpenseRecord {
	return {
		id: row.id,
		householdId: row.household_id,
		categoryId: row.category_id,
		reportingPeriodId: row.reporting_period_id,
		description: row.description,
		reference: row.reference,
		status: row.status as ExpenseLifecycle,
		plannedAmountMinor: row.planned_amount_minor,
		plannedVersion: row.planned_version,
		actualAmountMinor: row.actual_amount_minor,
		accountingDate: row.accounting_date,
		dueDate: row.due_date,
		serviceStartDate: row.service_start_date,
		serviceEndDate: row.service_end_date,
		allocationMethod: row.allocation_method as AllocationMethodKind,
		accountHintId: row.account_hint_id,
		templateId: row.template_id,
		scheduledDueDate: row.scheduled_due_date,
		realizedByExpenseId: row.realized_by_expense_id,
		chainRootId: row.chain_root_id,
		replacesId: row.replaces_id,
		reversedById: row.reversed_by_id,
		actorUserId: row.actor_user_id,
		operationId: row.operation_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

const EXPENSE_COLUMNS = [
	"expenses.id",
	"expenses.household_id",
	"expenses.category_id",
	"expenses.reporting_period_id",
	"expenses.description",
	"expenses.reference",
	"expenses.status",
	"expenses.planned_amount_minor",
	"expenses.planned_version",
	"expenses.actual_amount_minor",
	"expenses.accounting_date",
	"expenses.due_date",
	"expenses.service_start_date",
	"expenses.service_end_date",
	"expenses.allocation_method",
	"expenses.account_hint_id",
	"expenses.template_id",
	"expenses.scheduled_due_date",
	"expenses.realized_by_expense_id",
	"expenses.chain_root_id",
	"expenses.replaces_id",
	"expenses.reversed_by_id",
	"expenses.actor_user_id",
	"expenses.operation_id",
	"expenses.created_at",
	"expenses.updated_at",
] as const;

export function createExpenseRepository(db: Kysely<Database>): ExpenseRepository {
	return {
		async create(input) {
			await db
				.insertInto("expenses")
				.values({
					id: input.id,
					household_id: input.householdId,
					category_id: input.categoryId,
					reporting_period_id: input.reportingPeriodId,
					description: input.description,
					reference: input.reference,
					status: input.status,
					planned_amount_minor: input.plannedAmountMinor,
					planned_version: input.plannedVersion,
					actual_amount_minor: input.actualAmountMinor,
					accounting_date: input.accountingDate,
					due_date: input.dueDate,
					service_start_date: input.serviceStartDate,
					service_end_date: input.serviceEndDate,
					allocation_method: input.allocationMethod,
					account_hint_id: input.accountHintId,
					template_id: input.templateId,
					scheduled_due_date: input.scheduledDueDate,
					realized_by_expense_id: input.realizedByExpenseId,
					chain_root_id: input.chainRootId,
					replaces_id: input.replacesId,
					reversed_by_id: input.reversedById,
					actor_user_id: input.actorUserId,
					operation_id: input.operationId,
					created_at: input.createdAt,
					updated_at: input.updatedAt,
				})
				.execute();
		},

		async findById(id) {
			const row = await db.selectFrom("expenses").selectAll().where("id", "=", id).executeTakeFirst();
			return row ? toExpense(row) : undefined;
		},

		async findVisibleById(id) {
			const row = await db
				.selectFrom("expenses")
				.leftJoin("operation_roots", "operation_roots.id", "expenses.operation_id")
				.select(EXPENSE_COLUMNS)
				.where("expenses.id", "=", id)
				.where((eb) => visibleToProjection(eb, "expenses.operation_id"))
				.executeTakeFirst();
			return row ? toExpense(row) : undefined;
		},

		async findByOperationId(operationId) {
			const row = await db
				.selectFrom("expenses")
				.selectAll()
				.where("operation_id", "=", operationId)
				.executeTakeFirst();
			return row ? toExpense(row) : undefined;
		},

		async listByPeriod(householdId, reportingPeriodId) {
			const rows = await db
				.selectFrom("expenses")
				.leftJoin("operation_roots", "operation_roots.id", "expenses.operation_id")
				.select(EXPENSE_COLUMNS)
				.where("expenses.household_id", "=", householdId)
				.where("expenses.reporting_period_id", "=", reportingPeriodId)
				.where((eb) => visibleToProjection(eb, "expenses.operation_id"))
				.orderBy("expenses.accounting_date", "desc")
				.orderBy("expenses.created_at", "desc")
				.execute();
			return rows.map(toExpense);
		},

		async listByChainRoot(chainRootId) {
			const rows = await db
				.selectFrom("expenses")
				.leftJoin("operation_roots", "operation_roots.id", "expenses.operation_id")
				.select(EXPENSE_COLUMNS)
				.where("expenses.chain_root_id", "=", chainRootId)
				.where((eb) => visibleToProjection(eb, "expenses.operation_id"))
				.orderBy("expenses.created_at", "asc")
				.execute();
			return rows.map(toExpense);
		},

		async listPostedByHousehold(householdId, limit = 200) {
			const rows = await db
				.selectFrom("expenses")
				.leftJoin("operation_roots", "operation_roots.id", "expenses.operation_id")
				.select(EXPENSE_COLUMNS)
				.where("expenses.household_id", "=", householdId)
				.where("expenses.status", "=", "posted")
				.where((eb) => visibleToProjection(eb, "expenses.operation_id"))
				.orderBy("expenses.accounting_date", "desc")
				.limit(limit)
				.execute();
			return rows.map(toExpense);
		},

		async findReferencesLike(householdId, base) {
			const rows = await db
				.selectFrom("expenses")
				.select("reference")
				.where("household_id", "=", householdId)
				.where("reference", "is not", null)
				.where((eb) => eb.or([eb("reference", "=", base), eb("reference", "like", `${base}-%`)]))
				.execute();
			return rows.map((row) => row.reference as string);
		},

		async findOccurrence(templateId, scheduledDueDate) {
			const row = await db
				.selectFrom("expenses")
				.selectAll()
				.where("template_id", "=", templateId)
				.where("scheduled_due_date", "=", scheduledDueDate)
				.executeTakeFirst();
			return row ? toExpense(row) : undefined;
		},

		async findVisibleOccurrence(templateId, scheduledDueDate) {
			const row = await db
				.selectFrom("expenses")
				.leftJoin("operation_roots", "operation_roots.id", "expenses.operation_id")
				.select(EXPENSE_COLUMNS)
				.where("expenses.template_id", "=", templateId)
				.where("expenses.scheduled_due_date", "=", scheduledDueDate)
				.where((eb) => visibleToProjection(eb, "expenses.operation_id"))
				.executeTakeFirst();
			return row ? toExpense(row) : undefined;
		},

		async findByRealizedBy(actualExpenseId) {
			const rows = await db
				.selectFrom("expenses")
				.selectAll()
				.where("realized_by_expense_id", "=", actualExpenseId)
				.execute();
			return rows.map(toExpense);
		},

		async updateDraft(id, fields, now) {
			await db
				.updateTable("expenses")
				.set({
					category_id: fields.categoryId,
					reporting_period_id: fields.reportingPeriodId,
					description: fields.description,
					planned_amount_minor: fields.plannedAmountMinor,
					actual_amount_minor: fields.actualAmountMinor,
					accounting_date: fields.accountingDate,
					due_date: fields.dueDate,
					service_start_date: fields.serviceStartDate,
					service_end_date: fields.serviceEndDate,
					account_hint_id: fields.accountHintId,
					allocation_method: fields.allocationMethod,
					updated_at: now,
				})
				.where("id", "=", id)
				.execute();
		},

		async updateExpected(id, fields, now) {
			await db
				.updateTable("expenses")
				.set({
					...(fields.description !== undefined ? { description: fields.description } : {}),
					...(fields.plannedAmountMinor !== undefined ? { planned_amount_minor: fields.plannedAmountMinor } : {}),
					...(fields.plannedVersion !== undefined ? { planned_version: fields.plannedVersion } : {}),
					...(fields.dueDate !== undefined ? { due_date: fields.dueDate } : {}),
					...(fields.reportingPeriodId !== undefined ? { reporting_period_id: fields.reportingPeriodId } : {}),
					...(fields.serviceStartDate !== undefined ? { service_start_date: fields.serviceStartDate } : {}),
					...(fields.serviceEndDate !== undefined ? { service_end_date: fields.serviceEndDate } : {}),
					...(fields.accountHintId !== undefined ? { account_hint_id: fields.accountHintId } : {}),
					...(fields.allocationMethod !== undefined ? { allocation_method: fields.allocationMethod } : {}),
					updated_at: now,
				})
				.where("id", "=", id)
				.execute();
		},

		async markCancelled(id, now) {
			await db.updateTable("expenses").set({ status: "cancelled", updated_at: now }).where("id", "=", id).execute();
		},

		async markReversed(id, reversedById, now) {
			await db
				.updateTable("expenses")
				.set({ status: "reversed", reversed_by_id: reversedById, updated_at: now })
				.where("id", "=", id)
				.execute();
		},

		async setActualAmount(id, actualAmountMinor, now) {
			await db
				.updateTable("expenses")
				.set({ actual_amount_minor: actualAmountMinor, updated_at: now })
				.where("id", "=", id)
				.execute();
		},

		async setRealizedBy(id, actualExpenseId, now) {
			await db
				.updateTable("expenses")
				.set({ realized_by_expense_id: actualExpenseId, updated_at: now })
				.where("id", "=", id)
				.execute();
		},

		async reattributeOperation(id, operationId, now) {
			await db
				.updateTable("expenses")
				.set({ operation_id: operationId, updated_at: now })
				.where("id", "=", id)
				.execute();
		},

		async remove(id) {
			await db.deleteFrom("expenses").where("id", "=", id).execute();
		},
	};
}

export function createExpenseAllocationRepository(db: Kysely<Database>): ExpenseAllocationRepository {
	return {
		async replaceLines(expenseId, basis, lines) {
			await db
				.deleteFrom("expense_allocations")
				.where("expense_id", "=", expenseId)
				.where("basis", "=", basis)
				.execute();
			if (lines.length === 0) return;
			await db
				.insertInto("expense_allocations")
				.values(
					lines.map((line) => ({
						id: crypto.randomUUID(),
						expense_id: expenseId,
						member_id: line.memberId,
						basis,
						amount_minor: line.amountMinor,
					})),
				)
				.execute();
		},

		async findByExpense(expenseId) {
			const rows = await db
				.selectFrom("expense_allocations")
				.selectAll()
				.where("expense_id", "=", expenseId)
				.orderBy("member_id", "asc")
				.execute();
			return rows.map((row) => ({
				id: row.id,
				expenseId: row.expense_id,
				memberId: row.member_id,
				basis: row.basis as AllocationBasis,
				amountMinor: row.amount_minor,
			}));
		},

		async findByExpenses(expenseIds) {
			if (expenseIds.length === 0) return [];
			const rows = await db
				.selectFrom("expense_allocations")
				.selectAll()
				.where("expense_id", "in", expenseIds)
				.orderBy("member_id", "asc")
				.execute();
			return rows.map((row) => ({
				id: row.id,
				expenseId: row.expense_id,
				memberId: row.member_id,
				basis: row.basis as AllocationBasis,
				amountMinor: row.amount_minor,
			}));
		},

		async deleteByExpense(expenseId) {
			await db.deleteFrom("expense_allocations").where("expense_id", "=", expenseId).execute();
		},
	};
}

export function createExpenseAllocationParamRepository(db: Kysely<Database>): ExpenseAllocationParamRepository {
	return {
		async replaceParams(expenseId, params) {
			await db.deleteFrom("expense_allocation_params").where("expense_id", "=", expenseId).execute();
			if (params.length === 0) return;
			await db
				.insertInto("expense_allocation_params")
				.values(
					params.map((param) => ({
						id: crypto.randomUUID(),
						expense_id: expenseId,
						member_id: param.memberId,
						value: param.value,
					})),
				)
				.execute();
		},

		async findByExpense(expenseId) {
			const rows = await db
				.selectFrom("expense_allocation_params")
				.selectAll()
				.where("expense_id", "=", expenseId)
				.orderBy("member_id", "asc")
				.execute();
			return rows.map((row) => ({ id: row.id, expenseId: row.expense_id, memberId: row.member_id, value: row.value }));
		},

		async deleteByExpense(expenseId) {
			await db.deleteFrom("expense_allocation_params").where("expense_id", "=", expenseId).execute();
		},
	};
}

function toPayment(row: {
	id: string;
	household_id: string;
	account_id: string;
	amount_minor: number;
	description: string;
	effective_at: string;
	ordering_key: string;
	recorded_at: string;
	funding_source: string;
	funder_member_id: string | null;
	status: string;
	chain_root_id: string;
	reversal_of_id: string | null;
	replaces_id: string | null;
	reversed_by_id: string | null;
	actor_user_id: string | null;
	operation_id: string | null;
	created_at: string;
}): PaymentRecord {
	return {
		id: row.id,
		householdId: row.household_id,
		accountId: row.account_id,
		amountMinor: row.amount_minor,
		description: row.description,
		effectiveAt: row.effective_at,
		orderingKey: row.ordering_key,
		recordedAt: row.recorded_at,
		fundingSource: row.funding_source as FundingSource,
		funderMemberId: row.funder_member_id,
		status: row.status as "posted" | "reversed",
		chainRootId: row.chain_root_id,
		reversalOfId: row.reversal_of_id,
		replacesId: row.replaces_id,
		reversedById: row.reversed_by_id,
		actorUserId: row.actor_user_id,
		operationId: row.operation_id,
		createdAt: row.created_at,
	};
}

const PAYMENT_COLUMNS = [
	"payments.id",
	"payments.household_id",
	"payments.account_id",
	"payments.amount_minor",
	"payments.description",
	"payments.effective_at",
	"payments.ordering_key",
	"payments.recorded_at",
	"payments.funding_source",
	"payments.funder_member_id",
	"payments.status",
	"payments.chain_root_id",
	"payments.reversal_of_id",
	"payments.replaces_id",
	"payments.reversed_by_id",
	"payments.actor_user_id",
	"payments.operation_id",
	"payments.created_at",
] as const;

export function createPaymentRepository(db: Kysely<Database>): PaymentRepository {
	return {
		async create(input) {
			await db
				.insertInto("payments")
				.values({
					id: input.id,
					household_id: input.householdId,
					account_id: input.accountId,
					amount_minor: input.amountMinor,
					description: input.description,
					effective_at: input.effectiveAt,
					ordering_key: input.orderingKey,
					recorded_at: input.recordedAt,
					funding_source: input.fundingSource,
					funder_member_id: input.funderMemberId,
					status: input.status,
					chain_root_id: input.chainRootId,
					reversal_of_id: input.reversalOfId,
					replaces_id: input.replacesId,
					reversed_by_id: input.reversedById,
					actor_user_id: input.actorUserId,
					operation_id: input.operationId,
					created_at: input.createdAt,
				})
				.execute();
		},

		async findById(id) {
			const row = await db.selectFrom("payments").selectAll().where("id", "=", id).executeTakeFirst();
			return row ? toPayment(row) : undefined;
		},

		async findVisibleById(id) {
			const row = await db
				.selectFrom("payments")
				.leftJoin("operation_roots", "operation_roots.id", "payments.operation_id")
				.select(PAYMENT_COLUMNS)
				.where("payments.id", "=", id)
				.where((eb) => visibleToProjection(eb, "payments.operation_id"))
				.executeTakeFirst();
			return row ? toPayment(row) : undefined;
		},

		async findByOperationId(operationId) {
			const row = await db
				.selectFrom("payments")
				.selectAll()
				.where("operation_id", "=", operationId)
				.executeTakeFirst();
			return row ? toPayment(row) : undefined;
		},

		async findReversalOf(paymentId) {
			const row = await db
				.selectFrom("payments")
				.selectAll()
				.where("reversal_of_id", "=", paymentId)
				.executeTakeFirst();
			return row ? toPayment(row) : undefined;
		},

		async findReplacement(replacesId) {
			const row = await db
				.selectFrom("payments")
				.selectAll()
				.where("replaces_id", "=", replacesId)
				.orderBy("recorded_at", "asc")
				.executeTakeFirst();
			return row ? toPayment(row) : undefined;
		},

		async listByAccount(accountId) {
			const rows = await db
				.selectFrom("payments")
				.leftJoin("operation_roots", "operation_roots.id", "payments.operation_id")
				.select(PAYMENT_COLUMNS)
				.where("payments.account_id", "=", accountId)
				.where((eb) => visibleToProjection(eb, "payments.operation_id"))
				.orderBy("payments.ordering_key", "asc")
				.execute();
			return rows.map(toPayment);
		},

		async listByHousehold(householdId) {
			const rows = await db
				.selectFrom("payments")
				.leftJoin("operation_roots", "operation_roots.id", "payments.operation_id")
				.select(PAYMENT_COLUMNS)
				.where("payments.household_id", "=", householdId)
				.where((eb) => visibleToProjection(eb, "payments.operation_id"))
				.orderBy("payments.recorded_at", "desc")
				.execute();
			return rows.map(toPayment);
		},

		async markReversed(id, reversedById) {
			await db
				.updateTable("payments")
				.set({ status: "reversed", reversed_by_id: reversedById })
				.where("id", "=", id)
				.execute();
		},
	};
}

function toPaymentEntry(row: {
	id: string;
	account_id: string;
	payment_id: string;
	chain_root_id: string;
	amount_minor: number;
	effective_at: string;
	ordering_key: string;
	recorded_at: string;
	operation_id: string | null;
}): PaymentAccountEntryRecord {
	return {
		id: row.id,
		accountId: row.account_id,
		paymentId: row.payment_id,
		chainRootId: row.chain_root_id,
		amountMinor: row.amount_minor,
		effectiveAt: row.effective_at,
		orderingKey: row.ordering_key,
		recordedAt: row.recorded_at,
		operationId: row.operation_id,
	};
}

const PAYMENT_ENTRY_COLUMNS = [
	"payment_account_entries.id",
	"payment_account_entries.account_id",
	"payment_account_entries.payment_id",
	"payment_account_entries.chain_root_id",
	"payment_account_entries.amount_minor",
	"payment_account_entries.effective_at",
	"payment_account_entries.ordering_key",
	"payment_account_entries.recorded_at",
	"payment_account_entries.operation_id",
] as const;

export function createPaymentEntryRepository(db: Kysely<Database>): PaymentEntryRepository {
	return {
		async appendMany(entries) {
			if (entries.length === 0) return;
			await db
				.insertInto("payment_account_entries")
				.values(
					entries.map((entry) => ({
						id: entry.id,
						account_id: entry.accountId,
						payment_id: entry.paymentId,
						chain_root_id: entry.chainRootId,
						amount_minor: entry.amountMinor,
						effective_at: entry.effectiveAt,
						ordering_key: entry.orderingKey,
						recorded_at: entry.recordedAt,
						operation_id: entry.operationId,
					})),
				)
				.execute();
		},

		async findByAccount(accountId) {
			const rows = await db
				.selectFrom("payment_account_entries")
				.leftJoin("operation_roots", "operation_roots.id", "payment_account_entries.operation_id")
				.select(PAYMENT_ENTRY_COLUMNS)
				.where("payment_account_entries.account_id", "=", accountId)
				.where((eb) => visibleToProjection(eb, "payment_account_entries.operation_id"))
				.orderBy("payment_account_entries.ordering_key", "asc")
				.execute();
			return rows.map(toPaymentEntry);
		},

		async findByAccountAfter(accountId, orderingKey) {
			const rows = await db
				.selectFrom("payment_account_entries")
				.leftJoin("operation_roots", "operation_roots.id", "payment_account_entries.operation_id")
				.select(PAYMENT_ENTRY_COLUMNS)
				.where("payment_account_entries.account_id", "=", accountId)
				.where("payment_account_entries.ordering_key", ">", orderingKey)
				.where((eb) => visibleToProjection(eb, "payment_account_entries.operation_id"))
				.orderBy("payment_account_entries.ordering_key", "asc")
				.execute();
			return rows.map(toPaymentEntry);
		},
	};
}

function toApplication(row: {
	id: string;
	household_id: string;
	payment_id: string;
	expense_id: string;
	amount_minor: number;
	status: string;
	recorded_at: string;
	reversed_at: string | null;
	operation_id: string | null;
}): PaymentApplicationRecord {
	return {
		id: row.id,
		householdId: row.household_id,
		paymentId: row.payment_id,
		expenseId: row.expense_id,
		amountMinor: row.amount_minor,
		status: row.status as ApplicationStatus,
		recordedAt: row.recorded_at,
		reversedAt: row.reversed_at,
		operationId: row.operation_id,
	};
}

const APPLICATION_COLUMNS = [
	"payment_applications.id",
	"payment_applications.household_id",
	"payment_applications.payment_id",
	"payment_applications.expense_id",
	"payment_applications.amount_minor",
	"payment_applications.status",
	"payment_applications.recorded_at",
	"payment_applications.reversed_at",
	"payment_applications.operation_id",
] as const;

export function createPaymentApplicationRepository(db: Kysely<Database>): PaymentApplicationRepository {
	return {
		async create(input) {
			await db
				.insertInto("payment_applications")
				.values({
					id: input.id,
					household_id: input.householdId,
					payment_id: input.paymentId,
					expense_id: input.expenseId,
					amount_minor: input.amountMinor,
					status: input.status,
					recorded_at: input.recordedAt,
					reversed_at: input.reversedAt,
					operation_id: input.operationId,
				})
				.execute();
		},

		async findById(id) {
			const row = await db.selectFrom("payment_applications").selectAll().where("id", "=", id).executeTakeFirst();
			return row ? toApplication(row) : undefined;
		},

		async findVisibleById(id) {
			const row = await db
				.selectFrom("payment_applications")
				.leftJoin("operation_roots", "operation_roots.id", "payment_applications.operation_id")
				.select(APPLICATION_COLUMNS)
				.where("payment_applications.id", "=", id)
				.where((eb) => visibleToProjection(eb, "payment_applications.operation_id"))
				.executeTakeFirst();
			return row ? toApplication(row) : undefined;
		},

		async findActiveByExpense(expenseId) {
			const rows = await db
				.selectFrom("payment_applications")
				.leftJoin("operation_roots", "operation_roots.id", "payment_applications.operation_id")
				.select(APPLICATION_COLUMNS)
				.where("payment_applications.expense_id", "=", expenseId)
				.where("payment_applications.status", "=", "active")
				.where((eb) => visibleToProjection(eb, "payment_applications.operation_id"))
				.orderBy("payment_applications.recorded_at", "asc")
				.execute();
			return rows.map(toApplication);
		},

		async findActiveByPayment(paymentId) {
			const rows = await db
				.selectFrom("payment_applications")
				.leftJoin("operation_roots", "operation_roots.id", "payment_applications.operation_id")
				.select(APPLICATION_COLUMNS)
				.where("payment_applications.payment_id", "=", paymentId)
				.where("payment_applications.status", "=", "active")
				.where((eb) => visibleToProjection(eb, "payment_applications.operation_id"))
				.orderBy("payment_applications.recorded_at", "asc")
				.execute();
			return rows.map(toApplication);
		},

		async findActiveByHousehold(householdId) {
			const rows = await db
				.selectFrom("payment_applications")
				.leftJoin("operation_roots", "operation_roots.id", "payment_applications.operation_id")
				.select(APPLICATION_COLUMNS)
				.where("payment_applications.household_id", "=", householdId)
				.where("payment_applications.status", "=", "active")
				.where((eb) => visibleToProjection(eb, "payment_applications.operation_id"))
				.orderBy("payment_applications.recorded_at", "asc")
				.execute();
			return rows.map(toApplication);
		},

		async findByExpense(expenseId) {
			const rows = await db
				.selectFrom("payment_applications")
				.leftJoin("operation_roots", "operation_roots.id", "payment_applications.operation_id")
				.select(APPLICATION_COLUMNS)
				.where("payment_applications.expense_id", "=", expenseId)
				.where((eb) => visibleToProjection(eb, "payment_applications.operation_id"))
				.orderBy("payment_applications.recorded_at", "asc")
				.execute();
			return rows.map(toApplication);
		},

		async markReversed(id, reversedAt) {
			await db
				.updateTable("payment_applications")
				.set({ status: "reversed", reversed_at: reversedAt })
				.where("id", "=", id)
				.where("status", "=", "active")
				.execute();
		},
	};
}

export function createExpenseEvidenceRepository(db: Kysely<Database>): ExpenseEvidenceRepository {
	return {
		async add(input) {
			await db
				.insertInto("expense_evidence")
				.values({
					id: input.id,
					expense_id: input.expenseId,
					household_id: input.householdId,
					label: input.label,
					url: input.url,
					note: input.note,
					status: input.status,
					created_by: input.createdBy,
					created_at: input.createdAt,
					removed_at: input.removedAt,
					operation_id: input.operationId,
				})
				.execute();
		},

		async findById(id) {
			const row = await db.selectFrom("expense_evidence").selectAll().where("id", "=", id).executeTakeFirst();
			return row
				? {
						id: row.id,
						expenseId: row.expense_id,
						householdId: row.household_id,
						label: row.label,
						url: row.url,
						note: row.note,
						status: row.status as EvidenceStatus,
						createdBy: row.created_by,
						createdAt: row.created_at,
						removedAt: row.removed_at,
						operationId: row.operation_id,
					}
				: undefined;
		},

		async findActiveByExpense(expenseId) {
			const rows = await db
				.selectFrom("expense_evidence")
				.leftJoin("operation_roots", "operation_roots.id", "expense_evidence.operation_id")
				.selectAll("expense_evidence")
				.where("expense_evidence.expense_id", "=", expenseId)
				.where("expense_evidence.status", "=", "active")
				.where((eb) => visibleToProjection(eb, "expense_evidence.operation_id"))
				.orderBy("expense_evidence.created_at", "asc")
				.execute();
			return rows.map((row) => ({
				id: row.id,
				expenseId: row.expense_id,
				householdId: row.household_id,
				label: row.label,
				url: row.url,
				note: row.note,
				status: row.status as EvidenceStatus,
				createdBy: row.created_by,
				createdAt: row.created_at,
				removedAt: row.removed_at,
				operationId: row.operation_id,
			}));
		},

		async deleteByExpense(expenseId) {
			await db.deleteFrom("expense_evidence").where("expense_id", "=", expenseId).execute();
		},

		async markRemoved(id, removedAt) {
			await db
				.updateTable("expense_evidence")
				.set({ status: "removed", removed_at: removedAt })
				.where("id", "=", id)
				.execute();
		},
	};
}
