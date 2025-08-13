#!/bin/bash

echo "🛑 Stopping CV Analyzer Services..."

# Stop Frontend (screen session)
echo "🌐 Stopping frontend screen session..."
screen -S cv-frontend -X quit 2>/dev/null || echo "Frontend screen session not found"

# Stop Backend (Docker)
echo "📦 Stopping backend Docker services..."
cd /home/ubuntu/alpha-backend
docker-compose down

echo ""
echo "✅ All services stopped"
echo ""
echo "📋 To restart services: ./start-services.sh" 