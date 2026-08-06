import {
	resolveAllocations,
	selectionFromParams,
	type AllocationMemberSelection,
	type AllocationMethodKind,
} from "$lib/expenses/allocation";
import { validateEvidenceUrl } from "$lib/expenses/evidence";
import { applicableAmountMinor, expenseValueState } from "$lib/expenses/model";
import { referenceBase, resolveUniqueReference, slugify } from "$lib/expenses/references";
import type { AccountRepository } from "../accounts/repository";
import type { MemberRepository } from "../household/repository";
import type {
	ExpenseCategoryRecord,
	ExpenseCategoryRepository,
	ExpenseEvidenceRecord,
	ExpenseEvidenceRepository,
	ExpenseAllocationParamRepository,
	ExpenseAllocationRepository,
	ExpenseRecord,
	ExpenseRepository,
	PaymentApplicationRepository,
	ReportingPeriodRepository,
} from "./repository";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface AllocationInput {
	method: AllocationMethodKind;
	members: AllocationMemberSelection[];
}

export interface PostExpenseInput {
	categoryId: string;
	reportingPeriodId: string;
	description: string;
	plannedAmountMinor?: number | null;
	actualAmountMinor?: number | null;
	accountingDate: string;
	dueDate?: string | null;
	serviceStartDate?: string | null;
	serviceEndDate?: string | null;
	accountHintId?: string | null;
	allocation: AllocationInput;
	draft?: boolean;
	templateId?: string | null;
	scheduledDueDate?: string | null;
	/** Correction replacement: keeps the chain and the stable reference. */
	inherit?: {
		chainRootId: string;
		reference: string;
		replacesId: string;
		/**
		 * Correction of an actualized expense: the frozen planned baseline and
		 * its version travel to the replacement, and planned allocation lines
		 * are copied verbatim (the baseline is never re-resolved).
		 */
		plannedVersion?: number;
		frozenPlannedLines?: { memberId: string; amountMinor: number }[];
	};
}

export interface EditExpectedExpenseInput {
	description?: string;
	plannedAmountMinor?: number;
	dueDate?: string | null;
	reportingPeriodId?: string;
	serviceStartDate?: string | null;
	serviceEndDate?: string | null;
	accountHintId?: string | null;
	allocation?: AllocationInput;
}

export interface OccurrenceInsertInput {
	categoryId: string;
	reportingPeriodId: string;
	description: string;
	plannedAmountMinor: number;
	accountingDate: string;
	dueDate: string | null;
	serviceStartDate: string | null;
	serviceEndDate: string | null;
	accountHintId: string | null;
	allocationMethod: AllocationMethodKind;
	allocationParams: { memberId: string; value: number | null }[];
	templateId: string;
	scheduledDueDate: string;
}

interface ExpenseDeps {
	categories: ExpenseCategoryRepository;
	periods: ReportingPeriodRepository;
	expenses: ExpenseRepository;
	allocations: ExpenseAllocationRepository;
	allocationParams: ExpenseAllocationParamRepository;
	applications: PaymentApplicationRepository;
	evidence: ExpenseEvidenceRepository;
}

/**
 * All expense-side application reversals flow through this port, owned by
 * the payment service, so payment-coverage rules have exactly one seam.
 */
export interface ApplicationReversalPort {
	reverseApplicationsForExpense(
		householdId: string,
		expenseId: string,
		now: string,
		operationId: string | null,
	): Promise<void>;
}

interface MembershipDeps {
	members: MemberRepository;
	accounts: AccountRepository;
}

