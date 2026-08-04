export interface AuthenticatedUser {
	id: string;
	username: string;
	householdId: string;
	isAdministrator: boolean;
	requiresPasswordChange: boolean;
	memberId: string | null;
}
