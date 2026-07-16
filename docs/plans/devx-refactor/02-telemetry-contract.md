# S2 — telemetry-contract

Status: reviewed, PR pending · Risk: risky (Opus) · PR: —

## Task

Complete the application-owned telemetry contract so `posthog-js` imports exist only
inside the adapter (`lib/posthog.ts`), per the CLAUDE.md optional-service rule.

## Current problem

`lib/posthog.ts` re-exports the raw `posthog` object, consumed directly by
`lib/features/backend.ts` and `app/global-error.tsx`;
`src/components/shared/PostHogProvider.tsx` imports `posthog-js/react`'s PHProvider
though zero `usePostHog` consumers exist (grep-verified in census).

## Desired outcome

`lib/posthog.ts` exposes only `initTelemetry`, `safeCapture`, `safeCaptureException`,
`safeCapturePageview`, keeping provider-specific types inside; `backend.ts` and
`global-error.tsx` use `safeCaptureException`; PostHogProvider drops PHProvider but
keeps init + pageview + CSP-reporter install (rename to `TelemetryProvider` if churn
stays small). After this slice `posthog-js` appears ONLY in `lib/posthog.ts`.

## Preserved behavior

Telemetry never throws; init no-ops without `NEXT_PUBLIC_POSTHOG_KEY`; pageview events
unchanged (`$pageview` with `$current_url`); RTK error-middleware behavior unchanged
(autoDJ swallows, backend soft-fails, everything else toasts — census risk #8); CSP
reporter installed exactly once.

## Excluded scope

No changes to what is captured or when; no new telemetry; no provider swap
infrastructure.

## Acceptance criteria

`grep -r "posthog-js" app src lib --include="*.ts*"` hits only `lib/posthog.ts`;
no raw `posthog` export remains; all baseline tests pass.

## Verification

Baseline commands + `vitest run lib/__tests__/posthog.test.ts lib/__tests__/store.test.ts
lib/__tests__/csp-violation-reporter.test.ts` (paths shift if run after S5). Runtime
pageview confirmation deferred to Jackson's M1 gate.

## Result

### Inspected
- `lib/posthog.ts` (raw `posthog` re-export + `initPostHog`/`safeCapture`/`safeCaptureException`).
- All consumers of the raw export (grep-verified): `lib/features/backend.ts`,
  `app/global-error.tsx`, `src/components/shared/PostHogProvider.tsx`
  (pageview + PHProvider `client`).
- `posthog-js/react` / `usePostHog` consumers: zero besides the PHProvider wrapper
  itself — confirmed removable.
- Existing safe-contract consumers left untouched: `lib/store.ts`,
  `lib/csp-violation-reporter.ts`, `lib/features/flowsheet/{live-updates-listener,infinite-cache}.ts`,
  `app/login/LoginBounceTelemetry.tsx`, `src/hooks/authenticationHooks.ts`.
- Test callers of the raw export: `lib/__tests__/features/backend.test.ts` (mocked
  `posthog.captureException`) and `lib/__tests__/features/flowsheet/live-updates-listener.test.ts`
  (spied on `posthog.capture`/`captureException`).

### Changed
- `lib/posthog.ts` — removed the raw `posthog` re-export; renamed `initPostHog` →
  `initTelemetry`; added `safeCapturePageview(url)` (emits `$pageview` with `$current_url`);
  kept `safeCapture`/`safeCaptureException`; `posthog-js` import stays inside the adapter.
  Comment essays condensed to one contract note.
- `lib/features/backend.ts` — imports `safeCaptureException`; dropped the now-redundant
  local `try/catch` (the adapter owns the never-throw guarantee); trimmed two narration
  comments in `prepareHeaders`. Soft-fail contract JSDoc preserved.
- `app/global-error.tsx` — raw `posthog.captureException` → `safeCaptureException`.
- `src/components/shared/PostHogProvider.tsx` → renamed to `TelemetryProvider.tsx`
  (`git mv`; only importer was `app/layout.tsx`). Dropped `posthog-js/react` PHProvider
  wrapper (children now render under a fragment); init + pageview (via `safeCapturePageview`)
  + CSP-reporter install semantics unchanged. Internal `PostHogPageView` → `TelemetryPageView`.
- `app/layout.tsx` — import + tags updated to `TelemetryProvider`.
- `lib/csp-violation-reporter.ts` — one-word doc-comment reference updated
  (`from PostHogProvider` → `from TelemetryProvider`); no code change.
- Tests: `lib/__tests__/posthog.test.ts` renamed `initPostHog`→`initTelemetry` and added
  contract coverage (forward args, non-Error wrap, never-throw-on-SDK-throw, pageview
  shape) for all four exports (+7 tests). `backend.test.ts` mock switched to
  `{ safeCaptureException }`; its "defensive throw" case re-pointed to the contract
  boundary (soft-fail still returns `{data:null}` and routes through `safeCaptureException`)
  since the never-throw guarantee now lives in and is tested by the adapter.
  `live-updates-listener.test.ts` switched from spying on the raw export to mocking the
  `safeCapture`/`safeCaptureException` contract (same asserted call args).

### Verified
- `npx tsc --noEmit`: clean.
- `npm run test:run`: 269 files / 3670 tests passing (269/3663 baseline + 7 new adapter
  contract tests; no tests lost). Known pre-existing jsdom `_location` noise unchanged.
- `npm run build`: succeeds.
- Focused: `posthog.test.ts`, `store.test.ts`, `csp-violation-reporter.test.ts`,
  `backend.test.ts`, `live-updates-listener.test.ts` — 5 files / 70 tests pass.
- Acceptance grep `grep -rn "posthog-js" app src lib --include="*.ts*"` hits only
  `lib/posthog.ts` and `lib/__tests__/posthog.test.ts` (the adapter's own test mocks the
  SDK — allowed per spec). No raw `posthog` export remains; zero `PHProvider`/`usePostHog`.

### Invariants (all hold)
- Telemetry never throws into app code — every capture wrapped in the adapter; init
  no-ops without `NEXT_PUBLIC_POSTHOG_KEY` (and on server / when already loaded).
- Pageview unchanged — `safeCapturePageview` emits `$pageview` with `$current_url`.
- RTK error-middleware semantics untouched — `lib/store.ts` not modified.
- CSP reporter installed exactly once — `installCspViolationReporter`'s `installed` flag
  and its single call site (the provider effect) are unchanged.

### Deviations
- Provider **renamed** to `TelemetryProvider` (spec allowed it "if churn stays small";
  the only importer was `app/layout.tsx`). This entailed the one-word comment update in
  `lib/csp-violation-reporter.ts` to keep the reference accurate.
- Two test files outside the primary edit set were updated because they referenced the
  removed raw `posthog` export (`backend.test.ts`, `live-updates-listener.test.ts`) —
  necessary consequence of the contract change, not opportunistic cleanup; no assertions
  weakened.
- All four named exports have live consumers, so none were dropped.

### Independent review (fresh-context, Opus)

All eight areas CONFIRMED-SAFE; no blocking issues, no code changes required. Notable
verifications: the adapter's try boundary covers argument wrapping and every SDK path
(so dropping backend.ts's local try/catch adds no new throw exposure — the same
property reads already ran unguarded in pre-existing code); `global-error.tsx` calling
the adapter outside the provider tree is strictly safer than the old unguarded raw
call; pageview/init are byte-parity; zero `posthog-js/react` context consumers existed.

Two standing advisories (accepted design, no action):
1. The never-throw guarantee's owner is now the adapter, not call sites — callers must
   keep passing trivially-safe arguments (true for both current call sites).
2. The backend boundary's throwing-capture case is proven transitively (adapter
   never-throws test against the real implementation + backend routes-through-adapter
   test) rather than in a single end-to-end test.
