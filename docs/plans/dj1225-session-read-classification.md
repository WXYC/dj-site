# dj-site#1225 — Distinguish a failed session read from an absent session

Issue: https://github.com/WXYC/dj-site/issues/1225
Companion: https://github.com/WXYC/Backend-Service/issues/2169 (independent; neither blocks the other)
Branch: `fix/dj1225-session-read-classification`

## Problem

`getServerSession` treats every non-`data` outcome as "no session", so a transient auth-server problem signs a DJ out mid-render instead of surfacing as an error. `requireAuth` turns that into `redirect("/login?bounced=no-session")` — not an error, not a retry, just a logout.

BS#2169 documents the live trigger: `/auth/get-session` 429s in bursts (2,128 on Aug 13 = 14.1% of that day's requests, running straight through the browser-traffic peak).

## Two corrections to the issue

Both verified in source during planning. Both change what gets built.

### 1. A 429 does not reach the `.catch`

The issue says:

> Every one of those 429s took this `.catch` branch.

They did not. `better-auth/client` fetches through `@better-fetch/fetch@1.3.1`, which **does not throw on HTTP error status** unless `options.throw` is set — and `serverAuthClient` (`lib/features/authentication/server-client.ts`) does not set it. `node_modules/@better-fetch/fetch/dist/index.js:726-736`:

```js
if (options?.throw) { throw new BetterFetchError(response.status, response.statusText, ...); }
return { data: null, error: { ...errorObject, status: response.status, statusText: response.statusText } };
```

A 429 **resolves** as `{ data: null, error: { status: 429, statusText: "Too Many Requests", message: "Too many requests. Please try again later." } }`. The `.catch` in `session-cache.ts:44-47` fires only on genuine transport failure (DNS, TLS, ECONNREFUSED, abort/timeout) and on `ValidationError`.

**Consequence: editing the `.catch` fixes nothing for the 429 case.** The fix belongs in `getServerSession`, which checks only `!session.data` and never reads `session.error`. The issue is right that the error object is already preserved — it is, and it already carries `status`. It just needs reading.

This is also convenient for the "don't reintroduce noisy Next.js errors" constraint: the 429 path never touches the `.catch`, so that constraint is satisfied without modifying it at all.

### 2. Retry is wrong for 429 — and better-fetch's native `retry` cannot do the case we want

The issue offers retry as option 2, reasoning that "the underlying condition is transient and short-lived (the limiter's bucket clears ~10 s after the last allowed request)." That is exactly why retry fails here.

Verified in `better-auth@1.6.26` (`dist/api/rate-limiter/index.mjs:26-61, 251-268`): `decideConsume`'s denied branch returns `next: data` **unchanged**, and the memory store writes `expiresAt` back **only when allowed**. Denied requests do not advance the clock. During a burst the key stays live for the full ~10 s window, so a retry at 1–2 s just 429s again; actually clearing it means blocking the RSC render for up to 10 s, which is worse than a bounce.

Retry *is* correct for the transport class, where one immediate retry is cheap and likely to succeed. So the rule is sharper than "1 + 2": **retry on transport failure, never on 429.**

**But native `retry` is inverted relative to that rule and cannot implement it.** In `@better-fetch/fetch@1.3.1`, `let response = await fetch(context.url, context)` (`dist/index.js:628`) has **no try/catch anywhere in the `betterFetch` body** — verified across lines 592–740, the only `try` in the file's fetch path is the opt-in `catchAllError` wrapper in `createFetch` (`:504-517`), which neither `better-auth`'s client config nor `serverAuthClient` sets. So:

- **Transport rejections** (DNS, TLS, ECONNREFUSED, abort) propagate straight out of `betterFetch`, past the retry block, into our `.catch` — the retry block never sees them.
- The retry block (`:710-724`) sits exclusively in the non-ok **response** branch, so the only class it can act on is HTTP status — the class we explicitly exclude.

