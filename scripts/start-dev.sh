#!/bin/bash

###############################################################################
# Dev Start Script - Build & Run
#
# Builds and starts all services using docker-compose.dev.yml.
# Uses CPU-only PyTorch (no CUDA). Data in volumes is preserved.
#
# Usage: ./scripts/start-dev.sh [rebuild]
#   rebuild - Optional: rebuild images with --no-cache
###############################################################################

set -e  # Exit on any error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_ROOT"

COMPOSE_FILE="docker-compose.dev.yml"

# Detect docker compose command
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose -f $COMPOSE_FILE"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose -f $COMPOSE_FILE"
else
    echo -e "${RED}[ERROR] Docker Compose not found${NC}"
    echo "Install: sudo apt-get install docker-compose-plugin"
    exit 1
fi

REBUILD="${1:-}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Dev: Build & Run${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}[ERROR] $COMPOSE_FILE not found!${NC}"
    exit 1
fi

# Stop existing dev containers (if any) - keep volumes
echo -e "${YELLOW}[INFO] Stopping existing dev containers...${NC}"
$COMPOSE_CMD down --remove-orphans 2>/dev/null || true

# Build images
if [ "$REBUILD" == "rebuild" ]; then
    echo -e "${YELLOW}[INFO] Building Docker images (no cache)...${NC}"
    $COMPOSE_CMD build --no-cache
else
    echo -e "${YELLOW}[INFO] Building Docker images...${NC}"
    $COMPOSE_CMD build
fi
echo -e "${GREEN}[OK] Images built${NC}"
echo ""

# Start services
echo -e "${YELLOW}[INFO] Starting dev services...${NC}"
$COMPOSE_CMD up -d
echo ""

sleep 5

echo -e "${YELLOW}[INFO] Container status:${NC}"
$COMPOSE_CMD ps
echo ""

# Wait for backend (dev exposes 8000)
wait_for_service() {
    local url="$1"
    local name="$2"
    local timeout="${3:-120}"
    local elapsed=0
    echo -e "${YELLOW}[INFO] Waiting for $name...${NC}"
    while [ $elapsed -lt $timeout ]; do
        if curl -fsS "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}[OK] $name is ready${NC}"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    echo -e "${YELLOW}[WARN] $name not ready after ${timeout}s (may still be starting)${NC}"
    return 1
}

wait_for_service "http://127.0.0.1:8000/api/health" "Backend API" 180 || true
wait_for_service "http://127.0.0.1:3000" "Frontend" 60 || true
wait_for_service "http://127.0.0.1" "Nginx (port 80)" 30 || true

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}  Dev stack running${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Services (same as prod via nginx):${NC}"
echo "  - App (nginx): http://localhost          -> frontend + /api -> backend"
echo "  - Frontend:    http://localhost:3000"
echo "  - Backend:     http://127.0.0.1:8000"
echo "  - API Docs:    http://localhost/docs    or  http://127.0.0.1:8000/docs"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  - Logs:       $COMPOSE_CMD logs -f"
echo "  - Stop:      $COMPOSE_CMD down"
echo ""
