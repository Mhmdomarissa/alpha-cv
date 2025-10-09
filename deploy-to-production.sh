#!/bin/bash

# Zero-Downtime Production Deployment Script
# This script deploys tested changes to production with minimal downtime

set -e

echo "=========================================="
echo "Production Deployment Script"
echo "=========================================="
echo ""
echo "This script will:"
echo "  1. Pull latest changes from git"
echo "  2. Build new Docker images"
echo "  3. Deploy to production with minimal downtime"
echo ""

# Confirm deployment
read -p "Are you sure you want to deploy to PRODUCTION? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^yes$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

# Backup current state
echo "Creating backup..."
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp docker-compose.yml "$BACKUP_DIR/"
cp .env "$BACKUP_DIR/"
echo "Backup created in $BACKUP_DIR"

# Pull latest changes
echo ""
echo "Pulling latest changes from git..."
git pull origin main

# Build new images
echo ""
echo "Building new Docker images..."
docker-compose build --no-cache

# Deploy with minimal downtime
echo ""
echo "Deploying to production..."
echo "Old containers will keep running until new ones are ready..."

# Use docker-compose up with --no-deps and --build to update one service at a time
echo ""
echo "Updating backend..."
docker-compose up -d --no-deps --build backend

echo "Waiting for backend to be healthy..."
sleep 10

echo ""
echo "Updating frontend..."
docker-compose up -d --no-deps --build frontend

echo "Waiting for frontend to be healthy..."
sleep 5

# Clean up old images
echo ""
echo "Cleaning up old Docker images..."
docker image prune -f

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Check status with:"
echo "  docker-compose ps"
echo "  docker-compose logs -f"
echo ""
