import type { Kysely } from "kysely";
import { hashPassword } from "../../src/lib/server/auth/password";
import { orderingKeyFor } from "../../src/lib/accounts/model";
import type { Database } from "../../src/lib/server/database/schema";

const APPLICATION_TABLES_IN_DELETE_ORDER = [
	"consumed_recovery_credentials",
	"activity_events",
	"sessions",
	"expense_evidence",
	"payment_applications",
	"payment_account_entries",
	"payments",
	"expense_allocation_params",
	"expense_allocations",
	"expenses",
	"recurring_template_allocation_params",
	"recurring_templates",
	"reporting_periods",
	"expense_categories",
	"distribution_allocations",
	"distributions",
	"contribution_allocations",
	"contributions",
	"account_entries",
	"account_transfers",
	"balance_observations",
	"account_holder_intervals",
	"accounts",
	"member_intervals",
	"members",
	"users",
	"operation_roots",
	"household_command_gates",
	"households",
	"bootstrap_gate",
] as const satisfies readonly (keyof Database)[];

export const DEVELOPMENT_USERNAME = "developer";
export const DEVELOPMENT_PASSWORD = "development-password";

export interface PreseedResult {
	households: number;
	members: number;
	users: number;
	accounts: number;
	transfers: number;
	observations: number;
	expenses: number;
	payments: number;
	username: string;
}

export interface PreseedOptions {
	createId?: () => string;
	now?: () => Date;
	salt?: Uint8Array<ArrayBuffer>;
}

