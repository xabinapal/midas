interface DatabaseInitializerOptions<Binding, Client extends object> {
	createClient(binding: Binding): Client;
	migrate(client: Client): Promise<void> | void;
	dispose(client: Client): Promise<void> | void;
}

export function createDatabaseInitializer<Binding, Client extends object>({
	createClient,
	migrate,
	dispose,
}: DatabaseInitializerOptions<Binding, Client>) {
	let client: Client | undefined;
	let initialization: Promise<Client> | undefined;

	return (binding: Binding | undefined): Promise<Client> => {
		if (binding === undefined) {
			return Promise.reject(new Error("D1 binding DB is unavailable"));
		}
		if (client) return Promise.resolve(client);

		initialization ??= (async () => {
			const nextClient = createClient(binding);
			try {
				await migrate(nextClient);
				client = nextClient;
				return nextClient;
			} catch (error) {
				await Promise.resolve(dispose(nextClient)).catch(() => undefined);
				throw error;
			}
		})().catch((error) => {
			initialization = undefined;
			throw error;
		});

		return initialization;
	};
}
