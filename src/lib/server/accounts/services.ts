import type { Kysely } from "kysely";
import type { Database } from "../database";
import { createHouseholdRepository, createMemberRepository } from "../household/repository";
import { createObservationService } from "./balance";
import {
	createAccountEntryRepository,
	createAccountHolderRepository,
	createAccountRepository,
	createAccountTransferRepository,
	createBalanceObservationRepository,
} from "./repository";
import { createAccountService } from "./service";
import { createTransferService } from "./transfers";
import { createContributionRepository, createDistributionRepository } from "../funding/repository";
import { createFundingService } from "../funding/service";

/**
 * Wires the account and funding services with their real repositories.
 * Routes compose behavior through these narrow interfaces; domain tests
 * inject fakes instead.
 */
export function createAccountServices(db: Kysely<Database>) {
	const accounts = createAccountRepository(db);
	const holders = createAccountHolderRepository(db);
	const members = createMemberRepository(db);
	const households = createHouseholdRepository(db);
	const transfers = createAccountTransferRepository(db);
	const entries = createAccountEntryRepository(db);
	const observations = createBalanceObservationRepository(db);
	const contributions = createContributionRepository(db);
	const distributions = createDistributionRepository(db);

	return {
		accountService: createAccountService(accounts, holders, members, households),
		transferService: createTransferService(accounts, transfers, entries),
		observationService: createObservationService(accounts, observations, entries),
		fundingService: createFundingService(
			{ accounts, transfers, entries },
			{ contributions, distributions },
			{ holders, members },
		),
		repositories: {
			accounts,
			holders,
			members,
			households,
			transfers,
			entries,
			observations,
			contributions,
			distributions,
		},
	};
}
