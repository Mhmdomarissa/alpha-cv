#!/bin/bash

###############################################################################
# Unified Start Script
# 
# Starts all services using docker-compose.yml (production config)
# Works for both DEV and PROD servers
# 
# Usage: ./scripts/start.sh [rebuild]
#   rebuild - Optional: rebuild images before starting
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
    echo "Install: sudo apt-get install docker-compose-plugin"
    exit 1
fi

REBUILD="${1:-}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Starting CV Analyzer System${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}[ERROR] docker-compose.yml not found!${NC}"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}[WARN] .env file not found${NC}"
    echo "Please create .env file with your configuration"
fi

# Stop existing containers (if any)
echo -e "${YELLOW}[INFO] Stopping existing containers...${NC}"
$COMPOSE_CMD down --remove-orphans 2>/dev/null || true

# Rebuild images if requested
if [ "$REBUILD" == "rebuild" ]; then
    echo -e "${YELLOW}[INFO] Rebuilding Docker images (no cache)...${NC}"
    $COMPOSE_CMD build --no-cache
    echo -e "${GREEN}[OK] Images rebuilt${NC}"
fi

# Start services
echo -e "${YELLOW}[INFO] Starting all services...${NC}"
$COMPOSE_CMD up -d

# Wait a moment for services to initialize
sleep 5

# Show container status
echo ""
echo -e "${YELLOW}[INFO] Container status:${NC}"
$COMPOSE_CMD ps

# Health check function
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

# Wait for critical services (best effort)
echo ""
wait_for_service "http://localhost/api/health" "Backend API" 180 || true
wait_for_service "http://localhost" "Nginx" 60 || true

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}  System Started Successfully!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Services:${NC}"
echo "  - Frontend:  http://localhost"
echo "  - Backend:   http://localhost/api"
echo "  - API Docs:  http://localhost/docs"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  - View logs:    $COMPOSE_CMD logs -f"
echo "  - Stop system:  ./scripts/stop.sh"
echo "  - Deploy:       ./scripts/deploy.sh"
echo ""
