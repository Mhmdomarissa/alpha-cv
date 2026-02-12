#!/bin/bash

###############################################################################
# Unified Deployment Script
# 
# Deploys latest code from main branch to production
# 
# SAFETY GUARANTEES:
# - NEVER touches Docker volumes (data is safe)
# - NEVER deletes databases
# - NEVER removes uploaded files
# - Gracefully restarts containers
# 
# Usage: ./scripts/deploy.sh
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
echo -e "${BLUE}  Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Verify environment
echo -e "${YELLOW}[STEP 1] Verifying environment...${NC}"
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}[ERROR] docker-compose.yml not found!${NC}"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo -e "${RED}[ERROR] .env file not found!${NC}"
    echo "Please create .env file with your configuration"
    exit 1
fi

echo -e "${GREEN}[OK] Environment verified${NC}"
echo ""

# Step 2: Pull latest code from main branch
echo -e "${YELLOW}[STEP 2] Pulling latest code from main branch...${NC}"
git fetch origin main

CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}[INFO] Currently on branch: $CURRENT_BRANCH${NC}"
    echo "Switching to main branch..."
    git checkout main
fi

git pull origin main
LATEST_COMMIT=$(git rev-parse --short HEAD)
echo -e "${GREEN}[OK] Code updated to commit: $LATEST_COMMIT${NC}"
echo ""

# Step 3: Verify data volumes exist (safety check)
echo -e "${YELLOW}[STEP 3] Verifying data volumes (safety check)...${NC}"
REQUIRED_VOLUMES=("postgres_data" "qdrant_data" "redis_data")
MISSING_VOLUMES=()

for volume in "${REQUIRED_VOLUMES[@]}"; do
    VOLUME_NAME="${PROJECT_ROOT##*/}_${volume}"
    if docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1 || \
       docker volume inspect "$volume" >/dev/null 2>&1; then
        echo -e "${GREEN}[OK] Volume exists: ${volume}${NC}"
    else
        echo -e "${YELLOW}[WARN] Volume not found: ${volume} (will be created on first start)${NC}"
        MISSING_VOLUMES+=("$volume")
    fi
done

if [ ${#MISSING_VOLUMES[@]} -eq 0 ]; then
    echo -e "${GREEN}[OK] All data volumes verified${NC}"
else
    echo -e "${YELLOW}[WARN] Some volumes missing (first deployment?)${NC}"
fi
echo ""

# Step 4: Verify uploaded files directory
echo -e "${YELLOW}[STEP 4] Verifying uploaded files directory...${NC}"
UPLOADS_DIR="$PROJECT_ROOT/alpha-backend/uploads"
if [ -d "$UPLOADS_DIR" ]; then
    FILE_COUNT=$(find "$UPLOADS_DIR" -type f 2>/dev/null | wc -l)
    echo -e "${GREEN}[OK] Uploads directory exists ($FILE_COUNT files)${NC}"
else
    echo -e "${YELLOW}[WARN] Uploads directory not found (creating...)${NC}"
    mkdir -p "$UPLOADS_DIR/cvs" "$UPLOADS_DIR/jds"
    echo -e "${GREEN}[OK] Uploads directory created${NC}"
fi
echo ""

# Step 5: Build new Docker images
echo -e "${YELLOW}[STEP 5] Building new Docker images...${NC}"
echo "This may take a few minutes..."
$COMPOSE_CMD build --no-cache backend frontend
echo -e "${GREEN}[OK] Docker images built successfully${NC}"
echo ""

# Step 6: Gracefully restart services (data volumes remain mounted)
echo -e "${YELLOW}[STEP 6] Restarting services (data safe)...${NC}"

# Stop only application containers (not databases)
echo "Stopping application containers..."
$COMPOSE_CMD stop backend frontend nginx 2>/dev/null || true

# Remove old application containers
echo "Removing old application containers..."
$COMPOSE_CMD rm -f backend frontend nginx 2>/dev/null || true

# Start services (volumes automatically remount)
echo "Starting new containers..."
$COMPOSE_CMD up -d backend frontend nginx

echo -e "${GREEN}[OK] Services restarted${NC}"
echo ""

# Step 7: Wait for services to be healthy
echo -e "${YELLOW}[STEP 7] Waiting for services to be healthy...${NC}"
MAX_WAIT=120
WAIT_TIME=0
HEALTHY=false

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    if $COMPOSE_CMD ps backend | grep -q "healthy\|Up"; then
        if curl -f http://localhost/api/health >/dev/null 2>&1; then
            HEALTHY=true
            break
        fi
    fi
    echo -n "."
    sleep 5
    WAIT_TIME=$((WAIT_TIME + 5))
done

echo ""

if [ "$HEALTHY" = true ]; then
    echo -e "${GREEN}[OK] Services are healthy${NC}"
else
    echo -e "${YELLOW}[WARN] Services may not be fully healthy yet${NC}"
    echo "Check logs: $COMPOSE_CMD logs backend"
fi
echo ""

# Step 8: Verify deployment
echo -e "${YELLOW}[STEP 8] Verifying deployment...${NC}"

# Check containers are running
if $COMPOSE_CMD ps | grep -q "Up"; then
    echo -e "${GREEN}[OK] Containers are running${NC}"
else
    echo -e "${RED}[ERROR] Some containers are not running${NC}"
    $COMPOSE_CMD ps
    exit 1
fi

# Check API health
if curl -f http://localhost/api/health >/dev/null 2>&1; then
    echo -e "${GREEN}[OK] API is responding${NC}"
else
    echo -e "${RED}[ERROR] API is not responding${NC}"
    exit 1
fi

# Verify data volumes still exist
for volume in "${REQUIRED_VOLUMES[@]}"; do
    VOLUME_NAME="${PROJECT_ROOT##*/}_${volume}"
    if docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1 || \
       docker volume inspect "$volume" >/dev/null 2>&1; then
        echo -e "${GREEN}[OK] Data volume intact: ${volume}${NC}"
    else
        echo -e "${RED}[ERROR] Data volume missing: ${volume}${NC}"
        exit 1
    fi
done

echo ""

# Step 9: Final summary
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Summary:${NC}"
echo "  - Code updated to: $LATEST_COMMIT"
echo "  - Services restarted"
echo "  - Data volumes intact"
echo "  - Uploaded files safe"
echo ""
echo -e "${YELLOW}Verify deployment:${NC}"
echo "  - Health check: curl http://localhost/api/health"
echo "  - View logs: $COMPOSE_CMD logs -f backend"
echo "  - Check containers: $COMPOSE_CMD ps"
echo ""
echo -e "${GREEN}Deployment successful!${NC}"
