import { orderingKeyFor } from "$lib/accounts/model";
import { applicableAmountMinor } from "$lib/expenses/model";
import type { AccountHolderRepository, AccountRepository } from "../accounts/repository";
import type {
	ExpenseRepository,
	PaymentAccountEntryRecord,
	PaymentApplicationRecord,
	PaymentApplicationRepository,
	PaymentEntryRepository,
	PaymentRecord,
	PaymentRepository,
} from "./repository";

/**
 * Payment posting port. A payment is one account outflow with an explicit
 * funding source derived server-side from the account classification and
 * holders; applications explain which expenses that outflow discharged and
 * never create a second account movement. Reversal and replacement mirror
 * the transfer chain protocol: invisible rows first, visible flips last.
 */

export interface PostPaymentInput {
	accountId: string;
	amountMinor: number;
	effectiveAt: string;
	description: string;
}

export interface ApplicationInput {
	expenseId: string;
	amountMinor: number;
}

export interface PaymentView {
	payment: PaymentRecord;
	applications: PaymentApplicationRecord[];
	unappliedMinor: number;
}

interface PaymentDeps {
	payments: PaymentRepository;
	entries: PaymentEntryRepository;
	applications: PaymentApplicationRepository;
	expenses: ExpenseRepository;
}

interface AccountDeps {
	accounts: AccountRepository;
	holders: AccountHolderRepository;
}

export interface PaymentService {
	postPayment(
		householdId: string,
		input: PostPaymentInput,
		actorUserId: string,
		now: string,
		operationId: string | null,
	): Promise<PaymentRecord>;
	applyPayment(
		householdId: string,
		paymentId: string,
		applications: ApplicationInput[],
		now: string,
		operationId: string | null,
	): Promise<PaymentApplicationRecord[]>;
	reverseApplication(
		householdId: string,
		applicationId: string,
		now: string,
		operationId: string | null,
	): Promise<PaymentApplicationRecord>;
	/**
	 * The single seam through which every expense-side application reversal
	 * flows (expense corrections, and later the settlement-aware guard).
	 */
	reverseApplicationsForExpense(
		householdId: string,
		expenseId: string,
		now: string,
		operationId: string | null,
	): Promise<void>;
	correctPayment(
		householdId: string,
		paymentId: string,
		replacement: PostPaymentInput | null,
		actorUserId: string,
		now: string,
		operationId: string | null,
	): Promise<{ reversal: PaymentRecord; replacement: PaymentRecord | null }>;
	getPaymentView(householdId: string, paymentId: string): Promise<PaymentView>;
}

interface ChainInheritance {
	chainRootId: string;
	orderingKey: string;
	replacesId: string;
}

function entryFor(payment: PaymentRecord, amountMinor: number, operationId: string | null): PaymentAccountEntryRecord {
	return {
		id: crypto.randomUUID(),
		accountId: payment.accountId,
		paymentId: payment.id,
		chainRootId: payment.chainRootId,
		amountMinor,
		effectiveAt: payment.effectiveAt,
		orderingKey: payment.orderingKey,
		recordedAt: payment.recordedAt,
		operationId,
	};
}

