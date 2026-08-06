export interface UsersTable {
	id: string;
	username: string;
	password_hash: string;
	household_id: string | null;
	member_id: string | null;
	is_active: 0 | 1;
	is_administrator: 0 | 1;
	requires_password_change: 0 | 1;
	created_at: string;
	updated_at: string;
}

export interface HouseholdsTable {
	id: string;
	name: string;
	currency: string;
	timezone: string;
	locale: string;
	version: string;
	created_at: string;
	updated_at: string;
}

export interface HouseholdCommandGatesTable {
	household_id: string;
	operation_id: string;
	expected_version: string;
	lease_expires_at: string;
}

export interface BootstrapGateTable {
	id: number;
	state: string;
	operation_id: string | null;
	lease_expires_at: string | null;
	completed_at: string | null;
}

export interface OperationRootsTable {
	id: string;
	household_id: string;
	actor_user_id: string | null;
	operation_type: string;
	payload_fingerprint: string;
	status: string;
	result_type: string | null;
	created_at: string;
	completed_at: string | null;
}

export interface MembersTable {
	id: string;
	household_id: string;
	display_name: string;
	is_active: 0 | 1;
	created_at: string;
	updated_at: string;
}

export interface MemberIntervalsTable {
	id: string;
	member_id: string;
	effective_from: string;
	default_weight: number;
	is_active: 0 | 1;
	operation_id: string | null;
}

export interface SessionsTable {
	id: string;
	user_id: string;
	household_id: string;
	token_digest: string;
	created_at: string;
	rotated_at: string;
	expires_at: string;
}

export interface ActivityEventsTable {
	id: string;
	household_id: string;
	event_type: string;
	subject_type: string;
	subject_id: string | null;
	actor_user_id: string | null;
	occurred_at: string;
	recorded_at: string;
	summary: string;
	operation_id: string | null;
	correction_of_event_id: string | null;
}

export interface ConsumedRecoveryCredentialsTable {
	digest: string;
	consumed_at: string;
	target_user_id: string | null;
	operation_id: string | null;
}

export interface AccountsTable {
	id: string;
	household_id: string;
	name: string;
	classification: string;
	status: string;
	currency: string;
	created_at: string;
	updated_at: string;
}

export interface AccountHolderIntervalsTable {
	id: string;
	account_id: string;
	member_id: string;
	effective_from: string;
	effective_to: string | null;
	operation_id: string | null;
}

export interface BalanceObservationsTable {
	id: string;
	account_id: string;
	amount_minor: number;
	effective_at: string;
	ordering_key: string;
	recorded_at: string;
	status: string;
	replaces_observation_id: string | null;
	invalidated_at: string | null;
	operation_id: string | null;
}

export interface AccountTransfersTable {
	id: string;
	household_id: string;
	source_account_id: string;
	destination_account_id: string;
	amount_minor: number;
	effective_at: string;
	ordering_key: string;
	recorded_at: string;
	description: string;
	classification: string;
	status: string;
	chain_root_id: string;
	reversal_of_id: string | null;
	replaces_id: string | null;
	reversed_by_id: string | null;
	operation_id: string | null;
	created_at: string;
}

export interface AccountEntriesTable {
	id: string;
	account_id: string;
	transfer_id: string;
	chain_root_id: string;
	amount_minor: number;
	effective_at: string;
	ordering_key: string;
	recorded_at: string;
	operation_id: string | null;
}

export interface ContributionsTable {
	id: string;
	household_id: string;
	transfer_id: string;
	member_id: string;
	amount_minor: number;
	status: string;
	recorded_at: string;
	operation_id: string | null;
}

export interface ContributionAllocationsTable {
	id: string;
	contribution_id: string;
	member_id: string;
	amount_minor: number;
}

export interface DistributionsTable {
	id: string;
	household_id: string;
	transfer_id: string;
	member_id: string;
	amount_minor: number;
	status: string;
	recorded_at: string;
	operation_id: string | null;
}

export interface DistributionAllocationsTable {
	id: string;
	distribution_id: string;
	member_id: string;
	amount_minor: number;
}

export interface Database {
	users: UsersTable;
	households: HouseholdsTable;
	household_command_gates: HouseholdCommandGatesTable;
	bootstrap_gate: BootstrapGateTable;
	operation_roots: OperationRootsTable;
	members: MembersTable;
	member_intervals: MemberIntervalsTable;
	sessions: SessionsTable;
	activity_events: ActivityEventsTable;
	consumed_recovery_credentials: ConsumedRecoveryCredentialsTable;
	accounts: AccountsTable;
	account_holder_intervals: AccountHolderIntervalsTable;
	balance_observations: BalanceObservationsTable;
	account_transfers: AccountTransfersTable;
	account_entries: AccountEntriesTable;
	contributions: ContributionsTable;
	contribution_allocations: ContributionAllocationsTable;
	distributions: DistributionsTable;
	distribution_allocations: DistributionAllocationsTable;
}
