import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountRepository } from "../accounts/repository";
import type { MemberRepository } from "../household/repository";
import type {
	ExpenseCategoryRecord,
	ExpenseCategoryRepository,
	ExpenseRecord,
	ExpenseRepository,
	RecurringTemplateRecord,
	RecurringTemplateRepository,
	ReportingPeriodRecord,
	ReportingPeriodRepository,
	TemplateAllocationParamRecord,
	TemplateAllocationParamRepository,
} from "./repository";
import { createPlanningService, type PlanningService } from "./planning";
import type { ExpenseService } from "./service";

const NOW = "2026-08-06T10:00:00.000Z";
const HOUSEHOLD = "household-1";
const USER = "user-1";

function templateRecord(overrides: Partial<RecurringTemplateRecord> = {}): RecurringTemplateRecord {
	return {
		id: "template-1",
		householdId: HOUSEHOLD,
		categoryId: "cat-1",
		description: "Alquiler",
		estimatedAmountMinor: 90000,
		cadence: "monthly",
		intervalCount: 1,
		startDate: "2026-01-05",
		endDate: null,
		dueDay: null,
		serviceSpanMonths: null,
		accountHintId: null,
		allocationMethod: "equal",
		status: "active",
		createdAt: NOW,
		updatedAt: NOW,
		operationId: null,
		...overrides,
	};
}

interface OccurrenceInsertInput {
	categoryId: string;
	reportingPeriodId: string;
	description: string;
	plannedAmountMinor: number;
	accountingDate: string;
	dueDate: string | null;
	serviceStartDate: string | null;
	serviceEndDate: string | null;
	accountHintId: string | null;
	allocationMethod: RecurringTemplateRecord["allocationMethod"];
	allocationParams: { memberId: string; value: number | null }[];
	templateId: string;
	scheduledDueDate: string;
}

interface Mocks {
	service: PlanningService;
	periodStore: ReportingPeriodRecord[];
	templateStore: RecurringTemplateRecord[];
	templateParamStore: TemplateAllocationParamRecord[];
	expenseStore: ExpenseRecord[];
	templates: RecurringTemplateRepository;
	periods: ReportingPeriodRepository;
	insertOccurrenceCalls: OccurrenceInsertInput[];
}

