#!/bin/bash

###############################################################################
# Start CV Analyzer - CPU-only production (no GPU)
# Uses docker-compose.cpu.yml. For EC2 m6i.2xlarge / t3.2xlarge (~20 users).
#
# Usage: ./scripts/start-cpu.sh [rebuild]
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
COMPOSE_FILE="docker-compose.cpu.yml"

cd "$PROJECT_ROOT"

if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose -f $COMPOSE_FILE"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose -f $COMPOSE_FILE"
else
    echo -e "${RED}[ERROR] Docker Compose not found${NC}"
    exit 1
fi

REBUILD="${1:-}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Starting CV Analyzer (CPU-only)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}[ERROR] $COMPOSE_FILE not found!${NC}"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}[WARN] .env file not found${NC}"
fi

echo -e "${YELLOW}[INFO] Stopping existing containers...${NC}"
$COMPOSE_CMD down --remove-orphans 2>/dev/null || true

if [ "$REBUILD" == "rebuild" ]; then
    echo -e "${YELLOW}[INFO] Rebuilding images (CPU backend)...${NC}"
    $COMPOSE_CMD build --no-cache
    echo -e "${GREEN}[OK] Images rebuilt${NC}"
fi

echo -e "${YELLOW}[INFO] Starting services...${NC}"
$COMPOSE_CMD up -d

sleep 5
echo ""
$COMPOSE_CMD ps

echo ""
echo -e "${GREEN}CPU stack is up.${NC}"
echo "  - Frontend:  http://localhost"
echo "  - Backend:   http://localhost/api"
echo "  - Logs:      $COMPOSE_CMD logs -f"
echo ""
