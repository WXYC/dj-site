# S13 — admin-roster-server-state

Status: reviewed, PR pending · Risk: risky, admin-only blast radius (Opus) · PR: —

### Independent review (fresh-context, Opus): APPROVE, no blocking findings

All nine checks pass with evidence: invalidation timing preserved at all five call
sites (synchronous dispatch, same-tick refetch, no dropped refresh incl. the
unmount/remount path); error-shape parity exact; no double-fetch on mount
(useDebouncedValue seeds to the live value); totalAccounts write timing identical
incl. error paths; the better-auth string-JSON workaround functionally intact with
diagnostics compressed; bus deletion complete (zero references); test changes
equal-or-stronger. ExportCSV is now strictly FRESHER than before (it never
subscribed to the old bus).

### Behavior disclosure (for PR sign-off)

RTKQ cache defaults replace the old unconditional refetch-on-remount: remounting
the roster within 60s serves cache (in-app mutations still force refetch via tag
invalidation; only external changes from another tab/session can be briefly stale).
Restorable with one line (`refetchOnMountOrArgChange: true`) if exact old freshness
is wanted. Transient dual cache entries during typing (two 300ms debounce timers)
are self-healing and strictly cheaper than the old duplicate round-trips.

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

## Result

New `lib/features/admin/api.ts` — an RTK Query `createApi` (`reducerPath: "adminApi"`,
`fakeBaseQuery`) with a single `getRoster` `queryFn` over `authClient.admin.listUsers`
+ `authClient.organization.listMembers`, `tagTypes: ["Roster"]`, `providesTags:
["Roster"]`. Registered in `lib/store.ts` (reducer + middleware).

`src/hooks/adminHooks.ts` (`useAccountListResults`) reduced 117 → 21 lines: now reads
`searchString`/`page` from `adminSlice`, debounces search 300 ms (unchanged), and calls
`useGetRosterQuery`. Deleted: the `useState` fetch state (accounts/isLoading/isError/
error), the `useEffect(fetchAccounts)`, the `useCallback` fetch body, and all four
better-auth JSON-string diagnostic `console.warn`s (workaround kept, compressed to one).

`lib/features/admin/roster-events.ts` (pub/sub bus) deleted. `RosterTable` drops its
`useEffect(() => onRosterInvalidated(refetch))` duplicate subscription; `AccountEditForm`'s
five `invalidateRoster()` calls now dispatch `adminApi.util.invalidateTags(["Roster"])`.

`total` stays in `adminSlice` (read by `RosterTable` pagination); it is now written once
per settled fetch via the query's `onQueryStarted`, replacing the old in-hook dispatch —
no React effect, no mirrored `useState`.

Work removed: pub/sub bus (2 fns + module), manual server-state machinery (4 useState +
effect + callback), the duplicate RosterTable/ExportCSV fetch (two identical listUsers+
listMembers round-trips per page now dedup to one via the shared RTKQ cache), and the
verbose better-auth diagnostic block.

Verified: `tsc --noEmit` clean; `lint` 0 errors; `test:run` 269 files / 3676 tests pass
(ledger unchanged); `build` succeeds; focused admin suites green. CI e2e `admin/` (5
specs) not locally runnable — the real gate, runs on the PR.