function makeMocks(): Mocks {
	const periodStore: ReportingPeriodRecord[] = [];
	const templateStore: RecurringTemplateRecord[] = [];
	const templateParamStore: TemplateAllocationParamRecord[] = [];
	const expenseStore: ExpenseRecord[] = [];

	const periods: ReportingPeriodRepository = {
		create: vi.fn(async (input, now) => {
			periodStore.push({
				id: input.id,
				householdId: input.householdId,
				slug: input.slug,
				label: input.label,
				startDate: input.startDate,
				endDate: input.endDate,
				kind: input.kind,
				createdAt: now,
				operationId: input.operationId ?? null,
			});
		}),
		findById: vi.fn(async (id) => periodStore.find((row) => row.id === id)),
		findBySlug: vi.fn(async (householdId, slug) =>
			periodStore.find((row) => row.householdId === householdId && row.slug === slug),
		),
		findVisibleBySlug: vi.fn(async (householdId, slug) =>
			periodStore.find((row) => row.householdId === householdId && row.slug === slug),
		),
		findByHousehold: vi.fn(async (householdId) => periodStore.filter((row) => row.householdId === householdId)),
		reattributeOperation: vi.fn(async (id, operationId) => {
			const row = periodStore.find((entry) => entry.id === id);
			if (row) {
				row.operationId = operationId;
			}
		}),
	};

	const templates: RecurringTemplateRepository = {
		create: vi.fn(async (input, now) => {
			templateStore.push({
				...input,
				endDate: input.endDate ?? null,
				dueDay: input.dueDay ?? null,
				serviceSpanMonths: input.serviceSpanMonths ?? null,
				accountHintId: input.accountHintId ?? null,
				status: "active",
				createdAt: now,
				updatedAt: now,
				operationId: input.operationId ?? null,
			} as RecurringTemplateRecord);
		}),
		findById: vi.fn(async (id) => templateStore.find((row) => row.id === id)),
		findVisibleById: vi.fn(async (id) => templateStore.find((row) => row.id === id)),
		findByHousehold: vi.fn(async (householdId) => templateStore.filter((row) => row.householdId === householdId)),
		update: vi.fn(async (id, fields, now) => {
			const row = templateStore.find((entry) => entry.id === id);
			if (row) Object.assign(row, fields, { updatedAt: now });
		}),
		setStatus: vi.fn(async (id, status, now) => {
			const row = templateStore.find((entry) => entry.id === id);
			if (row) {
				row.status = status;
				row.updatedAt = now;
			}
		}),
	};

	const templateParams: TemplateAllocationParamRepository = {
		replaceParams: vi.fn(async (templateId, params) => {
			for (let i = templateParamStore.length - 1; i >= 0; i -= 1) {
				if (templateParamStore[i]!.templateId === templateId) templateParamStore.splice(i, 1);
			}
			for (const param of params) {
				templateParamStore.push({
					id: `tparam-${templateParamStore.length}`,
					templateId,
					memberId: param.memberId,
					value: param.value,
				});
			}
		}),
		findByTemplate: vi.fn(async (templateId) => templateParamStore.filter((row) => row.templateId === templateId)),
		findByTemplates: vi.fn(async (templateIds) =>
			templateParamStore.filter((row) => templateIds.includes(row.templateId)),
		),
	};

	const expenses: ExpenseRepository = {
		create: vi.fn(async (input) => {
			expenseStore.push({ ...input });
		}),
		findOccurrence: vi.fn(async (templateId, scheduledDueDate) =>
			expenseStore.find((row) => row.templateId === templateId && row.scheduledDueDate === scheduledDueDate),
		),
		findVisibleOccurrence: vi.fn(async (templateId, scheduledDueDate) =>
			expenseStore.find(
				(row) =>
					row.templateId === templateId && row.scheduledDueDate === scheduledDueDate && row.operationId !== "op-dead",
			),
		),
		reattributeOperation: vi.fn(async (id, operationId, now) => {
			const row = expenseStore.find((entry) => entry.id === id);
			if (row) {
				row.operationId = operationId;
				row.updatedAt = now;
			}
		}),
		findReferencesLike: vi.fn(async (householdId, base) =>
			expenseStore
				.filter(
					(row) =>
						row.householdId === householdId &&
						row.reference !== null &&
						(row.reference === base || row.reference.startsWith(`${base}-`)),
				)
				.map((row) => row.reference as string),
		),
		listByPeriod: vi.fn(async (householdId, reportingPeriodId) =>
			expenseStore.filter((row) => row.householdId === householdId && row.reportingPeriodId === reportingPeriodId),
		),
	} as unknown as ExpenseRepository;

	const categories = {
		findById: vi.fn(async (): Promise<ExpenseCategoryRecord | undefined> => ({
			id: "cat-1",
			householdId: HOUSEHOLD,
			name: "Vivienda",
			slug: "vivienda",
			ordering: 0,
			isActive: true,
			createdAt: NOW,
			updatedAt: NOW,
			operationId: null,
		})),
	} as unknown as ExpenseCategoryRepository;

	const members = {
		findByHousehold: vi.fn(async () => [
			{ id: "m-a", householdId: HOUSEHOLD, displayName: "Alex", isActive: true, defaultWeight: 1 },
			{ id: "m-b", householdId: HOUSEHOLD, displayName: "Sam", isActive: true, defaultWeight: 2 },
		]),
		findById: vi.fn(async (id: string) =>
			[
				{ id: "m-a", householdId: HOUSEHOLD, displayName: "Alex", isActive: true, defaultWeight: 1 },
				{ id: "m-b", householdId: HOUSEHOLD, displayName: "Sam", isActive: true, defaultWeight: 2 },
			].find((member) => member.id === id),
		),
	} as unknown as MemberRepository;

	const insertOccurrenceCalls: OccurrenceInsertInput[] = [];
	const expenseService = {
		insertOccurrence: vi.fn(
			async (
				householdId: string,
				input: OccurrenceInsertInput,
				actorUserId: string,
				now: string,
				operationId: string | null,
			) => {
				insertOccurrenceCalls.push(input);
				const id = `expense-${expenseStore.length}`;
				const record: ExpenseRecord = {
					id,
					householdId,
					categoryId: input.categoryId,
					reportingPeriodId: input.reportingPeriodId,
					description: input.description,
					reference: `vivienda/2026-08${expenseStore.length > 0 ? `-${expenseStore.length + 1}` : ""}`,
					status: "posted",
					plannedAmountMinor: input.plannedAmountMinor,
					plannedVersion: 1,
					actualAmountMinor: null,
					accountingDate: input.accountingDate,
					dueDate: input.dueDate,
					serviceStartDate: input.serviceStartDate,
					serviceEndDate: input.serviceEndDate,
					allocationMethod: input.allocationMethod,
					accountHintId: input.accountHintId,
					templateId: input.templateId,
					scheduledDueDate: input.scheduledDueDate,
					realizedByExpenseId: null,
					chainRootId: id,
					replacesId: null,
					reversedById: null,
					actorUserId,
					operationId,
					createdAt: now,
					updatedAt: now,
				};
				expenseStore.push(record);
				return record;
			},
		),
	} as unknown as ExpenseService;

	const accounts = {
		findById: vi.fn(async (id: string) =>
			id === "acc-1"
				? {
						id: "acc-1",
						householdId: HOUSEHOLD,
						name: "Cuenta común",
						classification: "shared" as const,
						status: "active" as const,
						currency: "EUR",
						createdAt: NOW,
						updatedAt: NOW,
					}
				: undefined,
		),
	} as unknown as AccountRepository;

	const service = createPlanningService(
		{ periods, templates, templateParams, expenses },
		{ categories, members, accounts },
		{ insertOccurrence: expenseService.insertOccurrence as never },
	);

	return {
		service,
		periodStore,
		templateStore,
		templateParamStore,
		expenseStore,
		templates,
		periods,
		insertOccurrenceCalls,
	};
}

