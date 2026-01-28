#!/bin/bash
# Start E2E backend services, handling port conflicts
# Usage: ./start-e2e-services.sh

set -e

BACKEND_SERVICE_DIR="${BACKEND_SERVICE_DIR:-/Users/jake/Developer/Backend-Service}"
E2E_BACKEND_PORT="${E2E_BACKEND_PORT:-8080}"
E2E_AUTH_PORT="${E2E_AUTH_PORT:-8082}"
E2E_DB_PORT="${E2E_DB_PORT:-5434}"

echo "🔍 Checking for port conflicts..."

# Function to check if a port is in use and by what
check_port() {
    local port=$1
    local service_name=$2

    if lsof -i ":$port" -sTCP:LISTEN >/dev/null 2>&1; then
        local process=$(lsof -i ":$port" -sTCP:LISTEN 2>/dev/null | tail -1 | awk '{print $1, $2}')
        echo "⚠️  Port $port ($service_name) is in use by: $process"

        # Check if it's a Docker container
        local container=$(docker ps --filter "publish=$port" --format "{{.Names}}" 2>/dev/null | head -1)
        if [ -n "$container" ]; then
            echo "   Container: $container"
            read -p "   Stop container $container? [y/N] " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                echo "   Stopping $container..."
                docker stop "$container"
                sleep 2
            else
                echo "❌ Cannot continue with port $port in use"
                exit 1
            fi
        else
            echo "❌ Port $port is in use by a non-Docker process. Please free it manually."
            exit 1
        fi
    else
        echo "✅ Port $port ($service_name) is available"
    fi
}

# Check all required ports
check_port "$E2E_BACKEND_PORT" "backend"
check_port "$E2E_AUTH_PORT" "auth"
check_port "$E2E_DB_PORT" "database"

echo ""
echo "🚀 Starting E2E services..."

cd "$BACKEND_SERVICE_DIR"

# Start the services
docker compose -f dev_env/docker-compose.yml --env-file .env.e2e --profile e2e up -d e2e-auth e2e-backend

echo ""
echo "⏳ Waiting for services to be healthy..."

# Wait for services to be ready
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s "http://localhost:$E2E_AUTH_PORT/" >/dev/null 2>&1; then
        echo "✅ Auth service is ready on port $E2E_AUTH_PORT"
        break
    fi
    attempt=$((attempt + 1))
    echo "   Waiting for auth service... ($attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ Auth service failed to start"
    exit 1
fi

attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s "http://localhost:$E2E_BACKEND_PORT/healthcheck" >/dev/null 2>&1; then
        echo "✅ Backend service is ready on port $E2E_BACKEND_PORT"
        break
    fi
    attempt=$((attempt + 1))
    echo "   Waiting for backend service... ($attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ Backend service failed to start"
    exit 1
fi

echo ""
echo "🎉 E2E services are ready!"
echo "   Auth:    http://localhost:$E2E_AUTH_PORT"
echo "   Backend: http://localhost:$E2E_BACKEND_PORT"
