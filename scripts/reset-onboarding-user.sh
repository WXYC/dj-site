#!/usr/bin/env bash
set -euo pipefail

# Resets the test_incomplete user to its seeded state so you can re-test
# the onboarding flow without restarting anything.
#
# Usage:
#   ./scripts/reset-onboarding-user.sh              # uses Backend-Service .env
#   ./scripts/reset-onboarding-user.sh --e2e         # uses E2E ports (5436)
#
# After running, refresh the browser — you'll be bounced to login.
# Log in with: test_incomplete / temppass123

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DJSITE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="${BACKEND_DIR:-$(cd "$DJSITE_DIR/../Backend-Service" 2>/dev/null && pwd || echo "")}"

USER_ID="test-incomplete-id-0000000000001"
# scrypt hash of "temppass123" from seed_db.sql
TEMP_HASH="5fa267eec9d6a94701575fce7b835466:805e0eef8140a9663c1f92dc6b66bb4f895d97f5be798dea9cf6d6cafc7ad68b63f0d8da6374bb3ca8185b96260ab94cdfc2e65aae4c305ebd3da787c05cecab"

if [[ "${1:-}" == "--e2e" ]]; then
  # E2E local environment (scripts/e2e-local.sh)
  DB_HOST=localhost
  DB_PORT="${E2E_DB_PORT:-5436}"
  DB_NAME=wxyc_db
  DB_USER=wxyc_admin
  DB_PASS='RadioIsEpic$1100'
elif [[ -n "$BACKEND_DIR" && -f "$BACKEND_DIR/.env" ]]; then
  # Standard dev environment — read from Backend-Service .env
  _env="$BACKEND_DIR/.env"
  DB_HOST=$(grep -E '^DB_HOST=' "$_env" | cut -d= -f2-)
  DB_PORT=$(grep -E '^DB_PORT=' "$_env" | cut -d= -f2-)
  DB_NAME=$(grep -E '^DB_NAME=' "$_env" | cut -d= -f2-)
  DB_USER=$(grep -E '^DB_USERNAME=' "$_env" | cut -d= -f2-)
  DB_PASS=$(grep -E '^DB_PASSWORD=' "$_env" | cut -d= -f2-)
  DB_HOST="${DB_HOST:-localhost}"
  DB_PORT="${DB_PORT:-5432}"
else
  echo "Could not find Backend-Service .env. Set BACKEND_DIR or use --e2e flag."
  exit 1
fi

PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q <<SQL
  UPDATE auth_user
     SET has_completed_onboarding = false,
         dj_name = '',
         real_name = '',
         updated_at = NOW()
   WHERE id = '$USER_ID';

  UPDATE auth_account
     SET password = '$TEMP_HASH',
         updated_at = NOW()
   WHERE user_id = '$USER_ID';

  DELETE FROM auth_session
   WHERE user_id = '$USER_ID';
SQL

echo "✅ test_incomplete reset — log in with: test_incomplete / temppass123"
