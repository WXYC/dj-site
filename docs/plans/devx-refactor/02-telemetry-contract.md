# S2 — telemetry-contract

Status: pending · Risk: risky (Opus) · PR: —

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
