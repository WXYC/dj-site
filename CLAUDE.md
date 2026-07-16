# DJ Site Engineering and Refactoring Rules

## Mission

Make `dj-site` the simplest accurate expression of its required behavior.

Optimize in this order:

1. Correct user-facing behavior.
2. Data integrity and security.
3. Reliability of the primary `Backend-Service` path.
4. Failure isolation for every optional external service.
5. Clear ownership and dependency direction.
6. Removal of unnecessary runtime work.
7. Readability and low cognitive overhead.
8. Deletion of obsolete code and redundant comments.

Do not optimize for minimum line count at the expense of clarity.

## Architectural Standard

`Backend-Service` is the only external service that may be treated as a core runtime dependency.

Every other external service—including PostHog, metadata lookup, telemetry, artwork, enrichment, recommendations, and feature flags—must:

- be accessed through an application-owned contract;
- have a service-specific adapter;
- contain provider-specific types within that adapter;
- fail open;
- avoid blocking primary rendering or unrelated workflows;
- provide a no-op, unavailable, or fallback implementation where appropriate.

Feature modules may depend on integration contracts. They must not import optional third-party SDKs directly.

## Simplicity

Prefer:

- direct code over speculative abstraction;
- one authoritative owner for each value;
- one primary implementation;
- feature-specific modules over generic utility collections;
- ordinary TypeScript and recognizable Next.js patterns;
- deletion over indefinite deprecation;
- framework capabilities over custom infrastructure.

Introduce an abstraction only when it represents a real domain concept, enforces a necessary boundary, isolates a volatile dependency, removes substantial verified duplication, or enables otherwise impractical testing.

Potential future reuse is not sufficient.

A valid result is that no change should be made.

## Tests

Production source directories must not contain colocated tests or `__tests__` directories.

Place tests under the top-level `tests/` hierarchy, organized by purpose and semantic feature:

- `tests/unit`
- `tests/integration`
- `tests/contract`
- `tests/e2e`
- `tests/fixtures`
- `tests/helpers`
- `tests/fakes`

Do not weaken tests to accommodate a refactor.

## Comments

Actively reduce comments in every touched file.

Remove comments that:

- restate code;
- narrate control flow;
- explain ordinary syntax;
- repeat names or types;
- announce obvious sections;
- describe implementation history;
- contain agent narration;
- preserve commented-out code;
- act as changelog entries;
- contain vague TODOs;
- compensate for unclear naming.

Preserve only concise comments that explain a non-obvious reason, external constraint, compatibility requirement, security property, race condition, subtle invariant, or intentional exception.

## Hooks and State

Keep hooks grouped with their semantic feature.

Audit every hook for:

- mirrored server or prop state;
- values that should be derived during render;
- unnecessary effects;
- effect chains;
- unstable query arguments;
- duplicate RTK Query subscriptions;
- unnecessary polling or refetching;
- broad cache invalidation;
- broad Redux selection;
- selectors that allocate on every call;
- unnecessary memoization;
- repeated parsing or normalization;
- event-listener or timer leaks;
- optional work delaying primary data;
- multiple unrelated responsibilities.

Use:

- RTK Query for `Backend-Service` server state;
- Redux for genuinely shared client-owned state;
- local state for temporary local interaction state;
- URL state when navigation or shareability requires it.

Use effects only to synchronize with systems outside React.

Do not claim a performance improvement without identifying the work removed or providing relevant evidence.

## Next.js Boundaries

Use Server Components by default when client interactivity is not required.

Do not expand `"use client"` boundaries for convenience.

Keep route and layout files focused on composition and framework concerns.

Do not import server-only modules into client dependency graphs.

Do not place the complete application beneath a failure-prone optional provider.

## Change Discipline

Work on one coherent architectural slice at a time.

For each slice:

1. Inspect the target and all callers.
2. Establish observable behavior.
3. Identify state and dependency ownership.
4. Locate relevant tests.
5. State invariants.
6. Propose the smallest coherent design.
7. Implement only that slice.
8. Move affected tests into `tests/`.
9. Reduce comments in touched files.
10. Remove superseded code.
11. Run focused and broader relevant tests.
12. Run type checking, linting, and the production build.
13. Verify runtime behavior where static checks are insufficient.
14. Review the diff for unrelated changes.
15. Request a fresh-context architectural review.
16. Address supported findings and rerun verification.

Do not combine unrelated cleanup with the active slice.

Report what was inspected, changed, statically verified, tested, runtime verified, inferred, and not verified.
