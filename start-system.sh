#!/usr/bin/env bash
set -Eeuo pipefail

# --- pick the right compose command (v2 plugin or legacy v1 binary) ---
COMPOSE_CMD=()
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "❌ Docker Compose not found."
  echo "   Install one of:"
  echo "   • Docker Compose v2 plugin:  sudo apt-get install docker-compose-plugin"
  echo "   • Legacy docker-compose:     sudo apt-get install docker-compose"
  exit 1
fi

REBUILD="${1:-}"   # pass "rebuild" to force image rebuilds

echo "🚀 Starting CV Analyzer System..."

echo "🛑 Stopping existing stack (if any)..."
"${COMPOSE_CMD[@]}" down --remove-orphans || true

if [[ "$REBUILD" == "rebuild" ]]; then
  echo "🔧 Building images (no cache)..."
  "${COMPOSE_CMD[@]}" build --no-cache
fi

echo "✅ Bringing services up..."
"${COMPOSE_CMD[@]}" up -d

echo "📊 Current containers:"
"${COMPOSE_CMD[@]}" ps

# --- readiness helpers ---
wait_http() {
  local url="$1" name="$2" timeout="${3:-120}"
  echo "⏳ Waiting for $name at $url (timeout ${timeout}s)..."
  local start ts
  start=$(date +%s)
  while true; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "✅ $name is ready."
      return 0
    fi
    ts=$(($(date +%s)-start))
    if (( ts >= timeout )); then
      echo "❌ $name not ready after ${timeout}s" >&2
      return 1
    fi
    sleep 2
  done
}

wait_tcp() {
  local host="$1" port="$2" name="$3" timeout="${4:-120}"
  echo "⏳ Waiting for $name tcp://${host}:${port} (timeout ${timeout}s)..."
  local start ts
  start=$(date +%s)
  while true; do
    if (exec 3<>/dev/tcp/"$host"/"$port") >/dev/null 2>&1; then
      exec 3<&- 3>&-
      echo "✅ $name port is accepting connections."
      return 0
    fi
    ts=$(($(date +%s)-start))
    if (( ts >= timeout )); then
      echo "❌ $name tcp://${host}:${port} not reachable after ${timeout}s" >&2
      return 1
    fi
    sleep 2
  done
}

# --- readiness checks (best-effort) ---
wait_tcp "localhost" "5433" "Postgres" 120 || true
wait_http "http://localhost:6333/collections" "Qdrant" 120 || true
wait_http "http://localhost:8000/api/health" "Backend API" 180 || true
wait_http "http://localhost/health" "Nginx proxy→backend health" 60 || true
wait_http "http://localhost:3000" "Frontend" 120 || true

echo ""
echo "🎉 System started!"
echo "   🌐 Frontend:   http://localhost:3000"
echo "   🔧 Backend:    http://localhost:8000"
echo "   📚 API Docs:   http://localhost:8000/docs"
echo "   🌐 Proxy URL:  http://localhost  (health -> /health, api -> /api/...)"
echo "   🗄️  Database:  localhost:5433"
echo "   🔍 Qdrant:     http://localhost:6333"
echo ""
echo "ℹ️  Rebuild images next time with: ./start-system.sh rebuild"
echo "📋 Tail logs with: ${COMPOSE_CMD[*]} logs -f"
