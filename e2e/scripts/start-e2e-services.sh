#!/bin/bash

# Script to start E2E services with dynamic port allocation
# Finds open ports to avoid conflicts with other running containers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="${BACKEND_SERVICE_DIR:-$PROJECT_ROOT/../Backend-Service}"

# Default ports (will be overridden if in use)
DEFAULT_API_PORT=8080
DEFAULT_AUTH_PORT=8082
DEFAULT_DB_PORT=5434

# Function to check if a port is in use
is_port_in_use() {
    local port=$1
    if lsof -i ":$port" >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Track ports we've already claimed (to avoid assigning same port to multiple services)
CLAIMED_PORTS=""

# Function to check if a port is claimed by us
is_port_claimed() {
    local port=$1
    echo "$CLAIMED_PORTS" | grep -q "\b$port\b"
}

# Function to find an open port starting from a given port
find_open_port() {
    local start_port=$1
    local port=$start_port
    local max_attempts=100
    local attempts=0

    while [ $attempts -lt $max_attempts ]; do
        if is_port_in_use $port; then
            echo "  Port $port is in use, trying next..." >&2
        elif is_port_claimed $port; then
            echo "  Port $port is already claimed for another service, trying next..." >&2
        else
            # Port is free and not claimed
            break
        fi
        port=$((port + 1))
        attempts=$((attempts + 1))
    done

    if [ $attempts -eq $max_attempts ]; then
        echo "ERROR: Could not find an open port after $max_attempts attempts starting from $start_port" >&2
        exit 1
    fi

    # Claim this port
    CLAIMED_PORTS="$CLAIMED_PORTS $port"
    echo $port
}

# Function to show what's using a port
show_port_usage() {
    local port=$1
    echo "Port $port is being used by:"
    lsof -i ":$port" 2>/dev/null | head -5 || echo "  (unable to determine)"
}

echo "=========================================="
echo "E2E Services Startup Script"
echo "=========================================="
echo ""

# Check if Backend-Service directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo "ERROR: Backend-Service directory not found at $BACKEND_DIR"
    echo "Set BACKEND_SERVICE_DIR environment variable to the correct path"
    exit 1
fi

echo "Backend-Service directory: $BACKEND_DIR"
echo ""

# Find open ports
echo "Finding open ports..."
echo ""

echo "Checking API port (default: $DEFAULT_API_PORT)..."
if is_port_in_use $DEFAULT_API_PORT; then
    show_port_usage $DEFAULT_API_PORT
fi
API_PORT=$(find_open_port $DEFAULT_API_PORT)
echo "  -> Using API port: $API_PORT"
echo ""

echo "Checking Auth port (default: $DEFAULT_AUTH_PORT)..."
if is_port_in_use $DEFAULT_AUTH_PORT; then
    show_port_usage $DEFAULT_AUTH_PORT
fi
AUTH_PORT=$(find_open_port $DEFAULT_AUTH_PORT)
echo "  -> Using Auth port: $AUTH_PORT"
echo ""

echo "Checking DB port (default: $DEFAULT_DB_PORT)..."
if is_port_in_use $DEFAULT_DB_PORT; then
    show_port_usage $DEFAULT_DB_PORT
fi
DB_PORT=$(find_open_port $DEFAULT_DB_PORT)
echo "  -> Using DB port: $DB_PORT"
echo ""

# Export ports for docker-compose override
export E2E_API_PORT=$API_PORT
export E2E_AUTH_PORT=$AUTH_PORT
export E2E_DB_PORT=$DB_PORT

echo "=========================================="
echo "Starting services with ports:"
echo "  API:  $API_PORT"
echo "  Auth: $AUTH_PORT"
echo "  DB:   $DB_PORT"
echo "=========================================="
echo ""

# Create a temporary docker-compose override file with dynamic ports
OVERRIDE_FILE=$(mktemp)
cat > "$OVERRIDE_FILE" << EOF
services:
  e2e-backend:
    ports:
      - "${API_PORT}:8080"
  e2e-auth:
    ports:
      - "${AUTH_PORT}:8080"
  e2e-db:
    ports:
      - "${DB_PORT}:5432"
EOF

echo "Created port override file: $OVERRIDE_FILE"
cat "$OVERRIDE_FILE"
echo ""

# Start the services
cd "$BACKEND_DIR/dev_env"

echo "Starting Docker Compose services..."
docker compose -f docker-compose.yml -f "$OVERRIDE_FILE" --profile e2e up -d

# Clean up override file
rm "$OVERRIDE_FILE"

# Wait for services to be healthy
echo ""
echo "Waiting for services to be healthy..."
MAX_WAIT=60
WAITED=0

while [ $WAITED -lt $MAX_WAIT ]; do
    # Check if all services are healthy
    UNHEALTHY=$(docker compose --profile e2e ps --format json 2>/dev/null | grep -c '"Health":"starting"' || true)

    if [ "$UNHEALTHY" = "0" ]; then
        echo "All services are healthy!"
        break
    fi

    echo "  Waiting... ($WAITED/$MAX_WAIT seconds)"
    sleep 5
    WAITED=$((WAITED + 5))
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo "WARNING: Some services may not be fully healthy yet"
fi

echo ""
echo "=========================================="
echo "Services are running!"
echo ""
echo "To run E2E tests, use these environment variables:"
echo ""
echo "  export E2E_API_PORT=$API_PORT"
echo "  export E2E_AUTH_PORT=$AUTH_PORT"
echo "  export E2E_DB_PORT=$DB_PORT"
echo ""
echo "Or run tests with:"
echo "  E2E_BASE_URL=http://localhost:3000 \\"
echo "  E2E_API_URL=http://localhost:$API_PORT \\"
echo "  E2E_AUTH_URL=http://localhost:$AUTH_PORT \\"
echo "  npm run test:e2e"
echo ""
echo "To stop services:"
echo "  cd $BACKEND_DIR/dev_env && docker compose --profile e2e down"
echo "=========================================="

# Write port info to a file for other scripts to read
PORT_INFO_FILE="$PROJECT_ROOT/e2e/.e2e-ports"
cat > "$PORT_INFO_FILE" << EOF
# E2E service ports (auto-generated)
E2E_API_PORT=$API_PORT
E2E_AUTH_PORT=$AUTH_PORT
E2E_DB_PORT=$DB_PORT
EOF

echo ""
echo "Port info saved to: $PORT_INFO_FILE"
echo "Source it with: source $PORT_INFO_FILE"

# Update .env.local with the new ports (if it exists)
ENV_LOCAL_FILE="$PROJECT_ROOT/.env.local"
if [ -f "$ENV_LOCAL_FILE" ]; then
    echo ""
    echo "Updating $ENV_LOCAL_FILE with new ports..."

    # Use sed to update the URLs
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS sed requires empty string for -i
        sed -i '' "s|NEXT_PUBLIC_BACKEND_URL=http://localhost:[0-9]*|NEXT_PUBLIC_BACKEND_URL=http://localhost:$API_PORT|" "$ENV_LOCAL_FILE"
        sed -i '' "s|NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:[0-9]*/auth|NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:$AUTH_PORT/auth|" "$ENV_LOCAL_FILE"
    else
        # Linux sed
        sed -i "s|NEXT_PUBLIC_BACKEND_URL=http://localhost:[0-9]*|NEXT_PUBLIC_BACKEND_URL=http://localhost:$API_PORT|" "$ENV_LOCAL_FILE"
        sed -i "s|NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:[0-9]*/auth|NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:$AUTH_PORT/auth|" "$ENV_LOCAL_FILE"
    fi

    echo "Updated .env.local:"
    grep -E "NEXT_PUBLIC_(BACKEND|BETTER_AUTH)_URL" "$ENV_LOCAL_FILE"
fi

# Restart dj-site to pick up new ports
echo ""
echo "=========================================="
echo "Restarting dj-site frontend..."
echo "=========================================="

# Check if dj-site is running on port 3000
DJSITE_PID=$(lsof -ti :3000 2>/dev/null || true)
if [ -n "$DJSITE_PID" ]; then
    echo "Stopping existing dj-site process (PID: $DJSITE_PID)..."
    kill $DJSITE_PID 2>/dev/null || true
    sleep 2
    # Force kill if still running
    if lsof -ti :3000 >/dev/null 2>&1; then
        echo "Force stopping..."
        kill -9 $(lsof -ti :3000) 2>/dev/null || true
        sleep 1
    fi
fi

# Start dj-site in background
DJSITE_LOG="$PROJECT_ROOT/e2e/.djsite.log"
echo "Starting dj-site dev server..."
echo "Log file: $DJSITE_LOG"

cd "$PROJECT_ROOT"
nohup npm run dev > "$DJSITE_LOG" 2>&1 &
DJSITE_NEW_PID=$!
echo "Started dj-site with PID: $DJSITE_NEW_PID"

# Save PID for stop script
echo "$DJSITE_NEW_PID" > "$PROJECT_ROOT/e2e/.djsite.pid"

# Wait for dj-site to be ready
echo "Waiting for dj-site to be ready on http://localhost:3000..."
MAX_WAIT=60
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        echo "dj-site is ready!"
        break
    fi
    echo "  Waiting... ($WAITED/$MAX_WAIT seconds)"
    sleep 3
    WAITED=$((WAITED + 3))
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo "WARNING: dj-site may not be fully ready. Check $DJSITE_LOG for errors."
    echo "Last 10 lines of log:"
    tail -10 "$DJSITE_LOG" 2>/dev/null || true
fi
