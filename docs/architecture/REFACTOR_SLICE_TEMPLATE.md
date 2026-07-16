# Refactor Slice Prompt Template

Use this after the architectural census, one bounded slice at a time.

```xml
<task>
Refactor the following coherent dj-site slice:

[TARGET FEATURE, INTEGRATION, HOOK BUNDLE, OR DIRECTORY]
</task>

<current_problem>
[REPOSITORY-EVIDENCED PROBLEM]
</current_problem>

<desired_outcome>
[CONCRETE ARCHITECTURAL AND USER-FACING OUTCOME]
</desired_outcome>

<preserved_behavior>
[BEHAVIORAL INVARIANTS]
</preserved_behavior>

<excluded_scope>
[FILES, FEATURES, OR CONTRACTS THAT MUST NOT CHANGE]
</excluded_scope>

<special_requirements>
- Move affected tests into the top-level tests hierarchy.
- Audit and remove useless or wordy comments in every touched file.
- Preserve only comments that contain irreducible rationale or constraints.
- Keep hooks grouped with their semantic feature.
- Remove unnecessary effects, state mirroring, subscriptions, query work, and rerenders.
- Route optional external services through application-owned contracts and dedicated adapters.
- Ensure optional service failure cannot impair unrelated frontend behavior.
- Do not introduce speculative abstraction.
</special_requirements>

<acceptance_criteria>
[EXECUTABLE AND ARCHITECTURAL COMPLETION CONDITIONS]
</acceptance_criteria>

<verification>
Run focused tests, relevant integration or contract tests, type checking, linting, the production build, and runtime verification where static checks are insufficient.

Search the repository after implementation to confirm:

- no affected test remains colocated;
- no prohibited direct third-party imports remain;
- no superseded implementation remains reachable;
- no unnecessary comments remain in touched files.

Delegate an independent review and address supported findings before completion.
</verification>
```
