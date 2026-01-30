#!/bin/bash

# Script to stop E2E services and restore default ports in .env.local

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="${BACKEND_SERVICE_DIR:-$PROJECT_ROOT/../Backend-Service}"

# Default ports to restore
DEFAULT_API_PORT=8080
DEFAULT_AUTH_PORT=8082

echo "=========================================="
echo "Stopping E2E Services"
echo "=========================================="
echo ""

# Stop docker compose services
cd "$BACKEND_DIR/dev_env"
echo "Stopping Docker Compose services..."
docker compose --profile e2e down 2>/dev/null || true

echo ""
echo "Services stopped."

# Restore default ports in .env.local
ENV_LOCAL_FILE="$PROJECT_ROOT/.env.local"
if [ -f "$ENV_LOCAL_FILE" ]; then
    echo ""
    echo "Restoring default ports in $ENV_LOCAL_FILE..."

    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|NEXT_PUBLIC_BACKEND_URL=http://localhost:[0-9]*|NEXT_PUBLIC_BACKEND_URL=http://localhost:$DEFAULT_API_PORT|" "$ENV_LOCAL_FILE"
        sed -i '' "s|NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:[0-9]*/auth|NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:$DEFAULT_AUTH_PORT/auth|" "$ENV_LOCAL_FILE"
    else
        sed -i "s|NEXT_PUBLIC_BACKEND_URL=http://localhost:[0-9]*|NEXT_PUBLIC_BACKEND_URL=http://localhost:$DEFAULT_API_PORT|" "$ENV_LOCAL_FILE"
        sed -i "s|NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:[0-9]*/auth|NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:$DEFAULT_AUTH_PORT/auth|" "$ENV_LOCAL_FILE"
    fi

    echo "Restored .env.local:"
    grep -E "NEXT_PUBLIC_(BACKEND|BETTER_AUTH)_URL" "$ENV_LOCAL_FILE"
fi

# Stop dj-site if we started it
DJSITE_PID_FILE="$PROJECT_ROOT/e2e/.djsite.pid"
if [ -f "$DJSITE_PID_FILE" ]; then
    DJSITE_PID=$(cat "$DJSITE_PID_FILE")
    echo ""
    echo "Stopping dj-site (PID: $DJSITE_PID)..."
    kill $DJSITE_PID 2>/dev/null || true
    sleep 2
    # Force kill if still running
    if ps -p $DJSITE_PID >/dev/null 2>&1; then
        echo "Force stopping..."
        kill -9 $DJSITE_PID 2>/dev/null || true
    fi
    rm "$DJSITE_PID_FILE"
    echo "dj-site stopped."
fi

# Clean up generated files
echo ""
echo "Cleaning up generated files..."

PORT_INFO_FILE="$PROJECT_ROOT/e2e/.e2e-ports"
if [ -f "$PORT_INFO_FILE" ]; then
    rm "$PORT_INFO_FILE"
    echo "  Removed $PORT_INFO_FILE"
fi

DJSITE_LOG="$PROJECT_ROOT/e2e/.djsite.log"
if [ -f "$DJSITE_LOG" ]; then
    rm "$DJSITE_LOG"
    echo "  Removed $DJSITE_LOG"
fi

echo ""
echo "=========================================="
echo "E2E services stopped and ports restored."
echo ""
echo "If you want to start dj-site manually:"
echo "  cd $PROJECT_ROOT && npm run dev"
echo "=========================================="
