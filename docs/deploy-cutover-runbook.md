# Cloudflare Pages Direct-Upload cutover runbook

Operator steps to switch dj-site's Cloudflare Pages deploys from the **Git-build integration** to **GitHub Actions Direct Upload** ([WXYC/dj-site#810](https://github.com/WXYC/dj-site/issues/810)). The code side (CI jobs, deploy helper scripts, monitor, docs) ships in the migration PR; these steps are the dashboard/settings actions that cannot be done from code, plus the sequenced cutover.

Why the sequence matters: the migration PR adds a `preview` job under the preserved required-check name **"Preview URL smoke check"**, so that job runs on the migration PR itself and does a real `check-build-env.sh` + `wrangler pages deploy`. If the prerequisites below are not done first, the migration PR can never go green — a deadlock. And the Dependabot ignore rules must not be dropped until the Git build is disabled, or a wrangler-4 CI preview could pass while the still-active wrangler-3 Git build 500s production.

## Prerequisites — do these BEFORE the migration PR's checks are expected to pass

- [ ] **P0. Confirm the `wxyc-dj` Pages "production branch" is `main`.** Dashboard → Workers & Pages → `wxyc-dj` → Settings → Builds & deployments. Direct Upload publishes to *production* only when `deploy-cf-pages.sh --branch main` matches the project's configured production branch. If it is set to `prod` (a never-completed earlier plan), `--branch main` would publish a *preview* and leave `dj.wxyc.org` silently stale while the CI job reports success. Also confirm `Type Check` / `Unit Tests` / `Build` remain **required** status checks in branch protection — the "a skipped preview is safe" property depends on those independently blocking merge.
- [ ] **P1. Upgrade the `CLOUDFLARE_API_TOKEN` scope.** It was minted for reads (monitor/smoke). Direct Upload needs **Account → Cloudflare Pages → Edit**. Update the token value in **both** secret contexts: Settings → Secrets and variables → *Actions*, and → *Dependabot*. (Blocks every `wrangler pages deploy`, including the migration PR's own preview.)
- [ ] **P2. Populate build-time repo variables** (Settings → Secrets and variables → Actions → Variables) matching the current Cloudflare dashboard build settings. (The dashboard stores those values encrypted — the Pages API redacts them — so parity values were recovered from the literals inlined in the live production/preview client bundles.) Production set (`NEXT_PUBLIC_*`) and preview set (`PREVIEW_NEXT_PUBLIC_*`). At minimum the two guarded URL vars in each set must be real values (non-localhost), or `check-build-env.sh` fails the deploy:

  | Variable (production) | Variable (preview) | Guarded? |
  |---|---|---|
  | `NEXT_PUBLIC_BACKEND_URL` | `PREVIEW_NEXT_PUBLIC_BACKEND_URL` | ✅ hard-fail if empty/localhost |
  | `NEXT_PUBLIC_BETTER_AUTH_URL` | `PREVIEW_NEXT_PUBLIC_BETTER_AUTH_URL` | ✅ hard-fail if empty/localhost |
  | `NEXT_PUBLIC_DASHBOARD_HOME_PAGE` | `PREVIEW_NEXT_PUBLIC_DASHBOARD_HOME_PAGE` | no (in-code default) |
  | `NEXT_PUBLIC_DEFAULT_EXPERIENCE` | `PREVIEW_NEXT_PUBLIC_DEFAULT_EXPERIENCE` | no |
  | `NEXT_PUBLIC_ENABLED_EXPERIENCES` | `PREVIEW_NEXT_PUBLIC_ENABLED_EXPERIENCES` | no |
  | `NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING` | `PREVIEW_NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING` | no |
  | `NEXT_PUBLIC_CATALOG_TRACK_SEARCH_UI_ENABLED` | `PREVIEW_…` | no (defaults OFF) |
  | `NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED` | `PREVIEW_…` | no (defaults OFF) |
  | `NEXT_PUBLIC_FLOWSHEET_SSE_LIVE_VIEW_ENABLED` | `PREVIEW_…` | no (defaults OFF) |
  | `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | `PREVIEW_…` | no (optional) |
  | `NEXT_PUBLIC_ORCHESTRATOR_URL` | `PREVIEW_…` | no (optional) |

  `CLOUDFLARE_ACCOUNT_ID` is already a repo variable (used by the monitor and preview config check) — leave it.

  Intentionally **not** migrated from the old dashboard build settings: `NEXT_PUBLIC_APP_ORGANIZATION` (its client-side reads use a `globalThis.process?.env` pattern the bundler never inlines, so the browser never saw the dashboard value; server-side reads keep working from the Pages project's runtime env, which persists across the migration), `NEXT_PUBLIC_SENTRY_DSN` (no Sentry references left in the codebase), `AUTH_REWRITE_URL` and `NPM_TOKEN` (runtime/Git-build concerns, not CI build inputs). Note the `/auth/*` proxy lives in `app/auth/[...path]/route.ts` (a Route Handler, not a `next.config.mjs` rewrite) and resolves its target per-request as `AUTH_REWRITE_URL || NEXT_PUBLIC_BETTER_AUTH_URL || https://api.wxyc.org/auth` — `AUTH_REWRITE_URL` is read from the worker's runtime env, `NEXT_PUBLIC_BETTER_AUTH_URL` is build-inlined. CI builds don't set `AUTH_REWRITE_URL`, so the proxy resolves from the build-inlined `NEXT_PUBLIC_BETTER_AUTH_URL`; to point production at a different target without a rebuild, set `AUTH_REWRITE_URL` in the Pages project's runtime env.

## Cutover — after prerequisites, in order

With P0–P2 done, the migration PR's own `preview` check deploys a preview of the PR and probes it — that **is** the first proof previews work.

1. [ ] **Prove the preview end-to-end.** On the migration PR's preview URL, verify a real **logged-in session + a flowsheet fetch** against the live backend — not just the `/` probe (a build inlined with wrong env still serves `/` fine but breaks client API calls). Then merge the migration PR. The CF Git build is still enabled, so previews now come from both — harmless duplication.
2. [ ] **Disable the CF Pages Git build** for `wxyc-dj`: dashboard → Settings → Builds & deployments → disconnect the Git integration (or pause automatic deployments). From here, only CI Direct Upload deploys. **In the same sitting, remove the `Cloudflare Pages` required status check** from `main` branch protection (Settings → Branches): it is the Git integration's own commit status, so once the integration is off it never reports again and every PR blocks forever waiting on it. Keep `Preview URL smoke check` / `Type Check` / `Unit Tests` / `Build` / `E2E Tests` required.
3. [ ] **Deploy production via CI.** The next push/merge to `main` runs `deploy-production`. Confirm `https://dj.wxyc.org/` serves 200 and a logged-in session works. (Direct Upload has no Pages build log — the 200 + working session is the verification.)
4. [ ] **Verify the monitor.** Run `cloudflare-deploy-status.yml` via **workflow_dispatch**. Confirm it resolves the latest `ad_hoc` deployment and the commit-message step does not fail (the null-safe extraction).
5. [ ] **Drop the Dependabot ignore rules** — only now, after step 2. Remove the `@opennextjs/cloudflare` / `next` `ignore` block in `.github/dependabot.yml` (a tiny follow-up PR). Then let Dependabot open the OpenNext ≥ 1.19.11 + next ≥ 16.2.6 bump and confirm a **green Preview URL smoke check** — this is the end-to-end proof the root cause is gone. Reconcile the pre-existing branches carrying this work (`deps/opennext-1.19-nodejs-compat`, `deps/wrangler-workerd-bump`): rebase the furthest-along onto `main` and use it as the landing vehicle, or close them and let Dependabot reopen a fresh bump.

## Rollback

Direct Upload deployments are atomic and immutable. To roll back, redeploy a known-good commit: re-run the `deploy-production` job for that SHA (Actions → CI → the run for the good commit → Re-run), or from a clean checkout of that SHA run `npm run deploy` (with production build vars in the environment). If Direct Upload itself is wedged, re-enabling the Git build is the escape hatch (its production branch is `main`).
