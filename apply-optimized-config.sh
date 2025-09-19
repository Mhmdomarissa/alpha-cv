#!/usr/bin/env bash
set -Eeuo pipefail

echo "🔧 Applying optimized configuration for high user load..."

# Backup current .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Apply optimizations
echo "📊 Updating Qdrant configuration..."
sed -i 's/QDRANT_MAX_CONNECTIONS=20/QDRANT_MAX_CONNECTIONS=50/' .env
sed -i '/QDRANT_MAX_CONNECTIONS=50/a QDRANT_POOL_SIZE=10\nQDRANT_TIMEOUT=30' .env

echo "📊 Updating Redis configuration..."
sed -i 's/REDIS_MAXMEMORY=30mb/REDIS_MAXMEMORY=512mb/' .env
sed -i 's/REDIS_MAXMEMORY_POLICY=allkeys-lru/REDIS_MAXMEMORY_POLICY=allkeys-lru/' .env

echo "📊 Updating worker configuration..."
sed -i 's/UVICORN_WORKERS=1/UVICORN_WORKERS=2/' .env
sed -i 's/MIN_QUEUE_WORKERS=4/MIN_QUEUE_WORKERS=2/' .env
sed -i 's/MAX_QUEUE_WORKERS=4/MAX_QUEUE_WORKERS=8/' .env

echo "📊 Updating memory thresholds..."
sed -i 's/MEMORY_THRESHOLD_MB=5120/MEMORY_THRESHOLD_MB=8192/' .env
sed -i 's/PYTHON_MEMORY_LIMIT=5120/PYTHON_MEMORY_LIMIT=8192/' .env

echo "📊 Updating connection pooling..."
sed -i 's/DATABASE_POOL_SIZE=20/DATABASE_POOL_SIZE=50/' .env
sed -i 's/DATABASE_MAX_OVERFLOW=10/DATABASE_MAX_OVERFLOW=20/' .env

echo "📊 Updating concurrent request limits..."
sed -i 's/MAX_CONCURRENT_REQUESTS=40/MAX_CONCURRENT_REQUESTS=100/' .env
sed -i 's/MAX_GLOBAL_CONCURRENT=80/MAX_GLOBAL_CONCURRENT=150/' .env

echo "📊 Adding performance optimizations..."
cat >> .env << 'EOF'

# Performance Optimizations for High Load
# =======================================
# Optimized for 100-500 concurrent users

# Qdrant Performance
QDRANT_OPTIMIZATION_THREADS=4
QDRANT_WAL_CAPACITY_MB=512
QDRANT_MAX_SEARCH_REQUESTS=100

# Redis Performance
REDIS_CONNECTION_POOL_SIZE=20
REDIS_SOCKET_KEEPALIVE=true
REDIS_SOCKET_KEEPALIVE_OPTIONS=1,3,5

# Database Performance
POSTGRES_SHARED_BUFFERS=1GB
POSTGRES_EFFECTIVE_CACHE_SIZE=4GB
POSTGRES_WORK_MEM=32MB
POSTGRES_MAINTENANCE_WORK_MEM=512MB

# Application Performance
ENABLE_RESPONSE_COMPRESSION=true
ENABLE_REQUEST_CACHING=true
CACHE_TTL_SECONDS=300
ENABLE_QUERY_OPTIMIZATION=true

# Monitoring Enhancements
ENABLE_DETAILED_METRICS=true
METRICS_COLLECTION_INTERVAL=30
ENABLE_PERFORMANCE_PROFILING=false

# Connection Optimizations
HTTP_KEEPALIVE_TIMEOUT=30
HTTP_MAX_CONNECTIONS=1000
TCP_KEEPALIVE=true
EOF

echo "✅ Configuration optimized successfully!"
echo "📋 Summary of changes:"
echo "   • Qdrant: 50 max connections, 10 pool size"
echo "   • Redis: 512MB memory limit"
echo "   • Workers: 2 uvicorn, 2-8 queue workers"
echo "   • Memory: 8GB thresholds"
echo "   • Connections: 50 DB pool, 100 concurrent requests"
echo "   • Performance: Enhanced caching and optimization"
echo ""
echo "🔄 Restart the system to apply changes:"
echo "   ./start-system-optimized.sh rebuild"