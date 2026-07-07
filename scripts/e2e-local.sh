#!/usr/bin/env bash
set -euo pipefail

# Local E2E test runner that mirrors the CI environment.
# Usage:
#   ./scripts/e2e-local.sh                    # run all E2E tests headless
#   ./scripts/e2e-local.sh --headed           # run headed (see the browser)
#   ./scripts/e2e-local.sh --ui               # open Playwright UI
#   ./scripts/e2e-local.sh --debug            # run in debug mode
#   ./scripts/e2e-local.sh --grep "should add entry"  # run specific test
#
# Prerequisites:
#   - Docker (for Postgres)
#   - Backend-Service checked out at ../Backend-Service (or set BACKEND_DIR)
#   - Node.js 20+
#
# Pass-through: any extra arguments are forwarded to Playwright.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DJSITE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="${BACKEND_DIR:-$(cd "$DJSITE_DIR/../Backend-Service" && pwd)}"

# Ports (match CI)
DB_PORT="${E2E_DB_PORT:-5436}"
AUTH_PORT=8084
BACKEND_PORT=8085
FRONTEND_PORT="${E2E_FRONTEND_PORT:-3001}"
SECOND_FRONTEND_PORT="${E2E_SECOND_FRONTEND_PORT:-3002}"

cleanup() {
  echo "Cleaning up..."
  kill "$(cat /tmp/e2e-frontend.pid 2>/dev/null)" 2>/dev/null || true
  kill "$(cat /tmp/e2e-frontend-broken-auth.pid 2>/dev/null)" 2>/dev/null || true
  kill "$(cat /tmp/e2e-auth.pid 2>/dev/null)" 2>/dev/null || true
  kill "$(cat /tmp/e2e-backend.pid 2>/dev/null)" 2>/dev/null || true
  E2E_DB_PORT=$DB_PORT docker compose -f "$DJSITE_DIR/docker-compose.e2e.yml" down -v 2>/dev/null || true
}
trap cleanup EXIT

echo "==> Starting Postgres..."
E2E_DB_PORT=$DB_PORT docker compose -f "$DJSITE_DIR/docker-compose.e2e.yml" up -d --force-recreate --wait

echo "==> Setting up Backend-Service E2E environment..."
export DB_HOST=localhost
export DB_PORT=$DB_PORT
export DB_NAME=wxyc_db
export DB_USERNAME=wxyc_admin
export DB_PASSWORD='RadioIsEpic$1100'
export BETTER_AUTH_SECRET=e2e-auth-secret-for-testing-min-32-chars
export BETTER_AUTH_URL="http://localhost:$AUTH_PORT/auth"
export BETTER_AUTH_JWKS_URL="http://localhost:$AUTH_PORT/auth/jwks"
export BETTER_AUTH_TRUSTED_ORIGINS="http://localhost:$FRONTEND_PORT,http://localhost:$SECOND_FRONTEND_PORT"
export FRONTEND_SOURCE="http://localhost:$FRONTEND_PORT"
export DEFAULT_ORG_SLUG=test-org
export DEFAULT_ORG_NAME='Test Organization'
export APP_ORGANIZATION_ID=test-org-id-0000000000000000001
export NODE_ENV=test
# CDC LISTEN is currently gated on CDC_SECRET in Backend-Service's
# setupCdcWebSocket() — and setupMetadataBroadcast() depends on the LISTEN
# being active to deliver pg_notify('cdc', ...) events to its handler.
# Without this, the SSE Tier 1 tests' NOTIFYs are silently dropped. Tracked
# as a Backend-Service follow-up to split LISTEN startup from CDC_SECRET.
export CDC_SECRET=e2e-cdc-secret-not-used-by-tests
# Backend-Service's POST /internal/flowsheet-sync-notify is gated on
# ETL_NOTIFY_KEY. The Tier 3 refetch test posts with this same value to
# trigger a liveFs:refetch broadcast without going through the real ETL.
# E2E_BACKEND_URL tells the helper where BS listens.
export ETL_NOTIFY_KEY=e2e-etl-notify-key
export E2E_BACKEND_URL=http://localhost:$BACKEND_PORT

echo "==> Building Backend-Service..."
cd "$BACKEND_DIR"
npm run build

echo "==> Running DB init..."
node dev_env/init-db.mjs

echo "==> Starting auth service on :$AUTH_PORT..."
AUTH_PORT=$AUTH_PORT node apps/auth/dist/app.js > /tmp/e2e-auth.log 2>&1 &
echo $! > /tmp/e2e-auth.pid
echo "Waiting for auth..."
timeout 60 bash -c "until curl -sf http://localhost:$AUTH_PORT/healthcheck; do sleep 1; done"

