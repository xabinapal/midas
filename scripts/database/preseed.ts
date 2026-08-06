import type { Kysely } from "kysely";
import { hashPassword } from "../../src/lib/server/auth/password";
import { orderingKeyFor } from "../../src/lib/accounts/model";
import type { Database } from "../../src/lib/server/database/schema";

const APPLICATION_TABLES_IN_DELETE_ORDER = [
	"consumed_recovery_credentials",
	"activity_events",
	"sessions",
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

	return {
		households: 1,
		members: 3,
		users: 2,
		accounts: 5,
		transfers: transfers.length,
		observations: observations.length,
		username: DEVELOPMENT_USERNAME,
	};
}
