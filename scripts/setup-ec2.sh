#!/bin/bash

###############################################################################
# EC2 Initial Setup Script
# 
# This script sets up a fresh EC2 g4dn.xlarge instance with:
# - Docker and Docker Compose
# - NVIDIA Docker runtime (for GPU)
# - Git repository clone
# - Environment configuration
# - Database initialization
# - Application startup
# 
# Usage: ./scripts/setup-ec2.sh [dev|prod]
# 
# Run this ONCE on a new EC2 instance
###############################################################################

set -e  # Exit on any error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ENVIRONMENT="${1:-prod}"

if [ "$ENVIRONMENT" != "dev" ] && [ "$ENVIRONMENT" != "prod" ]; then
    echo -e "${RED}[ERROR] Environment must be 'dev' or 'prod'${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  EC2 Initial Setup: $ENVIRONMENT${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Update system
echo -e "${YELLOW}[STEP 1] Updating system packages...${NC}"
sudo apt-get update
sudo apt-get upgrade -y
echo -e "${GREEN}[OK] System updated${NC}"
echo ""

# Step 2: Install Docker
echo -e "${YELLOW}[STEP 2] Installing Docker...${NC}"
if command -v docker &> /dev/null; then
    echo -e "${GREEN}[OK] Docker already installed${NC}"
else
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo -e "${GREEN}[OK] Docker installed${NC}"
    echo -e "${YELLOW}[WARN] Please log out and back in for Docker group to take effect${NC}"
fi
echo ""

# Step 3: Install Docker Compose
echo -e "${YELLOW}[STEP 3] Installing Docker Compose...${NC}"
if command -v docker-compose &> /dev/null || docker compose version >/dev/null 2>&1; then
    echo -e "${GREEN}[OK] Docker Compose already installed${NC}"
else
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}[OK] Docker Compose installed${NC}"
fi
echo ""

# Step 4: Install NVIDIA Docker (for GPU support)
echo -e "${YELLOW}[STEP 4] Installing NVIDIA Docker runtime...${NC}"
if [ -f "/etc/docker/daemon.json" ] && grep -q "nvidia" /etc/docker/daemon.json; then
    echo -e "${GREEN}[OK] NVIDIA Docker runtime already configured${NC}"
else
    distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
    curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
    curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
    sudo apt-get update
    sudo apt-get install -y nvidia-docker2
    sudo systemctl restart docker
    echo -e "${GREEN}[OK] NVIDIA Docker runtime installed${NC}"
fi
echo ""

# Step 5: Install Git
echo -e "${YELLOW}[STEP 5] Installing Git...${NC}"
if command -v git &> /dev/null; then
    echo -e "${GREEN}[OK] Git already installed${NC}"
else
    sudo apt-get install -y git
    echo -e "${GREEN}[OK] Git installed${NC}"
fi
echo ""

# Step 6: Clone repository
echo -e "${YELLOW}[STEP 6] Setting up repository...${NC}"
if [ -d "/home/ubuntu/alpha-cv" ]; then
    echo -e "${GREEN}[OK] Repository already exists${NC}"
    cd /home/ubuntu/alpha-cv
    git fetch origin
    git checkout main
    git pull origin main
else
    echo "Cloning repository..."
    cd /home/ubuntu
    # Replace with your actual repository URL
    read -p "Enter your GitHub repository URL (or press Enter to use default): " REPO_URL
    REPO_URL="${REPO_URL:-https://github.com/your-org/alpha-cv.git}"
    
    git clone "$REPO_URL" alpha-cv
    cd alpha-cv
    git checkout main
    echo -e "${GREEN}[OK] Repository cloned${NC}"
fi
echo ""

# Step 7: Create necessary directories
echo -e "${YELLOW}[STEP 7] Creating directories...${NC}"
mkdir -p alpha-backend/uploads/cvs
mkdir -p alpha-backend/uploads/jds
mkdir -p nginx-cache
echo -e "${GREEN}[OK] Directories created${NC}"
echo ""

# Step 8: Set up environment file
echo -e "${YELLOW}[STEP 8] Setting up environment file...${NC}"
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}[WARN] Created .env from .env.example${NC}"
        echo -e "${RED}[IMPORTANT] Edit .env with your production values!${NC}"
        echo "   Run: nano .env"
    else
        echo -e "${RED}[ERROR] .env.example not found${NC}"
        echo "Please create .env file manually"
    fi
else
    echo -e "${GREEN}[OK] .env file exists${NC}"
fi
echo ""

# Step 9: Make scripts executable
echo -e "${YELLOW}[STEP 9] Setting script permissions...${NC}"
chmod +x scripts/*.sh
chmod +x scripts/**/*.sh 2>/dev/null || true
echo -e "${GREEN}[OK] Scripts are executable${NC}"
echo ""

# Step 10: Verify setup
echo -e "${YELLOW}[STEP 10] Verifying setup...${NC}"
echo "Docker version: $(docker --version)"
echo "Docker Compose version: $(docker-compose --version 2>/dev/null || docker compose version)"
echo "Git version: $(git --version)"
echo "NVIDIA Docker: $(docker info 2>/dev/null | grep -i nvidia || echo 'Not configured')"
echo -e "${GREEN}[OK] Setup verified${NC}"
echo ""

# Step 11: Initialize databases and start services
echo -e "${YELLOW}[STEP 11] Starting application...${NC}"
echo "This will:"
echo "  - Pull Docker images (may take 10-15 minutes)"
echo "  - Initialize databases"
echo "  - Start all services"
echo ""
read -p "Start application now? (y/n): " START_NOW

if [ "$START_NOW" = "y" ] || [ "$START_NOW" = "Y" ]; then
    echo ""
    echo -e "${YELLOW}[INFO] Starting application...${NC}"
    ./scripts/start.sh
    
    echo ""
    echo -e "${YELLOW}[INFO] Waiting for services to be ready...${NC}"
    sleep 30
    
    # Check if services are running
    if docker-compose ps | grep -q "Up"; then
        echo -e "${GREEN}[OK] Services are running${NC}"
    else
        echo -e "${YELLOW}[WARN] Some services may still be starting${NC}"
        echo "Check logs: docker-compose logs -f"
    fi
else
    echo -e "${YELLOW}[INFO] Skipping application start${NC}"
    echo "Start manually with: ./scripts/start.sh"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Configure environment variables:"
echo "   nano .env"
echo ""
echo "2. If you skipped application start, run:"
echo "   ./scripts/start.sh"
echo ""
echo "3. Verify services:"
echo "   docker-compose ps"
echo "   curl http://localhost/api/health"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "  - Configure your .env file with API keys and secrets"
echo "  - Set up SSL certificates for production"
echo "  - Configure firewall rules (ports 80, 443)"
echo "  - Set up regular backups"
echo ""
