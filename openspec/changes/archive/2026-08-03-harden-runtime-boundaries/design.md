## Context

The server hook is the application boundary for database and KV setup, authentication configuration, session cookies, route protection, and request logging. Lower-level modules are tested independently, but their orchestration is not. The database initializer also clears shared state only after migration failures, so a client-factory exception leaves a rejected promise cached for the isolate lifetime.

The existing application-structure, application-logging, key-value-storage, and user-authentication requirements already define the expected request and route behavior. Only relational initialization recovery changes normatively.

## Goals / Non-Goals

**Goals:**

- Recover from client-creation and migration failures without weakening single-flight initialization.
- Verify request-boundary behavior through deterministic Node tests using real authentication, session, route-classification, cookie, KV-wrapper, and logging decisions.
- Verify login and logout route actions at their SvelteKit boundary.
- Align optional KV typing and cache-reset pagination coverage with existing requirements.

**Non-Goals:**

- Add authentication or authorization features, change route classifications, or alter session formats.
- Start Vite or a Worker for request-boundary unit tests.
- Add dependencies, public commands, remote storage operations, or deployment configuration.
- Change cache-reset runtime behavior that already follows cursors correctly.

## Decisions

### Clear failed initialization after the shared promise is assigned

The initializer will attach failure cleanup to the shared initialization promise. This catches both synchronous client-factory exceptions converted into promise rejections and asynchronous migration failures. Migration-specific disposal remains around the successfully created client, while the outer failure handler clears shared state for every failure.

Moving client creation into the existing inner `try` was rejected because synchronous cleanup can run before the surrounding nullish assignment completes and then be overwritten by the rejected promise.

### Introduce one factory seam around the request hook

`hooks.server.ts` will export a request-handle factory that injects build state, private environment access, database initialization, and the access-log sink. The production `handle` will instantiate it with existing dependencies. Domain decisions and SvelteKit redirect/error behavior remain real and colocated in the hook.

Broad module-reset and virtual-module mocking was rejected because the module-scoped database initializer and SvelteKit environment modules would make tests order-dependent and coupled to local environment files.

### Exercise server modules with SvelteKit-aware Node tests

The unit Vitest configuration will use the existing SvelteKit Vite plugin so route modules and virtual aliases resolve. Hook tests will use synthetic request events and fake only D1 initialization, raw platform bindings, route resolution, and the log sink. Login tests will mock only credential authentication; logout tests need no module mocks.

Starting a development server or built Worker was rejected because it would add ports, storage lifecycle, environment dependence, and slower tests without improving coverage of hook ordering or cookie calls.

### Test cache pagination with a deterministic namespace fake

A unit test will return multiple cursor pages from a fake KV namespace, assert cursor progression and complete deletion, and rely on the existing Wrangler integration test for real-binding prefix preservation. Creating more than one thousand real KV entries was rejected as slower and less deterministic for logic that is independent of the binding implementation.

## Risks / Trade-offs

- [Synthetic request events can drift from SvelteKit types] -> Construct them against the public `RequestEvent` and `Cookies` contracts and retain type checking and production builds as gates.
- [Adding the SvelteKit plugin can expose local environment values to tests] -> Test the injected factory with explicit environment getters rather than the exported production handle.
- [The hook factory can become an abstraction layer] -> Inject only system boundaries needed for deterministic tests and keep all request behavior in one function.
- [Promise cleanup can accidentally dispose a client that was never created] -> Keep disposal inside the migration failure path and cover client-factory failure separately.

## Migration Plan

Implement the initializer regression test and recovery first, then add the hook seam and boundary tests, align KV typing, and add cache-reset pagination coverage. No data or deployment migration is required. Rollback is a source revert because no persisted format or public API changes.

## Open Questions

None.