describe("reporting periods", () => {
	let mocks: Mocks;
	beforeEach(() => {
		mocks = makeMocks();
	});

	it("creates the standard month period with Spanish label and bounds", async () => {
		const period = await mocks.service.ensureStandardPeriod(HOUSEHOLD, "2026-08", NOW, "op-1");
		expect(period.kind).toBe("standard");
		expect(period.label).toBe("Agosto de 2026");
		expect(period.startDate).toBe("2026-08-01");
		expect(period.endDate).toBe("2026-09-01");
	});

	it("returns the existing standard period on replay", async () => {
		const first = await mocks.service.ensureStandardPeriod(HOUSEHOLD, "2026-08", NOW, "op-1");
		const second = await mocks.service.ensureStandardPeriod(HOUSEHOLD, "2026-08", NOW, "op-2");
		expect(second.id).toBe(first.id);
		expect(mocks.periodStore).toHaveLength(1);
	});

	it("creates custom periods with a unique slug", async () => {
		const first = await mocks.service.createCustomPeriod(
			HOUSEHOLD,
			{ label: "Viaje de verano", startDate: "2026-07-15", endDate: "2026-08-15" },
			NOW,
			"op-1",
		);
		expect(first.slug).toBe("viaje-de-verano");
		const second = await mocks.service.createCustomPeriod(
			HOUSEHOLD,
			{ label: "Viaje de verano", startDate: "2026-08-16", endDate: "2026-09-01" },
			NOW,
			"op-2",
		);
		expect(second.slug).toBe("viaje-de-verano-2");
	});

	it("rejects custom periods with start not before end", async () => {
		await expect(
			mocks.service.createCustomPeriod(
				HOUSEHOLD,
				{ label: "Mal", startDate: "2026-08-15", endDate: "2026-08-15" },
				NOW,
				"op-1",
			),
		).rejects.toThrowError("period_dates_invalid");
	});
});