export interface ExpenseService {
	createCategory(
		householdId: string,
		input: { name: string; ordering?: number },
		now: string,
		operationId: string | null,
	): Promise<ExpenseCategoryRecord>;
	renameCategory(
		householdId: string,
		categoryId: string,
		name: string,
		now: string,
		operationId: string | null,
	): Promise<ExpenseCategoryRecord>;
	deactivateCategory(
		householdId: string,
		categoryId: string,
		now: string,
		operationId: string | null,
	): Promise<ExpenseCategoryRecord>;
	reactivateCategory(
		householdId: string,
		categoryId: string,
		now: string,
		operationId: string | null,
	): Promise<ExpenseCategoryRecord>;
	listCategories(householdId: string): Promise<ExpenseCategoryRecord[]>;
	postExpense(
		householdId: string,
		input: PostExpenseInput,
		actorUserId: string,
		now: string,
		operationId: string | null,
	): Promise<ExpenseRecord>;
	editDraftExpense(
		householdId: string,
		expenseId: string,
		input: PostExpenseInput,
		now: string,
		operationId: string | null,
	): Promise<ExpenseRecord>;
	deleteDraftExpense(householdId: string, expenseId: string, now: string, operationId: string | null): Promise<void>;
	editExpectedExpense(
		householdId: string,
		expenseId: string,
		input: EditExpectedExpenseInput,
		now: string,
		operationId: string | null,
	): Promise<ExpenseRecord>;
	cancelExpectedExpense(
		householdId: string,
		expenseId: string,
		now: string,
		operationId: string | null,
	): Promise<ExpenseRecord>;
	actualizeExpense(
		householdId: string,
		expenseId: string,
		input: { actualAmountMinor: number; allocation?: AllocationInput },
		now: string,
		operationId: string | null,
	): Promise<ExpenseRecord>;
	linkActualExpense(
		householdId: string,
		expectedId: string,
		actualId: string,
		now: string,
		operationId: string | null,
	): Promise<ExpenseRecord>;
	unlinkActualExpense(
		householdId: string,
		expectedId: string,
		now: string,
		operationId: string | null,
	): Promise<ExpenseRecord>;
	addEvidence(
		householdId: string,
		expenseId: string,
		input: { label: string; url: string; note: string | null },
		actorUserId: string,
		now: string,
		operationId: string | null,
	): Promise<ExpenseEvidenceRecord>;
	removeEvidence(householdId: string, evidenceId: string, now: string, operationId: string | null): Promise<void>;
	correctExpense(
		householdId: string,
		expenseId: string,
		replacement: PostExpenseInput | null,
		actorUserId: string,
		now: string,
		operationId: string | null,
	): Promise<{ reversal: ExpenseRecord; replacement: ExpenseRecord | null }>;
	/** Planning port: inserts one materialized expected occurrence. */
	insertOccurrence(
		householdId: string,
		input: OccurrenceInsertInput,
		actorUserId: string,
		now: string,
		operationId: string | null,
	): Promise<ExpenseRecord>;
	getExpense(householdId: string, expenseId: string): Promise<ExpenseRecord>;
}

function paramValueFor(method: AllocationMethodKind, member: AllocationMemberSelection): number | null {
	switch (method) {
		case "custom_weight":
			return member.weight ?? 0;
		case "percentage":
			return member.basisPoints ?? 0;
		case "fixed":
			return member.fixedAmountMinor ?? 0;
		default:
			return null;
	}
}

