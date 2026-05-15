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

cleanup() {
  echo "Cleaning up..."
  kill "$(cat /tmp/e2e-frontend.pid 2>/dev/null)" 2>/dev/null || true
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
export BETTER_AUTH_TRUSTED_ORIGINS="http://localhost:$FRONTEND_PORT"
export FRONTEND_SOURCE="http://localhost:$FRONTEND_PORT"
export DEFAULT_ORG_SLUG=test-org
export DEFAULT_ORG_NAME='Test Organization'
export APP_ORGANIZATION_ID=test-org-id-0000000000000000001
export NODE_ENV=test

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

echo "==> Building dj-site..."
cd "$DJSITE_DIR"
NEXT_PUBLIC_BACKEND_URL=http://localhost:$BACKEND_PORT \
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:$AUTH_PORT/auth \
NEXT_PUBLIC_DASHBOARD_HOME_PAGE=/dashboard/flowsheet \
NEXT_PUBLIC_VERSION=e2e \
NEXT_PUBLIC_DEFAULT_EXPERIENCE=modern \
NEXT_PUBLIC_ENABLED_EXPERIENCES=modern,classic \
NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING=true \
NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD=temppass123 \
NEXT_PUBLIC_APP_ORGANIZATION=test-org \
npm run build

echo "==> Starting dj-site on :$FRONTEND_PORT..."
PORT=$FRONTEND_PORT npm run start > /tmp/e2e-frontend.log 2>&1 &
echo $! > /tmp/e2e-frontend.pid
echo "Waiting for frontend..."
timeout 60 bash -c "until curl -sf http://localhost:$FRONTEND_PORT; do sleep 2; done"

echo "==> Running E2E tests..."
E2E_BASE_URL=http://localhost:$FRONTEND_PORT \
npx playwright test --config=e2e/playwright.config.ts "$@"
