#!/usr/bin/env bash
set -Eeuo pipefail

# Memory-Optimized Start Script for g4dn.xlarge
# =============================================

echo "🚀 Starting CV Analyzer System (Memory Optimized)..."

# Check system resources before starting
echo "📊 Checking system resources..."
free -h
echo ""

# Set memory limits for Docker builds
export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down --remove-orphans 2>/dev/null || true

# Clean up Docker resources
echo "🧹 Cleaning up Docker resources..."
docker system prune -f

# Set memory limits for the build process
echo "⚙️ Setting memory limits for build process..."
ulimit -v 8388608  # 8GB virtual memory limit

# Build with memory constraints
echo "🔧 Building images with memory constraints..."
docker-compose build --parallel --memory=4g --memory-swap=4g 2>/dev/null || \
docker-compose build --parallel

# Start services with memory monitoring
echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 30

# Check service health
echo "🏥 Checking service health..."
docker-compose ps

# Monitor memory usage
echo "📊 Memory usage after startup:"
free -h
echo ""

# Check container resource usage
echo "📈 Container resource usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" 2>/dev/null || echo "No containers running"

# Test API health
echo "🔍 Testing API health..."
if curl -s http://localhost:8000/api/health > /dev/null; then
    echo "✅ API is responding"
else
    echo "❌ API is not responding - check logs"
    echo "📋 Recent backend logs:"
    docker-compose logs --tail=10 backend
fi

echo ""
echo "🎉 System started with memory optimization!"
echo "   🌐 Frontend:   http://localhost:3000"
echo "   🔧 Backend:    http://localhost:8000"
echo "   📚 API Docs:   http://localhost:8000/docs"
echo "   🗄️  Database:  localhost:5433"
echo "   🔍 Qdrant:     http://localhost:6333"
echo ""
echo "📋 Monitor with: docker stats"
echo "📋 Logs with: docker-compose logs -f"
