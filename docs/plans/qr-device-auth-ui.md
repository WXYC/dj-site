# PR 2 — QR device-authorization sign-in UI

Part of [WXYC/dj-site#785](https://github.com/WXYC/dj-site/issues/785) — the RFC 8628 QR shared-computer sign-in flow per [ADR 0005](../adr/0005-qr-device-authorization-shared-computer-signin.md). PR 1 ([#835](https://github.com/WXYC/dj-site/pull/835), merged) delivered the polling client: `lib/features/authentication/device-auth.ts` (`interpretTokenPoll`, `requestDeviceCode`, `pollDeviceToken`) and the `useDeviceAuthorization()` hook in `src/hooks/authenticationHooks.ts`. This PR delivers the **UI + login-picker wiring** that consumes that hook. The **e2e golden path is deferred to a follow-up PR** (see "Out of scope" for why).

## Background — what already exists (PR 1)

- `useDeviceAuthorization()` returns `{ userCode, verificationUriComplete, status, restart }` where `status: DeviceAuthorizationStatus = "loading" | "waiting" | "expired" | "denied" | "error"`. On success the hook navigates via `redirectAfterAuth(router, user, "qr")` and never surfaces a `"success"` status — the UI only ever sees the non-terminal / terminal-failure states.
- The hook starts polling `/auth/device/token` **on mount** (it requests a device code as its first act). So the `/device/code` request fires exactly when the QR form is mounted — mounting is the natural gate.
- `LoginMethod` (hook-internal) already includes `"qr"`; `redirectAfterAuth` already records `login_post_redirect { method: "qr" }`. No hook change is required for the happy path.

## The login surface today (modern experience)

- `app/login/@modern/layout.tsx` is a **server component**. If `getServerSession()` returns a verified, complete session it `redirect()`s to `NEXT_PUBLIC_DASHBOARD_HOME_PAGE` (default `/dashboard/catalog`); an incomplete session renders onboarding. **This is the forwarding authority** the QR success path depends on (see Design decision 1).
- `app/login/@modern/@normal/page.tsx` renders `LoginFormSwitcher`.
- `LoginFormSwitcher.tsx` (`src/components/experiences/modern/login/Forms/`) reads `authStage` from Redux (`applicationSlice.selectors.getAuthStage`) and renders the matching form. On mount it restores the persisted preference via `getPreferredLoginMethod()` in a pre-paint `useLayoutEffect`.
- `AuthStage = "otp-email" | "otp-verify" | "password" | "forgot" | "reset"` (`lib/features/application/types.ts`).
- `login-method-storage.ts`: `PreferredLoginMethod = Extract<AuthStage, "otp-email" | "password">`, `VALID_METHODS = ["otp-email", "password"]`, persisted at localStorage key `wxyc_preferred_login_method`.
- Each form carries a "Sign in with X instead" `<Link>` footer that calls `savePreferredLoginMethod(m)` + `dispatch(setAuthStage(m))` — the exact affordance QR must add and reuse.
- **Classic experience is password-only** (`ClassicLoginSlotSwitcher` chooses `normal` vs `reset`; no OTP, no method picker). QR is **out of scope for classic** — it would need a picker classic doesn't have, and the shared-control-room browsers run the modern experience.

## Scope

**In:**
1. `AuthStage` gains `"qr"`.
2. New `QRCodeForm.tsx` (modern) driven by `useDeviceAuthorization()`, rendering all five statuses + a manual-entry fallback + method-switch affordances.
3. `LoginFormSwitcher` renders `QRCodeForm` when `authStage === "qr"`.
4. "Sign in with a QR code" entry-point link added to `UserPasswordForm` and `EmailOTPForm` footers, **gated by a feature flag**.
5. `login-method-storage` extends `PreferredLoginMethod` / `VALID_METHODS` with `"qr"` so a control-room browser can default to QR; a stored `"qr"` is **ignored when the flag is off**.
6. Feature flag `NEXT_PUBLIC_QR_LOGIN_ENABLED` (default off) + `docs/env-vars.md` entry.
7. QR-rendering dependency (`qrcode.react` — see Design decision 4).
8. Component/unit tests for all of the above.

**Out (this PR):**
- **e2e golden path → follow-up PR.** The golden path needs the shared browser to reach `waiting`, then a *second* authenticated "phone" context to hit the backend device-**approve** endpoint, then the shared browser to poll to success. Whether that approve endpoint is reachable in the e2e Docker Backend-Service stack is **unverified**, and the flow is inherently cross-context. Bundling it risks blowing the ≤1000-line target and couples this UI PR to backend-e2e readiness. It ships as PR 3 once the backend endpoint is confirmed in the Docker stack. The feature flag lets the UI merge and sit dark until then.
- Classic experience QR (password-only surface; no picker).
- Any change to `device-auth.ts` / the hook's happy path.

## Design decisions

### 1. QR is an `AuthStage` inside the modern login switcher — not a standalone route

Putting the QR form *inside* `/login` (as `authStage === "qr"`) is what satisfies the PR-1 forwarding constraint for free. On success, `redirectAfterAuth(..., "qr")` either `router.push(dashboardHome)` or — if `confirmSessionVisible()` fails during an auth outage right after phone approval — `router.refresh()`. A `refresh()` on `/login` re-runs `app/login/@modern/layout.tsx`, which now sees the authenticated session and `redirect()`s to the dashboard. A standalone `/qr-login` route would have to reimplement that server-side forwarding or risk stranding a signed-in DJ on a frozen "waiting" screen. Staying on `/login` inherits it.

### 2. No client-side role gate — `denied` is backend-enforced and rendered, not prevented

The shared control-room browser is **unauthenticated** — there is no session on it to check a role against. The "role ≥ DJ" restriction is enforced **backend-side when the DJ approves on their phone** (a non-DJ approver gets `access_denied`), which the poll surfaces as `status === "denied"`. So PR 2 adds **no** `requireRole`/`checkRole` call; it renders the `denied` state with a clear message and a password/email fallback. (This corrects an over-broad "add server/client role gating" reading — there is no principal to gate on the shared machine.)

### 3. Feature flag `NEXT_PUBLIC_QR_LOGIN_ENABLED` (default off), ship dark

QR sign-in is only usable once the backend device-auth endpoints are live in an environment. The flag gates the **entry-point links** and the **stored-preference restore**, so nothing can navigate to `authStage === "qr"` (and thus fire `/device/code`) until it's turned on per-environment. Follows the existing `NEXT_PUBLIC_CATALOG_TRACK_SEARCH_UI_ENABLED` pattern. Read via a tiny `isQrLoginEnabled()` helper that mirrors `isCatalogTrackSearchUiEnabled` exactly (`=== "true" || === "1"`, invoked at render time so the build-inlined value is read per-render).

**Placement (review finding):** the helper lives in a dedicated **`lib/features/authentication/flags.ts`**, mirroring `lib/features/catalog/flags.ts` — auth flags belong in the auth feature module, not a generic `lib/utils/`. This matches the feature-module organization in CLAUDE.md.

### 4. QR rendering: `qrcode.react` (`QRCodeSVG`)

Recommend `qrcode.react` over the bare `qrcode` package (the PR-1 plan named `qrcode` generically):
- Renders **synchronous SVG** — no `toDataURL` async effect, no image-loading state to manage inside the already-multi-state form.
- Pure client component, **no Node built-ins** — safe under OpenNext/Cloudflare edge (the bare `qrcode` package pulls Node `Buffer`/`stream` paths that have burned us on the worker before).
- Themeable `fgColor`/`bgColor` to match the Joy palette; crisp at any size.
- Small, widely used, TS types bundled.

**Edge-safety verification (review finding) — RESOLVED.** The review flagged that `qrcode.react` might peer-depend on the bare `qrcode` package and drag Node `Buffer`/`stream` into the worker. Verified against the installed `qrcode.react@4.2.0`: it has **zero dependencies** (only a React peer dep), imports no `qrcode`/`buffer`/`stream`, and the bare `qrcode` package is not installed — v4 bundles its own encoder. `npm run build:opennext` completes and emits `.open-next/worker.js` cleanly. No fallback needed. The component still isolates the choice — only `QRCodeForm` imports it.

### 5. Manual-entry fallback

The `waiting` state shows the QR (encoding `verificationUriComplete`) **and** the `userCode` in large mono text for the DJ who'd rather type it. If `DeviceAuthCodeResponse` exposes the base `verification_uri`, surface it too ("go to `<uri>` and enter `<code>`") via a one-line hook addition (`verificationUri`); otherwise derive the base by stripping the query off `verificationUriComplete`. Resolve at implementation time by reading the DTO — low risk either way.

## File-by-file changes

| File | Change |
|---|---|
| `lib/features/application/types.ts` | `AuthStage` += `"qr"`, with an inline comment that `PreferredLoginMethod` uses an explicit `Extract` allow-list so a new non-persistable stage (`forgot`/`reset`/etc.) can be added here without leaking into persisted preferences. |
| `lib/features/application/login-method-storage.ts` | `PreferredLoginMethod = Extract<AuthStage, "otp-email" \| "password" \| "qr">`; `VALID_METHODS` += `"qr"`; on read, if the stored value is `"qr"` and `!isQrLoginEnabled()`, fall through to `"otp-email"`. |
| `lib/features/authentication/flags.ts` | **New.** `isQrLoginEnabled()` reading `NEXT_PUBLIC_QR_LOGIN_ENABLED`, mirroring `lib/features/catalog/flags.ts`. |
| `src/components/experiences/modern/login/Forms/QRCodeForm.tsx` | **New.** Consumes `useDeviceAuthorization()`. Renders per status: `loading` → spinner + "Generating a sign-in code…"; `waiting` → `QRCodeSVG(verificationUriComplete)` + big `userCode` + instructions + fallback links; `expired` → message + "Generate a new code" (`restart()`); `denied` → "This account isn't allowed to sign in by QR" + password/email fallback; `error` → generic message + "Try again" (`restart()`) + fallback. Always renders "Sign in with password / email code instead" links (persist method + `setAuthStage`). |
| `src/components/experiences/modern/login/Forms/LoginFormSwitcher.tsx` | add `if (authStage === "qr") return <><WelcomeQuotes/><QRCodeForm/></>;`. |
| `src/components/experiences/modern/login/Forms/UserPasswordForm.tsx` | add flag-gated "Sign in with a QR code" link (persist `"qr"` + `setAuthStage("qr")`). |
| `src/components/experiences/modern/login/Forms/EmailOTPForm.tsx` | same flag-gated QR entry link. |
| `docs/env-vars.md` | document `NEXT_PUBLIC_QR_LOGIN_ENABLED` in the feature-flag catalog. |
| `package.json` / `package-lock.json` | add `qrcode.react`. |
| `src/hooks/authenticationHooks.ts` | *(only if the DTO has `verification_uri`)* surface `verificationUri` from `useDeviceAuthorization()`. Otherwise untouched. |

## Testing plan (TDD, unit/component)

All component tests render through `renderWithProviders`; mock `useDeviceAuthorization` and the `QRCodeSVG` renderer (assert it receives `verificationUriComplete`, not its pixels).

1. **`QRCodeForm.test.tsx`** (new):
   - `loading` → shows the generating-code affordance, no QR yet.
   - `waiting` → QR renderer got `verificationUriComplete`; `userCode` is visible; fallback links present.
   - `expired` → "Generate a new code" calls `restart`.
   - `denied` → denial copy + password fallback; no `restart` on the primary action (denial is terminal for that account).
   - `error` → "Try again" calls `restart`.
   - Fallback links call `savePreferredLoginMethod("password"|"otp-email")` **and** `dispatch(setAuthStage(...))`.
2. **`LoginFormSwitcher.test.tsx`** (extend): `authStage === "qr"` renders `QRCodeForm`.
3. **`login-method-storage.test.ts`** (extend): `"qr"` round-trips through save/get when the flag is on; a stored `"qr"` with the flag **off** resolves to `"otp-email"`.
4. **Entry-point links**: `UserPasswordForm` / `EmailOTPForm` show the QR link only when `isQrLoginEnabled()`; clicking it persists `"qr"` + sets the stage.

## Risks & mitigations

- **Auto-start fires `/device/code` on mount.** Intended (mounting == the DJ chose QR), and unreachable while the flag is off. No extra guard needed.
- **`qrcode.react` on the edge.** Pure client SVG, no Node built-ins — the reason to prefer it over bare `qrcode`. Build (`build:opennext`) will confirm.
- **`verification_uri` base may be absent from the DTO.** Fallback derivation from `verificationUriComplete` removes the dependency; decided at implementation from the actual DTO.
- **e2e coupling.** Explicitly deferred so this PR doesn't block on backend device-approve availability in the Docker stack.

## Acceptance criteria

- Flag **on**: `/login` (modern) shows a "Sign in with a QR code" affordance from password and email forms; choosing it renders a QR + user code; approving on a DJ phone lands on the dashboard; a non-DJ approval shows the `denied` state with a working password fallback; expired/error offer regeneration.
- Flag **off**: no QR affordance anywhere, a stored `"qr"` preference resolves to the email form, and `/device/code` is never requested.
- `tsc --noEmit`, `vitest run`, and `npm run build` all pass locally before push.
- PR delta ≤ ~1000 lines (hand-written; excludes the generated lockfile).
