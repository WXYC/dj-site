# CI/CD

## CI (`.github/workflows/ci.yml`)

Runs on push to `main` (full suite) and on PRs (scoped to changed code):
1. **Lint & Type Check** -- `npx tsc --noEmit`
2. **Unit Tests** -- On PRs, uses `vitest --changed origin/main` to only run tests affected by the diff. On `main` pushes, runs all tests.
3. **Build** -- `npm run build`
4. **Script Tests** -- `npm run test:scripts` (bats suites over `scripts/deploy/*.sh`; hermetic — fake `curl`/`wrangler` on PATH).
5. **Preview** (PRs) -- builds and Direct-Uploads a per-PR Cloudflare Pages preview, then smoke-probes it (see Deployment).
6. **Deploy Production** (`main` pushes) -- builds and Direct-Uploads to `wxyc-dj` (see Deployment).

PRs that only change non-code files (docs, scripts, etc.) skip the actual work via per-job `if:` guards but **still post a (skipped) check status**. A leading `changes` job runs `dorny/paths-filter@v4` against the PR diff and exposes an `app_source` boolean output (its glob now includes `scripts/**`); downstream jobs declare `needs: changes` plus `if: github.event_name != 'pull_request' || needs.changes.outputs.app_source == 'true'`. This lets branch protection require Type Check / Build / Unit Tests / Preview URL smoke check on every PR without locking out workflow-only or docs-only PRs — skipped jobs count as success for required status checks. See issue #731 for the migration rationale.

The workflow-level concurrency uses `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`: superseded PR runs cancel to save compute, but `main` pushes queue so the `deploy-production` job (own `cancel-in-progress: false` group) never gets cancelled mid-upload.

## E2E (`.github/workflows/e2e-tests.yml`)

Runs on push to `main` and on PRs that touch app code. Spins up Backend-Service with Docker Compose (PostgreSQL + auth + backend), builds dj-site, runs Playwright tests. Same `changes` + `if:` pattern as CI: PRs that only change unit tests, test utilities, or non-app config skip the matrix but the `E2E Tests` umbrella check still posts (treating `skipped` as success). The workflow caches the dj-site `.next/` build output and Playwright browser binaries to reduce setup time. On cache hit, both the Next.js build and Playwright install are skipped entirely. Cache keys include `package-lock.json`, `next.config.*`, and app source files, so dependency or source changes invalidate the cache correctly.

### E2E-only dependencies

The Tier 1 SSE round-trip tests under `e2e/tests/sse/` issue `pg_notify('cdc', <json>)` directly against the E2E Postgres to bypass the LML enrichment chain (unreachable in CI). For that they need a Node Postgres client, so `pg` and `@types/pg` are pinned in `devDependencies`. They're only imported from `e2e/helpers/pg-notify.ts` — nothing in app code uses them and they don't ship in the Next.js bundle. Both `scripts/e2e-local.sh` and the E2E workflow export `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USERNAME`/`DB_PASSWORD` so the helper can connect without per-test config.

### Second dj-site instance (server-session-via-docker test)

`e2e/tests/auth/server-session-via-docker.spec.ts` (Tier 2) regression-tests the `AUTH_REWRITE_URL` precedence in `lib/features/authentication/server-client.ts:getBaseURL()`. The bug only manifests when `NEXT_PUBLIC_BETTER_AUTH_URL` is unreachable from inside the dj-site server process, so the test needs a second dj-site build with `NEXT_PUBLIC_BETTER_AUTH_URL=http://127.0.0.99:9999/auth` (loopback, nothing listens) and runtime `AUTH_REWRITE_URL` pointing at the real auth. Both `scripts/e2e-local.sh` and the E2E workflow build this second instance via `NEXT_DIST_DIR_SUFFIX=broken-auth npm run build` (writes to `.next-broken-auth/` via the `distDir` switch in `next.config.mjs`; the suffix is a generic per-build directory switch with no E2E semantics) and start it on `$SECOND_FRONTEND_PORT` (3002 local, 3001 in CI). The second build runs **sequentially after** the primary build, not concurrently: both invoke `initOpenNextCloudflareForDev()` (shared `workerd` SQLite cache) and both rewrite the shared `tsconfig.json` during Next typegen, so concurrent builds race and crash with `SQLITE_BUSY`. The test reads `SECOND_FRONTEND_PORT` from env; if unset, the test self-skips so direct `npx playwright test` invocations against the primary instance don't fail. The second build is intentionally not cached separately — the cache-key complexity isn't worth saving ~30s on a one-extra-`next build` cost. Revisit if E2E run frequency increases enough to make the trade-off worth it.

## Deployment

