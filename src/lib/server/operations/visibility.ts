import type { ExpressionBuilder, ExpressionWrapper, SqlBool } from "kysely";

/**
 * The completed-operation visibility predicate: rows carrying an operation
 * id enter projections only when their operation root completed; rows
 * without an operation id (seeds, migrations) are always visible.
 *
 * Every projection read MUST apply this filter after left-joining
 * `operation_roots` on the table's `operation_id`, so partial writes from
 * failed operations stay invisible. Keep this the single implementation.
 *
 * Typed loosely on purpose: query builders with join-augmented scopes must
 * all be able to apply it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function visibleToProjection<EB extends ExpressionBuilder<any, any>>(
	eb: EB,
	operationIdColumn: `${string}.operation_id`,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): ExpressionWrapper<any, any, SqlBool> {
	return eb.or([
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		eb(operationIdColumn as any, "is", null),
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		eb("operation_roots.status" as any, "=", "complete"),
	]);
}
