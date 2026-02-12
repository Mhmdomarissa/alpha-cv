#!/bin/bash

# System Monitoring Script for g4dn.xlarge
# ========================================

echo "🔍 CV Analyzer System Monitor - g4dn.xlarge"
echo "============================================="
echo ""

# System Resources
echo "📊 System Resources:"
echo "CPU Cores: $(nproc)"
echo "Memory: $(free -h | grep Mem | awk '{print $2 " total, " $7 " available"}')"
echo "Disk Space: $(df -h / | tail -1 | awk '{print $4 " available out of " $2}')"
echo ""

# Docker Status
echo "🐳 Docker Services Status:"
if [ -f "/home/ubuntu/docker-compose.optimized.yml" ]; then
    docker-compose -f docker-compose.optimized.yml ps
else
    docker-compose ps
fi
echo ""

# Resource Usage
echo "📈 Resource Usage:"
echo "Memory Usage:"
free -h
echo ""
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print "CPU Usage: " 100 - $1 "%"}'
echo ""

# Docker Container Stats
echo "🐳 Docker Container Resource Usage:"
if [ -f "/home/ubuntu/docker-compose.optimized.yml" ]; then
    docker-compose -f docker-compose.optimized.yml stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
else
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
fi
echo ""

# Service Health Checks
echo "🏥 Service Health Checks:"
echo "Backend API:"
if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "✅ Backend API is healthy"
    # Get detailed health info
    echo "📊 Health Details:"
    curl -s http://localhost:8000/api/health | jq . 2>/dev/null || curl -s http://localhost:8000/api/health
else
    echo "❌ Backend API is not responding"
fi
echo ""

echo "Frontend:"
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend is healthy"
else
    echo "❌ Frontend is not responding"
fi
echo ""

echo "Database:"
if docker exec cv_postgres pg_isready -U cv_user -d cv_database > /dev/null 2>&1; then
    echo "✅ PostgreSQL is healthy"
else
    echo "❌ PostgreSQL is not responding"
fi
echo ""

echo "Redis:"
if docker exec cv_redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is healthy"
else
    echo "❌ Redis is not responding"
fi
echo ""

echo "Qdrant:"
if curl -s http://localhost:6333/collections > /dev/null 2>&1; then
    echo "✅ Qdrant is healthy"
else
    echo "❌ Qdrant is not responding"
fi
echo ""

# Network Status
echo "🌐 Network Status:"
echo "Public IP: 13.62.91.25"
echo "Private IP: 172.31.31.242"
echo ""

# Port Status
echo "🔌 Port Status:"
netstat -tlnp | grep -E ':(80|443|3000|8000|5433|6333|6379)' | awk '{print "Port " $4 " - " $7}'
echo ""

# Recent Logs
echo "📋 Recent Error Logs (last 10 lines):"
if [ -f "/home/ubuntu/docker-compose.optimized.yml" ]; then
    docker-compose -f docker-compose.optimized.yml logs --tail=10 2>&1 | grep -i error || echo "No recent errors found"
else
    docker-compose logs --tail=10 2>&1 | grep -i error || echo "No recent errors found"
fi
echo ""

# Recommendations
echo "💡 Recommendations:"
echo "1. If CPU usage > 80%, consider restarting services"
echo "2. If memory usage > 90%, check for memory leaks"
echo "3. If services are unhealthy, restart them:"
echo "   docker-compose -f docker-compose.optimized.yml restart [service_name]"
echo "4. To view logs: docker-compose -f docker-compose.optimized.yml logs -f [service_name]"
echo "5. To restart all services: docker-compose -f docker-compose.optimized.yml restart"
echo ""

echo "🕐 Monitor completed at: $(date)"
