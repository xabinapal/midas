import type { AccountClassification, AccountStatus, TransferClassification, TransferStatus } from "$lib/accounts/model";

/** Approved Spanish vocabulary for account and funding workflows. */

export const ACCOUNT_CLASSIFICATION_LABELS: Record<AccountClassification, string> = {
	personal: "Personal",
	shared: "Compartida",
};

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
	draft: "Borrador",
	active: "Activa",
	closed: "Cerrada",
};

export const TRANSFER_CLASSIFICATION_LABELS: Record<TransferClassification, string> = {
	unclassified: "Sin clasificar",
	pure: "Traspaso",
	contribution: "Aportación",
	distribution: "Distribución",
};

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
	draft: "Borrador",
	posted: "Registrada",
	reversed: "Revertida",
};