describe("recurring templates", () => {
	let mocks: Mocks;
	beforeEach(() => {
		mocks = makeMocks();
	});

	it("creates a monthly template with allocation params", async () => {
		const template = await mocks.service.createTemplate(
			HOUSEHOLD,
			{
				categoryId: "cat-1",
				description: "Alquiler",
				estimatedAmountMinor: 90000,
				cadence: "monthly",
				intervalCount: 1,
				startDate: "2026-01-05",
				allocationMethod: "equal",
				allocationParams: [
					{ memberId: "m-a", value: null },
					{ memberId: "m-b", value: null },
				],
			},
			NOW,
			"op-1",
		);
		expect(template.status).toBe("active");
		expect(mocks.templateParamStore).toHaveLength(2);
	});

	it("rejects the fixed method for templates", async () => {
		await expect(
			mocks.service.createTemplate(
				HOUSEHOLD,
				{
					categoryId: "cat-1",
					description: "Alquiler",
					estimatedAmountMinor: 90000,
					cadence: "monthly",
					intervalCount: 1,
					startDate: "2026-01-05",
					allocationMethod: "fixed",
					allocationParams: [{ memberId: "m-a", value: 90000 }],
				},
				NOW,
				"op-1",
			),
		).rejects.toThrowError("template_method_not_supported");
	});

	it("rejects a non-positive interval", async () => {
		await expect(
			mocks.service.createTemplate(
				HOUSEHOLD,
				{
					categoryId: "cat-1",
					description: "Alquiler",
					estimatedAmountMinor: 90000,
					cadence: "monthly",
					intervalCount: 0,
					startDate: "2026-01-05",
					allocationMethod: "equal",
					allocationParams: [{ memberId: "m-a", value: null }],
				},
				NOW,
				"op-1",
			),
		).rejects.toThrowError("recurrence_interval_not_positive");
	});

	it("rejects an account hint outside the household", async () => {
		await expect(
			mocks.service.createTemplate(
				HOUSEHOLD,
				{
					categoryId: "cat-1",
					description: "Alquiler",
					estimatedAmountMinor: 90000,
					cadence: "monthly",
					intervalCount: 1,
					startDate: "2026-01-05",
					accountHintId: "acc-other-household",
					allocationMethod: "equal",
					allocationParams: [{ memberId: "m-a", value: null }],
				},
				NOW,
				"op-1",
			),
		).rejects.toThrowError("account_not_found");
	});
});

