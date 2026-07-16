# S9 — auth-session-ownership

Status: pending · Risk: risky, highest-leverage perf fix (Opus) · PR: —

## Task

Give session and org-role state a single owner and make `useRegistry` outputs
referentially stable.

## Current problem

`useAuthentication` mirrors session state per-mount: every consumer runs its own
org-role fetch; `useRegistry` returns unstable objects that feed dependency arrays
across the app, causing cascading recomputation (census §3).

## Desired outcome

One owner for session/org-role (small provider or module-level dedupe for the org-role
fetch); `useRegistry` output memoized so `info` is referentially stable;
`src/hooks/useCanEditCatalog.ts` role resolution consolidated. Consumers keep the same
hook signatures.

## Preserved behavior

`authenticating` semantics incl. #612 cancellation; role fallback order; `useRegistry`
output shape; JWT-claim vs org-role precedence in `useCanEditCatalog`; no-session race
handling (`confirmSessionVisible`) and OIDC resume paths (#836, #849) untouched
(census risk #3).

## Excluded scope

Login/OIDC flow logic; auth reverse proxy route; better-auth client config; flowsheet
hooks (S10 depends on this slice's identity stability but is separate).

## Acceptance criteria

Single org-role fetch per session regardless of consumer count (assert via test or
fetch-count harness); stable identities verified by test; all auth hook tests pass.

## Verification

Baseline commands + auth hook vitest suites; CI e2e `auth/` (6 specs) + `rbac/` suites
on the PR. Comment reduction in `authenticationHooks.ts` (145 comment lines — compress
essays, keep race/telemetry rationale) happens here since this slice owns the file.
