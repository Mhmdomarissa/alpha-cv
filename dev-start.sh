#!/bin/bash

# Development Environment Start Script
# This script starts the development environment on different ports

set -e

echo "=========================================="
echo "Starting DEVELOPMENT Environment"
echo "=========================================="
echo ""
echo "This will start:"
echo "  - Frontend on http://localhost:3001"
echo "  - Backend on http://localhost:8001"
echo "  - PostgreSQL on port 5433"
echo "  - Qdrant on port 6334"
echo ""
echo "Production services will NOT be affected!"
echo ""

# Check if .env.dev exists, if not copy from .env
if [ ! -f .env.dev ]; then
    echo "Creating .env.dev from .env..."
    cp .env .env.dev
    # Update URLs in .env.dev
    sed -i 's/postgres:5432/postgres-dev:5432/' .env.dev
    sed -i 's/qdrant:6333/qdrant-dev:6333/' .env.dev
    sed -i 's/cv_analyzer/cv_analyzer_dev/' .env.dev
fi

# Start development containers
echo "Starting development containers..."
docker-compose -f docker-compose.dev.yml up -d

echo ""
echo "=========================================="
echo "Development Environment Started!"
echo "=========================================="
echo ""
echo "Access your development environment:"
echo "  Frontend: http://localhost:3001"
echo "  Backend: http://localhost:8001"
echo ""
echo "To view logs:"
echo "  docker-compose -f docker-compose.dev.yml logs -f"
echo ""
echo "To stop development environment:"
echo "  docker-compose -f docker-compose.dev.yml down"
echo ""
