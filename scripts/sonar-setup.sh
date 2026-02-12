#!/bin/bash

# SonarQube Setup Script
# This script sets up SonarQube server and initializes the project

set -e

echo "🚀 Setting up SonarQube for Alpha CV Analyzer..."

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install Docker and docker-compose first."
    exit 1
fi

# Start SonarQube services
echo "📦 Starting SonarQube services..."
cd "$PROJECT_ROOT" || exit 1
docker-compose -f docker-compose.dev.yml up -d sonarqube sonarqube-db

# Wait for SonarQube to be ready
echo "⏳ Waiting for SonarQube to be ready (this may take 1-2 minutes)..."
MAX_WAIT=120
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
    if curl -s http://localhost:9000/api/system/status | grep -q '"status":"UP"'; then
        echo "✅ SonarQube is ready!"
        break
    fi
    echo "   Still waiting... ($ELAPSED/$MAX_WAIT seconds)"
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "❌ SonarQube did not start within $MAX_WAIT seconds. Please check logs:"
    echo "   docker-compose -f docker-compose.dev.yml logs sonarqube"
    exit 1
fi

# Get default admin password
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 SonarQube Initial Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Default credentials:"
echo "   Username: admin"
echo "   Password: admin"
echo ""
echo "⚠️  IMPORTANT: Change the default password on first login!"
echo ""
echo "📊 Access SonarQube at: http://localhost:9000"
echo ""
echo "🔑 To create an authentication token:"
echo "   1. Login at http://localhost:9000"
echo "   2. Go to: My Account > Security > Generate Tokens"
echo "   3. Copy the token and set it as environment variable:"
echo "      export SONAR_TOKEN=your-token-here"
echo ""
echo "✅ SonarQube setup complete!"
echo ""
