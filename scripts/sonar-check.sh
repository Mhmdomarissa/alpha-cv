#!/bin/bash

# Quick SonarQube Health Check Script (Bash)
# Checks if SonarQube is running and accessible

set -e

echo "🔍 Checking SonarQube Status..."
echo ""

# Check if SonarQube container is running
echo "📦 Checking Docker containers..."
if docker ps --filter "name=sonarqube" --format "{{.Names}}" | grep -q sonarqube; then
    SONARQUBE_NAME=$(docker ps --filter "name=sonarqube" --format "{{.Names}}")
    echo "   ✅ SonarQube container is running: $SONARQUBE_NAME"
else
    echo "   ❌ SonarQube container is not running"
    echo "   💡 Start it with: docker-compose -f docker-compose.dev.yml up -d sonarqube"
fi

if docker ps --filter "name=sonarqube-db" --format "{{.Names}}" | grep -q sonarqube-db; then
    SONARQUBE_DB_NAME=$(docker ps --filter "name=sonarqube-db" --format "{{.Names}}")
    echo "   ✅ SonarQube DB container is running: $SONARQUBE_DB_NAME"
else
    echo "   ❌ SonarQube DB container is not running"
    echo "   💡 Start it with: docker-compose -f docker-compose.dev.yml up -d sonarqube-db"
fi

echo ""

# Check if SonarQube API is accessible
echo "🌐 Checking SonarQube API..."
if curl -s http://localhost:9000/api/system/status | grep -q '"status":"UP"'; then
    echo "   ✅ SonarQube API is UP and accessible"
    echo "   📊 Web Interface: http://localhost:9000"
else
    echo "   ❌ SonarQube API is not accessible"
    echo "   💡 Make sure SonarQube is running and wait 1-2 minutes for startup"
fi

echo ""

# Check if token is set
echo "🔑 Checking authentication..."
if [ -n "$SONAR_TOKEN" ]; then
    echo "   ✅ SONAR_TOKEN is set"
else
    echo "   ⚠️  SONAR_TOKEN is not set"
    echo "   💡 Set it with: export SONAR_TOKEN='your-token-here'"
    echo "   💡 Or use default admin credentials (admin/admin)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Health check complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
