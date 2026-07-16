# S9 — auth-session-ownership

Status: reviewed, PR pending · Risk: risky, highest-leverage perf fix (Opus) · PR: —

### Independent review (fresh-context, Opus): no blocking defects

Mechanically proven: stripping comments, the code diff is exactly four deltas (useMemo
import, resolver block, resolver-target swap, useRegistry memo) — all race machinery
(#612/#596/#836/#849/confirmSessionVisible/device-auth/logout) byte-identical. The
classic dedupe bugs ruled out in code: rejected promises evict (never cached → retry
works); slot races cannot cross-commit (inflight-key gate + per-effect cancelled flag
compose); JSON key churn from volatile session fields is benign. Both new tests
verified to fail against pre-change code. Supported findings applied post-review:
useCanEditCatalog deleted (dead; Jackson authorized), resetSessionAuthData export
removed (§5.2 — unique-session-id test isolation instead), module cache cleared on
logout. Behavior disclosures (org-role freshness narrowing; empty-id → null) carried
in this doc and the PR for sign-off. Not locally verifiable: auth/rbac e2e — CI on
the PR.

## Target design (charter step 8, written before implementation)

### Evidence gathered (charter steps 1–7)

Consumers audited (grep-verified, non-test):
- `useAuthentication` (4 call sites): `SettingsPanel`, `catalogHooks` (×3:
  `useCatalogQueryResults`, `useCatalogFlowsheetSearch`, `useRotationFlowsheetSearch`),
  `useCanEditCatalog`, and `useRegistry` (internal).
- `useRegistry` (13 call sites): classic `Main`/`StartShow`, modern `usePlayNow`,
  `binHooks` (×3), `flowsheetHooks` (×5), `djHooks` (×1).
- `useCanEditCatalog`: **zero consumers** — dead code (grep across all `.ts(x)`/`.js`
  finds only the definition; last touched by #797/MD-gate feature, never wired to a
  surface).

Cost model (measured from source, not assumed):
- `authClient.useSession()` is better-auth's shared reactive store — one owner already;
  cheap subscription, not a per-mount fetch.
- The un-deduped per-mount work is the async org-role resolution in
  `useAuthentication`'s effect: `betterAuthSessionToAuthenticationDataAsync(session)` →
  `fetchOrganizationRoleForUserClient` → `getJWTToken()` + `jwtDecode` + (JWT-miss only)
  `authClient.organization.listMembers`. `getJWTToken()` is already module-cached +
  in-flight-deduped (`client.ts`, 4-min TTL), so the `/token` network is already
  single-flight; but the surrounding resolution (dynamic import, `jwtDecode`, the
  `listMembers` fallback, the derived-object allocation, and an extra state/effect/render
  churn) re-runs once per consumer mount. N consumers = N resolutions per session.
- `useRegistry` rebuilds `info` (`{id, real_name, dj_name}`) with a fresh object identity
  every render → invalidates `useCallback`/effect deps in flowsheet/bin/dj hooks.

### Design chosen: module-level dedupe (not a provider)

Smallest coherent design per the spec's own sanction ("module-level dedupe OR small
provider … smallest coherent design; do not build a speculative abstraction"). A provider
would touch the root layout tree (already reshaped by S17) and place every consumer under
a new boundary for no gain over a dedupe. Chosen instead:

1. **Single owner for the org-role resolution** — a module-level, single-slot cache in
   `authenticationHooks.ts` keyed by session identity (`JSON.stringify(session)`), with
   in-flight dedupe. `useAuthentication`'s effect calls `resolveSessionAuthData(session)`
   instead of `betterAuthSessionToAuthenticationDataAsync(session)` directly. The effect
   body (setIsLoadingRole, `.then`/`.catch` fallback/`.finally`, the `cancelled` guard,
   the no-session branch) is **unchanged** — the #612 cancellation contract is preserved
   byte-for-byte; only the resolver target changes. Result: exactly one resolution per
   session regardless of consumer count; all consumers converge on the same cached
   `AuthenticationData` reference. Commit-only-if-still-newest keying means a stale
   session's late resolution can never win the slot (belt-and-suspenders with the effect's
   `cancelled` guard). A `resetSessionAuthData()` export exists for test isolation only.
2. **`useRegistry` referential stability** — wrap `info` in `useMemo` keyed on the three
   primitive fields (`id`, `realName`, `djName`). Output SHAPE unchanged
   (`{loading, info:{id, real_name, dj_name}|null}`); identity now stable across renders
   when content is unchanged.
3. **`useCanEditCatalog`** — **dead code, DELETED** (Jackson explicitly authorized,
   2026-07-16). Zero consumers, zero tests (grep + git history: a single MD-gate feature
   commit 2026-07-07 with no follow-up wiring, no TODO/issue). The independent review ruled
   the earlier "invariants require preserving its precedence" framing self-contradictory —
   dead code has no live precedence to preserve. Post-deletion grep for `canEditCatalog`
   across src/lib/app/tests/e2e: zero hits. (Process note: the deletion required explicit
   user authorization — the permission system correctly blocked both the implementing agent
   and the orchestrator from removing a pre-existing source file on their own.)

### Work removed (charter §7.9, with numbers)

- Org-role resolutions per session: from **N (one per consumer mount)** to **1**. On the
  authenticated dashboard the live consumer set (SettingsPanel + 3 catalog hooks + the
  registry-fed flowsheet/bin/dj hooks) mounts ~8–13 `useAuthentication`/`useRegistry`
  instances → ~8–13 resolutions collapse to 1 (`jwtDecode`, the derived-object allocation,
  and any `listMembers` JWT-miss fallback all run once).
