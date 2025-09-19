#!/bin/bash

# Local Development Setup Script
# ==============================
# Sets up local development environment with Redis Cloud

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "🚀 Setting up Local Development Environment with Redis Cloud"
echo "============================================================="

# Check if .env already exists
if [ -f ".env" ]; then
    print_warning ".env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Keeping existing .env file"
        exit 0
    fi
fi

# Copy development environment file
print_status "Setting up development environment with Redis Cloud..."
cp env.development.example .env

print_success "Development environment configured!"
print_success "Redis Cloud: External Redis server configured"
print_success "Local services: PostgreSQL and Qdrant will run in Docker"

echo
print_warning "Next steps:"
echo "1. Edit .env file if you need to change any settings"
echo "2. Run: docker-compose up -d"
echo "3. Test Redis connection: python test_redis_connection.py"
echo "4. Access your application at: http://localhost:3000"

echo
print_status "Environment file created: .env"
print_status "Redis Cloud connection: redis-15660.c322.us-east-1-2.ec2.redns.redis-cloud.com:15660"
print_status "Local services: PostgreSQL (port 5433), Qdrant (port 6333)"
