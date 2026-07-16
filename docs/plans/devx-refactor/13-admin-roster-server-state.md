# S13 — admin-roster-server-state

Status: pending · Risk: risky, admin-only blast radius (Opus) · PR: —

## Task

Move the admin roster onto RTK Query and delete the hand-rolled invalidation bus.

## Current problem

`src/hooks/adminHooks.ts` bypasses RTK Query with manual fetch state plus a pub/sub
invalidation bus (`lib/features/admin/roster-events.ts`) — duplicate server-state
machinery next to the app's standard one.

## Desired outcome

An RTK Query api slice using `queryFn` over `authClient.admin.*`; cache tags replace
the bus; the bus is deleted; roster components calling `invalidateRoster()` use tag
invalidation.

## Preserved behavior

Debounced search (300 ms); pagination; org-role merge; the better-auth string-JSON
workaround stays (with its diagnostics compressed).

## Excluded scope

better-auth client config; admin UI layout; user create/delete/role flows' semantics.

## Acceptance criteria

`roster-events.ts` gone; no manual fetch state in adminHooks; roster component tests
pass; CRUD + search + pagination proven by CI e2e `admin/` suite (5 specs).

## Verification

Baseline commands + roster component vitest suites; CI e2e `admin/` on the PR.
Note the known CI caveat: admin e2e shards pair Backend-Service by branch name and
fall back to its main — fine here since no backend change is needed. Jackson exercises
roster CRUD at gate M4.