export function createPaymentService(deps: PaymentDeps, accountDeps: AccountDeps): PaymentService {
	/**
	 * Funding attribution is derived server-side from the account's
	 * classification and current holders, never from form data.
	 */
	async function resolveFunding(account: { id: string; classification: string }): Promise<{
		fundingSource: "member" | "shared";
		funderMemberId: string | null;
	}> {
		if (account.classification === "personal") {
			const holders = await accountDeps.holders.currentHolderMemberIds(account.id);
			if (holders.length !== 1) {
				throw new Error("payment_funder_not_found");
			}
			return { fundingSource: "member", funderMemberId: holders[0]! };
		}
		return { fundingSource: "shared", funderMemberId: null };
	}

	async function requireVisiblePayment(householdId: string, paymentId: string): Promise<PaymentRecord> {
		const payment = await deps.payments.findVisibleById(paymentId);
		if (!payment || payment.householdId !== householdId) {
			throw new Error("payment_not_found");
		}
		return payment;
	}

	async function isEffectivelyReversed(payment: PaymentRecord): Promise<boolean> {
		if (!payment.reversedById) return false;
		const reversal = await deps.payments.findVisibleById(payment.reversedById);
		return reversal !== undefined;
	}

	async function requireCorrectablePayment(householdId: string, paymentId: string): Promise<PaymentRecord> {
		const payment = await requireVisiblePayment(householdId, paymentId);
		if (payment.status !== "posted" && payment.status !== "reversed") {
			throw new Error("payment_not_posted");
		}
		if (await isEffectivelyReversed(payment)) {
			throw new Error("payment_already_reversed");
		}
		return payment;
	}

	async function insertPayment(
		householdId: string,
		input: PostPaymentInput,
		actorUserId: string,
		now: string,
		operationId: string | null,
		inherit?: ChainInheritance,
	): Promise<PaymentRecord> {
		if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
			throw new Error("payment_amount_not_positive");
		}
		if (!input.description.trim()) {
			throw new Error("payment_description_required");
		}
		const account = await accountDeps.accounts.findById(input.accountId);
		if (!account || account.householdId !== householdId) {
			throw new Error("account_not_found");
		}
		if (!inherit) {
			if (account.status === "closed") {
				throw new Error("account_closed");
			}
			if (account.status !== "active") {
				throw new Error("account_not_active");
			}
		}

		const { fundingSource, funderMemberId } = await resolveFunding(account);

		const id = crypto.randomUUID();
		const payment: PaymentRecord = {
			id,
			householdId,
			accountId: account.id,
			amountMinor: input.amountMinor,
			description: input.description.trim(),
			effectiveAt: input.effectiveAt,
			orderingKey: inherit?.orderingKey ?? orderingKeyFor(input.effectiveAt, id),
			recordedAt: now,
			fundingSource,
			funderMemberId,
			status: "posted",
			chainRootId: inherit?.chainRootId ?? id,
			reversalOfId: null,
			replacesId: inherit?.replacesId ?? null,
			reversedById: null,
			actorUserId,
			operationId,
			createdAt: now,
		};
		await deps.payments.create(payment);
		// The singular account effect: one debit, exactly once.
		await deps.entries.appendMany([entryFor(payment, -payment.amountMinor, operationId)]);
		return payment;
	}

	async function insertReversalRows(
		original: PaymentRecord,
		now: string,
		operationId: string | null,
	): Promise<PaymentRecord> {
		const id = crypto.randomUUID();
		const reversal: PaymentRecord = {
			id,
			householdId: original.householdId,
			accountId: original.accountId,
			amountMinor: original.amountMinor,
			description: original.description,
			effectiveAt: original.effectiveAt,
			orderingKey: original.orderingKey,
			recordedAt: now,
			fundingSource: original.fundingSource,
			funderMemberId: original.funderMemberId,
			status: "posted",
			chainRootId: original.chainRootId,
			reversalOfId: original.id,
			replacesId: null,
			reversedById: null,
			actorUserId: original.actorUserId,
			operationId,
			createdAt: now,
		};
		await deps.payments.create(reversal);
		await deps.entries.appendMany([entryFor(reversal, reversal.amountMinor, operationId)]);
		return reversal;
	}

	/**
	 * Reads a payment written by this or an earlier operation: rows of the
	 * current operation are visible to their own composition (the paid-expense
	 * one-shot flow), while rows orphaned by a crashed operation are not.
	 */
	async function requireOperationPayment(householdId: string, paymentId: string, operationId: string | null) {
		const payment = await deps.payments.findById(paymentId);
		if (!payment || payment.householdId !== householdId) {
			throw new Error("payment_not_found");
		}
		if (payment.operationId !== operationId) {
			const visible = await deps.payments.findVisibleById(paymentId);
			if (!visible) {
				throw new Error("payment_not_found");
			}
		}
		return payment;
	}

	async function requireOperationExpense(householdId: string, expenseId: string, operationId: string | null) {
		const expense = await deps.expenses.findById(expenseId);
		if (!expense || expense.householdId !== householdId || expense.status !== "posted") {
			throw new Error("expense_not_posted");
		}
		if (expense.operationId !== operationId) {
			const visible = await deps.expenses.findVisibleById(expenseId);
			if (!visible) {
				throw new Error("expense_not_posted");
			}
		}
		return expense;
	}

	return {
		async postPayment(householdId, input, actorUserId, now, operationId) {
			if (operationId) {
				const replay = await deps.payments.findByOperationId(operationId);
				if (replay) return replay;
			}
			return insertPayment(householdId, input, actorUserId, now, operationId);
		},

		async applyPayment(householdId, paymentId, applications, now, operationId) {
			if (applications.length === 0) {
				throw new Error("application_selection_empty");
			}
			const payment = await requireOperationPayment(householdId, paymentId, operationId);
			if (payment.status !== "posted" || (await isEffectivelyReversed(payment))) {
				throw new Error("payment_not_posted");
			}

			// Validate every line before writing anything: a rejected
			// application leaves all balances unchanged.
			const requestedByExpense = new Map<string, number>();
			for (const application of applications) {
				if (!Number.isInteger(application.amountMinor) || application.amountMinor <= 0) {
					throw new Error("application_amount_not_positive");
				}
				const expense = await requireOperationExpense(householdId, application.expenseId, operationId);
				// A satisfied expected occurrence is discharged by its linked
				// actual expense; paying it again would double-count the bill.
				if (expense.realizedByExpenseId !== null) {
					throw new Error("expense_already_satisfied");
				}
				requestedByExpense.set(
					application.expenseId,
					(requestedByExpense.get(application.expenseId) ?? 0) + application.amountMinor,
				);
			}

			for (const [expenseId, requested] of requestedByExpense) {
				const expense = await requireOperationExpense(householdId, expenseId, operationId);
				const applicable = applicableAmountMinor(expense.plannedAmountMinor, expense.actualAmountMinor);
				const active = await deps.applications.findActiveByExpense(expenseId);
				const paid = active.reduce((sum, application) => sum + application.amountMinor, 0);
				if (requested > applicable - paid) {
					throw new Error("application_exceeds_unpaid");
				}
			}

			const totalRequested = applications.reduce((sum, application) => sum + application.amountMinor, 0);
			const activeOnPayment = await deps.applications.findActiveByPayment(paymentId);
			const unapplied =
				payment.amountMinor - activeOnPayment.reduce((sum, application) => sum + application.amountMinor, 0);
			if (totalRequested > unapplied) {
				throw new Error("application_exceeds_unapplied");
			}

			const created: PaymentApplicationRecord[] = [];
			for (const application of applications) {
				const record: PaymentApplicationRecord = {
					id: crypto.randomUUID(),
					householdId,
					paymentId,
					expenseId: application.expenseId,
					amountMinor: application.amountMinor,
					status: "active",
					recordedAt: now,
					reversedAt: null,
					operationId,
				};
				await deps.applications.create(record);
				created.push(record);
			}
			return created;
		},

		async reverseApplication(householdId, applicationId, now, operationId) {
			void operationId;
			const application = await deps.applications.findById(applicationId);
			if (!application || application.householdId !== householdId) {
				throw new Error("application_not_found");
			}
			// markReversed flips only active rows, so reversal is idempotent.
			await deps.applications.markReversed(applicationId, now);
			return { ...application, status: "reversed", reversedAt: now };
		},

		async reverseApplicationsForExpense(householdId, expenseId, now, operationId) {
			void operationId;
			const expense = await deps.expenses.findById(expenseId);
			if (!expense || expense.householdId !== householdId) {
				throw new Error("expense_not_found");
			}
			const activeApplications = await deps.applications.findActiveByExpense(expenseId);
			for (const application of activeApplications) {
				await deps.applications.markReversed(application.id, now);
			}
		},

		async correctPayment(householdId, paymentId, replacement, actorUserId, now, operationId) {
			const payment = await requireCorrectablePayment(householdId, paymentId);

			// Validate the replacement BEFORE any visible flip, including that
			// its funding source still resolves (holder intervals may have
			// changed since the original payment was posted).
			if (replacement) {
				if (!Number.isInteger(replacement.amountMinor) || replacement.amountMinor <= 0) {
					throw new Error("payment_amount_not_positive");
				}
				if (!replacement.description.trim()) {
					throw new Error("payment_description_required");
				}
				const account = await accountDeps.accounts.findById(replacement.accountId);
				if (!account || account.householdId !== householdId) {
					throw new Error("account_not_found");
				}
				await resolveFunding(account);
			}

			// Active applications of a reversed payment are incompatible: they
			// reverse so expense paid values and unapplied value recalculate.
			const activeApplications = await deps.applications.findActiveByPayment(paymentId);
			for (const application of activeApplications) {
				await deps.applications.markReversed(application.id, now);
			}

			// Mirror the transfer correction protocol exactly: always insert
			// fresh reversal rows under the current operation and re-point the
			// flip. A crashed attempt's invisible rows stay orphaned instead of
			// being adopted, so the retrying operation always heals the chain.
			const reversal = await insertReversalRows(payment, now, operationId);
			await deps.payments.markReversed(payment.id, reversal.id);

			let replacementRecord: PaymentRecord | null = null;
			if (replacement) {
				replacementRecord = await insertPayment(householdId, replacement, actorUserId, now, operationId, {
					chainRootId: payment.chainRootId,
					orderingKey: payment.orderingKey,
					replacesId: payment.id,
				});
			}

			return { reversal, replacement: replacementRecord };
		},

		async getPaymentView(householdId, paymentId) {
			const payment = await requireVisiblePayment(householdId, paymentId);
			const applications = await deps.applications.findActiveByPayment(paymentId);
			const unappliedMinor =
				payment.status === "reversed"
					? 0
					: payment.amountMinor - applications.reduce((sum, application) => sum + application.amountMinor, 0);
			return { payment, applications, unappliedMinor };
		},
	};
}
