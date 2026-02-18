#!/bin/bash

# SonarQube Analysis Script for Entire Project
# This script runs SonarQube analysis on both backend and frontend

set -e

echo "🔍 Starting SonarQube analysis for entire project..."

# Check if SonarQube is running
if ! curl -s http://localhost:9000/api/system/status | grep -q '"status":"UP"'; then
    echo "❌ SonarQube server is not running. Please start it first:"
    echo "   docker-compose -f docker-compose.dev.yml up -d sonarqube"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Run backend analysis
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Analyzing Backend (Python/FastAPI)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/sonar-analyze-backend.sh"

# Run frontend analysis
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Analyzing Frontend (Next.js/TypeScript)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/sonar-analyze-frontend.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All analyses complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 View results:"
echo "   Backend:  http://localhost:9000/dashboard?id=alpha-cv-backend"
echo "   Frontend: http://localhost:9000/dashboard?id=alpha-cv-frontend"
echo ""
