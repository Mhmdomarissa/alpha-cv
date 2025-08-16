#!/bin/bash

echo "🛑 Stopping CV Analyzer System..."

# Stop all services
echo "⏹️  Stopping all services..."
docker-compose down

# Remove any dangling containers
echo "🧹 Cleaning up containers..."
docker container prune -f

# Check if anything is still running
echo "📊 Checking final status..."
docker ps

echo ""
echo "✅ System stopped successfully!"
echo "📋 To start the system again, run: ./start-system.sh"
