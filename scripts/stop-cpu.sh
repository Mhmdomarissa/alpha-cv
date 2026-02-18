#!/bin/bash

###############################################################################
# Stop CV Analyzer - CPU-only stack
#
# Stops all services started with docker-compose.cpu.yml.
# Preserves all data (volumes are NOT removed; never use -v).
#
# Usage: ./scripts/stop-cpu.sh
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

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Stopping CV Analyzer (CPU-only)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}[ERROR] $COMPOSE_FILE not found!${NC}"
    exit 1
fi

echo -e "${YELLOW}[INFO] Stopping all services...${NC}"
$COMPOSE_CMD stop

echo -e "${YELLOW}[INFO] Removing containers (volumes preserved)...${NC}"
$COMPOSE_CMD down --remove-orphans

echo ""
echo -e "${YELLOW}[INFO] Verifying data volumes (safety check)...${NC}"
VOLUMES=($($COMPOSE_CMD config --volumes 2>/dev/null || echo ""))

if [ ${#VOLUMES[@]} -gt 0 ]; then
    for volume in "${VOLUMES[@]}"; do
        if docker volume inspect "${PROJECT_ROOT##*/}_${volume}" >/dev/null 2>&1 || \
           docker volume inspect "${volume}" >/dev/null 2>&1; then
            echo -e "${GREEN}[OK] Volume preserved: ${volume}${NC}"
        fi
    done
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}  CPU stack stopped${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Data safety:${NC}"
echo "  - All Docker volumes preserved"
echo "  - Database data safe"
echo "  - Uploaded files safe"
echo ""
echo -e "${YELLOW}Start again with:${NC}"
echo "  ./scripts/start-cpu.sh"
echo ""