Cloudflare Pages (`wxyc-dj` project) via OpenNext, deployed by **Direct Upload** from GitHub Actions (`wrangler pages deploy` with the repo's wrangler 4.x). This replaced the Cloudflare Pages Git-build integration, whose pinned wrangler 3.114.17 miscompiled `@opennextjs/cloudflare >= 1.19` into a boot-500 ([#810](https://github.com/WXYC/dj-site/issues/810), upstream opennextjs/opennextjs-cloudflare#1286).

Deploy helpers live in `scripts/deploy/`, each with a bats suite in `scripts/__tests__/deploy/` (run `npm run test:scripts`):

- **`deploy-cf-pages.sh`** — wraps `wrangler pages deploy .open-next/assets` with `--project-name wxyc-dj --branch <branch> --commit-hash --commit-message`, extracts the deployment's `*.pages.dev` URL, and emits `deployment_url`. `--branch main` = production; any other branch = preview. Wrangler reads `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` from the env (the token needs **Cloudflare Pages: Edit** scope for uploads).
- **`check-build-env.sh`** — run before each build; hard-fails if `NEXT_PUBLIC_BACKEND_URL` / `NEXT_PUBLIC_BETTER_AUTH_URL` are empty or localhost, or `NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD` is empty (the "invisible parity failure" — a build inlined with localhost still serves `/` but breaks every client API call, and a missing temp password makes the new-DJ first-login flow throw).
- **`cf-latest-production-deployment.sh`** — used by `cloudflare-deploy-status.yml`; queries the latest production deployment with a null-safe commit-message extraction (`ad_hoc` deployments can have a null message; the old inline `split("\n")` crashed the monitor under `bash -e`).

**Pipeline:** the `deploy-production` job (`ci.yml`, `main` pushes, gated on CI) and the single `preview` job (PRs) each run `build:opennext` then `deploy-cf-pages.sh`. `NEXT_PUBLIC_*` build vars are inlined at build time and come from repo variables (production `NEXT_PUBLIC_*`, preview `PREVIEW_NEXT_PUBLIC_*`) set at the job level to override the workflow-level localhost placeholders — see [`env-vars.md`](env-vars.md). The `deploy` npm script (`build:opennext && wrangler pages deploy .open-next/assets`) remains as a local-dev convenience; it shares the base command with the helper but omits the CI commit-metadata flags. Cutover procedure: [`deploy-cutover-runbook.md`](deploy-cutover-runbook.md).

`npm run deploy` (local) and the CI jobs both target the same `wxyc-dj` project.

## CI pin maintenance

Two classes of pin in `.github/workflows/*.yml` exist for supply-chain reasons (mirrors WXYC/request-o-matic#124's free-tier hardening; see WXYC/wiki#67 for the org-wide rollout). They will bit-rot and need occasional bumps:

- **Workflow-level `permissions:`** scoped to the minimum each workflow needs:
  - `ci.yml`, `e2e-tests.yml`: `contents: read` floor. `ci.yml` now runs the Cloudflare deploys itself, but they authenticate with `CLOUDFLARE_API_TOKEN` (not `GITHUB_TOKEN`), so the floor stays `contents: read`; the one exception is the `preview` job, which sets **job-level** `pull-requests: write` to post its failure comment (job-level `permissions` *replace* the floor, so it restates `contents: read` for checkout).
  - `charset-corpus-drift.yml`: `contents: read` plus `packages: read` (the reusable workflow pulls `@wxyc/shared` from `npm.pkg.github.com`).
  - `cloudflare-deploy-status.yml`: `contents: read` + `issues: write` — it now `actions/checkout`s to run `scripts/deploy/cf-latest-production-deployment.sh`, so `contents: read` is required (it used to hit the CF API inline and needed only `issues: write`).
  Failure mode is silent — a job that needs a missing scope (e.g. `pull-requests: write`) fails its API call but the workflow stays green. When adding a step that needs to comment on PRs, push tags, mint releases, etc., explicitly grant the scope at the **job** level (or widen the workflow-level floor only if every job in the file needs it).
- **Reusable-workflow refs pinned to `@gha/v1`**, not `@main` — `WXYC/wxyc-shared/.github/workflows/check-charset-corpus-drift.yml@gha/v1` (in `charset-corpus-drift.yml`). The publishing repo treats `gha/v1` as a moving major tag — re-pointed forward on non-breaking changes, frozen on breaking changes (which get a fresh `gha/v2`). Don't downgrade to `@main`; if a `gha/v2` migration arrives, follow the procedure at the top of `WXYC/wxyc-shared/CLAUDE.md` "Tag Stability Policy".

Run `actionlint .github/workflows/*.yml` locally before pushing workflow changes; it validates `permissions:` syntax, action-version pins, and shell-script blocks (via shellcheck), and catches the silent-mistake class of errors above before CI does.

Item 4 of #124 (Railway CLI pin) does not apply — dj-site deploys to Cloudflare Pages.
