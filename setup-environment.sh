#!/bin/bash

# Environment Setup Script for CV Analyzer
# ========================================

set -e

echo "🚀 Setting up CV Analyzer environment..."

# Function to create environment file
create_env_file() {
    local env_type=$1
    local env_file=".env.${env_type}"
    
    echo "📝 Creating ${env_file}..."
    
    case $env_type in
        "development")
            cat > "$env_file" << 'EOF'
# Development Environment Configuration
# =====================================

# Application Environment
NODE_ENV=development
ENVIRONMENT=development

# Database Configuration
POSTGRES_PASSWORD=dev_password_123
POSTGRES_DB=cv_database
POSTGRES_USER=cv_user

# Qdrant Configuration - Development Optimized
QDRANT_HOST=qdrant
QDRANT_PORT=6333
QDRANT_MAX_CONNECTIONS=10

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Authentication
JWT_SECRET_KEY=dev_jwt_secret_key_123
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Rate Limiting - Development Values
MAX_GLOBAL_CONCURRENT=50
CIRCUIT_BREAKER_THRESHOLD=10
CIRCUIT_BREAKER_RECOVERY_TIME=300

# Job Queue Configuration - Development Optimized
MIN_QUEUE_WORKERS=2
MAX_QUEUE_WORKERS=20
MEMORY_THRESHOLD_MB=4096
CPU_THRESHOLD_PERCENT=90
QUEUE_SIZE_THRESHOLD=1000

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_BASE=http://localhost:8000/api
BACKEND_URL=http://backend:8000

# Performance Monitoring
ENABLE_PERFORMANCE_MONITORING=false
LOG_LEVEL=DEBUG
ENABLE_REQUEST_LOGGING=true

# Security
CORS_ORIGINS=http://localhost:3000,http://localhost:8000
SECURE_COOKIES=false
TRUSTED_PROXY=false

# Redis Configuration - Local Development
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_USERNAME=
REDIS_DB=0
REDIS_MAXMEMORY=100mb
REDIS_MAXMEMORY_POLICY=allkeys-lru

# Monitoring
ENABLE_METRICS=false
PROMETHEUS_ENDPOINT=http://prometheus:9090

# Security
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ORIGINS=http://localhost:3000,http://localhost:8000

# File Upload Limits
MAX_FILE_SIZE_MB=50
MAX_FILES_PER_REQUEST=10

# Logging
LOG_LEVEL=DEBUG
LOG_FORMAT=json

# Performance Tuning - Development
UVICORN_WORKERS=1
UVICORN_WORKER_CLASS=uvicorn.workers.UvicornWorker

# Local Development Specific
# ==========================
# Enable local development authentication
LOCAL_AUTH=true

# Memory Management
PYTHON_MEMORY_LIMIT=4096
GARBAGE_COLLECTION_THRESHOLD=80

# Connection Pooling
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=5

# Async Processing
MAX_CONCURRENT_REQUESTS=20
REQUEST_TIMEOUT=30
WORKER_TIMEOUT=60
EOF
            ;;
        "production")
            cat > "$env_file" << 'EOF'
# Production Environment Configuration - AWS Optimized
# ====================================================
# Optimized for: 4 CPU cores, 15GB RAM, 40 concurrent users

# Application Environment
NODE_ENV=production
ENVIRONMENT=production

# Database Configuration
POSTGRES_PASSWORD=your_secure_postgres_password_here
POSTGRES_DB=cv_database
POSTGRES_USER=cv_user

# Qdrant Configuration - Optimized for 4 CPU cores
QDRANT_HOST=qdrant
QDRANT_PORT=6333
QDRANT_MAX_CONNECTIONS=20

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Authentication
JWT_SECRET_KEY=your_very_secure_jwt_secret_key_here
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Rate Limiting - Optimized for 40 concurrent users
MAX_GLOBAL_CONCURRENT=80
CIRCUIT_BREAKER_THRESHOLD=30
CIRCUIT_BREAKER_RECOVERY_TIME=300

# Job Queue Configuration - Optimized for 4 CPU cores, 15GB RAM
MIN_QUEUE_WORKERS=4
MAX_QUEUE_WORKERS=16
MEMORY_THRESHOLD_MB=12288
CPU_THRESHOLD_PERCENT=80
QUEUE_SIZE_THRESHOLD=2000

# Frontend Configuration
NEXT_PUBLIC_API_URL=https://alphacv.alphadatarecruitment.ae
NEXT_PUBLIC_API_BASE=https://alphacv.alphadatarecruitment.ae/api
BACKEND_URL=http://backend:8000

# Performance Monitoring
ENABLE_PERFORMANCE_MONITORING=true
LOG_LEVEL=INFO
ENABLE_REQUEST_LOGGING=true

# Security
CORS_ORIGINS=https://alphacv.alphadatarecruitment.ae
SECURE_COOKIES=true
TRUSTED_PROXY=true

# Redis Configuration - Redis Cloud
REDIS_HOST=redis-15660.c322.us-east-1-2.ec2.redns.redis-cloud.com
REDIS_PORT=15660
REDIS_PASSWORD=Qcz5z02ZjhPmPy3bSimeJoqB3WoJhr7S
REDIS_USERNAME=default
REDIS_DB=0
REDIS_MAXMEMORY=30mb
REDIS_MAXMEMORY_POLICY=allkeys-lru

# Monitoring
ENABLE_METRICS=true
PROMETHEUS_ENDPOINT=http://prometheus:9090

