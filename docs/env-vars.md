# Environment Variables

Copy `.env.example` to `.env.local`. Defaults:

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:8082/auth
# Post-auth landing page. When unset, every entry point falls back to
# DEFAULT_DASHBOARD_HOME_PAGE in lib/features/application/constants.ts.
NEXT_PUBLIC_DASHBOARD_HOME_PAGE=/dashboard/catalog
NEXT_PUBLIC_DEFAULT_EXPERIENCE=modern
NEXT_PUBLIC_ENABLED_EXPERIENCES=modern,classic
NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING=true
NEXT_PUBLIC_CATALOG_TRACK_SEARCH_UI_ENABLED=false
NEXT_PUBLIC_QR_LOGIN_ENABLED=false
NEXT_PUBLIC_STATION_SIGNUP_ENABLED=false
NEXT_PUBLIC_STATION_SIGNUP_ADMIN_ENABLED=false

# Optional — auto-DJ orchestrator base URL. When set, the dashboard polls
# /api/auto-dj/status and reflects auto-DJ state (greyscale + banner).
# NEXT_PUBLIC_ORCHESTRATOR_URL=http://localhost:8090

# Optional, server-only — override target for the /auth/* proxy route handler
# (app/auth/[...path]/route.ts) in containerized deployments where
# NEXT_PUBLIC_BETTER_AUTH_URL is reachable from the browser but not from inside
# the dj-site server.
# AUTH_REWRITE_URL=http://auth:8082/auth

# Optional, server-only debug flag — set to 1 to log per-phase SSR auth timing
# ([server_timing] lines for getSession + org-role) to Cloudflare Workers Logs
# during a cold-load measurement window. Off by default (zero cost on the hot
# authenticated path); read at call time, so no rebuild is needed to toggle.
# SERVER_TIMING=1

# Optional — OAuth 2.0 Device Authorization Grant (RFC 8628) client_id for the
# QR shared-computer sign-in. Sent to /auth/device/code and /auth/device/token.
# Defaults to "dj-site" when unset.
# NEXT_PUBLIC_DEVICE_AUTH_CLIENT_ID=dj-site

# Optional, server-only — better-auth organization slug or ID, read by
# getAppOrganizationId() and consulted ONLY as a fallback for the
# `organization.listMembers` lookup inside getUserAuthority's WXYC-tier
# resolution, when a session's tier can't be read from its JWT (no claim, or
# the auth service issued a session with no JWT). getUserAuthority's
# JWT-first resolution always runs regardless of this variable — it is not a
# branch condition. Unset everywhere today: not in .env.example, CI, GitHub
# repo variables, or either Cloudflare Pages environment (production or
# preview). Because the JWT path alone is sufficient, this fallback has never
# actually fired in a deployed environment.
# APP_ORGANIZATION=wxyc

# Optional — PostHog (lib/posthog.ts: analytics + its own $exception stream)
# and Sentry (lib/sentry.ts: error triage). Errors go to both via
# lib/error-reporting.ts. Each adapter is inert without its key/DSN — every
# capture call no-ops. All are public values, not secrets. See .env.example
# for the full comments and docs/adr/0008 for the dual-sink decision;
# NEXT_PUBLIC_SENTRY_ENVIRONMENT and NEXT_PUBLIC_SENTRY_RELEASE are set by the
# CI deploy jobs (production/preview + commit SHA) and rarely needed locally.
# NEXT_PUBLIC_POSTHOG_KEY=phc_...
# NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
# NEXT_PUBLIC_SENTRY_DSN=https://<key>@<org>.ingest.us.sentry.io/<project>