export async function preseedDatabase(
	db: Kysely<Database>,
	{ createId = () => crypto.randomUUID(), now = () => new Date(), salt }: PreseedOptions = {},
): Promise<PreseedResult> {
	for (const table of APPLICATION_TABLES_IN_DELETE_ORDER) {
		await db.deleteFrom(table).execute();
	}

	const timestamp = now().toISOString();
	const householdId = createId();
	const adminMemberId = createId();
	const regularMemberId = createId();
	const inactiveMemberId = createId();

	await db
		.insertInto("bootstrap_gate")
		.values({
			id: 1,
			state: "complete",
			operation_id: null,
			lease_expires_at: null,
			completed_at: timestamp,
		})
		.execute();

	await db
		.insertInto("households")
		.values({
			id: householdId,
			name: "Piso",
			currency: "EUR",
			timezone: "Europe/Madrid",
			locale: "es-ES",
			version: createId(),
			created_at: timestamp,
			updated_at: timestamp,
		})
		.execute();

	await db
		.insertInto("members")
		.values([
			{
				id: adminMemberId,
				household_id: householdId,
				display_name: "Alex",
				is_active: 1,
				created_at: timestamp,
				updated_at: timestamp,
			},
			{
				id: regularMemberId,
				household_id: householdId,
				display_name: "Sam",
				is_active: 1,
				created_at: timestamp,
				updated_at: timestamp,
			},
			{
				id: inactiveMemberId,
				household_id: householdId,
				display_name: "Jordan",
				is_active: 0,
				created_at: timestamp,
				updated_at: timestamp,
			},
		])
		.execute();

	const passwordHash = await hashPassword(DEVELOPMENT_PASSWORD, salt);

	await db
		.insertInto("users")
		.values([
			{
				id: createId(),
				username: DEVELOPMENT_USERNAME,
				password_hash: passwordHash,
				household_id: householdId,
				member_id: adminMemberId,
				is_active: 1,
				is_administrator: 1,
				requires_password_change: 0,
				created_at: timestamp,
				updated_at: timestamp,
			},
			{
				id: createId(),
				username: "user",
				password_hash: passwordHash,
				household_id: householdId,
				member_id: regularMemberId,
				is_active: 1,
				is_administrator: 0,
				requires_password_change: 0,
				created_at: timestamp,
				updated_at: timestamp,
			},
		])
		.execute();

	const dayMs = 24 * 60 * 60 * 1000;
	const daysAgo = (days: number) => new Date(now().getTime() - days * dayMs).toISOString();

	const alexAccountId = createId();
	const samAccountId = createId();
	const sharedAccountId = createId();
	const closedAccountId = createId();
	const unobservedAccountId = createId();

	await db
		.insertInto("accounts")
		.values([
			{
				id: alexAccountId,
				household_id: householdId,
				name: "Cuenta de Alex",
				classification: "personal",
				status: "active",
				currency: "EUR",
				created_at: daysAgo(90),
				updated_at: daysAgo(90),
			},
			{
				id: samAccountId,
				household_id: householdId,
				name: "Cuenta de Sam",
				classification: "personal",
				status: "active",
				currency: "EUR",
				created_at: daysAgo(90),
				updated_at: daysAgo(90),
			},
			{
				id: sharedAccountId,
				household_id: householdId,
				name: "Cuenta común",
				classification: "shared",
				status: "active",
				currency: "EUR",
				created_at: daysAgo(80),
				updated_at: daysAgo(80),
			},
			{
				id: closedAccountId,
				household_id: householdId,
				name: "Cuenta antigua de Jordan",
				classification: "personal",
				status: "closed",
				currency: "EUR",
				created_at: daysAgo(70),
				updated_at: daysAgo(10),
			},
			{
				id: unobservedAccountId,
				household_id: householdId,
				name: "Hucha del hogar",
				classification: "shared",
				status: "active",
				currency: "EUR",
				created_at: daysAgo(5),
				updated_at: daysAgo(5),
			},
		])
		.execute();

	await db
		.insertInto("account_holder_intervals")
		.values([
			{
				id: createId(),
				account_id: alexAccountId,
				member_id: adminMemberId,
				effective_from: daysAgo(90),
				effective_to: null,
				operation_id: null,
			},
			{
				id: createId(),
				account_id: samAccountId,
				member_id: regularMemberId,
				effective_from: daysAgo(90),
				effective_to: null,
				operation_id: null,
			},
			{
				id: createId(),
				account_id: sharedAccountId,
				member_id: adminMemberId,
				effective_from: daysAgo(80),
				effective_to: null,
				operation_id: null,
			},
			{
				id: createId(),
				account_id: sharedAccountId,
				member_id: regularMemberId,
				effective_from: daysAgo(80),
				effective_to: null,
				operation_id: null,
			},
			{
				id: createId(),
				account_id: closedAccountId,
				member_id: inactiveMemberId,
				effective_from: daysAgo(70),
				effective_to: null,
				operation_id: null,
			},
			{
				id: createId(),
				account_id: unobservedAccountId,
				member_id: adminMemberId,
				effective_from: daysAgo(5),
				effective_to: null,
				operation_id: null,
			},
			{
				id: createId(),
				account_id: unobservedAccountId,
				member_id: regularMemberId,
				effective_from: daysAgo(5),
				effective_to: null,
				operation_id: null,
			},
		])
		.execute();

	interface ObservationSeed {
		id: string;
		accountId: string;
		amountMinor: number;
		effectiveAt: string;
		recordedAt: string;
		status: "valid" | "invalidated";
		replacesObservationId?: string;
		invalidatedAt?: string;
	}

	const staleObservationId = createId();
	const observations: ObservationSeed[] = [
		{
			id: staleObservationId,
			accountId: sharedAccountId,
			amountMinor: 145000,
			effectiveAt: daysAgo(32),
			recordedAt: daysAgo(32),
			status: "invalidated",
			invalidatedAt: daysAgo(30),
		},
		{
			id: createId(),
			accountId: sharedAccountId,
			amountMinor: 150000,
			effectiveAt: daysAgo(30),
			recordedAt: daysAgo(30),
			status: "valid",
			replacesObservationId: staleObservationId,
		},
		{
			id: createId(),
			accountId: alexAccountId,
			amountMinor: 80000,
			effectiveAt: daysAgo(30),
			recordedAt: daysAgo(30),
			status: "valid",
		},
		{
			id: createId(),
			accountId: closedAccountId,
			amountMinor: 0,
			effectiveAt: daysAgo(10),
			recordedAt: daysAgo(10),
			status: "valid",
		},
	];
	await db
		.insertInto("balance_observations")
		.values(
			observations.map((observation) => ({
				id: observation.id,
				account_id: observation.accountId,
				amount_minor: observation.amountMinor,
				effective_at: observation.effectiveAt,
				ordering_key: orderingKeyFor(observation.effectiveAt, observation.id),
				recorded_at: observation.recordedAt,
				status: observation.status,
				replaces_observation_id: observation.replacesObservationId ?? null,
				invalidated_at: observation.invalidatedAt ?? null,
				operation_id: null,
			})),
		)
		.execute();

	interface TransferSeed {
		id: string;
		sourceAccountId: string;
		destinationAccountId: string;
		amountMinor: number;
		effectiveAt: string;
		recordedAt: string;
		description: string;
		classification: "unclassified" | "pure" | "contribution" | "distribution";
		status: "posted" | "reversed";
		chainRootId: string;
		reversalOfId?: string;
		replacesId?: string;
		reversedById?: string;
	}

	const correctedOriginalId = createId();
	const correctedReversalId = createId();
	const correctedReplacementId = createId();
	const contributionAlexId = createId();
	const contributionSamId = createId();
	const distributionSamId = createId();
	const pureTransferId = createId();
	const unclassifiedTransferId = createId();

	const transfers: TransferSeed[] = [
		{
			id: contributionAlexId,
			sourceAccountId: alexAccountId,
			destinationAccountId: sharedAccountId,
			amountMinor: 60000,
			effectiveAt: daysAgo(28),
			recordedAt: daysAgo(28),
			description: "Aportación mensual de Alex",
			classification: "contribution",
			status: "posted",
			chainRootId: contributionAlexId,
		},
		{
			id: contributionSamId,
			sourceAccountId: samAccountId,
			destinationAccountId: sharedAccountId,
			amountMinor: 40000,
			effectiveAt: daysAgo(27),
			recordedAt: daysAgo(27),
			description: "Aportación mensual de Sam",
			classification: "contribution",
			status: "posted",
			chainRootId: contributionSamId,
		},
		{
			id: distributionSamId,
			sourceAccountId: sharedAccountId,
			destinationAccountId: samAccountId,
			amountMinor: 15000,
			effectiveAt: daysAgo(15),
			recordedAt: daysAgo(15),
			description: "Distribución de sobrante para Sam",
			classification: "distribution",
			status: "posted",
			chainRootId: distributionSamId,
		},
		{
			id: pureTransferId,
			sourceAccountId: alexAccountId,
			destinationAccountId: samAccountId,
			amountMinor: 2000,
			effectiveAt: daysAgo(12),
			recordedAt: daysAgo(12),
			description: "Cambio de efectivo",
			classification: "pure",
			status: "posted",
			chainRootId: pureTransferId,
		},
		{
			id: correctedOriginalId,
			sourceAccountId: alexAccountId,
			destinationAccountId: sharedAccountId,
			amountMinor: 5000,
			effectiveAt: daysAgo(8),
			recordedAt: daysAgo(8),
			description: "Traspaso para la compra común",
			classification: "pure",
			status: "reversed",
			chainRootId: correctedOriginalId,
			reversedById: correctedReversalId,
		},
		{
			id: correctedReversalId,
			sourceAccountId: sharedAccountId,
			destinationAccountId: alexAccountId,
			amountMinor: 5000,
			effectiveAt: daysAgo(8),
			recordedAt: daysAgo(7),
			description: "Traspaso para la compra común",
			classification: "pure",
			status: "posted",
			chainRootId: correctedOriginalId,
			reversalOfId: correctedOriginalId,
		},
		{
			id: correctedReplacementId,
			sourceAccountId: alexAccountId,
			destinationAccountId: sharedAccountId,
			amountMinor: 7500,
			effectiveAt: daysAgo(8),
			recordedAt: daysAgo(7),
			description: "Traspaso para la compra común (corregido)",
			classification: "pure",
			status: "posted",
			chainRootId: correctedOriginalId,
			replacesId: correctedOriginalId,
		},
		{
			id: unclassifiedTransferId,
			sourceAccountId: samAccountId,
			destinationAccountId: sharedAccountId,
			amountMinor: 3000,
			effectiveAt: daysAgo(2),
			recordedAt: daysAgo(2),
			description: "Ingreso pendiente de clasificar",
			classification: "unclassified",
			status: "posted",
			chainRootId: unclassifiedTransferId,
		},
	];

	for (const transfer of transfers) {
		await db
			.insertInto("account_transfers")
			.values({
				id: transfer.id,
				household_id: householdId,
				source_account_id: transfer.sourceAccountId,
				destination_account_id: transfer.destinationAccountId,
				amount_minor: transfer.amountMinor,
				effective_at: transfer.effectiveAt,
				ordering_key: orderingKeyFor(transfer.effectiveAt, transfer.chainRootId),
				recorded_at: transfer.recordedAt,
				description: transfer.description,
				classification: transfer.classification,
				status: transfer.status,
				chain_root_id: transfer.chainRootId,
				reversal_of_id: transfer.reversalOfId ?? null,
				replaces_id: transfer.replacesId ?? null,
				reversed_by_id: null,
				operation_id: null,
				created_at: transfer.recordedAt,
			})
			.execute();
	}

	// Link reversed originals to their reversals once every transfer exists
	for (const transfer of transfers) {
		if (!transfer.reversedById) continue;
		await db
			.updateTable("account_transfers")
			.set({ reversed_by_id: transfer.reversedById })
			.where("id", "=", transfer.id)
			.execute();
	}

	for (const transfer of transfers) {
		const orderingKey = orderingKeyFor(transfer.effectiveAt, transfer.chainRootId);
		await db
			.insertInto("account_entries")
			.values([
				{
					id: createId(),
					account_id: transfer.sourceAccountId,
					transfer_id: transfer.id,
					chain_root_id: transfer.chainRootId,
					amount_minor: -transfer.amountMinor,
					effective_at: transfer.effectiveAt,
					ordering_key: orderingKey,
					recorded_at: transfer.recordedAt,
					operation_id: null,
				},
				{
					id: createId(),
					account_id: transfer.destinationAccountId,
					transfer_id: transfer.id,
					chain_root_id: transfer.chainRootId,
					amount_minor: transfer.amountMinor,
					effective_at: transfer.effectiveAt,
					ordering_key: orderingKey,
					recorded_at: transfer.recordedAt,
					operation_id: null,
				},
			])
			.execute();
	}

	const contributionAlexRecordId = createId();
	const contributionSamRecordId = createId();
	await db
		.insertInto("contributions")
		.values([
			{
				id: contributionAlexRecordId,
				household_id: householdId,
				transfer_id: contributionAlexId,
				member_id: adminMemberId,
				amount_minor: 60000,
				status: "posted",
				recorded_at: daysAgo(28),
				operation_id: null,
			},
			{
				id: contributionSamRecordId,
				household_id: householdId,
				transfer_id: contributionSamId,
				member_id: regularMemberId,
				amount_minor: 40000,
				status: "posted",
				recorded_at: daysAgo(27),
				operation_id: null,
			},
		])
		.execute();

	await db
		.insertInto("contribution_allocations")
		.values([
			{
				id: createId(),
				contribution_id: contributionAlexRecordId,
				member_id: adminMemberId,
				amount_minor: 60000,
			},
			{
				id: createId(),
				contribution_id: contributionSamRecordId,
				member_id: regularMemberId,
				amount_minor: 40000,
			},
		])
		.execute();

	const distributionSamRecordId = createId();
	await db
		.insertInto("distributions")
		.values({
			id: distributionSamRecordId,
			household_id: householdId,
			transfer_id: distributionSamId,
			member_id: regularMemberId,
			amount_minor: 15000,
			status: "posted",
			recorded_at: daysAgo(15),
			operation_id: null,
		})
		.execute();

	await db
		.insertInto("distribution_allocations")
		.values({
			id: createId(),
			distribution_id: distributionSamRecordId,
			member_id: regularMemberId,
			amount_minor: 15000,
		})
		.execute();

	// ---- Expense and planning seed ----
	// Varied categories, periods, templates, estimates, actuals, annual spans,
	// member subsets, custom splits, shared/personal payments, partial and
	// multi applications, cancellations, and full reversal chains.

	const periodOf = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
	const shiftPeriod = (period: string, months: number) => {
		const year = Number(period.slice(0, 4));
		const month = Number(period.slice(5, 7));
		return periodOf(new Date(Date.UTC(year, month - 1 + months, 1)));
	};
	const currentPeriod = periodOf(now());
	const previousPeriod = shiftPeriod(currentPeriod, -1);

	const viviendaCategoryId = createId();
	const suministrosCategoryId = createId();
	const supermercadoCategoryId = createId();
	const segurosCategoryId = createId();
	const ocioCategoryId = createId();
	const telefoniaAntiguaCategoryId = createId();

	const categories = [
		{ id: viviendaCategoryId, name: "Vivienda", slug: "vivienda", ordering: 0, isActive: 1 },
		{ id: suministrosCategoryId, name: "Suministros", slug: "suministros", ordering: 1, isActive: 1 },
		{ id: supermercadoCategoryId, name: "Supermercado", slug: "supermercado", ordering: 2, isActive: 1 },
		{ id: segurosCategoryId, name: "Seguros", slug: "seguros", ordering: 3, isActive: 1 },
		{ id: ocioCategoryId, name: "Ocio", slug: "ocio", ordering: 4, isActive: 1 },
		{ id: telefoniaAntiguaCategoryId, name: "Telefonía antigua", slug: "telefonia-antigua", ordering: 5, isActive: 0 },
	];
	await db
		.insertInto("expense_categories")
		.values(
			categories.map((category) => ({
				id: category.id,
				household_id: householdId,
				name: category.name,
				slug: category.slug,
				ordering: category.ordering,
				is_active: category.isActive as 0 | 1,
				created_at: timestamp,
				updated_at: timestamp,
				operation_id: null,
			})),
		)
		.execute();

	const currentPeriodId = createId();
	const previousPeriodId = createId();
	const customPeriodId = createId();
	await db
		.insertInto("reporting_periods")
		.values([
			{
				id: previousPeriodId,
				household_id: householdId,
				slug: previousPeriod,
				label: previousPeriod,
				start_date: `${previousPeriod}-01`,
				end_date: `${currentPeriod}-01`,
				kind: "standard",
				created_at: timestamp,
				operation_id: null,
			},
			{
				id: currentPeriodId,
				household_id: householdId,
				slug: currentPeriod,
				label: currentPeriod,
				start_date: `${currentPeriod}-01`,
				end_date: `${shiftPeriod(currentPeriod, 1)}-01`,
				kind: "standard",
				created_at: timestamp,
				operation_id: null,
			},
			{
				id: customPeriodId,
				household_id: householdId,
				slug: "vacaciones-de-verano",
				label: "Vacaciones de verano",
				start_date: `${previousPeriod}-15`,
				end_date: `${currentPeriod}-15`,
				kind: "custom",
				created_at: timestamp,
				operation_id: null,
			},
		])
		.execute();

	const alquilerTemplateId = createId();
	const seguroTemplateId = createId();
	await db
		.insertInto("recurring_templates")
		.values([
			{
				id: alquilerTemplateId,
				household_id: householdId,
				category_id: viviendaCategoryId,
				description: "Alquiler",
				estimated_amount_minor: 90000,
				cadence: "monthly",
				interval_count: 1,
				start_date: `${previousPeriod}-01`,
				end_date: null,
				due_day: null,
				service_span_months: 1,
				account_hint_id: sharedAccountId,
				allocation_method: "equal",
				status: "active",
				created_at: timestamp,
				updated_at: timestamp,
				operation_id: null,
			},
			{
				id: seguroTemplateId,
				household_id: householdId,
				category_id: segurosCategoryId,
				description: "Seguro del hogar",
				estimated_amount_minor: 120000,
				cadence: "yearly",
				interval_count: 1,
				start_date: `${currentPeriod}-15`,
				end_date: null,
				due_day: null,
				service_span_months: 12,
				account_hint_id: null,
				allocation_method: "default_weight",
				status: "active",
				created_at: timestamp,
				updated_at: timestamp,
				operation_id: null,
			},
		])
		.execute();

	await db
		.insertInto("recurring_template_allocation_params")
		.values([
			{ id: createId(), template_id: alquilerTemplateId, member_id: adminMemberId, value: null },
			{ id: createId(), template_id: alquilerTemplateId, member_id: regularMemberId, value: null },
			{ id: createId(), template_id: seguroTemplateId, member_id: adminMemberId, value: null },
			{ id: createId(), template_id: seguroTemplateId, member_id: regularMemberId, value: null },
		])
		.execute();

	interface ExpenseSeed {
		id: string;
		categoryId: string;
		reportingPeriodId: string;
		description: string;
		reference: string | null;
		status: string;
		plannedAmountMinor: number | null;
		actualAmountMinor: number | null;
		accountingDate: string;
		dueDate?: string;
		serviceStartDate?: string;
		serviceEndDate?: string;
		allocationMethod: string;
		accountHintId?: string;
		templateId?: string;
		scheduledDueDate?: string;
		chainRootId: string;
		replacesId?: string;
		reversedById?: string;
	}

	const alquilerOccurrenceId = createId();
	const luzExpenseId = createId();
	const compraExpenseId = createId();
	const estimacionAguaExpenseId = createId();
	const facturaAguaExpenseId = createId();
	const seguroExpenseId = createId();
	const telefoniaExpenseId = createId();
	const comunidadOriginalId = createId();
	const comunidadReplacementId = createId();
	const regaloExpenseId = createId();
	const hotelExpenseId = createId();

	const expenseSeeds: ExpenseSeed[] = [
		{
			id: alquilerOccurrenceId,
			categoryId: viviendaCategoryId,
			reportingPeriodId: currentPeriodId,
			description: "Alquiler",
			reference: `vivienda/${currentPeriod}`,
			status: "posted",
			plannedAmountMinor: 90000,
			actualAmountMinor: null,
			accountingDate: `${currentPeriod}-01`,
			dueDate: `${currentPeriod}-01`,
			serviceStartDate: `${currentPeriod}-01`,
			serviceEndDate: `${shiftPeriod(currentPeriod, 1)}-01`,
			allocationMethod: "equal",
			accountHintId: sharedAccountId,
			templateId: alquilerTemplateId,
			scheduledDueDate: `${currentPeriod}-01`,
			chainRootId: alquilerOccurrenceId,
		},
		{
			id: luzExpenseId,
			categoryId: suministrosCategoryId,
			reportingPeriodId: currentPeriodId,
			description: "Factura de la luz",
			reference: `suministros/${currentPeriod}`,
			status: "posted",
			plannedAmountMinor: null,
			actualAmountMinor: 8500,
			accountingDate: `${currentPeriod}-03`,
			dueDate: `${currentPeriod}-12`,
			allocationMethod: "equal",
			chainRootId: luzExpenseId,
		},
		{
			id: compraExpenseId,
			categoryId: supermercadoCategoryId,
			reportingPeriodId: currentPeriodId,
			description: "Compra semanal",
			reference: `supermercado/${currentPeriod}`,
			status: "posted",
			plannedAmountMinor: null,
			actualAmountMinor: 12345,
			accountingDate: `${currentPeriod}-04`,
			allocationMethod: "custom_weight",
			chainRootId: compraExpenseId,
		},
		{
			id: estimacionAguaExpenseId,
			categoryId: suministrosCategoryId,
			reportingPeriodId: currentPeriodId,
			description: "Estimación del agua",
			reference: `suministros/${currentPeriod}-2`,
			status: "posted",
			plannedAmountMinor: 4000,
			actualAmountMinor: null,
			accountingDate: `${currentPeriod}-05`,
			allocationMethod: "percentage",
			chainRootId: estimacionAguaExpenseId,
		},
		{
			id: facturaAguaExpenseId,
			categoryId: suministrosCategoryId,
			reportingPeriodId: previousPeriodId,
			description: "Factura del agua",
			reference: `suministros/${previousPeriod}`,
			status: "posted",
			plannedAmountMinor: 4000,
			actualAmountMinor: 4350,
			accountingDate: `${previousPeriod}-20`,
			allocationMethod: "equal",
			chainRootId: facturaAguaExpenseId,
		},
		{
			id: seguroExpenseId,
			categoryId: segurosCategoryId,
			reportingPeriodId: currentPeriodId,
			description: "Seguro del hogar",
			reference: `seguros/${currentPeriod}`,
			status: "posted",
			plannedAmountMinor: 120000,
			actualAmountMinor: 120000,
			accountingDate: `${currentPeriod}-15`,
			dueDate: `${currentPeriod}-15`,
			serviceStartDate: `${currentPeriod}-01`,
			serviceEndDate: `${shiftPeriod(currentPeriod, 12)}-01`,
			allocationMethod: "default_weight",
			templateId: seguroTemplateId,
			scheduledDueDate: `${currentPeriod}-15`,
			chainRootId: seguroExpenseId,
		},
		{
			id: telefoniaExpenseId,
			categoryId: telefoniaAntiguaCategoryId,
			reportingPeriodId: previousPeriodId,
			description: "Teléfono fijo",
			reference: `telefonia-antigua/${previousPeriod}`,
			status: "posted",
			plannedAmountMinor: null,
			actualAmountMinor: 3000,
			accountingDate: `${previousPeriod}-10`,
			allocationMethod: "equal",
			chainRootId: telefoniaExpenseId,
		},
		{
			id: comunidadOriginalId,
			categoryId: viviendaCategoryId,
			reportingPeriodId: previousPeriodId,
			description: "Comunidad de vecinos",
			reference: `vivienda/${previousPeriod}`,
			status: "reversed",
			plannedAmountMinor: null,
			actualAmountMinor: 6000,
			accountingDate: `${previousPeriod}-08`,
			allocationMethod: "equal",
			chainRootId: comunidadOriginalId,
			reversedById: comunidadReplacementId,
		},
		{
			id: comunidadReplacementId,
			categoryId: viviendaCategoryId,
			reportingPeriodId: previousPeriodId,
			description: "Comunidad de vecinos",
			reference: `vivienda/${previousPeriod}`,
			status: "posted",
			plannedAmountMinor: null,
			actualAmountMinor: 6500,
			accountingDate: `${previousPeriod}-08`,
			allocationMethod: "equal",
			chainRootId: comunidadOriginalId,
			replacesId: comunidadOriginalId,
		},
		{
			id: regaloExpenseId,
			categoryId: ocioCategoryId,
			reportingPeriodId: currentPeriodId,
			description: "Regalo de cumpleaños",
			reference: `ocio/${currentPeriod}`,
			status: "cancelled",
			plannedAmountMinor: 5000,
			actualAmountMinor: null,
			accountingDate: `${currentPeriod}-18`,
			allocationMethod: "equal",
			chainRootId: regaloExpenseId,
		},
		{
			id: hotelExpenseId,
			categoryId: ocioCategoryId,
			reportingPeriodId: customPeriodId,
			description: "Hotel de vacaciones",
			reference: "ocio/vacaciones-de-verano",
			status: "posted",
			plannedAmountMinor: null,
			actualAmountMinor: 45000,
			accountingDate: `${previousPeriod}-22`,
			allocationMethod: "equal",
			chainRootId: hotelExpenseId,
		},
	];

	for (const seed of expenseSeeds) {
		await db
			.insertInto("expenses")
			.values({
				id: seed.id,
				household_id: householdId,
				category_id: seed.categoryId,
				reporting_period_id: seed.reportingPeriodId,
				description: seed.description,
				reference: seed.reference,
				status: seed.status,
				planned_amount_minor: seed.plannedAmountMinor,
				planned_version: 1,
				actual_amount_minor: seed.actualAmountMinor,
				accounting_date: seed.accountingDate,
				due_date: seed.dueDate ?? null,
				service_start_date: seed.serviceStartDate ?? null,
				service_end_date: seed.serviceEndDate ?? null,
				allocation_method: seed.allocationMethod,
				account_hint_id: seed.accountHintId ?? null,
				template_id: seed.templateId ?? null,
				scheduled_due_date: seed.scheduledDueDate ?? null,
				realized_by_expense_id: null,
				chain_root_id: seed.chainRootId,
				replaces_id: seed.replacesId ?? null,
				reversed_by_id: null,
				actor_user_id: null,
				operation_id: null,
				created_at: timestamp,
				updated_at: timestamp,
			})
			.execute();
	}

	// Link reversed originals to their replacements once every expense exists
	for (const seed of expenseSeeds) {
		if (!seed.reversedById) continue;
		await db.updateTable("expenses").set({ reversed_by_id: seed.reversedById }).where("id", "=", seed.id).execute();
	}

	interface AllocationSeed {
		expenseId: string;
		memberId: string;
		basis: string;
		amountMinor: number;
	}

	const half = (amount: number) => [Math.ceil(amount / 2), Math.floor(amount / 2)];
	const allocationSeeds: AllocationSeed[] = [
		{ expenseId: alquilerOccurrenceId, memberId: adminMemberId, basis: "planned", amountMinor: 45000 },
		{ expenseId: alquilerOccurrenceId, memberId: regularMemberId, basis: "planned", amountMinor: 45000 },
		{ expenseId: luzExpenseId, memberId: adminMemberId, basis: "actual", amountMinor: half(8500)[0]! },
		{ expenseId: luzExpenseId, memberId: regularMemberId, basis: "actual", amountMinor: half(8500)[1]! },
		{ expenseId: compraExpenseId, memberId: adminMemberId, basis: "actual", amountMinor: 8230 },
		{ expenseId: compraExpenseId, memberId: regularMemberId, basis: "actual", amountMinor: 4115 },
		{ expenseId: estimacionAguaExpenseId, memberId: adminMemberId, basis: "planned", amountMinor: 2000 },
		{ expenseId: estimacionAguaExpenseId, memberId: regularMemberId, basis: "planned", amountMinor: 2000 },
		{ expenseId: facturaAguaExpenseId, memberId: adminMemberId, basis: "planned", amountMinor: 2000 },
		{ expenseId: facturaAguaExpenseId, memberId: regularMemberId, basis: "planned", amountMinor: 2000 },
		{ expenseId: facturaAguaExpenseId, memberId: adminMemberId, basis: "actual", amountMinor: 2175 },
		{ expenseId: facturaAguaExpenseId, memberId: regularMemberId, basis: "actual", amountMinor: 2175 },
		{ expenseId: seguroExpenseId, memberId: adminMemberId, basis: "planned", amountMinor: 60000 },
		{ expenseId: seguroExpenseId, memberId: regularMemberId, basis: "planned", amountMinor: 60000 },
		{ expenseId: seguroExpenseId, memberId: adminMemberId, basis: "actual", amountMinor: 60000 },
		{ expenseId: seguroExpenseId, memberId: regularMemberId, basis: "actual", amountMinor: 60000 },
		{ expenseId: telefoniaExpenseId, memberId: adminMemberId, basis: "actual", amountMinor: 1500 },
		{ expenseId: telefoniaExpenseId, memberId: regularMemberId, basis: "actual", amountMinor: 1500 },
		{ expenseId: comunidadOriginalId, memberId: adminMemberId, basis: "actual", amountMinor: 3000 },
		{ expenseId: comunidadOriginalId, memberId: regularMemberId, basis: "actual", amountMinor: 3000 },
		{ expenseId: comunidadReplacementId, memberId: adminMemberId, basis: "actual", amountMinor: 3250 },
		{ expenseId: comunidadReplacementId, memberId: regularMemberId, basis: "actual", amountMinor: 3250 },
		{ expenseId: regaloExpenseId, memberId: adminMemberId, basis: "planned", amountMinor: 2500 },
		{ expenseId: regaloExpenseId, memberId: regularMemberId, basis: "planned", amountMinor: 2500 },
		{ expenseId: hotelExpenseId, memberId: adminMemberId, basis: "actual", amountMinor: 22500 },
		{ expenseId: hotelExpenseId, memberId: regularMemberId, basis: "actual", amountMinor: 22500 },
	];
	for (let i = 0; i < allocationSeeds.length; i += 10) {
		await db
			.insertInto("expense_allocations")
			.values(
				allocationSeeds.slice(i, i + 10).map((seed) => ({
					id: createId(),
					expense_id: seed.expenseId,
					member_id: seed.memberId,
					basis: seed.basis,
					amount_minor: seed.amountMinor,
				})),
			)
			.execute();
	}

	await db
		.insertInto("expense_allocation_params")
		.values([
			{ id: createId(), expense_id: alquilerOccurrenceId, member_id: adminMemberId, value: null },
			{ id: createId(), expense_id: alquilerOccurrenceId, member_id: regularMemberId, value: null },
			{ id: createId(), expense_id: luzExpenseId, member_id: adminMemberId, value: null },
			{ id: createId(), expense_id: luzExpenseId, member_id: regularMemberId, value: null },
			{ id: createId(), expense_id: compraExpenseId, member_id: adminMemberId, value: 2 },
			{ id: createId(), expense_id: compraExpenseId, member_id: regularMemberId, value: 1 },
			{ id: createId(), expense_id: estimacionAguaExpenseId, member_id: adminMemberId, value: 5000 },
			{ id: createId(), expense_id: estimacionAguaExpenseId, member_id: regularMemberId, value: 5000 },
			{ id: createId(), expense_id: facturaAguaExpenseId, member_id: adminMemberId, value: null },
			{ id: createId(), expense_id: facturaAguaExpenseId, member_id: regularMemberId, value: null },
			{ id: createId(), expense_id: seguroExpenseId, member_id: adminMemberId, value: null },
			{ id: createId(), expense_id: seguroExpenseId, member_id: regularMemberId, value: null },
		])
		.execute();

	interface PaymentSeed {
		id: string;
		accountId: string;
		amountMinor: number;
		description: string;
		effectiveAt: string;
		recordedAt: string;
		fundingSource: string;
		funderMemberId?: string;
		status: string;
		chainRootId: string;
		reversalOfId?: string;
		reversedById?: string;
	}

	const luzPaymentId = createId();
	const seguroPaymentId = createId();
	const multiPaymentId = createId();
	const reversedPaymentOriginalId = createId();
	const reversedPaymentReversalId = createId();

	const paymentSeeds: PaymentSeed[] = [
		{
			id: luzPaymentId,
			accountId: sharedAccountId,
			amountMinor: 8500,
			description: "Iberdrola",
			effectiveAt: `${currentPeriod}-03T00:00:00.000Z`,
			recordedAt: daysAgo(3),
			fundingSource: "shared",
			status: "posted",
			chainRootId: luzPaymentId,
		},
		{
			id: seguroPaymentId,
			accountId: alexAccountId,
			amountMinor: 50000,
			description: "Seguro del hogar (primer plazo)",
			effectiveAt: `${currentPeriod}-02T00:00:00.000Z`,
			recordedAt: daysAgo(2),
			fundingSource: "member",
			funderMemberId: adminMemberId,
			status: "posted",
			chainRootId: seguroPaymentId,
		},
		{
			id: multiPaymentId,
			accountId: sharedAccountId,
			amountMinor: 11000,
			description: "Compra y reserva de hotel",
			effectiveAt: `${currentPeriod}-01T00:00:00.000Z`,
			recordedAt: daysAgo(1),
			fundingSource: "shared",
			status: "posted",
			chainRootId: multiPaymentId,
		},
		{
			id: reversedPaymentOriginalId,
			accountId: samAccountId,
			amountMinor: 2000,
			description: "Pago duplicado de farmacia",
			effectiveAt: `${currentPeriod}-04T00:00:00.000Z`,
			recordedAt: daysAgo(4),
			fundingSource: "member",
			funderMemberId: regularMemberId,
			status: "reversed",
			chainRootId: reversedPaymentOriginalId,
			reversedById: reversedPaymentReversalId,
		},
		{
			id: reversedPaymentReversalId,
			accountId: samAccountId,
			amountMinor: 2000,
			description: "Pago duplicado de farmacia",
			effectiveAt: `${currentPeriod}-04T00:00:00.000Z`,
			recordedAt: daysAgo(3),
			fundingSource: "member",
			funderMemberId: regularMemberId,
			status: "posted",
			chainRootId: reversedPaymentOriginalId,
			reversalOfId: reversedPaymentOriginalId,
		},
	];

	for (const seed of paymentSeeds) {
		await db
			.insertInto("payments")
			.values({
				id: seed.id,
				household_id: householdId,
				account_id: seed.accountId,
				amount_minor: seed.amountMinor,
				description: seed.description,
				effective_at: seed.effectiveAt,
				ordering_key: orderingKeyFor(seed.effectiveAt, seed.chainRootId),
				recorded_at: seed.recordedAt,
				funding_source: seed.fundingSource,
				funder_member_id: seed.funderMemberId ?? null,
				status: seed.status,
				chain_root_id: seed.chainRootId,
				reversal_of_id: seed.reversalOfId ?? null,
				replaces_id: null,
				reversed_by_id: null,
				actor_user_id: null,
				operation_id: null,
				created_at: seed.recordedAt,
			})
			.execute();
	}

	// Link reversed originals to their reversals once every payment exists
	for (const seed of paymentSeeds) {
		if (!seed.reversedById) continue;
		await db.updateTable("payments").set({ reversed_by_id: seed.reversedById }).where("id", "=", seed.id).execute();
	}

	for (const seed of paymentSeeds) {
		await db
			.insertInto("payment_account_entries")
			.values({
				id: createId(),
				account_id: seed.accountId,
				payment_id: seed.id,
				chain_root_id: seed.chainRootId,
				amount_minor: seed.reversalOfId ? seed.amountMinor : -seed.amountMinor,
				effective_at: seed.effectiveAt,
				ordering_key: orderingKeyFor(seed.effectiveAt, seed.chainRootId),
				recorded_at: seed.recordedAt,
				operation_id: null,
			})
			.execute();
	}

	await db
		.insertInto("payment_applications")
		.values([
			{
				id: createId(),
				household_id: householdId,
				payment_id: luzPaymentId,
				expense_id: luzExpenseId,
				amount_minor: 8500,
				status: "active",
				recorded_at: daysAgo(3),
				reversed_at: null,
				operation_id: null,
			},
			{
				id: createId(),
				household_id: householdId,
				payment_id: seguroPaymentId,
				expense_id: seguroExpenseId,
				amount_minor: 50000,
				status: "active",
				recorded_at: daysAgo(2),
				reversed_at: null,
				operation_id: null,
			},
			{
				id: createId(),
				household_id: householdId,
				payment_id: multiPaymentId,
				expense_id: compraExpenseId,
				amount_minor: 6000,
				status: "active",
				recorded_at: daysAgo(1),
				reversed_at: null,
				operation_id: null,
			},
			{
				id: createId(),
				household_id: householdId,
				payment_id: multiPaymentId,
				expense_id: hotelExpenseId,
				amount_minor: 4000,
				status: "active",
				recorded_at: daysAgo(1),
				reversed_at: null,
				operation_id: null,
			},
		])
		.execute();

	await db
		.insertInto("expense_evidence")
		.values({
			id: createId(),
			expense_id: luzExpenseId,
			household_id: householdId,
			label: "Factura en PDF",
			url: "https://facturas.example.com/suministros/luz.pdf",
			note: "Factura mensual descargada del portal",
			status: "active",
			created_by: null,
			created_at: timestamp,
			removed_at: null,
			operation_id: null,
		})
		.execute();

	return {
		households: 1,
		members: 3,
		users: 2,
		accounts: 5,
		transfers: transfers.length,
		observations: observations.length,
		expenses: expenseSeeds.length,
		payments: paymentSeeds.length,
		username: DEVELOPMENT_USERNAME,
	};
}
