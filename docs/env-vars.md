# Environment Variables

Copy `.env.example` to `.env.local`. Defaults:

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:8082/auth
NEXT_PUBLIC_DASHBOARD_HOME_PAGE=/dashboard/flowsheet
NEXT_PUBLIC_DEFAULT_EXPERIENCE=modern
NEXT_PUBLIC_ENABLED_EXPERIENCES=modern,classic
NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING=true
NEXT_PUBLIC_CATALOG_TRACK_SEARCH_UI_ENABLED=false
NEXT_PUBLIC_QR_LOGIN_ENABLED=false

# Optional — auto-DJ orchestrator base URL. When set, the dashboard polls
# /api/auto-dj/status and reflects auto-DJ state (greyscale + banner).
# NEXT_PUBLIC_ORCHESTRATOR_URL=http://localhost:8090

# Optional, server-only — override target for the /auth/* proxy route handler
# (app/auth/[...path]/route.ts) in containerized deployments where
# NEXT_PUBLIC_BETTER_AUTH_URL is reachable from the browser but not from inside
# the dj-site server.
# AUTH_REWRITE_URL=http://auth:8082/auth

# Optional — OAuth 2.0 Device Authorization Grant (RFC 8628) client_id for the
# QR shared-computer sign-in. Sent to /auth/device/code and /auth/device/token.
# Defaults to "dj-site" when unset.
# NEXT_PUBLIC_DEVICE_AUTH_CLIENT_ID=dj-site
```

## Build-time env in CI/CD

`NEXT_PUBLIC_*` values are **inlined at build time** and shipped in the client bundle. Since deploys moved to GitHub Actions Direct Upload ([#810](https://github.com/WXYC/dj-site/issues/810)), the production/preview values live as **GitHub repo variables** (they used to be the Cloudflare Pages dashboard "build settings"; the Git build is gone). They are public (already in the browser bundle), so they are repo *variables*, not secrets.

- **Production** (`deploy-production` job) reads `vars.NEXT_PUBLIC_*`.
- **Preview** (`preview` job) reads `vars.PREVIEW_NEXT_PUBLIC_*`.

Repo variables (not GitHub *Environments*) are used deliberately: Dependabot-triggered runs can read repo variables but not environment-scoped ones, and the preview job must work on Dependabot PRs. Both deploy jobs set these at the **job level** to override `ci.yml`'s workflow-level localhost placeholders (which exist for the test/typecheck/build jobs). `scripts/deploy/check-build-env.sh` hard-fails a deploy if `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL`, or `NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD` is empty (or, for the URLs, localhost) — the three with no safe in-code default: the URLs break every client API call, and the onboarding temp password makes the new-DJ first-login flow throw (`handleNewUser` in `src/hooks/authenticationHooks.ts`) and admin roster provisioning fall back to an empty password. See [`ci-cd.md`](ci-cd.md) and [`deploy-cutover-runbook.md`](deploy-cutover-runbook.md).

Runtime (server-only) settings like `AUTH_REWRITE_URL` are **not** build-time; they are Cloudflare Pages project settings and are unaffected by Direct Upload.

## Feature flags

- `NEXT_PUBLIC_CATALOG_TRACK_SEARCH_UI_ENABLED` — gates the track-search UI surfaces in catalog search: the `matched_via` track-match chip rendering in result rows (both classic and modern experiences) and the classic `SearchForm` help-text refresh (worked track-lookup example replacing the legacy "Coming later" line). Defaults to OFF; set to `"true"` or `"1"` to enable. Helper: `isCatalogTrackSearchUiEnabled()` in `lib/features/catalog/flags.ts`. Flip on after Backend-Service is serving `matched_via` in prod. See WXYC/dj-site#497 and WXYC/dj-site#498.

- `NEXT_PUBLIC_QR_LOGIN_ENABLED` — gates the RFC 8628 QR ("device authorization") sign-in method on the modern login screen: the "Sign in with a QR code" entry links on the password and email forms, and the restore of a stored `"qr"` login preference. Defaults to OFF; set to `"true"` or `"1"` to enable. Helper: `isQrLoginEnabled()` in `lib/features/authentication/flags.ts`. While off, nothing can navigate to the QR stage, so the client never requests a device code. Flip on per-environment once Backend-Service is serving `/auth/device/code` and `/auth/device/token`. See WXYC/dj-site#785.

- `NEXT_PUBLIC_ORCHESTRATOR_URL` — base URL of the [auto-dj-orchestrator](https://github.com/WXYC/auto-dj-orchestrator). When set, the dashboard polls `GET /api/auto-dj/status` every 10s (better-auth JWT) and reflects auto-DJ state station-wide: the shell greyscales and an "Auto DJ Enabled" banner shows at the top of the flowsheet. Unset disables the indicator and all polling. Helpers: `getOrchestratorUrl()` / `isAutoDJStatusEnabled()` in `lib/features/autoDJ/flags.ts`.
