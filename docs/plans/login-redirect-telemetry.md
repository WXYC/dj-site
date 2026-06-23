# Plan: Make the post-login redirect decision observable in PostHog

## Context

DJs report intermittently not landing on the dashboard after a successful login. The post-login redirect decision lives in `src/hooks/authenticationHooks.ts` and is **duplicated** across the two login paths:

- `useLogin.handleLogin` (password / email) — `authenticationHooks.ts:55-64`
- `useOTPVerify.handleVerifyOTP` (one-time code) — `authenticationHooks.ts:140-148`

Both run the same branch after a successful `signIn`:

```ts
const dashboardHome = String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || "/dashboard/catalog");
const user = (result as any).data?.user;
if (user && user.hasCompletedOnboarding === false) {
  router.push("/login?incomplete=true");   // <-- DJ does NOT reach the dashboard
} else {
  router.push(dashboardHome);
}
router.refresh();
```

A third site, `useNewUser.handleNewUser` (`authenticationHooks.ts:316-319`), redirects to the dashboard unconditionally after onboarding completion.

The login *succeeds* in the failing case — nothing throws — so the redirect-to-incomplete outcome is **invisible to every error-reporting path** we have:

- There is **no Sentry** in dj-site (not in `package.json`, no config, no references). PostHog is the wired observability tool.
- PostHog auto-captures exceptions (`capture_exceptions: true` in `lib/posthog.ts`, plus `app/global-error.tsx` → `posthog.captureException`). A successful-but-misrouted login throws nothing, so none of that sees it.
- The Playwright E2E suite (`e2e/tests/auth/login.spec.ts`) only exercises the happy path with seed users that have already completed onboarding, so it cannot surface a regression where a genuinely-onboarded DJ is misrouted.

We therefore cannot today answer: *how often does a successful login land on `/login?incomplete=true` instead of the dashboard, and is it because `hasCompletedOnboarding` is genuinely `false` or because the flag arrived `undefined`/`null`?*

## Goals

1. Emit a PostHog event on every successful login that records **where the user was sent** and **why**, so the incomplete-redirect rate is measurable and alertable.
2. Distinguish the three flag states the branch can see — `false`, `true`, and absent (`undefined`/`null`) — so we can tell a genuinely-incomplete account from a flag-population bug.
3. Remove the duplicated redirect branch by routing all **three** post-auth paths — password login, OTP login, and onboarding completion — through one helper, so instrumentation cannot drift between them.
4. Cover the new behaviour with unit tests that match the existing `authenticationHooks.test.ts` patterns.

## Non-goals

- **Not** changing any redirect behaviour. URLs pushed must be byte-identical to today; this PR is observability only.
- **Not** adding Sentry. (Separate initiative if we later want frontend crash monitoring; out of scope here.)
- **Not** fixing the underlying redirect bug. The telemetry exists to confirm the cause first; the fix is a follow-up gated on what the data shows.
- **Not** introducing global `posthog.identify()`. dj-site currently emits only anonymous (device-keyed) events; calling `identify()` would change identity/attribution semantics for *all* events and merge anonymous→identified profiles. That is a product-analytics decision beyond this bug. We attach an opaque `user_id` **event property** instead (see below) and defer `identify()` to a separate ticket.

## Root-cause framing (what the data will disambiguate)

| Observed in event | Interpretation |
|---|---|
| `destination=incomplete`, `has_completed_onboarding=false` | Account genuinely flagged incomplete — expected for true new users; a spike among established DJs means onboarding state is being reset upstream. |
| `destination=dashboard`, `has_completed_onboarding=null` | Flag absent from the session payload; today's `=== false` check sends these to the dashboard (backward-compat). If reports persist while this dominates, the bug is elsewhere (not the onboarding gate). |
| `destination=incomplete` rate rising over time | Regression in how `hasCompletedOnboarding` is populated/persisted by Backend-Service. |

## Design

### 1. One redirect helper, defined in `authenticationHooks.ts`

A module-local helper that both login hooks and the onboarding hook call. It performs the redirect **and** the capture together, so the two can never diverge:

