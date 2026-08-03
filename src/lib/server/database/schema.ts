export interface UsersTable {
	id: string;
	username: string;
	password_hash: string;
	created_at: string;
	updated_at: string;
}

export interface Database {
	users: UsersTable;
}