# Security
ALLOWED_HOSTS=alphacv.alphadatarecruitment.ae,localhost
CORS_ORIGINS=https://alphacv.alphadatarecruitment.ae

# File Upload Limits
MAX_FILE_SIZE_MB=50
MAX_FILES_PER_REQUEST=10

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json

# Performance Tuning - Optimized for 4 CPU cores
UVICORN_WORKERS=4
UVICORN_WORKER_CLASS=uvicorn.workers.UvicornWorker

# AWS Instance Specific Optimizations
# ===================================
# CPU: 4 cores (Intel Xeon Platinum 8259CL @ 2.50GHz)
# RAM: 15GB total, 12GB available
# Target: 40 concurrent users

# Memory Management
PYTHON_MEMORY_LIMIT=12288
GARBAGE_COLLECTION_THRESHOLD=80

# Connection Pooling
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10

# Async Processing
MAX_CONCURRENT_REQUESTS=40
REQUEST_TIMEOUT=30
WORKER_TIMEOUT=60
EOF
            ;;
        "local-redis")
            cat > "$env_file" << 'EOF'
# Development Environment Configuration - Local Redis
# ==================================================

# Application Environment
NODE_ENV=development
ENVIRONMENT=development

# Database Configuration
POSTGRES_PASSWORD=dev_password_123
POSTGRES_DB=cv_database
POSTGRES_USER=cv_user

# Qdrant Configuration - Development Optimized
QDRANT_HOST=qdrant
QDRANT_PORT=6333
QDRANT_MAX_CONNECTIONS=10

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Authentication
JWT_SECRET_KEY=dev_jwt_secret_key_123
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Rate Limiting - Development Values
MAX_GLOBAL_CONCURRENT=50
CIRCUIT_BREAKER_THRESHOLD=10
CIRCUIT_BREAKER_RECOVERY_TIME=300

# Job Queue Configuration - Development Optimized
MIN_QUEUE_WORKERS=2
MAX_QUEUE_WORKERS=20
MEMORY_THRESHOLD_MB=4096
CPU_THRESHOLD_PERCENT=90
QUEUE_SIZE_THRESHOLD=1000

# Frontend Configuration - FIXED
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_BASE=http://localhost:8000/api
BACKEND_URL=http://backend:8000

# Performance Monitoring
ENABLE_PERFORMANCE_MONITORING=false
LOG_LEVEL=DEBUG
ENABLE_REQUEST_LOGGING=true

# Security
CORS_ORIGINS=http://localhost:3000,http://localhost:8000
SECURE_COOKIES=false
TRUSTED_PROXY=false

# Redis Configuration - Local Development
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_USERNAME=
REDIS_DB=0
REDIS_MAXMEMORY=100mb
REDIS_MAXMEMORY_POLICY=allkeys-lru

# Monitoring
ENABLE_METRICS=false
PROMETHEUS_ENDPOINT=http://prometheus:9090

# Security
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ORIGINS=http://localhost:3000,http://localhost:8000

# File Upload Limits
MAX_FILE_SIZE_MB=50
MAX_FILES_PER_REQUEST=10

# Logging
LOG_LEVEL=DEBUG
LOG_FORMAT=json

# Performance Tuning - Development
UVICORN_WORKERS=1
UVICORN_WORKER_CLASS=uvicorn.workers.UvicornWorker

# Local Development Specific
# ==========================
# Enable local development authentication
LOCAL_AUTH=true

# Memory Management
PYTHON_MEMORY_LIMIT=4096
GARBAGE_COLLECTION_THRESHOLD=80

# Connection Pooling
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=5

# Async Processing
MAX_CONCURRENT_REQUESTS=20
REQUEST_TIMEOUT=30
WORKER_TIMEOUT=60
EOF
            ;;
    esac
    
    echo "✅ Created ${env_file}"
}

# Main setup logic
echo "🔧 Choose your environment setup:"
echo "1) Development (with local Redis)"
echo "2) Production"
echo "3) Development with Redis Cloud"
echo "4) All environments"

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        create_env_file "local-redis"
        echo "📋 To use this environment:"
        echo "   cp .env.local-redis .env"
        echo "   # Edit .env with your actual API keys"
        echo "   docker-compose up"
        ;;
    2)
        create_env_file "production"
        echo "📋 To use this environment:"
        echo "   cp .env.production .env"
        echo "   # Edit .env with your actual API keys and secrets"
        echo "   docker-compose -f docker-compose.production.yml up"
        ;;
    3)
        create_env_file "development"
        echo "📋 To use this environment:"
        echo "   cp .env.development .env"
        echo "   # Edit .env with your actual API keys"
        echo "   docker-compose up"
        ;;
    4)
        create_env_file "local-redis"
        create_env_file "development"
        create_env_file "production"
        echo "📋 All environment files created!"
        echo "   Choose one and copy it to .env:"
        echo "   cp .env.local-redis .env    # For local development"
        echo "   cp .env.production .env     # For production"
        echo "   cp .env.development .env    # For development with Redis Cloud"
        ;;
    *)
        echo "❌ Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "🎉 Environment setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Copy the appropriate .env file to .env"
echo "2. Edit .env with your actual API keys and secrets"
echo "3. Run: docker-compose up"
echo ""
echo "🔑 Required API keys to configure:"
echo "   - OPENAI_API_KEY: Your OpenAI API key"
echo "   - JWT_SECRET_KEY: A secure secret for JWT tokens"
echo "   - POSTGRES_PASSWORD: Database password"
echo ""
echo "🚀 Happy coding!"
