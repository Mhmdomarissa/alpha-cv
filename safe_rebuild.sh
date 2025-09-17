#!/bin/bash
set -e

echo "=== Safe System Rebuild (Preserving Database) ==="

# Navigate to project directory
cd /home/ubuntu

# Kill any stuck processes
pkill -f less 2>/dev/null || true
pkill -f git 2>/dev/null || true

echo "📦 Current container status:"
docker-compose ps

echo "🛑 Stopping containers (keeping volumes)..."
docker-compose stop

echo "🧹 Removing containers (volumes will be preserved)..."
docker-compose rm -f

echo "🔧 Rebuilding images..."
docker-compose build --no-cache

echo "🚀 Starting containers with preserved data..."
docker-compose up -d

echo "⏳ Waiting for containers to initialize..."
sleep 20

echo "📊 Container status:"
docker-compose ps

echo "🔍 Checking container logs..."
echo "--- Backend logs ---"
docker-compose logs --tail=10 backend

echo "--- Frontend logs ---"
docker-compose logs --tail=10 frontend

echo "--- Database logs ---"
docker-compose logs --tail=5 postgres

echo "--- Qdrant logs ---"
docker-compose logs --tail=5 qdrant

echo "🏥 Testing system health..."
sleep 5

# Test backend health
echo "Testing backend..."
curl -s http://localhost:8000/api/health || echo "❌ Backend not ready yet"

# Test frontend
echo "Testing frontend..."
curl -s http://localhost:3000 > /dev/null && echo "✅ Frontend is up" || echo "❌ Frontend not ready yet"

echo "=== Rebuild completed! ==="
echo "🎉 Database volumes preserved:"
docker volume ls | grep -E "(postgres|qdrant)" || echo "No volumes found"

echo "📝 Recent commits:"
git log --oneline -3

echo "✅ System is ready for testing!"