# Optional — the client-side variable read by getAppOrganizationIdClient(),
# consulted the same way as APP_ORGANIZATION above but for AuthorizedView's
# client-side tier resolution (fetchOrganizationRoleForUserClient). Its
# `globalThis.process?.env` read is never build-inlined by the bundler, so
# from the browser's perspective this is always unresolved regardless of
# what's configured — that client-side fallback has never fired either.
# Unlike APP_ORGANIZATION, though, this variable IS set in the Cloudflare
# Pages production environment: the admin roster page
# (app/dashboard/@modern/admin/roster/page.tsx) reads it directly,
# server-side, as the organization slug for listing and provisioning DJs — an
# unrelated, load-bearing use that predates and is untouched by the
# JWT-first fix above. The two variables are configured independently; don't
# infer one's status from the other. See docs/deploy-cutover-runbook.md.
# NEXT_PUBLIC_APP_ORGANIZATION=wxyc
```

## Build-time env in CI/CD

`NEXT_PUBLIC_*` values are **inlined at build time** and shipped in the client bundle. Since deploys moved to GitHub Actions Direct Upload ([#810](https://github.com/WXYC/dj-site/issues/810)), the production/preview values live as **GitHub repo variables** (they used to be the Cloudflare Pages dashboard "build settings"; the Git build is gone). They are public (already in the browser bundle), so they are repo *variables*, not secrets.

- **Production** (`deploy-production` job) reads `vars.NEXT_PUBLIC_*`.
- **Preview** (`preview` job) reads `vars.PREVIEW_NEXT_PUBLIC_*`.

Repo variables (not GitHub *Environments*) are used deliberately: Dependabot-triggered runs can read repo variables but not environment-scoped ones, and the preview job must work on Dependabot PRs. Both deploy jobs set these at the **job level** to override `ci.yml`'s workflow-level localhost placeholders (which exist for the test/typecheck/build jobs). `scripts/deploy/check-build-env.sh` hard-fails a deploy if `NEXT_PUBLIC_BACKEND_URL` or `NEXT_PUBLIC_BETTER_AUTH_URL` is empty (or localhost) — the two with no safe in-code default: the URLs break every client API call. See [`ci-cd.md`](ci-cd.md) and [`deploy-cutover-runbook.md`](deploy-cutover-runbook.md).

Runtime (server-only) settings like `AUTH_REWRITE_URL` are **not** build-time; they are Cloudflare Pages project settings and are unaffected by Direct Upload.

## Feature flags

- `NEXT_PUBLIC_CATALOG_TRACK_SEARCH_UI_ENABLED` — gates the track-search UI surfaces in catalog search: the `matched_via` track-match chip rendering in result rows (both classic and modern experiences) and the classic `SearchForm` help-text refresh (worked track-lookup example replacing the legacy "Coming later" line). Defaults to OFF; set to `"true"` or `"1"` to enable. Helper: `isCatalogTrackSearchUiEnabled()` in `lib/features/catalog/flags.ts`. Flip on after Backend-Service is serving `matched_via` in prod. See WXYC/dj-site#497 and WXYC/dj-site#498.

- `NEXT_PUBLIC_CLASSIC_LIBRARIAN_NAV_ENABLED` — gates the librarian entries in the classic navigation bar (missing releases, rotation, and the MD-gated Music Department menu). Helper: `isClassicLibrarianNavEnabled()` in `lib/features/catalog/flags.ts`. Code default is OFF; **production and preview are ON**. The screens stay URL-reachable and server-gated whether or not this is set: it controls **discoverability**, not authority. Turned on ahead of the full URL map because URL-reachable is not reachable for the librarian who does the cataloguing — he navigates by clicking, and with this flag off `/dashboard/library/missing` has no inbound link anywhere in the app at all. With it on, Missing Releases is reachable from both the nav bar and the Music Department menu, matching `/wxycdb`, which linked it from its main menu and from `libraryAdminLinks.jsp`. See WXYC/dj-site#1163.

- `NEXT_PUBLIC_CLASSIC_CROSSREFERENCES_ENABLED` — gates the two `View ... Cross-References` entries in the classic Music Department menu (`/dashboard/library/crossreferences/artists` and `.../releases`). Helper: `isClassicCrossReferencesEnabled()` in `lib/features/catalog/flags.ts`. Defaults to OFF everywhere, including production. Both screens stay URL-reachable and server-gated whether or not this is set: it controls **discoverability**, not authority. Deliberately **not** riding `NEXT_PUBLIC_CLASSIC_LIBRARIAN_NAV_ENABLED`, which is already ON in production and preview — sharing it would publish both entries the moment the screens merge, and Backend-Service is not yet serving `GET /library/crossreferences/artists` or `.../releases` anywhere. Flip on per-environment once it is. Until then the screens' own data layer surfaces the missing route as an outage rather than as the JSP's "There are no ... Cross-References", so a URL typed by hand is honest too. See WXYC/dj-site#1376.

- `NEXT_PUBLIC_QR_LOGIN_ENABLED` — gates the RFC 8628 QR ("device authorization") sign-in method on the modern login screen: the "Sign in with a QR code" entry links on the password and email forms, and the restore of a stored `"qr"` login preference. Defaults to OFF; set to `"true"` or `"1"` to enable. Helper: `isQrLoginEnabled()` in `lib/features/authentication/flags.ts`. While off, nothing can navigate to the QR stage, so the client never requests a device code. Flip on per-environment once Backend-Service is serving `/auth/device/code` and `/auth/device/token`. See WXYC/dj-site#785.

- `NEXT_PUBLIC_STATION_SIGNUP_ENABLED` — gates the DJ-facing station-signup form: the "New DJ? Get station access" entry link on the normal login form (both experiences) and the `signup` `AuthStage`/`?signup=1` classic slot it leads to. Defaults to OFF; set to `"true"` or `"1"` to enable. Helper: `isStationSignupEnabled()` in `lib/features/authentication/flags.ts`. This is the CLIENT half of a two-flag rollout — Backend-Service has its own independent `STATION_SIGNUP_ENABLED` gate on `POST /auth/wxyc/station-signup`. Client-on/server-off is a real staged-rollout state: the endpoint answers a bare 404 with no body, and `StationSignupForm` renders that as a distinct "not available" state rather than a generic failure. Flip on per-environment once Backend-Service is serving the endpoint there.

- `NEXT_PUBLIC_STATION_SIGNUP_ADMIN_ENABLED` — gates the MANAGER-facing passcode surface: the "Signup Passcode" segment in the admin roster page's view switcher and the `StationSignupPanel` (reveal / rotate / revoke of the shared passcode) it reveals. Defaults to OFF; set to `"true"` or `"1"` to enable. Helper: `isStationSignupAdminEnabled()` in `lib/features/authentication/flags.ts`. Build-time, like every `NEXT_PUBLIC_*` flag — inlined at build, so flipping it needs a rebuild/redeploy, not just a restart. **Independent of `NEXT_PUBLIC_STATION_SIGNUP_ENABLED`** (the DJ-facing gate) and meant to be turned on FIRST: while off, the switcher shows the roster alone with no toggle, so a manager never reaches reveal/rotate controls that would error until the auth service's `STATION_PASSCODE_KEY` is set. Turning it on before the DJ-facing flag lets a manager mint the first passcode before DJs can sign up (mint-before-flip). See docs/station-signup-rollout.md for the ordered launch steps.

- `NEXT_PUBLIC_ORCHESTRATOR_URL` — base URL of the [auto-dj-orchestrator](https://github.com/WXYC/auto-dj-orchestrator). When set, the dashboard polls `GET /api/auto-dj/status` every 10s (better-auth JWT) and reflects auto-DJ state station-wide: the shell greyscales and an "Auto DJ Enabled" banner shows at the top of the flowsheet. Unset disables the indicator and all polling. Helpers: `getOrchestratorUrl()` / `isAutoDJStatusEnabled()` in `lib/features/autoDJ/flags.ts`.
