#!/bin/bash

###############################################################################
# EC2 Setup - CPU-only (no GPU)
#
# Use on: m6i.2xlarge or t3.2xlarge (8 vCPU, 32 GB RAM) for ~20 users.
# Does NOT install NVIDIA Docker. Use docker-compose.cpu.yml to run.
#
# Usage: ./scripts/setup-ec2-cpu.sh [dev|prod]
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENVIRONMENT="${1:-prod}"

if [ "$ENVIRONMENT" != "dev" ] && [ "$ENVIRONMENT" != "prod" ]; then
    echo -e "${RED}[ERROR] Environment must be 'dev' or 'prod'${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  EC2 CPU-only Setup: $ENVIRONMENT${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Update system
echo -e "${YELLOW}[STEP 1] Updating system packages...${NC}"
sudo apt-get update
sudo apt-get upgrade -y
echo -e "${GREEN}[OK] System updated${NC}"
echo ""

# Step 2: Install Docker (no NVIDIA)
echo -e "${YELLOW}[STEP 2] Installing Docker...${NC}"
if command -v docker &> /dev/null; then
    echo -e "${GREEN}[OK] Docker already installed${NC}"
else
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo -e "${GREEN}[OK] Docker installed${NC}"
    echo -e "${YELLOW}[WARN] Log out and back in for Docker group${NC}"
fi
echo ""

# Step 3: Docker Compose
echo -e "${YELLOW}[STEP 3] Installing Docker Compose...${NC}"
if docker compose version >/dev/null 2>&1 || command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}[OK] Docker Compose already installed${NC}"
else
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}[OK] Docker Compose installed${NC}"
fi
echo ""

# Step 4: Git
echo -e "${YELLOW}[STEP 4] Installing Git...${NC}"
if command -v git &> /dev/null; then
    echo -e "${GREEN}[OK] Git already installed${NC}"
else
    sudo apt-get install -y git
    echo -e "${GREEN}[OK] Git installed${NC}"
fi
echo ""

# Step 5: Clone/sync repo
echo -e "${YELLOW}[STEP 5] Setting up repository...${NC}"
if [ -d "/home/ubuntu/alpha-cv" ]; then
    echo -e "${GREEN}[OK] Repository exists${NC}"
    cd /home/ubuntu/alpha-cv
    git fetch origin 2>/dev/null || true
    git checkout main 2>/dev/null || true
    git pull origin main 2>/dev/null || true
else
    cd /home/ubuntu
    read -p "Git repository URL (or Enter for default): " REPO_URL
    REPO_URL="${REPO_URL:-https://github.com/your-org/alpha-cv.git}"
    git clone "$REPO_URL" alpha-cv
    cd alpha-cv
    git checkout main
    echo -e "${GREEN}[OK] Repository cloned${NC}"
fi
echo ""

# Step 6: Directories
echo -e "${YELLOW}[STEP 6] Creating directories...${NC}"
mkdir -p alpha-backend/uploads/cvs
mkdir -p alpha-backend/uploads/jds
mkdir -p nginx-cache
echo -e "${GREEN}[OK] Directories created${NC}"
echo ""

# Step 7: Environment
echo -e "${YELLOW}[STEP 7] Environment file...${NC}"
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}[WARN] Created .env from .env.example - edit with production values${NC}"
    else
        echo -e "${RED}[ERROR] .env.example not found${NC}"
    fi
else
    echo -e "${GREEN}[OK] .env exists${NC}"
fi
echo ""

# Step 8: Script permissions
echo -e "${YELLOW}[STEP 8] Script permissions...${NC}"
chmod +x scripts/*.sh 2>/dev/null || true
chmod +x scripts/**/*.sh 2>/dev/null || true
echo -e "${GREEN}[OK] Done${NC}"
echo ""

# Step 9: Verify
echo -e "${YELLOW}[STEP 9] Verifying...${NC}"
echo "Docker: $(docker --version)"
echo "Compose: $(docker compose version 2>/dev/null || docker-compose --version)"
echo "Git: $(git --version)"
echo -e "${GREEN}[OK] CPU setup verified (no GPU)${NC}"
echo ""

# Step 10: Start
echo -e "${YELLOW}[STEP 10] Start application (CPU stack)?${NC}"
echo "  Uses: docker-compose.cpu.yml (backend runs on CPU)"
echo ""
read -p "Start now? (y/n): " START_NOW

if [ "$START_NOW" = "y" ] || [ "$START_NOW" = "Y" ]; then
    ./scripts/start-cpu.sh
    echo -e "${GREEN}[OK] CPU stack started${NC}"
else
    echo "Start later with: ./scripts/start-cpu.sh"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}  CPU setup complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Compose file: docker-compose.cpu.yml"
echo "Start:        ./scripts/start-cpu.sh"
echo "Rebuild:      ./scripts/start-cpu.sh rebuild"
echo ""
