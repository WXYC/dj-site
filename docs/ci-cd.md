# CI/CD

## CI (`.github/workflows/ci.yml`)

Runs on push to `main` (full suite) and on PRs (scoped to changed code):
1. **Lint & Type Check** -- `npx tsc --noEmit`
2. **Unit Tests** -- On PRs, uses `vitest --changed origin/main` to only run tests affected by the diff. On `main` pushes, runs all tests.
3. **Build** -- `npm run build`

PRs that only change non-code files (docs, scripts, etc.) skip CI entirely via path filters.

## E2E (`.github/workflows/e2e-tests.yml`)

Runs on push to `main` and on PRs that touch app code. Spins up Backend-Service with Docker Compose (PostgreSQL + auth + backend), builds dj-site, runs Playwright tests. PRs that only change unit tests, test utilities, or non-app config skip E2E via path filters. The workflow caches the dj-site `.next/` build output and Playwright browser binaries to reduce setup time. On cache hit, both the Next.js build and Playwright install are skipped entirely. Cache keys include `package-lock.json`, `next.config.*`, and app source files, so dependency or source changes invalidate the cache correctly.

### E2E-only dependencies

The Tier 1 SSE round-trip tests under `e2e/tests/sse/` issue `pg_notify('cdc', <json>)` directly against the E2E Postgres to bypass the LML enrichment chain (unreachable in CI). For that they need a Node Postgres client, so `pg` and `@types/pg` are pinned in `devDependencies`. They're only imported from `e2e/helpers/pg-notify.ts` — nothing in app code uses them and they don't ship in the Next.js bundle. Both `scripts/e2e-local.sh` and the E2E workflow export `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USERNAME`/`DB_PASSWORD` so the helper can connect without per-test config.

### Second dj-site instance (server-session-via-docker test)

`e2e/tests/auth/server-session-via-docker.spec.ts` (Tier 2) regression-tests the `AUTH_REWRITE_URL` precedence in `lib/features/authentication/server-client.ts:getBaseURL()`. The bug only manifests when `NEXT_PUBLIC_BETTER_AUTH_URL` is unreachable from inside the dj-site server process, so the test needs a second dj-site build with `NEXT_PUBLIC_BETTER_AUTH_URL=http://127.0.0.99:9999/auth` (loopback, nothing listens) and runtime `AUTH_REWRITE_URL` pointing at the real auth. Both `scripts/e2e-local.sh` and the E2E workflow build this second instance via `NEXT_DIST_DIR_SUFFIX=broken-auth npm run build` (writes to `.next-broken-auth/` via the `distDir` switch in `next.config.mjs`; the suffix is a generic per-build directory switch with no E2E semantics) and start it on `$SECOND_FRONTEND_PORT` (3002 local, 3001 in CI). The second build runs **sequentially after** the primary build, not concurrently: both invoke `initOpenNextCloudflareForDev()` (shared `workerd` SQLite cache) and both rewrite the shared `tsconfig.json` during Next typegen, so concurrent builds race and crash with `SQLITE_BUSY`. The test reads `SECOND_FRONTEND_PORT` from env; if unset, the test self-skips so direct `npx playwright test` invocations against the primary instance don't fail. The second build is intentionally not cached separately — the cache-key complexity isn't worth saving ~30s on a one-extra-`next build` cost. Revisit if E2E run frequency increases enough to make the trade-off worth it.

## Deployment

Cloudflare Pages via OpenNext. Build: `npm run build:opennext`. Deploy: `npm run deploy` (Wrangler).

## CI pin maintenance

Two classes of pin in `.github/workflows/*.yml` exist for supply-chain reasons (mirrors WXYC/request-o-matic#124's free-tier hardening; see WXYC/wiki#67 for the org-wide rollout). They will bit-rot and need occasional bumps:

- **Workflow-level `permissions:`** scoped to the minimum each workflow needs:
  - `ci.yml`, `e2e-tests.yml`: `contents: read` (no GITHUB_TOKEN writes; Cloudflare deploy is owned by the Cloudflare Pages GitHub App, not this workflow).
  - `charset-corpus-drift.yml`: `contents: read` plus `packages: read` (the reusable workflow pulls `@wxyc/shared` from `npm.pkg.github.com`).
  - `cloudflare-deploy-status.yml`: `issues: write` only — it doesn't `actions/checkout` (just hits the Cloudflare API and creates / updates a GitHub issue), so it doesn't need `contents: read`. Don't add `contents: read` defensively; the minimal grant is the point.
  Failure mode is silent — a job that needs a missing scope (e.g. `pull-requests: write`) fails its API call but the workflow stays green. When adding a step that needs to comment on PRs, push tags, mint releases, etc., explicitly grant the scope at the **job** level (or widen the workflow-level floor only if every job in the file needs it).
- **Reusable-workflow refs pinned to `@gha/v1`**, not `@main` — `WXYC/wxyc-shared/.github/workflows/check-charset-corpus-drift.yml@gha/v1` (in `charset-corpus-drift.yml`). The publishing repo treats `gha/v1` as a moving major tag — re-pointed forward on non-breaking changes, frozen on breaking changes (which get a fresh `gha/v2`). Don't downgrade to `@main`; if a `gha/v2` migration arrives, follow the procedure at the top of `WXYC/wxyc-shared/CLAUDE.md` "Tag Stability Policy".

Run `actionlint .github/workflows/*.yml` locally before pushing workflow changes; it validates `permissions:` syntax, action-version pins, and shell-script blocks (via shellcheck), and catches the silent-mistake class of errors above before CI does.

Item 4 of #124 (Railway CLI pin) does not apply — dj-site deploys to Cloudflare Pages.
