#!/bin/bash
set -e

echo "=== Complete Merge and System Rebuild ==="

# Navigate to project directory
cd /home/ubuntu

# Kill any stuck processes
pkill -f less 2>/dev/null || true
pkill -f git 2>/dev/null || true

# Complete the merge
echo "Adding resolved files to git..."
git add alpha-backend/app/routes/careers_routes.py || true
git add cv-analyzer-frontend/src/lib/api.ts || true
git add cv-analyzer-frontend/src/components/careers/CareersPage.tsx || true

echo "Committing the merge..."
git commit -m "Merge Syed-dev: combine user attribution, delete functionality, and enhanced store management" || echo "Commit may already exist"

echo "Current git status:"
git status --porcelain

echo "Recent commits:"
git log --oneline -3

echo "=== Starting System Rebuild ==="

# Stop containers
echo "Stopping containers..."
docker-compose down || true

# Rebuild and start containers  
echo "Rebuilding and starting containers..."
docker-compose up -d --build

echo "Waiting for containers to start..."
sleep 15

# Check container status
echo "Container status:"
docker-compose ps

echo "=== System rebuild completed! ==="

# Test basic functionality
echo "Testing system health..."
sleep 5
curl -s http://localhost:8000/api/health || echo "Backend not ready yet"

echo "=== All done! ==="
