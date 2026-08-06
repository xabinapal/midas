import type { Kysely } from "kysely";
import type { Database } from "../database";
import { createAccountHolderRepository, createAccountRepository } from "../accounts/repository";
import { createMemberRepository } from "../household/repository";
import { createPaymentService } from "./payments";
import { createPlanningService } from "./planning";
import {
	createExpenseAllocationParamRepository,
	createExpenseAllocationRepository,
	createExpenseCategoryRepository,
	createExpenseEvidenceRepository,
	createExpenseRepository,
	createPaymentApplicationRepository,
	createPaymentEntryRepository,
	createPaymentRepository,
	createRecurringTemplateRepository,
	createReportingPeriodRepository,
	createTemplateAllocationParamRepository,
} from "./repository";
import { createExpenseService } from "./service";

/**
 * Wires the expense, payment, and planning services with their real
 * repositories. Routes compose behavior through these narrow interfaces;
 * domain tests inject fakes instead.
 */
export function createExpenseServices(db: Kysely<Database>) {
	const categories = createExpenseCategoryRepository(db);
	const periods = createReportingPeriodRepository(db);
	const templates = createRecurringTemplateRepository(db);
	const templateParams = createTemplateAllocationParamRepository(db);
	const expenses = createExpenseRepository(db);
	const allocations = createExpenseAllocationRepository(db);
	const allocationParams = createExpenseAllocationParamRepository(db);
	const payments = createPaymentRepository(db);
	const paymentEntries = createPaymentEntryRepository(db);
	const applications = createPaymentApplicationRepository(db);
	const evidence = createExpenseEvidenceRepository(db);
	const members = createMemberRepository(db);
	const accounts = createAccountRepository(db);
	const holders = createAccountHolderRepository(db);

	const paymentService = createPaymentService(
		{ payments, entries: paymentEntries, applications, expenses },
		{ accounts, holders },
	);
	const expenseService = createExpenseService(
		{ categories, periods, expenses, allocations, allocationParams, applications, evidence },
		{ members, accounts },
		paymentService,
	);
	const planningService = createPlanningService(
		{ periods, templates, templateParams, expenses },
		{ categories, members, accounts },
		expenseService,
	);

	return {
		expenseService,
		paymentService,
		planningService,
		repositories: {
			categories,
			periods,
			templates,
			templateParams,
			expenses,
			allocations,
			allocationParams,
			payments,
			paymentEntries,
			applications,
			evidence,
			members,
			accounts,
			holders,
		},
	};
}
