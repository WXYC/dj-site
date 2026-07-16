# Fable Read-Only Refactoring Census Prompt

Paste the prompt below into a new Fable session before beginning broad implementation.

```xml
<task>
Perform a read-only architectural census of the dj-site repository.

Do not modify files.

Map the repository as it actually exists, with special attention to:

1. all Backend-Service access paths;
2. every other external service and SDK;
3. direct PostHog imports and calls;
4. library metadata lookup paths;
5. telemetry and error-reporting integrations;
6. how optional service failures currently propagate;
7. Redux and RTK Query ownership;
8. duplicated or overlapping server state;
9. every custom hook bundle;
10. unnecessary effects, duplicate queries, broad selectors, or mirrored state;
11. all test locations and test-runner assumptions;
12. comments that appear narrational, generated, historical, decorative, or redundant;
13. server and client component boundaries;
14. duplicate, legacy, or superseded implementations.

For each external integration, identify:

- direct consumers;
- third-party imports;
- application-owned types, if any;
- current failure behavior;
- whether primary rendering waits for it;
- whether a no-op or fallback exists;
- the smallest appropriate application-owned contract.

For each major hook bundle, identify:

- semantic purpose;
- inputs and outputs;
- state owners;
- effects;
- query subscriptions;
- mutations;
- Redux selectors;
- external service calls;
- likely unnecessary work.

For the test suite, propose a top-level tests structure that preserves semantic discoverability without colocating tests beside production code.

Do not recommend a generic architecture without repository evidence.

Identify the strongest existing local implementation pattern for each concern and recommend whether it should become the repository standard.

Produce:

1. a concise current-state architecture map;
2. a dependency and integration inventory;
3. a hook-performance audit;
4. a test-migration map;
5. a comment-reduction audit;
6. the highest-risk behavior-preservation areas;
7. an ordered refactoring campaign composed of small, independently verifiable slices.

Do not implement any slice yet.
</task>
```
