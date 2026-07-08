# Plan: QR device-authorization polling client (PR 1 of 2)

Part of [WXYC/dj-site#785](https://github.com/WXYC/dj-site/issues/785) — build the RFC 8628 QR shared-computer sign-in flow per [ADR 0005](../adr/0005-qr-device-authorization-shared-computer-signin.md), typed by `@wxyc/shared` `DeviceAuth*`. This PR delivers **only the polling client / state machine + hook + unit tests**. The `QRCodeForm` UI, `qrcode` dependency, login-picker wiring, `login-method-storage` `"qr"` value, and e2e are deferred to PR 2.

## Context / what already exists

- No device-auth code exists in dj-site today (repo-wide grep for `device/code`, `device/token`, `authorization_pending`, `verification_uri_complete`, `QRCodeForm`, `deviceAuthorization` returns only docs/ADRs).
- `@wxyc/shared` publishes the `DeviceAuth*` types from `@wxyc/shared/dtos` (dj-site's dominant import path, 38 usages). `main` already pins `^1.17.1`, which publishes these types, so **no dependency bump is needed in this PR**. Confirmed present: `DeviceAuthCodeRequest/Response`, `DeviceAuthTokenRequest/Response`, `DeviceAuthTokenErrorCode`, `DeviceAuthVerifyResponse`, `DeviceAuthStatus`.
- `DeviceAuthTokenErrorCode` const values: `authorization_pending`, `slow_down`, `expired_token`, `access_denied`, `invalid_request`, `invalid_grant`, `server_error`.
- Existing auth hooks live in `src/hooks/authenticationHooks.ts`, wrap async work in `useAsyncAction`, and route post-login via the shared `redirectAfterAuth(router, user, method)` helper.
- Raw-fetch helpers already in `lib/features/authentication/client.ts` (`lookupEmailByIdentifier`, `fetchJWTToken`) establish the pattern: `fetch(\`${authBaseURL}/...\`, { credentials: "include" })`. `authBaseURL` is exported from `client.ts`.

## Wire contract (load-bearing)

- POST `/auth/device/code` with `{ client_id }` (snake_case) → 200 `DeviceAuthCodeResponse` `{ device_code, user_code, verification_uri, verification_uri_complete, expires_in, interval }`.
- POST `/auth/device/token` with `{ grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code, client_id }` (snake_case).
  - **200** `DeviceAuthTokenResponse` `{ access_token, token_type: "Bearer", expires_in, scope }` → success. The 200 also sets the better-auth **session cookie** on the browser (the poll runs with `credentials: "include"`); the response body carries no user object.
  - **400** `DeviceAuthTokenError` `{ error: DeviceAuthTokenErrorCode, error_description }` → the RFC 8628 polling/terminal states are delivered as **400s, not 2xx**.
  - **500** → `server_error`.

## Decisions (confirmed with user)

1. **Split** — polling client first (this PR), UI + wiring second.
2. **Raw fetch typed by `@wxyc/shared`** — no `deviceAuthorizationClient()` plugin; explicit control over the 400-as-polling-state branching and easy to mock.

## Design — two seams

### 1. Pure `interpretTokenPoll` (deep module)

`lib/features/authentication/device-auth.ts`

```ts
import {
  DeviceAuthCodeRequest,
  DeviceAuthCodeResponse,
  DeviceAuthTokenRequest,
  DeviceAuthTokenResponse,
  DeviceAuthTokenErrorCode,
} from "@wxyc/shared/dtos";

export type PollOutcome =
  | { kind: "pending" }
  | { kind: "slow_down" }
  | { kind: "success"; token: DeviceAuthTokenResponse }
  | { kind: "expired" }
  | { kind: "denied" }
  | { kind: "error"; code?: DeviceAuthTokenErrorCode | "network" };

export function interpretTokenPoll(status: number, body: unknown): PollOutcome;
```

- Switches on `DeviceAuthTokenErrorCode` const members (`authorization_pending` → `pending`, `slow_down` → `slow_down`, `expired_token` → `expired`, `access_denied` → `denied`, everything else / 500 → `error`). **Never** branches on raw string literals.
- 200 with an `access_token` → `success`.
- Pure, synchronous, no fetch/timers/React → unit-testable in isolation; survives any refactor of the plumbing around it.

Also in this module: thin typed fetch wrappers `requestDeviceCode(clientId)` → `DeviceAuthCodeResponse` and `pollDeviceToken(deviceCode, clientId)` → `{ status, body }`, request bodies typed by `DeviceAuthCodeRequest` / `DeviceAuthTokenRequest`. These are I/O-only; all decision logic stays in `interpretTokenPoll`.

### 2. `useDeviceAuthorization()` hook

`src/hooks/authenticationHooks.ts` (alongside `useOTPVerify`)

- On start: `requestDeviceCode` → stash `userCode`, `verificationUriComplete`, `expiresIn`; set interval from server `interval`.
- Poll loop: every `interval` seconds call `pollDeviceToken` → `interpretTokenPoll`:
  - `pending` → keep polling.
  - `slow_down` → increase interval by 5s, keep polling.
  - `success` → derive the user, then `redirectAfterAuth(router, user, "qr")` (see "User derivation" below).
  - `expired` / `denied` / `error` → set a terminal `status`, stop polling, `toast.error` for parity with the other auth hooks.
- Exposes `{ userCode, verificationUriComplete, status, restart }` where `status` is a discriminated UI-facing union. **State transitions:** starts `"loading"` while the initial `/device/code` POST is in flight (`userCode`/`verificationUriComplete` still `undefined`) → `"waiting"` once the code returns (QR renderable, poll loop running) → terminal `"expired" | "denied" | "error"`. A failed initial `/device/code` POST goes straight to `"error"`. (`"success"` is not a status — the hook redirects away on success.)
- `restart()`: resets to `"loading"`, fetches a fresh device code, and restarts the poll loop. PR 2's `QRCodeForm` calls it from the "regenerate" affordance after `"expired"`. Exported now so the hook interface is stable for PR 2.
- Cleans up its timer on unmount (no leaked intervals).

**State management (resolves review finding):** the polling lifecycle uses direct `useState` + `useEffect` + `useRef` (timer handle + cancellation), **not** `useAsyncAction`. `useAsyncAction` models a single-shot async call (set loading → await → set error); the device flow is a long-lived poll loop with `slow_down` interval mutation and unmount cleanup, which doesn't fit that shape. Terminal errors still surface via `toast.error` so UX matches `useLogin`/`useOTPVerify`.

**`LoginMethod` scope (resolves review finding):** the only PR-1 type change is the hook-internal `LoginMethod` union in `authenticationHooks.ts` (`"password" | "otp" | "onboarding"` → add `"qr"`), needed so `redirectAfterAuth` records the `login_post_redirect` `method` for QR sign-ins. This is **distinct** from `login-method-storage.ts`'s `PreferredLoginMethod` and the `AuthStage` union — those are picker concerns and stay in **PR 2**. No `login-method-storage` change in this PR.

**`client_id` (resolves review finding):** sourced from `NEXT_PUBLIC_DEVICE_AUTH_CLIENT_ID`, defaulting to `"dj-site"` when unset (mirrors the `NEXT_PUBLIC_DASHBOARD_HOME_PAGE` default-constant pattern). Add this row to `docs/env-vars.md` in this PR:

> `NEXT_PUBLIC_DEVICE_AUTH_CLIENT_ID` — OAuth 2.0 Device Authorization Grant `client_id` (RFC 8628) sent to `/auth/device/code` and `/auth/device/token` for the QR shared-computer sign-in. Optional; defaults to `"dj-site"`.

**User derivation on success (resolves review High finding):** the `/device/token` 200 body has no user, but the successful poll has set the better-auth session cookie. So on `success` the hook: (1) `clearTokenCache()` to drop any prior session's cached bearer (parity with `useLogin`/`useOTPVerify`, WXYC/dj-site#596); (2) `const session = await authClient.getSession()`; (3) `redirectAfterAuth(router, session.data?.user, "qr")`. `authClient.getSession()` is the same call other flows use and is **already mocked** (`mockGetSession`) in `authenticationHooks.test.ts`, so test #11 stubs it to return `{ data: { user: { id, hasCompletedOnboarding } } }` and asserts the resulting `mockPush` target — no new mock infrastructure. If `getSession()` returns no user, fall through to the dashboard default (same as `redirectAfterAuth`'s existing null handling).

## Behaviors to test (TDD order)

Pure `interpretTokenPoll` (vertical slices, tracer bullet first):
1. 400 `authorization_pending` → `pending`  ← tracer bullet
2. 400 `slow_down` → `slow_down`
3. 200 + `access_token` → `success` (carries the token)
4. 400 `expired_token` → `expired`
5. 400 `access_denied` → `denied`
6. 500 / `server_error` / unknown code → `error`
7. uses `DeviceAuthTokenErrorCode` const members, not string literals (guards against contract drift)

`useDeviceAuthorization` (via `renderHook` + a local `createWrapper()` that supplies a `configureStore({ reducer: { [authenticationSlice...] } })` Redux `Provider` — the exact pattern already in `authenticationHooks.test.ts`; with `vi.useFakeTimers()` and the `device-auth.ts` fetch wrappers mocked):
8. requests a device code on start and exposes `userCode` + `verificationUriComplete`
9. keeps polling while `pending`, firing at the server `interval`
10. `slow_down` increases the polling interval
11. `success` derives the user via `authClient.getSession()` (mocked) and triggers `redirectAfterAuth` — router push to `/dashboard/...` for a complete DJ, `/login?incomplete=true` when `hasCompletedOnboarding === false`
12. each terminal state surfaces the matching UI `status`
13. stops polling / clears timer on unmount

## Test file locations

- Pure `interpretTokenPoll` + fetch-wrapper tests → new `lib/features/authentication/device-auth.test.ts` (co-located with the module).
- `useDeviceAuthorization` tests → appended to the existing `src/hooks/authenticationHooks.test.ts` (co-located with the other auth hooks, reusing its mocks/wrapper).

## Out of scope (→ PR 2)

`QRCodeForm.tsx`, `qrcode` dep, `AuthStage` `"qr"`, `login-method-storage` `"qr"`, `LoginFormSwitcher` branch + "use password instead" affordance, e2e golden path. **No `@wxyc/shared` bump lands in this PR** — `main` already pins `^1.17.1`, which publishes the `DeviceAuth*` DTOs the hook imports.

**PR-2 note — `redirectAfterAuth` recovery on the QR route.** On success the hook derives the user via `authClient.getSession()` and calls `redirectAfterAuth(..., "qr")`. If that read fails *and* `confirmSessionVisible()` can't confirm the session (persistent auth outage right after phone approval), `redirectAfterAuth` falls back to `router.refresh()` rather than `push()`. That `refresh()` only advances the DJ because the `/login` route's layout forwards an authenticated session onward. The QR page must therefore either live under a layout that does the same forwarding, or the flow needs an explicit success navigation — otherwise a signed-in DJ could be left on the QR/"waiting" screen until the outage clears.

## Acceptance for this PR

- `interpretTokenPoll` fully unit-tested with plain `describe`/`it` (pure function, no React); `useDeviceAuthorization` fully unit-tested via `renderHook` + a local `createWrapper()` (Redux `Provider`) with fake timers and mocked fetch wrappers — per the behavior list above.
- All device-auth request/response handling typed by `@wxyc/shared`; no hand-typed device-auth shapes.
- `@wxyc/shared` provides the DeviceAuth* DTOs; `main` already pins `^1.17.1`, so no manifest change is needed in this PR.
- Typecheck + existing unit suite unchanged and green.
