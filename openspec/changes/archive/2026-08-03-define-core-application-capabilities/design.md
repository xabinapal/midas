## Context

Runtime structure, observability, relational persistence, key-value storage, and authentication already have established behavior across application code, configuration, operational commands, and tests. OpenSpec currently has no capability specifications, so changes can be locally correct while violating an undocumented cross-cutting contract.

This change records the existing, evidence-backed behavior as five independently reviewable capabilities. It changes specification state and engineering workflow only; it does not change runtime behavior.

## Goals / Non-Goals

**Goals:**

- Establish durable normative requirements for the five core capabilities.
- Give each behavior one primary capability owner while documenting necessary cross-capability boundaries.
- Make requirements testable through explicit scenarios.
- Distinguish guaranteed application behavior from unsupported assumptions and future ideas.
- Make OpenSpec review the default starting point for requirement and implementation changes.

**Non-Goals:**

- Add, remove, or refactor runtime functionality.
- Specify exact dependency versions or incidental source layout beyond enforced architectural boundaries.
- Introduce authorization, user administration, registration, password recovery, or external identity providers.
- Add stronger consistency guarantees than D1 and Workers KV currently provide.
- Promote unimplemented observability, storage, or security features into requirements.

## Decisions

### Partition specifications by behavioral ownership

The change uses five capabilities rather than one broad application specification. Application structure owns execution boundaries and request context; logging owns emitted operational records; relational database owns authoritative relational state; key-value storage owns eventually consistent JSON storage and cache behavior; user authentication owns identity and session behavior.

This partition keeps future proposals focused and allows a change to identify exactly which contracts it modifies. A single specification was rejected because it would couple unrelated requirements and make review less reliable.

### Specify observed contracts, not implementation inventory

Requirements describe observable behavior, security properties, failure behavior, and stable architectural boundaries. Package versions, complete file lists, and cosmetic details are excluded unless they enforce a meaningful boundary.

Speculative requirements were rejected because the initial baseline must be trustworthy. Unsupported behavior must enter through a future proposal rather than being inferred from likely needs.

### Keep cross-capability behavior with one primary owner

Route classification belongs to application structure, while redirect, rejection, and session outcomes belong to user authentication. Application logging owns both request completion record invocation and output, while application structure owns the request context in which logging runs. Storage integration boundaries are stated in structure, while storage semantics remain in their respective capabilities.

Small references across capabilities are retained where needed to make safety boundaries explicit, but duplicate normative detail is avoided.

### Promote specifications through the normal change lifecycle

The files in this change are additive delta specifications. After evidence review and strict validation, archiving the change will promote them to `openspec/specs/` as the canonical current requirements. Future behavioral work must review those canonical specs and any active changes before implementation.

Directly creating canonical files was rejected because it would bypass proposal review and the repository's selected spec-driven workflow.

### Encode OpenSpec governance in repository instructions

`AGENTS.md` will require OpenSpec-first analysis for behavioral changes. Existing canonical specs are the source of truth; active changes describe proposed deviations. Implementations must not silently contradict either set of artifacts.

## Risks / Trade-offs

- **Baseline requirements may overfit current implementation** -> Requirements are limited to behavior with direct code, test, configuration, or documentation evidence and avoid dependency-version details.
- **Cross-capability changes may update only one spec** -> Proposals must list every affected capability, and agents must review all relevant canonical and active specs before coding.
- **The active change can be mistaken for canonical state** -> Governance distinguishes `openspec/specs/` as current truth and `openspec/changes/` as proposed truth until archive.
- **Large initial review surface** -> Capabilities are separated into five files so they can be reviewed independently while remaining one coherent baseline change.
- **Implementation and specs may already differ** -> Apply tasks require evidence review and mismatch resolution before archive; validation alone is not treated as behavioral verification.

## Migration Plan

1. Review each delta specification against its cited implementation, tests, configuration, and operational behavior.
2. Resolve every mismatch by removing or narrowing unsupported baseline language to observed behavior. A separate follow-up proposal may define desired future behavior, but it must not leave an unsupported requirement in this baseline.
3. Run strict OpenSpec validation and the repository quality gates.
4. Archive the verified change to promote the five specifications into `openspec/specs/`.
5. Use the promoted specifications as the starting point for all future behavioral proposals.

Rollback before archive consists of removing this active change. Rollback after archive consists of reverting the archival commit; runtime deployment rollback is not applicable because this change does not alter runtime code.

## Open Questions

None. Behaviors without sufficient evidence are intentionally excluded and can be proposed separately when requirements are known.