describe("occurrence materialization", () => {
	let mocks: Mocks;
	beforeEach(() => {
		mocks = makeMocks();
	});

	async function seedMonthlyTemplate(overrides: Partial<RecurringTemplateRecord> = {}): Promise<void> {
		mocks.templateStore.push(templateRecord(overrides));
		mocks.templateParamStore.push(
			{ id: "tp-1", templateId: "template-1", memberId: "m-a", value: null },
			{ id: "tp-2", templateId: "template-1", memberId: "m-b", value: null },
		);
	}

	it("materializes one expected expense for the opened month", async () => {
		await seedMonthlyTemplate();
		const result = await mocks.service.materializeStandardPeriod(HOUSEHOLD, "2026-08", USER, NOW, "op-1");
		expect(result.created).toHaveLength(1);
		expect(result.created[0]!.scheduledDueDate).toBe("2026-08-05");
		expect(result.created[0]!.plannedAmountMinor).toBe(90000);
		expect(result.created[0]!.reportingPeriodId).toBe(result.period.id);
	});

	it("is idempotent across retries and repeated opens", async () => {
		await seedMonthlyTemplate();
		const first = await mocks.service.materializeStandardPeriod(HOUSEHOLD, "2026-08", USER, NOW, "op-1");
		const second = await mocks.service.materializeStandardPeriod(HOUSEHOLD, "2026-08", USER, NOW, "op-2");
		expect(first.created).toHaveLength(1);
		expect(second.created).toHaveLength(0);
		expect(mocks.expenseStore.filter((row) => row.templateId === "template-1")).toHaveLength(1);
	});

	it("materializes only the requested month, never an unbounded horizon", async () => {
		await seedMonthlyTemplate();
		await mocks.service.materializeStandardPeriod(HOUSEHOLD, "2026-08", USER, NOW, "op-1");
		expect(mocks.expenseStore).toHaveLength(1);
	});

	it("keeps earlier occurrences unchanged after a template edit", async () => {
		await seedMonthlyTemplate();
		const august = await mocks.service.materializeStandardPeriod(HOUSEHOLD, "2026-08", USER, NOW, "op-1");
		await mocks.service.updateTemplate(
			HOUSEHOLD,
			"template-1",
			{
				categoryId: "cat-1",
				description: "Alquiler",
				estimatedAmountMinor: 95000,
				cadence: "monthly",
				intervalCount: 1,
				startDate: "2026-01-05",
				allocationMethod: "equal",
				allocationParams: [
					{ memberId: "m-a", value: null },
					{ memberId: "m-b", value: null },
				],
			},
			NOW,
			"op-2",
		);
		const september = await mocks.service.materializeStandardPeriod(HOUSEHOLD, "2026-09", USER, NOW, "op-3");
		expect(august.created[0]!.plannedAmountMinor).toBe(90000);
		expect(september.created[0]!.plannedAmountMinor).toBe(95000);
	});

	it("generates nothing for a disabled template but keeps its history", async () => {
		await seedMonthlyTemplate();
		await mocks.service.materializeStandardPeriod(HOUSEHOLD, "2026-08", USER, NOW, "op-1");
		await mocks.service.setTemplateStatus(HOUSEHOLD, "template-1", "disabled", NOW, "op-2");
		const september = await mocks.service.materializeStandardPeriod(HOUSEHOLD, "2026-09", USER, NOW, "op-3");
		expect(september.created).toHaveLength(0);
		expect(mocks.expenseStore).toHaveLength(1);
	});

	it("materializes yearly templates only in their scheduled month", async () => {
		mocks.templateStore.push(
			templateRecord({ id: "template-annual", cadence: "yearly", startDate: "2026-03-10", serviceSpanMonths: 12 }),
		);
		mocks.templateParamStore.push({ id: "tp-3", templateId: "template-annual", memberId: "m-a", value: null });
		const march = await mocks.service.materializeStandardPeriod(HOUSEHOLD, "2027-03", USER, NOW, "op-1");
		expect(march.created).toHaveLength(1);
		expect(march.created[0]!.serviceStartDate).toBe("2027-03-01");
		expect(march.created[0]!.serviceEndDate).toBe("2028-03-01");
		const april = await mocks.service.materializeStandardPeriod(HOUSEHOLD, "2027-04", USER, NOW, "op-2");
		expect(april.created).toHaveLength(0);
	});

	it("resolves default-weight allocations from current member weights", async () => {
		mocks.templateStore.push(templateRecord({ allocationMethod: "default_weight" }));
		mocks.templateParamStore.push(
			{ id: "tp-1", templateId: "template-1", memberId: "m-a", value: null },
			{ id: "tp-2", templateId: "template-1", memberId: "m-b", value: null },
		);
		const result = await mocks.service.materializeStandardPeriod(HOUSEHOLD, "2026-08", USER, NOW, "op-1");
		expect(result.created).toHaveLength(1);
		expect(mocks.insertOccurrenceCalls[0]!.allocationParams).toEqual([
			{ memberId: "m-a", value: 1 },
			{ memberId: "m-b", value: 2 },
		]);
	});

	it("adopts an invisible occurrence from a crashed generation attempt", async () => {
		await seedMonthlyTemplate();
		mocks.expenseStore.push({
			id: "expense-orphan",
			householdId: HOUSEHOLD,
			categoryId: "cat-1",
			reportingPeriodId: "period-x",
			description: "Alquiler",
			reference: "vivienda/2026-08",
			status: "posted",
			plannedAmountMinor: 90000,
			plannedVersion: 1,
			actualAmountMinor: null,
			accountingDate: "2026-08-05",
			dueDate: "2026-08-05",
			serviceStartDate: null,
			serviceEndDate: null,
			allocationMethod: "equal",
			accountHintId: null,
			templateId: "template-1",
			scheduledDueDate: "2026-08-05",
			realizedByExpenseId: null,
			chainRootId: "expense-orphan",
			replacesId: null,
			reversedById: null,
			actorUserId: USER,
			operationId: "op-dead",
			createdAt: NOW,
			updatedAt: NOW,
		});

		const result = await mocks.service.materializeStandardPeriod(HOUSEHOLD, "2026-08", USER, NOW, "op-new");

		expect(result.created).toHaveLength(1);
		expect(result.created[0]!.id).toBe("expense-orphan");
		expect(mocks.expenseStore.find((row) => row.id === "expense-orphan")!.operationId).toBe("op-new");
		expect(mocks.insertOccurrenceCalls).toHaveLength(0);
	});

	it("adopts an invisible period from a crashed creation attempt", async () => {
		mocks.periodStore.push({
			id: "period-orphan",
			householdId: HOUSEHOLD,
			slug: "2026-08",
			label: "Agosto de 2026",
			startDate: "2026-08-01",
			endDate: "2026-09-01",
			kind: "standard",
			createdAt: NOW,
			operationId: "op-dead",
		});
		(mocks.periods.findVisibleBySlug as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

		const period = await mocks.service.ensureStandardPeriod(HOUSEHOLD, "2026-08", NOW, "op-new");

		expect(period.id).toBe("period-orphan");
		expect(mocks.periodStore.find((row) => row.id === "period-orphan")!.operationId).toBe("op-new");
	});
});