export function createExpenseService(
	deps: ExpenseDeps,
	membership: MembershipDeps,
	applicationReversals?: ApplicationReversalPort,
): ExpenseService {
	async function requireCategory(householdId: string, categoryId: string): Promise<ExpenseCategoryRecord> {
		const category = await deps.categories.findById(categoryId);
		if (!category || category.householdId !== householdId) {
			throw new Error("category_not_found");
		}
		return category;
	}

	async function requireVisibleExpense(householdId: string, expenseId: string): Promise<ExpenseRecord> {
		const expense = await deps.expenses.findVisibleById(expenseId);
		if (!expense || expense.householdId !== householdId) {
			throw new Error("expense_not_found");
		}
		return expense;
	}

	async function validateDateFields(input: {
		accountingDate?: string;
		dueDate?: string | null;
		serviceStartDate?: string | null;
		serviceEndDate?: string | null;
	}) {
		if (input.accountingDate !== undefined && !DATE_PATTERN.test(input.accountingDate)) {
			throw new Error("accounting_date_invalid");
		}
		if (input.dueDate != null && !DATE_PATTERN.test(input.dueDate)) {
			throw new Error("due_date_invalid");
		}
		const start = input.serviceStartDate ?? null;
		const end = input.serviceEndDate ?? null;
		if ((start === null) !== (end === null)) {
			throw new Error("service_span_invalid");
		}
		if (start !== null && end !== null) {
			if (!DATE_PATTERN.test(start) || !DATE_PATTERN.test(end) || start >= end) {
				throw new Error("service_span_invalid");
			}
		}
	}

	async function validateAccountHint(householdId: string, accountHintId: string | null | undefined) {
		if (!accountHintId) return;
		const account = await membership.accounts.findById(accountHintId);
		if (!account || account.householdId !== householdId) {
			throw new Error("account_not_found");
		}
	}

	/** One batched read of household members, keyed by id. */
	async function householdMemberMap(householdId: string) {
		const members = await membership.members.findByHousehold(householdId);
		return new Map(members.map((member) => [member.id, member]));
	}

	async function validateAllocationMembers(householdId: string, members: AllocationMemberSelection[]) {
		const byId = await householdMemberMap(householdId);
		for (const member of members) {
			const record = byId.get(member.memberId);
			if (!record) {
				throw new Error("allocation_member_not_found");
			}
			if (!record.isActive) {
				throw new Error("allocation_member_not_active");
			}
		}
	}

	function defaultWeightsByMember(byId: Map<string, { id: string; defaultWeight: number }>): Map<string, number> {
		return new Map([...byId.values()].map((member) => [member.id, member.defaultWeight]));
	}

	async function generateReference(householdId: string, categorySlug: string, periodSlug: string): Promise<string> {
		const base = referenceBase(categorySlug, periodSlug);
		const existing = await deps.expenses.findReferencesLike(householdId, base);
		return resolveUniqueReference(base, existing);
	}

	async function insertExpense(
		householdId: string,
		input: PostExpenseInput,
		actorUserId: string,
		now: string,
		operationId: string | null,
	): Promise<ExpenseRecord> {
		const planned = input.plannedAmountMinor ?? null;
		const actual = input.actualAmountMinor ?? null;
		// Both amounts may coexist only on a correction replacement that
		// inherits the frozen realization baseline of an actualized expense.
		if (planned !== null && actual !== null && !input.inherit?.frozenPlannedLines) {
			throw new Error("expense_amount_ambiguous");
		}
		const amount = applicableAmountMinor(planned, actual);
		if (!Number.isInteger(amount) || amount <= 0) {
			throw new Error("expense_amount_not_positive");
		}
		if (!input.description.trim()) {
			throw new Error("expense_description_required");
		}
		await validateDateFields(input);
		await validateAccountHint(householdId, input.accountHintId);

		const category = await requireCategory(householdId, input.categoryId);
		if (!category.isActive && !input.inherit) {
			throw new Error("category_inactive");
		}
		const period = await deps.periods.findById(input.reportingPeriodId);
		if (!period || period.householdId !== householdId) {
			throw new Error("period_not_found");
		}

		await validateAllocationMembers(householdId, input.allocation.members);
		const lines = resolveAllocations(input.allocation.method, amount, input.allocation.members);

		const status = input.draft ? "draft" : "posted";
		const reference =
			status === "posted"
				? (input.inherit?.reference ?? (await generateReference(householdId, category.slug, period.slug)))
				: null;

		const id = crypto.randomUUID();
		const record: ExpenseRecord = {
			id,
			householdId,
			categoryId: input.categoryId,
			reportingPeriodId: input.reportingPeriodId,
			description: input.description.trim(),
			reference,
			status,
			plannedAmountMinor: planned,
			plannedVersion: input.inherit?.plannedVersion ?? 1,
			actualAmountMinor: actual,
			accountingDate: input.accountingDate,
			dueDate: input.dueDate ?? null,
			serviceStartDate: input.serviceStartDate ?? null,
			serviceEndDate: input.serviceEndDate ?? null,
			allocationMethod: input.allocation.method,
			accountHintId: input.accountHintId ?? null,
			templateId: input.templateId ?? null,
			scheduledDueDate: input.scheduledDueDate ?? null,
			realizedByExpenseId: null,
			chainRootId: input.inherit?.chainRootId ?? id,
			replacesId: input.inherit?.replacesId ?? null,
			reversedById: null,
			actorUserId,
			operationId,
			createdAt: now,
			updatedAt: now,
		};
		await deps.expenses.create(record);
		if (planned !== null && actual !== null && input.inherit?.frozenPlannedLines) {
			// Actualized replacement: frozen planned lines + resolved actual lines.
			await deps.allocations.replaceLines(id, "planned", input.inherit.frozenPlannedLines);
			await deps.allocations.replaceLines(id, "actual", lines);
		} else {
			await deps.allocations.replaceLines(
				id,
				expenseValueState(planned, actual) === "actual" ? "actual" : "planned",
				lines,
			);
		}
		await deps.allocationParams.replaceParams(
			id,
			input.allocation.members.map((member) => ({
				memberId: member.memberId,
				value: paramValueFor(input.allocation.method, member),
			})),
		);
		return record;
	}

	function hasActiveApplications(applications: { status: string }[]): boolean {
		return applications.some((application) => application.status === "active");
	}

	return {
		async createCategory(householdId, input, now, operationId) {
			const name = input.name.trim();
			if (!name) {
				throw new Error("category_name_required");
			}
			const existing = await deps.categories.findByHousehold(householdId);
			if (existing.some((category) => category.isActive && category.name.toLowerCase() === name.toLowerCase())) {
				throw new Error("category_name_taken");
			}
			const slug = slugify(name);
			const slugOwner = existing.find((category) => category.slug === slug);
			if (slugOwner) {
				// An inactive category with the same slug is reactivated and
				// renamed instead of trapping the name forever.
				if (slugOwner.isActive) {
					throw new Error("category_slug_taken");
				}
				await deps.categories.update(slugOwner.id, { name }, now);
				await deps.categories.setActive(slugOwner.id, true, now);
				return { ...slugOwner, name, isActive: true, updatedAt: now };
			}
			const record: ExpenseCategoryRecord = {
				id: crypto.randomUUID(),
				householdId,
				name,
				slug,
				ordering: input.ordering ?? existing.length,
				isActive: true,
				createdAt: now,
				updatedAt: now,
				operationId,
			};
			await deps.categories.create(record, now);
			return record;
		},

		async renameCategory(householdId, categoryId, name, now, operationId) {
			void operationId;
			const category = await requireCategory(householdId, categoryId);
			const trimmed = name.trim();
			if (!trimmed) {
				throw new Error("category_name_required");
			}
			const siblings = await deps.categories.findByHousehold(householdId);
			if (
				siblings.some(
					(sibling) =>
						sibling.id !== categoryId && sibling.isActive && sibling.name.toLowerCase() === trimmed.toLowerCase(),
				)
			) {
				throw new Error("category_name_taken");
			}
			await deps.categories.update(categoryId, { name: trimmed }, now);
			return { ...category, name: trimmed, updatedAt: now };
		},

		async deactivateCategory(householdId, categoryId, now, operationId) {
			void operationId;
			const category = await requireCategory(householdId, categoryId);
			// Referenced categories are never deleted: they go inactive and stay
			// visible on historical expenses.
			await deps.categories.setActive(categoryId, false, now);
			return { ...category, isActive: false, updatedAt: now };
		},

		async reactivateCategory(householdId, categoryId, now, operationId) {
			void operationId;
			const category = await requireCategory(householdId, categoryId);
			const siblings = await deps.categories.findByHousehold(householdId);
			if (
				siblings.some(
					(sibling) =>
						sibling.id !== categoryId && sibling.isActive && sibling.name.toLowerCase() === category.name.toLowerCase(),
				)
			) {
				throw new Error("category_name_taken");
			}
			await deps.categories.setActive(categoryId, true, now);
			return { ...category, isActive: true, updatedAt: now };
		},

		async listCategories(householdId) {
			return deps.categories.findByHousehold(householdId);
		},

		async postExpense(householdId, input, actorUserId, now, operationId) {
			if (operationId) {
				const replay = await deps.expenses.findByOperationId(operationId);
				if (replay) return replay;
			}
			return insertExpense(householdId, input, actorUserId, now, operationId);
		},

		async editDraftExpense(householdId, expenseId, input, now, operationId) {
			void operationId;
			const expense = await requireVisibleExpense(householdId, expenseId);
			if (expense.status !== "draft") {
				throw new Error("expense_not_draft");
			}
			const planned = input.plannedAmountMinor ?? null;
			const actual = input.actualAmountMinor ?? null;
			if (planned !== null && actual !== null) {
				throw new Error("expense_amount_ambiguous");
			}
			const amount = applicableAmountMinor(planned, actual);
			if (!Number.isInteger(amount) || amount <= 0) {
				throw new Error("expense_amount_not_positive");
			}
			if (!input.description.trim()) {
				throw new Error("expense_description_required");
			}
			await validateDateFields(input);
			await validateAccountHint(householdId, input.accountHintId);
			await requireCategory(householdId, input.categoryId);
			const period = await deps.periods.findById(input.reportingPeriodId);
			if (!period || period.householdId !== householdId) {
				throw new Error("period_not_found");
			}
			await validateAllocationMembers(householdId, input.allocation.members);
			const lines = resolveAllocations(input.allocation.method, amount, input.allocation.members);
			await deps.expenses.updateDraft(
				expenseId,
				{
					categoryId: input.categoryId,
					reportingPeriodId: input.reportingPeriodId,
					description: input.description.trim(),
					plannedAmountMinor: planned,
					actualAmountMinor: actual,
					accountingDate: input.accountingDate,
					dueDate: input.dueDate ?? null,
					serviceStartDate: input.serviceStartDate ?? null,
					serviceEndDate: input.serviceEndDate ?? null,
					accountHintId: input.accountHintId ?? null,
					allocationMethod: input.allocation.method,
				},
				now,
			);
			await deps.allocations.replaceLines(
				expenseId,
				expenseValueState(planned, actual) === "actual" ? "actual" : "planned",
				lines,
			);
			await deps.allocationParams.replaceParams(
				expenseId,
				input.allocation.members.map((member) => ({
					memberId: member.memberId,
					value: paramValueFor(input.allocation.method, member),
				})),
			);
			return { ...expense, description: input.description.trim(), updatedAt: now };
		},

		async deleteDraftExpense(householdId, expenseId, now, operationId) {
			void now;
			void operationId;
			const expense = await requireVisibleExpense(householdId, expenseId);
			if (expense.status !== "draft") {
				throw new Error("expense_not_draft");
			}
			await deps.evidence.deleteByExpense(expenseId);
			await deps.allocationParams.deleteByExpense(expenseId);
			await deps.allocations.deleteByExpense(expenseId);
			await deps.expenses.remove(expenseId);
		},

		async editExpectedExpense(householdId, expenseId, input, now, operationId) {
			void operationId;
			const expense = await requireVisibleExpense(householdId, expenseId);
			const activeApplications = await deps.applications.findActiveByExpense(expenseId);
			const editable =
				expense.status === "posted" &&
				expense.actualAmountMinor === null &&
				expense.plannedAmountMinor !== null &&
				expense.realizedByExpenseId === null &&
				!hasActiveApplications(activeApplications);
			if (!editable) {
				throw new Error("expense_not_editable");
			}

			if (input.description !== undefined && !input.description.trim()) {
				throw new Error("expense_description_required");
			}
			if (input.reportingPeriodId) {
				const period = await deps.periods.findById(input.reportingPeriodId);
				if (!period || period.householdId !== householdId) {
					throw new Error("period_not_found");
				}
			}
			await validateDateFields({
				dueDate: input.dueDate,
				serviceStartDate: input.serviceStartDate,
				serviceEndDate: input.serviceEndDate,
			});
			await validateAccountHint(householdId, input.accountHintId);

			const plannedAmount = input.plannedAmountMinor ?? expense.plannedAmountMinor!;
			if (!Number.isInteger(plannedAmount) || plannedAmount <= 0) {
				throw new Error("expense_amount_not_positive");
			}
			const memberMap = await householdMemberMap(householdId);
			const allocation = input.allocation ?? {
				method: expense.allocationMethod,
				members: selectionFromParams(
					expense.allocationMethod,
					await deps.allocationParams.findByExpense(expenseId),
					defaultWeightsByMember(memberMap),
				),
			};
			await validateAllocationMembers(householdId, allocation.members);
			const lines = resolveAllocations(allocation.method, plannedAmount, allocation.members);

			const plannedChanged = plannedAmount !== expense.plannedAmountMinor;
			const nextVersion = plannedChanged ? expense.plannedVersion + 1 : expense.plannedVersion;
			await deps.expenses.updateExpected(
				expenseId,
				{
					...(input.description !== undefined ? { description: input.description.trim() } : {}),
					plannedAmountMinor: plannedAmount,
					plannedVersion: nextVersion,
					...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
					...(input.reportingPeriodId !== undefined ? { reportingPeriodId: input.reportingPeriodId } : {}),
					...(input.serviceStartDate !== undefined ? { serviceStartDate: input.serviceStartDate } : {}),
					...(input.serviceEndDate !== undefined ? { serviceEndDate: input.serviceEndDate } : {}),
					...(input.accountHintId !== undefined ? { accountHintId: input.accountHintId } : {}),
					...(input.allocation !== undefined ? { allocationMethod: input.allocation.method } : {}),
				},
				now,
			);
			await deps.allocations.replaceLines(expenseId, "planned", lines);
			if (input.allocation) {
				await deps.allocationParams.replaceParams(
					expenseId,
					input.allocation.members.map((member) => ({
						memberId: member.memberId,
						value: paramValueFor(input.allocation!.method, member),
					})),
				);
			}
			return {
				...expense,
				plannedAmountMinor: plannedAmount,
				plannedVersion: nextVersion,
				updatedAt: now,
			};
		},

		async cancelExpectedExpense(householdId, expenseId, now, operationId) {
			void operationId;
			const expense = await requireVisibleExpense(householdId, expenseId);
			const activeApplications = await deps.applications.findActiveByExpense(expenseId);
			const cancellable =
				expense.status === "posted" &&
				expense.actualAmountMinor === null &&
				expense.plannedAmountMinor !== null &&
				expense.realizedByExpenseId === null &&
				!hasActiveApplications(activeApplications);
			if (!cancellable) {
				throw new Error("expense_not_cancellable");
			}
			await deps.expenses.markCancelled(expenseId, now);
			return { ...expense, status: "cancelled", updatedAt: now };
		},

		async actualizeExpense(householdId, expenseId, input, now, operationId) {
			void operationId;
			const expense = await requireVisibleExpense(householdId, expenseId);
			const actualizable =
				expense.status === "posted" && expense.actualAmountMinor === null && expense.realizedByExpenseId === null;
			if (!actualizable) {
				throw new Error("expense_not_actualizable");
			}
			const activeApplications = await deps.applications.findActiveByExpense(expenseId);
			if (hasActiveApplications(activeApplications)) {
				throw new Error("expense_has_payments");
			}
			if (!Number.isInteger(input.actualAmountMinor) || input.actualAmountMinor <= 0) {
				throw new Error("expense_amount_not_positive");
			}
			const memberMap = await householdMemberMap(householdId);
			const allocation = input.allocation ?? {
				method: expense.allocationMethod,
				members: selectionFromParams(
					expense.allocationMethod,
					await deps.allocationParams.findByExpense(expenseId),
					defaultWeightsByMember(memberMap),
				),
			};
			await validateAllocationMembers(householdId, allocation.members);
			const lines = resolveAllocations(allocation.method, input.actualAmountMinor, allocation.members);

			// Freeze: the planned amount stops moving here and becomes the
			// immutable realization baseline; identity and reference stay.
			await deps.expenses.setActualAmount(expenseId, input.actualAmountMinor, now);
			await deps.allocations.replaceLines(expenseId, "actual", lines);
			if (input.allocation) {
				await deps.allocationParams.replaceParams(
					expenseId,
					input.allocation.members.map((member) => ({
						memberId: member.memberId,
						value: paramValueFor(input.allocation!.method, member),
					})),
				);
				await deps.expenses.updateExpected(expenseId, { allocationMethod: input.allocation.method }, now);
			}
			return { ...expense, actualAmountMinor: input.actualAmountMinor, updatedAt: now };
		},

		async linkActualExpense(householdId, expectedId, actualId, now, operationId) {
			void operationId;
			const expected = await requireVisibleExpense(householdId, expectedId);
			const activeApplications = await deps.applications.findActiveByExpense(expectedId);
			const matchable =
				expected.status === "posted" &&
				expected.actualAmountMinor === null &&
				expected.realizedByExpenseId === null &&
				!hasActiveApplications(activeApplications);
			if (!matchable) {
				throw new Error("expense_not_matchable");
			}
			const actual = await requireVisibleExpense(householdId, actualId);
			// Only a separately entered actual (never an actualized occurrence)
			// may satisfy an expected one: one realization matches one plan.
			if (
				actual.id === expected.id ||
				actual.status !== "posted" ||
				actual.actualAmountMinor === null ||
				actual.plannedAmountMinor !== null
			) {
				throw new Error("expense_not_actual");
			}
			const existingMatch = (await deps.expenses.findByRealizedBy(actualId)).find(
				(expense) => expense.status === "posted",
			);
			if (existingMatch) {
				throw new Error("expense_already_matched");
			}
			await deps.expenses.setRealizedBy(expectedId, actualId, now);
			return { ...expected, realizedByExpenseId: actualId, updatedAt: now };
		},

		async unlinkActualExpense(householdId, expectedId, now, operationId) {
			void operationId;
			const expected = await requireVisibleExpense(householdId, expectedId);
			const activeApplications = await deps.applications.findActiveByExpense(expectedId);
			const unlinkable =
				expected.status === "posted" &&
				expected.actualAmountMinor === null &&
				expected.realizedByExpenseId !== null &&
				!hasActiveApplications(activeApplications);
			if (!unlinkable) {
				throw new Error("expense_not_unlinkable");
			}
			await deps.expenses.setRealizedBy(expectedId, null, now);
			return { ...expected, realizedByExpenseId: null, updatedAt: now };
		},

		async addEvidence(householdId, expenseId, input, actorUserId, now, operationId) {
			const expense = await requireVisibleExpense(householdId, expenseId);
			if (expense.status !== "draft" && expense.status !== "posted") {
				throw new Error("expense_not_posted");
			}
			const label = input.label.trim();
			if (!label) {
				throw new Error("evidence_label_required");
			}
			const validation = validateEvidenceUrl(input.url);
			if (!validation.ok) {
				throw new Error("evidence_url_not_allowed");
			}
			const record: ExpenseEvidenceRecord = {
				id: crypto.randomUUID(),
				expenseId,
				householdId,
				label,
				url: validation.normalizedUrl,
				note: input.note?.trim() ? input.note.trim() : null,
				status: "active",
				createdBy: actorUserId,
				createdAt: now,
				removedAt: null,
				operationId,
			};
			await deps.evidence.add(record);
			return record;
		},

		async removeEvidence(householdId, evidenceId, now, operationId) {
			void operationId;
			const record = await deps.evidence.findById(evidenceId);
			if (!record || record.householdId !== householdId) {
				throw new Error("evidence_not_found");
			}
			if (record.status === "removed") return;
			await deps.evidence.markRemoved(evidenceId, now);
		},

		async correctExpense(householdId, expenseId, replacement, actorUserId, now, operationId) {
			const expense = await requireVisibleExpense(householdId, expenseId);
			if (expense.status === "cancelled" || expense.status === "draft") {
				throw new Error("expense_not_correctable");
			}

			// An actualized correction replacement inherits the frozen planned
			// baseline: same amount and version, and the planned lines copied
			// verbatim so the baseline is never re-resolved.
			const actualizedOriginal = expense.plannedAmountMinor !== null && expense.actualAmountMinor !== null;
			const buildInherit = async () => ({
				chainRootId: expense.chainRootId,
				reference: expense.reference ?? "",
				replacesId: expenseId,
				...(actualizedOriginal
					? {
							plannedVersion: expense.plannedVersion,
							frozenPlannedLines: (await deps.allocations.findByExpense(expenseId))
								.filter((line) => line.basis === "planned")
								.map((line) => ({ memberId: line.memberId, amountMinor: line.amountMinor })),
						}
					: {}),
			});

			if (expense.status === "reversed") {
				// A half-applied correction resumes; a completed one is terminal.
				if (expense.reversedById) {
					const visibleReplacement = await deps.expenses.findVisibleById(expense.reversedById);
					if (visibleReplacement) {
						throw new Error("expense_already_reversed");
					}
				}
				const priorReplacement = replacement ? await deps.expenses.findReplacement(expenseId) : null;
				if (priorReplacement) {
					// Adopt the crashed attempt's invisible replacement into this
					// operation so completing the retry publishes it.
					const visible = await deps.expenses.findVisibleById(priorReplacement.id);
					if (!visible) {
						await deps.expenses.reattributeOperation(priorReplacement.id, operationId, now);
					}
					return { reversal: expense, replacement: { ...priorReplacement, operationId } };
				}
				if (!replacement) {
					return { reversal: expense, replacement: null };
				}
				const created = await insertExpense(
					householdId,
					{ ...replacement, inherit: await buildInherit() },
					actorUserId,
					now,
					operationId,
				);
				await deps.expenses.markReversed(expenseId, created.id, now);
				return { reversal: { ...expense, reversedById: created.id }, replacement: created };
			}

			// Cancellation, not correction, covers plain unpaid expected
			// records: reversal is reserved for actual or paid consumption.
			if (expense.actualAmountMinor === null) {
				const activeApplications = await deps.applications.findActiveByExpense(expenseId);
				if (expense.realizedByExpenseId === null && !hasActiveApplications(activeApplications)) {
					throw new Error("expense_not_correctable");
				}
			}

			// Validate the replacement BEFORE any visible flip, so a rejected
			// correction leaves the posted expense untouched.
			if (replacement) {
				const planned = replacement.plannedAmountMinor ?? null;
				const actual = replacement.actualAmountMinor ?? null;
				if (planned !== null && actual !== null && !actualizedOriginal) {
					throw new Error("expense_amount_ambiguous");
				}
				const amount = applicableAmountMinor(planned, actual);
				await validateAllocationMembers(householdId, replacement.allocation.members);
				resolveAllocations(replacement.allocation.method, amount, replacement.allocation.members);
			}

			// Application reversals flow through the payment service's single
			// seam (the settlement-aware guard will extend exactly there).
			if (applicationReversals) {
				await applicationReversals.reverseApplicationsForExpense(householdId, expenseId, now, operationId);
			} else {
				const activeApplications = await deps.applications.findActiveByExpense(expenseId);
				for (const application of activeApplications) {
					await deps.applications.markReversed(application.id, now);
				}
			}

			let replacementRecord: ExpenseRecord | null = null;
			if (replacement) {
				replacementRecord = await insertExpense(
					householdId,
					{ ...replacement, inherit: await buildInherit() },
					actorUserId,
					now,
					operationId,
				);
			}

			// Correction dissolves expected↔actual matches on either side so
			// both records stay matchable afterwards.
			if (expense.realizedByExpenseId !== null) {
				await deps.expenses.setRealizedBy(expenseId, null, now);
			}
			for (const matcher of await deps.expenses.findByRealizedBy(expenseId)) {
				if (matcher.status === "posted") {
					await deps.expenses.setRealizedBy(matcher.id, null, now);
				}
			}

			// The visible flip stays last so a failed operation can resume.
			await deps.expenses.markReversed(expenseId, replacementRecord?.id ?? null, now);
			return {
				reversal: { ...expense, status: "reversed", reversedById: replacementRecord?.id ?? null },
				replacement: replacementRecord,
			};
		},

		async insertOccurrence(householdId, input, actorUserId, now, operationId) {
			const members: AllocationMemberSelection[] = selectionFromParams(input.allocationMethod, input.allocationParams);
			return insertExpense(
				householdId,
				{
					categoryId: input.categoryId,
					reportingPeriodId: input.reportingPeriodId,
					description: input.description,
					plannedAmountMinor: input.plannedAmountMinor,
					accountingDate: input.accountingDate,
					dueDate: input.dueDate,
					serviceStartDate: input.serviceStartDate,
					serviceEndDate: input.serviceEndDate,
					accountHintId: input.accountHintId,
					allocation: { method: input.allocationMethod, members },
					templateId: input.templateId,
					scheduledDueDate: input.scheduledDueDate,
				},
				actorUserId,
				now,
				operationId,
			);
		},

		async getExpense(householdId, expenseId) {
			return requireVisibleExpense(householdId, expenseId);
		},
	};
}