Native `retry` is therefore the wrong tool in both directions. The transport retry must be written explicitly around the `serverAuthClient.getSession(...)` call inside `getSessionCached` — still inside the memoized promise, so the `cache()` dedup constraint still holds, just not for free.

## The chosen UX cannot be built by throwing

**Decision: on a failed read, keep the DJ in place and offer a retry — do not redirect.** The cookie is valid; bouncing a DJ to `/login` mid-show while they are logging a flowsheet is the actual harm.

The obvious implementation — throw a typed error from `requireAuth()` and catch it in `app/dashboard/error.tsx` — **does not work**, and this repo already documents why, twice:

`app/dashboard/error.tsx:7-8`
> error.tsx does not wrap this segment's own layout.tsx (requireAuth()'s await lives there and **still falls through to app/global-error.tsx**), only page.js/nested layout.js below it.

`app/dashboard/loading.tsx:1-2` makes the same point for `loading.js`.

`requireAuth()` is awaited in `app/dashboard/layout.tsx:11` — the segment's own layout. A throw there escapes every styled boundary and lands in `app/global-error.tsx`, a bare unstyled `<html><body><h2>Something went wrong</h2>` that replaces the root shell. That is strictly worse than today's redirect.

**Build it by rendering, not throwing.** The layout already `await`s; it branches instead:

```tsx
const Layout = async (props: ThemedLayoutProps): Promise<JSX.Element> => {
  const gate = await resolveAuthGate();
  if (!gate.ok) return <SessionUnavailable status={gate.status} />;
  const themed = await ThemedLayout(props);
  return <StoreProvider>{themed}</StoreProvider>;
};
```

This sidesteps the Next.js constraint entirely, adds no `error.tsx`, keeps the root shell and the URL, and leaves the cookie untouched. The dashboard layout gate runs first on every dashboard route, so one branch covers both the `@classic` and `@modern` slots.

Page-level `requireAuth()` calls (`@modern/admin/roster`, `@modern/admin/catalog`, `@classic/library`, `@classic/library/artist/new`, `@classic/library/missing`, `Leftbar`) keep their current signature and keep redirecting.

**What protects them is structural, not memoization.** A layout that returns `<SessionUnavailable />` never puts `props.classic` / `props.modern` / `props.information` in its returned tree, so those subtrees are never rendered and their gates never run. Memoization would in fact work *against* us here: the page would get the same `unavailable` read, `getServerSession()` would return null, and `server-utils.ts:45-47` would fire `redirect("/login?bounced=no-session")` — overriding the layout's notice and reproducing the exact harm this plan exists to prevent. The integration test below must **prove** the slots are never rendered rather than assume it.