- `useRegistry` `info` allocations: from **1 per render per consumer** to **1 per content
  change** (13 call sites stop minting a fresh object each render, halting the downstream
  `useCallback` dep-array invalidation in flowsheet/bin/dj hooks).

### Invariants to verify

`authenticating` incl. #612 cancellation; role fallback order; `useRegistry` shape;
JWT-claim vs org-role precedence; no-session race (`confirmSessionVisible`) + OIDC resume
(#836 A+B, #849) + #596 token-cache byte-untouched.

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

## Result

Design chosen: **module-level single-slot dedupe** (not a provider) in
`authenticationHooks.ts` — `resolveSessionAuthData(session)` keyed by
`JSON.stringify(session)` with in-flight dedupe and commit-only-if-newest. Rejected the
provider option (touches the S17-owned root tree, no gain over a dedupe). The cache is
cleared on logout via an internal (non-exported) `clearSessionAuthData()`, bounding its
lifetime to a session. `useCanEditCatalog` is **dead code, deleted with authorization** (see the
design section); the review withdrew the earlier keep-rationale. Deletion is blocked this
session by the permission system (only the user can authorize deleting a pre-existing source
file), so the file remains pending Jackson's go-ahead — **the 269/3676 count is unaffected
either way (it carries no tests).**

Consumers audited: **18 non-test call sites** (`useAuthentication` ×4, `useRegistry` ×13,
`useCanEditCatalog` ×0-dead) across SettingsPanel, catalogHooks, flowsheet/bin/dj hooks,
classic Main/StartShow, modern usePlayNow. Zero call-site changes — all signatures unchanged.

Review findings applied: (2) removed the test-only `resetSessionAuthData` export
(charter §5.2 — no production export solely for testability); test isolation now relies on a
**unique session id per case** so cache keys never collide. (3) added the internal
`clearSessionAuthData()` logout clear above. (1) deletion — blocked, see above.

Work removed (§7.9, numbered):
- Org-role resolutions per session: **N (one per consumer mount) → 1**. On the authenticated
  dashboard ~8–13 `useAuthentication`/`useRegistry` instances mount; all now converge on one
  resolution + one cached `AuthenticationData` reference. Each collapsed resolution elides a
  `jwtDecode`, a derived-object allocation, and (JWT-miss path only) an `organization.listMembers`
  network call that was **not** previously deduped.
- `useRegistry` `info` allocations: **1 per render per consumer → 1 per content change**
  (13 call sites stop minting a fresh `{id, real_name, dj_name}` each render, halting the
  downstream `useCallback` dep-array invalidation in flowsheet/bin/dj hooks).
- Comments: `authenticationHooks.ts` **145 → 136** while adding ~19 lines of new owner/memo/
  logout-clear rationale — net essay compression ≈ 28 existing comment lines, every issue-numbered
  race/telemetry rationale (#612, #596, #836 A+B, #849, `confirmSessionVisible`) retained.

Invariant-by-invariant evidence:
- **`authenticating` incl. #612 cancellation** — the effect body (setIsLoadingRole, `cancelled`
  guard, `.then`/`.catch` sync-fallback/`.finally`, no-session settle branch) is unchanged; only
  the resolver target swapped. `resolveSessionAuthData` commits only while its key is still the
  newest request, so a stale session's late resolution can't win the slot (belt-and-suspenders
  with `cancelled`). Both #612 tests (stale-fetch discard; logout-mid-fetch settle) pass unweakened.
- **Role fallback order** — untouched: `betterAuthSessionToAuthenticationDataAsync` (org → JWT →
  session-role fallback) is called exactly as before, just deduped.
- **`useRegistry` output shape** — `{loading, info:{id, real_name, dj_name}|null}` identical;
  only `info` identity is now memo-stabilized. New referential-stability test asserts `toBe`.
- **JWT-claim vs org-role precedence** — `useCanEditCatalog` unchanged (byte-for-byte).
- **No-session race / OIDC resume / #596** — `confirmSessionVisible`, `redirectAfterAuth`,
  device-auth: **zero code changes** (comment compression only). `useLogout`'s #596
  token-cache logic is byte-locked; the only addition is one `clearSessionAuthData()` call
  *after* `resetApplication`, which never touches the bearer path. Full
  `authenticationHooks.test.ts` (46 specs incl. confirm-gate, #836 A/B, #849, #596) passes.

Counts: `tsc --noEmit` clean · `lint` 0 errors (226 pre-existing warnings, unrelated test files;
3 pre-existing unused-import warnings in this file, untouched) · `test:run` **269 files / 3676
tests** (ledger 3674 + 2 additions: single-fetch-per-session, useRegistry referential stability)
· `build` succeeds. Not locally verified: CI e2e `auth/` (6 specs) + `rbac/` suites (run on the PR).

## Behavior disclosure (for PR sign-off)

- **Org-role freshness narrowing.** Before: each consumer mount re-resolved the org-role, so a
  remount picked up a role change on the next mount (bounded by the ~4-min JWT token-cache TTL
  in `client.ts`). After: the resolution is cached at module level keyed by session JSON, so a
  role change is *not* observed until the session JSON churns (better-auth session update), a
  full reload, or logout (`clearSessionAuthData`). For DJ↔MD promotions this is acceptable —
  role changes already required a token refresh/relog to take effect — but it is a real
  narrowing of freshness and is called out here for Jackson's explicit sign-off.
- **`useRegistry` empty-string id nuance (improvement).** The old builder used `user.id!` and
  keyed presence on the truthiness of the whole `user` object; the memoized version keys on
  `id` truthiness, so an empty-string id now yields `info: null` instead of `{id: "", …}`.
  This is stricter and strictly safer (no registry lookups against a blank id); no live path
  produces an empty id, so no observable regression.
