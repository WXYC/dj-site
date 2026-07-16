# S12 — bin-hooks-cleanup

Status: done · Risk: simple (Sonnet) · PR: —

## Task

Replace the toast-on-error effect in `src/hooks/binHooks.ts` with a `.catch`/unwrap in
the action callback and drop the whole-`result` effect dependency.

## Current problem

Error toasting runs through an effect keyed on the whole mutation `result` object —
an unnecessary effect with an over-broad dependency (census §3).

## Desired outcome

Toast raised in the mutation callback's catch path; effect deleted.

## Preserved behavior

Same toast messages on failure; clearBin partial-failure reporting intact.

## Excluded scope

Bin api slice; bin components; export logic.

## Acceptance criteria

No error-toast effect remains in binHooks; bin tests pass with identical toast
assertions.

## Verification

Baseline commands + bin vitest suites. Jackson checks bin error toasts at gate M4.

## Result

**Work removed (charter §7.9):** one `useEffect` in `useBinMutation` (`src/hooks/binHooks.ts`),
subscribed to the whole RTK Query mutation `result` object just to toast on
`result.isError`. That's one effect and one whole-object dependency subscription
eliminated — the toast now raises directly in the `action` callback's
`.unwrap().catch()`, synchronous with the mutation call that triggered it, with no
extra render/commit cycle for the effect to observe the error flag and no
broad-object dependency (`result`) forcing the callback to re-diff on every mutation
state change (loading flips, etc.), not just on failure.

**Callback design:** `useBinMutation`'s `action` now calls
`mutate({ dj_id, album_id }).unwrap().catch(() => toast.error(errorMessage))`
instead of firing the mutation and leaving error handling to a separate effect.
`errorMessage` moved into the `useCallback` dependency array (previously only an
effect dependency); it's a static string literal per call site (`useAddToBin` /
`useDeleteFromBin`), so this doesn't destabilize the callback identity.

**Non-null-assertion findings (charter §12, S19 lint inventory, 2 in this file):**
both were the `optional-chain-then-non-null` pattern (`info?.id!`), which is *not*
behavior-neutral to convert into `info!.id` — `?.` short-circuits to `undefined`
without throwing when `info` is null, while `info!.id` is a plain property access
that throws at runtime if `info` actually is null. Fixed each with the minimal
behavior-preserving form instead:
- `useBin`'s query args: `info?.id!` → `info?.id ?? ""`. The value is only ever
  read by RTK Query when `skip` is false, and `skip: !info || loading` already
  guarantees `info` is truthy whenever that happens — so the `""` fallback is
  never actually sent; it only replaces what was silently `undefined` while the
  query is skipped.
- `useBinMutation`'s `action` callback: `info?.id!` → `info.id`. The callback
  already returns early on `!info` before this line, so TypeScript narrows `info`
  to non-null here without any assertion — this line is provably identical at
  runtime to the old `info?.id!` (both reduce to `info.id` once `info` is known
  truthy).

Both `npm run lint` findings for `@typescript-eslint/no-non-null-asserted-optional-chain`
in `binHooks.ts` are gone (226 warnings vs. the 228 baseline recorded in S19; 0
errors, matching baseline). The unrelated `info.id!` in `useClearBin` (no `?.`
involved, so not flagged by this rule) was left untouched — out of scope.

**Preserved behavior:** identical toast copy on failure ("Failed to add album to
bin", "Failed to remove album from bin"); `useClearBin`'s partial-failure toast
(named-albums summary, 3-item truncation with "and N more") is untouched — it
already handled its own errors via `Promise.allSettled` + `.unwrap()`, not through
the deleted effect.

**Test adjustments (original pass):** none required at the time — `tests/unit/hooks/binHooks.test.tsx`
only exercised `useClearBin`, which wasn't touched; no test in the repo asserted
the `useAddToBin`/`useDeleteFromBin` toast-on-error path directly (grepped for
`useAddToBin`/`useDeleteFromBin` call sites across `tests/` and `src/`), so there
were no effect-mechanics assertions to adjust.

**Comment reduction (charter §6):** no removals — the file's pre-existing
comments (the `useClearBin` doc block, the aggregate-pending-state rationale, the
failed-titles-summary rationale) each explain a non-obvious reason and were kept.
One comment added, explaining the `?? ""` fallback's non-obviousness (why not an
assertion).

### Independent review finding (blocking) and follow-up

The fresh-context review of this slice's diff passed all correctness checks but
raised one blocking finding: the add/delete toast-on-error path rewired out of
the effect had **no test coverage anywhere** in the repo, and charter §5.4
prioritizes failure-handling coverage. The review classified the underlying
change itself — eliminating the duplicate toast risk the old whole-object effect
carried (an effect re-running on unrelated `result` field changes, e.g. loading
flips, was a latent double-toast surface) — as a strict improvement, pending
Jackson's sign-off via PR.

Addressed by extending `tests/unit/hooks/binHooks.test.tsx` with two new
`describe` blocks, `useAddToBin` and `useDeleteFromBin`, four cases total:

- add succeeds → `addTrigger` called with `{ dj_id, album_id }`, no toast;
- add fails → exactly one `toast.error("Failed to add album to bin")`;
- delete succeeds → `deleteTrigger` called with `{ dj_id, album_id }`, no toast;
- delete fails → exactly one `toast.error("Failed to remove album from bin")`.

The `useAddToBinMutation` mock changed from a bare `vi.fn()` to a trigger
returning `{ unwrap: () => ... }` (mirroring the pre-existing `deleteTrigger`
pattern), gated by a new `addFailIds` set, since the production callback now
calls `.unwrap()` on the mutate result. A `flushMicrotasks` helper (two
`await Promise.resolve()`) drains the `.unwrap().catch()` chain, which the
`action` callback fires but does not return/await. No existing test was
weakened or altered — all 5 original `useClearBin` cases are unchanged.

**Counts:** 269 files / 3,674 tests, all passing (3,670 campaign-ledger baseline
+ 4 new bin-hooks toast-on-error cases). `npx tsc --noEmit` clean. `npm run lint`:
0 errors / 226 warnings (unchanged from the first pass; down 2 from the 228 S19
baseline). `npm run build` succeeds (verified in the first pass; no production
source changed in this follow-up, test-file-only diff). Focused
`tests/unit/hooks/binHooks.test.tsx`: 9/9 passing (5 original + 4 new).
