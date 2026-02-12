#!/bin/bash

###############################################################################
# Unified Stop Script
# 
# Stops all services gracefully
# Preserves all data (volumes are NOT removed)
# 
# Usage: ./scripts/stop.sh
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

# Detect docker compose command
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}[ERROR] Docker Compose not found${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Stopping CV Analyzer System${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}[ERROR] docker-compose.yml not found!${NC}"
    exit 1
fi

# Stop services gracefully
echo -e "${YELLOW}[INFO] Stopping all services...${NC}"
$COMPOSE_CMD stop

# Remove containers (but NOT volumes - data is safe)
echo -e "${YELLOW}[INFO] Removing containers...${NC}"
$COMPOSE_CMD down --remove-orphans

# Verify volumes are still intact
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
echo -e "${GREEN}  System Stopped${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Data Safety:${NC}"
echo "  - All Docker volumes preserved"
echo "  - Database data safe"
echo "  - Uploaded files safe"
echo ""
echo -e "${YELLOW}Start again with:${NC}"
echo "  ./scripts/start.sh"
echo ""