```ts
import { safeCapture } from "@/lib/posthog";

/** Observable login/onboarding events (distinct from auth-client errors). */
const LOGIN_EVENTS = {
  /** A login/verification/onboarding succeeded; records where the user was sent. */
  POST_LOGIN_REDIRECT: "login_post_redirect",
} as const;

type LoginMethod = "password" | "otp" | "onboarding";

/**
 * Send a freshly-authenticated user to the right place and record the choice.
 *
 * Emits one `login_post_redirect` event with a `destination` discriminator so a
 * PostHog breakdown shows the share of successful logins bounced to the
 * incomplete screen vs. the dashboard. Captures the RAW onboarding flag
 * (incl. null when absent) so a complete DJ misrouted because the flag came
 * back undefined is distinguishable from a genuinely-incomplete account.
 *
 * Redirect targets are byte-identical to the prior inline branch.
 */
function redirectAfterAuth(
  router: { push: (href: string) => void; refresh: () => void },
  user: { id?: string; hasCompletedOnboarding?: boolean } | undefined,
  method: LoginMethod,
): void {
  const dashboardHome = String(
    process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || "/dashboard/catalog",
  );
  const incomplete = user?.hasCompletedOnboarding === false;

  safeCapture(LOGIN_EVENTS.POST_LOGIN_REDIRECT, {
    method,
    destination: incomplete ? "incomplete" : "dashboard",
    has_completed_onboarding: user?.hasCompletedOnboarding ?? null,
    user_id: user?.id ?? null,
  });

  router.push(incomplete ? "/login?incomplete=true" : dashboardHome);
  router.refresh();
}
```

Notes:
- The `router` parameter is typed structurally (`push`/`refresh`) rather than against `useRouter`'s return type, so the helper stays a plain function and the existing test's `{ push, refresh }` mock satisfies it directly.
- `safeCapture` already swallows errors when PostHog is uninitialised (SSR/tests), so no try/catch at the call site and no test crash when the module is unmocked.

### 2. Call-site changes

Each site collapses to a single call. The `toast.success(...)` lines stay exactly where they are.

- **`handleLogin`** (`:55-64`): replace the inline `dashboardHome` + branch + `router.refresh()` with `redirectAfterAuth(router, user, "password");`.
- **`handleVerifyOTP`** (`:140-148`): same, with `"otp"`.
- **`handleNewUser`** (`:316-319`): replace the unconditional dashboard push + refresh with `redirectAfterAuth(router, { id: session.data.user.id, hasCompletedOnboarding: true }, "onboarding");`. The user id is already in scope from the `getSession()` guard at `:285-288`. This both removes the last duplicated `dashboardHome` literal and lets us confirm onboarding completion actually reaches the dashboard (a `destination=incomplete` with `method=onboarding` would be an immediate red flag).

After this change, the `NEXT_PUBLIC_DASHBOARD_HOME_PAGE` default and the `/login?incomplete=true` literal exist in exactly one place.

### 3. Event schema

Single event, discriminated by `destination`. One PostHog breakdown then yields the incomplete-bounce rate against its own denominator — cleaner than separate event names (the `SSE_EVENTS` set uses distinct names because those are different lifecycle moments, not two branches of one decision).

| Property | Type | Example | Purpose |
|---|---|---|---|
| `method` | `"password" \| "otp" \| "onboarding"` | `"password"` | Which auth path produced the redirect. |
| `destination` | `"dashboard" \| "incomplete"` | `"incomplete"` | The outcome to break down / alert on. |
| `has_completed_onboarding` | `boolean \| null` | `false` | Raw flag, `null` when absent — separates flag-population bugs from real incompletes. |
| `user_id` | `string \| null` | `"usr_abc123"` | Opaque better-auth id to correlate a report to a DJ. **No** email/realName/djName. |

Event name: `login_post_redirect` (snake_case, matching the `sse_*` convention in `live-updates-listener.ts`).

## Privacy

- Event properties carry only the opaque better-auth `user_id`. No email, real name, or DJ name is attached.
- We deliberately do **not** call `posthog.identify()` (see Non-goals) — the `user_id` property is sufficient to group occurrences for a single DJ without changing global identity semantics.

## Testing

Extend `src/hooks/authenticationHooks.test.ts` (do not create a new file). The existing suite already mocks `next/navigation`, `sonner`, and `@/lib/features/authentication/client`, and already has the three flag-state cases for `handleLogin`. Add a mock for `@/lib/posthog` and assert the event.

Add the mock at the **top level** of the file, alongside the existing `vi.mock` blocks for `next/navigation`/`sonner`/the auth client (not inside `beforeEach`). The existing `vi.clearAllMocks()` in `beforeEach` (`:83`) already resets the spy between cases.

```ts
const mockSafeCapture = vi.fn();
vi.mock("@/lib/posthog", () => ({
  safeCapture: (...args: any[]) => mockSafeCapture(...args),
}));
```

Cases to add (red first, then implement):