**There are three slots, not two.** `src/ThemedLayout.tsx:5-12` declares `classic`, `modern`, and `information`; the last renders the permalinkable album-detail modal (dj-site#979) and `app/dashboard/@information/album/legacy/[legacyId]/page.tsx:19-20` documents in-file that it depends on the dashboard `requireAuth()` gate. It is `?`-optional because the login layout shares the shape.

### `getServerSession()` callers outside the dashboard gate

The structural argument above covers only the dashboard tree. `getServerSession()` has four further callers that it does **not** reach, and each deliberately stays on the null path:

| Caller | Behavior on null | Verdict on `unavailable` |
|---|---|---|
| `lib/features/session-guards.ts:73` (`guardAppStateMutation`) | returns `forbidden()` | **Fail closed — correct.** During a 429 burst every experience/theme switch 403s. That is the right call for a mutation guard, but it is a real second symptom of the same outage and should be named in the issue rather than discovered later. |
| `app/page.tsx:18` | renders the public landing page signed-out | Benign. |
| `app/login/@modern/layout.tsx:24` | renders the login page | Benign — the DJ is already at `/login`. |
| `app/login/@modern/@normal/page.tsx:42` | renders the normal login form | Benign, same reason. |

None of these change in this PR. They are listed so the next reader does not assume the layout branch covers them.

## Implementation

### 1. Widen the error type

`lib/features/authentication/utilities.ts:54-60`. Today:

```ts
export type BetterAuthSessionResponse = {
  data: BetterAuthSession | null;
  error?: { message: string; code?: string };
};
```

`status` is absent, so the 429 is not discriminable at all. The shape is also a lie on the `.catch` path, where a bare `Error` is cast into it (an `Error` has `message` but no `code`). Widen to carry `status?: number` and `statusText?: string`, and model the catch path honestly.

### 2. Classify at the seam

**Put the pure classifier in `lib/features/authentication/utilities.ts`**, which already owns `BetterAuthSessionResponse` (lines 54-60) — not in `server-utils.ts`. Step 6 needs the same classification inside `lib/features/session.ts`, which today imports only `session-cache.ts` and `utilities.ts` and deliberately avoids `server-utils.ts` and its `redirect` / `cookies` surface. Siting the classifier beside its type keeps that boundary intact and lets it unit-test with no `next/headers` mocks.

**Extract the reads into a new `lib/features/authentication/server-session.ts`** — `getServerSession` and the new `getServerSessionResult` — leaving `server-utils.ts` owning the gates. This resolves a pre-existing orphan: `tests/unit/lib/features/authentication/server-session.test.ts` mirrors no source file today, and `docs/testing.md:242` requires tests to mirror the path of what they cover. Deleting the duplicated `getServerSession` block from `server-utils.test.ts` (see Testing) would otherwise cement that orphan. Since this plan is already removing duplication here, extracting the module is the smaller net change than leaving two files asserting one contract.

The module then adds a discriminated result and keeps the existing narrow accessor:

```ts
type SessionReadResult =
  | { kind: "session"; session: BetterAuthSession }
  | { kind: "absent" }                                  // resolved, data: null, no error
  | { kind: "unavailable"; status?: number };            // 429 | 5xx | transport failure

export async function getServerSessionResult(): Promise<SessionReadResult>
```

`getServerSession()` stays as a thin wrapper returning `BetterAuthSession | null` (null for both `absent` and `unavailable`), so every existing caller is behaviorally unchanged. Only the callers that opt into the new function see the distinction.

Classification: `data` present → `session`. Error with `status` 429 or ≥500 → `unavailable`. **Transport failure → `unavailable`, identified by an explicit tag, never by an absent `status`.** Everything else — clean `data: null`, 401/403, and any status-less error — → `absent`.

**Do not infer "transport" from a missing `status`.** `server-session.test.ts:123-132` already pins a status-less, non-transport shape: `{ data: null, error: { message: "Session expired", code: "SESSION_EXPIRED" } }`. Classifying on absent-`status` would render `SessionUnavailable` — with a retry button that can never succeed — for a genuinely expired session, which is the *inverse* of the harm this plan exists to prevent, and it would slip past a matrix that only tests status-bearing errors.

Instead, tag the transport case where it is synthesized: the `.catch` at `session-cache.ts:44-47` is the only place that knows the fetch rejected, so it stamps a discriminant on the error it builds. That is the same work step 1 already calls for under "model the catch path honestly" — an `Error` cast into `{ message, code }` is a lie precisely because the shape can't say "this never reached the server." Classify on the tag.

### 3. Gate function for the layout

`resolveAuthGate(): Promise<{ ok: true; session } | { ok: false; status?: number }>`, in `server-utils.ts` alongside the other gates.

**Named `resolve*`, deliberately not `requireAuthOrUnavailable`.** `server-utils.ts:92-93` documents `checkRole` as the "Non-redirecting permission check" against `requireRole` / `requireAuth`, which always redirect. A `require*`-prefixed function that returns `{ ok: false }` instead of redirecting would invert that contract at the one function guarding every dashboard route — the worst possible place for a misleading name. `requireAuth` stays the only `require*` in the module.

On `absent` it redirects exactly as `requireAuth` does today (`/login?bounced=no-session`), and it keeps the existing `email-not-verified` and `incomplete` exits. On `unavailable` it returns `{ ok: false }` for the layout to render. `requireAuth()` remains for page-level callers, implemented in terms of it.

### 4. `SessionUnavailable` component

**File: `app/dashboard/SessionUnavailable.tsx`**, colocated with its only consumer (`app/dashboard/layout.tsx`) and beside the new `layout.test.tsx`. The two real precedents for a route-scoped, user-facing failure notice are both colocated under `app/`: `app/dashboard/error.tsx` and `app/login/SessionEndedNotice.tsx` — not `src/components/shared/`, whose residents (`PageTitleUpdater.tsx`, `SSEConnectionIndicator.tsx`, `TelemetryProvider.tsx`) are app-wide invisible sync/provider components.

CLAUDE.md's two-experience rule puts UI under `src/components/experiences/{classic,modern}`, but **this component deliberately skips the split**, following the `app/dashboard/error.tsx` precedent: a single Joy-styled failure surface serving both experiences. Worth stating because the DJ's experience *is* still resolvable on this path — `createServerSideProps` reads `application.experience` from the `app_state` cookie independently of the session — so a classic DJ will see modern styling here. That is intentional, and matches what they already get from `app/dashboard/error.tsx`.

Two affordances, not one: a **retry** button calling `router.refresh()`, and a secondary **"Sign in again"** link to `/login`. Emits one PostHog event on mount (step 7).

The second link is a deliberate escape hatch. The layout branch replaces the entire dashboard subtree before `StoreProvider` (`app/dashboard/layout.tsx:13`), so there is no Leftbar and no nav — a lone retry button is a dead end if the classification is ever wrong about a failure being transient. `app/dashboard/error.tsx:40` gets away with a lone "Try again" because `reset()` targets a genuinely resettable render error; here a misclassified permanent auth failure would trap the DJ. With the link, a misclassification degrades to today's behavior instead.

**It must use `useRouter` + `safeCapture` and nothing else** — no `useAppSelector`, no RTK Query hooks.

The reason is subtler than "no store": `app/layout.tsx:55` wraps every route in `PublicStoreProvider`, which does supply a `<Provider>` (`src/PublicStoreProvider.tsx:31`), so nothing crashes for want of one. The hazard runs the *other* way. The layout branch returns before `StoreProvider` (`app/dashboard/layout.tsx:13`), so in production **only public-store state is available**, while `renderWithProviders` seeds `makeStore()` — the full dashboard store (`tests/helpers/render.tsx:55`). A component reading a dashboard-only slice would therefore resolve cleanly in both integration tests and read `undefined` (or throw, on a dashboard RTK Query hook) on the real route. Keep the restriction; state it this way in the component comment, because the wrong rationale would ship into the file.

Joy styling is safe — `ThemeRegistry` comes from the root layout (`app/layout.tsx:57`).

Copy can state plainly that the server was unreachable and the DJ has not been signed out — step 6 confirms nothing in the surrounding chrome contradicts it.

### 5. Transport-only retry — written explicitly

Per Correction 2, better-fetch's native `retry` cannot see transport rejections and only acts on the HTTP-status class we exclude. Write the retry explicitly in `lib/features/authentication/session-cache.ts`, wrapping the `serverAuthClient.getSession(...)` call *inside* the memoized function so the `cache()` dedup constraint still holds: one attempt, short fixed delay, on rejection only. Leave the `.catch` and its comment in place as the terminal handler.

If native `retry` is kept for anything, scope it honestly to 5xx — `retry: { type: "linear", attempts: 1, delay: 250, shouldRetry: (r) => r !== null && r.status >= 500 }` — and never to 429.

**Make the delay injectable — at module scope, never as a `getSessionCached` parameter.** Three existing tests `mockRejectedValue` on `getSession` after this PR's deletions — `server-session.test.ts:58`, `session-cache.test.ts:52`, `session.test.ts:164` (a fourth at `server-utils.test.ts:111` sits inside the `describe("getServerSession")` block the Testing section deletes wholesale). Each would now make two calls and wait the real delay, and none of those files use fake timers (`vi.useFakeTimers` appears only under `tests/unit/lib/features/flowsheet/`). An injectable delay is less invasive than retrofitting fake timers.

But it must be an exported module-scope constant or a once-read env value — **not a second argument**. `getSessionCached` is `cache((cookieHeader: string) => …)` (`session-cache.ts:36`), and that file's own doc comment (`:30-34`) warns that every argument is part of the memo key: a delay parameter defaulted differently by the two call sites (`server-utils.ts:16`, `session.ts:53`) would silently split the key and reintroduce exactly the extra round-trip this file exists to eliminate.

**`session-cache.test.ts:50-57` gets rewritten, not merely re-confirmed.** An earlier draft said to check that `expect(result).toEqual({ data: null, error })` still holds — it cannot. That assertion compares against the exact `Error` instance the test constructs at `:51`, and step 2 requires the `.catch` to stamp a transport discriminant on the error it builds. Rewrite it to assert the new tagged shape, and **pin the tag there**: that test is the only place the transport discriminant's wire shape is fixed, and `utilities.test.ts`'s classifier matrix consumes it.

**The retry also redefines the `auth.getSession` server-timing phase.** The call sits inside `measure("auth.getSession", …)` (`session-cache.ts:37`), so on the retry path that phase would report two round trips plus the delay as a single number — silently changing the meaning of the `[server_timing]` logs the seam's own comment block advertises (`session-cache.ts:19-20`). Either measure per attempt, or extend the comment at `session-cache.ts:7-35`, which is where this file's non-obvious constraints already live.

### 6. The second caller, and the appbar contradiction

`lib/features/session.ts:53` calls `getSessionCached`; the `session.data` branch is line 55. `createServerSideProps` branches on `data` only, so today it renders the whole shell logged-out on a 429. It is called from `app/layout.tsx:45` — the **root** layout — so it must **not** throw: a root-layout error goes to `global-error.tsx`. **Keep it failing soft to `defaultAuthenticationData`, unchanged.** The only addition is a `console.warn` on the `unavailable` classification, alongside the existing one at `session.ts:91`, so the root-layout occurrence leaves a trace; no shape change, no new union member.

**There is no appbar contradiction — do not build one.** An earlier draft of this plan called for threading the classification into `AppbarWrapper` so the appbar wouldn't render signed-out chrome around the notice. **That was wrong, and verifying it is why it isn't in the plan.** Neither appbar reads session state: `AppbarWrapper` (`src/components/shared/Theme/AppbarWrapper.tsx:16`) receives only `experience`, and the sole auth-ish affordance — the "Log In" link at `Appbar.tsx:46` and `AppbarClassic.tsx:47` — is gated on `usePublicRoutes()`, a **pathname** check against `["/live", "/login"]` plus `/` (`src/hooks/usePublicRoutes.ts:9,15`). On any `/dashboard/*` render that is false, so there is no signed-out appbar and no user menu to contradict anything. Both appbars render feedback links and theme controls regardless of session.

No `AuthenticationData` union extension, no appbar branch, no appbar tests. The `SessionUnavailable` copy can stand on its own.

**The one real `unavailable` effect here is cosmetic**: the appSkin override at `lib/features/session.ts:98-106` sits inside the `if (session.data)` branch, so on a failed read it does not apply and `appState` keeps whatever the `app_state` cookie says. A DJ whose account appSkin disagrees with their cookie would render in the cookie's experience/theme for that request — a transient inversion of the documented "account beats cookie" precedence. Not worth special handling; noted so it isn't mistaken for a regression.

The other `createServerSideProps` call sites (`app/dashboard/@modern/default.tsx`, `@classic/default.tsx`, `src/ThemedLayout.tsx`, the login `@newuser` pages) sit under gates that have already run, so they need no change.

### 7. Telemetry

`LoginBounceTelemetry` forwards whatever `bounced` value it finds, so it needs no change if a new reason is ever added there. But under this design the unavailable case **no longer redirects**, so the signal has to come from `SessionUnavailable` itself — a distinct PostHog event (`session_unavailable`) with the status as a property.

Emit through `safeCapture` from `lib/posthog.ts`, per CLAUDE.md's adapter rule, mirroring `app/login/LoginBounceTelemetry.tsx:36`.

Keep event volume in mind: this fires per affected render, and the org has a history of analytics quota blowouts. One event on mount, no repeats on re-render — mirror the `useRef` guard both `LoginBounceTelemetry` and `SessionEndedNotice` already use.

**Document the event in the component's own doc comment**, mirroring how `LoginBounceTelemetry.tsx:7-23` carries the `login_server_bounce` contract inline. Per CLAUDE.md's comment rule, state the contract self-contained — no issue or PR numbers in the comment.

**Also add a line to `docs/architecture.md`.** Lines 101-103 document the server-side authority model ("Page authority is **server-side** (`requireAuth` + `requireRole` in the page component)"), and this plan changes the single gate in front of every dashboard route from unconditional-redirect to conditional-render, plus introduces the three-way read. Neither is captured anywhere but the code otherwise. No `docs/testing.md` change needed — the new tests use existing harnesses. An earlier draft pointed at `docs/plans/login-redirect-telemetry.md:119` as a committed schema to extend — **it isn't**: that section defines `login_post_redirect` ("Event name: `login_post_redirect`"), and `login_server_bounce` appears nowhere under `docs/`. There is no committed schema for this surface, so adding `session_unavailable` to an unrelated shipped design doc would *create* a split rather than avoid one.

`SessionEndedNotice` is scoped strictly to `bounced === "no-session"` and stays that way — the unavailable case now has its own surface and must not also toast "Your session has ended," which would be false.

Note for the issue's telemetry AC: `middleware.ts`'s competing `bounced=no-session` is narrower than the issue assumes. Its matcher is `["/dashboard/admin/:path*"]`, so that conflation only affects admin routes; the overwhelming majority of `bounced=no-session` already comes from `requireAuth`.

## Testing

Route each test to its owning file.

**Mind the mock asymmetry.** Only `session-cache.test.ts:8-11` and `tests/unit/lib/features/session.test.ts:8` identity-mock React `cache()`. `server-session.test.ts` and `server-utils.test.ts` mock `server-only`, `next/headers`, `next/navigation` and `server-client` only — they run through the real `cache()`. That is benign today (React 19's `cache` is a pass-through outside a render), but step 5 puts **retry state inside the memoized function** and tests 4-6 land in `server-session.test.ts`. Add the identity mock to those two files rather than relying on the pass-through.

**`tests/unit/lib/features/authentication/session-cache.test.ts`** — the seam itself:

1. **The AC1 test.** `getSession` resolving `{ data: null, error: { status: 429 } }` produces a *different* outcome from `{ data: null }` with no error. The regression guard for the whole issue.
2. A rejected `getSession` (transport) → `unavailable`, not `absent`.
3. The explicit transport retry fires once on rejection, and **not at all** on a resolved 429 (assert the mocked client call count).

**`tests/unit/lib/features/authentication/utilities.test.ts`** — **the owning file for the pure classifier**, mirroring its home per `docs/testing.md:242`. This file already exists and contains zero `vi.mock` calls, which is exactly the benefit step 2 sites the classifier in `utilities.ts` to get; routing these into a file that mocks `next/headers` would discard it. Write them as one `it.each` status matrix:

4. The status matrix: 429 → `unavailable`; 5xx → `unavailable`; **transport-tagged error → `unavailable`**; **401/403 → `absent`** (these genuinely mean "no valid session" and must keep redirecting); **status-less error carrying a `code` (the `SESSION_EXPIRED` shape) → `absent`** — the regression guard for the misclassification described in step 2; clean `data: null` → `absent`.

**`tests/unit/lib/features/authentication/server-session.test.ts`** — `getServerSessionResult`'s wiring, plus the existing `getServerSession` null behavior it already pins. After step 2's extraction this file finally mirrors a real source module (`lib/features/authentication/server-session.ts`) instead of being an orphan:

5. `getServerSessionResult` returns `absent` for a clean `data: null`, and forwards the cookie header to the client.
6. `getServerSession` still returns `null` for **both** `absent` and `unavailable` — the compatibility guarantee that keeps all five existing callers behaviorally unchanged.

Two duplications to resolve while here, per CLAUDE.md's deletion-is-first-class rule:

- `server-utils.test.ts:91-145`'s `describe("getServerSession")` block is a **pure deletion** — all **five** of its cases (`:92`, `:102`, `:110`, `:118`, `:131`) already exist verbatim in `server-session.test.ts` (`:39`, `:49`, `:57`, `:65`, `:78`). Nothing to move.
- `server-session.test.ts:135-158` carries its own `describe("requireAuth")` duplicating `server-utils.test.ts:157-162`. Delete it, so the gates live only in `server-utils.test.ts` and the reads only in `server-session.test.ts`.

**`tests/unit/lib/features/authentication/server-utils.test.ts`** — the gates:

7. `resolveAuthGate` returns `{ ok: false }` rather than redirecting on `unavailable` — assert `mockRedirect` was **not** called.
8. `requireAuth`'s existing exits unchanged. The `no-session` assertion is at `server-utils.test.ts:160-161`; the `email-not-verified` and `incomplete` assertions run ~164–186. All must keep passing untouched.

**`tests/unit/lib/features/session.test.ts`**:

9. `createServerSideProps` on `unavailable` still resolves (does not throw) — the root-layout guard — and returns `authentication` equal to `defaultAuthenticationData`. **Not** a new `AuthenticationData` variant: that union is closed (`lib/features/authentication/types.ts:18`) and typed into `SiteProps`, and step 6 explicitly decides against widening it.

**Integration**, both via `renderWithProviders`:

- **`tests/integration/app/dashboard/layout.test.tsx`** (beside the existing `slot-defaults.test.tsx`) — `SessionUnavailable` renders, no redirect is issued, and **all three slot props go unrendered**. Mount `app/dashboard/layout.tsx` with `classic` / `modern` / `information` props whose components call `requireAuth`; `@information` is the one whose page comment makes the gate dependency explicit.

  **This test needs a positive control in the same file or it cannot fail.** "Assert `mockRedirect` was not called" passes trivially, because unrendered elements never execute — it would pass just as well if `SessionUnavailable` were replaced by `null` or if the slot doubles were inert. Pair it with the `ok: true` case using the *same* slot doubles: the gate resolves to a session, the slot marker renders, and its gate demonstrably ran. Only against that control does the negative assertion carry information.

  `slot-defaults.test.tsx:50` shows the `renderWithProviders(await Component())` shape, but its **mock preamble at `:5-14` is the more useful reference** — that file mounts leaf `default.tsx` components, whereas `app/dashboard/layout.tsx` additionally pulls `StoreProvider` and `ThemedLayout` → `createServerSideProps`. The new file needs `vi.mock("server-only")`, `next/navigation`'s `redirect`, and `@/lib/features/session`, or the positive-control case stalls on an unmocked root dependency.
- **`tests/integration/app/dashboard/SessionUnavailable.test.tsx`** — mirroring the component's source path (`app/dashboard/SessionUnavailable.tsx`) per CLAUDE.md's never-colocated rule and `docs/testing.md:242`, and landing beside the new `layout.test.tsx`. Covers: `session_unavailable` fires exactly once across a double-mount, the retry button calls `router.refresh()`, and the "Sign in again" link targets `/login`. `tests/integration/app/login/SessionEndedNotice.test.tsx` is the precedent for a client notice with a `useRef`-guarded PostHog emit; follow its shape.

`docs/testing.md:146` documents `tests/helpers/classic-page-authority-harness.ts` as the established scaffold for the `requireAuth()` → `requireRole()` gate on `app/dashboard/@classic/**` pages, and CLAUDE.md forbids ad-hoc test scaffolds. **This work does not change that gate** — classic page gates keep their current behavior — so the harness is deliberately left alone rather than extended. If implementation finds it needs touching, extend the harness rather than writing a parallel scaffold.

## Acceptance criteria (from the issue)

- [ ] A test proves a failed `getSession` differs from a successful `data: null` — test 1
- [ ] `bounced=no-session` emitted only for genuinely absent/invalid sessions — tests 5, 6, 7
- [ ] The distinct reason is queryable in PostHog — step 7 (`session_unavailable` event, since this path no longer redirects), documented in the component's doc comment, mirroring `app/login/LoginBounceTelemetry.tsx:7-23`
- [ ] No regression in the noisy-error behavior — the `.catch` is left in place; the 429 path never reached it

## Risks and open items

- **Scope is larger than the issue's option 1.** The issue ranked the bounce-with-a-distinct-reason variant as smallest. This plan deliberately takes the larger option because the reason for choosing it — don't sign out a DJ who has a valid cookie — is not served by a differently-labelled logout. If review wants to split, step 1 + 2 + the tests are independently landable and already make the failure classifiable; steps 3–4 are the UX half.
- **`guardAppStateMutation` 403s during the same outage.** Fail-closed is correct there and this PR does not change it, but it means the 429 burst has a second user-visible symptom (experience/theme switches rejected) beyond the logout. Worth adding to the issue so it is not filed separately as a new bug.
- **The role read fails closed on the same outage, and the layout gate does not cover it — out of scope, deliberately.** `getUserRoleInOrganization` mints a JWT via `getServerJwtToken` → `/token` on the same auth service (`organization-utils.server.ts:66`), returns `undefined` on any failure, and `getUserAuthority` then fails closed to `Authorization.NO` (`server-utils.ts:79-89`). So when `getSession` *succeeds* but `/token` 429s, the layout gate never trips and a real MD/SM is still wrongly bounced off `@classic/library`, `@classic/library/missing`, and `@modern/admin/*` to dashboard home. Fail-closed is the right default for an authority check and changing it is a distinct decision, so this PR leaves it alone — but BS#2169 deliberately keeps `/auth/token` IP-keyed, which means this third symptom survives that fix too. **File it separately.**
- **`app/dashboard/layout.tsx` is the single gate for every dashboard route.** A bug in the new branch logs everyone out or, worse, lets an unauthenticated user through. The `absent` path must remain byte-identical in behavior to today's — that is what tests 4–6 pin.
- **Fails closed, not open.** `unavailable` must never render authenticated chrome or a `StoreProvider` with a partial session; it renders only the notice.
- **Coupling to better-fetch's non-throwing contract.** If a future `better-auth`/`@better-fetch/fetch` bump sets `throw` (or `catchAllError`) by default, 429s would start arriving as rejections. The classifier handles both (an error with no status → `unavailable`), so the outcome is stable, but the 429-specific branch would go dead and the transport retry would start firing on 429s — the thing Correction 2 exists to prevent. Test 3 is the tripwire.
- **BS#2169 lands independently.** When it does, the 429 trigger disappears and this code path should go quiet. That is the expected outcome, not evidence the work was unnecessary — the failure shape is wrong for any cause.
