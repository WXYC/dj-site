# QR device authorization adds a third coequal sign-in path on this site

The control-room computer at WXYC is shared across DJ shows; password sign-in on a shared keyboard is awkward and exposes credentials. The iOS DJ tool becomes a QR scanner that authorizes browser sign-in via better-auth's [`device-authorization` plugin](https://www.better-auth.com/docs/plugins/device-authorization) (RFC 8628). For this site, that means **a new third sign-in Form** alongside the existing `UserPasswordForm` and `EmailOTPForm` in [`src/components/experiences/modern/login/Forms/`](../../src/components/experiences/modern/login/Forms/). The picker UI and [`login-method-storage`](../../lib/features/application/login-method-storage.ts) already accept a third value (`"qr"`) — no architectural change, only one new Form component and the polling client behind it.

Canonical source: [`wxyc-dj-tool-ios/docs/cross-repo-adrs.md` ADR 0007](https://github.com/WXYC/wxyc-dj-tool-ios/blob/main/docs/cross-repo-adrs.md#adr-0007--qr-device-authorization-for-shared-computer-sign-in-to-djwxycorg) and the repo-local [iOS ADR 0002](https://github.com/WXYC/wxyc-dj-tool-ios/blob/main/docs/adr/0002-qr-device-authorization-shared-computer-signin.md).

## Our side of the work

- **New `QRCodeForm.tsx`** in `src/components/experiences/modern/login/Forms/`. On mount, POSTs `/auth/device/code` (no body needed beyond `client_id`), receives `device_code`, `user_code`, `verification_uri_complete`, `expires_in`, `interval`. Renders the `verification_uri_complete` as a QR (a small QR-encoding library like [`qrcode`](https://www.npmjs.com/package/qrcode) is fine — single dependency). Displays the `user_code` in plain text beneath the QR as debug/feedback (e.g., "Waiting for `WDPL-XK9R`").
- **Polling client**: poll `/auth/device/token` at the server-returned `interval`. Handle `authorization_pending` (continue polling), `slow_down` (bump interval), `expired_token` (show "QR expired, regenerate"), `access_denied` (show "Sign-in declined on phone — for `member` accounts, point them at the password form").
- **Extend [`login-method-storage`](../../lib/features/application/login-method-storage.ts)** with `"qr"` as a third value so the picker remembers a returning DJ's preferred method.
- **Picker UI** gets a third button/tab alongside Password + Email OTP. No reordering of existing methods; QR is additive.
- **No backend work on our end** beyond consuming the three new endpoints exposed by Backend-Service per [ADR 0008 in that repo](https://github.com/WXYC/Backend-Service/blob/main/docs/adr/0008-qr-device-authorization-shared-computer-signin.md).

## Consequences for us

- Existing password and email-OTP sign-in continue to work unchanged. QR is *additive*; nothing about the current UX is taken away.
- Tests: a new unit test around `QRCodeForm` (component renders the QR, polling lifecycle), and an e2e covering the QR golden path with a stubbed polling response. The existing e2e suite for `UserPasswordForm` / `EmailOTPForm` does not change.
- The 12-hour QR-issued session expiry (decided server-side, per Backend-Service ADR 0008) means a forgotten sign-out on the shared control-room machine self-cleans before the next morning's DJ arrives. This site's existing Sign Out button continues to work as immediate cleanup.
- The QR form is the *only* sign-in path that's restricted to `role >= dj` (`member` accounts are rejected at `/device/verify` — the QR code shows `access_denied` and the picker should offer "use password instead"). Other sign-in methods retain their existing role coverage.
- No deep-link work on our end. The iOS DJ tool reads the QR with its in-app scanner; we do not need to host an Apple App Site Association file or expose a `/auth/verify` route, even though the `verification_uri_complete` from better-auth will look URL-shaped.