1. **`handleLogin`, flag `false`** → `safeCapture("login_post_redirect", { method: "password", destination: "incomplete", has_completed_onboarding: false, user_id: "user-1" })`. (The existing test already asserts `mockPush` to `/login?incomplete=true`; the new assertion sits alongside it — verifying behaviour is unchanged.)
2. **`handleLogin`, flag `true`** → `destination: "dashboard"`, `has_completed_onboarding: true`.
3. **`handleLogin`, flag absent** → `destination: "dashboard"`, `has_completed_onboarding: null`.
4. **`handleVerifyOTP`, flag `false`** → `method: "otp"`, `destination: "incomplete"`.
5. **`handleNewUser` success** → `method: "onboarding"`, `destination: "dashboard"`, `has_completed_onboarding: true`. **Also assert `expect(mockPush).toHaveBeenCalledWith("/dashboard/flowsheet")`** (the `beforeEach` sets `NEXT_PUBLIC_DASHBOARD_HOME_PAGE = "/dashboard/flowsheet"`). Note: the existing `useNewUser` suite (`authenticationHooks.test.ts:282-420`) asserts only `updateUser`/ordering and never pins the redirect — routing it through the helper is the moment we add that missing regression guard, so the push assertion is new, not a duplicate.
6. **Regression guard:** the three existing `handleLogin` `mockPush` assertions must still pass unchanged — redirect targets are identical.

**Decision — no onboarding-`false` case.** An earlier draft proposed a `handleNewUser` + flag-`false` "contract-violation" case for symmetry. We drop it: `handleNewUser` always calls the helper with a synthetic `{ hasCompletedOnboarding: true }`, so that state is **unreachable through the hook**, and the helper's `incomplete` branch is already fully exercised by cases 1–3 (the branch is identical regardless of `method`). Adding it would require exporting `redirectAfterAuth` purely to test an impossible input — net-negative. Keep `redirectAfterAuth` module-private; cases 1–5 cover every reachable state.

All assertions follow the existing `await act(async () => { ... })` + `expect(mock...).toHaveBeenCalledWith(...)` shape. No new harness.

## PostHog dashboard & alert (out-of-repo, documented in PR)

Configured in the PostHog project, not the codebase — captured here so the PR description carries the follow-through:

1. **Insight:** trend of `login_post_redirect`, broken down by `destination`; secondary breakdown by `has_completed_onboarding` to split `false` from `null`.
2. **Alert:** fire when `login_post_redirect` with `destination=incomplete` exceeds a baseline over a rolling window — early warning instead of waiting on DJ reports.

## Rollout

- No env var, no feature flag. The event fires whenever PostHog is initialised; in environments without `NEXT_PUBLIC_POSTHOG_KEY`, `initPostHog` is a no-op and `safeCapture` swallows — zero behavioural effect.
- No backend change. Reads only the `user` object already returned by `signIn`/`getSession`.
- The `/dashboard/catalog` fallback in the helper preserves today's behaviour exactly. In production `NEXT_PUBLIC_DASHBOARD_HOME_PAGE` is always set, so the fallback is unreachable there; it exists only so the helper degrades safely if the var is ever missing (and so the unit suite can pin a deterministic target via `beforeEach`).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Refactor accidentally changes a redirect target | Keep the three existing `mockPush` assertions; they pin the URLs. Helper centralises the literals so there is one source of truth. |
| Event volume / cost | One event per successful login — negligible against existing pageview/exception volume. |
| PII leakage into analytics | Schema is fixed to opaque `user_id` only; reviewer can confirm no email/name fields. |
| `safeCapture` throwing in SSR/tests | Already guarded inside `lib/posthog.ts`; helper adds no new throw surface. |

## Acceptance criteria

- [ ] Both login paths and onboarding completion route through `redirectAfterAuth`; no duplicated `dashboardHome`/incomplete-URL literals remain.
- [ ] A successful login emits exactly one `login_post_redirect` event with the schema above.
- [ ] `destination` is `incomplete` iff `hasCompletedOnboarding === false`; `has_completed_onboarding` reflects the raw value (`false`/`true`/`null`).
- [ ] Redirect URLs are unchanged (existing `mockPush` assertions pass).
- [ ] New unit tests (cases 1–6) pass; `npm test` and `tsc --noEmit` are green locally.
- [ ] PR description documents the PostHog insight + alert to be created.

## Files changed

| File | Change |
|---|---|
| `src/hooks/authenticationHooks.ts` | Add `LOGIN_EVENTS` const + `redirectAfterAuth` helper; route `handleLogin`, `handleVerifyOTP`, `handleNewUser` through it; import `safeCapture`. |
| `src/hooks/authenticationHooks.test.ts` | Mock `@/lib/posthog`; add cases 1–6; keep existing redirect assertions. |

## Out of scope / follow-ups

- Global `posthog.identify()` on login (separate ticket — identity-semantics decision).
- `login_failed` event on the `result.error` branch to give the funnel a true attempt-level denominator.
- The actual redirect-logic fix, once telemetry confirms the dominant failure mode.
- E2E coverage of the incomplete-redirect branch (seed an un-onboarded user).
