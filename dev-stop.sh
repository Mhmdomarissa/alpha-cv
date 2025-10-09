#!/bin/bash

# Development Environment Stop Script

set -e

echo "=========================================="
echo "Stopping DEVELOPMENT Environment"
echo "=========================================="
echo ""

docker-compose -f docker-compose.dev.yml down

echo ""
echo "Development environment stopped!"
echo "Production services are still running."
echo ""