echo "==> Starting backend service on :$BACKEND_PORT..."
PORT=$BACKEND_PORT \
BETTER_AUTH_ISSUER=http://localhost:$AUTH_PORT \
BETTER_AUTH_AUDIENCE=http://localhost:$AUTH_PORT \
node apps/backend/dist/app.js > /tmp/e2e-backend.log 2>&1 &
echo $! > /tmp/e2e-backend.pid
echo "Waiting for backend..."
timeout 60 bash -c "until curl -sf http://localhost:$BACKEND_PORT/healthcheck; do sleep 1; done"

echo "==> Seeding E2E test users..."
npm run setup:e2e-users

cd "$DJSITE_DIR"

# Shared NEXT_PUBLIC_* config for dj-site builds. Per-build overrides go on
# the invocation line so they win against the export here.
export NEXT_PUBLIC_BACKEND_URL=http://localhost:$BACKEND_PORT
export NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:$AUTH_PORT/auth
export NEXT_PUBLIC_DASHBOARD_HOME_PAGE=/dashboard/flowsheet
export NEXT_PUBLIC_VERSION=e2e
export NEXT_PUBLIC_DEFAULT_EXPERIENCE=modern
export NEXT_PUBLIC_ENABLED_EXPERIENCES=modern,classic
export NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING=true
export NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD=temppass123
export NEXT_PUBLIC_APP_ORGANIZATION=test-org
export NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED=true
export NEXT_PUBLIC_FLOWSHEET_SSE_LIVE_VIEW_ENABLED=true

echo "==> Building dj-site (primary)..."
# Primary build -> .next/
if ! npm run build > /tmp/e2e-build-primary.log 2>&1; then
  echo "Primary build failed:"; tail -50 /tmp/e2e-build-primary.log; exit 1
fi

# Second build for e2e/tests/auth/server-session-via-docker.spec.ts.
# NEXT_PUBLIC_BETTER_AUTH_URL is inlined at build time to an unreachable
# loopback address, simulating the Docker scenario where the container's
# `localhost` is the container itself. AUTH_REWRITE_URL is set at runtime on
# the second `npm run start` (below) and takes precedence in both the /auth
# route handler and SSR session lookup — that precedence is exactly what the
# test asserts. Writes to `.next-broken-auth/` (via NEXT_DIST_DIR_SUFFIX in
# next.config.mjs) so the primary `.next/` build cache survives.
#
# Runs AFTER the primary build, not in parallel: both builds bootstrap
# OpenNext (initOpenNextCloudflareForDev in next.config.mjs) against a shared
# workerd SQLite cache and both trigger Next's tsconfig.json typegen rewrite —
# running them concurrently races on those shared files and crashes with
# SQLITE_BUSY.
echo "==> Building dj-site (broken-auth)..."
if ! NEXT_PUBLIC_BETTER_AUTH_URL=http://127.0.0.99:9999/auth \
     NEXT_DIST_DIR_SUFFIX=broken-auth \
     npm run build > /tmp/e2e-build-broken-auth.log 2>&1; then
  echo "Broken-auth build failed:"; tail -50 /tmp/e2e-build-broken-auth.log; exit 1
fi

echo "==> Starting dj-site on :$FRONTEND_PORT..."
PORT=$FRONTEND_PORT npm run start > /tmp/e2e-frontend.log 2>&1 &
echo $! > /tmp/e2e-frontend.pid
timeout 60 bash -c "until curl -sf http://localhost:$FRONTEND_PORT; do sleep 2; done"

echo "==> Starting second dj-site on :$SECOND_FRONTEND_PORT..."
# AUTH_REWRITE_URL points at the real auth so it wins over the unreachable
# build-inlined NEXT_PUBLIC_BETTER_AUTH_URL in both getBaseURL() and the
# /auth route handler — the precedence server-session-via-docker.spec.ts asserts.
PORT=$SECOND_FRONTEND_PORT \
NEXT_DIST_DIR_SUFFIX=broken-auth \
AUTH_REWRITE_URL=http://localhost:$AUTH_PORT/auth \
npm run start \
  > /tmp/e2e-frontend-broken-auth.log 2>&1 &
echo $! > /tmp/e2e-frontend-broken-auth.pid
timeout 60 bash -c "until curl -sf http://localhost:$SECOND_FRONTEND_PORT; do sleep 2; done"

echo "==> Running E2E tests..."
E2E_BASE_URL=http://localhost:$FRONTEND_PORT \
SECOND_FRONTEND_PORT=$SECOND_FRONTEND_PORT \
npx playwright test --config=e2e/playwright.config.ts "$@"
