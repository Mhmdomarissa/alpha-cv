#!/bin/bash
set -e

echo "Starting system rebuild..."

# Kill any stuck processes
pkill -f less || true
pkill -f git || true

# Navigate to project directory
cd /home/ubuntu

# Stop and rebuild the system
echo "Stopping containers..."
docker-compose down

echo "Rebuilding and starting containers..."
docker-compose up -d --build

echo "System rebuild completed!"

# Wait a moment for containers to start
sleep 10

# Check system status
echo "Checking system status..."
docker-compose ps

echo "Done!"
