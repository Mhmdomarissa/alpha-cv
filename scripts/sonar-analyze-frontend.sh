#!/bin/bash

# SonarQube Analysis Script for TypeScript/JavaScript Frontend
# This script runs SonarQube analysis on the frontend codebase

set -e

echo "🔍 Starting SonarQube analysis for TypeScript/JavaScript Frontend..."

# Check if SonarQube is running
if ! curl -s http://localhost:9000/api/system/status | grep -q '"status":"UP"'; then
    echo "❌ SonarQube server is not running. Please start it first:"
    echo "   docker-compose -f docker-compose.dev.yml up -d sonarqube"
    exit 1
fi

# Navigate to frontend directory
cd "$(dirname "$0")/../cv-analyzer-frontend" || exit 1

# Check if sonar-scanner is installed
if ! command -v sonar-scanner &> /dev/null; then
    echo "⚠️  sonar-scanner not found. Installing..."
    
    # Detect OS and install accordingly
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if ! command -v docker &> /dev/null; then
            echo "❌ Docker is required for sonar-scanner. Please install Docker first."
            exit 1
        fi
        echo "📦 Using Docker-based sonar-scanner..."
        SCANNER_CMD="docker run --rm -v $(pwd):/usr/src -w /usr/src sonarsource/sonar-scanner-cli"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install sonar-scanner
        else
            echo "❌ Homebrew is required. Please install Homebrew first."
            exit 1
        fi
        SCANNER_CMD="sonar-scanner"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        # Windows
        echo "⚠️  Windows detected. Please install sonar-scanner manually:"
        echo "   Download from: https://docs.sonarqube.org/latest/analysis/scan/sonarscanner/"
        exit 1
    else
        echo "❌ Unsupported OS: $OSTYPE"
        exit 1
    fi
else
    SCANNER_CMD="sonar-scanner"
fi

# Set SonarQube server URL (default to localhost)
export SONAR_HOST_URL="${SONAR_HOST_URL:-http://localhost:9000}"
export SONAR_TOKEN="${SONAR_TOKEN:-}"

# If no token is provided, use default admin credentials
if [ -z "$SONAR_TOKEN" ]; then
    echo "⚠️  No SONAR_TOKEN provided. Using default admin credentials."
    echo "   For production, create a token at: $SONAR_HOST_URL/account/security"
    export SONAR_LOGIN="admin"
    export SONAR_PASSWORD="admin"
fi

# Run SonarQube analysis
echo "🚀 Running SonarQube scanner..."
$SCANNER_CMD \
    -Dsonar.projectKey=alpha-cv-frontend \
    -Dsonar.sources=src \
    -Dsonar.host.url="$SONAR_HOST_URL" \
    -Dsonar.sourceEncoding=UTF-8 \
    -Dsonar.typescript.tsconfigPath=tsconfig.json

echo "✅ SonarQube analysis complete!"
echo "📊 View results at: $SONAR_HOST_URL/dashboard?id=alpha-cv-frontend"
