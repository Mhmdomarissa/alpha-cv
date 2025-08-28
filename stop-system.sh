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
  exit 1
fi

echo "🛑 Stopping CV Analyzer System..."

echo "⏹️  Bringing stack down..."
"${COMPOSE_CMD[@]}" down --remove-orphans || true

echo "📊 Remaining containers:"
docker ps

echo ""
echo "✅ System stopped."
echo "📋 Start again with: ./start-system.sh"
